# NimTrust — Plan Reference & Implementation Guide

**This document ties the approved plan to the scaffolded codebase.**

---

## Plan Structure vs. Delivered Code

### Context (From Plan)

✅ **Delivered:** CLAUDE.md (product vision + tech decisions)

### Tech Stack (From Plan)

| Component | Delivered | File(s) |
|-----------|-----------|---------|
| **Frontend/Backend** | Next.js 15 + React 19 + TS | next.config.ts, src/app/, package.json |
| **Styling** | Tailwind + shadcn/ui (template) | tailwind.config.ts, src/app/globals.css |
| **Database** | Supabase Postgres + Prisma | prisma/schema.prisma, src/lib/db.ts |
| **Auth** | Wallet signing (no passwords) | src/lib/auth.ts, src/app/api/auth/ |
| **Blockchain** | Nimiq SDK + HTLC | src/lib/nimiq.ts (⚠️ spike placeholders) |
| **AI** | Gemini 3.6 Flash + 3.5 Flash-Lite | src/lib/gemini.ts |
| **Hosting** | Vercel + Supabase config | .env.example, SETUP_INSTRUCTIONS.md |

### Scope (Deep MVP from Plan)

**Section:** "Scope: What Gets Built"

| Feature | Status | Implementation File(s) |
|---------|--------|------------------------|
| Wallet login (message signing) | ✅ Scaffolded | src/lib/auth.ts, src/app/login/page.tsx |
| AI Agreement Builder | ✅ API ready | src/lib/gemini.ts, src/app/api/ai/generate-agreement/route.ts |
| Fund Escrow (HTLC creation) | ⚠️ Needs spike | src/lib/nimiq.ts (buildHTLCCreationTx + signAndSendTransaction placeholders) |
| Milestone submit/approve | ✅ Schema ready | prisma/schema.prisma (Milestone model), API stubs needed |
| HTLC claim path (fund release) | ⚠️ Needs spike | src/lib/nimiq.ts placeholder |
| Reputation update | ✅ Schema ready | prisma/schema.prisma (ReputationScore model), calc function in src/lib/utils.ts |
| Dispute + AI Mediator | ✅ API ready | src/lib/gemini.ts, src/app/api/disputes/[id]/resolve/route.ts |
| Minimal messaging | ✅ Schema ready | prisma/schema.prisma (Message model), UI not yet built |
| Dashboard (active/pending/disputed/balance/score) | ✅ Skeleton | src/app/dashboard/page.tsx (basic display), full build needed |

### Critical Unknown (From Plan)

**Section:** "Escrow: Use Nimiq's Native HTLC Account Type"

> ⚠️ "exact SDK method names for 'sign an arbitrary/contract-creation transaction' weren't confirmed by research. **Day 1 must include a hands-on spike** against the real SDK/docs."

**Status:** Identified in code via `SPIKE` comments in `src/lib/nimiq.ts`

```typescript
// src/lib/nimiq.ts line 40+
export async function buildHTLCCreationTx(...) {
  console.warn('buildHTLCCreationTx: awaiting SDK method validation (Day 1 spike)')
  // Placeholder implementation
}

export async function signAndSendTransaction(txData: any) {
  console.warn('signAndSendTransaction: awaiting SDK method validation (Day 1 spike)')
  // Placeholder implementation
}
```

**Action:**
1. Install official Nimiq Claude Code skill (if available)
2. Read `@nimiq/mini-app-sdk` docs or installed skill
3. Replace placeholders with real SDK calls
4. Test on testnet (create → claim → refund)
5. Document exact method signature in CLAUDE.md

---

## File-by-File Implementation Map

### Library Files (Core Utilities)

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `src/lib/types.ts` | TypeScript interfaces for all entities | ✅ Complete | Use these everywhere for type safety |
| `src/lib/db.ts` | Prisma client singleton | ✅ Complete | Import as `import prisma from '@/lib/db'` |
| `src/lib/nimiq.ts` | Nimiq SDK integration | ⚠️ Needs spike | HTLC methods are placeholders |
| `src/lib/gemini.ts` | Gemini API client (reasoning + fast) | ✅ Ready | Use for agreement generation, mediation, chat |
| `src/lib/auth.ts` | JWT + wallet challenge | ✅ Ready | Use for session management |
| `src/lib/utils.ts` | Helper functions | ✅ Ready | Trust score calc, NIM formatting, hashing |

### API Routes (Backend Endpoints)

