# Proxy Athlete Profiles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable coaches to create and fully manage athlete profiles before the athlete signs up — log throws with video, upload standalone videos, add notes, edit profiles — then hand off via an invite link with a review step.

**Architecture:** Hybrid approach — add a Coach Action Bar to the existing athlete detail page for quick-capture tools (log throw, upload video, edit profile, add note). Reuse existing athlete data models (ThrowLog, AthleteProfile) with new models for coach notes (CoachNote) and standalone videos (AthleteVideo). Coach stays logged in as coach throughout; no impersonation. Athlete claim flow enhanced with a review page showing all coach-entered data.

**Tech Stack:** Next.js 14.2 App Router, Prisma ORM, Zod validation, Cloudflare R2 (via @aws-sdk/client-s3), Tailwind CSS, Lucide React icons, existing custom component library.

**Spec:** `docs/superpowers/specs/2026-04-10-proxy-athlete-profiles-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `prisma/migrations/YYYYMMDD_coach_notes_athlete_videos/migration.sql` | Schema migration (auto-generated) |
| `src/app/api/coach/athletes/[id]/throws/route.ts` | Coach logs/lists throws for an athlete |
| `src/app/api/coach/athletes/[id]/throws/[throwId]/route.ts` | Coach deletes a throw |
| `src/app/api/coach/athletes/[id]/videos/route.ts` | Coach uploads/lists standalone videos |
| `src/app/api/coach/athletes/[id]/videos/[videoId]/route.ts` | Coach deletes a video |
| `src/app/api/coach/athletes/[id]/notes/route.ts` | Coach creates/lists notes |
| `src/app/api/coach/athletes/[id]/notes/[noteId]/route.ts` | Coach edits/deletes a note |
| `src/app/api/coach/athletes/[id]/profile/route.ts` | Coach edits athlete profile fields |
| `src/app/(dashboard)/coach/athletes/[id]/_action-bar.tsx` | Coach action bar component (4 buttons) |
| `src/app/(dashboard)/coach/athletes/[id]/_log-throw-modal.tsx` | Log Throw bottom sheet/modal |
| `src/app/(dashboard)/coach/athletes/[id]/_upload-video-modal.tsx` | Upload Video bottom sheet/modal |
| `src/app/(dashboard)/coach/athletes/[id]/_add-note-modal.tsx` | Add Note bottom sheet/modal |
| `src/app/(dashboard)/coach/athletes/[id]/profile/edit/page.tsx` | Coach profile editor page |
| `src/app/(dashboard)/athlete/review-profile/page.tsx` | Post-claim review page |
| `src/app/(dashboard)/athlete/review-profile/_review-client.tsx` | Review page client component |

### Modified Files
| File | What Changes |
|------|-------------|
| `prisma/schema.prisma` | Add CoachNote, AthleteVideo models, NoteCategory enum, relations on AthleteProfile + CoachProfile |
| `src/lib/api-schemas.ts` | Add Zod schemas for new endpoints |
| `src/lib/r2.ts` | Add `generateAthleteVideoKey()` helper |
| `src/lib/data/coach.ts` | Add `getAthleteRoster` claimedAt field, add helper functions for notes/videos |
| `src/app/api/coach/athletes/route.ts` | Add `gender` to CoachAddAthleteSchema |
| `src/app/(dashboard)/coach/athletes/_invite.tsx` | Redesign as two-tab "Add Athlete" modal |
| `src/app/(dashboard)/coach/athletes/_roster-client.tsx` | Add ghost icon, invite CTA for unclaimed profiles |
| `src/app/(dashboard)/coach/athletes/page.tsx` | Pass `claimedAt` data to roster client |
| `src/app/(dashboard)/coach/athletes/[id]/page.tsx` | Add action bar, pass claim status |
| `src/app/api/auth/register-claim/route.ts` | Redirect to review page, add skip-onboarding logic |

---

## Phase 1: Foundation (Schema + APIs)

### Task 1: Schema Migration — CoachNote, AthleteVideo, NoteCategory

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add NoteCategory enum to schema**

Add after the existing enums section in `prisma/schema.prisma`:

```prisma
enum NoteCategory {
  TECHNICAL
  MENTAL
  INJURY
  GENERAL
}
```

- [ ] **Step 2: Add CoachNote model**

Add after the VoiceNote model:

```prisma
model CoachNote {
  id               String         @id @default(cuid())
  coachProfileId   String
  coach            CoachProfile   @relation(fields: [coachProfileId], references: [id], onDelete: Cascade)
  athleteProfileId String
  athlete          AthleteProfile @relation(fields: [athleteProfileId], references: [id], onDelete: Cascade)
  content          String
  category         NoteCategory   @default(GENERAL)
  isPrivate        Boolean        @default(false)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([athleteProfileId])
  @@index([coachProfileId])
  @@index([athleteProfileId, createdAt])
}
```

- [ ] **Step 3: Add AthleteVideo model**

Add after the CoachNote model:

```prisma
model AthleteVideo {
  id               String         @id @default(cuid())
  athleteProfileId String
  athlete          AthleteProfile @relation(fields: [athleteProfileId], references: [id], onDelete: Cascade)
  uploadedById     String?
  uploadedBy       CoachProfile?  @relation("UploadedVideos", fields: [uploadedById], references: [id], onDelete: SetNull)
  r2Key            String
  url              String
  thumbnailUrl     String?
  event            EventType?
  implementWeight  Float?
  distance         Float?
  notes            String?
  createdAt        DateTime       @default(now())

  @@index([athleteProfileId])
  @@index([athleteProfileId, createdAt])
}
```

- [ ] **Step 4: Add relations to AthleteProfile**

In the `AthleteProfile` model, add these relation fields alongside the existing relations:

```prisma
  coachNotes       CoachNote[]
  videos           AthleteVideo[]
```

- [ ] **Step 5: Add relations to CoachProfile**

In the `CoachProfile` model, add these relation fields:

```prisma
  coachNotes       CoachNote[]
  uploadedVideos   AthleteVideo[] @relation("UploadedVideos")
