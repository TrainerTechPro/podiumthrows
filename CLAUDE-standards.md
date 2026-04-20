# CLAUDE-standards.md — Curated Protocol Library

> Opt-in engineering, testing, database, design, and documentation protocols. CLAUDE.md governs default behavior; these protocols are invoked by name when the task calls for their rigor. The **Conflict-Resolved Rules** at the bottom are binding overrides — read them before applying any protocol.

---

## How to Use

- CLAUDE.md (project root) is always authoritative.
- These protocols are opt-in. Invoke by name: _"Use the Bug Resolution Protocol,"_ _"MODE: RESEARCH,"_ _"Run the Refactoring Protocol on `src/lib/calculations.ts`."_
- Without explicit invocation, default conversational behavior applies.
- Ceremony (phase declarations, mode labels, per-test metadata blocks) only appears when a protocol is active.

---

## Development Mode Protocol (opt-in)

Four-mode development flow for work where uncontrolled changes would risk regression.

**Invocation:** user types `MODE: RESEARCH` (or `INNOVATE`, `PLAN`, `EXECUTE`). Mode persists until the user switches.

- **MODE: RESEARCH** — Observe only. Read files, ask questions. No suggestions, no planning, no code.
- **MODE: INNOVATE** — Brainstorm approaches and tradeoffs. No concrete plans, no code.
- **MODE: PLAN** — Produce a detailed technical spec: specific file paths, function names, change details. End with a numbered `IMPLEMENTATION CHECKLIST`. No code.
- **MODE: EXECUTE** — Implement exactly the approved plan. No additions or creative deviations. If deviation is required, revert to PLAN.

When no mode is set, operate per CLAUDE.md defaults. Do not announce mode on every response unless a mode has been invoked.

---

## Bug Resolution Protocol

For non-trivial bugs where certainty matters more than speed.

**Phase 1 — Evidence.** Catalog symptoms, exact error messages, affected components, reproduction context, missing information. No causes proposed yet.

**Phase 2 — Confidence Check.** Is the root cause evident from evidence?

- Yes → go to Phase 4.
- No → go to Phase 3.

**Phase 3 — Hypothesis Investigation.** Generate 3–5 ranked hypotheses with supporting evidence and a concrete, testable predictor each. Test until one is confirmed.

**Phase 4 — Solution Design + Risk Assessment.** Classify:

- **LOW** — isolated bug, obvious typo/logic → minimal verification.
- **MEDIUM** — logic or config changes, touches 1–2 modules → targeted regression tests.
- **HIGH** — core system, auth, payment, security, DB, Bondarchuk engine → full regression + rollback plan.

**Phase 5 — Validate.** Match test intensity to risk tier. Write a regression test for any bug above LOW. Document the fix and rationale.

**Rules:** no code changes until Phase 4. No assumptions — evidence only. If risk is uncertain, default to higher tier.

---

## Refactoring Protocol

For restructuring existing code without behavior change.

**Phase 1 — Assessment.** Document current behavior. Identify smells (Long Method, Duplicate Code, Feature Envy, Primitive Obsession, Data Clumps). Assess coupling/cohesion. Map deps. Review test coverage. **No code changes.**

**Phase 2 — Plan.** For each refactor: target, technique (Fowler catalog), expected outcome, validation method, rollback plan. Order lowest → highest risk. Atomic units (one refactor per commit).

**Phase 3 — Execute.** One refactor at a time. Verify tests pass after each. User checkpoint every 3 changes or before any HIGH-risk change.

**Phase 4 — Validate.** Full test suite. Performance comparison if applicable. Document complexity reduction.

**Non-negotiable:** behavior preservation. All existing tests continue passing. Public APIs unchanged. Error handling preserved.

---

## Test Development Protocol

For building test suites from scratch or filling major coverage gaps.

