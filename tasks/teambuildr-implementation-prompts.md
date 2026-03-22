# Podium Throws — TeamBuildr Feature Parity + Improvement Prompts

> **Priority-ordered implementation prompts for Claude Code.**
> Each prompt is self-contained. Feed one at a time. They reference the existing schema and codebase.

---

## PROMPT 1: Event Groups & Trickle-Down Programming System

```
TASK: Build the Event Groups and Trickle-Down Programming system — the #1 feature that makes Podium Throws viable for team coaches managing 10-30+ athletes.

CONTEXT: TeamBuildr's killer feature is 3-tier programming: Team Calendar → Position Group → Individual. A coach writes ONE workout at the team level, it "trickles down" to all sub-groups, then they override per-group or per-individual. We need this for throws, but BETTER — with Bondarchuk-aware validation.

WHAT TO BUILD:

### 1. Database Schema Changes (prisma/schema.prisma)

Add an `EventGroup` model that creates hierarchical groupings:

```prisma
model EventGroup {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name        String       // e.g. "Shot/Disc Group", "Hammer Squad", "Javelin", "Multi-Event"
  description String?
  events      EventType[]  // Which events this group covers
  color       String?      // For calendar display
  order       Int          @default(0)

  members     EventGroupMember[]
  sessions    GroupSession[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([coachId])
}

model EventGroupMember {
  id           String         @id @default(cuid())
  groupId      String
  group        EventGroup     @relation(fields: [groupId], references: [id], onDelete: Cascade)
  athleteId    String
  athlete      AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([groupId, athleteId])
  @@index([groupId])
  @@index([athleteId])
}
```

Add a `GroupSession` model for the trickle-down sessions:

```prisma
model GroupSession {
  id            String       @id @default(cuid())
  coachId       String
  coach         CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title         String
  scheduledDate DateTime
  notes         String?

  // Tier system
  tier          String       // "TEAM" | "GROUP" | "INDIVIDUAL"
  groupId       String?      // null = team-wide session
  group         EventGroup?  @relation(fields: [groupId], references: [id], onDelete: SetNull)
  athleteId     String?      // non-null only for individual overrides
  parentId      String?      // points to the TEAM or GROUP session this overrides
  parent        GroupSession? @relation("SessionOverrides", fields: [parentId], references: [id], onDelete: Cascade)
  overrides     GroupSession[] @relation("SessionOverrides")

  // Session content (same block structure as existing WorkoutPlan)
  blocks        GroupSessionBlock[]

  // Status tracking
  status        String       @default("DRAFT") // DRAFT | PUBLISHED | ARCHIVED
  publishedAt   DateTime?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([coachId, scheduledDate])
  @@index([groupId])
  @@index([athleteId])
  @@index([parentId])
  @@index([tier])
}

model GroupSessionBlock {
  id            String       @id @default(cuid())
  sessionId     String
  session       GroupSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name          String       // "Throwing Block 1", "Strength Block"
  blockType     String       // "throwing" | "strength" | "warmup" | "cooldown"
  order         Int
  restSeconds   Int?
  notes         String?

  exercises     GroupSessionExercise[]

  @@index([sessionId])
}

model GroupSessionExercise {
  id            String            @id @default(cuid())
  blockId       String
  block         GroupSessionBlock @relation(fields: [blockId], references: [id], onDelete: Cascade)
  exerciseName  String            // Denormalized for flexibility
  exerciseId    String?           // Optional link to Exercise model
  order         Int
  sets          Int?
  reps          String?           // "3" or "3-5" or "AMRAP"
  weight        String?           // "80kg" or "75%" or "competition"
  rpe           Float?
  implementKg   Float?
  distance      String?
  restSeconds   Int?
  notes         String?

  @@index([blockId])
}
```

Also add to CoachProfile:
```prisma
  eventGroups    EventGroup[]
  groupSessions  GroupSession[]
```

And to AthleteProfile:
```prisma
  eventGroupMemberships EventGroupMember[]
```

### 2. API Routes

Create these API routes:

**Event Groups CRUD:**
- `POST /api/coach/event-groups` — Create event group
- `GET /api/coach/event-groups` — List all groups with member counts
- `PUT /api/coach/event-groups/[id]` — Update group
- `DELETE /api/coach/event-groups/[id]` — Delete group
- `POST /api/coach/event-groups/[id]/members` — Add athletes to group
- `DELETE /api/coach/event-groups/[id]/members/[athleteId]` — Remove athlete

**Group Sessions (Trickle-Down):**
- `POST /api/coach/group-sessions` — Create team-level session
- `GET /api/coach/group-sessions?date=YYYY-MM-DD&range=week` — Get sessions for date range
- `PUT /api/coach/group-sessions/[id]` — Update session
- `POST /api/coach/group-sessions/[id]/override` — Create group or individual override
- `GET /api/coach/group-sessions/[id]/effective/[athleteId]` — Get the effective session for a specific athlete (resolves inheritance: individual > group > team)
- `POST /api/coach/group-sessions/[id]/publish` — Publish session (makes it visible to athletes)

**Resolution Logic (CRITICAL):**
When an athlete views their session for a given date, the API must resolve:
1. Check for an INDIVIDUAL override for this athlete → use it if exists
2. Check for a GROUP override for this athlete's event group → use it if exists
3. Fall back to the TEAM-level session

This is the "trickle-down" — the most specific tier wins.

### 3. Bondarchuk Validation (CRITICAL)

Every time a session is saved or published, validate:
- Implement weights within throwing blocks are in DESCENDING order (heavy → light). Flag violations with a warning.
- No two consecutive throwing blocks without a strength block between them.
- Paired implements differing by >15-20% from competition weight get flagged.
- Light implements (under comp weight) NEVER appear before heavy implements in the same session.

Create a utility at `src/lib/validation/bondarchuk-session-validator.ts` that returns an array of warnings/errors. Display these in the UI as amber warning banners when saving.

### 4. UI Pages

**Coach Event Groups page** at `src/app/(dashboard)/coach/event-groups/page.tsx`:
- Grid of event group cards (card-interactive class)
- Each card shows: group name, member count, events covered, color dot
- Click to manage members (drag-and-drop or checkbox list of roster athletes)
- "Create Group" button opens a modal

**Coach Group Programming page** at `src/app/(dashboard)/coach/programming/page.tsx`:
- Weekly calendar view (Mon-Sun) showing all sessions
- Tabs at top for: "All Athletes" | each EventGroup name | "Individuals"
- Color-coded session blocks by tier (team = blue, group = amber, individual = green)
- Click a day → session builder sidebar slides in
- Session builder has the block structure: Add Block → Add Exercise within block
- "Override for group" and "Override for individual" buttons on each team session
- Visual indicator showing which sessions are inherited vs overridden
- Bondarchuk validation warnings appear inline as you build

**Athlete Calendar page update** at `src/app/(dashboard)/athlete/calendar/page.tsx`:
- Show the resolved/effective session for each day (after trickle-down resolution)
- Athlete sees their personalized session, not the raw team template
- "Log Session" button on each day to start tracking

### 5. Design System Compliance
- All navigable cards use `card-interactive` class
- Icons from Lucide React with strokeWidth={1.75}
- Use existing color tokens (var(--card-bg), etc.)
- Use AnimatedNumber for any stat displays
- StaggeredList for card grids
- Tabs component for the tier filter
- Mobile-first responsive design

### 6. Migration
Run `npm run db:migrate` with name "add-event-groups-and-trickle-down-programming"

IMPORTANT: This is the foundational system. Leaderboards, team feed, attendance — everything builds on top of event groups. Get this right.
```

---

## PROMPT 2: Ring-Side Display Mode (Weight Room / Practice View)

```
TASK: Build a dedicated "Ring-Side Display Mode" — a full-screen, large-font display designed for tablets or TVs at the training facility, where multiple athletes can view and log their sessions from a shared screen.

CONTEXT: TeamBuildr has "Weight Room View" where a tablet displays workouts and multiple athletes train off one screen. For throws, this means a screen at the throwing ring or weight room. This needs to be optimized for glanceability from 10+ feet away and quick data entry between throws.

WHAT TO BUILD:

### 1. New Route: `/coach/display-mode`

This is a special full-screen page with NO sidebar navigation. It should have:

**Header bar (always visible):**
- Current date and time (live clock)
- Session title
- "Exit Display Mode" button (returns to normal coach dashboard)
- WiFi/connection status indicator
- Number of active athletes

**Main content area — 3 modes selectable via large tab buttons:**

#### Mode 1: Session View
- Shows today's prescribed session in LARGE font (minimum 24px body, 36px headings)
- Block structure clearly visible: "THROWING BLOCK 1" → exercises listed → "STRENGTH BLOCK" → exercises
- Implement weights shown prominently with color coding (heavy = red-amber, comp = green, light = blue)
- Current block highlighted, completed blocks dimmed
- Bondarchuk sequencing shown visually (descending arrow icon between implement weights)

#### Mode 2: Quick Log
- Grid of athlete avatars/names (large touch targets, minimum 64x64px)
- Tap an athlete → see their current exercise in the session
- Quick-entry fields: distance (large number pad), RPE (slider), implement weight (pre-filled from session)
- "Next Throw" button advances attempt number
- "Complete Set" / "Next Exercise" navigation
- Rest timer starts automatically between sets (uses existing RestTimer component if available, or build one)
- Shows real-time throw count: "Throw 14 of 30 prescribed"

#### Mode 3: Throw Queue
- For team sessions where 6-8 athletes share 1-2 rings
- Ordered list of who's up next
- Large "THROWING NOW" display at top with current athlete name
- "Done" button advances queue to next athlete
- Athletes can join/leave the queue
- Shows implement currently in use per ring
- Optional: split view for 2 rings side by side

**Shared features across all modes:**
- Plate calculator overlay (button in corner) — shows barbell loading for strength exercises
- Rest timer overlay — large countdown timer visible from across the room
- Auto-dim after 5 min inactivity, wake on touch
- Landscape orientation optimized
- Dark theme by default (reduces glare in indoor facilities)

### 2. API Routes

- `GET /api/coach/display-mode/today` — Get today's effective sessions for all athletes (resolved via trickle-down)
- `POST /api/coach/display-mode/quick-log` — Quick-log a throw or set (minimal payload: athleteId, exerciseName, value, type)
- `GET /api/coach/display-mode/queue/[sessionId]` — Get current throw queue state
- `POST /api/coach/display-mode/queue/[sessionId]/advance` — Move to next athlete in queue
- `POST /api/coach/display-mode/queue/[sessionId]/join` — Athlete joins queue

### 3. Design Considerations

- This page opts out of the standard dashboard layout (no sidebar)
- Use CSS `@media (min-width: 1024px) and (orientation: landscape)` as primary target
- All touch targets minimum 48x48px (ideally 64x64 for glove-wearing coaches)
- High contrast colors — this will be viewed in bright outdoor or fluorescent-lit indoor environments
- Font weights: bold for data, regular for labels
- Use the existing dark theme tokens but increase contrast
- AnimatedNumber for all distance/count displays
- NumberFlow for the rest timer countdown and live throw count

### 4. Access Control
- Only coaches can enter display mode
- Quick-log entries are attributed to the coach who submitted them
- Athletes can view the session display but cannot edit other athletes' data

### 5. No new dependencies. Use existing Tailwind, Lucide icons, and custom components.
```

---

## PROMPT 3: Live Team Feed & Activity Stream

```
TASK: Build a real-time team activity feed that shows training activity, PRs, milestones, and coach announcements — visible to both coaches and athletes.

CONTEXT: TeamBuildr has a "Team Feed" (like a Facebook feed for the team) and a "TV Mode" that displays PRs on a weight room TV. We need both, tailored for throws.

WHAT TO BUILD:

### 1. Database Schema

```prisma
model FeedEvent {
  id          String       @id @default(cuid())
  coachId     String       // Which coach's team this belongs to
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)

  // Event details
  type        String       // "PR" | "SESSION_COMPLETE" | "GOAL_ACHIEVED" | "STREAK" | "ANNOUNCEMENT" | "MILESTONE" | "READINESS_ALERT"
  title       String
  description String?

  // Actor (who triggered the event)
  actorId     String?      // athleteId or coachId
  actorName   String       // Denormalized for display
  actorRole   String       // "COACH" | "ATHLETE"
  actorAvatar String?

  // Event-specific data (JSON for flexibility)
  metadata    Json?        // { event: "SHOT_PUT", distance: 18.42, implement: "7.26kg", previousBest: 18.01, ... }

  // Engagement
  celebrationCount Int     @default(0) // 🎉 reactions

  // Visibility
  visibility  String       @default("TEAM") // "TEAM" | "GROUP" | "COACHES_ONLY"
  groupId     String?      // If GROUP visibility, which group
  pinned      Boolean      @default(false)

  createdAt   DateTime     @default(now())

  @@index([coachId, createdAt(sort: Desc)])
  @@index([coachId, type])
  @@index([coachId, pinned])
}

