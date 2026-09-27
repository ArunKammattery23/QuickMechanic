BEGIN;
ALTER TABLE mechanic_profiles ADD COLUMN IF NOT EXISTS "kycDocumentsVerified" boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS provider_kyc_submissions (
  "providerId" uuid PRIMARY KEY REFERENCES "PROVIDER_USER"(id) ON DELETE RESTRICT,
  "idType" varchar(32) NOT NULL,
  address varchar(500) NOT NULL,
  "secondaryPhone" varchar(16) NOT NULL,
  "frontImage" bytea NOT NULL,
  "backImage" bytea NOT NULL,
  "frontMime" varchar(16) NOT NULL,
  "backMime" varchar(16) NOT NULL,
  "submittedAt" timestamptz NOT NULL DEFAULT now(),
  "reviewedAt" timestamptz,
  "reviewedById" uuid
);
COMMIT;
