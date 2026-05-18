"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Link2,
  Calendar,
  Trash2,
  Pencil,
  Loader2,
  File,
  FileText,
  FileSpreadsheet,
  Download,
  ChevronUp,
  ChevronDown,
  Megaphone,
  Pin,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaggeredList } from "@/components/ui/StaggeredList";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";
import { useToast } from "@/components/ui/Toast";
import { parseApiError } from "@/lib/form-errors";
import { csrfHeaders } from "@/lib/csrf-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  priority: string;
  pinned: boolean;
  targetType: string;
  targetId: string | null;
  expiresAt: string | null;
  createdAt: string;
  authorName: string;
};

type LinkItem = {
  id: string;
  title: string;
  url: string;
  category: string | null;
  icon: string | null;
  order: number;
};

type FileItem = {
  id: string;
  name: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  category: string | null;
  createdAt: string;
};

type UpcomingItem = {
  type: "practice" | "competition";
  id: string;
  title: string;
  date: string;
  time: string | null;
  meta: string;
};

export type Props = {
  mode: "coach" | "athlete";
  data: {
    announcements: AnnouncementItem[];
    links: LinkItem[];
    files: FileItem[];
    upcoming: UpcomingItem[];
    eventGroups: Array<{ id: string; name: string }>;
    athletes: Array<{
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    }>;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv")
  )
    return "📊";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  return "📁";
}

function validateUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function parseDateLocal(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-muted">
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── Announcement Card ────────────────────────────────────────────────────────

function AnnouncementCard({
  item,
  pinned,
  isCoach,
  onEdit,
  onDelete,
}: {
  item: AnnouncementItem;
  pinned: boolean;
  isCoach: boolean;
  onEdit: (item: AnnouncementItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`card p-4 relative group ${pinned ? "border-l-4 border-primary-500" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {pinned && (
              <Pin
                size={12}
                strokeWidth={1.75}
                aria-hidden="true"
                className="text-primary-500 shrink-0"
              />
            )}
            <h3 className="font-heading text-base font-semibold text-[var(--foreground)] leading-tight">
              {item.title}
            </h3>
            {item.priority === "URGENT" && <Badge variant="danger">Urgent</Badge>}
            {item.targetType === "GROUP" && <Badge variant="info">Group</Badge>}
            {item.targetType === "INDIVIDUAL" && <Badge variant="neutral">Individual</Badge>}
          </div>
          <p className="text-sm text-[var(--foreground)]/80 leading-relaxed whitespace-pre-wrap">
            {item.body}
          </p>
          <p className="text-xs text-muted mt-2">
            {item.authorName} · {formatRelative(item.createdAt)}
            {item.expiresAt && (
              <span className="ml-2 text-warning-500">
                · Expires{" "}
                {new Date(item.expiresAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </p>
        </div>

        {isCoach && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label={`Edit announcement: ${item.title}`}
            >
              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-lg text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors"
              aria-label={`Delete announcement: ${item.title}`}
            >
              <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upcoming Item ────────────────────────────────────────────────────────────

function UpcomingCard({ item }: { item: UpcomingItem }) {
  const d = parseDateLocal(item.date);
  const dayAbbr = DAY_ABBR[d.getDay()];
  const monthAbbr = MONTH_ABBR[d.getMonth()];
  const dayNum = d.getDate();
  const today = isToday(item.date);

  return (
    <div className="card p-4 flex gap-4 items-start">
      {/* Date pill */}
      <div
        className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 shrink-0 min-w-[52px] ${
          today
            ? "bg-primary-500/15 border border-primary-500/30"
            : "bg-surface-100 dark:bg-surface-800"
        }`}
      >
        <span
          className={`text-nano font-bold uppercase tracking-wider ${
            today ? "text-primary-500" : "text-muted"
          }`}
        >
          {dayAbbr}
        </span>
        <span
          className={`font-mono text-xl font-bold leading-none tabular-nums ${
            today ? "text-primary-500" : "text-[var(--foreground)]"
          }`}
        >
          {dayNum}
        </span>
        <span
          className={`text-nano uppercase tracking-wider ${
            today ? "text-primary-500" : "text-muted"
          }`}
        >
          {monthAbbr}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={item.type === "competition" ? "warning" : "info"}>
            {item.type === "competition" ? "Competition" : "Practice"}
          </Badge>
          {today && (
            <Badge variant="success" dot>
              Today
            </Badge>
          )}
        </div>
        <h3 className="font-heading text-base font-semibold text-[var(--foreground)] leading-tight">
          {item.title}
        </h3>
        {item.meta && <p className="text-sm text-muted truncate">{item.meta}</p>}
        {item.time && (
          <p className="text-xs text-muted font-mono tabular-nums">{formatTime12(item.time)}</p>
        )}
      </div>
    </div>
  );
}

// ─── File Row ─────────────────────────────────────────────────────────────────

function FileRow({
  file,
  isCoach,
  onDelete,
}: {
  file: FileItem;
  isCoach: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card p-3 flex items-center gap-3 group">
      <span className="text-xl shrink-0" aria-hidden="true">
        {fileIcon(file.mimeType)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">{file.name}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-xs text-muted font-mono tabular-nums">
            {formatFileSize(file.fileSize)}
          </span>
          {file.category && <Badge variant="neutral">{file.category}</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={file.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={`Download ${file.name}`}
        >
          <Download size={15} strokeWidth={1.75} aria-hidden="true" />
        </a>
        {isCoach && (
          <button
            type="button"
            onClick={() => onDelete(file.id)}
            className="p-2 rounded-lg text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={`Delete ${file.name}`}
          >
            <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Link Pill ────────────────────────────────────────────────────────────────

function LinkPill({
  link,
  isCoach,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  showUp,
  showDown,
}: {
  link: LinkItem;
  isCoach: boolean;
  onEdit: (link: LinkItem) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  showUp: boolean;
  showDown: boolean;
}) {
  return (
    <div className="group relative flex flex-col items-center gap-1">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-primary-500/10 dark:hover:bg-primary-500/15 border border-[var(--card-border)] hover:border-primary-500/30 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 whitespace-nowrap min-h-[44px]"
      >
        {link.icon ? (
          <span className="text-base" aria-hidden="true">
            {link.icon}
          </span>
        ) : (
          <Link2 size={14} strokeWidth={1.75} aria-hidden="true" className="text-muted shrink-0" />
        )}
        {link.title}
      </a>
      {link.category && <span className="text-nano text-muted">{link.category}</span>}
      {isCoach && (
        <div className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-0.5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full px-1 py-0.5 shadow-sm z-10">
          {showUp && (
            <button
              type="button"
              onClick={() => onMoveUp(link.id)}
              className="p-1 rounded-full text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label={`Move ${link.title} left`}
            >
              <ChevronUp size={11} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          {showDown && (
            <button
              type="button"
              onClick={() => onMoveDown(link.id)}
              className="p-1 rounded-full text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label={`Move ${link.title} right`}
            >
              <ChevronDown size={11} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(link)}
            className="p-1 rounded-full text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label={`Edit ${link.title}`}
          >
            <Pencil size={11} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(link.id)}
            className="p-1 rounded-full text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors"
            aria-label={`Delete ${link.title}`}
          >
            <X size={11} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Announcement Form ────────────────────────────────────────────────────────

function AnnouncementForm({
  initial,
  eventGroups,
  athletes,
  onSave,
  onCancel,
  saving,
}: {
  initial?: AnnouncementItem;
  eventGroups: Array<{ id: string; name: string }>;
  athletes: Array<{ id: string; firstName: string; lastName: string }>;
  onSave: (data: {
    title: string;
    body: string;
    priority: string;
    pinned: boolean;
    targetType: string;
    targetId: string | null;
    expiresAt: string | null;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "NORMAL");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [targetType, setTargetType] = useState(initial?.targetType ?? "ALL");
  const [targetId, setTargetId] = useState<string>(initial?.targetId ?? "");
  const [expiresAt, setExpiresAt] = useState(
    initial?.expiresAt ? new Date(initial.expiresAt).toISOString().split("T")[0] : ""
  );

  const canSave = title.trim().length > 0 && body.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      body: body.trim(),
      priority,
      pinned,
      targetType,
      targetId: targetType !== "ALL" && targetId ? targetId : null,
      expiresAt: expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null,
    });
  }

  return (
    <div className="space-y-4">
      <Input
        label="Title"
        placeholder="e.g. Practice moved to Ring 2"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <div>
        <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What do you want your athletes to know?"
          rows={4}
          maxLength={2000}
          className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none placeholder:text-muted"
        />
        <p className="text-xs text-muted mt-1 text-right">{body.length}/2000</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Target
          </label>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setTargetId("");
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="ALL">All Athletes</option>
            <option value="GROUP">Group</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </div>
      </div>

      {targetType === "GROUP" && (
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Group
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">Select a group…</option>
            {eventGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {targetType === "INDIVIDUAL" && (
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Athlete
          </label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            <option value="">Select an athlete…</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
            Expires (optional)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] text-sm focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
        </div>

        <div className="flex flex-col justify-end">
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <span className="text-sm text-[var(--foreground)]">Pin to top</span>
            <button
              type="button"
              role="switch"
              aria-checked={pinned}
              onClick={() => setPinned(!pinned)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus:ring-2 focus:ring-primary-500/50 ${
                pinned ? "bg-primary-500" : "bg-surface-300 dark:bg-surface-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  pinned ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? (
            <>
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : initial ? (
            "Save Changes"
          ) : (
            "Post Announcement"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Link Form ────────────────────────────────────────────────────────────────

function LinkForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: LinkItem;
  onSave: (data: { title: string; url: string; icon: string; category: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [urlError, setUrlError] = useState("");

  const canSave = title.trim().length > 0 && url.trim().length > 0 && !urlError;

  function handleUrlBlur() {
    if (url && !validateUrl(url)) {
      setUrlError("Please enter a valid URL (include https://)");
    } else {
      setUrlError("");
    }
  }

  function handleSave() {
    if (!canSave) return;
    if (!validateUrl(url)) {
      setUrlError("Please enter a valid URL (include https://)");
      return;
    }
    onSave({
      title: title.trim(),
      url: url.trim(),
      icon: icon.trim(),
      category: category.trim(),
    });
  }

  return (
    <div className="space-y-4">
      <Input
        label="Title"
        placeholder="e.g. Team Calendar"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <div>
        <Input
          label="URL"
          placeholder="https://..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError("");
          }}
          onBlur={handleUrlBlur}
        />
        {urlError && <p className="text-xs text-danger-500 mt-1">{urlError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Icon (emoji)"
          placeholder="e.g. 📅"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
        />
        <Input
          label="Category (optional)"
          placeholder="e.g. Scheduling"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? (
            <>
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : initial ? (
            "Save Changes"
          ) : (
            "Add Link"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── File Upload Form ─────────────────────────────────────────────────────────

function FileUploadForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { success, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "url" | "upload" | "register">(
    "idle"
  );

  const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE) {
      showError("File too large", "Maximum file size is 25 MB");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);

    try {
      // Step 1: Get presigned URL
      setUploadProgress("url");
      const urlRes = await fetch("/api/coach/team-files/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({
          name: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
        }),
      });

      const urlPayload = await urlRes.json();
      if (!urlRes.ok || !urlPayload.success) {
        throw new Error(urlPayload.error || "Failed to get upload URL");
      }

      // API returns { success: true, data: { uploadUrl, publicUrl, fileKey } }
      const uploadUrl: string | undefined = urlPayload.data?.uploadUrl;
      const fileKey: string | undefined = urlPayload.data?.fileKey;
      const fileUrl: string | undefined = urlPayload.data?.publicUrl;

      if (!uploadUrl || !fileKey || !fileUrl) {
        throw new Error("Invalid upload URL response");
      }

      // Step 2: Upload to R2
      setUploadProgress("upload");
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload to storage failed (${uploadRes.status})`);
      }

      // Step 3: Register in DB
      setUploadProgress("register");
      const registerRes = await fetch("/api/coach/team-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({
          name: selectedFile.name,
          fileKey,
          fileUrl,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          category: category.trim() || null,
        }),
      });

      if (!registerRes.ok) {
        const json = await registerRes.json();
        throw new Error(json.error || "Failed to register file");
      }

      success("File Uploaded", selectedFile.name);
      onDone();
    } catch (err) {
      const info = parseApiError({ err });
      showError("Upload Failed", info.message);
    } finally {
      setUploading(false);
      setUploadProgress("idle");
    }
  }

  const progressLabel =
    uploadProgress === "url"
      ? "Preparing upload…"
      : uploadProgress === "upload"
        ? "Uploading file…"
        : uploadProgress === "register"
          ? "Finalizing…"
          : "";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-1.5">
          File
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-[var(--card-border)] hover:border-primary-500/50 rounded-xl p-6 text-center transition-colors"
        >
          {selectedFile ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl" aria-hidden="true">
                {fileIcon(selectedFile.type)}
              </span>
              <div className="text-left">
                <p className="text-sm font-medium text-[var(--foreground)]">{selectedFile.name}</p>
                <p className="text-xs text-muted">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          ) : (
            <div>
              <File
                size={32}
                strokeWidth={1.75}
                className="mx-auto text-muted mb-2"
                aria-hidden="true"
              />
              <p className="text-sm text-muted">Click to select a file (max 25 MB)</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="sr-only"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.mp4,.mov"
          aria-label="Select file to upload"
        />
      </div>

      <Input
        label="Category (optional)"
        placeholder="e.g. Meet Schedule, Training Plans"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />

      {uploading && progressLabel && (
        <div className="flex items-center gap-2 text-sm text-muted py-1">
          <Loader2
            size={14}
            strokeWidth={1.75}
            className="animate-spin text-primary-500"
            aria-hidden="true"
          />
          {progressLabel}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={uploading}>
          Cancel
        </Button>
        <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
          {uploading ? (
            <>
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
              Uploading…
            </>
          ) : (
            "Upload File"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Manage Drawer Tabs ────────────────────────────────────────────────────────

type ManageTab = "announcements" | "links" | "files";

function ManageDrawer({
  data,
  onClose,
  onMutated,
}: {
  data: Props["data"];
  onClose: () => void;
  onMutated: () => void;
}) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<ManageTab>("announcements");
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tabs: { key: ManageTab; label: string }[] = [
    { key: "announcements", label: "Announcements" },
    { key: "links", label: "Links" },
    { key: "files", label: "Files" },
  ];

  async function saveAnnouncement(formData: {
    title: string;
    body: string;
    priority: string;
    pinned: boolean;
    targetType: string;
    targetId: string | null;
    expiresAt: string | null;
  }) {
    setSavingAnnouncement(true);
    try {
      const isEdit = !!editingAnnouncement;
      const url = isEdit
        ? `/api/coach/announcements/${editingAnnouncement.id}`
        : "/api/coach/announcements";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save");
      }

      success(isEdit ? "Announcement Updated" : "Announcement Posted", formData.title);
      setShowAnnouncementForm(false);
      setEditingAnnouncement(null);
      router.refresh();
      onMutated();
    } catch (err) {
      showError("Error", err instanceof Error ? err.message : "Failed to save announcement");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm("Delete this announcement?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/coach/announcements/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      success("Deleted", "Announcement removed");
      router.refresh();
      onMutated();
    } catch {
      showError("Error", "Failed to delete announcement");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveLink(formData: {
    title: string;
    url: string;
    icon: string;
    category: string;
  }) {
    setSavingLink(true);
    try {
      const isEdit = !!editingLink;
      const url = isEdit ? `/api/coach/team-links/${editingLink.id}` : "/api/coach/team-links";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({
          title: formData.title,
          url: formData.url,
          icon: formData.icon || null,
          category: formData.category || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save link");
      }

      success(isEdit ? "Link Updated" : "Link Added", formData.title);
      setShowLinkForm(false);
      setEditingLink(null);
      router.refresh();
      onMutated();
    } catch (err) {
      showError("Error", err instanceof Error ? err.message : "Failed to save link");
    } finally {
      setSavingLink(false);
    }
  }

  async function deleteLink(id: string) {
    if (!confirm("Delete this link?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/coach/team-links/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      success("Deleted", "Link removed");
      router.refresh();
      onMutated();
    } catch {
      showError("Error", "Failed to delete link");
    } finally {
      setDeletingId(null);
    }
  }

  async function reorderLink(id: string, direction: "up" | "down") {
    const links = [...data.links].sort((a, b) => a.order - b.order);
    const idx = links.findIndex((l) => l.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === links.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newOrder = [...links];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    try {
      const res = await fetch("/api/coach/team-links/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({ ids: newOrder.map((l) => l.id) }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      router.refresh();
      onMutated();
    } catch {
      showError("Error", "Failed to reorder links");
    }
  }

  async function deleteFile(id: string) {
    if (!confirm("Delete this file?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/coach/team-files/${id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      success("Deleted", "File removed");
      router.refresh();
      onMutated();
    } catch {
      showError("Error", "Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Manage Team Hub"
      description="Create and manage announcements, links, and files for your team."
      size="xl"
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--card-border)] -mx-6 px-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setShowAnnouncementForm(false);
              setEditingAnnouncement(null);
              setShowLinkForm(false);
              setEditingLink(null);
              setShowUploadForm(false);
            }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? "border-primary-500 text-primary-500"
                : "border-transparent text-muted hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Announcements */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          {showAnnouncementForm || editingAnnouncement ? (
            <AnnouncementForm
              initial={editingAnnouncement ?? undefined}
              eventGroups={data.eventGroups}
              athletes={data.athletes}
              onSave={saveAnnouncement}
              onCancel={() => {
                setShowAnnouncementForm(false);
                setEditingAnnouncement(null);
              }}
              saving={savingAnnouncement}
            />
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAnnouncementForm(true)}
                className="w-full"
              >
                <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                New Announcement
              </Button>
              {data.announcements.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Megaphone size={28} strokeWidth={1.75} aria-hidden="true" />}
                  title="No announcements yet"
                  description="Post updates for your athletes here."
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {data.announcements.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-[var(--card-border)]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {a.pinned && (
                            <Pin
                              size={11}
                              strokeWidth={1.75}
                              className="text-primary-500 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">
                            {a.title}
                          </p>
                          {a.priority === "URGENT" && <Badge variant="danger">Urgent</Badge>}
                        </div>
                        <p className="text-xs text-muted mt-0.5">{formatRelative(a.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingAnnouncement(a)}
                          disabled={deletingId === a.id}
                          className="p-1.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label={`Edit ${a.title}`}
                        >
                          <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAnnouncement(a.id)}
                          disabled={deletingId === a.id}
                          className="p-1.5 rounded-lg text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label={`Delete ${a.title}`}
                        >
                          {deletingId === a.id ? (
                            <Loader2
                              size={13}
                              strokeWidth={1.75}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Links */}
      {activeTab === "links" && (
        <div className="space-y-4">
          {showLinkForm || editingLink ? (
            <LinkForm
              initial={editingLink ?? undefined}
              onSave={saveLink}
              onCancel={() => {
                setShowLinkForm(false);
                setEditingLink(null);
              }}
              saving={savingLink}
            />
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowLinkForm(true)} className="w-full">
                <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                Add Link
              </Button>
              {data.links.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Link2 size={28} strokeWidth={1.75} aria-hidden="true" />}
                  title="No links yet"
                  description="Add quick-access links for your team."
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {[...data.links]
                    .sort((a, b) => a.order - b.order)
                    .map((l, idx, arr) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-[var(--card-border)]"
                      >
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => reorderLink(l.id, "up")}
                            disabled={idx === 0}
                            className="p-0.5 rounded text-muted hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Move ${l.title} up`}
                          >
                            <ChevronUp size={13} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderLink(l.id, "down")}
                            disabled={idx === arr.length - 1}
                            className="p-0.5 rounded text-muted hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Move ${l.title} down`}
                          >
                            <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">
                            {l.icon && <span className="mr-1.5">{l.icon}</span>}
                            {l.title}
                          </p>
                          <p className="text-xs text-muted truncate">{l.url}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingLink(l)}
                            disabled={deletingId === l.id}
                            className="p-1.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            aria-label={`Edit ${l.title}`}
                          >
                            <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLink(l.id)}
                            disabled={deletingId === l.id}
                            className="p-1.5 rounded-lg text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                            aria-label={`Delete ${l.title}`}
                          >
                            {deletingId === l.id ? (
                              <Loader2
                                size={13}
                                strokeWidth={1.75}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Files */}
      {activeTab === "files" && (
        <div className="space-y-4">
          {showUploadForm ? (
            <FileUploadForm
              onDone={() => {
                setShowUploadForm(false);
                router.refresh();
                onMutated();
              }}
              onCancel={() => setShowUploadForm(false)}
            />
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowUploadForm(true)} className="w-full">
                <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                Upload File
              </Button>
              {data.files.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FileText size={28} strokeWidth={1.75} aria-hidden="true" />}
                  title="No files yet"
                  description="Upload schedules, training plans, and other documents."
                />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {data.files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-900/50 border border-[var(--card-border)]"
                    >
                      <span className="text-xl shrink-0" aria-hidden="true">
                        {fileIcon(f.mimeType)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {f.name}
                        </p>
                        <p className="text-xs text-muted font-mono tabular-nums">
                          {formatFileSize(f.fileSize)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label={`Download ${f.name}`}
                        >
                          <Download size={13} strokeWidth={1.75} aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteFile(f.id)}
                          disabled={deletingId === f.id}
                          className="p-1.5 rounded-lg text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label={`Delete ${f.name}`}
                        >
                          {deletingId === f.id ? (
                            <Loader2
                              size={13}
                              strokeWidth={1.75}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamHubClient({ mode, data }: Props) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const isCoach = mode === "coach";

  const [showManage, setShowManage] = useState(false);

  // Inline quick-add states (outside the drawer, for "+" buttons in sections)
  const [showInlineAnnouncement, setShowInlineAnnouncement] = useState(false);
  const [showInlineLink, setShowInlineLink] = useState(false);
  const [showInlineUpload, setShowInlineUpload] = useState(false);

  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [, setDeletingId] = useState<string | null>(null);

  const pinnedAnnouncements = data.announcements.filter((a) => a.pinned);
  const recentAnnouncements = data.announcements.filter((a) => !a.pinned);
  const sortedLinks = [...data.links].sort((a, b) => a.order - b.order);

  // ── Announcement mutations ──────────────────────────────────────────────────
  const saveAnnouncement = useCallback(
    async (
      formData: {
        title: string;
        body: string;
        priority: string;
        pinned: boolean;
        targetType: string;
        targetId: string | null;
        expiresAt: string | null;
      },
      editId?: string
    ) => {
      setSavingAnnouncement(true);
      try {
        const url = editId ? `/api/coach/announcements/${editId}` : "/api/coach/announcements";
        const method = editId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...csrfHeaders(),
          },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to save");
        }
        success(editId ? "Announcement Updated" : "Announcement Posted", formData.title);
        setShowInlineAnnouncement(false);
        setEditingAnnouncement(null);
        router.refresh();
      } catch (err) {
        showError("Error", err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSavingAnnouncement(false);
      }
    },
    [router, success, showError]
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      if (!confirm("Delete this announcement?")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/coach/announcements/${id}`, {
          method: "DELETE",
          headers: csrfHeaders(),
        });
        if (!res.ok) throw new Error("Failed to delete");
        success("Deleted", "Announcement removed");
        router.refresh();
      } catch {
        showError("Error", "Failed to delete announcement");
      } finally {
        setDeletingId(null);
      }
    },
    [router, success, showError]
  );

  // ── Link mutations ──────────────────────────────────────────────────────────
  const saveLink = useCallback(
    async (
      formData: { title: string; url: string; icon: string; category: string },
      editId?: string
    ) => {
      setSavingLink(true);
      try {
        const url = editId ? `/api/coach/team-links/${editId}` : "/api/coach/team-links";
        const method = editId ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...csrfHeaders(),
          },
          body: JSON.stringify({
            title: formData.title,
            url: formData.url,
            icon: formData.icon || null,
            category: formData.category || null,
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to save link");
        }
        success(editId ? "Link Updated" : "Link Added", formData.title);
        setShowInlineLink(false);
        setEditingLink(null);
        router.refresh();
      } catch (err) {
        showError("Error", err instanceof Error ? err.message : "Failed to save link");
      } finally {
        setSavingLink(false);
      }
    },
    [router, success, showError]
  );

  const deleteLink = useCallback(
    async (id: string) => {
      if (!confirm("Delete this link?")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/coach/team-links/${id}`, {
          method: "DELETE",
          headers: csrfHeaders(),
        });
        if (!res.ok) throw new Error("Failed to delete");
        success("Deleted", "Link removed");
        router.refresh();
      } catch {
        showError("Error", "Failed to delete link");
      } finally {
        setDeletingId(null);
      }
    },
    [router, success, showError]
  );

  const reorderLink = useCallback(
    async (id: string, direction: "up" | "down") => {
      const links = [...sortedLinks];
      const idx = links.findIndex((l) => l.id === id);
      if (direction === "up" && idx === 0) return;
      if (direction === "down" && idx === links.length - 1) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [links[idx], links[swapIdx]] = [links[swapIdx], links[idx]];
      try {
        const res = await fetch("/api/coach/team-links/reorder", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...csrfHeaders(),
          },
          body: JSON.stringify({ ids: links.map((l) => l.id) }),
        });
        if (!res.ok) throw new Error("Failed to reorder");
        router.refresh();
      } catch {
        showError("Error", "Failed to reorder links");
      }
    },
    [sortedLinks, router, showError]
  );

  const deleteFile = useCallback(
    async (id: string) => {
      if (!confirm("Delete this file?")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/coach/team-files/${id}`, {
          method: "DELETE",
          headers: csrfHeaders(),
        });
        if (!res.ok) throw new Error("Failed to delete");
        success("Deleted", "File removed");
        router.refresh();
      } catch {
        showError("Error", "Failed to delete file");
      } finally {
        setDeletingId(null);
      }
    },
    [router, success, showError]
  );

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <ScrollProgressBar />

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--foreground)]">Team Hub</h1>
          <p className="text-sm text-muted mt-1">
            {isCoach
              ? "Announcements, quick links, and files for your team"
              : "Team announcements, links, and resources from your coach"}
          </p>
        </div>
        {isCoach && (
          <Button variant="outline" onClick={() => setShowManage(true)} className="shrink-0">
            <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
            Manage
          </Button>
        )}
      </div>

      {/* ── Section 1: Pinned Announcements ────────────────────────────────── */}
      {(pinnedAnnouncements.length > 0 || (isCoach && showInlineAnnouncement)) && (
        <section>
          <SectionHeader
            title="Pinned"
            count={pinnedAnnouncements.length}
            action={
              isCoach && !showInlineAnnouncement ? (
                <button
                  type="button"
                  onClick={() => setShowInlineAnnouncement(true)}
                  className="p-1.5 rounded-lg text-muted hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                  aria-label="Post new announcement"
                >
                  <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : null
            }
          />
          {showInlineAnnouncement && isCoach && (
            <div className="card p-4 mb-3">
              <AnnouncementForm
                eventGroups={data.eventGroups}
                athletes={data.athletes}
                onSave={(fd) => saveAnnouncement(fd)}
                onCancel={() => setShowInlineAnnouncement(false)}
                saving={savingAnnouncement}
              />
            </div>
          )}
          {editingAnnouncement && isCoach && (
            <div className="card p-4 mb-3">
              <AnnouncementForm
                initial={editingAnnouncement}
                eventGroups={data.eventGroups}
                athletes={data.athletes}
                onSave={(fd) => saveAnnouncement(fd, editingAnnouncement.id)}
                onCancel={() => setEditingAnnouncement(null)}
                saving={savingAnnouncement}
              />
            </div>
          )}
          <StaggeredList className="space-y-3">
            {pinnedAnnouncements.map((a) => (
              <AnnouncementCard
                key={a.id}
                item={a}
                pinned
                isCoach={isCoach}
                onEdit={setEditingAnnouncement}
                onDelete={deleteAnnouncement}
              />
            ))}
          </StaggeredList>
        </section>
      )}

      {/* ── Section 2: Quick Links ─────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Quick Links"
          count={sortedLinks.length}
          action={
            isCoach && !showInlineLink ? (
              <button
                type="button"
                onClick={() => setShowInlineLink(true)}
                className="p-1.5 rounded-lg text-muted hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                aria-label="Add quick link"
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null
          }
        />

        {showInlineLink && isCoach && (
          <div className="card p-4 mb-3">
            <LinkForm
              onSave={(fd) => saveLink(fd)}
              onCancel={() => setShowInlineLink(false)}
              saving={savingLink}
            />
          </div>
        )}

        {editingLink && isCoach && (
          <div className="card p-4 mb-3">
            <LinkForm
              initial={editingLink}
              onSave={(fd) => saveLink(fd, editingLink.id)}
              onCancel={() => setEditingLink(null)}
              saving={savingLink}
            />
          </div>
        )}

        {sortedLinks.length === 0 && !showInlineLink ? (
          <EmptyState
            compact
            icon={<Link2 size={28} strokeWidth={1.75} aria-hidden="true" />}
            title="No quick links yet"
            description={
              isCoach
                ? "Add links to schedules, forms, and resources."
                : "Your coach hasn't added any links yet."
            }
            action={
              isCoach ? (
                <Button variant="outline" onClick={() => setShowInlineLink(true)}>
                  <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                  Add Link
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {sortedLinks.slice(0, 12).map((link, idx) => (
              <LinkPill
                key={link.id}
                link={link}
                isCoach={isCoach}
                onEdit={setEditingLink}
                onDelete={deleteLink}
                onMoveUp={(id) => reorderLink(id, "up")}
                onMoveDown={(id) => reorderLink(id, "down")}
                showUp={idx > 0}
                showDown={idx < sortedLinks.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Coming Up ───────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Coming Up" count={data.upcoming.length} />
        {data.upcoming.length === 0 ? (
          <EmptyState
            compact
            icon={<Calendar size={28} strokeWidth={1.75} aria-hidden="true" />}
            title="Nothing scheduled in the next 30 days"
            description="Practices and competitions will appear here."
          />
        ) : (
          <StaggeredList className="space-y-3">
            {data.upcoming.map((item) => (
              <UpcomingCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </StaggeredList>
        )}
      </section>

      {/* ── Section 4: Team Files ──────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Team Files"
          count={data.files.length}
          action={
            isCoach && !showInlineUpload ? (
              <button
                type="button"
                onClick={() => setShowInlineUpload(true)}
                className="p-1.5 rounded-lg text-muted hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                aria-label="Upload file"
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null
          }
        />

        {showInlineUpload && isCoach && (
          <div className="card p-4 mb-3">
            <FileUploadForm
              onDone={() => {
                setShowInlineUpload(false);
                router.refresh();
              }}
              onCancel={() => setShowInlineUpload(false)}
            />
          </div>
        )}

        {data.files.length === 0 && !showInlineUpload ? (
          <EmptyState
            compact
            icon={<FileSpreadsheet size={28} strokeWidth={1.75} aria-hidden="true" />}
            title="No files shared yet"
            description={
              isCoach
                ? "Upload schedules, training plans, and documents."
                : "Your coach hasn't shared any files yet."
            }
            action={
              isCoach ? (
                <Button variant="outline" onClick={() => setShowInlineUpload(true)}>
                  <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                  Upload File
                </Button>
              ) : undefined
            }
          />
        ) : (
          <StaggeredList className="space-y-2">
            {data.files.map((f) => (
              <FileRow key={f.id} file={f} isCoach={isCoach} onDelete={deleteFile} />
            ))}
          </StaggeredList>
        )}
      </section>

      {/* ── Section 5: Recent Announcements ───────────────────────────────── */}
      <section>
        <SectionHeader
          title="Announcements"
          count={recentAnnouncements.length}
          action={
            isCoach && !showInlineAnnouncement && !editingAnnouncement ? (
              <button
                type="button"
                onClick={() => setShowInlineAnnouncement(true)}
                className="p-1.5 rounded-lg text-muted hover:text-primary-500 hover:bg-primary-500/10 transition-colors"
                aria-label="Post new announcement"
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null
          }
        />
        {recentAnnouncements.length === 0 ? (
          <EmptyState
            compact
            icon={<Megaphone size={28} strokeWidth={1.75} aria-hidden="true" />}
            title="No announcements yet"
            description={
              isCoach
                ? "Post updates and reminders for your athletes."
                : "Your coach hasn't posted any announcements yet."
            }
            action={
              isCoach ? (
                <Button variant="outline" onClick={() => setShowInlineAnnouncement(true)}>
                  <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                  Post Announcement
                </Button>
              ) : undefined
            }
          />
        ) : (
          <StaggeredList className="space-y-3">
            {recentAnnouncements.map((a) => (
              <AnnouncementCard
                key={a.id}
                item={a}
                pinned={false}
                isCoach={isCoach}
                onEdit={setEditingAnnouncement}
                onDelete={deleteAnnouncement}
              />
            ))}
          </StaggeredList>
        )}
      </section>

      {/* ── Manage Drawer ─────────────────────────────────────────────────── */}
      {showManage && isCoach && (
        <ManageDrawer
          data={data}
          onClose={() => setShowManage(false)}
          onMutated={() => {
            /* router.refresh() is called inside each mutation */
          }}
        />
      )}

      {/* ── Inline edit modal for announcements (if triggered from cards) ── */}
      {editingAnnouncement && !showManage && isCoach && (
        <Modal
          open
          onClose={() => setEditingAnnouncement(null)}
          title="Edit Announcement"
          size="lg"
        >
          <AnnouncementForm
            initial={editingAnnouncement}
            eventGroups={data.eventGroups}
            athletes={data.athletes}
            onSave={(fd) => saveAnnouncement(fd, editingAnnouncement.id)}
            onCancel={() => setEditingAnnouncement(null)}
            saving={savingAnnouncement}
          />
        </Modal>
      )}

      {/* ── Inline edit modal for links (if triggered from pills) ────────── */}
      {editingLink && !showManage && isCoach && (
        <Modal open onClose={() => setEditingLink(null)} title="Edit Link" size="md">
          <LinkForm
            initial={editingLink}
            onSave={(fd) => saveLink(fd, editingLink.id)}
            onCancel={() => setEditingLink(null)}
            saving={savingLink}
          />
        </Modal>
      )}
    </div>
  );
}