model FeedReaction {
  id          String    @id @default(cuid())
  eventId     String
  event       FeedEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  userId      String
  emoji       String    @default("🎉") // Support: 🎉 🔥 💪 👏

  createdAt   DateTime  @default(now())

  @@unique([eventId, userId])
  @@index([eventId])
}
```

Add relations to CoachProfile: `feedEvents FeedEvent[]`

### 2. Auto-Generation of Feed Events

Create a service at `src/lib/services/feed-service.ts` with functions:

- `createPREvent(coachId, athleteId, event, distance, implement, previousBest)` — Called whenever a new PR is detected during session logging
- `createSessionCompleteEvent(coachId, athleteId, sessionSummary)` — Called when athlete completes a session
- `createGoalAchievedEvent(coachId, athleteId, goal)` — Called when a goal target is reached
- `createStreakEvent(coachId, athleteId, streakLength)` — Called at streak milestones (7, 14, 30, 60, 90 days)
- `createAnnouncementEvent(coachId, title, description)` — Coach manually posts
- `createReadinessAlertEvent(coachId, athleteId, score)` — When readiness drops below coach's threshold (coaches-only visibility)

Integrate these into existing flows:
- Hook into the throw logging API (`/api/athlete/throws`, `/api/athlete/log-session`) to detect PRs and session completions
- Hook into goal status updates
- Hook into readiness check-in submission

### 3. API Routes

- `GET /api/feed?cursor=&limit=20` — Paginated feed (infinite scroll)
- `POST /api/feed/announcement` — Coach posts announcement
- `POST /api/feed/[id]/react` — Add reaction (toggle)
- `PUT /api/feed/[id]/pin` — Pin/unpin (coach only)
- `GET /api/feed/stats/today` — Today's stats: total PRs, sessions completed, team avg readiness

### 4. UI Pages

**Team Feed page** at `src/app/(dashboard)/coach/feed/page.tsx` AND `src/app/(dashboard)/athlete/feed/page.tsx`:

- Infinite-scroll feed of FeedEvent cards
- Each card shows: actor avatar + name, event description, timestamp, metadata (distance, event, implement)
- PR cards get the celebration styling (amber/gold gradient, trophy icon) — use the existing `celebration` toast pattern but as a card
- Reaction bar at bottom of each card (🎉 🔥 💪 👏 with counts)
- Coach can pin announcements (pinned items stay at top)
- Filter tabs: "All" | "PRs" | "Sessions" | "Announcements"
- Coaches see a "Post Announcement" button at top (textarea + send)
- Athletes see readiness alerts filtered out (coaches-only items hidden)

**TV Mode** at `src/app/(dashboard)/coach/tv-mode/page.tsx`:

- Full-screen, no navigation, dark background
- Auto-refreshes every 30 seconds
- Large display showing:
  - "TODAY'S PRs" section with celebration animations
  - Running PR counter for the day (AnimatedNumber)
  - Most recent session completions
  - Optional: rotating athlete highlights
- When a new PR comes in, play the PRCelebration-style animation full screen
- Show team logo/name at top
- "Exit TV Mode" button (small, corner)

### 5. Design Rules
- Feed cards: use `card` class (not interactive unless they link to detail)
- PR cards: amber/gold left border accent, trophy icon from Lucide
- Session cards: green left border, check-circle icon
- Announcement cards: blue left border, megaphone icon
- StaggeredList for the feed
- AnimatedNumber for the PR counter and stats
- Celebration toast fires automatically when a PR card enters viewport (once per card)
- Respect prefers-reduced-motion

### 6. Migration
Run `npm run db:migrate` with name "add-team-feed-and-reactions"
```

