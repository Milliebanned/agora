-- Let a party reject a verdict, not merely fail to accept one.
--
-- Acceptance was a boolean, so refusing and not having looked yet were the same
-- state: a deal could sit under review forever with no way to say "I disagree"
-- and no way for the other side to tell the difference.

ALTER TABLE "Dispute"
  ADD COLUMN IF NOT EXISTS "openerDecision"     TEXT,
  ADD COLUMN IF NOT EXISTS "respondentDecision" TEXT;

-- Carry across whatever the booleans already recorded. An unset boolean stays
-- NULL rather than becoming "rejected" — nobody refused anything yet.
UPDATE "Dispute" SET "openerDecision"     = 'accepted' WHERE "openerAccepted"     = true;
UPDATE "Dispute" SET "respondentDecision" = 'accepted' WHERE "respondentAccepted" = true;

ALTER TABLE "Dispute" DROP COLUMN IF EXISTS "openerAccepted";
ALTER TABLE "Dispute" DROP COLUMN IF EXISTS "respondentAccepted";
