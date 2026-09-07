# Gridiron AI × CFB Gridiron AI — the plan to $10k a month

Two apps, one engine, two seasons that barely overlap. This document is the
commercial half of the build: what is being sold, to whom, at what price, how
they find it, and what has to be true for the number at the top to happen.

Everything here is written to be argued with. Where a number is a guess it says
so, and where the product has a real weakness it says that too.

---

## 1. What is actually being sold

Not picks. Picks are a commodity and the people selling them are mostly lying.

What is being sold is **a model that grades itself in public**. Every projection
is locked at kickoff, scored against the final, and shown — wins, losses and
the weeks it was wrong. That is the whole moat. A tout can fake a record; an
app that publishes a locked prediction before kickoff and a graded result after
cannot, and the Record tab is the proof.

The three things a bettor pays for, in the order they will pay for them:

| They want | The feature | Tier |
|---|---|---|
| To stop guessing | Unlimited 10,000-run sims, the whole Edge Board | Starter / Scholarship |
| To turn a number into a bet | Parlay Lab, props, line moves, what-if lab | All-Pro / Blue Chip |
| To run it themselves | Raw feed, backtests, editable weights | Franchise / Dynasty |

---

## 2. The maths to $10,000 a month

**Prices.** Monthly $12.99 / $29.99 / $99. Annual $99 / $249 / $899 (CFB sells
annual as a Season Pass at $89 / $199 / $799 — a season is an easier yes than a
year).

**Blended ARPU.** Assume paying users split 60 / 33 / 7 across the three rungs:

```
0.60 × 12.99  =  7.79
0.33 × 29.99  =  9.90
0.07 × 99.00  =  6.93
                ------
blended monthly = 24.62
```

Assume 35% choose annual, which is roughly two months free, so multiply by 0.83:

**Effective ARPU ≈ $20.40 per paying user per month.**

**Subscribers needed:** `10,000 / 20.40` ≈ **490 paying subscribers** across both
apps. Not 50,000 users. Four hundred and ninety people who bet on football and
think $13 a month is cheaper than one bad Sunday.

**Free users needed:** at a 4% free→paid conversion (achievable with a no-card
trial and a metered free tier; 2% is the pessimistic case):

| Conversion | Free users needed |
|---|---|
| 6% (good) | ~8,200 |
| 4% (plan) | ~12,300 |
| 2% (bad) | ~24,500 |

**Traffic needed:** at 25% visit→first-simulation, the 4% case needs ~49,000
visits across a season. Over a 22-week season that is **~2,200 visits a week**.
That is one short-form video a week that does 40k views, or two Reddit results
threads a month, or a single podcast read. It is a small number, and saying so
is the point: this does not need to go viral, it needs to not leak.

**Where it leaks:** every step above is a multiplication, so the cheapest wins
are the worst-performing step, not the top of the funnel. Instrument all four.

---

## 3. Pricing, and why it is shaped this way

- **Free is metered, not crippled.** Three simulations a day at 2,000 runs, the
  top three of the Edge Board, the whole slate, every box score. A free user can
  see that the model works, which is the only argument that converts.
- **The middle rung is the target.** All-Pro at $29.99 is where the tools live.
  Starter exists to make the meter go away for $12.99 — the easy yes — and
  Franchise at $99 exists mostly so All-Pro reads as reasonable. That is a
  decoy, and it is a legitimate one: Franchise is a real product for someone
  running a syndicate.
- **Annual is framed as months free, not a percentage.** "Two months free"
  outperforms "save 17%" because it is a unit people already own.
- **The trial takes no card.** Seven days of All-Pro, and it simply ends. A
  card-required trial converts better on paper and worse on refunds, reviews,
  and the one thing this product sells, which is trust.
- **The bundle.** Both apps for $39.99/mo or $299/yr. NFL runs September to
  February, college August to January — a bundle is the single cheapest way to
  lift ARPU and cut the offseason churn cliff at the same time. Build it as a
  shared entitlement code the moment either app has 100 paying users.

---

## 4. Colour, and why the app is green

This is a design decision with a commercial job, so it belongs in this document.

- **Dark ground.** Peak usage is 6pm–1am on a phone. A near-black ground cuts
  glare and lets one bright number own the screen. Every trading and betting app
  the audience already uses is dark; matching that lowers the cost of learning
  this one.
- **Green is money and only money.** Edge, profit, wins. Green reads as gain in
  every market app the audience has ever opened, and approach-motivation work
  (Elliot & Maier, 2014) ties green to go-signals and red to avoidance. Using it
  for decoration would spend that for nothing.
- **Gold is value.** Scarcity, trophies, the premium tier, the headline number.
  It marks what costs money.
- **Red is rationed.** Losses only. An app that flashes red at you is an app you
  stop opening in October.
- **60/30/10.** Sixty per cent ground, thirty per cent panel and ink, ten per
  cent accent. Accent that is everywhere is accent that is nowhere.

The two apps deliberately diverge in everything except that green law: the NFL
build is a cool near-black trading desk with tight tabular numbers, the college
build is a warm blackout gameday program with a serif masthead and ticket-stub
rows. Nobody should have to check which one they opened, and two distinct looks
means two distinct brands to market rather than one product in two skins.

