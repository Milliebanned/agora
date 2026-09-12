-- Notifications, and the link from an advertisement to the deals it produced.
--
-- Two unrelated-looking additions that share a cause: the app could not tell
-- anyone that something had happened to them, and an advertisement had no way
-- to know whether work had ever come out of it. Both were invisible state that
-- only existed in someone's head.

-- Which advertisement a posting was hired from, when it was. Nullable because
-- most postings are written from scratch, not hired from an ad.
ALTER TABLE "Agreement"
  ADD COLUMN IF NOT EXISTS "sourceListingId" TEXT;

CREATE INDEX IF NOT EXISTS "Agreement_sourceListingId_idx"
  ON "Agreement" ("sourceListingId");

-- Deliberately no foreign key: deleting an advertisement must never be able to
-- touch a deal that came out of it. The deal is its own contract with its own
-- escrow the moment it is funded, and it outlives the ad that introduced the
-- two parties.

CREATE TABLE IF NOT EXISTS "Notification" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  -- The nav href this belongs under, so the badge and the navigation agree by
  -- construction rather than through a mapping that can drift.
  "tab"         TEXT         NOT NULL,
  "type"        TEXT         NOT NULL,
  "body"        TEXT         NOT NULL,
  "href"        TEXT,
  "agreementId" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt"      TIMESTAMP(3),

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx"
  ON "Notification" ("userId", "readAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_tab_readAt_idx"
  ON "Notification" ("userId", "tab", "readAt");
