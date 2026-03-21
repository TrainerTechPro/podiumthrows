"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   SessionMockup
   ─────────────
   Interactive session builder mockup with Two-a-day / Single session toggle.
   Demonstrates Bondarchuk methodology: descending implement weights,
   throwing blocks interleaved with strength blocks. Used inside the
   StickyFeatures section.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────────────────

type SessionMode = "two" | "one";

interface ExerciseBlock {
  type: "throwing" | "strength";
  icon: string;
  name: string;
  detail: string;
  weight?: string;
  weightArrow?: boolean; // green ↓ before weight
}

interface BlockGroup {
  label: string;
  blocks: ExerciseBlock[];
}

// ─── Data ───────────────────────────────────────────────────────────────────────

const TWO_A_DAY_GROUPS: BlockGroup[] = [
  {
    label: "THROWING BLOCK 1 — OVERWEIGHT 9KG",
    blocks: [
      { type: "throwing", icon: "T1", name: "Standing Throw", detail: "12 throws · 9kg", weight: "9kg" },
      { type: "throwing", icon: "T1", name: "Half Turn", detail: "10 throws · 9kg" },
    ],
  },
  {
    label: "STRENGTH BLOCK",
    blocks: [
      { type: "strength", icon: "S1", name: "Power Clean", detail: "4 × 3 @ 85%" },
    ],
  },
  {
    label: "THROWING BLOCK 2 — COMPETITION 7.26KG",
    blocks: [
      { type: "throwing", icon: "T2", name: "South African", detail: "10 throws · 7.26kg", weight: "↓ 7.26kg", weightArrow: true },
      { type: "throwing", icon: "T2", name: "Full Throw", detail: "15 throws · 7.26kg" },
    ],
  },
  {
    label: "STRENGTH BLOCK",
    blocks: [
      { type: "strength", icon: "S2", name: "Back Squat", detail: "3 × 5 @ 80%" },
    ],
  },
];

const SINGLE_SESSION_GROUPS: BlockGroup[] = [
  {
    label: "THROWING BLOCK — COMPETITION 7.26KG",
    blocks: [
      { type: "throwing", icon: "T1", name: "Standing Throw", detail: "10 throws · 7.26kg", weight: "7.26kg" },
      { type: "throwing", icon: "T1", name: "Half Turn", detail: "8 throws · 7.26kg" },
      { type: "throwing", icon: "T1", name: "South African", detail: "8 throws · 7.26kg" },
      { type: "throwing", icon: "T1", name: "Full Throw", detail: "12 throws · 7.26kg" },
    ],
  },
  {
    label: "STRENGTH BLOCK",
    blocks: [
      { type: "strength", icon: "S1", name: "Power Clean", detail: "4 × 3 @ 85%" },
      { type: "strength", icon: "S1", name: "Back Squat", detail: "3 × 5 @ 80%" },
    ],
  },
];

// ─── Subcomponents ──────────────────────────────────────────────────────────────

function GroupLabel({ label }: { label: string }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 8,
        fontFamily: "var(--font-outfit), system-ui, sans-serif",
        fontSize: 9,
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.1em",
        color: "#f59e0b",
      }}
    >
      <span className="flex-shrink-0 whitespace-nowrap">{label}</span>
      <span
        className="flex-1"
        style={{ height: 1, background: "var(--landing-border)" }}
      />
    </div>
  );
}

