# NimTrust — Nimiq Mini Apps Competition Build

**AI-powered trust layer for P2P commerce**: AI-generated agreements + HTLC escrow + reputation + AI dispute mediation inside Nimiq Pay.

## Tech Stack

- **Frontend/Backend:** Next.js 15 + React 19 + TypeScript + Tailwind + shadcn/ui
- **Database:** Supabase Postgres + Prisma ORM (Realtime for messaging)
- **Auth:** Wallet-based (message signing, no passwords)
- **Blockchain:** `@nimiq/mini-app-sdk` (wallet/signing) + `@nimiq/core` (HTLC transactions)
- **AI:** Claude Sonnet 5 (agreement generation, mediation) + Haiku 4.5 (chat, quick flags)
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

## Claude API Patterns

- **Sonnet 5** (expensive, reasoning-heavy): agreement generation (user request → structured contract), risk analysis, dispute mediation (review agreement + timeline + messages → verdict).
- **Haiku 4.5** (cheap, fast): AI Assistant chat, quick risk-flag checks.

Use structured output via tool use / JSON schema for agreement & mediation.

## Scope (Deep MVP — No Breadth)

**Built end-to-end:**
1. Wallet login (message signing) → profile auto-create.
2. AI Agreement Builder (user text → Sonnet generates full contract).
3. Fund escrow (HTLC creation tx).
4. Seller joins, submits milestone.
5. Buyer approves milestone → funds release.
6. Reputation update (trust score, completion rate).
7. Dispute + AI Mediator (Sonnet reviews → verdict).
8. Minimal messaging (text only, system events).
9. Trimmed dashboard (active/pending/disputed counts, escrow balance, trust score, one AI insight) + sidebar nav.

**Cut:** reputation badges, global search, notification settings, file attachments, manual agreement builder, multi-sig escrow, DAO arbitration, insurance pools, cross-chain.

## Setup Checklist

1. Install Node.js 18+ (`brew install node` or [nodejs.org](https://nodejs.org)).
2. Create public GitHub repo (`nimtrust`).
3. `npm install`
4. Create Supabase project (free tier).
5. Populate `.env.local`: `ANTHROPIC_API_KEY`, Supabase URL, Nimiq network (testnet first), JWT secret, HTLC timeout blocks.
6. `npx prisma migrate dev --name init`
7. Check `nimiq.dev` for official Claude Code skill; install if available.
8. **Day 1 Spike:** validate HTLC transaction-signing method on testnet.
9. `npm run dev` (localhost:3000)

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
│       ├── ai/                 # generate-agreement (Sonnet), chat (Haiku)
│       ├── disputes/           # CRUD + resolve (mediator)
│       └── messages/           # Text only
├── lib/
│   ├── nimiq.ts               # SDK init, HTLC building, block queries
│   ├── claude.ts              # Sonnet/Haiku clients
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
2. Sign message → dashboard.
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
