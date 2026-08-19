# Subscription Tracker & Renewal Dashboard

A personal finance dashboard that aggregates recurring SaaS and streaming
subscriptions, tracks renewal dates, and monitors monthly cash-flow burn.

**All business logic runs on the server.** The browser never normalizes a
billing cycle, computes a total, or decides what counts as "renewing soon" —
it only renders numbers and flags the API already calculated.

## Contents

- [Quick start](#quick-start)
- [Windows setup notes](#windows-setup-notes)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [How it works](#how-it-works)
  - [Cost Uniformity Engine](#cost-uniformity-engine-serverservicescostenginejs)
  - [Date Intersect Calculator](#date-intersect-calculator-serverservicesdateenginejs)
  - [Pause without delete](#pause-without-delete)
- [API reference](#api-reference)
- [Validation rules](#validation-rules)
- [Storage](#storage)
- [Troubleshooting](#troubleshooting)

## Quick start

**Requires Node.js 18+.** There are **no npm dependencies to install** — the
whole app runs on Node's built-in `http`/`fs` modules and vanilla
JS/HTML/CSS on the frontend.

```bash
node server/server.js
# or
npm start
# or, with auto-restart on file changes
npm run dev
```

Then open <http://localhost:3000>.

Sanity-check the API directly:

```bash
curl http://localhost:3000/api/subscriptions
```

## Windows setup notes

Two one-time environment issues commonly show up on a fresh Windows machine
and are easy to mistake for a broken install:

1. **`node`/`npm`/`git` "not recognized" right after installing.**
   Installers (winget, the official MSI, etc.) update the *system* PATH, but
   any terminal window — or app that spawns terminals, like VS Code — that
   was already running keeps the PATH snapshot it started with. **Close and
   fully reopen the terminal or VS Code window** after installing; a new tab
   in an already-running window is not enough.

2. **`npm run dev` fails with `running scripts is disabled on this system`.**
   npm ships a PowerShell wrapper (`npm.ps1`), and Windows' default execution
   policy blocks unsigned local scripts. Fix it once, for your user account
   only (no admin rights required):

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

   `RemoteSigned` still blocks unsigned scripts *downloaded from the
   internet* — it only allows scripts written or installed locally, so this
   is the standard, low-risk fix rather than disabling script security
   entirely.

## Configuration

Both are optional; the app runs with sensible defaults if neither is set.

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port the server listens on. |
| `CURRENT_DATE` | `2026-08-19` | The fixed "today" every renewal calculation runs against (`YYYY-MM-DD`). See [Date Intersect Calculator](#date-intersect-calculator-serverservicesdateenginejs) for why it's fixed instead of `new Date()`. |

```bash
PORT=4000 CURRENT_DATE=2026-09-01 node server/server.js
```

## Architecture

```
request → server.js → router → controller → service → repository
                                    ↓
                    costEngine / dateEngine / validators
```

```
server/
├── server.js                  HTTP bootstrap, API + static mounting
├── config/                    port, fixed reference date, billing/status enums
├── core/                      router, JSON request/response helpers, ApiError
├── routes/                    route table
├── controllers/               request ⇄ service translation only
├── services/
│   ├── subscriptionService.js orchestration + server-side enrichment + metrics
│   ├── costEngine.js          Cost Uniformity Engine
│   └── dateEngine.js          Date Intersect Calculator
├── repositories/              in-memory store (swappable for a database)
├── models/                    Subscription factory
├── validators/                server-side input validation
└── middleware/                static file serving
public/
├── index.html                 entry form, metrics row, subscription grid
├── styles/main.css
└── scripts/
    ├── api.js                 thin fetch wrapper — the only file that knows endpoint URLs
    ├── render.js               DOM rendering / formatting only, no business logic
    └── app.js                  wires DOM events to the API and re-renders responses
```

Each layer has one job and talks only to the layer directly below it:

| Layer | File(s) | Responsibility |
| --- | --- | --- |
| HTTP bootstrap | `server.js` | Creates the server, seeds data, routes `/api/*` vs. static files. |
| Router | `core/router.js` | Dependency-free `:param` path matching. |
| Routes | `routes/subscriptionRoutes.js` | Maps HTTP method + path to a controller function. |
| Controllers | `controllers/subscriptionController.js` | Parses the request, calls a service, shapes the JSON response. Holds no business logic. |
| Services | `services/subscriptionService.js` | Orchestrates validation, storage, and enrichment (cost + date calculations). |
| Repository | `repositories/subscriptionRepository.js` | The only code that touches the in-memory `Map`. |

## How it works

### Cost Uniformity Engine (`server/services/costEngine.js`)

Subscriptions bill on different cycles, so their raw costs cannot be summed
meaningfully. Every subscription is normalized to a common monthly rate —
`monthly → cost as-is`, `yearly → cost / 12` — before any total is taken.

Rounding is applied **once, on the final total**, rather than per row: if you
round every yearly item first (e.g. `1499 / 12 = 124.9166… → 124.92`) and then
sum, many yearly items accumulate a few paise of drift. Summing unrounded
rates and rounding the total avoids that.

`calculateTotalMonthlyBurn` filters to `status === 'active'` only. That one
filter *is* the mechanism behind the pause/resume savings simulation:
pausing a subscription drops its cost out of the sum without deleting the
record. `calculatePausedSavings` runs the same sum over paused rows, giving
the "what would I save by cancelling these?" figure.

### Date Intersect Calculator (`server/services/dateEngine.js`)

Parses each `YYYY-MM-DD` renewal date and the app's **fixed** reference date
(`server/config/index.js`, not `new Date()`, so results are reproducible) as
UTC midnight, then diffs them to get `daysUntilRenewal`. A subscription is
`renewingSoon` when that value is between `0` and `renewalWindowDays`
(7 by default) inclusive.

Anchoring both sides to UTC avoids the classic off-by-one bug from comparing
local time against UTC across a DST boundary.

`renewingSoon` is deliberately **purely date-derived**, matching how the brief
defines the badge — a row renewing within the window carries the amber badge
whether or not it is paused. Status is a separate axis and is applied only where
money is involved: the burn rate (active costs only) and the alert count (active
renewals only). Keeping the two concerns apart is why a paused row can still
show `daysUntilRenewal: 2` and its badge without polluting the metrics.

### Pause without delete

Toggling a row's Active/Paused switch calls `PATCH /api/subscriptions/:id/status`.
The service only flips the `status` field — the record stays in the
repository. Because `calculateTotalMonthlyBurn` filters on `status === 'active'`,
the Total Monthly Burn Rate card drops that cost immediately in the response,
giving a real-time savings simulation. The frontend repaints the row with a
greyed-out `row--paused` class and re-renders the metrics from the response;
it never deletes anything from the DOM's data source, matching the server.

## API reference

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/subscriptions` | All subscriptions (enriched), `metrics`, and `meta` — one call paints the whole dashboard. |
| `POST` | `/api/subscriptions` | Validate and create a subscription. |
| `PATCH` | `/api/subscriptions/:id/status` | Toggle Active / Paused. |
| `DELETE` | `/api/subscriptions/:id` | Remove a subscription. |
| `GET` | `/api/metrics` | Metrics block alone. |

**Each subscription** returned by the API includes server-computed fields on
top of the stored record: `monthlyCost` (Cost Uniformity Engine output),
`daysUntilRenewal`, and `renewingSoon` (Date Intersect Calculator output).

**Metrics block:** `totalMonthlyBurn`, `upcomingRenewalsCount`, `activeCount`,
`pausedCount`, `pausedMonthlySavings`.

**Meta block** (from `GET /api/subscriptions` only): `currency`, `locale`,
`currentDate`, `renewalWindowDays`. The UI builds its `Intl` formatters and
its "within the next N days" label from these, so the currency and the
7-day rule are defined once — in `server/config/index.js` — rather than
being duplicated in the frontend.

## Validation rules

Enforced server-side in `server/validators/subscriptionValidator.js` — the
browser's `required` attributes are a convenience only and are never
trusted:

- **Name** — required, ≤ 60 characters.
- **Cost** — numeric, finite, greater than zero. Rounded to 2 decimals at
  the boundary so the store never holds values like `12.999999` that would
  quietly skew the burn rate.
- **Billing cycle** — exactly `monthly` or `yearly`.
- **Renewal date** — a real `YYYY-MM-DD` calendar date (e.g. `2026-02-30` is
  rejected, not silently rolled forward to March).
- **Status toggle** — limited to `active`/`paused`.

Failures return `400` with a field-keyed `errors` object that the form
renders inline, all-at-once rather than stopping at the first invalid field.

## Storage

Subscriptions are held in an in-memory `Map`, seeded with 5 example
subscriptions at startup, behind a repository module. Data resets whenever
the server restarts. Swapping in a real database means rewriting
`server/repositories/subscriptionRepository.js` and nothing above it.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `node`/`npm` "not recognized" | Terminal/VS Code was open before Node was installed | Fully close and reopen the terminal or VS Code |
| `npm run dev` → "running scripts is disabled" | Windows PowerShell execution policy | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| Port already in use | Another process is bound to 3000 | `PORT=3001 node server/server.js`, or stop the other process |
| Renewal dates look "off by one" | Comparing a local-time date against the UTC reference | Shouldn't happen — file an issue; the app always parses dates as UTC midnight on both sides |
