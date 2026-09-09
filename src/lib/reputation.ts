import prisma from './db'
import { calculateTrustScore } from './utils'

// Reputation used to be recalculated inline wherever an escrow settled, which
// meant only the client's score ever moved. It lives here now so both sides of
// a deal are scored the same way, from the same numbers.

async function readOrSeed(userId: string) {
  const existing = await prisma.reputationScore.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.reputationScore.create({ data: { userId } })
}

async function write(
  userId: string,
  next: { totalAgreements: number; completedAgreements: number; disputeRate: number },
) {
  const trustScore = Math.round(
    calculateTrustScore(next.totalAgreements, next.completedAgreements, next.disputeRate),
  )
  return prisma.reputationScore.update({
    where: { userId },
    data: { ...next, trustScore },
  })
}

// A deal was struck: it counts toward the denominator for both parties from the
// moment the escrow locks, so abandoning work costs a freelancer their score.
export async function recordEngagement(userIds: (string | null | undefined)[]) {
  for (const userId of userIds) {
    if (!userId) continue
    const rep = await readOrSeed(userId)
    const totalAgreements = rep.totalAgreements + 1
    await write(userId, {
      totalAgreements,
      completedAgreements: rep.completedAgreements,
      disputeRate: recomputeDisputeRate(Number(rep.disputeRate), rep.totalAgreements, totalAgreements),
    })
  }
}

// The client approved and the escrow released.
export async function recordCompletion(userIds: (string | null | undefined)[]) {
  for (const userId of userIds) {
    if (!userId) continue
    const rep = await readOrSeed(userId)
    // An engagement that was never counted (legacy rows) still needs a
    // denominator, or the completion rate would exceed 100%.
    const totalAgreements = Math.max(rep.totalAgreements, rep.completedAgreements + 1)
    await write(userId, {
      totalAgreements,
      completedAgreements: rep.completedAgreements + 1,
      disputeRate: Number(rep.disputeRate),
    })
  }
}

// A dispute was opened. Both parties carry it — the mediator's verdict is what
// separates them later, and a one-sided penalty invites frivolous disputes.
export async function recordDispute(userIds: (string | null | undefined)[]) {
  for (const userId of userIds) {
    if (!userId) continue
    const rep = await readOrSeed(userId)
    const totalAgreements = Math.max(rep.totalAgreements, 1)
    const disputedCount = (Number(rep.disputeRate) / 100) * totalAgreements + 1
    await write(userId, {
      totalAgreements,
      completedAgreements: rep.completedAgreements,
      disputeRate: Math.min(100, (disputedCount / totalAgreements) * 100),
    })
  }
}

// Dispute rate is stored as a percentage, so growing the denominator has to
// rescale it rather than leave it pointing at the old total.
function recomputeDisputeRate(rate: number, oldTotal: number, newTotal: number): number {
  if (newTotal === 0) return 0
  const disputedCount = (rate / 100) * oldTotal
  return Math.min(100, (disputedCount / newTotal) * 100)
}
