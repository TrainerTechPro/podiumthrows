# Database restore runbook

> **Audience.** On-call engineer recovering from data loss, corruption, or platform failure on the Podium Throws production database.
>
> **Production database.** Supabase project `PodiumThrows`, ref `bfmswuxblbwomntvkwdw`, region East US (North Virginia). Schema: 113 tables across `public`, `auth`, `storage`, `supabase_migrations`. App data lives in `public`.
>
> **Last drill.** `2026-04-27` — Drill A (logical dump → local pg17 → smoke). PASS. RTO 50s end-to-end script run. RPO 0s (live dump). Drill B (cloud-restore-to-new-project) **not yet exercised** — see §[Drill B](#drill-b-cloud-to-cloud-restore-not-yet-exercised).

---

## When to restore

| Scenario                                                              | Recovery path                                                                            | Destination                            | Why                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Accidental table drop / mass UPDATE / migration corrupted recent data | **PITR same-project**                                                                    | Production project, wound back in time | Fastest. Granularity ≈ 2 minutes. Destructive — rewinds all data, not just the affected rows.                                             |
| Data corruption affecting a subset; need to extract good rows         | **Restore to new project**, then `pg_dump`/`pg_restore` the affected rows back into prod | Sibling project (temporary)            | Non-destructive to prod. Slower — provisioning + paid resource.                                                                           |
| Project deleted / region failure / Supabase incident                  | **Restore to new project**, swap `POSTGRES_*` env vars in Vercel, redeploy               | Sibling project (becomes new prod)     | Only path when source project is unreachable.                                                                                             |
| Need a non-prod copy for forensic / migration testing                 | **Drill A** (logical dump) into local Docker pg17                                        | Local                                  | Free, fast, doesn't require Supabase paid resources. Doesn't validate Supabase's physical-backup mechanism — just dump/restore mechanics. |

**Default to "restore to new project"** unless wall-clock matters more than data preservation. PITR-in-place is a one-way ratchet; you cannot un-rewind.

---

## Backup posture (what we have)

- **Daily physical backups** retained 7 days. Listed via `supabase backups list --project-ref bfmswuxblbwomntvkwdw`. Confirmed 7 backups present `2026-04-20` through `2026-04-26`. Backups run nightly ~10:45 UTC.
- **PITR enabled.** Backup type reported as `PHYSICAL` in CLI output. PITR uses physical backups + WAL archiving. Worst-case RPO per Supabase docs: 2 minutes between checkpoints.
- **Plan tier:** Pro (or higher with PITR add-on) — required for both PITR and "restore to new project".
- **What's not backed up by Supabase:** Storage objects (we use Cloudflare R2, not Supabase Storage — see `CLAUDE.md` §"Tech Stack"), Edge Functions config, Auth settings/API keys, Realtime config, Database extensions, read replicas. R2 has its own retention; outside the scope of this runbook.

> **Heads-up.** Neither auth.users data nor storage.objects metadata is critical for app function — Podium Throws uses custom JWT auth (rows in `public."User"`) and R2 for storage. The Supabase auth/storage schemas exist but are mostly empty in our project. App data is `public.*`.

---

## Quick action — incident response

When the page wakes you up:

```text
[ ] 1. Stop the bleeding. Disable writes if possible:
       - Vercel → Project → Production → Pause Deployments
       - Or rotate POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL to a
         dummy value in Vercel env vars (next deploy will fail-closed).

[ ] 2. Identify the desired recovery point (UTC timestamp).
       - Use Supabase Dashboard → Project → Database → Backups →
         "View by date" to confirm a backup exists at that timestamp.

[ ] 3. Decide path:
       (a) PITR same-project   → §"PITR same-project" below.
       (b) Restore to new project → §"Restore to a new project" below.

[ ] 4. After restore, run smoke test:
       psql "<restored_url>" -f scripts/db-restore-drill/smoke-test.sql
       Compare against the row counts you captured pre-incident
       (or, if no baseline, against the most recent known-good snapshot).

[ ] 5. Cut over (only if "restore to new project"):
       - Update Vercel env vars POSTGRES_*, SUPABASE_*
       - Redeploy
       - Verify app health
       - Schedule the old project for deletion (NOT immediate — leave 48h
         in case rollback needed)

[ ] 6. Postmortem:
       - Log incident to Notion Bug Tracker
       - Update this runbook if a step was missing
```

---

## Recovery procedures

### PITR same-project (destructive — rewinds all data)

```bash
# Lists available recovery window:
supabase backups list --project-ref bfmswuxblbwomntvkwdw

# Restore to a specific UTC timestamp (within last 7 days):
supabase backups restore --project-ref bfmswuxblbwomntvkwdw \
  --recovery-time-target 2026-04-27T06:00:00Z
```

The CLI command opens a confirmation prompt. **The project goes offline during restore.** Expect 5–30 min depending on database size; ours is small (~10MB), so toward the low end.

> ⚠️ **Once the restore completes, every write between the recovery target and now is gone.** No undo. Confirm the timestamp twice before executing.

### Restore to a new project (dashboard — non-destructive)

> Per Supabase docs: paid plans only, source project must have physical backups enabled. We meet both.

1. **Open** [Supabase Dashboard](https://supabase.com/dashboard) → Project `PodiumThrows` → **Database** → **Backups**.
2. Click the **Restore to a New Project** tab.
3. Choose either:
   - A daily backup from the list, or
   - A specific PITR timestamp (date/time picker)
4. Review the **cost overview**. The new project bills at the source project's plan rate (Pro = $25/mo per project, prorated). For a 1-hour drill, expect <$0.05.
5. Click **Restore**. Supabase auto-creates a sibling project with mirrored config.
6. The new project takes ~5–15 min to provision + restore. Watch the dashboard for `ACTIVE_HEALTHY`.
7. Pull the new project's connection string from **Project Settings** → **Database** → **Connection String** → **URI**.
8. Run the smoke test (next section) against the new project's URL.
9. **What does NOT transfer**: storage objects + bucket config (we use R2 — irrelevant), Edge Functions, auth settings/API keys, realtime config, db extensions config, read replicas. **Disable `pg_net`, `pg_cron`, `wrappers` extensions on the restored project** to prevent accidental external calls (cron jobs firing twice, webhooks replaying).
10. **Cloned projects can't themselves be cloned** — if you need a copy of the copy, dump it.

### Smoke test (run against any candidate target)

```bash
psql "<RESTORED_URL>" -f scripts/db-restore-drill/smoke-test.sql > /tmp/restored.txt
psql "$POSTGRES_URL_NON_POOLING" -f scripts/db-restore-drill/smoke-test.sql > /tmp/prod.txt
diff -u /tmp/prod.txt /tmp/restored.txt   # empty = success
```

The smoke test covers:

- **Row counts** for 17 high-signal tables (`User`, `AthleteProfile`, `CoachProfile`, `TrainingSession`, `ThrowLog`, `ThrowsBlockLog`, `AthleteDrillLog`, `AthleteThrowsSession`, `ThrowsPR`, `ThrowsSession`, `AuditLog`, `StripeEvent`, `AthleteVideo`, `Notification`, `Invitation`, `PasswordResetToken`, `TokenBlacklist`).
- **Identity hashes** — md5 of all row IDs sorted, for `User`, `AthleteProfile`, `CoachProfile`, `ThrowLog`, `TrainingSession`, `AuditLog`. A matching hash means the exact same set of rows is present (not just the same count).
- **Referential integrity** — orphan checks across the most load-bearing FK relationships. Every result must be `0`.
- **Sample 3-level join** — coach → athlete → user, verifying the relational graph is intact.

If any row count or hash differs after a restore-to-new-project, do **not** cut over. Open a Supabase support ticket with the diff.

---

## Drill A (logical dump → local pg17, exercised 2026-04-27)

Validates dump/restore mechanics end-to-end without paid cloud resources.

```bash
./scripts/db-restore-drill/run-drill-a.sh
```

The script:

1. Pulls roles + schema + public-schema-only data via `supabase db dump` from prod (read-only).
2. Spins up a fresh Postgres 17 container on `localhost:5433`.
3. Bootstraps Supabase-specific roles so GRANT statements don't fail.
4. Applies schema, then data with `SET session_replication_role = replica` to suppress trigger-based double-encryption.
5. Runs `smoke-test.sql` against both prod and the restored DB, diffs the output.
6. Tears down the container. Drill artifacts (dumps, logs, timing) retained under `/tmp/pt-restore-drill-<TS>/`.

**Observed RTO/RPO from the 2026-04-27 run** (production size ≈ 10 MB / 421 rows across 17 sampled tables):

| Phase                                                               |    Duration |
| ------------------------------------------------------------------- | ----------: |
| Roles dump (CLI image cached)                                       |          5s |
| Schema dump                                                         |         21s |
| Data dump (public schema, `--use-copy`)                             |         21s |
| Container provision + ready                                         |          2s |
| Role bootstrap + schema apply                                       |         <1s |
| Data apply (single transaction)                                     |         <1s |
| Smoke test (prod + restored, with diff)                             |          1s |
| **RTO (full script, end-to-end)**                                   |     **50s** |
| **RTO (worst-case from manual investigation, incl. bug discovery)** | **~5m 44s** |
| **RPO (live dump captures current state)**                          |     **~0s** |

> Drill A's RPO is misleadingly good — it reflects a live dump, not restoring from a backup snapshot. The realistic RPO for Drill A _as a recovery path_ is "however stale your last manual `supabase db dump` is." For real backup-driven RPO, see Drill B.

---

## Drill B — cloud-to-cloud restore (NOT YET EXERCISED)

> **Status: queued, not run.** Requires explicit approval to incur cloud cost (~$0.05–$1 depending on dwell time).

Validates the actual incident path: Supabase physical backup → fresh Supabase project. This is the procedure you'll run during a real outage; Drill A only validates the logical dump/restore mechanics.

### Plan

1. Pre-record prod row counts + identity hashes via `smoke-test.sql > prod_baseline.txt`.
2. In Supabase Dashboard, perform "Restore to a New Project" against the most recent daily backup. Tag the new project `podium-throws-drill-b-YYYYMMDD`.
3. Capture timestamps:
   - `T0` = click "Restore"
   - `T1` = new project status `ACTIVE_HEALTHY` (visible in dashboard)
   - `T2` = first successful psql connection
   - `T3` = smoke test diff returns clean
   - **RTO = T3 − T0**
   - **RPO = T0 − backup snapshot timestamp** (so a daily backup taken at 10:45 UTC and restored at 18:00 UTC = ~7h15m RPO; with PITR active, you could pick a more recent recovery target and reduce this to minutes)
4. Run smoke test against new project, diff against `prod_baseline.txt`.
5. Document: dashboard click-path screenshots, observed RTO/RPO, any extension-disable steps needed, total cost.
6. **Tear down**: Supabase Dashboard → drill project → Settings → General → Pause project (immediately stops billing). Delete after 24h confirmation window.

### Prerequisites for execution

- [ ] Explicit user approval (this drill costs money — even if pennies).
- [ ] Confirm we're not at the org's project-count limit (run `supabase projects list` and count entries under `vercel_icfg_bdpliaNL3Axs0SFnhAluvxi0` org — current: 2 of N).
- [ ] Decide whether to drill against the most recent daily backup or use a specific PITR timestamp (PITR drill exercises a more nuanced code path).
- [ ] Block off 30 min: cloud restore takes 5–15 min, smoke test 1 min, tear down 2 min, plus buffer.

---

## Failure modes seen / anticipated

### 1. `schema "auth" does not exist` when restoring to vanilla Postgres

**Seen during Drill A.** `supabase db dump --data-only` (without `--schema=public`) emits `COPY` statements for `auth.*` and `storage.*` tables. Vanilla Postgres has no `auth` or `storage` schema, so the restore aborts with `ERROR: schema "auth" does not exist`. Combined with `--single-transaction`, this aborts the entire restore — silently if you only check `psql`'s exit code (it returns 0 if the script "ran", even if every statement failed inside the transaction).

**Fix.** When dumping for a vanilla-Postgres target, scope to `--schema public`:

```bash
supabase db dump --db-url "$PROD_URL" --data-only --use-copy --schema public -f data.sql
```

When restoring to a Supabase target (Drill B), the auth/storage schemas exist on the destination, so this scoping is not needed.

**Detection.** Always grep the data-apply log for `^ERROR` — never trust psql's exit code under `--single-transaction`:

```bash
grep -cE "^psql:.*ERROR" data_apply.log   # MUST be 0
```

### 2. `psql --single-transaction` returns 0 even when the transaction aborts

If any statement fails inside the transaction, psql aborts the rest with `current transaction is aborted` notices but still exits 0 once the script ends. Drill A initially reported a "successful" restore against an empty target. Always verify by row-counting after restore.

### 3. Postgres version mismatch (client < server)

Prod runs Postgres 17. macOS Homebrew default is `postgresql@14`. A pg14 `pg_dump` against pg17 may emit warnings or skip newer features; pg14's `psql` may parse pg17 dump files acceptably for plain-SQL output, but custom-format dumps (`-Fc`) won't restore at all.

**Fix.** Use the Supabase CLI (which bundles a pg17-compatible binary inside `public.ecr.aws/supabase/postgres:17.4.1.048`) or run a `postgres:17` Docker container as the restore target. Drill A's script handles this by always restoring into pg17.

### 4. Stale Supabase CLI

CLI versions matter — older CLIs may use older `pg_dump` binaries. Drill A was run on `2.30.4`; latest is `2.90.0`. Upgrade with `brew upgrade supabase` if you see unexplained dump failures.

### 5. Role names referenced in dump don't exist on target

`supabase db dump` emits `GRANT ... TO supabase_admin` and similar. Vanilla Postgres has no such role. Drill A pre-creates 14 stub roles before applying the schema (see `prep.sql` in `run-drill-a.sh`). Restoring into a Supabase target makes this moot — those roles ship with the platform.

### 6. Cloned project's external-side-effect extensions fire twice

Per Supabase docs: after Restore-to-New-Project, **disable `pg_net`, `pg_cron`, and `wrappers` extensions on the restored project** before pointing app traffic at it. We use `pg_cron` for nothing currently (verified `2026-04-27`); confirm before each drill in case that changes.

### 7. Circular FK warnings on `--data-only` dumps

`pg_dump` warns about circular foreign keys on `ProgrammedSession` and `Team` during `--data-only` dumps. These are warnings, not errors — the restore still succeeds because we apply data with `SET session_replication_role = replica`, which suppresses trigger-based FK enforcement during the load. After load, the constraints are checked once on commit. If you ever drop the `session_replication_role = replica` line, expect data load to fail on these two tables.

### 8. Connection string variants

Supabase exposes multiple connection strings:

- `POSTGRES_URL` — pooled (PgBouncer, port 6543), use for app runtime
- `POSTGRES_URL_NON_POOLING` — direct (port 5432), use for migrations + dumps + restores
- `POSTGRES_PRISMA_URL` — pooled with Prisma-friendly query params

Always use `POSTGRES_URL_NON_POOLING` for `pg_dump`/`pg_restore` — pooled connections drop long transactions.

---

## Escalation

- **Supabase support tier:** Pro plan includes email support with target response within 1 business day. For active production outages, file via [supabase.com/dashboard/support/new](https://supabase.com/dashboard/support/new) and mark "Critical".
- **What to send:** project ref, recovery timestamp wanted, exact error message, smoke-test diff if available.
- **Internal escalation:** Tony (toncamedia@gmail.com) — sole engineer at pilot scale.
- **Status page:** [status.supabase.com](https://status.supabase.com) — check before assuming the issue is local.

---

## Re-running the drill

Cadence: **quarterly**, or after any of:

- Major schema migration (>5 tables added/altered)
- Supabase plan change
- Database tier (compute) change
- Storage size crosses 100 MB / 1 GB / 10 GB (RTO scales with size)

To re-run Drill A:

```bash
cd "$(git rev-parse --show-toplevel)"
./scripts/db-restore-drill/run-drill-a.sh
```

If smoke diff is empty, update the "Last drill" line at the top of this file with the new date and observed RTO. If the diff is non-empty, **stop and investigate** — the dump/restore path is broken, which means you cannot trust your recovery story.

---

## Sign-off (last drill)

- [x] Runbook exists and is committed
- [x] Drill A exercised against current production (`2026-04-27`)
- [x] Smoke test passed: 17 tables, 6 identity hashes, 7 referential-integrity probes, 1 three-level join — all matched prod
- [x] Observed RTO (50s end-to-end script run) is well under the 2hr target for pilot scale
- [ ] Drill B exercised — **still pending user approval**, see §[Drill B](#drill-b-cloud-to-cloud-restore-not-yet-exercised)
