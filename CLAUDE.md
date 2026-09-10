# NimTrust — Nimiq Mini Apps Competition Build

**Escrow-backed opportunity marketplace for P2P commerce**: structured opportunity postings + HTLC escrow + proposals + reputation + AI dispute mediation inside Nimiq Pay.

The board only lists work whose budget is already committed to escrow, so a freelancer never writes a proposal against money that may not exist.

## Tech Stack

- **Frontend/Backend:** Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui
- **Database:** Supabase Postgres + Prisma ORM (Realtime for messaging)
- **Auth:** Wallet-based (message signing, no passwords)
- **Blockchain:** `@nimiq/mini-app-sdk` (wallet/signing) + `@nimiq/core` (HTLC transactions)
- **AI:** Google Gemini — 3.6 Flash (dispute mediation) + 3.5 Flash-Lite (chat, quick flags). Agreements are *not* AI-generated; clients fill in a structured form.
- **Hosting:** Vercel (frontend) + Supabase (backend)

## Nimiq Mini App Basics

- Mini App loads in Nimiq Pay's WebView; wallet already connected.
- `@nimiq/mini-app-sdk`: `import { init } from '@nimiq/mini-app-sdk'; const nimiq = await init()`
- Methods: `listAccounts()`, `signMessage()`, `isConsensusEstablished()`, `getBlockNumber()`
- Sensitive actions trigger native Nimiq Pay confirmation dialogs.

## HTLC Escrow (Core Differentiation)

Nimiq natively supports Hashed Time-Locked Contracts (not a custom smart contract).

**Flow:**
1. **Commit (client):** posting is funded → app mints the release secret and stores its SHA-256 hash root → opportunity goes live on the board. No chain traffic yet: an HTLC needs a recipient, and no freelancer has been chosen.
2. **Create HTLC (client):** a proposal is accepted → recipient is known → app builds the unsigned creation tx (client=sender, freelancer=recipient, `hash_root` from step 1) → client signs in Nimiq Pay → the contract address is recorded via `POST /api/opportunities/[id]/escrow`.
3. **Claim (freelancer):** client approves the submitted work → app hands the pre-image to the freelancer alone → they sign the claim tx → funds release.
4. **Refund (client):** timeout block reached, or the mediator rules for the client → refund after timeout → funds return to the sender.

**Known Gap:** `@nimiq/mini-app-sdk` documents `listAccounts`, `sign`, `isConsensusEstablished` and `getBlockNumber`, but no contract-creation signing method. `src/lib/nimiq.ts` probes the plausible names and reports honestly when none exist; the escrow panel then falls back to recording a contract address created in the wallet, so a testnet demo is never blocked.

## Gemini API Patterns

- **Gemini 3.6 Flash** (reasoning-heavy): dispute mediation — the original requirements and deliverables, the delivery timeline, the submitted work, and the full chat → verdict.
- **Gemini 3.5 Flash-Lite** (cheap, fast): assistant chat, quick risk-flag checks.

Use structured output via `response_format: { type: 'text', mime_type: 'application/json', schema }` for mediation — the schema is enforced server-side, so no prompt-level "return valid JSON" pleading.

## Scope (Deep MVP — No Breadth)

**Built end-to-end:**
1. Wallet login (message signing) → profile auto-create → marketplace side.
2. Structured opportunity posting (category, service type, description, deliverables, budget, timeline, attachment links).
3. Commit budget → escrow secret minted → posting published to the board.
4. Public board with filters: category, budget band, timeline band, and sort (newest, budget, turnaround).
5. Freelancers submit and revise proposals (cover letter, bid ≤ budget, delivery days).
6. Client accepts one → HTLC created on-chain → private chat opens → losing proposals auto-declined.
7. Freelancer submits work; client approves (releases escrow) or disputes.
8. Freelancer claims the HTLC with the revealed pre-image.
9. Dispute + AI mediator (reviews the work against the original requirements).
10. Reputation (engagement, completion, dispute rate → trust score) for both parties.
11. Dashboard (in progress / taking proposals / escrow committed / trust score) + Deals ledger.