---

## 5. Channels, cheapest first

**1. The record itself (owned, free).** Post the graded week every Tuesday: the
locked prediction, the final, the mark. Winning weeks sell; losing weeks build
the credibility that makes the winning weeks believable. Automate it off
`predictions.json` — the data is already published hourly.

**2. Short-form video (owned, ~1 hour a week).** One 20-second clip per slate:
three edges, the conviction bars, the market number, the model number. Vertical,
no face, no voice needed. This is what the Higgsfield tooling in this repo's
workflow is for. Post to TikTok, Reels and Shorts; the same clip is the paid ad
creative if paid ever makes sense.

**3. Reddit (owned, free, rules-bound).** r/sportsbook and team subs tolerate
results, not promotion. Post the graded record with no link in the body; the
profile carries the link. One thread a month, not one a week.

**4. Share cards (viral, built).** The Card screen draws a 1080×1350 image of a
user's own record. A group chat is the cheapest acquisition channel that exists
and it costs nothing per impression. Watch the share→install rate; if it clears
5%, this becomes channel one.

**5. Podcasts and beat writers (paid in access, not cash).** `BEATWRITER` codes
give a year of All-Pro. A regional podcast with 4,000 listeners converts better
than a national one with 400,000 because the audience actually bets that team.
Offer 30% recurring on a referral code before offering cash.

**6. SEO (slow, compounding).** Every team page and every graded game is a page
worth indexing, but the app ships as a single-page bundle today so none of it is
indexable. Pre-rendering the team and record routes is the highest-value
non-feature on the roadmap.

**7. Paid.** Not yet. Do not buy traffic until the free→paid rate is measured
and above 3%, or the money is being spent to find out something the free
channels would have told you.

---

## 6. Retention, which is where the money actually is

At $20 ARPU, one month of extra average lifetime across 490 subscribers is
$10,000 a year. Retention beats acquisition at this size, and it is already
built:

- **Streak.** Counts attendance, not results, so it survives a bad week.
- **Your Card.** Saved picks graded off the same finals the model is graded on,
  with a flat-unit P&L. A record in progress is a reason to open the app that
  has nothing to do with whether anything shipped this week.
- **Badges.** Cheap, and they give a new user a first-week goal.
- **Follows.** A user with teams followed has a Tuesday reason to open.
- **The weekly grade.** The single highest-value unbuilt retention feature is a
  Tuesday push: "your card went 3-1, the model went 9-7." Build it next.

**The offseason cliff is the real risk.** February to August is dead for the NFL
app and January to August for college. Three mitigations, in order of value:
the bundle (staggered seasons), the Season Pass (paid through the gap), and
offseason content that is genuinely useful — draft, schedule release, and
preseason ratings are all real products the engine can already produce.

---

## 7. Ninety days

**Weeks 1–2 — make it chargeable.** Create six Stripe Payment Links, set the env
vars, ship. Add analytics on four events: first sim, meter hit, wall viewed,
checkout opened. Nothing else matters until money can change hands.

**Weeks 3–4 — make it provable.** Automate the Tuesday results post from the
predictions file. Start the video clip habit. Get the first fifty free users
from people you can name.

**Weeks 5–8 — make it shareable.** Ship the weekly-grade notification and the
referral code (`give a week, get a week`). Measure share→install. Take the
first three podcast partnerships with BEATWRITER codes.

**Weeks 9–12 — make it defensible.** Move premium computation behind a licence
check (see Risks). Pre-render team and record pages for search. Ship the
two-app bundle. Review the funnel and put money into whichever step is leaking.

---

## 8. Risks, stated plainly

- **The gate is a product boundary, not a security boundary.** The engine runs
  on the device and the data feed is a public repository, so a determined user
  can read past the paywall. That is acceptable at launch and unacceptable at
  scale. The fix is a licence check on the premium feed and moving props,
  parlay pricing and the deep board server-side — planned, not done.
- **The model can be wrong for a month.** Variance is real, and the wall shows
  the record honestly, so a cold October will cost conversions. This is priced
  in deliberately: the alternative is hiding the record, which destroys the only
  durable asset the product has.
- **Regulatory.** This is information, not advice, and it must keep saying so.
  21+, no guaranteed-profit language ever, responsible-gambling messaging on
  every surface that shows a pick, and a rating that reflects the category. App
  store distribution of gambling-adjacent apps has real rules; the web build
  sidesteps most of them and also sidesteps the 30% cut, which is why the web
  build is the primary product.
- **Data dependency.** The feed is built from public sources on a schedule. If
  ESPN or nflverse changes shape mid-season the app degrades to cached data.
  Monitor the refresh workflow; a silent staleness bug is worse than an outage.
- **One person.** The whole thing is automated on GitHub Actions, which is the
  only reason 490 subscribers is servable by one person. Keep it that way:
  every feature that needs manual weekly work is a feature that ends the
  business.

---

## 9. What to measure

Six numbers, reviewed weekly:

1. Visits → first simulation (target 25%)
2. First simulation → trial started (target 30%)
3. Trial → paid (target 25%)
4. Monthly churn (target under 8%)
5. Effective ARPU (target $20)
6. The model's own ATS record — because it is the product, and it is the
   leading indicator of all five above.