---

## PROMPT 4: Leaderboards System

```
TASK: Build a comprehensive leaderboard system for throws athletes, filterable by event, implement weight, time period, and event group.

CONTEXT: TeamBuildr generates leaderboards by group, exercise, and time frame and puts them on TVs. Our version is throws-specific and should include Bondarchuk-aware metrics like improvement rate and consistency.

WHAT TO BUILD:

### 1. No new schema needed — leaderboards are computed views on existing data (ThrowLog, ThrowsPR, AthleteProfile).

### 2. API Routes

`GET /api/coach/leaderboards` with query params:
- `event` (required): SHOT_PUT | DISCUS | HAMMER | JAVELIN
- `implementKg` (optional): filter to specific implement weight
- `period`: "all_time" | "season" | "30d" | "7d" | "custom"
- `startDate` / `endDate`: for custom period
- `groupId` (optional): filter to event group
- `metric`: "best_distance" | "avg_distance" | "improvement_rate" | "consistency" | "volume" | "relative_strength"
- `gender` (optional): MALE | FEMALE
- `limit`: default 25

Response shape:
```json
{
  "leaderboard": [
    {
      "rank": 1,
      "athleteId": "...",
      "athleteName": "Zach Lewis",
      "avatarUrl": "...",
      "value": 18.42,
      "unit": "m",
      "metric": "best_distance",
      "event": "SHOT_PUT",
      "implementKg": 7.26,
      "date": "2026-03-15",
      "previousRank": 2,
      "trend": "up",
      "delta": 0.31
    }
  ],
  "athleteCount": 24,
  "period": { "start": "...", "end": "..." }
}
```

Metric calculations:
- `best_distance`: MAX(distance) from ThrowLog for the period
- `avg_distance`: AVG of top 5 throws in the period (avoids skew from warm-up throws)
- `improvement_rate`: (best in last 30 days - best in prior 30 days) / best in prior 30 days × 100
- `consistency`: 1 - (stddev of top 10 throws / mean of top 10 throws) — higher = more consistent
- `volume`: COUNT of throws logged in the period
- `relative_strength`: best distance / bodyweight ratio

### 3. UI Pages

**Leaderboard page** at `src/app/(dashboard)/coach/leaderboards/page.tsx`:

- Filter bar at top: Event selector (4 events) | Implement weight dropdown | Period selector | Group filter | Metric selector
- Leaderboard table with:
  - Rank column (#1, #2, #3 with gold/silver/bronze styling for top 3)
  - Athlete avatar + name
  - Value (AnimatedNumber with appropriate decimals)
  - Date achieved
  - Trend arrow (up/down/same vs previous period)
  - Delta from previous period
- Top 3 podium display above the table (3 cards with larger avatars, slightly elevated #1)
- "View on TV" button → opens leaderboard in full-screen TV-optimized layout

**Athlete leaderboard view** at `src/app/(dashboard)/athlete/leaderboards/page.tsx`:
- Same leaderboard but the current athlete's row is highlighted/pinned
- Shows "Your Rank: #X of Y" prominently
- Can only see leaderboards for their coach's roster

**TV Leaderboard** at `src/app/(dashboard)/coach/leaderboards/tv/page.tsx`:
- Full-screen dark theme, large fonts
- Up to 3 leaderboards side-by-side (like TeamBuildr)
- Auto-refreshes every 60 seconds
- Animated rank changes when data updates

### 4. Design
- Top 3 podium cards use card-interactive class with gold (#F59E0B), silver (#9CA3AF), bronze (#CD7F32) accent borders
- Rank numbers: gold for #1 (text-amber-500), silver for #2 (text-gray-400), bronze for #3 (text-amber-700)
- Trend arrows: green up, red down, gray neutral (Lucide TrendingUp, TrendingDown, Minus icons)
- AnimatedNumber for all values
- StaggeredList for the leaderboard rows
- Tabs component for period selection
- Mobile: cards instead of table rows

### 5. Add navigation link to coach sidebar: "Leaderboards" with Trophy icon from Lucide.
```

