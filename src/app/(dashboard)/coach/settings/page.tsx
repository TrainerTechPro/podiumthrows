"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { useAccessibility } from "@/components/accessibility-provider";
import { Radio, RadioGroup } from "@/components/ui/Radio";
import dynamic from "next/dynamic";
import { csrfHeaders } from "@/lib/csrf-client";
import { validateNewPassword } from "@/lib/api-schemas";
import { QuickActionsSettings } from "@/components/ui/QuickActionsSettings";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SendFeedbackCard } from "@/components/feedback/SendFeedbackCard";
import { ExportDataButton } from "@/components/settings/ExportDataButton";
import { DeleteAccountSection } from "@/components/settings/DeleteAccountSection";
import { Camera, Check, ChevronRight, Zap } from "lucide-react";

// Sub-page client components — lazy-loaded so the initial profile-tab paint
// doesn't pull in their bundles. Each is the same component the standalone
// /coach/settings/<sub> route used to mount; the standalone routes now
// 307-redirect here with ?tab=<id>.
const CoachNotificationsTabContent = dynamic(
  () => import("./_notifications-tab").then((m) => ({ default: m.CoachNotificationsTabContent })),
  { ssr: false }
);
const CoachSecurityClient = dynamic(() => import("./security/page"), { ssr: false });
const CoachAutoregulationClient = dynamic(() => import("./autoregulation/page"), {
  ssr: false,
});
const CoachImplementsTabContent = dynamic(
  () => import("./_implements-tab").then((m) => ({ default: m.ImplementsTabContent })),
  { ssr: false }
);
const CoachUnitsPanel = dynamic(
  () => import("@/components/settings/UnitsPanel").then((m) => ({ default: m.UnitsPanel })),
  { ssr: false }
);

const ProfilePictureEditor = dynamic(() => import("@/components/profile-picture-editor"), {
  ssr: false,
});

interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  organization: string;
  avatarUrl: string;
}

interface Subscription {
  plan: string;
  athleteCount: number;
  stripeCustomerId: string | null;
  paymentFailedAt: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface InvitationItem {
  id: string;
  email: string;
  status: string;
  sport: string | null;
  position: string | null;
  createdAt: string;
  expiresAt: string;
  inviteUrl?: string;
}

type TabId =
  | "profile"
  | "team"
  | "billing"
  | "notifications"
  | "security"
  | "autoregulation"
  | "implements"
  | "integrations"
  // Legacy IDs retained so existing render branches still match. Tabs
  // that aren't in the visible list (activity, preferences, invitations)
  // are reachable via the consolidated panels above.
  | "invitations"
  | "activity"
  | "preferences";

const VISIBLE_TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "autoregulation", label: "Autoregulation" },
  { id: "implements", label: "Implements" },
  { id: "integrations", label: "Integrations" },
];

const VALID_TAB_IDS: readonly TabId[] = [
  "profile",
  "team",
  "billing",
  "notifications",
  "security",
  "autoregulation",
  "implements",
  "integrations",
];

function isValidTabId(v: string | null | undefined): v is TabId {
  return !!v && (VALID_TAB_IDS as readonly string[]).includes(v);
}

interface CoachPreferences {
  globalDefaultPage?: string;
  workspaceDefaults?: Record<string, string>;
  myTraining?: {
    mode?: "competitive" | "recreational";
    primaryEvent?: string;
    gender?: "male" | "female";
  };
}

const PLAN_LIMITS: Record<string, number> = {
  FREE: 3,
  PRO: 25,
  ELITE: Infinity,
};