**Cut:** AI-generated agreements (replaced by the structured form), file uploads (attachments are links), milestone workflow, reputation badges, global search, notification settings, multi-sig escrow, DAO arbitration, insurance pools, cross-chain.

## Lifecycle Vocabulary

One `Agreement` row carries a posting through its whole life, so chat, escrow
transactions and disputes stay attached when a posting becomes a contract:

| Status | Meaning |
|---|---|
| `draft` | Posted, budget not yet committed. Private to the client. |
| `open` | Escrow committed, live on the board, taking proposals. |
| `locked` | Proposal accepted, HTLC created, work under way. Chat open. |
| `submitted` | Work handed in, awaiting the client's review. |
| `completed` | Approved; the freelancer can claim the escrow. |
| `disputed` | Escalated to the AI mediator. |
| `settled` | A mediated verdict both parties accepted split the escrow. |
| `refunded` | A mediated verdict returned the escrow to the client. |
| `cancelled` | Withdrawn before a freelancer was engaged. |

Escrow stage is *derived*, never stored separately (`escrowStage()` in
`src/lib/opportunities.ts`): `unfunded → held → assigned → released / refunded /
split`.

## AI Dispute Mediation

Either party can dispute a `locked` or `submitted` deal. The mediator
(Gemini 3.6 Flash, schema-enforced) reads the original requirements and
deliverables, the delivery timeline with lateness flagged, the submitted work,
and the last 40 chat messages, then returns `release` / `refund` /
`partial_refund` / `escalate` **plus `freelancer_percent`** — the share it
judges the freelancer to have earned, on every verdict.

**The verdict is a recommendation, not an instruction.** It moves nothing.
`POST /api/disputes/[id]/settle` records one party's acceptance; the second
acceptance triggers the payout, splitting the escrow in integer luna so the two
legs sum to the total exactly. `escalate` cannot be accepted at all — the
mediator declined to call it, so the case needs a human.

Neither Gemini nor the platform can move money alone. That is the point, and it
is the honest answer to "you let an AI decide who gets paid?".

## Build Status: ✅ COMPLETE (5 Days)

**Days 1-5: Feature Development** ✅ DONE  
**Days 6-10: Testing & Refinement** → IN PROGRESS

### Completed Features

| Day | Feature | Status |
|-----|---------|--------|
| 1 | Auth + Agreement CRUD + AI Builder | ✅ Complete |
| 2 | HTLC Escrow (fund + claim paths) | ✅ Complete |
| 3 | Disputes + AI Mediator + Messaging | ✅ Complete |
| 4 | Reputation Dashboard + Profile | ✅ Complete |
| 5 | Dashboard + All UI + Polish | ✅ Complete |

### All Features Implemented

✅ Wallet login (message signing, no passwords)  
✅ Role onboarding (offer a service vs. require a service, switchable in profile)  
✅ Structured opportunity posting (category, service type, brief, deliverables, budget, timeline, attachment links)  
✅ Budget commitment → escrow secret → published to the public board  
✅ Opportunity board with category / budget / timeline filters and sorting  
✅ Proposals (submit, revise, withdraw; rival bids stay private)  
✅ Acceptance → HTLC creation → losing proposals auto-declined  
✅ HTLC Escrow (commit → lock → release → claim, with an honest manual fallback)  
✅ Private chat, opened on selection, retained as dispute evidence  
✅ Work submission and client approval (approval reveals the pre-image)  
✅ Reputation System (engagement, completion, dispute rate, trust score — both parties)  
✅ AI Dispute Mediator (reads the work against the original requirements)  
✅ Dashboard + Deals ledger + navigation  

**Next:** Apply the marketplace migration (`prisma/migrations/manual/2026_09_09_opportunity_marketplace.sql` or `npx prisma db push`) → Testnet HTLC validation → Mainnet testing → Mobile device testing → Demo recording → Submission

