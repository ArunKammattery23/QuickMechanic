-- Run against local PostgreSQL first. Back up production and stop old API writers
-- before applying this additive migration and rolling out backend + both apps.
ALTER TYPE service_requests_status_enum ADD VALUE IF NOT EXISTS 'AWAITING_CUSTOMER_CONFIRMATION';
BEGIN;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "providerAcceptedAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "customerAcceptedAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "confirmedAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "completionRequestedAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "completedAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "cancellationReason" varchar;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "cancelledBy" varchar;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "razorpayLinkId" varchar;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "checkoutUrl" varchar;
CREATE INDEX IF NOT EXISTS idx_provider_job_history ON service_requests ("mechanicId", "createdAt", id);
CREATE INDEX IF NOT EXISTS idx_customer_job_history ON service_requests ("customerId", "createdAt", id);
CREATE TABLE IF NOT EXISTS wallet_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar NOT NULL UNIQUE,
 currency varchar NOT NULL DEFAULT 'INR', "balanceMinor" bigint NOT NULL DEFAULT 0,
 CONSTRAINT wallet_nonnegative CHECK (key LIKE 'external:%' OR "balanceMinor" >= 0)
);
CREATE TABLE IF NOT EXISTS payment_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar NOT NULL UNIQUE,
 "fromAccountId" uuid NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
 "toAccountId" uuid NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
 "jobId" uuid REFERENCES service_requests(id) ON DELETE RESTRICT,
 "amountMinor" bigint NOT NULL CHECK ("amountMinor" >= 0), kind varchar NOT NULL,
 currency varchar NOT NULL DEFAULT 'INR', description varchar NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now(),
 CHECK ("fromAccountId" <> "toAccountId")
);
CREATE INDEX IF NOT EXISTS ledger_debits ON payment_ledger ("fromAccountId", "createdAt", id);
CREATE INDEX IF NOT EXISTS ledger_credits ON payment_ledger ("toAccountId", "createdAt", id);
CREATE INDEX IF NOT EXISTS ledger_jobs ON payment_ledger ("jobId", "createdAt", id);
CREATE TABLE IF NOT EXISTS withdrawal_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "providerId" uuid NOT NULL,
 "withdrawalId" uuid NOT NULL REFERENCES payment_ledger(id) ON DELETE RESTRICT,
 "jobId" uuid REFERENCES service_requests(id) ON DELETE RESTRICT,
 "amountMinor" bigint NOT NULL CHECK ("amountMinor" > 0)
);
CREATE INDEX IF NOT EXISTS withdrawal_jobs ON withdrawal_allocations ("providerId", "jobId");
CREATE TABLE IF NOT EXISTS job_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "jobId" uuid NOT NULL REFERENCES service_requests(id) ON DELETE RESTRICT,
 type varchar NOT NULL, "actorId" varchar NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_timeline ON job_events ("jobId", "createdAt", id);
INSERT INTO job_events ("jobId", type, "actorId", details)
 SELECT j.id, 'LEGACY_SNAPSHOT', 'MIGRATION', jsonb_build_object('status',j.status,'totalAmount',j."totalAmount",'createdAt',j."createdAt")
 FROM service_requests j WHERE NOT EXISTS (SELECT 1 FROM job_events e WHERE e."jobId"=j.id);
CREATE OR REPLACE FUNCTION qm_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Financial and job history is append-only'; END $$;
DROP TRIGGER IF EXISTS ledger_immutable ON payment_ledger;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON payment_ledger FOR EACH ROW EXECUTE FUNCTION qm_reject_history_mutation();
DROP TRIGGER IF EXISTS allocation_immutable ON withdrawal_allocations;
CREATE TRIGGER allocation_immutable BEFORE UPDATE OR DELETE ON withdrawal_allocations FOR EACH ROW EXECUTE FUNCTION qm_reject_history_mutation();
DROP TRIGGER IF EXISTS job_history_immutable ON job_events;
CREATE TRIGGER job_history_immutable BEFORE UPDATE OR DELETE ON job_events FOR EACH ROW EXECUTE FUNCTION qm_reject_history_mutation();
COMMIT;
