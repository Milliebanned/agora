# NimTrust Setup Instructions

## Prerequisites

- Node.js 18+ ([download](https://nodejs.org))
- npm (included with Node.js)
- GitHub account (to create a public repo)
- Supabase account (free tier: [supabase.com](https://supabase.com))
- Google Gemini API key (free tier: [aistudio.google.com/apikey](https://aistudio.google.com/apikey))

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd /Users/Apple/nimtrust
npm install
```

### 2. Set Up Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

#### Anthropic API Key
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Generate an API key
3. Paste into `GEMINI_API_KEY=...`

#### Supabase Database
1. Go to [supabase.com](https://supabase.com), sign up / log in
2. Create a new project (free tier is fine)
3. Go to **Project Settings → Database**
4. Copy the PostgreSQL connection string
5. Paste into `DATABASE_URL=postgresql://...`

#### Nimiq Network Config
Leave as testnet for now (switch to mainnet after testing):

```
NEXT_PUBLIC_NIMIQ_NETWORK=testnet
NIMIQ_RPC_ENDPOINT=https://testnet.nimiq.com
NIMIQ_MAINNET_RPC_ENDPOINT=https://nimiq.com
```

Generate a random secret for sessions:

```bash
openssl rand -base64 32
```

Paste into `JWT_SECRET=...`

### 3. Initialize Database

```bash
npx prisma migrate dev --name init
```

This creates the database schema. When prompted, create the migrations.

### 4. Start Dev Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Day 1: HTLC Spike Task

**⚠️ Critical:** The exact SDK method for signing HTLC creation transactions is still unknown from the docs alone.

### Steps

1. Check if Nimiq offers a Claude Code skill:
   - Visit [nimiq.dev](https://nimiq.dev) → look for "Claude Code skill" or "AI agent" setup
   - If available, install it in Claude Code
   
2. With the skill installed (or by reading the latest SDK docs), test this in your codebase:
   ```typescript
   // In src/lib/nimiq.ts, fill in signAndSendTransaction()
   // Replace the placeholder with the actual SDK call
   ```

3. Write a test script to:
   - Build an unsigned HTLC transaction
   - Sign it via the SDK
   - Confirm the transaction structure is valid
   - Test on **testnet** only

4. Document the exact method signature in CLAUDE.md for future sessions.

## GitHub Repo Setup

```bash
cd /Users/Apple/nimtrust

# Set git user (if not already done)
git config --global user.email "adetunjidamola10@gmail.com"
git config --global user.name "NimTrust Builder"

# Add all files
git add .

# Commit initial scaffold
git commit -m "Initial NimTrust scaffold with Next.js, Prisma, Nimiq SDK, and Claude API integration

- Project structure (app router, API routes, lib utilities)
- Authentication (wallet login via message signing)
- Database schema (users, agreements, escrow, disputes, messages)
- Gemini AI integration (3.6 Flash for generation/mediation, 3.5 Flash-Lite for chat/flags)
- Core API stubs (auth, agreements, disputes, AI)
- Day 1 spike task: validate HTLC transaction-signing method

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# Create GitHub repo and push
# (from GitHub web UI: create new public repo "nimtrust")
# Then:
git remote add origin https://github.com/YOUR_USERNAME/nimtrust.git
git branch -M main
git push -u origin main
```

## Next Steps After Setup

1. **Validate HTLC SDK method** (Day 1 spike)
2. **Build Agreement CRUD API** → test in dashboard
3. **Implement AI Agreement Builder** → call Gemini
4. **Fund Escrow** → HTLC creation transaction (after spike)
5. **Milestone submit/approve** → HTLC claim path
6. **Reputation system** → trust score calculation
7. **Disputes + AI Mediator** → Gemini verdict
8. **UI Polish** → test on actual Nimiq Pay app

## Troubleshooting

### "Module not found: @nimiq/mini-app-sdk"
- The package may not exist yet or be under a different name
- After installing, check [npmjs.com/@nimiq](https://www.npmjs.com/search?q=@nimiq)
- Update `package.json` if the name is different

### Database connection error
- Verify `DATABASE_URL` in `.env.local` is correct
- Try `npx prisma db push` to sync schema without migrations

### API routes 404
- Ensure files are in `src/app/api/` (not `pages/api/`)
- Next.js 15 uses App Router by default

### Nimiq SDK not initializing
- This will fail outside the Nimiq Pay app (expected for local dev)
- Test in the actual Nimiq Pay app on a phone before submission

## Key Files to Know

- `CLAUDE.md` — architecture decisions & Claude API patterns (read this!)
- `prisma/schema.prisma` — database schema (modify when adding entities)
- `src/lib/` — utilities (Nimiq, Claude, auth, database)
- `src/app/api/` — backend API routes
- `src/app/` — frontend pages & layouts

## Deadline

- **Sept 18, 2026** — submission closes
- **Today:** Sept 8, 2026 — **10 days left**

## Need Help?

- Nimiq docs: [nimiq.dev](https://nimiq.dev)
- Gemini API: [ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)
- Supabase: [supabase.com/docs](https://supabase.com/docs)
- Next.js: [nextjs.org](https://nextjs.org)