---

## PROMPT 5: Coach-to-Athlete Messaging System

```
TASK: Build a direct messaging system between coaches and athletes, with support for individual messages, group broadcasts, and scheduled/recurring messages.

CONTEXT: TeamBuildr has messaging with push notifications, scheduling, and recurring sends. We need this plus context-aware messaging (e.g., commenting on a specific throw or session).

WHAT TO BUILD:

### 1. Database Schema

```prisma
model Message {
  id          String       @id @default(cuid())
  coachId     String       // Always scoped to a coach's team
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)

  // Sender
  senderId    String       // userId
  senderRole  String       // "COACH" | "ATHLETE"
  senderName  String       // Denormalized

  // Recipient(s)
  recipientType String     // "INDIVIDUAL" | "GROUP" | "TEAM"
  recipientId   String?    // athleteId for individual, groupId for group, null for team

  // Content
  subject     String?      // Optional subject line for announcements
  body        String       @db.Text

  // Context (optional — links message to a specific entity)
  contextType String?      // "THROW" | "SESSION" | "VIDEO" | "READINESS" | "GOAL"
  contextId   String?      // ID of the linked entity

  // Scheduling
  scheduledFor  DateTime?  // null = send immediately
  isRecurring   Boolean    @default(false)
  recurPattern  String?    // "DAILY" | "WEEKDAYS" | "WEEKLY" | "CUSTOM"
  recurDays     Int[]      // For CUSTOM: [1,3,5] = Mon,Wed,Fri (ISO day numbers)
  recurTime     String?    // "06:00" — time to send
  recurEndDate  DateTime?  // When to stop recurring

  // Status
  sentAt      DateTime?

  // Read tracking done via MessageRead join
  reads       MessageRead[]

  createdAt   DateTime     @default(now())

  @@index([coachId, createdAt(sort: Desc)])
  @@index([recipientType, recipientId])
  @@index([senderId])
  @@index([scheduledFor])
}

model MessageRead {
  id        String   @id @default(cuid())
  messageId String
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  userId    String   // The user who read it
  readAt    DateTime @default(now())

  @@unique([messageId, userId])
  @@index([messageId])
  @@index([userId])
}
```

Add to CoachProfile: `messages Message[]`

### 2. API Routes

- `GET /api/messages?type=inbox|sent&cursor=&limit=20` — Paginated message list
- `GET /api/messages/[id]` — Single message with read status
- `POST /api/messages` — Send or schedule a message
- `POST /api/messages/[id]/read` — Mark as read
- `GET /api/messages/unread-count` — Unread count for badge
- `DELETE /api/messages/[id]` — Delete (sender only)
- `GET /api/messages/scheduled` — List scheduled/recurring messages (coach only)
- `PUT /api/messages/[id]/cancel` — Cancel a scheduled message

For the athlete inbox: filter messages where recipientType is INDIVIDUAL+their ID, or GROUP+their group, or TEAM.

### 3. Scheduled Message Processor

Create a utility/cron handler at `src/lib/services/message-scheduler.ts`:
- Checks for messages where `scheduledFor <= now()` and `sentAt IS NULL`
- For recurring messages: after sending, compute next occurrence and create the next scheduled message
- This can be triggered by a Vercel Cron Job (add to vercel.json) running every 5 minutes

Add an API route `POST /api/cron/process-messages` with a cron secret for Vercel to call.

### 4. UI Pages

**Coach Messages page** at `src/app/(dashboard)/coach/messages/page.tsx`:
- Two-pane layout on desktop: message list on left, message detail on right
- Single-pane on mobile with back navigation
- Compose button → opens compose modal/drawer with:
  - Recipient selector: "All Athletes" | Event Group dropdown | Individual athlete search
  - Subject line (optional)
  - Body textarea (plain text, not rich text — keep it simple)
  - "Send Now" or "Schedule" toggle
  - If scheduled: date/time picker + optional recurring pattern
- Sent vs Inbox tabs
- Unread indicators (bold text, dot badge)
- For each sent message: show read receipt count ("Read by 12 of 24 athletes")

**Athlete Messages page** at `src/app/(dashboard)/athlete/messages/page.tsx`:
- Simple inbox list view
- Tap message to read → auto-marks as read
- Reply button (creates individual message back to coach)
- Context link: if message has contextType/contextId, show "View Throw" / "View Session" link

**Notification badge:**
- Add unread count badge to the Messages nav item in the sidebar
- Use the existing notification pattern but for messages

### 5. Integration Points
- When a coach views an athlete's throw video, add a "Send Feedback" button that pre-fills a message with context (contextType: "VIDEO", contextId: videoId)
- When readiness drops below threshold, auto-draft a message to the athlete (coach can review before sending)
- When a session is published, optionally notify assigned athletes

### 6. Design
- Message list items: card class with hover state
- Unread messages: slightly brighter background, bold sender name
- Compose modal: use existing modal patterns
- Read receipts: small gray text "Read by X" with progress bar
- Scheduled messages: clock icon badge, amber text showing scheduled time
- No new dependencies — vanilla textarea, existing date picker if available or HTML date input

### 7. Migration
Run `npm run db:migrate` with name "add-messaging-system"
```