```

- [ ] **Step 6: Run migration**

```bash
npx prisma migrate dev --name add_coach_notes_athlete_videos
```

Expected: Migration created and applied successfully.

- [ ] **Step 7: Verify with tsc**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add CoachNote, AthleteVideo models and NoteCategory enum"
```

---

### Task 2: Zod Schemas for All New Endpoints

**Files:**
- Modify: `src/lib/api-schemas.ts`

- [ ] **Step 1: Add coach throw logging schema**

Add to `src/lib/api-schemas.ts`:

```typescript
// ─── COACH PROXY PROFILE SCHEMAS ────────────────────────────────────────────

export const CoachLogThrowSchema = z.object({
  event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]),
  implementWeight: z.number().positive("Implement weight must be positive"),
  implementWeightUnit: z.enum(["kg", "lbs"]).default("kg"),
  implementWeightOriginal: z.number().positive().nullable().optional(),
  distance: z.number().positive("Distance must be positive").nullable().optional(),
  isCompetition: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  wireLength: z.enum(["FULL", "THREE_QUARTER", "HALF"]).nullable().optional(),
});

export const CoachNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  category: z.enum(["TECHNICAL", "MENTAL", "INJURY", "GENERAL"]).default("GENERAL"),
  isPrivate: z.boolean().default(false),
});

export const CoachNoteUpdateSchema = z.object({
  content: z.string().min(1, "Note content is required").optional(),
  category: z.enum(["TECHNICAL", "MENTAL", "INJURY", "GENERAL"]).optional(),
  isPrivate: z.boolean().optional(),
});

export const CoachEditProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  events: z.array(z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"])).min(1).optional(),
  dateOfBirth: z.string().nullable().optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  weightKg: z.number().min(30).max(200).nullable().optional(),
  classStanding: z.string().nullable().optional(),
  gradYear: z.number().int().nullable().optional(),
  turnDirection: z.enum(["LEFT", "RIGHT"]).nullable().optional(),
  strengthNumbers: z.record(z.unknown()).nullable().optional(),
  technicalProfile: z.record(z.unknown()).nullable().optional(),
  injuryHistory: z.record(z.unknown()).nullable().optional(),
  movementRestrictions: z.record(z.unknown()).nullable().optional(),
  competitionPRs: z.record(z.unknown()).nullable().optional(),
  implementPRs: z.record(z.unknown()).nullable().optional(),
});
```

- [ ] **Step 2: Update CoachAddAthleteSchema to include gender**

Find the existing `CoachAddAthleteSchema` and add the gender field:

```typescript
export const CoachAddAthleteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
  events: z
    .array(z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]))
    .min(1, "At least one event is required"),
});
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-schemas.ts
git commit -m "feat: add Zod schemas for coach proxy profile endpoints"
```

---

### Task 3: Coach-Athlete Ownership Helper

**Files:**
- Modify: `src/lib/data/coach.ts`

- [ ] **Step 1: Add ownership verification helper**

Add to `src/lib/data/coach.ts`:

```typescript
/**
 * Verify coach owns this athlete and return both profiles.
 * Returns null if auth fails or athlete doesn't belong to coach.
 */
export async function requireCoachAthlete(
  athleteId: string
): Promise<{
  session: JWTPayload;
  coach: { id: string; plan: SubscriptionPlan };
  athlete: AthleteProfile & { user: { claimedAt: Date | null } };
} | null> {
  const session = await getSession();
  if (!session || session.role !== "COACH") return null;

  const coach = await prisma.coachProfile.findUnique({
    where: { userId: session.userId },
    select: { id: true, plan: true },
  });
  if (!coach) return null;

  const athlete = await prisma.athleteProfile.findFirst({
    where: { id: athleteId, coachId: coach.id },
    include: { user: { select: { claimedAt: true } } },
  });
  if (!athlete) return null;

  return { session, coach, athlete };
}
```

Add the necessary imports at the top if not already present:

```typescript
import { getSession } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import type { AthleteProfile, SubscriptionPlan } from "@prisma/client";
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/coach.ts
git commit -m "feat: add requireCoachAthlete ownership helper"
```

---

### Task 4: Coach Throw Logging API

**Files:**
- Create: `src/app/api/coach/athletes/[id]/throws/route.ts`
- Create: `src/app/api/coach/athletes/[id]/throws/[throwId]/route.ts`

- [ ] **Step 1: Create the throws route directory**

```bash
mkdir -p "src/app/api/coach/athletes/[id]/throws/[throwId]"
```

- [ ] **Step 2: Create POST + GET handler for throws**

Create `src/app/api/coach/athletes/[id]/throws/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachLogThrowSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const parsed = await parseBody(request, CoachLogThrowSchema);
  if (parsed instanceof NextResponse) return parsed;

  const {
    event,
    implementWeight,
    implementWeightUnit,
    implementWeightOriginal,
    distance,
    isCompetition,
    notes,
    videoUrl,
    rpe,
    wireLength,
  } = parsed;

  // Check if this is a PR for this event + implement weight
  let isPersonalBest = false;
  if (distance != null) {
    const currentBest = await prisma.throwLog.findFirst({
      where: {
        athleteId,
        event,
        implementWeight,
        distance: { not: null },
        isPersonalBest: true,
      },
      select: { id: true, distance: true },
    });

    if (!currentBest || (currentBest.distance != null && distance > currentBest.distance)) {
      isPersonalBest = true;
      // Unset previous PR if it exists
      if (currentBest) {
        await prisma.throwLog.update({
          where: { id: currentBest.id },
          data: { isPersonalBest: false },
        });
      }
    }
  }

  const throwLog = await prisma.throwLog.create({
    data: {
      athleteId,
      event,
      implementWeight,
      implementWeightUnit,
      implementWeightOriginal: implementWeightOriginal ?? null,
      distance: distance ?? null,
      isCompetition,
      isPersonalBest,
      notes: notes ?? null,
      videoUrl: videoUrl ?? null,
      rpe: rpe ?? null,
      wireLength: wireLength ?? null,
      sessionId: null,
    },
  });

  return NextResponse.json({ success: true, data: throwLog }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const throws = await prisma.throwLog.findMany({
    where: { athleteId },
    orderBy: { date: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: throws });
}
```

- [ ] **Step 3: Create DELETE handler for individual throw**

