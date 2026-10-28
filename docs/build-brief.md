# Build Brief: Torah Ore-Style Fundraising Campaign Site

Purpose: a breakdown of how the Torah Ore CharityExtra campaign page is structured and works, plus a practical plan to build an independent version. Paste this into Claude as the project brief.

---

## PART 1 - SOURCES AND THEIR LIMITS (read first)

The actual "Above & Beyond" page is NOT publicly viewable anymore. This brief is reconstructed from the sources below, and each part is labeled by where it was seen.

- LIVE TODAY (2026-10-28): https://www.charityextra.com/torahore - currently only a "Team sign up" form; the campaign itself is not up.
- ARCHIVE of Torah Ore's previous campaign on the same URL ("60 Years of Light!", Nov 9 2025 snapshot: $305,921 raised of $360,000 goal, 84%, 3,121 donors): https://web.archive.org/web/20251109225524/https://www.charityextra.com/torahore
- ARCHIVE of a Torah Ore team/fundraiser subpage (Oct 18 2025 snapshot): https://web.archive.org/web/20251018215001/https://www.charityextra.com/torahore/191342
  IMPORTANT LIMIT: in both archived captures the hero artwork did not load (placeholder images only). Exact artwork, fonts, colors and spacing of the original pages are NOT recoverable from these sources. Structure and text are; visual styling is not.
- COMPARISON, a live campaign from another institution on the same platform (Toras Emes): https://www.charityextra.com/te
- COMPARISON, a live donation page and checkout modal (Seed): https://www.charityextra.com/charity/seed
  Note: these comparison pages share the same platform, and their structure looks consistent with the archived Torah Ore pages, but it is not verified that Above & Beyond used every feature seen there.
- Platform pricing: https://www.charityextra.com/home/about/pricing
- Donate-page setup info: https://www.charityextra.com/donate-page-signup
- Platform terms: https://www.charityextra.com/terms

"Above & Beyond" was last year's campaign name (a parent posted about "Yeshivas Torah Ore Above & Beyond" on LinkedIn in December 2025: https://www.linkedin.com/posts/bmgraham_yeshivas-torah-ore-above-beyond-activity-7405252984529494016-WYPo). The campaign page itself is gone from the public web.

---

## PART 2 - OBSERVED PAGE STRUCTURE

Labels: [TO-archive] = seen on archived Torah Ore pages; [compare] = seen on live comparison pages; [live] = seen on torahore today.

### A. Campaign home page (top to bottom)

1. Top bar: platform logo left, language selector right (EN, DE, PT, FR, ES, RU, HE). [TO-archive] [compare]
2. Campaign title, centered: "Yeshivas Torah Ore | 60 Years of Light!". [TO-archive]
3. Hero area: large banner area; on the live comparison page it is a rotating artwork carousel. [compare] Torah Ore's archived page also had an embedded Vimeo campaign video link. [TO-archive] (Artwork itself not recoverable - see Part 1.)
4. Goal card beside the hero: big raised amount ("$305,921"), "RAISED OF $360,000 GOAL", two-tone progress bar, percent ("84%"). [TO-archive] On the comparison page, after passing the goal the card shows a trophy icon, "BONUS GOAL" and "ORIGINAL GOAL" lines, and the bar exceeds 100% (102% observed). [compare]
5. Description strip: one or two sentences with a "More ..." expander. [TO-archive] [compare]
6. Tab row: "Donors | Communities | About" [TO-archive]; comparison page adds "Teams" and "Matchers", with live counts (6,842 Donors, 165 Teams, 4 Communities). [compare]
7. Donor wall (default tab):
   - "Search Donors" box; sort links: Latest / Highest / Most Liked. [TO-archive] [compare]
   - Cards in a 3-column grid: circle avatar with donor initials, name (or "Anonymous"), amount, a "With [team/fundraiser name]" link crediting the recruiter, and the donor's public message. Dedication messages (in memory of...) show a memorial-candle icon. [compare]
   - "More .." button loads the next batch. [compare]
8. Teams tab: table of fundraising teams - Name, Progress bar, Donations count, link to each Team Page; includes staff teams. [compare]
9. Matchers tab: lists the matching donors underwriting the campaign. [compare]
10. Floating share button; a mailto share link ("Join the ... campaign") was present in the Torah Ore archive. [TO-archive] [compare]
11. Donate button opening the donation modal; hidden once a campaign ends. [compare]

### B. Team sign-up page [live]

"Team sign up" heading; "If you would like to join our teams, please fill your details below:"; fields Name / Email / Phone Number / Raising Goal (optional) / Message to show on your page (optional); Submit button; note "We will be in touch with you soon with more information about our campaign."

### C. Team/fundraiser subpage [TO-archive]

Same campaign header and goal card scoped to one fundraiser, with a big DONATE button; donations made there credit that fundraiser (the "With X" attribution on the donor wall).

### D. Donation modal [compare, observed live]

Single-page modal, no wizard:
- Amount* with currency dropdown and a live conversion note ("1 USD = 0.75155 GBP"); free-typed amount.
- Recurring dropdown ("Not Recurring" default).
- Category dropdown.
- "Your Details": Name*, Email*, Reference (optional), Address*, Zip/Postal, City*, County/State, Country* (searchable).
- Checkbox: agree to terms and conditions*.
- "Pay With": credit/debit card via embedded Stripe fields (card number, expiry, CVC inside Stripe iframes; Apple Pay / Google Pay support per platform docs).
- Shows the card-statement descriptor ("Your statement will show: CTEX*SEED") and the charity registration number.
- "Pay Now" button; reCAPTCHA / hCaptcha bot protection.

