-- Mediated settlement: a verdict becomes binding only when both parties accept
-- it, and the split it reasoned to is what the payout arithmetic uses.
--
-- Apply with:  psql "$DATABASE_URL" -f prisma/migrations/manual/2026_09_10_dispute_settlement.sql
-- or let `npx prisma db push` derive the same thing from schema.prisma.

ALTER TABLE "Dispute"
  ADD COLUMN IF NOT EXISTS "freelancerPercent"  INTEGER,
  ADD COLUMN IF NOT EXISTS "openerAccepted"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "respondentAccepted" BOOLEAN NOT NULL DEFAULT false;

-- Agreement.status gains two terminal states reachable only through mediation:
--   'refunded'  the escrow went back to the client in full
--   'settled'   the escrow was split between the two parties
-- Both are plain strings in an unconstrained column, so there is no enum to
-- alter — this comment is the migration's only content for them.
