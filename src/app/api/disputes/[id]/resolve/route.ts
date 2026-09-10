import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'
import { generateMediatorVerdict, isGeminiConfigured } from '@/lib/gemini'
import { formatDate, parseJsonArray } from '@/lib/utils'
import { categoryLabel, parseAttachments } from '@/lib/opportunities'
import prisma from '@/lib/db'

// Same reason as the agreement builder: a model call blows past Vercel's 10s
// default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const session = request.cookies.get('session')?.value
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifySessionToken(session)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: id },
      include: {
        agreement: {
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
            milestones: true,
            buyer: { select: { displayName: true } },
            seller: { select: { displayName: true } },
          },
        },
        opener: { select: { displayName: true } },
        respondent: { select: { displayName: true } },
      },
    })

    if (!dispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    // A verdict is evidence in someone else's disagreement. Only the two people
    // bound by it may ask for one — and, as in the read route, a stranger is
    // told the dispute does not exist rather than that they may not see it.
    if (dispute.openerId !== user.userId && dispute.respondentId !== user.userId) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    }

    // Re-running the mediator once somebody has accepted would let a party who
    // dislikes the verdict roll the dice again, silently discarding the other
    // side's acceptance. A settled dispute is likewise final.
    if (dispute.status === 'resolved') {
      return NextResponse.json(
        { error: 'This dispute has already been settled.' },
        { status: 409 },
      )
    }
    if (dispute.openerAccepted || dispute.respondentAccepted) {
      return NextResponse.json(
        { error: 'A verdict is already on the table and has been accepted by one party.' },
        { status: 409 },
      )
    }

    // The mediator is judged on one thing: whether it read the deal that was
    // actually struck. So the context it gets is the posting as written — the
    // brief, the deliverables the freelancer signed up to, the money, the
    // clock — and then what happened against it.
    const opportunity = dispute.agreement
    const deliverables = parseJsonArray(opportunity.deliverables)
    const attachments = parseAttachments(opportunity.attachments)

    const agreementDetails = `
Opportunity: ${opportunity.title}
Category: ${categoryLabel(opportunity.category)}${opportunity.serviceType ? ` — ${opportunity.serviceType}` : ''}
Posted budget: ${Number(opportunity.budgetNIM ?? opportunity.amountNIM)} NIM
Escrow locked at: ${Number(opportunity.amountNIM)} NIM
Client: ${opportunity.buyer.displayName ?? 'Client'}
Freelancer: ${opportunity.seller?.displayName ?? 'Unassigned'}
Posted: ${formatDate(opportunity.createdAt)}
Agreed delivery deadline: ${formatDate(opportunity.deadline)}
Current status: ${opportunity.status}

=== ORIGINAL REQUIREMENTS (what the freelancer accepted) ===
${opportunity.description}

Deliverables the freelancer committed to:
${deliverables.length > 0 ? deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n') : 'None itemised in the posting.'}

Reference material supplied with the posting:
${attachments.length > 0 ? attachments.map((a) => `- ${a.label} (${a.url})`).join('\n') : 'None.'}

Completion terms: ${opportunity.completionTerms}
Refund terms: ${opportunity.refundTerms}
`

    const timeline = [
      `Opportunity posted: ${formatDate(opportunity.createdAt)}`,
      opportunity.publishedAt && `Budget committed and listed: ${formatDate(opportunity.publishedAt)}`,
      opportunity.lockedAt && `Freelancer accepted, escrow locked: ${formatDate(opportunity.lockedAt)}`,
      `Delivery was due: ${formatDate(opportunity.deadline)}`,
      opportunity.workSubmittedAt
        ? `Work submitted: ${formatDate(opportunity.workSubmittedAt)}${
            opportunity.workSubmittedAt > opportunity.deadline ? ' (AFTER the deadline)' : ' (on time)'
          }`
        : 'No work was ever submitted.',
      ...opportunity.milestones.map(
        (m) => `Milestone "${m.title}" — ${m.status} at ${formatDate(m.createdAt)}`,
      ),
      `Dispute opened by ${dispute.opener.displayName ?? 'a party'}: ${formatDate(dispute.createdAt)}`,
    ]
      .filter(Boolean)
      .join('\n')

    const messages = opportunity.messages
      .slice(-40)
      .map(
        (m) =>
          `[${formatDate(m.createdAt)}] ${m.type === 'system' ? 'SYSTEM' : m.senderId === opportunity.buyerId ? 'CLIENT' : 'FREELANCER'}: ${m.content}`,
      )
      .join('\n')

    const submittedWork =
      opportunity.workSubmission ??
      opportunity.milestones
        .filter((m) => m.deliverable)
        .map((m) => `${m.title}: ${m.deliverable}`)
        .join('\n\n')

    const disputeContext = `
=== THE DISPUTE ===
Raised by: ${dispute.opener.displayName ?? 'a party'} (${dispute.openerId === opportunity.buyerId ? 'the client' : 'the freelancer'})
Against: ${dispute.respondent.displayName ?? 'the other party'}
Their reason: ${dispute.reason}
`

    // Generate verdict using Gemini
    const verdict = await generateMediatorVerdict(
      agreementDetails + disputeContext,
      timeline,
      messages,
      submittedWork || 'No work was submitted.',
    )

    // The schema guarantees the field is present and an integer; it does not
    // guarantee the model kept it inside 0-100, and this number is multiplied
    // by real money further down. Clamp it here, at the boundary, and force
    // the two unambiguous outcomes to the only percentages they can mean.
    const percent =
      verdict.recommended_outcome === 'release'
        ? 100
        : verdict.recommended_outcome === 'refund'
          ? 0
          : Math.max(0, Math.min(100, Math.round(verdict.freelancer_percent ?? 0)))

    // Update dispute with verdict
    const updated = await prisma.dispute.update({
      where: { id: id },
      data: {
        status: 'under_review',
        caseSummary: verdict.case_summary,
        findings: verdict.findings,
        recommendedOutcome: verdict.recommended_outcome,
        freelancerPercent: percent,
      },
      include: {
        opener: { select: { displayName: true, id: true } },
        respondent: { select: { displayName: true, id: true } },
      },
    })

    // Add system message about verdict
    await prisma.message.create({
      data: {
        agreementId: dispute.agreementId,
        senderId: user.userId,
        type: 'system',
        content:
          `AI Mediator Verdict: ${verdict.recommended_outcome.replace('_', ' ').toUpperCase()}` +
          (verdict.recommended_outcome === 'escalate'
            ? ''
            : ` — ${percent}% to the freelancer, ${100 - percent}% back to the client`) +
          `. ${verdict.case_summary}\n\nThis is a recommendation. It moves nothing until both parties accept it.`,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    // The mediator is the headline feature, so a failure names its own cause
    // rather than hiding behind "Internal server error".
    console.error('Resolve dispute error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: isGeminiConfigured() ? 'AI mediation failed' : 'GEMINI_API_KEY is not set',
        detail,
      },
      { status: 500 },
    )
  }
}
