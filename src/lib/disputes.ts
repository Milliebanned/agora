import prisma from './db'
import { isPlatformAdmin } from './admin'

// The one shape of a dispute that the dispute page can render.
//
// It lives here because two routes hand a dispute back to that page: the one
// that reads it and the one that writes a verdict onto it. They disagreed. The
// verdict route returned the row it had just updated, with only the two parties
// attached and no agreement, no amount, no mediator. The page set that into
// state and the next render reached for `dispute.agreement.title`, which was
// now undefined, and threw.
//
// What that looked like from outside was the mediator failing: press "Request
// verdict", get "Something broke", press retry, and there the verdict is. The
// verdict had been written correctly the first time every time. Only the screen
// had fallen over, and the reload behind the retry fetched the shape it could
// actually draw.
//
// So the projection is written once and both routes use it.

const DISPUTE_INCLUDE = {
  opener: { select: { id: true, displayName: true, address: true } },
  respondent: { select: { id: true, displayName: true, address: true } },
  mediator: { select: { id: true, displayName: true } },
  agreement: {
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      amountNIM: true,
      buyerId: true,
      sellerId: true,
    },
  },
} as const

export type DisputeAccess =
  | { ok: true; dispute: Record<string, unknown> }
  | { ok: false; status: number; error: string }

/**
 * Load a dispute for one reader, as the page expects to receive it.
 *
 * Returns the same object for a read and for a write, including the fields
 * derived per reader: the escrow amount in NIM, which side of the deal they are
 * on, and whether they are looking at it as a platform mediator rather than as
 * a party.
 */
export async function disputeForViewer(id: string, userId: string): Promise<DisputeAccess> {
  const dispute = await prisma.dispute.findUnique({ where: { id }, include: DISPUTE_INCLUDE })
  if (!dispute) {
    return { ok: false, status: 404, error: 'Dispute not found' }
  }

  const isParty = dispute.openerId === userId || dispute.respondentId === userId

  // A platform mediator has to be able to read a case to rule on it, so they
  // are the one non-party who may. That access is real and worth being honest
  // about: whoever is named in PLATFORM_ADMIN_ADDRESSES can read the reason,
  // the work and the chat of any dispute on the platform.
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { address: true } })
  const isMediator = isPlatformAdmin(me?.address)

  if (!isParty && !isMediator) {
    // Not 403: confirming that a dispute exists at this id is itself a leak.
    return { ok: false, status: 404, error: 'Dispute not found' }
  }

  return {
    ok: true,
    dispute: {
      ...dispute,
      amountNIM: Number(dispute.agreement.amountNIM),
      // The page needs to know which side of the deal the reader is on to say
      // what a verdict would mean for them, and the roles are on the agreement
      // rather than the dispute.
      viewerRole: dispute.agreement.buyerId === userId ? 'client' : 'freelancer',
      viewerIsMediator: isMediator && !isParty,
    },
  }
}
