-- Optional username for sign-in (username, email or mobile number all work).
-- Unique per table; NULL for accounts that never set one. Safe to re-run.
ALTER TABLE "CUST_USER"     ADD COLUMN IF NOT EXISTS "username" varchar(50);
ALTER TABLE "PROVIDER_USER" ADD COLUMN IF NOT EXISTS "username" varchar(50);
ALTER TABLE "ADM_USER"      ADD COLUMN IF NOT EXISTS "username" varchar(50);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CUST_USER_username"     ON "CUST_USER" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PROVIDER_USER_username" ON "PROVIDER_USER" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ADM_USER_username"      ON "ADM_USER" ("username");