Create `src/app/api/coach/athletes/[id]/throws/[throwId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; throwId: string }> }
) {
  const { id: athleteId, throwId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  // Only allow delete on unclaimed profiles, or throws without a session (coach-created)
  const throwLog = await prisma.throwLog.findFirst({
    where: { id: throwId, athleteId },
  });

  if (!throwLog) {
    return NextResponse.json(
      { success: false, error: "Throw not found" },
      { status: 404 }
    );
  }

  const isClaimed = ctx.athlete.user.claimedAt != null;
  if (isClaimed && throwLog.sessionId != null) {
    return NextResponse.json(
      { success: false, error: "Cannot delete athlete-logged throws on claimed profiles" },
      { status: 403 }
    );
  }

  await prisma.throwLog.delete({ where: { id: throwId } });

  return NextResponse.json({ success: true, data: { deleted: throwId } });
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/coach/athletes/[id]/throws/"
git commit -m "feat: add coach throw logging API (POST, GET, DELETE)"
```

---

### Task 5: Coach Notes API

**Files:**
- Create: `src/app/api/coach/athletes/[id]/notes/route.ts`
- Create: `src/app/api/coach/athletes/[id]/notes/[noteId]/route.ts`

- [ ] **Step 1: Create the notes route directory**

```bash
mkdir -p "src/app/api/coach/athletes/[id]/notes/[noteId]"
```

- [ ] **Step 2: Create POST + GET handler for notes**

Create `src/app/api/coach/athletes/[id]/notes/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachNoteSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const parsed = await parseBody(request, CoachNoteSchema);
  if (parsed instanceof NextResponse) return parsed;

  const note = await prisma.coachNote.create({
    data: {
      coachProfileId: ctx.coach.id,
      athleteProfileId: athleteId,
      content: parsed.content,
      category: parsed.category,
      isPrivate: parsed.isPrivate,
    },
  });

  return NextResponse.json({ success: true, data: note }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const notes = await prisma.coachNote.findMany({
    where: { athleteProfileId: athleteId, coachProfileId: ctx.coach.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: notes });
}
```

- [ ] **Step 3: Create PATCH + DELETE handler for individual note**

Create `src/app/api/coach/athletes/[id]/notes/[noteId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachNoteUpdateSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: athleteId, noteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const note = await prisma.coachNote.findFirst({
    where: { id: noteId, athleteProfileId: athleteId, coachProfileId: ctx.coach.id },
  });
  if (!note) {
    return NextResponse.json(
      { success: false, error: "Note not found" },
      { status: 404 }
    );
  }

  const parsed = await parseBody(request, CoachNoteUpdateSchema);
  if (parsed instanceof NextResponse) return parsed;

  const updated = await prisma.coachNote.update({
    where: { id: noteId },
    data: {
      ...(parsed.content !== undefined ? { content: parsed.content } : {}),
      ...(parsed.category !== undefined ? { category: parsed.category } : {}),
      ...(parsed.isPrivate !== undefined ? { isPrivate: parsed.isPrivate } : {}),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: athleteId, noteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const note = await prisma.coachNote.findFirst({
    where: { id: noteId, athleteProfileId: athleteId, coachProfileId: ctx.coach.id },
  });
  if (!note) {
    return NextResponse.json(
      { success: false, error: "Note not found" },
      { status: 404 }
    );
  }

  await prisma.coachNote.delete({ where: { id: noteId } });

  return NextResponse.json({ success: true, data: { deleted: noteId } });
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/coach/athletes/[id]/notes/"
git commit -m "feat: add coach notes API (POST, GET, PATCH, DELETE)"
```

---

### Task 6: Coach Video Upload API

**Files:**
- Modify: `src/lib/r2.ts`
- Create: `src/app/api/coach/athletes/[id]/videos/route.ts`
- Create: `src/app/api/coach/athletes/[id]/videos/[videoId]/route.ts`

- [ ] **Step 1: Add athlete video key generator to r2.ts**

Add to `src/lib/r2.ts`:

```typescript
export function generateAthleteVideoKey(athleteId: string, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `videos/athletes/${athleteId}/${timestamp}-${random}${ext}`;
}
```

- [ ] **Step 2: Create the video route directories**

```bash
mkdir -p "src/app/api/coach/athletes/[id]/videos/[videoId]"
```

- [ ] **Step 3: Create POST + GET handler for videos**

