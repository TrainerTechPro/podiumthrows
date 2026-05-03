"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

type ThrowType = "HAMMER" | "SHOT" | "DISCUS" | "JAVELIN" | "WEIGHT_THROW";
type Unit = "kg" | "lb";
type Category =
  | "MEN_SENIOR"
  | "WOMEN_SENIOR"
  | "MEN_U20"
  | "WOMEN_U20"
  | "HS_BOYS"
  | "HS_GIRLS"
  | "TRAINING_HEAVY"
  | "TRAINING_LIGHT";

interface CustomImplement {
  id: string;
  throwType: ThrowType;
  weightKg: number;
  weightLb: number;
  primaryUnit: Unit;
  displayLabel: string;
  shortLabel: string;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  categoryTags: { category: Category }[];
}

const THROW_TYPE_LABELS: Record<ThrowType, string> = {
  HAMMER: "Hammer",
  SHOT: "Shot",
  DISCUS: "Discus",
  JAVELIN: "Javelin",
  WEIGHT_THROW: "Weight throw / other",
};

const CATEGORY_LABELS: Record<Category, string> = {
  MEN_SENIOR: "Men senior",
  WOMEN_SENIOR: "Women senior",
  MEN_U20: "Men U20",
  WOMEN_U20: "Women U20",
  HS_BOYS: "HS boys",
  HS_GIRLS: "HS girls",
  TRAINING_HEAVY: "Training heavy",
  TRAINING_LIGHT: "Training light",
};

const ALL_CATEGORIES: Category[] = [
  "MEN_SENIOR",
  "WOMEN_SENIOR",
  "MEN_U20",
  "WOMEN_U20",
  "HS_BOYS",
  "HS_GIRLS",
  "TRAINING_HEAVY",
  "TRAINING_LIGHT",
];

interface FormState {
  throwType: ThrowType;
  weight: string;
  unit: Unit;
  displayLabel: string;
  shortLabel: string;
  notes: string;
  categories: Category[];
}

const EMPTY_FORM: FormState = {
  throwType: "HAMMER",
  weight: "",
  unit: "lb",
  displayLabel: "",
  shortLabel: "",
  notes: "",
  categories: [],
};

