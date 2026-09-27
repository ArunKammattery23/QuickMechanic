-- Apply after pricing-policy-migration.sql. Existing issued quotations are unchanged.
BEGIN;
ALTER TABLE pricing_policies ADD COLUMN IF NOT EXISTS "travelMinimumMinor" bigint NOT NULL DEFAULT 5000;
ALTER TABLE pricing_policies ADD COLUMN IF NOT EXISTS "travelIncludedMeters" integer NOT NULL DEFAULT 2500;
ALTER TABLE pricing_policies ADD COLUMN IF NOT EXISTS "travelPerKmMinor" bigint NOT NULL DEFAULT 800;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "vehicleCategoryId" uuid;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "autoQuotePreparedAt" timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS "routeDistanceMeters" integer;
ALTER TABLE pricing_policies ADD CONSTRAINT pricing_travel_rates_valid CHECK ("travelMinimumMinor" >= 0 AND "travelIncludedMeters" >= 0 AND "travelPerKmMinor" >= 0);
COMMIT;
