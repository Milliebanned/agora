// Shared TypeScript interfaces for NimTrust

// Which side of the marketplace a user is on. Chosen right after wallet
// connect and stored on the profile; null means the choice is still pending.
export type UserRole = 'provider' | 'client'

export interface User {
  id: string
  address: string
  displayName?: string
  bio?: string
  role?: UserRole | null
  createdAt: Date
  updatedAt: Date
}

// Where an opportunity sits in its life. See the Agreement model comment in
// prisma/schema.prisma for what each stage means.
export type OpportunityStatus =
  | 'draft'
  | 'open'
  | 'locked'
  | 'submitted'
  | 'completed'
  | 'disputed'
  // Terminal states reachable only through mediation, once both parties have
  // accepted the mediator's verdict.
  | 'refunded'
  | 'settled'
  | 'cancelled'

export interface Agreement {
  id: string
  title: string
  description: string
  status: OpportunityStatus
  buyerId: string
  sellerId?: string
  category?: string
  serviceType?: string
  timelineDays?: number
  budgetNIM?: number
  attachments: Array<{ label: string; url: string }>
  workSubmission?: string
  amountNIM: number
  deadline: Date
  deliverables: string[]
  completionTerms: string
  refundTerms: string
  htlcAddress?: string
  htlcHashRoot?: string
  htlcPreImage?: string
  htlcTimeout?: number
  riskFlags: string[]
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  lockedAt?: Date
  workSubmittedAt?: Date
  completedAt?: Date
}

export interface Proposal {
  id: string
  agreementId: string
  freelancerId: string
  coverLetter: string
  bidNIM: number
  deliveryDays: number
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  createdAt: Date
  updatedAt: Date
}

export interface Milestone {
  id: string
  agreementId: string
  title: string
  description: string
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  deliverable?: string
  createdAt: Date
  submittedAt?: Date
  approvedAt?: Date
}

export interface EscrowTransaction {
  id: string
  agreementId: string
  type: 'fund' | 'claim' | 'refund'
  status: 'pending' | 'confirmed' | 'failed'
  txHash?: string
  createdAt: Date
  confirmedAt?: Date
}

export interface Message {
  id: string
  agreementId: string
  senderId: string
  type: 'text' | 'system'
  content: string
  createdAt: Date
}

export interface Dispute {
  id: string
  agreementId: string
  openerId: string
  respondentId: string
  reason: string
  status: 'open' | 'under_review' | 'resolved'
  caseSummary?: string
  findings?: string
  recommendedOutcome?: 'release' | 'refund' | 'partial_refund' | 'escalate'
  freelancerPercent?: number
  openerAccepted: boolean
  respondentAccepted: boolean
  createdAt: Date
  resolvedAt?: Date
}

export interface ReputationScore {
  userId: string
  totalAgreements: number
  completedAgreements: number
  avgDeliveryDays: number
  disputeRate: number
  trustScore: number
  updatedAt: Date
}

export interface MediatorVerdict {
  case_summary: string
  findings: string
  recommended_outcome: 'release' | 'refund' | 'partial_refund' | 'escalate'
  freelancer_percent: number
}

export interface SessionJWT {
  userId: string
  address: string
  iat: number
  exp: number
}