## Setup Checklist

1. Install Node.js 18+ (`brew install node` or [nodejs.org](https://nodejs.org)).
2. `npm install` from `/Users/Apple/nimtrust`
3. Create Supabase project (free tier).
4. Populate `.env.local`: `GEMINI_API_KEY`, Supabase URL, Nimiq network (testnet), JWT secret.
5. `npx prisma migrate dev --name init`
6. `npm run dev` (localhost:3000)
7. **Start building immediately** — follow Day 1 focus above.

## Project Structure

```
src/
├── app/
│   ├── login/page.tsx              # Message-signing login
│   ├── onboarding/page.tsx         # Pick a marketplace side
│   ├── dashboard/
│   │   ├── page.tsx                # Home (counts, escrow, trust score)
│   │   ├── opportunities/          # Board, new posting form, detail page
│   │   ├── agreements/             # "Deals" — your private ledger
│   │   ├── disputes/               # Dispute list, detail, AI verdict
│   │   └── profile/                # Trust score, completion rate
│   └── api/
│       ├── auth/                   # challenge, verify, session, role
│       ├── opportunities/          # board + CRUD, fund, escrow, proposals,
│       │                           #   proposals/[id] (accept/reject/withdraw),
│       │                           #   submit, approve, claim
│       ├── agreements/             # read-only party ledger
│       ├── disputes/               # CRUD + resolve (mediator)
│       └── messages/               # Private chat, parties only
├── lib/
│   ├── nimiq.ts                    # SDK init, HTLC build/sign, block queries
│   ├── opportunities.ts            # Categories, filters, escrow stages, parsers
│   ├── reputation.ts               # Trust score updates for both parties
│   ├── gemini.ts                   # Gemini client (mediation + fast tier)
│   ├── db.ts / auth.ts / types.ts / utils.ts
└── components/
    ├── Sidebar, MobileNav, RoleGate
    └── opportunity/                # FilterBar, EscrowPanel, ProposalPanel,
                                    #   WorkPanel, ChatPanel
```

## Risks & Mitigations

- **HTLC SDK method not confirmed:** Day 1 spike.
- **Mainnet + real funds:** Test thoroughly on testnet first; small amounts on mainnet.
- **10-day deadline:** Pre-agreed cut list keeps scope tight.
- **Mini App in real Nimiq Pay:** Test on actual device before submission.

## Demo Flow

1. Connect wallet in Nimiq Pay.
2. Sign message → choose a marketplace side (offer a service / need a service) → dashboard.
3. "Post opportunity" → fill the form: Development / Web app, brief, three deliverables, 500 NIM, 7 days, a link to the spec.
4. "Commit budget & publish" → escrow secret minted, posting goes live on the board.
5. Second wallet browses Opportunities, filters by category and budget, opens the posting, submits a proposal (450 NIM, 5 days).
6. First wallet reviews the proposal and accepts → HTLC created in Nimiq Pay → private chat opens.
7. Freelancer submits the work with delivery links.
8. Client approves → escrow released → freelancer claims with the pre-image.
9. Reputation updates for both wallets.
10. On a second deal, open a dispute → AI mediator reads the work against the original requirements → verdict.

## Judging (Nimiq Community Council)

- **Functionality** (20%) — end-to-end working?
- **Nimiq Pay Integration** (25%) — deep HTLC escrow use? (Our differentiator.)
- **Real-World Usage** (20%) — solves real problem?
- **Design Quality** (20%) — polished, intuitive?
- **Builder Promotion** (15%) — effort to promote?

## Commands

```bash
npm install && npx prisma migrate dev --name init
npm run dev                    # localhost:3000
npx prisma studio            # DB GUI
vercel deploy                 # After linking repo
```

**Submission Deadline:** Sept 18, 2026. Prize: $10k/$5k/$2k (top 3).