const ACTION_LABELS: Record<string, string> = {
  SIGN_IN: "Signed in",
  CREATE_ATHLETE: "Added athlete",
  DELETE_ATHLETE: "Removed athlete",
  PRESCRIBE_SESSION: "Prescribed session",
  IMPORT_EXERCISE: "Imported exercise",
  CREATE_EXERCISE: "Created exercise",
  SEND_QUESTIONNAIRE: "Sent questionnaire",
  INVITE_ATHLETE: "Invited athlete",
  UPGRADE_PLAN: "Upgraded plan",
  DOWNGRADE_PLAN: "Downgraded plan",
  CANCEL_SUBSCRIPTION: "Cancelled subscription",
  ADD_VIDEO: "Added video",
  UPDATE_SETTINGS: "Updated settings",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function CoachSettingsPage() {
  const { toast } = useToast();
  const { fontSize, setFontSize, reducedMotion, setReducedMotion } = useAccessibility();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Extract once so the type predicate's narrowing applies on the second
  // reference — was using `searchParams!.get("tab") as TabId` which silently
  // accepts anything if the URL drifts past the validator.
  const tabFromUrl = searchParams?.get("tab");
  const initialTab: TabId = isValidTabId(tabFromUrl) ? tabFromUrl : "profile";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Keep URL ↔ tab in sync. Profile is the default and gets a clean URL.
  useEffect(() => {
    const current = searchParams?.get("tab");
    if (current === activeTab) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (activeTab === "profile") params.delete("tab");
    else params.set("tab", activeTab);
    const qs = params.toString();
    router.replace(qs ? `/coach/settings?${qs}` : "/coach/settings", { scroll: false });
  }, [activeTab, router, searchParams]);

  // Respond to external URL changes (e.g. someone clicks a Link?tab=security).
  useEffect(() => {
    const fromUrl = searchParams?.get("tab");
    if (isValidTabId(fromUrl) && fromUrl !== activeTab) setActiveTab(fromUrl);
    else if (!fromUrl && activeTab !== "profile") setActiveTab("profile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    firstName: "",
    lastName: "",
    email: "",
    bio: "",
    organization: "",
    avatarUrl: "",
  });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: string; text: string } | null>(null);

  // Invitation form
  const [inviteForm, setInviteForm] = useState({ email: "", sport: "", position: "" });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: string; text: string } | null>(null);

  // Portal loading
  const [portalLoading, setPortalLoading] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<CoachPreferences>({});
  const [prefSaving, setPrefSaving] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>(["general", "throws"]);
  const [trainingEnabled, setTrainingEnabled] = useState(false);
  const [trainingEnabling, setTrainingEnabling] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const user = data.data?.user;
        if (user) {
          const cp = user.coachProfile;
          setProfile({
            firstName: cp?.firstName || "",
            lastName: cp?.lastName || "",
            email: user.email || "",
            bio: cp?.bio || "",
            organization: cp?.organization || "",
            avatarUrl: cp?.avatarUrl || "",
          });
          if (cp) {
            setTrainingEnabled(cp.trainingEnabled || false);
            setSubscription({
              plan: cp.plan || "FREE",
              athleteCount: cp._count?.athletes || 0,
              stripeCustomerId: cp.stripeCustomerId || null,
              paymentFailedAt: cp.paymentFailedAt || null,
              cancelAtPeriodEnd: cp.cancelAtPeriodEnd || false,
              currentPeriodEnd: cp.currentPeriodEnd || null,
            });
            try {
              const mods = cp.enabledModules
                ? JSON.parse(cp.enabledModules)
                : ["general", "throws"];
              setEnabledModules(Array.isArray(mods) ? mods : ["general", "throws"]);
            } catch {
              setEnabledModules(["general", "throws"]);
            }
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Activity log lives inside the Security tab now.
    if (activeTab === "security") {
      fetch("/api/activity")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setActivities(data.data);
        });
    }
    // Invitations + preferences both live inside the Team tab.
    if (activeTab === "team") {
      loadInvitations();
      fetch("/api/coach/preferences")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setPreferences(data.data);
        });
    }
  }, [activeTab]);

  async function handleSavePreferences(patch: Partial<CoachPreferences>) {
    // Guard against concurrent PUTs — rapidly clicking different landing-page
    // radios used to fire overlapping requests; whichever resolved last won
    // regardless of click order, leaving the user on the wrong default page.
    if (prefSaving) return;
    setPrefSaving(true);
    try {
      const res = await fetch("/api/coach/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
        toast("Preferences saved");
      } else {
        toast(data.error || "Failed to save preferences", "error");
      }
    } catch {
      toast("Network error — please try again.", "error");
    } finally {
      setPrefSaving(false);
    }
  }

  function loadInvitations() {
    fetch("/api/invitations")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setInvitations(data.data);
      });
  }

  async function handleSaveCoachProfilePicture(dataUrl: string) {
    const res = await fetch("/api/coach/profile-picture", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ avatarUrl: dataUrl }),
    });
    const data = await res.json();
    if (data.success) {
      setProfile((p) => ({ ...p, avatarUrl: dataUrl }));
      toast("Profile picture updated");
      router.refresh();
    } else {
      throw new Error(data.error || "Failed to upload picture");
    }
  }

  async function handleRemoveCoachProfilePicture() {
    const res = await fetch("/api/coach/profile-picture", {
      method: "DELETE",
      headers: csrfHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      setProfile((p) => ({ ...p, avatarUrl: "" }));
      toast("Profile picture removed");
      router.refresh();
    } else {
      throw new Error(data.error || "Failed to remove picture");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          bio: profile.bio,
          organization: profile.organization,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        toast("Profile saved successfully");
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast(data.error || "Failed to save profile", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    // Mirror server password rules so the user gets the specific complaint
    // before submitting (was: client only enforced length ≥ 6, but server
    // requires 8 chars + uppercase + digit).
    const policyError = validateNewPassword(passwordForm.newPassword);
    if (policyError) {
      setPwMessage({ type: "error", text: policyError });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPwMessage({ type: "success", text: "Password updated successfully" });
        toast("Password updated successfully");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setPwMessage({ type: "error", text: data.error || "Failed to update password" });
        toast(data.error || "Failed to update password", "error");
      }
    } catch {
      setPwMessage({ type: "error", text: "Network error — please try again." });
      toast("Network error — please try again.", "error");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteSending(true);
    setInviteMessage(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (data.success) {
        setInviteMessage({
          type: "success",
          text: "Invitation sent! Share the link with your athlete.",
        });
        toast("Invitation sent successfully");
        setInviteForm({ email: "", sport: "", position: "" });
        loadInvitations();
      } else {
        setInviteMessage({ type: "error", text: data.error || "Failed to send invitation" });
        toast(data.error || "Failed to send invitation", "error");
      }
    } catch {
      setInviteMessage({ type: "error", text: "Network error — please try again." });
      toast("Network error. Please try again.", "error");
    } finally {
      setInviteSending(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: csrfHeaders() });
      const payload = await res.json();
      if (res.ok && payload.success && payload.data?.url) {
        window.location.href = payload.data.url;
      } else {
        toast(payload.error || "Could not open billing portal", "error");
      }
    } catch {
      toast("Network error. Please try again.", "error");
    } finally {
      setPortalLoading(false);
    }
  }

  // Note: coaches can no longer copy an existing invitation's link after
  // creation — invitation tokens are now stored as SHA-256 hashes. The raw
  // token lives only in the recipient's email. To re-share, revoke and reissue.

  // Visible-tabs list comes from the consolidated VISIBLE_TABS constant —
  // [Profile | Team | Billing | Notifications | Security | Autoregulation |
  // Integrations]. The legacy IDs (invitations / activity / preferences)
  // still drive existing render branches; the "team" tab below mounts
  // invitations + preferences into one panel, and "security" mounts the
  // activity log alongside the security sub-page content.
  const tabs = VISIBLE_TABS;

  const planColors: Record<string, string> = {
    FREE: "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300",
    PRO: "bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400",
    ELITE: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  if (loading) {
    return (
      <div className="max-w-2xl animate-spring-up">
        <div className="mb-8">
          <div className="skeleton h-7 w-32 mb-2" />
          <div className="skeleton h-4 w-56" />
        </div>
        <div className="skeleton h-10 w-full rounded-lg mb-6" />
        <div className="card mb-6 space-y-4">
          <div className="skeleton h-5 w-16 mb-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div>
              <div className="skeleton h-4 w-20 mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="skeleton h-4 w-24 mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Settings</h1>
          <p className="text-surface-700 dark:text-surface-300 mt-1">
            Manage your profile, billing, and preferences
          </p>
        </div>

        {/* Tabs — Security and Autoregulation now live inline as tab panels;
            the previous standalone /coach/settings/{security,autoregulation,
            notifications} routes 307-redirect here with ?tab=. */}
        <div className="flex gap-1 mb-6 bg-[var(--muted-bg)] rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 min-h-[44px] py-2.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm"
                  : "text-surface-700 dark:text-surface-300 hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="animate-spring-up">
            <form onSubmit={handleSaveProfile} className="card mb-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Profile</h2>
              <div className="space-y-4">
                {/* Profile Picture */}
                <div className="flex items-center gap-6 pb-4 border-b border-[var(--card-border)]">
                  <div className="relative group">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt="Profile"
                        width={72}
                        height={72}
                        unoptimized
                        className="w-18 h-18 rounded-full object-cover border-2 border-[var(--card-border)]"
                        style={{ width: 72, height: 72 }}
                      />
                    ) : (
                      <div className="w-[72px] h-[72px] rounded-full bg-[rgba(212,168,67,0.12)] flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold text-xl border-2 border-[var(--card-border)]">
                        {profile.firstName?.[0] || "C"}
                        {profile.lastName?.[0] || ""}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPhotoEditor(true)}
                      className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit profile photo"
                    >
                      <Camera
                        className="h-5 w-5 text-white"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowPhotoEditor(true)}
                      className="btn-secondary text-sm"
                    >
                      {profile.avatarUrl ? "Edit Photo" : "Add Photo"}
                    </button>
                    <p className="text-xs text-muted">Crop, zoom &amp; rotate</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="label">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="label">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={profile.lastName}
                      onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="label">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="input bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label htmlFor="bio" className="label">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="Brief coaching background and philosophy"
                    rows={3}
                    className="input resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="organization" className="label">
                    Organization
                  </label>
                  <input
                    id="organization"
                    type="text"
                    value={profile.organization}
                    onChange={(e) => setProfile((p) => ({ ...p, organization: e.target.value }))}
                    placeholder="e.g. University of Oregon, USATF"
                    className="input"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--card-border)]">
                {saved && (
                  <span className="text-sm text-success-600 font-medium flex items-center gap-1">
                    <Check className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                    Saved
                  </span>
                )}
                {!saved && <div />}
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>

            {/* Units Section — per-data-type metric/imperial display prefs */}
            <CoachUnitsPanel />

            {/* Password Section */}
            <form onSubmit={handleChangePassword} className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Change Password
              </h2>
              {pwMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm border ${
                    pwMessage.type === "error"
                      ? "bg-status-danger-bg text-status-danger-fg border-status-danger-fg/20"
                      : "bg-status-success-bg text-status-success-fg border-status-success-fg/20"
                  }`}
                  role="alert"
                >
                  {pwMessage.text}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="label">
                    Current Password
                  </label>
                  <PasswordInput
                    id="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                    }
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="label">
                    New Password
                  </label>
                  <PasswordInput
                    id="newPassword"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="label">
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--card-border)] flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving || !passwordForm.currentPassword || !passwordForm.newPassword}
                  className="btn-primary"
                >
                  {pwSaving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Billing Tab — show shimmer skeleton while subscription is loading.
            Previously the panel rendered nothing when subscription === null,
            looking broken on slow networks or first paint after a tab switch. */}
        {activeTab === "billing" && !subscription && (
          <div className="animate-spring-up space-y-6">
            <div className="card space-y-4">
              <div className="h-6 w-32 rounded bg-[var(--muted-bg)] shimmer" />
              <div className="h-4 w-48 rounded bg-[var(--muted-bg)] shimmer" />
              <div className="h-10 w-40 rounded bg-[var(--muted-bg)] shimmer" />
            </div>
          </div>
        )}
        {activeTab === "billing" && subscription && (
          <div className="animate-spring-up space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Current Plan</h2>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${planColors[subscription.plan] || planColors.FREE}`}
                  >
                    {subscription.plan}
                  </span>
                  {subscription.plan === "FREE" ? (
                    <span className="text-sm text-surface-700 dark:text-surface-300">
                      Free Plan
                    </span>
                  ) : subscription.paymentFailedAt ? (
                    <span className="text-sm text-primary-500 font-medium">Past Due</span>
                  ) : subscription.cancelAtPeriodEnd ? (
                    <span className="text-sm text-primary-500 font-medium">Canceling</span>
                  ) : (
                    <span className="text-sm text-success-500 font-medium">Active</span>
                  )}
                </div>
                {subscription.currentPeriodEnd && subscription.plan !== "FREE" && (
                  <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
                    {subscription.cancelAtPeriodEnd ? "Access until " : "Renews on "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Athlete usage */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-surface-700 dark:text-surface-300">Athletes</span>
                  <span className="text-[var(--foreground)] font-medium">
                    {subscription.athleteCount} /{" "}
                    {PLAN_LIMITS[subscription.plan] === Infinity
                      ? "Unlimited"
                      : PLAN_LIMITS[subscription.plan]}
                  </span>
                </div>
                {PLAN_LIMITS[subscription.plan] !== Infinity && (
                  <div className="w-full bg-[var(--muted-bg)] rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-colors"
                      style={{
                        width: `${Math.min(100, (subscription.athleteCount / (PLAN_LIMITS[subscription.plan] || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--card-border)]">
                {subscription.plan === "FREE" ? (
                  <a href="/pricing" className="btn-primary text-center">
                    Upgrade Plan
                  </a>
                ) : (
                  <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="btn-primary"
                  >
                    {portalLoading ? "Loading…" : "Manage Subscription"}
                  </button>
                )}
                {subscription.plan !== "FREE" && (
                  <a href="/pricing" className="btn-secondary text-center">
                    View Plans
                  </a>
                )}
              </div>
            </div>

            {/* Plan features */}
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Plan Features</h2>
              {subscription.plan === "FREE" && (
                <ul className="space-y-2 text-sm text-surface-700 dark:text-surface-300">
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Up to 3 athletes
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Session logging &amp; throw tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Readiness check-ins
                  </li>
                </ul>
              )}
              {subscription.plan === "PRO" && (
                <ul className="space-y-2 text-sm text-surface-700 dark:text-surface-300">
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Up to 25 athletes
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Program builder
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    ACWR analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Athlete progress exports
                  </li>
                </ul>
              )}
              {subscription.plan === "ELITE" && (
                <ul className="space-y-2 text-sm text-surface-700 dark:text-surface-300">
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Unlimited athletes
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-2">
                    <Check
                      className="h-4 w-4 text-success-500 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                    Priority support
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Team Tab — invitations roster + coach preferences (the panel below
            handles preferences). Both share the "team" id; the original
            invitations/preferences IDs only ran the data fetch. */}
        {activeTab === "team" && (
          <div className="animate-spring-up space-y-6">
            <form onSubmit={handleSendInvite} className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Invite an Athlete
              </h2>
              <p className="text-sm text-surface-700 dark:text-surface-300 mb-4">
                Send an invitation link to an athlete. They&apos;ll be automatically linked to your
                account when they register.
              </p>
              {inviteMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    inviteMessage.type === "error"
                      ? "bg-danger-50 text-danger-700 border border-danger-200 dark:bg-danger-900/30 dark:text-danger-400 dark:border-danger-800"
                      : "bg-success-50 text-success-700 border border-success-200 dark:bg-success-900/30 dark:text-success-400 dark:border-success-800"
                  }`}
                >
                  {inviteMessage.text}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="inviteEmail" className="label">
                    Athlete Email
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="athlete@example.com"
                    className="input"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inviteSport" className="label">
                      Event (optional)
                    </label>
                    <input
                      id="inviteSport"
                      type="text"
                      value={inviteForm.sport}
                      onChange={(e) => setInviteForm((f) => ({ ...f, sport: e.target.value }))}
                      placeholder="e.g. Shot Put, Discus"
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="invitePosition" className="label">
                      Classification (optional)
                    </label>
                    <input
                      id="invitePosition"
                      type="text"
                      value={inviteForm.position}
                      onChange={(e) => setInviteForm((f) => ({ ...f, position: e.target.value }))}
                      placeholder="e.g. D1, Professional"
                      className="input"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" disabled={inviteSending} className="btn-primary">
                  {inviteSending ? "Sending…" : "Send Invitation"}
                </button>
              </div>
            </form>

            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Sent Invitations
              </h2>
              {invitations.length === 0 ? (
                <div className="flex flex-col items-center text-center py-8 gap-2">
                  <div className="text-surface-300 dark:text-surface-600">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    No invitations sent
                  </p>
                  <p className="text-xs text-muted max-w-full sm:max-w-[220px]">
                    Use the form above to invite an athlete by email — they&apos;ll show up here
                    once sent.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-[var(--muted-bg)] gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {inv.email}
                        </p>
                        <p className="text-xs text-surface-700 dark:text-surface-300">
                          {inv.sport && `${inv.sport}`}
                          {inv.sport && inv.position && " - "}
                          {inv.position && `${inv.position}`}
                          {(inv.sport || inv.position) && " \u00b7 "}
                          Sent {formatRelativeTime(inv.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            inv.status === "PENDING"
                              ? "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
                              : inv.status === "ACCEPTED"
                                ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                                : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                          }`}
                        >
                          {inv.status === "PENDING" && new Date(inv.expiresAt) < new Date()
                            ? "Expired"
                            : inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                        </span>
                        {inv.status === "PENDING" && new Date(inv.expiresAt) >= new Date() && (
                          <span className="text-xs text-muted">Link delivered by email</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity log — surfaced inside the Security tab so coaches can
            triage logins/account events alongside MFA + password tools. */}
        {activeTab === "security" && (
          <div className="animate-spring-up">
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">
                Recent Activity
              </h2>
              {activities.length === 0 ? (
                <div className="flex flex-col items-center text-center py-8 gap-2">
                  <div className="text-surface-300 dark:text-surface-600">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">No activity yet</p>
                  <p className="text-xs text-muted max-w-full sm:max-w-[220px]">
                    Account actions like sign-ins and athlete changes will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted-bg)]"
                    >
                      <div className="w-8 h-8 rounded-full bg-status-warning-bg flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          className="w-4 h-4 text-status-warning-fg"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {ACTION_LABELS[act.action] || act.action}
                        </p>
                        {act.details && (
                          <p className="text-xs text-surface-700 dark:text-surface-300 truncate">
                            {act.details}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted shrink-0">
                        {formatRelativeTime(act.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coach preferences — folded into the Team tab. The Notifications
            link card was dropped: notifications now have a dedicated tab. */}
        {activeTab === "team" && (
          <div className="animate-spring-up space-y-6 mt-6">
            {/* Global Default Page */}
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">
                Default Landing Page
              </h2>
              <p className="text-sm text-surface-700 dark:text-surface-300 mb-5">
                Choose which page opens when you first launch the app.
              </p>
              <RadioGroup
                value={preferences.globalDefaultPage ?? "/coach"}
                onChange={(next) => handleSavePreferences({ globalDefaultPage: next })}
                aria-label="Default page"
                className="space-y-2"
              >
                {[
                  {
                    href: "/coach",
                    label: "Coach Dashboard",
                    desc: "General overview and metrics",
                  },
                  {
                    href: "/coach/throws",
                    label: "Throws Roster",
                    desc: "Throws roster pulse view",
                  },
                  { href: "/coach/athletes", label: "Athletes", desc: "Your full roster" },
                  { href: "/coach/calendar", label: "Calendar", desc: "Scheduled sessions" },
                ].map((page) => (
                  <Radio
                    key={page.href}
                    value={page.href}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-colors w-full ${
                      preferences.globalDefaultPage === page.href
                        ? "bg-[rgba(212,168,67,0.08)] border border-primary-500/30"
                        : "border border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                    label={
                      <span className="block">
                        <span className="text-sm font-medium text-[var(--foreground)] block">
                          {page.label}
                        </span>
                        <span className="text-xs text-muted block">{page.desc}</span>
                      </span>
                    }
                  />
                ))}
              </RadioGroup>
            </div>

            {/* Per-Workspace Defaults */}
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Quick Links</h2>
              <p className="text-sm text-surface-700 dark:text-surface-300 mb-5">
                Choose the default page when switching to the throws workspace.
              </p>
              <div className="space-y-6">
                {enabledModules.includes("throws") && (
                  <div>
                    <p className="label mb-3">Podium Throws</p>
                    <RadioGroup
                      value={preferences.workspaceDefaults?.throws ?? "/coach/throws"}
                      onChange={(next) =>
                        handleSavePreferences({ workspaceDefaults: { throws: next } })
                      }
                      aria-label="Default throws page"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2 !space-y-0"
                    >
                      {[
                        { href: "/coach/throws", label: "Throws Roster" },
                        { href: "/coach/throws/builder", label: "Session Builder" },
                        { href: "/coach/throws/practice", label: "Practice" },
                        { href: "/coach/throws/analyze", label: "Analysis" },
                      ].map((page) => (
                        <Radio
                          key={page.href}
                          value={page.href}
                          className={`flex items-center gap-2.5 p-3 rounded-xl transition-colors w-full ${
                            (preferences.workspaceDefaults?.throws ?? "/coach/throws") === page.href
                              ? "bg-[rgba(212,168,67,0.08)] border border-primary-500/30"
                              : "border border-[var(--card-border)] hover:border-[var(--color-border-strong)]"
                          }`}
                          label={
                            <span className="text-sm font-medium text-[var(--foreground)]">
                              {page.label}
                            </span>
                          }
                        />
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </div>
            </div>

            {/* Training Mode */}
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-1">Training Mode</h2>
              <p className="text-sm text-surface-700 dark:text-surface-300 mb-5">
                {trainingEnabled
                  ? "Training Mode is enabled. Use the Coach/Training toggle in the header to switch between coaching and your own training."
                  : "Enable Training Mode to track your own training using the same tools your athletes use. You'll get your own athlete profile, session logging, PRs, and readiness tracking."}
              </p>

              {trainingEnabled ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-200 dark:border-success-500/20">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-success-600 dark:text-success-400 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-success-700 dark:text-success-400">
                      Training Mode Active
                    </p>
                    <p className="text-xs text-success-600/80 dark:text-success-400/70">
                      Switch between Coach and Training using the toggle in the top bar.
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setTrainingEnabling(true);
                    try {
                      const res = await fetch("/api/coach/training-mode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...csrfHeaders() },
                      });
                      const data = await res.json();
                      if (data.success) {
                        setTrainingEnabled(true);
                        toast(
                          "Training Mode enabled! Use the toggle in the header to switch.",
                          "success"
                        );
                        router.refresh();
                      } else {
                        toast(data.error || "Failed to enable Training Mode", "error");
                      }
                    } catch {
                      toast("Failed to enable Training Mode", "error");
                    } finally {
                      setTrainingEnabling(false);
                    }
                  }}
                  disabled={trainingEnabling}
                  className="btn-primary flex items-center gap-2"
                >
                  {trainingEnabling ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Enable Training Mode
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <QuickActionsSettings role="COACH" />

            {prefSaving && (
              <div className="text-xs text-muted flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving changes…
              </div>
            )}
          </div>
        )}

        {/* Feedback + Accessibility — only on Profile tab. Previously rendered
            unconditionally, which sandwiched them BETWEEN the active tab's
            content and the page bottom — clicking Notifications meant your
            notifications appeared under unrelated accessibility controls. */}
        {activeTab === "profile" && (
          <>
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
                Feedback
              </h2>
              <SendFeedbackCard />
            </div>

            <div className="card mt-6">
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Accessibility</h2>
              <div className="space-y-6">
                {/* Font Size */}
                <div>
                  <label className="label">Font Size</label>
                  <div className="flex gap-2 flex-wrap">
                    {(["default", "large", "xl"] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setFontSize(size)}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          fontSize === size
                            ? "bg-[rgba(212,168,67,0.12)] text-[var(--foreground)]"
                            : "bg-[var(--muted-bg)] text-surface-700 dark:text-surface-300"
                        }`}
                      >
                        {size === "default" ? "Default" : size === "large" ? "Large" : "XL"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reduced Motion — whole row is clickable so tapping the
                    label text also toggles the switch (was visual-only before). */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  onClick={() => setReducedMotion(!reducedMotion)}
                  className="w-full flex items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md"
                >
                  <span>
                    <span className="label mb-0 block">Reduce animations</span>
                    <span className="text-sm text-surface-700 dark:text-surface-300 mt-0.5 block font-normal">
                      Minimizes motion for users who are sensitive to animations
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                      reducedMotion ? "bg-primary-500" : "bg-[var(--color-border-strong)]"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${
                        reducedMotion ? "translate-x-5 ml-0.5" : "translate-x-0 ml-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Notifications Tab — mounts the existing /coach/settings/notifications
            client component, which now lives only here. */}
        {activeTab === "notifications" && (
          <div className="animate-spring-up">
            <CoachNotificationsTabContent />
          </div>
        )}

        {/* Autoregulation Tab — mounts the original autoregulation page client. */}
        {activeTab === "autoregulation" && (
          <div className="animate-spring-up">
            <CoachAutoregulationClient />
          </div>
        )}

        {/* Implements Tab — coach's per-roster custom implement catalog. */}
        {activeTab === "implements" && <CoachImplementsTabContent />}

        {/* Integrations Tab — coaches don't have wearable connections of
            their own; the link routes to the athlete-side integrations
            hub when they're operating in Training Mode. */}
        {activeTab === "integrations" && (
          <div className="animate-spring-up space-y-3">
            <Link
              href="/athlete/integrations"
              className="card card-interactive p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                <Zap size={20} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Wearable Integrations
                </p>
                <p className="text-xs text-muted">
                  Available in Training Mode — connects WHOOP, Oura Ring, and more.
                </p>
              </div>
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                className="text-muted"
                aria-hidden="true"
              />
            </Link>
          </div>
        )}
      </div>

      {/* Security Tab — mounts the existing /coach/settings/security client
          alongside the activity log block above. The activity log itself
          renders inside `activeTab === "security"` further up. */}
      {activeTab === "security" && (
        <div className="max-w-2xl animate-spring-up mt-6">
          <CoachSecurityClient />
        </div>
      )}

      {activeTab === "security" && (
        <div className="max-w-2xl animate-spring-up mt-6">
          <section className="card p-5 space-y-3">
            <header className="space-y-1">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Your data
              </h2>
              <p className="text-sm text-[var(--foreground)]">
                Download everything we&apos;ve stored about you — your roster, programs, notes,
                settings. Athletes export their own data from their own accounts.
              </p>
            </header>
            <ExportDataButton />
            <p className="text-xs text-muted">Limited to one download per day.</p>
          </section>
        </div>
      )}

      {activeTab === "security" && (
        <div className="max-w-2xl animate-spring-up mt-6">
          <DeleteAccountSection role="COACH" />
        </div>
      )}

      {/* Profile Picture Editor Modal */}
      {showPhotoEditor && (
        <ProfilePictureEditor
          currentImageUrl={profile.avatarUrl}
          onSave={handleSaveCoachProfilePicture}
          onRemove={profile.avatarUrl ? handleRemoveCoachProfilePicture : undefined}
          onClose={() => setShowPhotoEditor(false)}
        />
      )}
    </>
  );
}
