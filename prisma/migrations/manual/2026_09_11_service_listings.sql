-- Service listings: a freelancer advertising what they do and what they charge.
--
-- The board until now only ran one direction — a client posts work, freelancers
-- pitch for it. A freelancer had no way to say "I will design your logo, 300
-- NIM, five days" and be found for it. This is that, and it is the other half
-- of the marketplace: clients browse these under Find workers.
--
-- Deliberately its own table rather than another Agreement status. An
-- advertisement carries no escrow, no counterparty and no obligations; an
-- Agreement carries all three. Keeping them apart is what stops an
-- advertisement from ever being mistaken for committed budget, which is the one
-- promise the board makes. Hiring from an advertisement still creates a normal
-- funded Agreement, so every NIM that moves still moves through an HTLC.

CREATE TABLE IF NOT EXISTS "ServiceListing" (
  "id"           TEXT         NOT NULL,
  "providerId"   TEXT         NOT NULL,
  "title"        TEXT         NOT NULL,
  "description"  TEXT         NOT NULL,
  "category"     TEXT         NOT NULL,
  "serviceType"  TEXT,
  "priceNIM"     DECIMAL(65,30) NOT NULL,
  "deliveryDays" INTEGER      NOT NULL,
  -- published: on the client's board. paused: kept, but not listed.
  "status"       TEXT         NOT NULL DEFAULT 'published',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "ServiceListing"
    ADD CONSTRAINT "ServiceListing_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ServiceListing_status_createdAt_idx"
  ON "ServiceListing" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ServiceListing_providerId_idx"
  ON "ServiceListing" ("providerId");
