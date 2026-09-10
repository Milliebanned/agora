// The shape the opportunity detail endpoint returns, shared by the panels that
// render it. Decimal columns arrive as strings over JSON, hence the unions.
export interface Party {
  id: string
  address: string
  displayName: string | null
}

export interface ProposalRow {
  id: string
  freelancerId: string
  coverLetter: string
  bidNIM: string | number
  deliveryDays: number
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'
  createdAt: string
  freelancer: Party & {
    bio?: string | null
    reputationScores?: { trustScore: number; completedAgreements: number } | null
  }
}

export interface MessageRow {
  id: string
  senderId: string
  type: 'text' | 'system'
  content: string
  createdAt: string
  sender?: { id: string; displayName: string | null }
}

export interface EscrowTxRow {
  type: string
  status: string
  txHash: string | null
  createdAt: string
}

export interface OpportunityDetail {
  id: string
  title: string
  description: string
  status: string
  category: string | null
  serviceType: string | null
  timelineDays: number | null
  budgetNIM: string | number | null
  amountNIM: string | number
  deadline: string
  deliverables: string
  attachments: string
  completionTerms: string
  refundTerms: string
  workSubmission: string | null
  workSubmittedAt: string | null
  htlcAddress: string | null
  htlcHashRoot: string | null
  htlcTimeout: number | null
  createdAt: string
  publishedAt: string | null
  lockedAt: string | null
  completedAt: string | null
  buyerId: string
  sellerId: string | null
  buyer: Party
  seller: Party | null
  proposals: ProposalRow[]
  proposalCount: number
  messages: MessageRow[]
  escrowTransactions: EscrowTxRow[]
  disputes: Array<{ id: string; status: string; createdAt: string }>
  preImageAvailable: boolean
  viewer: { id: string; isClient: boolean; isFreelancer: boolean; isParty: boolean
    isMediator?: boolean }
}
