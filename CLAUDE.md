# NimTrust — Nimiq Mini Apps Competition Build

**AI-powered trust layer for P2P commerce**: AI-generated agreements + HTLC escrow + reputation + AI dispute mediation inside Nimiq Pay.

## Tech Stack

- **Frontend/Backend:** Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui
- **Database:** Supabase Postgres + Prisma ORM (Realtime for messaging)
- **Auth:** Wallet-based (message signing, no passwords)
- **Blockchain:** `@nimiq/mini-app-sdk` (wallet/signing) + `@nimiq/core` (HTLC transactions)
- **AI:** Google Gemini — 3.8 Flash (agreement generation, mediation) + 3.5 Flash-Lite (chat, quick flags)
- **Hosting:** Vercel (frontend) + Supabase (backend)

## Nimiq Mini App Basics

- Mini App loads in Nimiq Pay's WebView; wallet already connected.
- `@nimiq/mini-app-sdk`: `import { init } from '@nimiq/mini-app-sdk'; const nimiq = await init()`
- Methods: `listAccounts()`, `signMessage()`, `isConsensusEstablished()`, `getBlockNumber()`
- Sensitive actions trigger native Nimiq Pay confirmation dialogs.

## HTLC Escrow (Core Differentiation)

Nimiq natively supports Hashed Time-Locked Contracts (not a custom smart contract).

**Flow:**
1. **Create HTLC:** buyer → app builds unsigned HTLC-creation tx (buyer=sender, seller=recipient, `hash_root`=hash of app-controlled secret) → buyer signs in Nimiq Pay → broadcast.
2. **Claim (Seller):** work approved → app reveals pre-image to seller → seller signs claim tx → funds release.
3. **Refund (Buyer):** timeout reached or buyer wins dispute → refund tx after timeout block → funds return to sender.

**Known Gap:** exact SDK method for signing contract-creation transactions not confirmed in docs. **Day 1 spike required.**

## Gemini API Patterns

- **Gemini 3.8 Flash** (reasoning-heavy): agreement generation (user request → structured contract), dispute mediation (review agreement + timeline + messages → verdict).
- **Gemini 3.5 Flash-Lite** (cheap, fast): AI Assistant chat, quick risk-flag checks.

Use structured output via `response_format: { type: 'text', mime_type: 'application/json', schema }` for agreement & mediation — the schema is enforced server-side, so no prompt-level "return valid JSON" pleading.

## Scope (Deep MVP — No Breadth)

**Built end-to-end:**
1. Wallet login (message signing) → profile auto-create.
2. AI Agreement Builder (user text → Gemini generates full contract).
3. Fund escrow (HTLC creation tx).
4. Seller joins, submits milestone.
5. Buyer approves milestone → funds release.
6. Reputation update (trust score, completion rate).
7. Dispute + AI Mediator (Gemini reviews → verdict).
8. Minimal messaging (text only, system events).
9. Trimmed dashboard (active/pending/disputed counts, escrow balance, trust score, one AI insight) + sidebar nav.

**Cut:** reputation badges, global search, notification settings, file attachments, manual agreement builder, multi-sig escrow, DAO arbitration, insurance pools, cross-chain.

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
✅ AI Agreement Builder (Gemini generates contracts)  
✅ Agreement CRUD (create, read, update, filter by status)  
✅ Milestone management (create, submit, approve)  
✅ HTLC Escrow (fund preparation + claim path)  
✅ Reputation System (trust scores, completion rates)  
✅ AI Dispute Mediator (Gemini reviews + verdict)  
✅ Text Messaging (per-agreement chat + system events)  
✅ Dashboard (real-time stats + quick actions)  
✅ User Profiles (trust score, bio, edit)  
✅ Navigation Sidebar (all dashboard pages linked)  

**Next:** Testnet HTLC validation → Mainnet testing → Mobile device testing → Demo recording → Submission

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
│   ├── login/page.tsx          # Message-signing login
│   ├── dashboard/
│   │   ├── page.tsx            # Home (counts, balance, score, AI insight)
│   │   ├── agreements/         # List, create (AI builder), detail, chat
│   │   ├── escrow/             # Locked/released/refunded status
│   │   ├── disputes/           # Dispute list, detail, AI mediator verdict
│   │   └── profile/            # Trust score, completion rate (minimal)
│   └── api/
│       ├── auth/               # challenge, verify (JWT)
│       ├── agreements/         # CRUD + fund, claim routes
│       ├── ai/                 # generate-agreement, chat (Gemini)
│       ├── disputes/           # CRUD + resolve (mediator)
│       └── messages/           # Text only
├── lib/
│   ├── nimiq.ts               # SDK init, HTLC building, block queries
│   ├── gemini.ts              # Gemini client (reasoning + fast tiers)
│   ├── db.ts                  # Prisma singleton
│   ├── auth.ts                # JWT validation
│   └── types.ts               # Shared interfaces
└── components/                 # Header, Sidebar, AgreementForm, EscrowStatus, etc.
```

## Risks & Mitigations

- **HTLC SDK method not confirmed:** Day 1 spike.
- **Mainnet + real funds:** Test thoroughly on testnet first; small amounts on mainnet.
- **10-day deadline:** Pre-agreed cut list keeps scope tight.
- **Mini App in real Nimiq Pay:** Test on actual device before submission.

## Demo Flow

1. Connect wallet in Nimiq Pay.
2. Sign message → choose a marketplace side (offer a service / need a service) → dashboard.
3. "Create Agreement" → type "Build landing page for $500 in 7 days."
4. AI generates full contract; user confirms.
5. Fund escrow (sign HTLC tx).
6. Second user joins, submits milestone.
7. First user approves → funds release.
8. Reputation updated.
9. Open dispute on second agreement → AI mediator verdict.

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