Create `src/app/api/coach/athletes/[id]/videos/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachAthlete } from "@/lib/data/coach";
import {
  uploadSingleFile,
  generateAthleteVideoKey,
  getPublicUrl,
  isR2Configured,
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_SIZE_MB,
} from "@/lib/r2";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { success: false, error: "Video storage is not configured" },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("video") as File | null;
  if (!file) {
    return NextResponse.json(
      { success: false, error: "No video file provided" },
      { status: 400 }
    );
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: `Unsupported video type: ${file.type}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { success: false, error: `Video exceeds ${MAX_VIDEO_SIZE_MB}MB limit` },
      { status: 400 }
    );
  }

  const event = formData.get("event") as string | null;
  const implementWeight = formData.get("implementWeight");
  const distance = formData.get("distance");
  const notes = formData.get("notes") as string | null;

  const r2Key = generateAthleteVideoKey(athleteId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadSingleFile(r2Key, buffer, file.type);
  const url = getPublicUrl(r2Key);

  const video = await prisma.athleteVideo.create({
    data: {
      athleteProfileId: athleteId,
      uploadedById: ctx.coach.id,
      r2Key,
      url,
      event: event as "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN" | null,
      implementWeight: implementWeight ? parseFloat(implementWeight as string) : null,
      distance: distance ? parseFloat(distance as string) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ success: true, data: video }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const videos = await prisma.athleteVideo.findMany({
    where: { athleteProfileId: athleteId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data: videos });
}
```

- [ ] **Step 4: Create DELETE handler for individual video**

Create `src/app/api/coach/athletes/[id]/videos/[videoId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachAthlete } from "@/lib/data/coach";
import { deleteFile } from "@/lib/r2";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  const { id: athleteId, videoId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const video = await prisma.athleteVideo.findFirst({
    where: { id: videoId, athleteProfileId: athleteId },
  });
  if (!video) {
    return NextResponse.json(
      { success: false, error: "Video not found" },
      { status: 404 }
    );
  }

  // Only allow delete if coach uploaded it or profile is unclaimed
  const isClaimed = ctx.athlete.user.claimedAt != null;
  if (isClaimed && video.uploadedById !== ctx.coach.id) {
    return NextResponse.json(
      { success: false, error: "Cannot delete athlete-uploaded videos on claimed profiles" },
      { status: 403 }
    );
  }

  // Delete from R2 and DB
  try {
    await deleteFile(video.r2Key);
  } catch {
    // Log but don't fail — DB record should still be cleaned up
    console.error(`Failed to delete R2 object: ${video.r2Key}`);
  }

  await prisma.athleteVideo.delete({ where: { id: videoId } });

  return NextResponse.json({ success: true, data: { deleted: videoId } });
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/r2.ts "src/app/api/coach/athletes/[id]/videos/"
git commit -m "feat: add coach video upload API with R2 storage (POST, GET, DELETE)"
```

---

### Task 7: Coach Profile Edit API

**Files:**
- Create: `src/app/api/coach/athletes/[id]/profile/route.ts`

- [ ] **Step 1: Create the profile route directory**

```bash
mkdir -p "src/app/api/coach/athletes/[id]/profile"
```

- [ ] **Step 2: Create PATCH handler**

Create `src/app/api/coach/athletes/[id]/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBody, CoachEditProfileSchema } from "@/lib/api-schemas";
import { requireCoachAthlete } from "@/lib/data/coach";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const parsed = await parseBody(request, CoachEditProfileSchema);
  if (parsed instanceof NextResponse) return parsed;

  const isClaimed = ctx.athlete.user.claimedAt != null;

  // Build update data respecting permission rules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // Core info — only editable on unclaimed profiles
  if (!isClaimed) {
    if (parsed.firstName !== undefined) updateData.firstName = parsed.firstName;
    if (parsed.lastName !== undefined) updateData.lastName = parsed.lastName;
    if (parsed.gender !== undefined) updateData.gender = parsed.gender;
    if (parsed.events !== undefined) updateData.events = parsed.events;
    if (parsed.dateOfBirth !== undefined) {
      updateData.dateOfBirth = parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null;
    }
    if (parsed.heightCm !== undefined) updateData.heightCm = parsed.heightCm;
    if (parsed.weightKg !== undefined) updateData.weightKg = parsed.weightKg;
    if (parsed.classStanding !== undefined) updateData.classStanding = parsed.classStanding;
    if (parsed.gradYear !== undefined) updateData.gradYear = parsed.gradYear;
    if (parsed.turnDirection !== undefined) updateData.turnDirection = parsed.turnDirection;
  }

  // Coaching fields — always editable by coach
  if (parsed.strengthNumbers !== undefined) updateData.strengthNumbers = parsed.strengthNumbers;
  if (parsed.technicalProfile !== undefined) updateData.technicalProfile = parsed.technicalProfile;
  if (parsed.injuryHistory !== undefined) updateData.injuryHistory = parsed.injuryHistory;
  if (parsed.movementRestrictions !== undefined) updateData.movementRestrictions = parsed.movementRestrictions;
  if (parsed.competitionPRs !== undefined) updateData.competitionPRs = parsed.competitionPRs;
  if (parsed.implementPRs !== undefined) updateData.implementPRs = parsed.implementPRs;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: "No editable fields provided" },
      { status: 400 }
    );
  }

  const updated = await prisma.athleteProfile.update({
    where: { id: athleteId },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: athleteId } = await params;

  const ctx = await requireCoachAthlete(athleteId);
  if (!ctx) {
    return NextResponse.json(
      { success: false, error: "Unauthorized or athlete not found" },
      { status: 401 }
    );
  }

  const profile = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    include: {
      user: { select: { email: true, claimedAt: true, createdAt: true } },
    },
  });

  return NextResponse.json({ success: true, data: profile });
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/coach/athletes/[id]/profile/"
git commit -m "feat: add coach profile edit API with claim-status permission gating"
```

---

### Task 8: Update Coach Add Athlete Endpoint

**Files:**
- Modify: `src/app/api/coach/athletes/route.ts`

- [ ] **Step 1: Update the POST handler to accept gender**

In `src/app/api/coach/athletes/route.ts`, the `CoachAddAthleteSchema` was updated in Task 2 to include `gender`. Update the athlete creation in the transaction to use the provided gender instead of defaulting to `"OTHER"`:

Find the line:
```typescript
    gender: "OTHER",
```

Replace with:
```typescript
    gender,
```

And ensure `gender` is destructured from `parsed`:
```typescript
const { firstName, lastName, gender, events } = parsed;
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/coach/athletes/route.ts
git commit -m "feat: accept gender field when coach creates proxy athlete profile"
```

---

## Phase 2: Coach UI (Action Bar + Modals)

### Task 9: Add Athlete Modal Redesign

**Files:**
- Modify: `src/app/(dashboard)/coach/athletes/_invite.tsx`

- [ ] **Step 1: Read the current invite modal**

Read the full `_invite.tsx` file to understand its exact structure before modifying.

- [ ] **Step 2: Add "Create Profile" tab to the modal**

Redesign the modal to have two tabs. The component should:
- Rename from `InviteAthleteButton` to `AddAthleteButton` (update the export and all consumers)
- Add a `mode` state: `"create" | "invite"` (default `"create"`)
- Tab 1 "Create Profile": form with firstName, lastName, gender (toggle buttons), events (multi-select pills)
- Tab 2 "Send Invite": existing email/link flow unchanged
- On create success: call `router.push(\`/coach/athletes/\${data.id}\`)` to navigate to the new athlete's detail page
- Use existing `Tabs`, `TabList`, `TabTrigger`, `TabPanel` from `src/components/ui/Tabs.tsx`

Key implementation points:
- Use `csrfHeaders()` for the fetch call (existing pattern)
- POST to `/api/coach/athletes` for create mode
- POST to `/api/invitations` for invite mode (unchanged)
- Toast on success: `toast.success("Added [name] to your roster")`
- Plan limit check stays as-is (applies to both tabs)

- [ ] **Step 3: Update the roster page to use the renamed component**

In `src/app/(dashboard)/coach/athletes/page.tsx`, update the import and usage from `InviteAthleteButton` to `AddAthleteButton`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/_invite.tsx" "src/app/(dashboard)/coach/athletes/page.tsx"
git commit -m "feat: redesign invite modal as Add Athlete with Create Profile + Send Invite tabs"
```

---

### Task 10: Coach Action Bar Component

**Files:**
- Create: `src/app/(dashboard)/coach/athletes/[id]/_action-bar.tsx`
- Modify: `src/app/(dashboard)/coach/athletes/[id]/page.tsx`

- [ ] **Step 1: Create the action bar component**

Create `src/app/(dashboard)/coach/athletes/[id]/_action-bar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Target, Video, UserPen, StickyNote } from "lucide-react";
import { LogThrowModal } from "./_log-throw-modal";
import { UploadVideoModal } from "./_upload-video-modal";
import { AddNoteModal } from "./_add-note-modal";
import { useRouter } from "next/navigation";

