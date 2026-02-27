"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useToast } from "@/components/toast";
import { useAccessibility } from "@/components/accessibility-provider";
import ProfilePictureEditor from "@/components/profile-picture-editor";

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
  token: string;
  status: string;
  sport: string | null;
  position: string | null;
  createdAt: string;
  expiresAt: string;
  inviteUrl?: string;
}

type TabId = "profile" | "billing" | "invitations" | "activity" | "preferences";

interface CoachPreferences {
  globalDefaultPage?: string;
  workspaceDefaults?: Record<string, string>;
}

const PLAN_LIMITS: Record<string, number> = {
  FREE: 3,
  PRO: 25,
  ELITE: Infinity,
};

const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  PRO: 29,
  ELITE: 99,
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
  const [activeTab, setActiveTab] = useState<TabId>("profile");
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Portal loading
  const [portalLoading, setPortalLoading] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<CoachPreferences>({});
  const [prefSaving, setPrefSaving] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>(["general", "throws"]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const user = data.user;
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
            setSubscription({
              plan: cp.plan || "FREE",
              athleteCount: cp._count?.athletes || 0,
              stripeCustomerId: cp.stripeCustomerId || null,
            });
            try {
              const mods = cp.enabledModules ? JSON.parse(cp.enabledModules) : ["general", "throws"];
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
    if (activeTab === "activity") {
      fetch("/api/activity")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setActivities(data.data);
        });
    }
    if (activeTab === "invitations") {
      loadInvitations();
    }
    if (activeTab === "preferences") {
      fetch("/api/coach/preferences")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setPreferences(data.data);
        });
    }
  }, [activeTab]);

  async function handleSavePreferences(patch: Partial<CoachPreferences>) {
    setPrefSaving(true);
    try {
      const res = await fetch("/api/coach/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      toast("Network error", "error");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: dataUrl }),
    });
    const data = await res.json();
    if (data.success) {
      setProfile((p) => ({ ...p, avatarUrl: dataUrl }));
      toast("Profile picture updated");
    } else {
      throw new Error(data.error || "Failed to upload picture");
    }
  }

  async function handleRemoveCoachProfilePicture() {
    const res = await fetch("/api/coach/profile-picture", { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setProfile((p) => ({ ...p, avatarUrl: "" }));
      toast("Profile picture removed");
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
        headers: { "Content-Type": "application/json" },
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
    if (passwordForm.newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      setPwMessage({ type: "error", text: "Network error" });
      toast("Network error. Please try again.", "error");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (data.success) {
        setInviteMessage({ type: "success", text: "Invitation sent! Share the link with your athlete." });
        toast("Invitation sent successfully");
        setInviteForm({ email: "", sport: "", position: "" });
        loadInvitations();
      } else {
        setInviteMessage({ type: "error", text: data.error || "Failed to send invitation" });
        toast(data.error || "Failed to send invitation", "error");
      }
    } catch {
      setInviteMessage({ type: "error", text: "Network error" });
      toast("Network error. Please try again.", "error");
    } finally {
      setInviteSending(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch {
      console.error("Portal error");
    } finally {
      setPortalLoading(false);
    }
  }

  function copyInviteLink(invitation: InvitationItem) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/register?invite=${invitation.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(invitation.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "billing", label: "Billing" },
    { id: "invitations", label: "Invitations" },
    { id: "activity", label: "Activity" },
    { id: "preferences", label: "Preferences" },
  ];

  const planColors: Record<string, string> = {
    FREE: "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]",
    PRO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
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
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Settings</h1>
          <p className="text-[var(--color-text-2)] mt-1">Manage your profile, billing, and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--color-bg-subtle)] rounded-lg p-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-2)] hover:text-[var(--color-text)]"
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
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Profile</h2>
              <div className="space-y-4">
                {/* Profile Picture */}
                <div className="flex items-center gap-6 pb-4 border-b border-[var(--color-border)]">
                  <div className="relative group">
                    {profile.avatarUrl ? (
                      <Image
                        src={profile.avatarUrl}
                        alt="Profile"
                        width={72}
                        height={72}
                        unoptimized
                        className="w-18 h-18 rounded-full object-cover border-2 border-[var(--color-border)]"
                        style={{ width: 72, height: 72 }}
                      />
                    ) : (
                      <div className="w-[72px] h-[72px] rounded-full bg-[rgba(212,168,67,0.12)] flex items-center justify-center text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] font-bold text-xl border-2 border-[var(--color-border)]">
                        {profile.firstName?.[0] || "C"}{profile.lastName?.[0] || ""}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPhotoEditor(true)}
                      className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit profile photo"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
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
                    <p className="text-xs text-[var(--color-text-3)]">Crop, zoom &amp; rotate</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="label">First Name</label>
                    <input
                      id="firstName"
                      type="text"
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="label">Last Name</label>
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
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="input bg-[var(--color-surface-2)] text-[var(--color-text-2)] cursor-not-allowed"
                  />
                  <p className="text-xs text-[var(--color-text-3)] mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label htmlFor="bio" className="label">Bio</label>
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
                  <label htmlFor="organization" className="label">Organization</label>
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
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
                {saved && (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
                {!saved && <div />}
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>

            {/* Password Section */}
            <form onSubmit={handleChangePassword} className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Change Password</h2>
              {pwMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    pwMessage.type === "error"
                      ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                      : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                  }`}
                  role="alert"
                >
                  {pwMessage.text}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="label">Current Password</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                    }
                    className="input"
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="label">New Password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                    className="input"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="label">Confirm New Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                    className="input"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--color-border)] flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving || !passwordForm.currentPassword || !passwordForm.newPassword}
                  className="btn-primary"
                >
                  {pwSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === "billing" && subscription && (
          <div className="animate-spring-up space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Current Plan</h2>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${planColors[subscription.plan] || planColors.FREE}`}>
                    {subscription.plan}
                  </span>
                  <span className="text-sm text-[var(--color-text-2)]">Active</span>
                </div>
              </div>

              {/* Athlete usage */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--color-text-2)]">Athletes</span>
                  <span className="text-[var(--color-text)] font-medium">
                    {subscription.athleteCount} / {PLAN_LIMITS[subscription.plan] === Infinity ? "Unlimited" : PLAN_LIMITS[subscription.plan]}
                  </span>
                </div>
                {PLAN_LIMITS[subscription.plan] !== Infinity && (
                  <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (subscription.athleteCount / (PLAN_LIMITS[subscription.plan] || 1)) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--color-border)]">
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
                    {portalLoading ? "Loading..." : "Manage Subscription"}
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
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Plan Features</h2>
              {subscription.plan === "FREE" && (
                <ul className="space-y-2 text-sm text-[var(--color-text-2)]">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Up to 3 athletes
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Session logging &amp; throw tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Readiness check-ins
                  </li>
                </ul>
              )}
              {subscription.plan === "PRO" && (
                <ul className="space-y-2 text-sm text-[var(--color-text-2)]">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Up to 25 athletes
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Program builder
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ACWR analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Athlete progress exports
                  </li>
                </ul>
              )}
              {subscription.plan === "ELITE" && (
                <ul className="space-y-2 text-sm text-[var(--color-text-2)]">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Unlimited athletes
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Everything in Pro
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Video annotation (coming soon)
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Priority support
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === "invitations" && (
          <div className="animate-spring-up space-y-6">
            <form onSubmit={handleSendInvite} className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Invite an Athlete</h2>
              <p className="text-sm text-[var(--color-text-2)] mb-4">
                Send an invitation link to an athlete. They&apos;ll be automatically linked to your account when they register.
              </p>
              {inviteMessage && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    inviteMessage.type === "error"
                      ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                      : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                  }`}
                >
                  {inviteMessage.text}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="inviteEmail" className="label">Athlete Email</label>
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
                    <label htmlFor="inviteSport" className="label">Event (optional)</label>
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
                    <label htmlFor="invitePosition" className="label">Classification (optional)</label>
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
                  {inviteSending ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>

            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Sent Invitations</h2>
              {invitations.length === 0 ? (
                <p className="text-sm text-[var(--color-text-2)]">No invitations sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-[var(--color-surface-2)] gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{inv.email}</p>
                        <p className="text-xs text-[var(--color-text-2)]">
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
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : inv.status === "ACCEPTED"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
                          }`}
                        >
                          {inv.status === "PENDING" && new Date(inv.expiresAt) < new Date()
                            ? "Expired"
                            : inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                        </span>
                        {inv.status === "PENDING" && new Date(inv.expiresAt) >= new Date() && (
                          <button
                            onClick={() => copyInviteLink(inv)}
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                          >
                            {copiedId === inv.id ? "Copied!" : "Copy Link"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="animate-spring-up">
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Recent Activity</h2>
              {activities.length === 0 ? (
                <p className="text-sm text-[var(--color-text-2)]">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-surface-2)]"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          {ACTION_LABELS[act.action] || act.action}
                        </p>
                        {act.details && (
                          <p className="text-xs text-[var(--color-text-2)] truncate">{act.details}</p>
                        )}
                      </div>
                      <span className="text-xs text-[var(--color-text-3)] shrink-0">
                        {formatRelativeTime(act.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === "preferences" && (
          <div className="animate-spring-up space-y-6">
            {/* Global Default Page */}
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">Default Landing Page</h2>
              <p className="text-sm text-[var(--color-text-2)] mb-5">
                Choose which page opens when you first launch the app.
              </p>
              <div className="space-y-2">
                {[
                  { href: "/coach", label: "Coach Dashboard", desc: "General overview and metrics" },
                  { href: "/coach/throws", label: "Throws Roster", desc: "Throws roster pulse view" },
                  { href: "/coach/athletes", label: "Athletes", desc: "Your full roster" },
                  { href: "/coach/calendar", label: "Calendar", desc: "Scheduled sessions" },
                ].map((page) => (
                  <label
                    key={page.href}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                      preferences.globalDefaultPage === page.href
                        ? "bg-[rgba(212,168,67,0.08)] border border-[var(--color-gold)]/30"
                        : "border border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="globalDefault"
                      value={page.href}
                      checked={preferences.globalDefaultPage === page.href}
                      onChange={() => handleSavePreferences({ globalDefaultPage: page.href })}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{page.label}</p>
                      <p className="text-xs text-[var(--color-text-3)]">{page.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Per-Workspace Defaults */}
            <div className="card">
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-1">Quick Links</h2>
              <p className="text-sm text-[var(--color-text-2)] mb-5">
                Choose the default page when switching to the throws workspace.
              </p>
              <div className="space-y-6">
                {enabledModules.includes("throws") && (
                  <div>
                    <p className="label mb-3">Podium Throws</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { href: "/coach/throws", label: "Throws Roster" },
                        { href: "/coach/throws/builder", label: "Session Builder" },
                        { href: "/coach/throws/practice", label: "Practice" },
                        { href: "/coach/throws/analyze", label: "Analysis" },
                      ].map((page) => (
                        <label
                          key={page.href}
                          className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-colors ${
                            (preferences.workspaceDefaults?.throws ?? "/coach/throws") === page.href
                              ? "bg-[rgba(212,168,67,0.08)] border border-[var(--color-gold)]/30"
                              : "border border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="throwsDefault"
                            value={page.href}
                            checked={(preferences.workspaceDefaults?.throws ?? "/coach/throws") === page.href}
                            onChange={() =>
                              handleSavePreferences({
                                workspaceDefaults: { throws: page.href },
                              })
                            }
                          />
                          <span className="text-sm font-medium text-[var(--color-text)]">{page.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {prefSaving && (
              <div className="text-xs text-[var(--color-text-3)] flex items-center gap-1.5">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </div>
            )}
          </div>
        )}

        {/* Accessibility Section — always visible */}
        <div className="card mt-6 mb-24 lg:mb-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Accessibility</h2>
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
                        ? "bg-[rgba(212,168,67,0.12)] text-[var(--color-text)]"
                        : "bg-[var(--color-bg-subtle)] text-[var(--color-text-2)]"
                    }`}
                  >
                    {size === "default" ? "Default" : size === "large" ? "Large" : "XL"}
                  </button>
                ))}
              </div>
            </div>

            {/* Reduced Motion */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="label mb-0">Reduce animations</label>
                  <p className="text-sm text-[var(--color-text-2)] mt-0.5">
                    Minimizes motion for users who are sensitive to animations
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reducedMotion}
                  onClick={() => setReducedMotion(!reducedMotion)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                    reducedMotion ? "bg-amber-500" : "bg-[var(--color-border-strong)]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform mt-0.5 ${
                      reducedMotion ? "translate-x-5 ml-0.5" : "translate-x-0 ml-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