| Route | Method | Status | Next Steps |
|-------|--------|--------|-----------|
| `/api/auth/challenge` | POST | ✅ Complete | Generate message for wallet signing |
| `/api/auth/verify` | POST | ✅ Complete | Verify signature, issue JWT session |
| `/api/ai/generate-agreement` | POST | ✅ API ready | Wire up UI form to this endpoint |
| `/api/agreements` | GET/POST | ❌ Stub needed | List agreements, create new agreement |
| `/api/agreements/[id]` | GET/PATCH | ❌ Stub needed | Get detail, update (status, title, etc.) |
| `/api/agreements/[id]/fund` | POST | ❌ Stub needed | Build unsigned HTLC tx, return to frontend |
| `/api/agreements/[id]/claim` | POST | ❌ Stub needed | Submit HTLC claim tx with pre-image |
| `/api/disputes` | GET/POST | ✅ Stub ready | List, create disputes |
| `/api/disputes/[id]/resolve` | POST | ✅ Stub ready | Call AI mediator, store verdict |
| `/api/messages` | GET/POST | ❌ Stub needed | Text messaging per agreement (Supabase Realtime) |

### Frontend Pages (User Interface)

| Route | Status | Next Steps |
|-------|--------|-----------|
| `/` | ✅ Stub | Redirects to login or dashboard |
| `/login` | ✅ Basic UI | Wire up wallet connection (getAccounts, signMessage) |
| `/dashboard` | ✅ Skeleton | Build out full dashboard with links |
| `/dashboard/agreements` | ❌ Not built | List + filter by status |
| `/dashboard/agreements/create` | ❌ Not built | AI Agreement Builder form |
| `/dashboard/agreements/[id]` | ❌ Not built | Detail page + fund/claim/timeline |
| `/dashboard/escrow` | ❌ Not built | Locked/released/refunded breakdown |
| `/dashboard/disputes` | ❌ Not built | Dispute list + detail page |
| `/dashboard/profile` | ❌ Not built | Trust score, completion rate |

### Configuration Files

| File | Status | Notes |
|------|--------|-------|
| `package.json` | ✅ Complete | Dependencies ready; `npm install` will populate node_modules |
| `tsconfig.json` | ✅ Complete | Path alias `@/*` → `src/*` |
| `tailwind.config.ts` | ✅ Complete | Dark mode, animations configured |
| `next.config.ts` | ✅ Complete | TypeScript build, ESLint |
| `prisma/schema.prisma` | ✅ Complete | Full data model; `npx prisma migrate` to deploy |
| `.env.example` | ✅ Complete | Copy to `.env.local` and fill in credentials |
| `.gitignore` | ✅ Complete | Ignores node_modules, .env, .next, etc. |

### Documentation Files

| File | Audience | Key Info |
|------|----------|----------|
| `CLAUDE.md` | Developers (you future + Claude Code) | Product vision, tech decisions, Claude API patterns, HTLC model |
| `README.md` | GitHub visitors | Quick start, stack, demo flow, judging criteria |
| `SETUP_INSTRUCTIONS.md` | First-time setup | Node install, .env config, Supabase + Anthropic key setup |
| `BUILD_STATUS.md` | Project tracking | What's done, what's next, risks, checkpoints |
| `DEMO_CHECKLIST.md` | Hackathon demo | Step-by-step walkthrough, timing, narrator notes |
| `PLAN_REFERENCE.md` | **This file** | Ties approved plan to scaffolded code |

---

## Day 1 Spike Task (Critical Path)

**Objective:** Unblock HTLC transaction signing.

**Files to Update:**
- `src/lib/nimiq.ts` (replace placeholder functions)
- `CLAUDE.md` (document exact SDK method signature)

**Steps:**

1. Check Nimiq's Claude Code skill (if available)
2. Read `@nimiq/mini-app-sdk` docs
3. Implement `buildHTLCCreationTx()`:
   - Takes buyer address, seller address, amount, hash root, timeout blocks
   - Returns unsigned transaction object with correct HTLC data structure
4. Implement `signAndSendTransaction()`:
   - Takes unsigned tx
   - Calls SDK method to trigger native Nimiq Pay sign dialog
   - Returns signed transaction hash
5. Test on testnet:
   - Create an HTLC (fund)
   - Claim it (with pre-image)
   - Refund it (after timeout)
6. Document findings in CLAUDE.md

**Success Criteria:**
- No more `console.warn('SPIKE')` messages in src/lib/nimiq.ts
- HTLC create/claim/refund tested on testnet (check on block explorer)
- Exact SDK method signature documented

---

## Implementation Priority (Next 9 Days)

### Days 2–3: Agreement CRUD + AI Builder

**What to Build:**
1. Create `/api/agreements` POST endpoint (insert into DB)
2. Create `/api/agreements` GET endpoint (list with filters)
3. Create `/api/agreements/[id]` GET endpoint (detail with relations)
4. Build `/dashboard/agreements` page (list + filter UI)
5. Build `/dashboard/agreements/create` page (AI builder form)

