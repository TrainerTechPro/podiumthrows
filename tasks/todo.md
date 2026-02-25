# Podium Throws — Build Plan (From Scratch)

## Step 1: Project Scaffold

- [ ] 1.1 Initialize Next.js 14.2 App Router with TypeScript (`npx create-next-app@14`)
- [ ] 1.2 Install dependencies: Tailwind 3.4, Prisma, bcrypt, jsonwebtoken, stripe, uuid
- [ ] 1.3 Configure Tailwind: custom amber/gold primary palette, dark mode `"class"`, Outfit + DM Sans fonts
- [ ] 1.4 Configure path aliases in `tsconfig.json` (`@/components`, `@/lib`, etc.)
- [ ] 1.5 Set up Prisma with PostgreSQL provider
- [ ] 1.6 Create full directory structure:
  - `src/app/(auth)/login`, `register`, `forgot-password`, `reset-password`
  - `src/app/(dashboard)/coach/` — dashboard, athletes, training, throws, video, settings
  - `src/app/(dashboard)/athlete/` — dashboard, training, throws, readiness, goals, settings
  - `src/app/api/` — auth, athletes, training, throws, readiness, video, stripe
  - `src/components/` — ui/, layout/, forms/, charts/
  - `src/lib/` — auth.ts, prisma.ts, stripe.ts, calculations.ts
- [ ] 1.7 Configure ESLint + Prettier
- [ ] 1.8 Create `vercel.json` with security headers (HSTS, CSP, X-Frame-Options)
- [ ] 1.9 Create `.env.example` with all required env vars

## Step 2: Database Schema

- [ ] 2.1 Define enums: UserRole, SubscriptionPlan, EventType, ExerciseCategory, etc.
- [ ] 2.2 User model (email, passwordHash, role, timestamps)
- [ ] 2.3 CoachProfile (name, bio, org, avatar, plan, stripeCustomerId)
- [ ] 2.4 AthleteProfile (name, events[], gender, dob, avatar, coachId, streaks)
- [ ] 2.5 Exercise model (name, description, videoUrl, category CE|SD|SP|GP, event, implementWeight, correlationData)
- [ ] 2.6 WorkoutPlan + WorkoutBlock + BlockExercise (structured training plans)
- [ ] 2.7 TrainingSession + SessionLog (assigned work + logged results)
- [ ] 2.8 ThrowLog (athlete, event, implement, distance, date, video, session link)
- [ ] 2.9 BondarchukAssessment (athlete, results JSON, athleteType)
- [ ] 2.10 ReadinessCheckIn (full breakdown: sleep, soreness, stress, energy, hydration, injury)
- [ ] 2.11 Questionnaire + QuestionnaireResponse
- [ ] 2.12 Goal + Achievement models
- [ ] 2.13 VideoUpload (url, thumbnail, annotations JSON)
- [ ] 2.14 Team model (coach groups)
- [ ] 2.15 Invitation model (email invites with token)
- [ ] 2.16 Add @@index annotations on all FKs and query-hot fields
- [ ] 2.17 Validate schema with `npx prisma validate`

## Step 3: Seed File

- [ ] 3.1 1 coach (coach@example.com / coach123, Pro plan)
- [ ] 3.2 4 athletes (shot put, discus, hammer, javelin) linked to coach
- [ ] 3.3 Exercise library: ~20 exercises across CE/SD/SP/GP categories
- [ ] 3.4 2-3 workout plans with blocks
- [ ] 3.5 8-10 training sessions per athlete (mix of completed/scheduled)
- [ ] 3.6 14 days of readiness check-ins per athlete with realistic variance
- [ ] 3.7 5-10 throw logs per athlete with realistic distances
- [ ] 3.8 1 Bondarchuk assessment per athlete
- [ ] 3.9 2-3 goals per athlete (mix of in-progress/completed)
- [ ] 3.10 Achievements per athlete
- [ ] 3.11 1 team grouping all 4 athletes

## Step 4: Verification

- [ ] 4.1 Run `tsc --noEmit` — zero errors
- [ ] 4.2 Run `npx prisma validate` — schema valid
- [ ] 4.3 Verify directory structure matches CLAUDE.md spec