interface ActionBarProps {
  athleteId: string;
  athleteName: string;
  events: string[];
  gender: string | null;
}

const actions = [
  { id: "throw", label: "Log Throw", icon: Target },
  { id: "video", label: "Upload Video", icon: Video },
  { id: "profile", label: "Edit Profile", icon: UserPen },
  { id: "note", label: "Add Note", icon: StickyNote },
] as const;

type ModalType = (typeof actions)[number]["id"] | null;

export function CoachActionBar({ athleteId, athleteName, events, gender }: ActionBarProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const router = useRouter();

  function handleAction(id: ModalType) {
    if (id === "profile") {
      router.push(`/coach/athletes/${athleteId}/profile/edit`);
      return;
    }
    setActiveModal(id);
  }

  return (
    <>
      {/* Desktop: horizontal pill buttons */}
      <div className="hidden md:flex items-center gap-2 py-3">
        {actions.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleAction(id)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-sm font-medium text-[var(--foreground)]
              hover:bg-surface-200 dark:hover:bg-surface-700
              transition-colors"
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* Mobile: sticky bottom icon row */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden
        bg-surface-50 dark:bg-surface-900 border-t border-[var(--card-border)]
        px-4 py-3 safe-area-bottom">
        <div className="flex justify-around">
          {actions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleAction(id)}
              className="flex flex-col items-center gap-1 text-[var(--muted)]
                hover:text-[var(--foreground)] transition-colors"
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {activeModal === "throw" && (
        <LogThrowModal
          athleteId={athleteId}
          athleteName={athleteName}
          events={events}
          gender={gender}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "video" && (
        <UploadVideoModal
          athleteId={athleteId}
          athleteName={athleteName}
          events={events}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "note" && (
        <AddNoteModal
          athleteId={athleteId}
          athleteName={athleteName}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add the action bar to the athlete detail page**

In `src/app/(dashboard)/coach/athletes/[id]/page.tsx`, import and render the action bar below the athlete header and above the section content. Pass `athleteId`, `athleteName`, `events`, and `gender` as props. Ensure the data fetch includes `gender` if not already present.

- [ ] **Step 3: Verify (will fail on missing modals — that's expected)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: errors about missing `_log-throw-modal`, `_upload-video-modal`, `_add-note-modal` — we'll create those in Tasks 11-13.

- [ ] **Step 4: Commit (partial — modals coming next)**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/_action-bar.tsx" "src/app/(dashboard)/coach/athletes/[id]/page.tsx"
git commit -m "feat: add coach action bar component to athlete detail page"
```

---

### Task 11: Log Throw Modal

**Files:**
- Create: `src/app/(dashboard)/coach/athletes/[id]/_log-throw-modal.tsx`

- [ ] **Step 1: Create the Log Throw modal component**

Create `src/app/(dashboard)/coach/athletes/[id]/_log-throw-modal.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { X, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf";

interface LogThrowModalProps {
  athleteId: string;
  athleteName: string;
  events: string[];
  gender: string | null;
  onClose: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const IMPLEMENT_PRESETS: Record<string, { label: string; kg: number }[]> = {
  SHOT_PUT: [
    { label: "3kg", kg: 3 },
    { label: "4kg", kg: 4 },
    { label: "5kg", kg: 5 },
    { label: "6kg", kg: 6 },
    { label: "7.26kg", kg: 7.26 },
    { label: "8kg", kg: 8 },
    { label: "9kg", kg: 9 },
  ],
  DISCUS: [
    { label: "1kg", kg: 1 },
    { label: "1.5kg", kg: 1.5 },
    { label: "1.75kg", kg: 1.75 },
    { label: "2kg", kg: 2 },
    { label: "2.5kg", kg: 2.5 },
  ],
  HAMMER: [
    { label: "3kg", kg: 3 },
    { label: "4kg", kg: 4 },
    { label: "5kg", kg: 5 },
    { label: "6kg", kg: 6 },
    { label: "7.26kg", kg: 7.26 },
    { label: "8kg", kg: 8 },
    { label: "9kg", kg: 9 },
    { label: "10kg", kg: 10 },
  ],
  JAVELIN: [
    { label: "400g", kg: 0.4 },
    { label: "500g", kg: 0.5 },
    { label: "600g", kg: 0.6 },
    { label: "700g", kg: 0.7 },
    { label: "800g", kg: 0.8 },
  ],
};

export function LogThrowModal({
  athleteId,
  athleteName,
  events,
  gender,
  onClose,
}: LogThrowModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [event, setEvent] = useState(events.length === 1 ? events[0] : "");
  const [implementWeight, setImplementWeight] = useState<number | null>(null);
  const [distance, setDistance] = useState("");
  const [isCompetition, setIsCompetition] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [prDetected, setPrDetected] = useState(false);

  const presets = event ? IMPLEMENT_PRESETS[event] ?? [] : [];

  // For men's hammer, show dual label for 7.26kg
  function getPresetLabel(preset: { label: string; kg: number }) {
    if (event === "HAMMER" && preset.kg === 7.26 && gender === "MALE") {
      return "7.26kg / 16lb";
    }
    if (event === "HAMMER" && preset.kg === 4 && gender === "FEMALE") {
      return "4kg";
    }
    return preset.label;
  }

  async function handleSave(addAnother: boolean) {
    if (!event || implementWeight === null) {
      toastError("Select an event and implement weight");
      return;
    }

    setSaving(true);
    setPrDetected(false);

    try {
      // If video, upload first
      let videoUrl: string | null = null;
      if (videoFile) {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("event", event);
        formData.append("implementWeight", String(implementWeight));
        if (distance) formData.append("distance", distance);

        const uploadRes = await fetch(`/api/coach/athletes/${athleteId}/videos`, {
          method: "POST",
          headers: csrfHeaders(),
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          toastError(uploadData.error || "Video upload failed");
          setSaving(false);
          return;
        }
        videoUrl = uploadData.data.url;
      }

      const body = {
        event,
        implementWeight,
        implementWeightUnit: "kg" as const,
        distance: distance ? parseFloat(distance) : null,
        isCompetition,
        notes: notes || null,
        videoUrl,
      };

      const res = await fetch(`/api/coach/athletes/${athleteId}/throws`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Failed to log throw");
        setSaving(false);
        return;
      }

      if (data.data.isPersonalBest) {
        setPrDetected(true);
        toastSuccess(`New PR! ${distance}m logged for ${athleteName}`);
      } else {
        toastSuccess(`Throw logged for ${athleteName}`);
      }

      if (addAnother) {
        // Clear distance, video, notes — keep event and implement
        setDistance("");
        setNotes("");
        setShowNotes(false);
        setVideoFile(null);
        setPrDetected(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        onClose();
      }
    } catch {
      toastError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full md:max-w-lg bg-surface-50 dark:bg-surface-900
        rounded-t-2xl md:rounded-2xl border border-[var(--card-border)]
        max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="font-heading text-lg font-semibold">Log Throw</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Event selector */}
          {events.length > 1 && (
            <div>
              <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
                Event
              </label>
              <div className="flex flex-wrap gap-2">
                {events.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setEvent(e); setImplementWeight(null); }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors
                      ${event === e
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700"
                      }`}
                  >
                    {EVENT_LABELS[e] || e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Implement weight presets */}
          {event && (
            <div>
              <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
                Implement Weight
              </label>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.kg}
                    onClick={() => setImplementWeight(p.kg)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${implementWeight === p.kg
                        ? "bg-primary-500 text-black"
                        : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700"
                      }`}
                  >
                    {getPresetLabel(p)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Distance */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Distance (m)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="e.g. 55.42"
              className="w-full px-4 py-3 rounded-xl text-lg font-mono
                bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
                text-[var(--foreground)] placeholder:text-[var(--muted)]
                focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Video upload */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Video (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-[var(--muted)]
                file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0
                file:text-sm file:font-medium file:bg-surface-100 file:dark:bg-surface-800
                file:text-[var(--foreground)] file:cursor-pointer"
            />
            {videoFile && (
              <p className="text-xs text-[var(--muted)] mt-1">
                {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)}MB)
              </p>
            )}
          </div>

          {/* Competition toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${isCompetition
                ? "bg-primary-500 border-primary-500"
                : "border-[var(--card-border)] bg-transparent"
              }`}>
              {isCompetition && <Check size={14} className="text-black" strokeWidth={2.5} />}
            </div>
            <span className="text-sm text-[var(--foreground)]">Competition throw</span>
          </label>

          {/* Notes (collapsible) */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {showNotes ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Notes / Cues
          </button>
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cues that worked, observations..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm
                bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
                text-[var(--foreground)] placeholder:text-[var(--muted)]
                focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          )}

          {/* PR indicator */}
          {prDetected && (
            <div className="px-4 py-2 rounded-xl bg-primary-500/10 border border-primary-500/30 text-primary-500 text-sm font-medium text-center">
              New Personal Best!
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="p-4 border-t border-[var(--card-border)] flex gap-3">
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !event || implementWeight === null}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium
              bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]
              hover:bg-surface-200 dark:hover:bg-surface-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save & Add Another
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !event || implementWeight === null}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold
              bg-primary-500 text-black
              hover:bg-primary-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/_log-throw-modal.tsx"
git commit -m "feat: add Log Throw modal with implement presets, video upload, Save & Add Another"
```

---

### Task 12: Upload Video Modal

**Files:**
- Create: `src/app/(dashboard)/coach/athletes/[id]/_upload-video-modal.tsx`

- [ ] **Step 1: Create the Upload Video modal**

Create `src/app/(dashboard)/coach/athletes/[id]/_upload-video-modal.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf";

interface UploadVideoModalProps {
  athleteId: string;
  athleteName: string;
  events: string[];
  onClose: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  SHOT_PUT: "Shot Put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

export function UploadVideoModal({
  athleteId,
  athleteName,
  events,
  onClose,
}: UploadVideoModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [event, setEvent] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!videoFile) {
      toastError("Select a video to upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      if (event) formData.append("event", event);
      if (notes) formData.append("notes", notes);

      const res = await fetch(`/api/coach/athletes/${athleteId}/videos`, {
        method: "POST",
        headers: csrfHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Upload failed");
        return;
      }

      toastSuccess(`Video uploaded for ${athleteName}`);
      onClose();
    } catch {
      toastError("Network error — please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full md:max-w-lg bg-surface-50 dark:bg-surface-900
        rounded-t-2xl md:rounded-2xl border border-[var(--card-border)]
        max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="font-heading text-lg font-semibold">Upload Video</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Video picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-8
              flex flex-col items-center justify-center gap-2 cursor-pointer
              hover:border-primary-500/50 transition-colors"
          >
            <Upload size={32} className="text-[var(--muted)]" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm text-[var(--muted)]">
              {videoFile ? videoFile.name : "Tap to select video from camera roll"}
            </p>
            {videoFile && (
              <p className="text-xs text-[var(--muted)]">
                {(videoFile.size / 1024 / 1024).toFixed(1)}MB
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          {/* Event (optional) */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Event (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => (
                <button
                  key={e}
                  onClick={() => setEvent(event === e ? "" : e)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${event === e
                      ? "bg-primary-500 text-black"
                      : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                >
                  {EVENT_LABELS[e] || e}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Notes / Cues (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked? Cues to remember?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm
                bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
                text-[var(--foreground)] placeholder:text-[var(--muted)]
                focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[var(--card-border)]">
          <button
            onClick={handleUpload}
            disabled={uploading || !videoFile}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold
              bg-primary-500 text-black hover:bg-primary-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/_upload-video-modal.tsx"
git commit -m "feat: add Upload Video modal with event tagging and notes"
```

---

### Task 13: Add Note Modal

**Files:**
- Create: `src/app/(dashboard)/coach/athletes/[id]/_add-note-modal.tsx`

- [ ] **Step 1: Create the Add Note modal**

Create `src/app/(dashboard)/coach/athletes/[id]/_add-note-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { X, Lock, Globe } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf";

interface AddNoteModalProps {
  athleteId: string;
  athleteName: string;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "TECHNICAL", label: "Technical" },
  { value: "MENTAL", label: "Mental" },
  { value: "INJURY", label: "Injury" },
] as const;

export function AddNoteModal({ athleteId, athleteName, onClose }: AddNoteModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!content.trim()) {
      toastError("Note content is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/coach/athletes/${athleteId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ content: content.trim(), category, isPrivate }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toastError(data.error || "Failed to save note");
        return;
      }

      toastSuccess(`Note added for ${athleteName}`);
      onClose();
    } catch {
      toastError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full md:max-w-lg bg-surface-50 dark:bg-surface-900
        rounded-t-2xl md:rounded-2xl border border-[var(--card-border)]
        max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
          <h2 className="font-heading text-lg font-semibold">Add Note</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Notes about ${athleteName}...`}
            rows={5}
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-[var(--foreground)] placeholder:text-[var(--muted)]
              focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />

          {/* Category */}
          <div>
            <label className="text-sm font-semibold text-muted uppercase tracking-wider block mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${category === c.value
                      ? "bg-primary-500 text-black"
                      : "bg-surface-100 dark:bg-surface-800 text-[var(--foreground)]"
                    }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility toggle */}
          <button
            onClick={() => setIsPrivate(!isPrivate)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl
              bg-surface-100 dark:bg-surface-800 border border-[var(--card-border)]
              text-sm transition-colors hover:bg-surface-200 dark:hover:bg-surface-700"
          >
            {isPrivate ? (
              <>
                <Lock size={16} strokeWidth={1.75} className="text-[var(--muted)]" aria-hidden="true" />
                <span className="text-[var(--foreground)]">Private — coach only</span>
              </>
            ) : (
              <>
                <Globe size={16} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />
                <span className="text-[var(--foreground)]">Shared with athlete</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 border-t border-[var(--card-border)]">
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold
              bg-primary-500 text-black hover:bg-primary-400
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify — all modals exist now, should compile clean**

```bash
npx tsc --noEmit
```

Expected: 0 errors (action bar + all 3 modals now exist).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/_add-note-modal.tsx"
git commit -m "feat: add Add Note modal with categories and private/shared visibility"
```

---

## Phase 3: Roster Indicators + Claim Flow

### Task 14: Roster Proxy Profile Indicators

**Files:**
- Modify: `src/lib/data/coach.ts`
- Modify: `src/app/(dashboard)/coach/athletes/_roster-client.tsx`
- Modify: `src/app/(dashboard)/coach/athletes/page.tsx`

- [ ] **Step 1: Add claimedAt to roster query**

In `src/lib/data/coach.ts`, update the `getAthleteRoster` function's select to include the user's `claimedAt`:

Add to the Prisma select inside `getAthleteRoster`:
```typescript
      user: { select: { claimedAt: true } },
```

Add to the return mapping:
```typescript
    claimedAt: a.user?.claimedAt?.toISOString() ?? null,
```

Update the `AthleteRosterItem` type to include:
```typescript
  claimedAt: string | null;
```

- [ ] **Step 2: Update roster client to show proxy indicators**

In `src/app/(dashboard)/coach/athletes/_roster-client.tsx`:

Import the `UserRoundPlus` icon from Lucide:
```typescript
import { UserRoundPlus } from "lucide-react";
```

In the athlete name cell, add a ghost icon for unclaimed profiles:
```tsx
{/* After the athlete name span */}
{!athlete.claimedAt && (
  <span className="ml-1.5 inline-flex" title="Profile managed by coach — not yet claimed by athlete">
    <UserRoundPlus
      size={14}
      strokeWidth={1.75}
      className="text-[var(--muted)] opacity-60"
      aria-hidden="true"
    />
  </span>
)}
```

In the "Last Session" column, show an "Invite" link for unclaimed athletes with no sessions:
```tsx
{!athlete.claimedAt && !athlete.lastSessionDate ? (
  <button
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      // Open invite flow for this athlete — pass athleteProfileId
      setInviteAthleteId(athlete.id);
    }}
    className="text-xs text-primary-500 hover:underline font-medium"
  >
    Invite
  </button>
) : (
  // existing lastSessionDate rendering
)}
```

This requires adding state: `const [inviteAthleteId, setInviteAthleteId] = useState<string | null>(null)` and a small invite modal that POSTs to `/api/invitations` with `athleteProfileId`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/coach.ts "src/app/(dashboard)/coach/athletes/_roster-client.tsx" "src/app/(dashboard)/coach/athletes/page.tsx"
git commit -m "feat: add proxy profile indicators to roster — ghost icon + invite CTA"
```

---

### Task 15: Coach Profile Edit Page

**Files:**
- Create: `src/app/(dashboard)/coach/athletes/[id]/profile/edit/page.tsx`

- [ ] **Step 1: Create the profile edit page**

Create `src/app/(dashboard)/coach/athletes/[id]/profile/edit/page.tsx`:

This is a simplified version of the Master Profile with the most critical sections for coach day-one usage:
1. **Core Info** — name, gender, events, height, weight, class year, DOB, turn direction
2. **Competition PRs** — per-event best distances
3. **Strength Numbers** — key lifts

The page is a Server Component that fetches the athlete profile and passes it to a client form. It should:
- Use `requireCoachSession()` for auth
- Verify ownership with `getAthleteFull(id, coachId)`
- Render a back link to `/coach/athletes/[id]`
- Show a context banner: "Editing [firstName]'s profile"
- Include a client-side form that PATCHes to `/api/coach/athletes/[id]/profile`
- Show read-only lock icons on gated fields if the profile is claimed
- Toast on save success, navigate back to athlete detail

Key layout:
- Sections as collapsible cards (or vertical tabs on desktop)
- Each section saves independently via the same PATCH endpoint
- Use existing form patterns (Tailwind inputs, toggle buttons for enums)

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/coach/athletes/[id]/profile/edit/"
git commit -m "feat: add coach profile edit page (Core Info, Competition PRs, Strength)"
```

---

### Task 16: Athlete Review Profile Page

**Files:**
- Create: `src/app/(dashboard)/athlete/review-profile/page.tsx`
- Create: `src/app/(dashboard)/athlete/review-profile/_review-client.tsx`

- [ ] **Step 1: Create the review profile page (Server Component)**

Create `src/app/(dashboard)/athlete/review-profile/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReviewProfileClient } from "./_review-client";

export default async function ReviewProfilePage() {
  const session = await getSession();
  if (!session || session.role !== "ATHLETE") redirect("/login");

  const profile = await prisma.athleteProfile.findUnique({
    where: { userId: session.userId },
    include: {
      coach: { select: { firstName: true, lastName: true } },
      coachNotes: {
        where: { isPrivate: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      videos: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, url: true, thumbnailUrl: true, event: true, notes: true, createdAt: true },
      },
    },
  });

  if (!profile) notFound();

  // Fetch recent throws
  const recentThrows = await prisma.throwLog.findMany({
    where: { athleteId: profile.id },
    orderBy: { date: "desc" },
    take: 10,
    select: { id: true, event: true, implementWeight: true, distance: true, date: true, isPersonalBest: true },
  });

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 md:py-12 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-heading text-2xl font-bold mb-2">Review Your Profile</h1>
        <p className="text-[var(--muted)] text-sm">
          Your coach {profile.coach.firstName} {profile.coach.lastName} has set up your profile.
          Review the info below and make any corrections.
        </p>
      </div>

      <ReviewProfileClient
        profile={{
          id: profile.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          gender: profile.gender as string,
          events: profile.events as string[],
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          classStanding: profile.classStanding,
          dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
          strengthNumbers: profile.strengthNumbers as Record<string, unknown> | null,
        }}
        recentThrows={recentThrows.map((t) => ({
          ...t,
          event: t.event as string,
          date: t.date.toISOString(),
        }))}
        notes={profile.coachNotes.map((n) => ({
          id: n.id,
          content: n.content,
          category: n.category as string,
          createdAt: n.createdAt.toISOString(),
        }))}
        videos={profile.videos.map((v) => ({
          ...v,
          event: v.event as string | null,
          createdAt: v.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the review client component**

Create `src/app/(dashboard)/athlete/review-profile/_review-client.tsx`:

This client component renders scrollable cards for each data category (Basic Info, Competition PRs, Strength Numbers, Recent Throws, Videos, Coach Notes). Each editable card has a pencil icon that toggles inline editing. The bottom has two buttons:

- **"Looks Good — Let's Go"** (primary): PATCHes `/api/athlete/profile` with `{ completeOnboarding: true }`, then `router.push("/athlete/dashboard")`
- **"I'll Review Later"** (secondary link): same PATCH + redirect

The component should:
- Accept the serialized profile, throws, notes, and videos as props
- Render each section as a card with `bg-surface-50 dark:bg-surface-900` styling
- Show event labels (not enum values) for readability
- Show distances with `font-mono` class
- PR throws get a gold star indicator

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/athlete/review-profile/"
git commit -m "feat: add athlete review profile page for post-claim data review"
```

---

### Task 17: Update Register-Claim Flow

**Files:**
- Modify: `src/app/api/auth/register-claim/route.ts`

- [ ] **Step 1: Update the register-claim response to signal review redirect**

In `src/app/api/auth/register-claim/route.ts`, update the success response to include a `redirectTo` field that the client uses for navigation:

Find the success response and update it to:

```typescript
// Check if profile has enough data to skip onboarding
const hasEvents = profile.events && (profile.events as string[]).length > 0;
const hasGender = profile.gender && profile.gender !== "OTHER";

const redirectTo = hasEvents && hasGender
  ? "/athlete/review-profile"  // Coach populated enough — go to review
  : "/athlete/onboarding";      // Missing basics — run onboarding first

const response = NextResponse.json({
  success: true,
  data: { userId: result.user.id, role: result.user.role, redirectTo },
});
```

- [ ] **Step 2: Update the register page client to use redirectTo**

In the register page's client component (wherever the register-claim response is handled), update the redirect logic:

```typescript
// After successful register-claim
if (data.data.redirectTo) {
  router.push(data.data.redirectTo);
} else {
  router.push("/athlete/onboarding");
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/register-claim/route.ts
git commit -m "feat: route claimed athletes to review page when coach has populated profile"
```

---

## Phase 4: Final Verification

### Task 18: Full Build + Lint Check

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Expected: 0 errors (warnings acceptable).

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Run Prisma generate to verify schema**

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Manual smoke test checklist**

Test these flows locally:
- [ ] Coach creates a proxy athlete (name, gender, events) via Add Athlete modal
- [ ] Coach sees new athlete on roster with ghost icon
- [ ] Coach navigates to athlete detail → action bar visible
- [ ] Coach logs a throw via Log Throw modal (with and without video)
- [ ] Coach uploads a standalone video via Upload Video modal
- [ ] Coach adds a note (shared + private) via Add Note modal
- [ ] Coach edits profile via Edit Profile page
- [ ] Coach generates invite link for unclaimed athlete
- [ ] Athlete claims profile via invite link
- [ ] Athlete sees Review Profile page with coach's data
- [ ] Athlete taps "Looks Good" → lands on dashboard with all data intact
- [ ] On roster, ghost icon disappears after athlete claims

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during proxy profiles smoke test"
```
