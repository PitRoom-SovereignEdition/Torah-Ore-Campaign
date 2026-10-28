# Fraud checks, review queue and fair leaderboard

Implements the must-haves from the Torah Ore feature inventory (28 Oct 2026). Principle throughout: a signal is a
**reason to look**, never proof. Nothing is excluded or refunded automatically on suspicion.

## What's built

| Spec item | Where | Behavior |
| --- | --- | --- |
| Count only confirmed gifts | `lib/donations.ts` `applyPaymentEvent`, `app/api/webhooks/stripe` | Signature-verified, idempotent webhook is the only way a gift becomes `succeeded`. Pending/failed/refunded never count. Amount mismatch → `flagged`, not counted. |
| Refund / dispute adjustments | webhook `charge.refunded`, `charge.dispute.created/closed` | Refunds (partial too) recompute totals, matching and rankings from the ledger. Dispute opened → review opened (not excluded). Dispute **won** → recorded, nothing auto-excluded. Dispute **lost** → treated as a full reversal. |
| Processor screening | Stripe Payment Element + `charge.succeeded` | Card fingerprint, CVC / postal checks, funding (prepaid), country are stored as signals. Radar rules themselves live in the Stripe dashboard (see below). |
| Rate limits, bot challenge | `lib/ratelimit.ts`, `lib/captcha.ts` | Per-IP limit is deliberately loose (30 / 10 min) because dorms and shared Wi-Fi have many real donors per IP. Turnstile or hCaptcha optional. |
| Card-testing alert | Admin → Overview | Banner when 10+ payments fail in an hour. |
| Review signals | `lib/risk.ts` | Medium (opens a review alone): same card on 3+ teams, same card 5+ times/24h, circular giving between team owners, success after 5+ failures from one network, dispute opened. Weak (needs a second signal): 5+ identical gifts to one team in 10 min, 8+ gifts from one network to one team in an hour, 4+ gifts from one address to one team in 24h, owner's own gift to own page, CVC fail, postal fail, prepaid card, offline gift matching an online one. |
| Admin review queue | Admin → Review | Lists open reviews with plain-language signals. Actions: **Clear**, **Set aside from ranking**, **Restore**. Each needs a written reason; organizer only. |
| "Exclude" meaning | `lib/leaderboard.ts` | Setting a gift aside removes it from the **leaderboard only**. The money is real and still counts in the campaign total. |
| Fundraisers never see flags | public APIs | `PublicDonation` has no review, signal, card or contact fields (tested). |
| Counting policy as a setting | Admin → Campaign | `leaderboardBasis`: most money / most gifts / most distinct donors. The table always shows all three columns, with the official one marked ★. |
| Published contest rules | Teams tab | Auto-generated from the settings (basis, confirmed-only, self-donation policy, cutoff, review/revision) or your own text. |
| Self-donation policy | Admin → Campaign | Owner's own gift to own page: counts, or doesn't count toward their ranking. |
| Distinct-donor identity | `donorId` | Each gift has an internal donor id. Organizers can **merge** (adopt another gift's id) or **split** with a logged reason via `/api/admin/review`. Anonymous gifts keep their real private id and are never lumped together as "Anonymous". |
| Offline entry with 2nd verifier | Admin → Donations | An offline gift is entered **pending** and counts only after the *other* role verifies it. Possible duplicates of online gifts are flagged. |
| Roles | `FINANCE_PASSWORD` | `organizer`: campaign, teams, matchers, review, offline entry. `finance`: donations, refunds, full CSV, offline verification. Both: overview, audit. |
| Role-limited CSV | `/api/admin/export` | Finance gets contact details. Organizer's file has them removed unless `ORGANIZER_SEES_CONTACT=true`. Every export is logged. |
| Audit log | Admin → Audit, `audit_log` table | Append-only (DB trigger blocks update/delete). Logs logins, campaign/goal/rule changes, matcher and team changes, offline entry/verify/reject, refunds, every review decision (with reason), disputes, exports. |

## Decisions the charity still has to make

1. **Leaderboard basis.** Default is *most money* only so it works out of the box. Choose before launch (Admin → Campaign).
2. **Self-donation policy.** Default *counts*. Change if you want it excluded.
3. **Donor identity.** The default donor id is a hash of the donor's email. Your spec says a shared email is not proof of one
   person (families), so treat that as a **starting point**: use merge/split to correct it, or tell me and I'll switch the
   default to "every gift is its own donor until merged".
4. **Cutoff time and revision/appeal rules** (cutoff is a setting; the written appeal process is yours to publish).
5. **Who sees contact data** (`ORGANIZER_SEES_CONTACT`).
6. Matching, prizes, raffles, auctions (none built; raffles/auctions need the charity's and counsel's approval first).

## Stripe Radar rules to set by hand (the code can't set these)

In Stripe → Radar → Rules. Test each against the last 6 months of charges before enforcing.
- Request 3D Secure / review when the CVC check fails or the postal-code check fails.
- Review (don't block) prepaid cards and disposable emails.
- Card-testing: block or challenge when a card or IP produces many failures, **combined** with tiny amounts or new cards.
  Do **not** use "block more than 1 successful charge per IP per hour": a yeshiva, dorm or shared network has many real donors on one IP.
- On a spike of failed payments, follow Stripe's card-testing checklist: identify, refund fraudulent payments, add mitigations.
- Disputes are not all lost; answer them. Don't auto-refund on suspicion.

## Not built yet (from the inventory)

Recurring gifts · cover-the-fees option · PayPal/Venmo/ACH (depends on enabling them in Stripe) · embeds/widgets ·
text-to-give · gift comments · fundraiser dashboard · email templates and digests · household grouping UI · a merge/split
button in the UI (the API and audit exist) · bulk team import · hubs · employer-match lookup · funnel / traffic analytics ·
payout reconciliation screen (use Stripe's payout reports against the CSV for now) · appeal workflow beyond "clear with a reason".
