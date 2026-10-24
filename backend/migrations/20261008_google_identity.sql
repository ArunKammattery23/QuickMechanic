-- Reviewed schema change for a future production deployment. Run against the
-- intended database only after approval; development uses TypeORM synchronize.
-- Nullable subjects allow existing password accounts to remain unlinked.
BEGIN;
ALTER TABLE "CUST_USER"
  ADD COLUMN IF NOT EXISTS "googleSubject" varchar(255);
ALTER TABLE "PROVIDER_USER"
  ADD COLUMN IF NOT EXISTS "googleSubject" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CUST_USER_googleSubject"
  ON "CUST_USER" ("googleSubject");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PROVIDER_USER_googleSubject"
  ON "PROVIDER_USER" ("googleSubject");
COMMIT;