---

## PROMPT 6: Evaluations & Testing Protocols

```
TASK: Build a formal testing/evaluation system where coaches create standardized test batteries (like a combine), run athletes through them, track results over time, and generate comparison reports.

CONTEXT: TeamBuildr has an "Evaluations" module where coaches create test items (40yd dash, bench press reps, etc.), select athletes, input results, and generate chronological reports. Ours needs to be throws-specific and include transfer analysis — connecting strength gains to throwing improvements.

WHAT TO BUILD:

### 1. Database Schema

```prisma
model TestProtocol {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  name        String       // "Pre-Season Assessment", "Monthly Check", "Competition Readiness"
  description String?
  isTemplate  Boolean      @default(false) // Can be reused

  items       TestItem[]
  sessions    TestSession[]

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([coachId])
}

model TestItem {
  id          String       @id @default(cuid())
  protocolId  String
  protocol    TestProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
  name        String       // "5x Standing Shot Put", "Back Squat 1RM", "Vertical Jump"
  category    String       // "throws" | "strength" | "power" | "mobility" | "anthropometric"
  unit        String       // "m" | "kg" | "lbs" | "cm" | "s" | "reps" | "score"
  direction   String       @default("higher_better") // "higher_better" | "lower_better"
  order       Int
  notes       String?      // Instructions for administering this test

  results     TestResult[]

  @@index([protocolId])
}

model TestSession {
  id          String       @id @default(cuid())
  protocolId  String
  protocol    TestProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
  name        String       // "Fall 2026 Pre-Season", "January Monthly Check"
  testDate    DateTime
  notes       String?

  results     TestResult[]

  createdAt   DateTime     @default(now())

  @@index([protocolId])
  @@index([testDate])
}

model TestResult {
  id          String         @id @default(cuid())
  sessionId   String
  session     TestSession    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  itemId      String
  item        TestItem       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  value       Float          // The measured result
  notes       String?

  @@unique([sessionId, itemId, athleteId])
  @@index([sessionId])
  @@index([athleteId])
  @@index([itemId])
}
```

Add relations to CoachProfile: `testProtocols TestProtocol[]`
Add relations to AthleteProfile: `testResults TestResult[]`

### 2. API Routes

**Protocols:**
- `POST /api/coach/evaluations/protocols` — Create test protocol
- `GET /api/coach/evaluations/protocols` — List protocols
- `GET /api/coach/evaluations/protocols/[id]` — Get protocol with items
- `PUT /api/coach/evaluations/protocols/[id]` — Update
- `DELETE /api/coach/evaluations/protocols/[id]` — Delete

**Test Sessions:**
- `POST /api/coach/evaluations/sessions` — Create test session (select protocol + athletes + date)
- `GET /api/coach/evaluations/sessions` — List past sessions
- `POST /api/coach/evaluations/sessions/[id]/results` — Submit results (batch: array of { itemId, athleteId, value })
- `GET /api/coach/evaluations/sessions/[id]/results` — Get all results for a session

**Reports:**
- `GET /api/coach/evaluations/reports/athlete/[athleteId]?protocolId=` — Longitudinal report for one athlete across all test sessions
- `GET /api/coach/evaluations/reports/comparison?sessionId1=&sessionId2=` — Side-by-side comparison of two test sessions
- `GET /api/coach/evaluations/reports/transfer?athleteId=&period=` — Transfer analysis: correlate strength test changes with throwing distance changes

**Transfer Analysis Logic (this is the differentiator):**
For each athlete, compute:
1. Strength changes between test sessions (e.g., squat went from 150kg to 160kg = +6.7%)
2. Throwing distance changes in the same period (e.g., shot put went from 16.5m to 17.1m = +3.6%)
3. Calculate correlation: which strength tests have the strongest relationship with throwing improvements?
4. Return a ranked list: "Back Squat improvement correlated 0.82 with Shot Put improvement" — this is Bondarchuk's Transfer of Training in practice

### 3. UI Pages

**Evaluations hub** at `src/app/(dashboard)/coach/evaluations/page.tsx`:
- List of test protocols as cards (card-interactive)
- "Create Protocol" button
- Recent test sessions listed below
- Quick stats: total tests run, athletes tested this month

**Protocol builder** at `src/app/(dashboard)/coach/evaluations/protocols/[id]/page.tsx`:
- Protocol name, description
- Ordered list of test items (drag to reorder)
- "Add Item" button → inline form: name, category dropdown, unit dropdown, direction
- Pre-built templates: "Throws Assessment Battery" (standing throws, full throws by event/implement, squat 1RM, clean 1RM, vert jump, overhead med ball, 30m sprint)

**Data entry** at `src/app/(dashboard)/coach/evaluations/sessions/[id]/page.tsx`:
- Grid layout: athletes as rows, test items as columns
- Quick-input number fields (tab between cells)
- Color coding: green = improvement from last test, red = decline, gray = first test
- "Save All" button with validation (no empty required fields)
- Mobile: switch to card-per-athlete view

**Reports** at `src/app/(dashboard)/coach/evaluations/reports/page.tsx`:
- Athlete longitudinal view: line charts showing each test item over time (one line per item)
- Session comparison: side-by-side bar charts showing before/after
- Transfer analysis dashboard: scatter plot showing strength change vs throwing change, with correlation coefficients displayed
- All reports exportable to PDF (use existing PDF generation if available, or generate a printable HTML view)

### 4. Seed Data
Add 2 default protocol templates to the seed:
1. "Pre-Season Throws Battery": 5x Standing SP, 5x Full SP, 5x Standing Disc, 5x Full Disc, Back Squat 1RM, Power Clean 1RM, Bench Press 1RM, Overhead Shot Toss, Standing Long Jump, 30m Sprint
2. "Monthly Quick Check": 3x Full Throw (primary event), Squat 3RM, Clean 2RM, Vertical Jump

### 5. Design
- Data entry grid: use tabular-nums for number alignment
- Improvement indicators: emerald for gains, red for declines (status colors from design system)
- Charts: use existing chart library or build with CSS (bar charts are simple enough)
- AnimatedNumber on all result values
- StaggeredList for protocol cards

### 6. Migration
Run `npm run db:migrate` with name "add-evaluations-and-testing"
```