**Files to Edit:**
- `src/app/api/agreements/route.ts` (new CRUD endpoints)
- `src/app/api/agreements/[id]/route.ts` (new detail endpoint)
- `src/app/dashboard/agreements/page.tsx` (new list page)
- `src/app/dashboard/agreements/create/page.tsx` (new form page)

**Check:** Agreements appear in dashboard after creation.

---

### Days 4–5: HTLC Escrow Funding + Claiming

**What to Build:**
1. Create `/api/agreements/[id]/fund` endpoint (builds HTLC tx)
2. Create `/api/agreements/[id]/claim` endpoint (HTLC claim tx)
3. Build "Fund Escrow" button on `/dashboard/agreements/[id]`
4. Build escrow status display (funded → claimed → released)

**Files to Edit:**
- `src/app/api/agreements/[id]/fund/route.ts` (new endpoint)
- `src/app/api/agreements/[id]/claim/route.ts` (new endpoint)
- `src/app/dashboard/agreements/[id]/page.tsx` (add buttons + escrow status)
- `src/lib/nimiq.ts` (use real SDK methods post-spike)

**Check:** HTLC creation + claim tested on testnet.

---

### Days 6–7: Reputation + Disputes + AI Mediator

**What to Build:**
1. Implement reputation score calculation (post-agreement completion)
2. Build `/dashboard/disputes` page (list + create dispute)
3. Build `/dashboard/disputes/[id]` page (detail + AI verdict)
4. Implement `/api/disputes/[id]/resolve` (trigger AI mediator)

**Files to Edit:**
- `src/app/api/disputes/route.ts` (wire up POST)
- `src/app/api/disputes/[id]/resolve/route.ts` (fill in full implementation)
- `src/app/dashboard/disputes/page.tsx` (new list page)
- `src/app/dashboard/disputes/[id]/page.tsx` (new detail page)
- `src/lib/utils.ts` (calculateTrustScore already there)

**Check:** Disputes open, AI mediator generates verdict on demand.

---

### Days 8–9: Testing + Polish

**What to Do:**
1. Test full demo flow on testnet
2. Test full demo flow on mainnet (small amounts)
3. Test in actual Nimiq Pay app (phone)
4. Polish UI (colors, spacing, animations)
5. Add shadcn/ui Button, Card, Input components
6. Fix console errors

**Files to Edit:**
- All `.tsx` files (add shadcn components)
- `src/app/globals.css` (refine styling)

**Check:** App works on phone inside Nimiq Pay.

---

### Day 10: Demo + Submission

**What to Do:**
1. Record 5–7 minute demo video (follow DEMO_CHECKLIST.md)
2. Upload to YouTube or Twitter
3. Create GitHub release
4. Submit to https://miniappscompetition.com
5. Tweet/X thread announcing launch

**Check:** Submission before 11:59 PM UTC on Sept 18.

---

## Key Reminders

### Use TypeScript Everywhere
- Every API response, function parameter, database query should have types from `src/lib/types.ts`
- This prevents runtime errors during the demo

### Database First
- Design in Prisma schema first
- Run migrations (`npx prisma migrate`)
- Use Prisma Studio (`npx prisma studio`) to test queries visually

### Claude API Usage
- Gemini 3.6 Flash: agreement generation, dispute mediation (structured output via response_format schema)
- Gemini 3.5 Flash-Lite: AI assistant chat, quick risk checks
- One API key, one client; model tier picked per call and overridable via GEMINI_REASONING_MODEL / GEMINI_FAST_MODEL

### HTLC is Mainnet-Ready (Testnet First)
- Write code once, test on testnet (just swap RPC endpoint in .env)
- Switch to mainnet RPC for demo (use small amounts)
- No changes to code needed

### Expect Blockers
- Nimiq SDK method name (handled: Day 1 spike)
- Prisma migration issues (handled: run `npx prisma db push`)
- Claude API rate limits (have cached example responses ready)
- Mini App doesn't work in browser (expected: test in actual Nimiq Pay app)

---

## Questions to Ask Claude Code

Use CLAUDE.md as context. Example prompts:

- "Build the `/api/agreements` CRUD endpoints following the plan"
- "Create the AI Agreement Builder form component"
- "Implement the HTLC escrow funding flow"
- "Add reputation score calculation on agreement completion"
- "Build the dispute detail page with AI mediator verdict display"

All will have full context from CLAUDE.md + the scaffolded types/API structure.

---

**You have everything. Go build. 10 days. $10,000 to win. 💪**
