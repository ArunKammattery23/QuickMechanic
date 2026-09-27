-- Apply with the normal reviewed database migration workflow before the new backend.
-- Additive only; historical jobs have no attributable rating and stay unrated.
BEGIN;
ALTER TABLE mechanic_profiles ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "customerRating" smallint;
CREATE INDEX IF NOT EXISTS idx_provider_status ON service_requests ("mechanicId", status);
COMMIT;