---

## PART 3 - HOW IT WORKS (observed + platform-documented)

- Live totals: raised amount, donor count and progress bar update during the campaign. [compare]
- Matched giving: matchers underwrite a multiplier; "Matched giving supported" is a documented platform feature. [compare + pricing page]
- Teams/ambassadors: supporters sign up as fundraisers, get personal sub-pages and optional goals; gifts are credited to them; a team table drives competition. Platform docs also list team dashboards, competition tools, custom sign-up forms and broadcast messages to fundraisers. [live] [compare] [pricing page]
- Donor wall: search, Latest/Highest/Most Liked sorts, likes, public messages, anonymous option, dedication messages. [compare]
- Multi-currency: donor picks a currency and sees a live conversion note. [compare]
- Tax receipts: platform advertises country-based tax receipts and UK Gift Aid claims. [pricing page]
- Non-card money: voucher & DAF company payments (US: OJC, Pledger, The Donors' Fund; UK: Achisomoch, Broom, Asser Bishvil) and admin-entered offline donations. [donate-page-signup] [pricing page]
- Admin: reports, full donor data export, multiple users, webhooks & CRM integrations. [pricing page]
- Security: card fields are Stripe iframes, so raw card data does not touch the campaign site; reCAPTCHA/hCaptcha present. [compare]

---

## PART 4 - THE MONEY (publicly verifiable, checked 2026-10-28)

Charity Extra's charges:
- Public pricing page: Donation Pages "Free"; Fundraising Hubs "Free, with donor tip option"; Bespoke Plan "Pricing based on your needs". No fixed percentage is shown on that pricing page.
- Terms: "Information about our fees can be obtained by contacting info@charityextra.com."
- What Torah Ore actually pays, which plan their campaign runs on, and whether there is any separate setup or hosting charge is NOT public and is not inferred here.

Card processing:
- CharityExtra processes cards through Stripe by default; their signup page says US charities can instead connect their own Cardknox, Banquest or Authorize.net account, and notes card fees are charged automatically by the processor.
- What processing would cost on a self-built site depends on the provider, the agreement, the card mix and the currencies involved; published rate cards (for example Stripe's) are only a reference point, and any nonprofit or volume discount has to be confirmed with the provider. Hosting and maintenance costs of running your own site also differ from the platform route.

Bottom line: whether self-building saves money, and how much, is unknown until the yeshiva's actual platform terms and a concrete processor quote are compared. No savings figure is claimed here.

---

## PART 5 - PROPOSED BUILD (plan, not observed)

Stack suggestion: Next.js on Vercel + Supabase (Postgres, Auth, Realtime) + Stripe. Vercel and Supabase are proven in the existing PitRoom project; Next.js and Stripe are proposals to evaluate, not confirmed choices.

Data model:
- campaigns (id, title, goal, bonus_goal, currency, starts_at, ends_at, description, hero_media[])
- teams (id, campaign_id, name, goal, message, owner_name, owner_contact)
- donations (id, campaign_id, team_id nullable, amount_cents, currency, display_name, anonymous bool, message, dedication, payment_ref, status, created_at)
- matchers (id, campaign_id, name, multiplier, committed_cap_cents, currency, window_start, window_end)
- likes (donation_id, privacy-preserving voter token; rate-limited, without exposing donor identity)

Pages:
1. Campaign home: hero area, goal card (raised/goal/bar/%), description, tabs (Donors/Teams/Matchers/About), donor wall with search + sort + paging, share button, EN/HE toggle.
2. Team signup: the 5-field form observed.
3. Team page /[teamId]: same layout scoped to the team.
4. Donation modal: amount + currency + recurring + donor details + dedication + anonymous + terms checkbox + the processor's embedded payment element (card, Apple Pay, Google Pay).

Payment and backend rules (non-negotiable):
- Never collect raw card numbers on our own forms; use the processor's embedded fields/checkout only.
- Amounts, currency and team attribution are validated and priced server-side; the client never sets the charge.
- Webhooks are signature-verified and idempotent; donations move through pending -> succeeded/refunded states and are reconciled, never written as final from the browser redirect.
- Row-level security separates private donor/contact data from the public wall; the wall shows only display name, amount and message, and only when the donor consented (anonymous hides the name).
- Stay in processor test mode until the charity and processor arrangements are approved.
- Matching: only count a match against an explicit committed cap, time window and currency recorded per matcher; keep real cash and matched amounts as separate fields/totals; never insert fake "system" cash donations to inflate the raised total.

Receipts and payee:
- Automatic email confirmations are fine; formal tax receipts, the legal payee, and whose account receives the money must be arrangements the yeshiva approves and verifies with its own advisers and the processor. This brief makes no legal claim about who must own the account.

Suggested build order:
1. Campaign page + goal bar + one-time donations via the processor + webhook + donor wall (Latest sort only).
2. Team signup + team pages + "With" attribution + leaderboard.
3. Matchers, recurring, multi-currency, likes, additional sorts.
4. Admin exports, offline donations, receipt polish.

Hard parts: matched-giving bookkeeping, multi-currency settlement, a leaderboard under heavy live traffic, and the payee/receipt arrangements. Scope them before promising anything.

Scope honesty: this is a structure-and-features brief inspired by the observed pages, to be built with original artwork and branding - not a pixel copy of CharityExtra's design or assets.