**Phase 1 — Analyze.** Identify testable modules. Categorize: Simple (pure), Moderate (stateful), Complex (integration). Flag async, I/O, network, DB. List deps needing mocks.

**Phase 2 — Batch.** Max 5–8 test files per batch. Order: utilities before consumers, simple before complex, critical before edge cases.

**Phase 3 — Implement.** Tight AAA. Naming: `should_[expected]_when_[condition]`. Each function/method: happy path, boundary, error handling, state where applicable.

**Phase 4 — Verify.** Per-batch coverage check. Failure messages must be actionable.

**Style:** lightweight. No multi-line JSDoc headers per test, no `console.log` narration, no per-test metadata objects. A tight `test(name, fn)` with clear AAA structure is the standard.

---

## Testing Standards

- **Pyramid:** 70% unit (<10ms, mocked deps), 20% integration (<100ms, real components, mocked boundaries), 10% E2E (<30s, critical paths).
- **FIRST:** Fast, Independent, Repeatable, Self-validating, Timely.
- **Naming:** `should_[behavior]_when_[condition]`.
- **Assertions:** specific over generic. `toBe(5)` not `toBeTruthy()`. Include failure messages when non-obvious.
- **Coverage targets:** 80% minimum on critical business logic, 100% on public API. Focus on branch coverage for conditionals.
- **Podium Throws critical paths (tests required):** auth, payment, session save, PR detection, Bondarchuk weight-sequence validation, CSRF header presence on client mutations.
- **Vitest caveat:** middleware is not exercised — CSRF and auth middleware always require manual verification.

---

## Database Design Protocol (Greenfield Only)

**Do not retrofit to Podium Throws' existing schema.** Apply only when designing a new database from zero.

**Phases:** Requirements → Tech selection (score PG / Mongo / Redis / Neo4j / TimescaleDB on structure 20% · scalability 25% · consistency 20% · query complexity 15% · expertise 10% · integration 10%) → Schema (3NF minimum for OLTP) → Performance (indexes for top 80% queries) → Integration (pool sizing, ORM, migrations).

**Conventions (greenfield only):**

- Tables: singular, snake_case (`user`, `order_item`)
- Columns: snake_case
- Indexes: `idx_table_col(s)`
- Constraints: `pk_`, `fk_`, `ck_`, `uq_`
- PK: single-column surrogate (UUID or auto-increment integer)
- Every table: `created_at`, `updated_at`, `version`

**Podium Throws exception:** Prisma PascalCase + cuid IDs is the standard here. Keep it. Any greenfield side-database we add (analytics warehouse, audit log store) uses the conventions above.

---

## Documentation Creation Protocol (opt-in)

For documenting a codebase from scratch.

**Phases:** Discovery (structure, entry points, deps) → Architecture (data flow, patterns, API, DB) → Feature extraction (features → tech mapping) → Operations (deployment, monitoring, runbooks).

**Default 6-file suite (opt-in only):** `README.md`, `ARCHITECTURE.md`, `FEATURES.md`, `SETUP.md`, `API.md`, `MAINTENANCE.md`. Cross-linked, consistent markdown, TOC for files >100 lines.

**Podium Throws note:** documentation surface is CLAUDE.md + `tasks/` + Notion. Do not retrofit the 6-file suite without explicit request.

---

## Documentation Synchronization Protocol

For bringing existing docs back in sync with code.

**Phase 1 — Inventory.** List all doc files, their purpose, cross-refs, style patterns.

**Phase 2 — Accuracy check.** Diff assertions against current code. Identify specific discrepancies.

**Phase 3 — Impact map.** Which code changes affect which doc sections?

**Phase 4 — Selective update.** Surgical edits only. Preserve voice, structure, terminology. Verify cross-refs after changes.

---

## Documentation Style

