-- Human mediation: a binding ruling by a platform mediator.
--
-- The AI's verdict is a recommendation either party may refuse, which leaves a
-- rejected verdict with no exit — two people who disagree and an escrow held
-- indefinitely. A person can end that, and because their decision is binding it
-- records who made it and what they said.

ALTER TABLE "Dispute"
  ADD COLUMN IF NOT EXISTS "humanRequestedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "humanRequestedById" TEXT,
  ADD COLUMN IF NOT EXISTS "mediatorId"         TEXT,
  ADD COLUMN IF NOT EXISTS "humanRuling"        TEXT,
  ADD COLUMN IF NOT EXISTS "humanRulingPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "ruledAt"            TIMESTAMP(3);

DO $$
BEGIN
  ALTER TABLE "Dispute"
    ADD CONSTRAINT "Dispute_mediatorId_fkey"
    FOREIGN KEY ("mediatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dispute.status gains: 'escalated' (a verdict was rejected) and
-- 'human_review' (a person has been asked to rule). Plain strings, no enum.
