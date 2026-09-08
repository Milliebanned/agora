// Shared TypeScript interfaces for NimTrust

export interface User {
  id: string
  address: string
  displayName?: string
  bio?: string
  createdAt: Date
  updatedAt: Date
}

export interface Agreement {
  id: string
  title: string
  description: string
  status: 'draft' | 'active' | 'completed' | 'disputed' | 'cancelled'
  buyerId: string
  sellerId?: string
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

export interface AgreementGenerated {
  title: string
  scope: string
  deliverables: string[]
  timeline_days: number
  milestones: Array<{
    title: string
    description: string
  }>
  amount_nim: number
  completion_conditions: string
  refund_conditions: string
  risk_flags: string[]
}

export interface MediatorVerdict {
  case_summary: string
  findings: string
  recommended_outcome: 'release' | 'refund' | 'partial_refund' | 'escalate'
}

export interface SessionJWT {
  userId: string
  address: string
  iat: number
  exp: number
}