---

## PROMPT 7: Attendance Tracking

```
TASK: Build an attendance tracking system so coaches can monitor who shows up to practice, identify patterns, and tie attendance to performance.

WHAT TO BUILD:

### 1. Database Schema

```prisma
model AttendanceRecord {
  id          String         @id @default(cuid())
  coachId     String
  coach       CoachProfile   @relation(fields: [coachId], references: [id], onDelete: Cascade)
  athleteId   String
  athlete     AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  date        DateTime
  status      String         // "PRESENT" | "ABSENT" | "EXCUSED" | "LATE"
  checkInTime DateTime?      // When they actually arrived
  reason      String?        // For EXCUSED/ABSENT: "injury", "academic", "illness", "travel", "other"
  notes       String?

  // Auto-linked to session if one exists for this date
  sessionId   String?

  createdAt   DateTime       @default(now())

  @@unique([athleteId, date])
  @@index([coachId, date])
  @@index([athleteId, date])
  @@index([status])
}
```

### 2. API Routes

- `POST /api/coach/attendance` — Record attendance for a date (batch: array of { athleteId, status, reason? })
- `GET /api/coach/attendance?date=&groupId=` — Get attendance for a date
- `GET /api/coach/attendance/report?athleteId=&startDate=&endDate=` — Attendance report for an athlete
- `GET /api/coach/attendance/summary?period=30d` — Team attendance summary (rates per athlete)

### 3. UI Pages

**Daily Attendance** at `src/app/(dashboard)/coach/attendance/page.tsx`:
- Date picker at top (defaults to today)
- Roster list with toggle buttons per athlete: Present (green) | Absent (red) | Excused (amber) | Late (yellow)
- Filter by event group
- Quick "Mark All Present" button
- Notes field per athlete (expandable)
- If status is EXCUSED or ABSENT: reason dropdown appears

**Attendance Dashboard** at `src/app/(dashboard)/coach/attendance/dashboard/page.tsx`:
- Team attendance rate (AnimatedNumber, percentage)
- Heatmap calendar showing team attendance by day (darker = more athletes present)
- Per-athlete compliance table: name, attendance rate, absences, late count, current streak
- Sortable by any column
- Flag athletes below 80% attendance rate (amber warning), below 60% (red)
- Correlation insight: "Athletes with >90% attendance average 2.3m further throws" (compute from actual data)

### 4. Design
- Toggle buttons: use pill-style buttons with color states
- Heatmap: CSS grid with background-color intensity
- Compliance table: existing table patterns, tabular-nums for numbers
- Warning flags: use status colors (amber, red) from design system

### 5. Add "Attendance" link to coach sidebar with ClipboardCheck icon from Lucide.

### 6. Migration: "add-attendance-tracking"
```

---

## PROMPT 8: Document & Resource Library

```
TASK: Build a simple document and link library where coaches can upload files and share links with athletes, organized by team or event group.

WHAT TO BUILD:

### 1. Database Schema

```prisma
model Resource {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title       String
  description String?
  type        String       // "DOCUMENT" | "LINK" | "VIDEO_LINK"

  // For documents
  fileUrl     String?      // R2 URL for uploaded files
  fileName    String?
  fileSize    Int?         // bytes
  mimeType    String?

  // For links
  url         String?

  // Visibility
  visibility  String       @default("TEAM") // "TEAM" | "GROUP" | "INDIVIDUAL"
  groupId     String?
  athleteId   String?

  // Organization
  category    String?      // "technique", "nutrition", "recovery", "competition", "administrative", "research"
  pinned      Boolean      @default(false)

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([coachId])
  @@index([category])
  @@index([visibility])
}
```

### 2. API Routes

- `POST /api/coach/resources` — Create resource (upload file to R2 or save link)
- `GET /api/coach/resources?category=&visibility=` — List resources
- `PUT /api/coach/resources/[id]` — Update
- `DELETE /api/coach/resources/[id]` — Delete (also delete from R2 if document)
- `GET /api/athlete/resources` — Athlete view (filtered to resources visible to them)

### 3. UI

**Coach Resources page** at `src/app/(dashboard)/coach/resources/page.tsx`:
- Grid of resource cards (card-interactive)
- Upload button → file picker OR URL input
- Category filter tabs
- Pin/unpin toggle
- Visibility badge on each card (Team | Group Name | Athlete Name)

**Athlete Resources page** at `src/app/(dashboard)/athlete/resources/page.tsx`:
- Read-only grid of resources shared with them
- Click document → download/view
- Click link → opens in new tab
- Category filter

### 4. File uploads use the existing Cloudflare R2 infrastructure (same pattern as video uploads).

### 5. Migration: "add-resource-library"
```

---

## PROMPT 9: Printable Session Sheets & PDF Export

```
TASK: Add the ability to print/export training sessions as formatted PDF workout cards, and generate a single-page "rack sheet" showing all athletes' prescribed loads.

WHAT TO BUILD:

### 1. API Routes

- `GET /api/coach/export/session-card/[sessionId]?athleteId=` — Generate PDF workout card for one athlete's session
- `GET /api/coach/export/rack-sheet?date=&exerciseName=` — Generate single-page sheet showing all athletes' prescribed loads for one exercise on one date
- `GET /api/coach/export/week-plan?athleteId=&weekStart=` — Generate weekly plan PDF for one athlete

### 2. PDF Generation

Use the existing PDF generation approach from the codebase (check src/lib for any PDF utilities). If none exists, use a server-side HTML-to-PDF approach:

**Session Card layout:**
- Athlete name, date, session title at top
- Each block as a section with exercises listed
- For each exercise: name, sets × reps, prescribed weight/implement, target RPE, rest time
- Empty checkbox or write-in area for actual values (for athletes who prefer paper)
- Bondarchuk classification badge next to each exercise (CE/SDE/SPE/GPE)
- Implement weights in bold with descending arrow showing sequence
- QR code linking back to the digital session (optional nice-to-have)

**Rack Sheet layout:**
- Landscape orientation
- Exercise name as title
- Table: Athlete Name | Prescribed Weight | Sets × Reps | Calculated Plates
- One row per athlete, sorted alphabetically or by event group
- Large font for weight values (coaches post this on the rack)
- Date and session name in header

**Week Plan layout:**
- 7-day grid (Mon-Sun)
- Each day shows: session title, key exercises, total volume
- Compact enough to fit on one page

### 3. UI Integration

- Add "Print Session" button (Printer icon) on session detail pages
- Add "Export Rack Sheet" button on the programming page
- Add "Export Week" button on the athlete calendar
- All buttons trigger a download of the generated PDF

### 4. Use existing Tailwind print styles where possible. No new dependencies — generate PDFs server-side using puppeteer if available, or create well-formatted HTML with @media print styles that the browser can print natively.
```

