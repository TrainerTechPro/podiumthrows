# Schema Consolidation Query Results

Drop zone for CSVs exported from running `tasks/schema-consolidation-queries.sql` against the prod Supabase project (`bfmswuxblbwomntvkwdw`).

## Expected filenames

Each filename maps 1:1 to a query section in the SQL file. The PR 2 manifest back-fill expects these exact names:

- `section-0-row-counts.csv`
- `section-1a-coachpr-coach-only-fields.csv`
- `section-1b-source-distribution.csv`
- `section-1c-throwspr-profile.csv`
- `section-1d-coachpr-profile.csv`
- `section-1e-throwspr-event-invalid.csv`
- `section-2a-coachtyping-coach-only-fields.csv`
- `section-2b-throwstyping-athlete-only-fields.csv`
- `section-2c-rename-pair-population.csv`
- `section-2d-date-column-profile.csv`
- `section-3a-athlete-session-profile.csv`
- `section-3b-coach-session-profile.csv`
- `section-3c-athlete-session-event-invalid.csv`
- `section-3d-shared-field-null-profile.csv`
- `section-4a-drilllog-parity.csv`
- `section-4b-drilltype-distribution.csv`
- `section-4c-wirelength-distribution.csv`
- `section-5a-inbound-fk-counts.csv`
- `section-5b-orphan-check.csv`
- `section-6a-dual-profile-count.csv`
- `section-6b-dual-profile-active-count.csv`

## Workflow

1. Open Supabase SQL Editor for project `bfmswuxblbwomntvkwdw`
2. Paste one section at a time from `tasks/schema-consolidation-queries.sql`
3. Run → Export CSV → save here with the matching filename
4. When all 21 files are in place, the manifest author (me or you) back-fills §2.3 of `tasks/schema-consolidation-manifest.md` with the real numbers and the blocker section closes

## Why not automate

Prod Supabase is under an org my current MCP session can't see (see manifest §2.2). Rather than adding org-admin MCP access for a one-time read, this handoff keeps prod access scoped to the dashboard session the owner is already signed into.