function ExerciseRow({ block }: { block: ExerciseBlock }) {
  const isThrowing = block.type === "throwing";

  return (
    <div
      className="flex items-center"
      style={{
        gap: 12,
        background: "var(--landing-bg)",
        border: "1px solid var(--landing-border)",
        borderRadius: 8,
        padding: "11px 14px",
        borderLeft: isThrowing
          ? "2px solid rgba(245,158,11,0.25)"
          : "2px solid rgba(129,140,248,0.2)",
      }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: 7,
          background: isThrowing
            ? "var(--landing-amber-glow-strong)"
            : "rgba(99,102,241,0.12)",
          fontFamily: "var(--font-outfit), system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 11,
          color: isThrowing ? "#f59e0b" : "#818cf8",
        }}
      >
        {block.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--landing-text)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            lineHeight: 1.2,
          }}
        >
          {block.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--landing-text-muted)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            marginTop: 1,
          }}
        >
          {block.detail}
        </div>
      </div>

      {/* Weight badge (optional) */}
      {block.weight && (
        <div
          className="flex-shrink-0"
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--landing-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {block.weightArrow ? (
            <>
              <span style={{ color: "#4ade80" }}>↓</span>{" "}
              <span>{block.weight.replace("↓ ", "")}</span>
            </>
          ) : (
            block.weight
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function SessionMockup() {
  const [mode, setMode] = useState<SessionMode>("two");
  const prefersReducedMotion = useReducedMotion();

  const groups = mode === "two" ? TWO_A_DAY_GROUPS : SINGLE_SESSION_GROUPS;

  const modeLabel =
    mode === "two"
      ? "Dual-session · Descending weight"
      : "Single session · Drill progression";

  const sequenceText =
    mode === "two"
      ? "Descending: 9kg → 7.26kg — correct order"
      : "Single implement: 7.26kg · Stand → Half → SA → Full";

  const contentVariants = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 1.02 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 },
      };

  return (
    <div
      className="w-full select-none"
      style={{
        borderRadius: 14,
        border: "1px solid var(--landing-border)",
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02)",
        overflow: "hidden",
        background: "var(--landing-surface)",
      }}
      aria-hidden="true"
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "10px 14px" }}
      >
        {/* Title */}
        <span
          style={{
            fontFamily: "var(--font-outfit), system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--landing-text)",
          }}
        >
          Tuesday AM — Shot Put
        </span>

        {/* Segmented control */}
        <div
          className="relative flex"
          style={{
            background: "var(--landing-bg)",
            border: "1px solid var(--landing-border)",
            borderRadius: 8,
            padding: 2,
          }}
        >
          {(["two", "one"] as const).map((value) => {
            const isActive = mode === value;
            const label = value === "two" ? "Two-a-day" : "Single session";

            return (
              <button
                key={value}
                onClick={() => setMode(value)}
                className="relative z-10"
                style={{
                  fontFamily: "var(--font-outfit), system-ui, sans-serif",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "6px 12px",
                  background: "transparent",
                  color: isActive ? "#f59e0b" : "var(--landing-text-muted)",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  whiteSpace: "nowrap",
                }}
              >
                {/* Sliding indicator */}
                {isActive && (
                  <motion.div
                    layoutId="session-mode-indicator"
                    className="absolute inset-0"
                    style={{
                      borderRadius: 6,
                      background: "var(--landing-amber-glow-strong)",
                      zIndex: -1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                      duration: prefersReducedMotion ? 0 : undefined,
                    }}
                  />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "0 14px 8px 14px" }}
      >
        <span
          style={{
            fontSize: 9,
            textTransform: "uppercase" as const,
            letterSpacing: "0.06em",
            color: "var(--landing-text-dim)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          {modeLabel}
        </span>
        <span
          className="inline-flex items-center"
          style={{
            fontSize: 9,
            fontWeight: 500,
            color: "#4ade80",
            background: "rgba(34,197,94,0.08)",
            borderRadius: 9999,
            padding: "2px 8px",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          ✓ Valid Sequence
        </span>
      </div>

      {/* ── Session blocks ──────────────────────────────────────────── */}
      <div style={{ padding: "0 14px" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={contentVariants.initial}
            animate={contentVariants.animate}
            exit={contentVariants.exit}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            className="flex flex-col"
            style={{ gap: 10 }}
          >
            {groups.map((group, gi) => (
              <div key={`${mode}-${gi}`} className="flex flex-col" style={{ gap: 6 }}>
                <GroupLabel label={group.label} />
                {group.blocks.map((block, bi) => (
                  <ExerciseRow key={`${mode}-${gi}-${bi}`} block={block} />
                ))}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Sequence bar (bottom) ───────────────────────────────────── */}
      <div
        className="flex items-center"
        style={{
          gap: 8,
          padding: "6px 14px",
          margin: "10px 12px 12px 12px",
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.08)",
          borderRadius: 6,
        }}
      >
        {/* Arrow icon */}
        <span
          style={{
            fontSize: 12,
            color: "#4ade80",
            lineHeight: 1,
          }}
        >
          ↓
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#4ade80",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          {sequenceText}
        </span>
      </div>
    </div>
  );
}