---

## PROMPT 10: Transfer of Training Analytics Dashboard

```
TASK: Build the analytics dashboard that answers the #1 question every throws coach has: "Are my athletes' gym gains actually transferring to the ring?" This is the Bondarchuk Transfer of Training analysis that NO competitor offers.

CONTEXT: This is Podium Throws' unique differentiator. TeamBuildr, TrainHeroic, etc. track gym numbers and throwing numbers separately. We connect them. This dashboard shows coaches which exercises actually correlate with throwing improvements for each athlete.

WHAT TO BUILD:

### 1. API Route

`GET /api/coach/analytics/transfer?athleteId=&period=6m`

This endpoint computes:

**A. Strength-to-Throwing Correlation Matrix**
For each strength exercise the athlete has logged (back squat, power clean, bench press, snatch, etc.):
1. Get the athlete's estimated 1RM progression over the period (from SessionLog data)
2. Get the athlete's best throwing distance progression over the same period (from ThrowLog data, by event)
3. Compute Pearson correlation coefficient between the two progressions
4. Return ranked list: exercise name, correlation coefficient, strength change %, throwing change %

Example output:
```json
{
  "athleteId": "...",
  "event": "SHOT_PUT",
  "period": "6m",
  "correlations": [
    { "exercise": "Power Clean", "correlation": 0.89, "strengthChange": "+12.3%", "throwChange": "+5.1%", "classification": "HIGH_TRANSFER" },
    { "exercise": "Back Squat", "correlation": 0.72, "strengthChange": "+8.7%", "throwChange": "+5.1%", "classification": "MODERATE_TRANSFER" },
    { "exercise": "Bench Press", "correlation": 0.31, "strengthChange": "+15.2%", "throwChange": "+5.1%", "classification": "LOW_TRANSFER" }
  ],
  "overallTransferScore": 7.2, // 1-10 composite score
  "insight": "Power Clean shows the strongest transfer to Shot Put for this athlete. Consider increasing Power Clean volume in the next block."
}
```

Classification thresholds:
- HIGH_TRANSFER: correlation > 0.7
- MODERATE_TRANSFER: correlation 0.4-0.7
- LOW_TRANSFER: correlation < 0.4

**B. Volume-Performance Relationship**
- Plot weekly throwing volume (total throws) against weekly best distance
- Identify optimal volume zone (where best distances occur)
- Flag overtraining indicators (volume up, performance down for 2+ weeks)

**C. Readiness-Performance Correlation**
- Plot readiness scores against same-day or next-day throwing performance
- Show coaches the readiness threshold below which performance drops

### 2. UI Page

**Transfer Analytics** at `src/app/(dashboard)/coach/analytics/transfer/page.tsx`:

- Athlete selector dropdown at top
- Event selector (Shot Put, Discus, Hammer, Javelin)
- Period selector (3m, 6m, 12m, all-time)

**Section 1: Transfer Matrix**
- Horizontal bar chart showing correlation coefficients per exercise
- Color coded: green (high transfer), amber (moderate), red (low)
- Each bar clickable → expands to show scatter plot of strength vs throwing progression

**Section 2: Volume Optimization**
- Dual-axis chart: throwing volume (bars) vs best distance (line)
- Highlighted "optimal zone" band showing the volume range with best results
- Warning banner if current volume is outside optimal zone

**Section 3: Readiness Impact**
- Scatter plot: readiness score (x) vs throwing distance (y)
- Trend line showing the relationship
- "Threshold" line showing where performance drops off
- Insight card: "Athletes with readiness ≥ 7.5 throw an average of 1.2m further"

**Section 4: Recommendations**
- AI-generated (rule-based) recommendations based on the data:
  - "Increase Power Clean volume — highest transfer exercise"
  - "Reduce Bench Press focus — low transfer to throwing events"
  - "Monitor readiness: athlete's performance drops sharply below 6.0"
  - "Current weekly volume (45 throws) is above optimal range (30-40) — consider reducing"

### 3. Coach Dashboard Integration
- Add a "Transfer Score" widget to the main coach dashboard
- Shows each athlete's composite transfer score (1-10) with trend arrow
- Low scores flagged in amber/red
- Links to full transfer analytics page

### 4. Design
- Charts: build with CSS or use recharts if available in the project
- Correlation bars: gradient from red (0) to green (1.0)
- AnimatedNumber for all scores and percentages
- Insight cards: use existing card patterns with info (blue) left border
- Warning banners: amber background with AlertTriangle icon
- This page should feel like a sports science lab dashboard — data-dense but clear

### 5. This requires no schema changes — it's a computed analytics layer over existing ThrowLog, SessionLog, and ReadinessCheckIn data.
```

---

## PROMPT 11: Auto-Regulation Engine (Smart Session Modifications)