export function ImplementsTabContent() {
  const { toast } = useToast();
  const [items, setItems] = useState<CustomImplement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<
    { mode: "create" } | { mode: "edit"; row: CustomImplement } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<CustomImplement | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/coach/implements");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setLoadError(payload.error || `Request failed (${res.status})`);
        return;
      }
      setItems(payload.data as CustomImplement[]);
      setLoadError(null);
    } catch (err) {
      logger.error("ImplementsTab.load", { error: err });
      setLoadError("Network error — please refresh");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const out: Record<ThrowType, CustomImplement[]> = {
      HAMMER: [],
      SHOT: [],
      DISCUS: [],
      JAVELIN: [],
      WEIGHT_THROW: [],
    };
    for (const row of items ?? []) out[row.throwType].push(row);
    return out;
  }, [items]);

  async function handleDelete(row: CustomImplement) {
    try {
      const res = await fetch(`/api/coach/implements/${row.id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders() },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast(payload.error || `Request failed (${res.status})`, "error");
        return;
      }
      toast(`Removed "${row.displayLabel}"`, "success");
      load();
    } catch (err) {
      logger.error("ImplementsTab.delete", { error: err });
      toast("Network error — please try again", "error");
    }
  }

  async function handleRestore(row: CustomImplement) {
    try {
      const res = await fetch(`/api/coach/implements/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ active: true }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast(payload.error || `Request failed (${res.status})`, "error");
        return;
      }
      toast(`Restored "${row.displayLabel}"`, "success");
      load();
    } catch (err) {
      logger.error("ImplementsTab.restore", { error: err });
      toast("Network error — please try again", "error");
    }
  }

  return (
    <div className="max-w-3xl space-y-6 animate-spring-up">
      <header className="space-y-2">
        <h2 className="text-lg font-heading font-semibold text-[var(--foreground)]">
          Custom implements
        </h2>
        <p className="text-sm text-muted">
          Add implements that aren&rsquo;t in the standard catalog — short-wire hammers, weight
          plates, tires, sledgehammers, anything your athletes throw. Customs appear alongside the
          catalog in every athlete&rsquo;s throw-log picker, and PRs are tracked per implement so a
          3/4-wire 18&nbsp;lb doesn&rsquo;t conflate with a full-wire 18&nbsp;lb.
        </p>
      </header>

      <div>
        <Button
          variant="primary"
          onClick={() => setEditor({ mode: "create" })}
          aria-label="Add a custom implement"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>Add custom implement</span>
        </Button>
      </div>

      {loadError && (
        <div className="card p-4 flex items-start gap-3 text-sm text-[var(--foreground)]">
          <AlertTriangle
            size={18}
            strokeWidth={1.75}
            className="text-warning shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Couldn&rsquo;t load custom implements</p>
            <p className="text-muted">{loadError}</p>
          </div>
        </div>
      )}

      {items?.length === 0 && !loadError && (
        <div className="card p-6 text-sm text-muted text-center">
          No custom implements yet. Your athletes are using the standard catalog.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-5">
          {(Object.keys(grouped) as ThrowType[])
            .filter((t) => grouped[t].length > 0)
            .map((throwType) => (
              <section key={throwType} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                  {THROW_TYPE_LABELS[throwType]}
                </h3>
                <ul className="space-y-2">
                  {grouped[throwType].map((row) => (
                    <li
                      key={row.id}
                      className={`card p-3 flex items-center gap-3 ${
                        row.active ? "" : "opacity-60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm tabular-nums text-[var(--foreground)]">
                          {row.displayLabel}
                          {!row.active && (
                            <span className="ml-2 text-xs text-muted font-body">(removed)</span>
                          )}
                        </p>
                        {row.notes && (
                          <p className="text-xs text-muted mt-0.5 truncate">{row.notes}</p>
                        )}
                        {row.categoryTags.length > 0 && (
                          <p className="text-xs text-muted mt-0.5">
                            {row.categoryTags.map((t) => CATEGORY_LABELS[t.category]).join(" · ")}
                          </p>
                        )}
                      </div>
                      {row.active ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditor({ mode: "edit", row })}
                            className="p-2 rounded-md hover:bg-surface-50 dark:hover:bg-surface-800/50 text-muted"
                            aria-label={`Edit ${row.displayLabel}`}
                          >
                            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(row)}
                            className="p-2 rounded-md hover:bg-surface-50 dark:hover:bg-surface-800/50 text-muted hover:text-danger"
                            aria-label={`Remove ${row.displayLabel}`}
                          >
                            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(row)}
                          className="p-2 rounded-md hover:bg-surface-50 dark:hover:bg-surface-800/50 text-muted hover:text-primary-500"
                          aria-label={`Restore ${row.displayLabel}`}
                        >
                          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      {editor && (
        <ImplementEditorModal
          mode={editor.mode}
          initial={editor.mode === "edit" ? editor.row : null}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          open
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            await handleDelete(confirmDelete);
          }}
          title={`Remove "${confirmDelete.displayLabel}"?`}
          description="Athletes won't see this implement in their picker anymore. Existing throws and PRs are preserved — you can restore the implement any time."
          confirmLabel="Remove"
          variant="danger"
        />
      )}
    </div>
  );
}

/* ─── Editor Modal ──────────────────────────────────────────────────────── */

function ImplementEditorModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial: CustomImplement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          throwType: initial.throwType,
          weight:
            initial.primaryUnit === "kg" ? String(initial.weightKg) : String(initial.weightLb),
          unit: initial.primaryUnit,
          displayLabel: initial.displayLabel,
          shortLabel: initial.shortLabel,
          notes: initial.notes ?? "",
          categories: initial.categoryTags.map((t) => t.category),
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(c: Category) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(c)
        ? prev.categories.filter((x) => x !== c)
        : [...prev.categories, c],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const weightNum = form.weight === "" ? null : parseFloat(form.weight);
    if (mode === "create" && (weightNum == null || !Number.isFinite(weightNum) || weightNum <= 0)) {
      toast("Enter a weight greater than zero", "error");
      return;
    }

    setSaving(true);
    try {
      const url =
        mode === "create" ? "/api/coach/implements" : `/api/coach/implements/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body =
        mode === "create"
          ? {
              throwType: form.throwType,
              weight: weightNum,
              unit: form.unit,
              displayLabel: form.displayLabel.trim() || undefined,
              shortLabel: form.shortLabel.trim() || undefined,
              notes: form.notes.trim() || undefined,
              categories: form.categories,
            }
          : {
              displayLabel: form.displayLabel.trim() || undefined,
              shortLabel: form.shortLabel.trim() || undefined,
              notes: form.notes.trim() || null,
              categories: form.categories,
            };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        toast(payload.error || `Request failed (${res.status})`, "error");
        return;
      }
      toast(mode === "create" ? "Implement added" : "Implement updated", "success");
      onSaved();
    } catch (err) {
      logger.error("ImplementEditor.submit", { error: err });
      toast("Network error — please try again", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "create" ? "Add custom implement" : "Edit custom implement"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="impl-throwType"
            className="text-xs font-semibold text-muted uppercase tracking-wider"
          >
            Throw type
          </label>
          <select
            id="impl-throwType"
            value={form.throwType}
            onChange={(e) => setField("throwType", e.target.value as ThrowType)}
            disabled={mode === "edit"}
            className="input w-full"
          >
            {(Object.keys(THROW_TYPE_LABELS) as ThrowType[]).map((t) => (
              <option key={t} value={t}>
                {THROW_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {mode === "edit" && (
            <p className="text-xs text-muted">
              Type is locked once created — historical PRs reference this implement.
            </p>
          )}
        </div>

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="impl-weight"
              className="text-xs font-semibold text-muted uppercase tracking-wider"
            >
              Weight
            </label>
            <input
              id="impl-weight"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.weight}
              disabled={mode === "edit"}
              onChange={(e) => setField("weight", e.target.value)}
              placeholder="e.g. 18"
              className="input w-full font-mono tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="impl-unit"
              className="text-xs font-semibold text-muted uppercase tracking-wider"
            >
              Unit
            </label>
            <select
              id="impl-unit"
              value={form.unit}
              disabled={mode === "edit"}
              onChange={(e) => setField("unit", e.target.value as Unit)}
              className="input w-full"
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>
        {mode === "edit" && (
          <p className="text-xs text-muted -mt-2">
            Weight + unit are locked. Remove and re-add if you typed it wrong.
          </p>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="impl-display"
            className="text-xs font-semibold text-muted uppercase tracking-wider"
          >
            Display label
          </label>
          <input
            id="impl-display"
            type="text"
            value={form.displayLabel}
            onChange={(e) => setField("displayLabel", e.target.value)}
            placeholder={
              form.weight && form.unit
                ? `${form.weight} ${form.unit}  (auto)`
                : 'e.g. "18 lb · 3/4 wire"'
            }
            className="input w-full"
            maxLength={60}
          />
          <p className="text-xs text-muted">
            Optional override. Leave blank to use the auto label. Use this for variants like
            &ldquo;18&nbsp;lb · 3/4 wire&rdquo; or &ldquo;20&nbsp;kg plate&rdquo;.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="impl-notes"
            className="text-xs font-semibold text-muted uppercase tracking-wider"
          >
            Notes
          </label>
          <textarea
            id="impl-notes"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Wire length, fabrication detail, where it lives, etc."
            className="input w-full min-h-[60px] resize-y"
            maxLength={500}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Categories
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((c) => {
              const active = form.categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    active
                      ? "bg-primary-500 text-black border-primary-500"
                      : "bg-transparent text-muted border-[var(--card-border)] hover:text-[var(--foreground)]"
                  }`}
                  aria-pressed={active}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Add implement" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
