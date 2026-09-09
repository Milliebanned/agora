# NimTrust — Nimiq Mini Apps Competition

AI-powered trust layer for P2P commerce: AI-generated agreements + HTLC escrow + reputation + AI dispute mediation.

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier OK)
- Anthropic API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local from .env.example
cp .env.example .env.local

# 3. Update .env.local with real credentials:
#    - GEMINI_API_KEY from aistudio.google.com/apikey
#    - DATABASE_URL from Supabase PostgreSQL connection
#    - Nimiq RPC endpoints from nimiq.dev/mini-apps

# 4. Initialize database
npx prisma migrate dev --name init

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Frontend/Backend:** Next.js 15 + React 19 + TypeScript
- **Database:** Supabase Postgres + Prisma ORM
- **Auth:** Wallet-based (message signing)
- **Blockchain:** Nimiq SDK + HTLC escrow
- **AI:** Google Gemini (3.8 Flash for reasoning, 3.5 Flash-Lite for fast passes)
- **Hosting:** Vercel + Supabase

## Key Features

1. **AI Agreement Builder** — Type in natural language; Gemini generates a full structured contract.
2. **HTLC Escrow** — Native Nimiq Hashed Time-Locked Contracts for secure fund holding.
3. **Reputation System** — Trust scores based on agreement completion and dispute history.
4. **AI Dispute Mediator** — Claude reviews disputes and produces a verdict.
5. **Minimal Messaging** — Per-agreement chat with system events (text only in MVP).

## Demo Flow

1. Connect wallet → sign message to prove ownership.
2. Create agreement → AI generates full contract from user request.
3. Fund escrow (HTLC creation transaction in Nimiq Pay).
4. Seller submits milestone; buyer approves → funds release.
5. Reputation updated.
6. Open dispute on second agreement → AI mediator verdict.

## Environment Variables

See `.env.example` for full list. Critical ones:

```
GEMINI_API_KEY=...                   # Google Gemini API key
DATABASE_URL=postgresql://...         # Supabase PostgreSQL
NIMIQ_RPC_ENDPOINT=...               # Testnet RPC (for testing)
NIMIQ_MAINNET_RPC_ENDPOINT=...       # Mainnet RPC (for production)
JWT_SECRET=your-secret-key           # Session signing
```

## Commands

```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run lint             # ESLint
npx prisma migrate dev   # Run DB migrations
npx prisma studio       # Open Prisma Studio (DB GUI)
vercel deploy            # Deploy to Vercel
```

## Project Structure

```
src/
├── app/
│   ├── login/            # Wallet login (message signing)
│   ├── dashboard/        # Main app (agreements, escrow, disputes)
│   └── api/              # API routes (auth, AI, escrow, messages)
├── lib/
│   ├── nimiq.ts         # Nimiq SDK integration
│   ├── claude.ts        # Claude API clients
│   ├── auth.ts          # JWT validation
│   ├── db.ts            # Prisma client
│   └── types.ts         # Shared TypeScript interfaces
└── components/           # React components (UI)
```

## Risks & Mitigations

- **HTLC SDK method:** Day 1 spike to validate exact transaction-signing call against Nimiq SDK.
- **Mainnet + real funds:** Test thoroughly on testnet first; small amounts on mainnet.
- **10-day deadline:** Pre-agreed cut list prioritizes deep quality over breadth.

## Judging Criteria

Nimiq Community Council scores on:
- **Functionality** (20%) — does it work end-to-end?
- **Nimiq Pay Integration** (25%) — deep HTLC escrow use?
- **Real-World Usage** (20%) — solves a real problem?
- **Design Quality** (20%) — polished and intuitive?
- **Builder Promotion** (15%) — effort to promote?

## Submission

- **Deadline:** Sept 18, 2026
- **How:** Upload to GitHub + share Mini App URL in Nimiq Pay (`nimiqpay://miniapp?url=...` or via `nimpay.app/miniapps/open/...`).
- **Prize:** $10,000 / $5,000 / $2,000 (1st / 2nd / 3rd).

See [miniappscompetition.com](https://miniappscompetition.com) for full rules.

## For More Info

- See `CLAUDE.md` for detailed architecture, decisions, and Claude API patterns.
- Nimiq developer docs: [nimiq.dev/mini-apps](https://nimiq.dev/mini-apps)
- Gemini API docs: [ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)

---

**Built for the Nimiq Mini Apps Competition (Sept 8–18, 2026).**
