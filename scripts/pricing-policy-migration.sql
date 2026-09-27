-- Apply after job-ledger-migration.sql, locally first. Existing jobs retain zero fees.
BEGIN;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "pricingRevision" integer;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "commissionBps" integer NOT NULL DEFAULT 0;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "commissionMinor" bigint NOT NULL DEFAULT 0;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "platformFeeMinor" bigint NOT NULL DEFAULT 0;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "providerNetMinor" bigint;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "paymentMode" varchar NOT NULL DEFAULT 'live';
CREATE TABLE IF NOT EXISTS pricing_policies (
  revision serial PRIMARY KEY,
  "commissionBps" integer NOT NULL CHECK ("commissionBps" BETWEEN 0 AND 10000),
  "platformFeeMinor" bigint NOT NULL CHECK ("platformFeeMinor" = 0 OR "platformFeeMinor" BETWEEN 200 AND 500),
  "changedBy" varchar NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_environment (id integer PRIMARY KEY CHECK (id = 1), mode varchar NOT NULL CHECK (mode IN ('simulation','razorpay_test','live')));
DROP TRIGGER IF EXISTS pricing_policy_immutable ON pricing_policies;
CREATE TRIGGER pricing_policy_immutable BEFORE UPDATE OR DELETE ON pricing_policies FOR EACH ROW EXECUTE FUNCTION qm_reject_history_mutation();
DROP TRIGGER IF EXISTS payment_environment_immutable ON payment_environment;
CREATE TRIGGER payment_environment_immutable BEFORE UPDATE OR DELETE ON payment_environment FOR EACH ROW EXECUTE FUNCTION qm_reject_history_mutation();
COMMIT;
