# Advanced Roster Management System — Design Spec

**Date:** 2026-04-02
**Priority:** P1 — core infrastructure for scaling beyond 10 athletes
**Benchmark:** Teamworks-level roster management, specialized for throws coaching
**Approach:** Progressive Enhancement (3 phases, each ships independently)

---

## Overview

A comprehensive roster management system that handles athlete availability, practice scheduling, attendance tracking, smart organization, and a shared team hub. Designed mobile-first for coaches at the ring and athletes in their dorm.

### Phases

| Phase | Scope | Standalone Value |
|-------|-------|-----------------|
| **1: Availability + Smart Org** | Athletes submit rolling availability, coach sees conflict views, smart roster filters | Coach knows who's available when — can plan manually |
| **2: Practice Scheduling + Attendance** | Coach creates practice calendar, auto-conflict detection, tap-to-mark attendance | Structured practice management replaces text threads |
| **3: Team Hub** | Shared portal with announcements, links, files, calendar, personalized athlete view | Single source of truth for team communication |

---

## Phase 1: Availability + Smart Organization

### 1.1 Athlete Availability Entry

**UI Pattern:** Block List — athletes add structured time blocks with day, time range, and label.

**Athlete-facing page:** `/athlete/availability`

The athlete sees a list of their current availability blocks with an "Add Time Block" button. Each block specifies:
- **Days:** Multi-select (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- **Time range:** Start time + end time (30-min increments, 6am–10pm)
- **Type:** AVAILABLE | UNAVAILABLE | CONDITIONAL
- **Label:** Free text (e.g., "Class", "Work", "Study Hall", "Open")
- **Notes:** Optional, shown for CONDITIONAL type (e.g., "Can come if practice starts before 3pm")

Athletes can edit or delete any block. Changes take effect immediately — no submission/approval cycle.

**Temporary overrides:** Athletes can add date-specific overrides that supersede their weekly baseline. Override entry:
- **Date:** Single date picker
- **Time range:** Optional (null = whole day)
- **Type:** AVAILABLE | UNAVAILABLE
- **Reason:** Free text (e.g., "Doctor's appointment", "Can come early this week")
- **Auto-expire:** Override automatically becomes irrelevant after the date passes

Overrides display in a separate "Upcoming Changes" section above the regular blocks. Past overrides are hidden.

### 1.2 Coach Availability View

**Coach-facing page:** `/coach/availability`

The coach sees a **team-wide availability summary** with two views:

**Default view — Best Windows:** A ranked list of time windows with availability percentages:
- "MWF 3:00–5:00 PM — 94% available (17/18 athletes)"
- "T/Th 2:30–5:00 PM — 83% available (15/18 athletes)"
- "Sat 10:00 AM–12:00 PM — 67% available (12/18 athletes)"

Computed by: (1) expand each athlete's AVAILABLE blocks into 30-min slots for each day of the week, (2) for each day+slot, count how many athletes are available (excluding UNAVAILABLE blocks, applying overrides for the current/next week), (3) group consecutive slots with the same available count into windows, (4) rank by athlete count descending. Shows the top 10 windows with ≥50% team availability.

**Drill-down view:** Click any window to see exactly who's available and who has conflicts:
- Available athletes (green list)
- Conflicting athletes with reason (red list, e.g., "K. Thompson — Work 4-6pm")
- Conditional athletes with notes (amber list)

**Filter by event group:** Coach can filter availability to a specific event group (e.g., "Shot Put group" — only show those athletes' availability).

**Conflict alerts:** When any athlete updates their availability, if it conflicts with an already-scheduled practice, the coach sees a notification: "J. Rodriguez updated availability — conflicts with Mon 3-5pm practice."

### 1.3 Smart Roster Filters

Enhancement to the existing `/coach/athletes` page — add filter bar with:
- **Event:** SHOT_PUT | DISCUS | HAMMER | JAVELIN (multi-select)
- **Gender:** MALE | FEMALE
- **Class year:** FR | SO | JR | SR | GRAD | PRO (from AthleteProfile.classStanding)
- **Event group:** Existing EventGroup memberships
- **Availability status:** Has submitted availability | No availability on file

Filters are combinable (e.g., "Shot Put + Female + Juniors"). Filter state persists in URL search params for shareability.

No new data model needed — these are UI-only filters on existing AthleteProfile fields.

---

## Phase 2: Practice Scheduling + Attendance

### 2.1 Practice Creation

**Coach-facing page:** `/coach/practices`

**Default view — List + Conflict Sidebar:** Practice list showing this week's scheduled practices. Each card shows:
- Date, time, title
- Location (free text)
- Athlete count with conflict breakdown (✓ 16 attending, ✗ 2 conflicts)
- Event group assignment (optional — all athletes or specific group)

**Conflict sidebar** (collapses to expandable section on mobile):
- Athletes with known conflicts for each practice (pulled from availability data)
- "Best Windows" summary for the current week

**Creating a practice:**
- Title (e.g., "SP — Technique Day")
- Date + start/end time
- Location (free text, with autocomplete from previous entries)
- Target: All athletes | Specific event group
- Recurring: Optional — "Repeat weekly until [date]"
- Notes

On save, the system checks athlete availability and shows a conflict preview: "3 athletes have conflicts during this time: [names]. Create anyway?"

**Recurring practices:** Create-once, auto-generate practice entries for each week. Each instance can be individually edited or cancelled without affecting the series. Title, time, and location carry forward; each instance gets its own attendance record.

### 2.2 Attendance Marking

**UI Pattern:** Tap-to-Cycle List (mobile-optimized)

**Coach opens a practice → "Take Attendance" view:**

The screen shows:
- Practice header (title, date, time, location)
- Progress bar: "12/18 marked"
- "Mark All Present" bulk action button at top
- Athlete list sorted: unmarked first, then by status

Each athlete card shows:
- Avatar + name
- Event badge
- Conflict warning if applicable (e.g., "⚠ Work 4-6pm")
- Current status with color-coded background

**Tap interaction:** Single tap cycles through: Unmarked → Present (green) → Late (amber) → Absent (red) → Excused (blue) → Unmarked. Color change is immediate with a subtle spring animation.

**Long-press** on any athlete opens a notes field (e.g., "Had class until 3:15, arrived at 3:20").

**"Mark All Present" flow:** Tapping this sets all unmarked athletes to Present. Coach then fixes the exceptions (tap athletes who are late/absent/excused). This is the fastest path for the common case where 80%+ of athletes are present.

**Auto-save:** Attendance saves automatically as the coach marks each athlete (debounced 2s). No explicit save button needed. Status persists across page refreshes.

### 2.3 Attendance Analytics

Added to the existing athlete detail page (`/coach/athletes/[id]`) as data in the Overview section:

- **Attendance rate:** Percentage of practices attended (Present + Late) out of total
- **Streak:** Current consecutive practices attended
- **Breakdown:** Present / Late / Absent / Excused counts for the current period

Added to the coach dashboard as a team-level stat:
- "Team Attendance: 91% this week"
- Flagged athletes: anyone below 75% attendance in the last 30 days

---

## Phase 3: Team Hub

### 3.1 Hub Page

**Shared page:** `/coach/hub` (coach) and `/athlete/hub` (athlete) — same layout, personalized content.

**UI Pattern:** Vertical Feed — single scrollable page with sections.

**Sections (top to bottom):**

1. **Pinned Announcements** — Urgent/pinned announcements with gold accent. Coach creates, targets ALL or specific event group. Shows title, body, timestamp, author. Expire date optional (auto-archives after date).

2. **Quick Links** — Horizontal scrollable row of icon+label pills. Coach manages (add/edit/reorder/delete). Categories: Facilities, Compliance, Training, Other. Examples: Weight Room Schedule, Facility Map, AT Forms, Team Handbook.

3. **Coming Up** — Personalized timeline of next 5 upcoming items:
   - Practices (with conflict warnings for athletes)
   - Competitions (from ThrowsCompetition)
   - Questionnaire deadlines
   Shows date, title, time, and relevant metadata.

4. **Team Files** — Recent files uploaded by coach. Name, type icon, size. Tap to download. Coach manages via upload/delete. Stored in Cloudflare R2 (existing infrastructure).

5. **Recent Announcements** — Non-pinned announcements in reverse chronological order. Normal priority, no gold accent.

### 3.2 Announcements

Coach creates announcements from the hub page or from a "New Announcement" button:
- **Title:** Required
- **Body:** Markdown-lite text (bold, links, lists)
- **Priority:** NORMAL | URGENT
- **Target:** ALL | specific EventGroup | individual athlete
- **Pin:** Toggle (pinned items stay at top until unpinned)
- **Expires:** Optional date (auto-archives, removed from feed)

Athletes see announcements targeted to ALL, their event group(s), or themselves individually. They do not see announcements targeted to other groups.

### 3.3 Quick Links

Coach manages from a settings panel:
- Add link: title + URL + category + icon (emoji picker or Lucide icon name)
- Reorder via drag (or move up/down buttons on mobile)
- Delete link
- Maximum 12 links displayed (scroll for more)

### 3.4 Team Files

Coach uploads files (PDF, XLSX, DOCX, images) up to 25MB each:
- Stored in Cloudflare R2 (existing `R2_BUCKET` infrastructure)
- File metadata in `TeamFile` model
- Optional category for organization
- Athletes can view/download but not upload or delete

---

## Data Model

### New Models

```prisma
model AthleteAvailability {
  id        String         @id @default(cuid())
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  dayOfWeek Int            // 0=Sunday...6=Saturday
  startTime String         // "14:00"
  endTime   String         // "17:30"
  type      String         // AVAILABLE | UNAVAILABLE | CONDITIONAL
  label     String?        // "Class", "Work", "Open"
  notes     String?
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@index([athleteId, dayOfWeek])
}

model AvailabilityOverride {
  id        String         @id @default(cuid())
  athleteId String
  athlete   AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date      String         // "2026-04-15"
  startTime String?        // null = whole day
  endTime   String?
  type      String         // AVAILABLE | UNAVAILABLE
  reason    String?
  createdAt DateTime       @default(now())

  @@index([athleteId, date])
}

model Practice {
  id         String              @id @default(cuid())
  coachId    String
  coach      CoachProfile        @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title      String
  date       String              // "2026-04-15"
  startTime  String              // "15:00"
  endTime    String              // "17:00"
  location   String?
  notes      String?
  status     String              @default("SCHEDULED") // SCHEDULED | CANCELLED | COMPLETED
  groupId    String?             // null = all athletes
  group      EventGroup?         @relation(fields: [groupId], references: [id])
  recurringId String?            // links instances of the same recurring series
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  attendance PracticeAttendance[]

  @@index([coachId, date])
}

model PracticeAttendance {
  id         String         @id @default(cuid())
  practiceId String
  practice   Practice       @relation(fields: [practiceId], references: [id], onDelete: Cascade)
  athleteId  String
  athlete    AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  status     String         // PRESENT | ABSENT | EXCUSED | LATE
  markedBy   String         // coachId
  markedAt   DateTime       @default(now())
  notes      String?

  @@unique([practiceId, athleteId])
}

model TeamLink {
  id        String       @id @default(cuid())
  coachId   String
  coach     CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title     String
  url       String
  category  String?
  icon      String?      // emoji or lucide icon name
  pinned    Boolean      @default(false)
  order     Int          @default(0)
  createdAt DateTime     @default(now())

  @@index([coachId])
}

model TeamFile {
  id        String       @id @default(cuid())
  coachId   String
  coach     CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name      String
  fileUrl   String
  fileSize  Int
  mimeType  String
  category  String?
  createdAt DateTime     @default(now())

  @@index([coachId])
}

model TeamAnnouncement {
  id         String       @id @default(cuid())
  coachId    String
  coach      CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title      String
  body       String
  priority   String       @default("NORMAL") // NORMAL | URGENT
  pinned     Boolean      @default(false)
  targetType String       @default("ALL") // ALL | GROUP | INDIVIDUAL
  targetId   String?      // groupId or athleteId
  expiresAt  DateTime?
  createdAt  DateTime     @default(now())

  @@index([coachId, createdAt])
}
```

### Modified Models

**AthleteProfile** — No schema changes. Smart filters use existing fields (`events`, `gender`, `classStanding`).

**EventGroup** — Add `Practice[]` relation (practices can target a specific group).

---

## API Endpoints

### Phase 1

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/athlete/availability` | Get current athlete's blocks + overrides |
| POST | `/api/athlete/availability` | Add availability block |
| PATCH | `/api/athlete/availability/[id]` | Update block |
| DELETE | `/api/athlete/availability/[id]` | Delete block |
| POST | `/api/athlete/availability/overrides` | Add date override |
| DELETE | `/api/athlete/availability/overrides/[id]` | Delete override |
| GET | `/api/coach/availability` | Team-wide availability summary + best windows |
| GET | `/api/coach/availability/[athleteId]` | Single athlete's availability |

### Phase 2

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/coach/practices` | List practices (with filters) |
| POST | `/api/coach/practices` | Create practice (+ recurring) |
| PATCH | `/api/coach/practices/[id]` | Update practice |
| DELETE | `/api/coach/practices/[id]` | Cancel/delete practice |
| GET | `/api/coach/practices/[id]/attendance` | Get attendance for practice |
| PATCH | `/api/coach/practices/[id]/attendance` | Batch update attendance statuses |

### Phase 3

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/team/hub` | Hub data (announcements, links, files, upcoming) |
| POST | `/api/team/announcements` | Create announcement |
| PATCH | `/api/team/announcements/[id]` | Update/pin/unpin |
| DELETE | `/api/team/announcements/[id]` | Delete announcement |
| GET | `/api/team/links` | List links |
| POST | `/api/team/links` | Add link |
| PATCH | `/api/team/links/[id]` | Update link |
| DELETE | `/api/team/links/[id]` | Delete link |
| POST | `/api/team/links/reorder` | Reorder links |
| GET | `/api/team/files` | List files |
| POST | `/api/team/files/upload-url` | Get R2 presigned upload URL |
| DELETE | `/api/team/files/[id]` | Delete file |

---

## Pages

### Phase 1
| Path | Type | Description |
|------|------|-------------|
| `/athlete/availability` | Client | Block list entry + overrides for athlete |
| `/coach/availability` | Server + Client | Team availability summary, best windows, conflict drill-down |

### Phase 2
| Path | Type | Description |
|------|------|-------------|
| `/coach/practices` | Server + Client | Practice list with conflict sidebar |
| `/coach/practices/new` | Client | Create practice form |
| `/coach/practices/[id]` | Server + Client | Practice detail + attendance marking |
| `/coach/practices/[id]/attendance` | Client | Full-screen tap-to-cycle attendance view (mobile-optimized) |

### Phase 3
| Path | Type | Description |
|------|------|-------------|
| `/coach/hub` | Server + Client | Team hub feed (coach view — can manage content) |
| `/athlete/hub` | Server + Client | Team hub feed (athlete view — read-only + personalized) |

---

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Progressive Enhancement (3 phases) | Each phase ships standalone value; build in dependency order |
| Availability input | Block List (not grid) | Cleaner on mobile, more precise for time ranges |
| Academic periods | Rolling (no periods) | Training runs through semesters; athletes update as needed |
| Coach scheduling view | List + Conflict Sidebar (not calendar) | Mobile-first; lists stack naturally; sidebar collapses on small screens |
| Attendance marking | Tap-to-Cycle (not explicit buttons) | Faster for common case; "Mark All Present" handles 80%+ scenario |
| Team Hub layout | Vertical Feed (not tabs) | Optimizes for "open and scan"; everything one scroll away |
| Mobile priority | Mobile-first all screens | Coaches at the ring, athletes in dorm — phone is primary device |

---

## Out of Scope (Future)

- Communication hub (DMs, group messages) — use existing notification system
- Travel/meet logistics (bus lists, hotels)
- Academic integration (GPA tracking, class imports)
- CSV roster import/export
- Calendar view toggle for practice scheduling (desktop enhancement)
- Push notifications for announcements
