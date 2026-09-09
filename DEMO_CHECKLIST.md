# NimTrust Demo Flow Checklist

**Hackathon Demo Script** — Run through this end-to-end on Sept 18 before submission.

---

## Pre-Demo Setup (Day Before)

- [ ] App deployed to Vercel (get HTTPS URL)
- [ ] Database fully migrated on Supabase
- [ ] All environment variables set on Vercel
- [ ] HTLC testnet path fully tested (create → claim → refund)
- [ ] HTLC mainnet path ready (use small amounts for demo)
- [ ] Nimiq Pay app installed on phone
- [ ] App accessible inside Nimiq Pay via `nimiqpay://miniapp?url=...` or `nimpay.app/miniapps/open/...`
- [ ] Demo video recording software ready
- [ ] Test accounts created (2 users for demo)

---

## Live Demo Flow (5–7 minutes)

### 1. Login (30 seconds)

**Narrator:** "Let's start by connecting a wallet."

- [ ] Open app in Nimiq Pay on phone (or browser simulator)
- [ ] Click "Connect Wallet"
- [ ] Sign message challenge (native Nimiq Pay dialog)
- [ ] Redirects to dashboard
- [ ] Show user profile badge (wallet address)

### 2. Create Agreement — AI Builder (1.5 minutes)

**Narrator:** "Now I'll create an agreement. Instead of filling out forms, I type what I want."

- [ ] Click "Create Agreement"
- [ ] Type: `"Build me a landing page for $500 in 7 days"`
- [ ] Show AI processing (spinner)
- [ ] AI generates full contract:
  - [ ] Title: "Landing Page Development"
  - [ ] Scope, Deliverables, Timeline, Milestones
  - [ ] Amount: 500 NIM
  - [ ] Risk Flags: (e.g., "Deadline tight", "No revision limit specified")
- [ ] User can edit fields
- [ ] Click "Confirm Agreement"

### 3. Fund Escrow — HTLC Creation (1 minute)

**Narrator:** "Funds are locked in escrow using Nimiq's HTLC protocol. No middleman."

- [ ] Agreement page loads
- [ ] Click "Fund Escrow" button
- [ ] App builds HTLC creation transaction
- [ ] Native Nimiq Pay dialog: "Sign escrow transaction"
- [ ] User approves (second wallet action)
- [ ] Transaction broadcast
- [ ] Show "Transaction pending..." → "Confirmed! 500 NIM locked"
- [ ] Escrow Status: "Funded" with block confirmation

### 4. Invite Seller (30 seconds)

**Narrator:** "The other party joins the agreement."

- [ ] Click "Invite Participant" / "Copy Invite Link"
- [ ] (In real demo, use second test account)
- [ ] Second user signs in, sees the agreement

### 5. Seller Submits Milestone (30 seconds)

**Narrator:** "Seller submits their work."

- [ ] Second account: click "Submit Milestone"
- [ ] Type deliverable description / upload proof (text in MVP)
- [ ] Status changes to "Submitted"
- [ ] First account sees notification

### 6. Buyer Approves — Funds Release (1 minute)

**Narrator:** "Buyer approves the work, funds release automatically."

- [ ] First account: click "Approve Milestone"
- [ ] Show "Releasing funds..." spinner
- [ ] App submits HTLC claim transaction (with pre-image)
- [ ] Native Nimiq Pay dialog (optional, depending on SDK)
- [ ] Transaction confirmed
- [ ] Milestone status: "Approved"
- [ ] Escrow status: "Released"
- [ ] Second account sees funds received in their Nimiq wallet

### 7. Reputation Update (30 seconds)

**Narrator:** "Completion is recorded. Both users' trust scores update."

- [ ] Click on user profiles
- [ ] Show trust scores increased
- [ ] Completion rate: "50% (1 of 2 agreements)"
- [ ] Badges/trust summary visible

### 8. Dispute — AI Mediator (1.5 minutes)

**Narrator:** "Let me show you dispute resolution. If there's a disagreement, AI reviews it."

