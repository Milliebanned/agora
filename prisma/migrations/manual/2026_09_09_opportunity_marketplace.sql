-- Opportunity marketplace: structured postings, proposals, and the lifecycle
-- timestamps the escrow flow hangs off.
--
-- Every change is additive, so it is safe to run against a database that already
-- holds agreements from the earlier flow. Apply it with `npx prisma db push`
-- against a direct (port 5432) connection, or paste it into the Supabase SQL
-- editor if only the pooler is reachable.

-- 1. Structured posting fields on the existing Agreement table.
ALTER TABLE "Agreement"
  ADD COLUMN IF NOT EXISTS "category"        TEXT,
  ADD COLUMN IF NOT EXISTS "serviceType"     TEXT,
  ADD COLUMN IF NOT EXISTS "timelineDays"    INTEGER,
  ADD COLUMN IF NOT EXISTS "budgetNIM"       DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "attachments"     TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "workSubmission"  TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "workSubmittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt"     TIMESTAMP(3);

-- 2. Proposals — a freelancer's pitch for an open opportunity.
CREATE TABLE IF NOT EXISTS "Proposal" (
  "id"           TEXT           NOT NULL,
  "agreementId"  TEXT           NOT NULL,
  "freelancerId" TEXT           NOT NULL,
  "coverLetter"  TEXT           NOT NULL,
  "bidNIM"       DECIMAL(65,30) NOT NULL,
  "deliveryDays" INTEGER        NOT NULL,
  "status"       TEXT           NOT NULL DEFAULT 'pending',
  "createdAt"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- One pitch per freelancer per opportunity; re-pitching edits it in place.
CREATE UNIQUE INDEX IF NOT EXISTS "Proposal_agreementId_freelancerId_key"
  ON "Proposal" ("agreementId", "freelancerId");
CREATE INDEX IF NOT EXISTS "Proposal_agreementId_status_idx"
  ON "Proposal" ("agreementId", "status");

DO $$ BEGIN
  ALTER TABLE "Proposal"
    ADD CONSTRAINT "Proposal_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "Agreement" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Proposal"
    ADD CONSTRAINT "Proposal_freelancerId_fkey"
    FOREIGN KEY ("freelancerId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Indexes the board and the deals list read through.
CREATE INDEX IF NOT EXISTS "Agreement_status_publishedAt_idx"
  ON "Agreement" ("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "Agreement_buyerId_idx" ON "Agreement" ("buyerId");
CREATE INDEX IF NOT EXISTS "Agreement_sellerId_idx" ON "Agreement" ("sellerId");

-- 4. Backfill. Rows written by the old AI-drafting flow used "active" for what
--    is now "locked", and had no separate budget column.
UPDATE "Agreement" SET "status" = 'locked' WHERE "status" = 'active';
UPDATE "Agreement" SET "budgetNIM" = "amountNIM" WHERE "budgetNIM" IS NULL;
UPDATE "Agreement"
  SET "publishedAt" = "createdAt"
  WHERE "publishedAt" IS NULL AND "htlcHashRoot" IS NOT NULL;

-- 5. Row Level Security.
--
-- The app reaches Postgres only through Prisma on DATABASE_URL, as the
-- `postgres` role — which owns these tables and carries BYPASSRLS, so RLS never
-- applies to it. What RLS closes here is the other door: Supabase publishes
-- every table in `public` through PostgREST, and a table with RLS disabled is
-- readable by anyone holding the anon key. "Agreement" stores htlcPreImage, the
-- secret that spends the HTLC, so that door has to be shut.
--
-- RLS enabled with no policies denies every PostgREST role outright. All real
-- authorization lives in the API routes, behind the session JWT.
ALTER TABLE "Proposal"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Agreement"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dispute"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EscrowTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReputationScore"   ENABLE ROW LEVEL SECURITY;

-- Confirm afterwards: every row should read rowsecurity = true.
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