- Active voice 80%+. Direct commands for instructions.
- 15–20 words per sentence average. Mix short and medium lengths.
- Specific verbs (configure, initialize, deploy). Consistent terminology (same concept → same word everywhere).
- Plain language. Define jargon on first use.
- Descriptive link text ("See Architecture Overview"), never "click here".
- Professional, warm, confident. No hedge words ("might," "could," "possibly") unless uncertainty is real.

---

## Product Specification Protocol

For translating a product idea into an implementation-ready spec.

**Sections:** Foundation (purpose, users, metrics, scope) → Architecture (stack, data flow, deps, perf/security) → Features (priority-ranked P0/P1/P2, user stories, acceptance criteria, dependencies) → Constraints (resource, technical, business, performance) → Roadmap (2–4 phases, risk assessment, integration points).

**Format:** executive summary first. Progressive detail. Appendices last. Use numbered headings (1., 1.1, 1.1.1). Tables for comparisons; checklists for acceptance criteria.

---

## Design System Creation Protocol

For building a new design system from scratch.

**Phases:** Brand foundation → Tokens (color 10-shade scales with WCAG contrast checks, typography scale per breakpoint, spacing system off base unit) → Components (buttons/forms/cards/nav with all states) → Responsive behavior (breakpoints + scaling rules) → Implementation guidelines → QA.

**Deliverables:** token library (exportable), component catalog, implementation guide, usage guidelines, maintenance plan.

**Podium Throws exception:** design system already exists. See CLAUDE.md §Design System Rules and the Notion Design System page. Do not re-derive it.

---

## Webpage & Element Design Specification Protocols

For producing implementation-ready design briefs.

**Webpage spec — 5 phases:** Strategic foundation → UX architecture → Visual system → Responsive behavior → Technical implementation. Confirm each phase before advancing.

**Element spec — 4 phases:** Foundation → UX deep dive → Brand expression → Responsive strategy → Technical spec.

Both produce artifacts detailed enough for development with no further creative decisions.

---

## Expert Competencies (Absorbed — Not Separate Personas)

The Jobs lens (ruthless perfectionism, taste, product judgment) in CLAUDE.md remains the primary operating identity. These competencies are always available without persona-switching:

- **Engineering** (Gates-level): TypeScript, Python, JavaScript, React, SCSS, Node, modern frameworks. Elegant, concise, durable implementations.
- **Design** (Ive / Norman / Frost-level): UX strategy, visual design, design-systems architecture, accessibility (WCAG 2.1 AA), mobile-first responsive, atomic design.
- **Data** (Patil-level): relational + NoSQL modeling, dimensional + data vault methodology, ETL/ELT, streaming, orchestration, governance.

Apply silently. No "As [Name] would say..." announcements, no stacking personas in a single response.

---

## Conflict-Resolved Rules (Binding Overrides)

These supersede any rule in this file or the source standards pack. They resolve tensions between the curated protocols and CLAUDE.md defaults.

1. **Comment density.** Default to no comments. Only add when the WHY is non-obvious. CLAUDE.md top-level rule wins over any "every file / every function needs a comment block" rule.
2. **Mode declarations.** Announce mode only when the Development Mode Protocol has been invoked. Default responses do not label mode.
3. **Test ceremony.** Lightweight AAA. No JSDoc headers per test, no `console.log` narration, no per-test metadata objects. Use the Vitest idiom.
4. **Database naming.** Grandfather existing Prisma PascalCase + cuid. Apply greenfield snake_case conventions only to new databases.
5. **Documentation surface.** CLAUDE.md + `tasks/` + Notion remain the documentation surface for Podium Throws. Do not retrofit the 6-file suite.
6. **Persona announcements.** Jobs lens is the default operating stance. Do not stack personas or announce "As Steve Jobs / Jony Ive / Bill Gates would say..." in responses.
7. **Response length.** Default is tight. Ceremonial phase output appears only when the matching protocol is active.
8. **Project standards precedence.** If a curated protocol here conflicts with an explicit rule in CLAUDE.md, CLAUDE.md wins.