- [ ] Create a second test agreement (or use pre-made one)
- [ ] Simulate dispute: click "Open Dispute"
- [ ] Reason: "Work doesn't match specification"
- [ ] Click "Get AI Verdict"
- [ ] Show Gemini analyzing:
  - [ ] Case Summary
  - [ ] Findings (e.g., "Deliverable partially complete")
  - [ ] Recommended Outcome: "Release" / "Refund" / "Partial Refund"
- [ ] Verdict shown on dispute detail page
- [ ] Narrator: "Both parties review and accept the verdict"

### 9. Dashboard Summary (30 seconds)

**Narrator:** "Let's check the dashboard."

- [ ] Show quick stats:
  - [ ] Active Agreements: 0–1
  - [ ] Pending: 0–1
  - [ ] Escrow Balance: $X locked
  - [ ] Trust Score: 85/100+
- [ ] Show agreement timeline (events: "Funds Deposited", "Milestone Submitted", "Approved", "Released")

### 10. Messaging (if time)

**Narrator:** "Users can message within agreements."

- [ ] Show agreement chat
- [ ] Message count, system events (e.g., "Funds locked")

---

## Key Points for Narrator

**Highlight Differentiation:**
- "Unlike other platforms, funds are held in **native Nimiq HTLC contracts** — not a smart contract we wrote. No audit risk."
- "**AI generates full agreements** from plain English. No legalese."
- "**AI mediates disputes**, providing a verdict in seconds."
- "**Testnet-first testing** ensures security; this is ready for real transactions."

**Show Design Quality:**
- Polished UI (shadcn/ui, Tailwind)
- Smooth animations and transitions
- Clear trust score and reputation metrics
- Responsive mobile design (test on phone)

**Show Real-World Use Case:**
- Freelancer hiring
- Equipment rental
- Goods buying/selling
- Service exchanges
- All with AI-mediated trust

---

## Troubleshooting During Demo

| Issue | Fix |
|-------|-----|
| "App doesn't load in Nimiq Pay" | Refresh, clear cache, test in browser first |
| "Sign message failed" | Try again (network hiccup); have backup phone ready |
| "HTLC transaction pending forever" | Switch to testnet if not already; check RPC endpoint |
| "AI verdict takes too long" | Had Claude API rate limit; retry or show cached example |
| "Profile says "New User"" | Trust score takes a moment to calculate; refresh or show on second account |
| "Funds didn't release after approval" | Check HTLC claim transaction on block explorer; may need to refresh |

---

## Post-Demo

- [ ] Record screen + voice-over (5–7 min video)
- [ ] Upload to YouTube or Twitter
- [ ] Create GitHub release with video link
- [ ] Tweet/X thread: "Shipped NimTrust for @Nimiq Mini Apps Competition"
- [ ] Submit to competition portal: https://miniappscompetition.com
- [ ] Include:
  - [ ] GitHub repo link
  - [ ] Live app URL (Vercel)
  - [ ] Demo video link
  - [ ] Brief description (30 words max)
  - [ ] Team member names & emails

---

## Demo Line Counts (for timing)

- Introduction: "Trust strangers with confidence." (3 sec)
- Feature walkthrough: 5 minutes
- Highlight differentiators: 1 minute
- Q&A / Buffer: 1 minute
- **Total: 7 minutes**

---

## Final Checks Before Submission

- [ ] README updated with current status
- [ ] CLAUDE.md has all decisions documented
- [ ] No `.env.local` secrets in repo
- [ ] All tests pass (`npm run build`, no TypeScript errors)
- [ ] App runs without console errors
- [ ] Tested on mainnet HTLC paths (small amounts)
- [ ] Demo video uploaded and linked
- [ ] GitHub stars/forks count (for builder promotion metric)

---

**Demo Date:** Sept 18, 2026 (before 11:59 PM UTC)  
**Prize:** Top 3 of 4 builders  
**Key Success Metric:** "Nimiq Pay Integration" (25% of judging) — deep HTLC escrow use is your edge
