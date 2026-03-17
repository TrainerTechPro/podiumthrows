# CLAUDE.md — Podium Throws

## Project Context

This is **Podium Throws**, a subscription coaching SaaS for Olympic-level track & field throws coaches. Built on Next.js 14.2 (App Router) + React 18.3 + TypeScript, PostgreSQL via Prisma, deployed on Vercel.

**Target users:** Division I and professional throws coaches managing rosters of athletes across shot put, discus, hammer, and javelin. Coaches pay $100+/month. Every screen must feel like it was built specifically for elite coaching.

**Competitors we must outperform:** BridgeAthletic, TrainHeroic, TeamBuildr, CoachMePlus.

### Tech Stack (Do NOT Change)
- Next.js 14.2 App Router + React 18.3 + TypeScript
- PostgreSQL via Prisma ORM (Vercel Postgres)
- Custom JWT auth (HttpOnly cookies, 7-day expiry, bcrypt)
- Stripe (free/pro/elite: 3/25/unlimited athletes)
- Cloudflare R2 for video storage
- Tailwind CSS 3.4 with custom theme
- Custom component library (~23 components) — NO shadcn, NO Material UI, NO Chakra, NO new UI dependencies
- Dark mode via `darkMode: "class"`
- Fonts: Outfit (headings) + DM Sans (body)
- Primary color: warm amber/gold
- Custom components: RPE slider, plate calculator, rest timer, voice recorder/player, video annotator, shimmer skeletons

### Key Directories
```
src/app/(auth)/              — login, register, forgot/reset-password
src/app/(dashboard)/coach/   — all coach pages
src/app/(dashboard)/athlete/ — all athlete pages
src/app/api/                 — API routes (the backend)
src/components/              — custom UI component library
src/lib/                     — auth, prisma, stripe, calculations
src/middleware.ts            — route protection
prisma/schema.prisma         — database schema
prisma/seed.ts               — test data seeder
```

### Database Migrations
- **Local dev:** `npm run db:migrate` — creates and applies migrations via `prisma migrate dev`
- **Production (build):** `prisma migrate deploy` — applies pending migrations only, never creates new ones
- **Do NOT use `prisma db push`** in production — it can silently drop data

### Test Accounts (after db:seed)
- Coach: coach@example.com / coach123
- Athlete 1: athlete1@example.com / athlete123
- Athlete 2: athlete2@example.com / athlete123

---

## Domain Rule — CRITICAL (Bondarchuk Methodology)

The entire app implements Dr. Anatoliy Bondarchuk's Transfer of Training methodology. These rules are NON-NEGOTIABLE and must be enforced in any code that touches throws sessions, exercise selection, or implement sequencing:

### Implement Weight Sequencing
**DESCENDING weight order is the ONLY correct sequence for natural athletes.**

| Sequence | Status |
|---|---|
| 9kg → 8kg → 7.26kg (heavy → comp) | ✅ CORRECT |
| 8kg only (single implement) | ✅ CORRECT |
| 6kg only, no heavy same day | ✅ CORRECT |
| 6kg → 8kg (ascending) | ❌ FORBIDDEN — causes 2-4m performance decrease |
| 7.26kg → 8kg (comp before heavy) | ❌ FORBIDDEN |
| Any light implement before any heavy implement | ❌ FORBIDDEN |

**Source:** Volume IV, p.114-117. All natural athletes in the study DECREASED 2-4 meters with ascending sequences.

### Session Structure
```
Throwing Block 1 (heaviest) → Strength Block → Throwing Block 2 (lighter) → Strength Block
```
NEVER two consecutive throwing blocks. Strength blocks between throwing blocks enable passive activation transfer.

### 15-20% Weight Differential Rule
Paired implements differing by more than 15-20% from competition weight create separate adaptations, not transfer. Flag these.

If you see ANY code that sequences light → heavy implements, it is WRONG. Fix it immediately.

---

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- Run `tsc --noEmit` after any code changes

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

---

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to `tasks/todo.md`
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections

---

## Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.
- **Read Before Write:** Fully understand a file's purpose, imports, and dependencies before modifying it. Grep for all usages of a function/component before changing its interface.
- **Preserve the Design System:** Use existing Tailwind theme, colors, fonts, and custom components. Do NOT introduce new dependencies.
- **Think in User Flows:** Every change should improve a specific user journey, not just refactor code in isolation.

---

## Known Issues (Fix When Encountered)

1. **Missing back buttons** on quizzes, forms, and multi-step wizards
2. **Non-clickable cards** that display data but don't navigate to detail views
3. **Inconsistent profile pages** between coach and athlete
4. **Readiness check-ins lack context** — single score with no breakdown (sleep, soreness, stress, etc.)
5. **Rankings/scores shown without context** for what they mean

---

## Quality Bar

Every screen must pass this test:

> "If an Olympic throws coach opened this for the first time, would they immediately understand what they're looking at, trust the data, and feel like this tool was built specifically for them?"

If any screen makes you hesitate — fix it until the answer is yes.
