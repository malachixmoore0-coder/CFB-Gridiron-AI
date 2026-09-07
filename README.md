# CFB Gridiron AI 🏈

**A college football bias & predictive analytics engine, fed by live data.**
Pick any two of the 130+ FBS programs and CFB Gridiron AI grades the matchup
through four weighted analytical nodes, simulates the game 10,000 times, and
returns win probability, a projected score and total, a 1-10 advantage matrix,
a three-act game script and a sleeper report — with every factor that moved
the number laid out for you, and the market line next to the model's.


> **This repository is now the college data pipeline.**
> The app people use is [Gridiron AI](https://github.com/malachixmoore0-coder/Gridiron-Ai),
> which covers the NFL and college football in one place under one subscription.
> Everything here still runs: the pipeline rebuilds the college dataset on its
> schedule, publishes it to `data/live/`, and the combined app reads it from
> this repo. The standalone college app in `src/` remains deployed and working,
> but new UI work happens in the combined app.


It is the college sibling of [Gridiron AI](https://github.com/malachixmoore0-coder/Gridiron-Ai)
(the NFL version): same engine shape, same app, rebuilt around what public
college data actually exposes — Elo-driven talent gaps, 40-point lines,
overtime that always ends, 100,000-seat home crowds, and rosters that turn
over every winter.

The dataset behind it rebuilds itself on a schedule from public sources, so
ratings, depth charts, schedules, lines, rankings and kickoff weather stay
current without anyone touching a file.

## How the data stays live

```
 sportsdataverse ESPN play-by-play parquet   (EPA, success, havoc, air yards,
   sacks & hurries, player ids — every FBS game, refreshed in-season)
 cfbfastR-data mirrors of CollegeFootballData (schedule + results + Elo,
   rosters, team info & venues)
 ESPN odds · rankings · injuries · depth charts · Open-Meteo forecasts   (best-effort extras)
        │
        ▼   GitHub Action, every 3 h in-season (refresh-data.yml)
 pipeline/build.ts  ──►  data/live/{teams,schedule,meta,predictions}.json  ──►  commit
        │
        ▼
 web app rebuilt & published to GitHub Pages
        │
        ▼
 app fetches the newest JSON on launch (raw GitHub URL), caches it on-device,
 and falls back to the copy bundled at build time.
```

What gets computed on every refresh:

| Engine input | Source |
| --- | --- |
| Passing / rushing efficiency, explosiveness, success rate | EPA per play from play-by-play |
| Pass-block & pass-rush win rates | Pressure proxies: (sacks + hurries) ÷ dropbacks, per team; per player from sacks and forced fumbles |
| Slot vs nickel, TE vs linebackers | EPA on short WR targets / on TE-and-RB targets, both sides of the ball |
| 3rd-down conversion & stop rates, 4th-down go rate, red-zone TD rate | Play-by-play down-and-distance |
| Early-down pass rate, pace, QB run share, scheme label | Play-by-play tendencies (Air Raid / Spread / RPO / Tempo / Pro Style / Wide Zone / Power / Triple Option / Vertical) |
| Halftime and secondary adjustments | 2nd-half minus 1st-half EPA margins, shrunk toward average |
| Offense vs 4-2-5 / 4-3 / 3-3-5 / 3-4 fronts | EPA split by the opponent's base front |
| Program strength ("talent") | z-score of the latest CollegeFootballData Elo among FBS teams |
| Depth charts, roles | ESPN depth charts when reachable, otherwise usage from play-by-play and roster class |
| Player grades, target share, TPRR, PRWR | Position-relative percentiles of production; targets ÷ (dropbacks × snap share); sacks per game |
| Availability | ESPN injury list (best-effort; college reports are thin, so the app lets you flag players yourself) |
| Schedule, kickoffs, neutral sites, bowl names | CollegeFootballData schedule file |
| Spreads, totals, moneylines, rankings, TV | ESPN scoreboard + rankings (best-effort); ESPN's pregame line from the play-by-play feed for finals |
| Kickoff weather | Open-Meteo forecast for outdoor games inside the forecast window |

**Blending.** Team metrics are `w · current season + (1 − w) · prior season`
with `w = games played ÷ (games played + 4)`, and each unit rating then leans
toward the program's Elo-derived talent level with weight `0.12 + 0.33 · (1 − w)`
— last year's numbers are a weaker prior in college than in the NFL, so the
model trusts program strength until this year's sample builds.
`meta.json` records the weights, the sources that succeeded, and every proxy
definition.

**Still curated by hand** (`src/data/curated.ts`): each defence's preferred
coverage family and base front, play-action rates (not charted for college),
crowd-noise bumps on top of stadium capacity, and the rivalry list. Team
identities, colours, venues and coordinates are generated from
CollegeFootballData by `npm run data:gen-teams` into `src/data/fbs.ts`.

## The analytical engine (`src/engine/`)

Every matchup is processed through four weighted nodes. Each node returns an
**edge** (−10 to +10, positive favours the home team) plus the list of factors
that produced it, and its weighted edge becomes points of projected margin.

| Node | Default weight | What it measures |
| --- | --- | --- |
| **Scheme & Tactical Bias** | 25% | Offense vs the *specific* front and base coverage it will see; play-action leverage vs the opponent's linebackers and havoc rate; passing and rushing efficiency against what the defence actually stops; 3rd-down success vs stop rate; 4th-down go rate, red-zone TD rate and aggressiveness; halftime and secondary adjustments. |
| **Personnel & Matchup Edge** | 35% | Quarterback; roster talent / program strength; pass-block win rate vs pass-rush win rate in both directions; slot receiver vs nickel; TE speed vs linebackers; explosive plays vs takeaways; and the **injury degradation metric** — a backup QB costs −20% win efficiency, a missing LT −12% pass protection, an edge rusher −8%, and so on. |
| **Environmental & Rivalry** | 15% | Home-field advantage of 4–8 win-probability points scaled by crowd noise and capacity, travel distance, altitude and night kickoffs; weather effects on the total and on the more pass-dependent team; conference and rivalry variance. |
| **Sleeper & X-Factor** | 25% | Target share and targets-per-route-run projections, rotational pass-rusher snap % and PRWR, target-tree concentration, and mismatch sleepers. |

On top of the node blend a **mismatch convexity** term lets a 10-vs-2 talent
gap produce a 40-point line rather than a 20-point one. A seeded Monte-Carlo
simulation (default **10,000 runs**, halves sampled separately, college
overtime always resolved) then produces the win probability & score metric,
the advantage matrix, the simulation narrative (early script, halftime shifts,
late-game clutch factor) and the 2-3 player sleeper report. Same inputs
always reproduce the same games; "Re-roll" draws a fresh seed.

## The app

- **Matchup** — defaults to the week's biggest ranked game; pick any away @
  home from a searchable, conference-grouped picker, toggle neutral site /
  primetime, choose weather (auto-filled from the forecast), see flagged
  players, and run. Market line, kickoff, TV and bowl name show for scheduled games.
- **Result** — everything above plus a model-vs-market comparison, each node's
  factor list, the injury degradation table, a margin histogram and the most
  likely finals.
- **Slate** — the whole season, one tab per week, opening on the current one.
  Within a week the games split into **Playing now** (live score and clock),
  **Upcoming** (model vs the market before kickoff) and **Final** (with whether
  the model called it), and the existing Ranked / Power 4 / Group of 5 /
  conference filters still apply.
- **Record** — the model's track record. Every refresh predicts each upcoming
  game with the default model and the market line at that moment; the
  prediction is rewritten until kickoff, then frozen, then graded when the
  final score lands: straight-up, against the spread, over/under, Brier score,
  margin and total error, and a calibration table (when the favourite is
  given 70-80%, does it win 70-80% of the time?). Graded, locked and open
  predictions are all listed. Nothing is back-filled — a game first seen after
  kickoff is never scored.
- **Teams** — every FBS program grouped by conference (or ordered by poll and
  Elo), with search. Each team gets its own scrolling page: identity and
  tendencies, the season schedule with results, the depth chart split into
  1st / 2nd / 3rd string, the full roster by position group, and the ratings
  feeding the engine.
- **Box scores** — tap a played game on a team's schedule for its box score:
  the final, the model's verdict on that game, team totals for both sides, and
  passing / rushing / receiving / defense / kicking tables you can switch
  between the two teams. Tap any line for that player's profile. Tapping a game
  that has not kicked off yet opens the matchup preview instead.
- **Player profiles** — tap any player for his headshot (initials when the
  feed has no photo), jersey, class, height and weight, hometown, depth and
  starting status, availability you can override, a grade with its basis,
  strengths and weaknesses as percentiles against every FBS player at his
  position, how he projects against the next opponent, season totals and a
  game-by-game log.
- **Model** — node weights, simulation count, base home-field edge, the injury
  metric table, and a live-data panel (source, freshness, blend, poll, sources
  OK, manual refresh).

Nothing here is betting advice.

## Tiers, and turning payments on

Four tiers — Walk-On (free), Scholarship, Blue Chip, Dynasty — defined in one place,
`src/monetize/tiers.ts`. Each is a set of entitlements (simulation depth, how far
down the Edge Board you can see, history, props, parlay legs, share cards), and
every gate in the app reads from that file, so changing the offer is a one-file
edit.

- The free tier is metered, not crippled: three simulations a day at 2,000 runs,
  the top three of the Edge Board, every game on the slate and every box score.
- A 7-day Blue Chip trial is offered in onboarding and on the wall. It takes no
  card and simply ends.
- The paywall's headline is the model's own graded record, computed live from
  `predictions.json`. Under ten graded games it says so instead of cherry-picking.

**Payments are Stripe Payment Links.** No server, no SDK, and no store cut on
the web build. Create one link per tier per cycle and set them as build-time
environment variables:

```
EXPO_PUBLIC_PAY_SCHOLARSHIP_MONTHLY=https://buy.stripe.com/...
EXPO_PUBLIC_PAY_SCHOLARSHIP_SEASON=...
EXPO_PUBLIC_PAY_BLUECHIP_MONTHLY=...
EXPO_PUBLIC_PAY_BLUECHIP_SEASON=...
EXPO_PUBLIC_PAY_DYNASTY_MONTHLY=...
EXPO_PUBLIC_PAY_DYNASTY_SEASON=...
EXPO_PUBLIC_BILLING_PORTAL=https://billing.stripe.com/p/login/...
```

Set the success URL on each link to `<site>/?upgraded=<tier>` and the app flips
over the moment the buyer lands back. Until the variables are set the wall still
sells — it records the intent rather than dead-ending on a broken button.

One thing stated plainly: **the gate is a product boundary, not a security
boundary.** The engine runs on the device and the dataset is a public repo, so a
determined user can read past it. Moving premium computation behind a licence
check is the next step on that road — see `docs/GROWTH.md`.

## The commercial plan

`docs/GROWTH.md` is the business half of this repo: the arithmetic to $10k a
month (≈490 subscribers at a $20 blended ARPU, not 50,000 users), why the ladder
is priced the way it is, the colour decisions and what job each one does, the
channels ranked by cost, the retention loops, a 90-day plan and the risks —
including the ones that are unflattering.

## Run it

```bash
npm install
npm run data:build        # pull live data → data/live/*.json (about a minute)
npx expo start            # i / a / w for iOS, Android, web
```

```bash
npm run typecheck            # app + pipeline
npm run test:engine          # engine assertions, incl. the generated dataset
npm run data:build:offline   # skip Open-Meteo calls
npm run data:gen-teams       # regenerate src/data/fbs.ts after realignment
```

Point the app at a different feed with `EXPO_PUBLIC_DATA_URL=https://…/data/live`.
`--no-espn` on the build skips the ESPN enrichers (useful behind a proxy).

## Deploy

Two workflows ship with the repo:

- **`refresh-data.yml`** — on a cron (every 3 h late Aug–Jan, every 12 h
  otherwise) and on demand: rebuilds the dataset, runs the engine checks,
  commits `data/live/` if anything changed, rebuilds the web app and publishes
  it to GitHub Pages.
- **`refresh-scores.yml`** — every 20 minutes on game days: pulls the ESPN
  scoreboard and updates team records, finalises games on the slate and grades
  any prediction whose game just ended. It skips the rebuild entirely, so a
  final score lands in the app within minutes (`npm run data:scores`).
- **`deploy.yml`** — on pushes to `main` that touch app code: typecheck, engine
  checks, build, publish.

One-time setup in the repository: **Settings → Pages → Build and deployment →
Source: GitHub Actions** (the workflow also attempts to enable this itself).
The site then lives at `https://malachixmoore0-coder.github.io/CFB-Gridiron-AI/`.
On a phone, **Add to Home Screen** installs it full-screen with its own icon.

Native builds: `eas build --platform ios --profile preview`.

## Structure

```
├── .github/workflows/     refresh-data.yml · deploy.yml
├── data/live/             generated: teams.json · schedule.json · meta.json · predictions.json (season track record)
│   └── rosters/           generated: one file per team (full roster, game logs, schedule)
├── pipeline/              the data build (Node 22, TypeScript)
│   ├── build.ts           orchestration, validation, writes data/live
│   ├── sources/           sdvpbp.ts (parquet pbp aggregator) · cfbfastr.ts · espn.ts · weather.ts
│   ├── compute/           teams.ts · rosters.ts · schedule.ts · predictions.ts (track record)
│   └── lib/               fetch/cache/CSV streaming · parquet reader · math helpers
├── scripts/               engine-check.ts · gen-teams.ts · refresh-scores.ts · make-icons.js
├── src/
│   ├── engine/            pure TypeScript engine (nodes, injuries, simulate, matrix, narrative)
│   ├── data/              fbs.ts (generated identities) · curated.ts · teams.ts (baseline) · liveTypes.ts · slate.ts
│   ├── context/           TeamsContext (live data) · SettingsContext (weights, overrides)
│   ├── hooks/ components/ screens/ navigation/ theme.ts
└── App.tsx
```

Built with Expo + React Native + TypeScript. No backend, no accounts, no keys.
Data © their respective sources: sportsdataverse (CC BY 4.0), CollegeFootballData, ESPN, Open-Meteo.