```
TASK: Build an auto-regulation engine that uses an athlete's readiness data, recent training load, and competition schedule to automatically suggest session modifications. This runs when an athlete opens their daily session.

WHAT TO BUILD:

### 1. Service: `src/lib/services/autoregulation-engine.ts`

This service takes:
- athleteId
- today's date
- today's prescribed session (from the trickle-down system or direct assignment)

And returns a modified session with adjustment reasons.

**Logic:**

Step 1: Get today's readiness score (from ReadinessCheckIn)
Step 2: Get last 7 days of training load (total throws, total sets, avg RPE)
Step 3: Check competition schedule (is there a competition within 5 days?)

Step 4: Apply rules:

| Readiness | Load Trend | Competition Proximity | Action |
|---|---|---|---|
| ≥ 8 | Normal/Low | None | No changes — full session |
| 6-7.9 | Normal | None | Reduce volume 15-20% (fewer sets, not fewer exercises) |
| 6-7.9 | High (above 7-day avg) | None | Reduce volume 25%, cap RPE at 7 |
| < 6 | Any | None | Reduce volume 40%, no max-effort throws, flag for coach review |
| Any | Any | ≤ 3 days | Competition taper: reduce volume 50%, reduce implement weights to comp weight only, focus on technique |
| Any | Any | ≤ 1 day | Rest day — suggest active recovery only |
| ≥ 8 | Low | None | Suggest volume increase 10% ("athlete is fresh, consider adding 1 extra set") |

Step 5: For throwing blocks, enforce Bondarchuk rules on the modified session
Step 6: Return: { originalSession, modifiedSession, adjustments: [{ type, reason, detail }], overallRecommendation: "PROCEED" | "MODIFY" | "REST" | "COACH_REVIEW" }

### 2. API Route

`GET /api/athlete/session/today?autoRegulate=true`

Returns the athlete's session for today with auto-regulation suggestions. The athlete can accept the modified version or override to the original.

`POST /api/athlete/session/today/accept-modification`

Logs that the athlete accepted the auto-regulated session (useful for coach review).

### 3. UI Integration

On the athlete's daily session view:
- If autoregulation suggests modifications, show an alert banner at top:
  - Green: "You're feeling great — full session prescribed"
  - Amber: "Based on your readiness (6.8) and high recent training load, we've reduced today's volume by 20%"
  - Red: "Your readiness score (4.2) is concerning. We strongly recommend a modified session. Your coach has been notified."
- Show original vs modified side by side (diff view)
- "Accept Modified" and "Use Original" buttons
- Modified exercises show what changed (e.g., "4 sets → 3 sets", "RPE 9 → RPE 7")

On the coach's dashboard:
- Alert when any athlete triggers a "COACH_REVIEW" or "REST" recommendation
- Coach can approve, override, or message the athlete

### 4. No new schema needed — this is a computation layer. Log the decisions in the existing Notification model or create ActivityLog entries.

### 5. This should integrate with Prompt 1's trickle-down system — autoregulation modifies the resolved session AFTER trickle-down resolution.
```

---

## PROMPT 12: Online Program Sales Portal

```
TASK: Build a portal where coaches can package their training programs and sell them to external athletes (alumni, remote athletes, etc.) who don't count against their subscription athlete limit.

CONTEXT: TeamBuildr charges a $10/athlete fee for external sales. This is a revenue opportunity for both coaches and the platform.

WHAT TO BUILD:

### 1. Database Schema

```prisma
model ProgramListing {
  id          String       @id @default(cuid())
  coachId     String
  coach       CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  title       String
  description String       @db.Text
  event       EventType?   // Which event(s) this program targets
  level       String?      // "beginner" | "intermediate" | "advanced" | "elite"
  durationWeeks Int        // Program length

  // Pricing
  priceInCents Int         // e.g., 4999 = $49.99
  currency     String      @default("usd")

  // Content
  planId       String?     // Links to an existing WorkoutPlan as the content
  previewText  String?     @db.Text // What non-purchasers can see

  // Status
  isActive     Boolean     @default(true)
  slug         String      @unique // URL-friendly identifier

  // Sales
  purchases    ProgramPurchase[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([coachId])
  @@index([isActive])
  @@index([event])
}

model ProgramPurchase {
  id          String         @id @default(cuid())
  listingId   String
  listing     ProgramListing @relation(fields: [listingId], references: [id], onDelete: Cascade)

  // Buyer (may or may not be an existing user)
  buyerEmail  String
  buyerName   String
  buyerUserId String?        // If they have a Podium account

  // Payment
  stripePaymentId  String    @unique
  amountPaid       Int       // cents
  platformFee      Int       // cents (our cut)
  coachPayout      Int       // cents (coach's cut)

  // Access
  accessGrantedAt  DateTime  @default(now())
  accessExpiresAt  DateTime? // null = lifetime access

  createdAt    DateTime      @default(now())

  @@index([listingId])
  @@index([buyerEmail])
  @@index([buyerUserId])
}
```

### 2. API Routes

**Coach (seller) routes:**
- `POST /api/coach/store/listings` — Create listing
- `GET /api/coach/store/listings` — List all coach's listings
- `PUT /api/coach/store/listings/[id]` — Update listing
- `GET /api/coach/store/sales` — Sales dashboard (revenue, purchases, payouts)

**Public (buyer) routes:**
- `GET /api/store/[slug]` — Get listing details (public)
- `POST /api/store/[slug]/checkout` — Create Stripe checkout session
- `POST /api/stripe/webhooks/program-purchase` — Handle successful payment → grant access

**Buyer access routes:**
- `GET /api/buyer/programs` — List purchased programs
- `GET /api/buyer/programs/[id]` — View purchased program content

### 3. Stripe Connect Integration
- Use Stripe Connect (Standard or Express) so coaches get their own connected accounts
- Platform takes 15% fee (configurable), coach gets 85%
- Set up Stripe Connect onboarding flow for coaches in settings

### 4. UI Pages

**Coach Store Settings** at `src/app/(dashboard)/coach/store/page.tsx`:
- List of program listings (card-interactive)
- Create/edit listing form: title, description, event, level, price, link to existing plan
- Sales dashboard: total revenue, total sales, pending payouts (AnimatedNumber)
- Stripe Connect onboarding status

**Public Store Page** at `src/app/store/[slug]/page.tsx` (no auth required):
- Program description, duration, level, event
- Coach name and bio
- Price with "Buy Now" button → Stripe Checkout
- Preview of program structure (week overview without full exercise details)

**Buyer Dashboard** at `src/app/buyer/page.tsx`:
- Purchased programs listed
- Click to view full program content
- These buyers do NOT count against the coach's athlete limit

### 5. Important: External buyers get read-only access to the program. They cannot log sessions, submit data, or appear on the coach's roster. They simply view the prescribed workouts. If they want full tracking, they'd need to join as a regular athlete.

### 6. Migration: "add-program-store"
```

---

## How to Use These Prompts

1. **Feed them one at a time** to Claude Code in the Podium Throws project directory
2. **Start with Prompt 1** (Event Groups) — it's the foundation everything else builds on
3. After each prompt, verify:
   - `npx tsc --noEmit` passes
   - `npm run db:migrate` succeeds
   - Pages render without errors
4. **Prompts 2-8 can be done in any order** after Prompt 1
5. **Prompts 9-12 depend on earlier features** being in place
6. Each prompt is designed to be self-contained — Claude Code should be able to execute it without asking clarifying questions
