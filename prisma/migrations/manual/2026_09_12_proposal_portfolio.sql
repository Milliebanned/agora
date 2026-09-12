-- A portfolio link on a proposal.
--
-- A proposal was a cover letter, a price and a delivery time: everything about
-- what the freelancer intends and nothing about what they have already done.
-- For two strangers deciding whether to lock money together, prior work is the
-- most useful thing either of them can show.
ALTER TABLE "Proposal"
  ADD COLUMN IF NOT EXISTS "portfolioUrl" TEXT;
