# Subscription Tracker & Renewal Dashboard

A personal finance dashboard that aggregates recurring SaaS and streaming
subscriptions, tracks renewal dates, and monitors monthly cash-flow burn.

## Running it

Requires **Node.js 18+**. There are **no dependencies to install**.

```bash
node server/server.js
# or
npm start
```

Then open <http://localhost:3000>.

## Architecture

The backend is layered, one responsibility per module:

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
└── scripts/{api,render,app}.js
```

**All business logic runs on the server.** The browser never normalizes a
billing cycle, computes a total, or decides what counts as "renewing soon" —
it renders values the API already calculated. `GET /api/subscriptions` returns
each record with server-computed `monthlyCost`, `daysUntilRenewal`, and
`renewingSoon` fields plus a `metrics` block; confirm with
`curl http://localhost:3000/api/subscriptions`.

### Cost Uniformity Engine (`server/services/costEngine.js`)

Subscriptions bill on different cycles, so their raw costs cannot be summed
meaningfully. Every subscription is normalized to a common monthly rate —
`monthly → cost`, `yearly → cost / 12` — before any total is taken. Rounding is
applied once to the final total rather than per row, so many yearly items do
not accumulate rounding drift. `calculateTotalMonthlyBurn` filters to
`status === 'active'` only — this is the mechanism behind the pause/resume
savings simulation: pausing a subscription drops its cost out of the sum
without deleting the record.

### Date Intersect Calculator (`server/services/dateEngine.js`)

Parses each `YYYY-MM-DD` renewal date and the app's **fixed** reference date
(`server/config/index.js`, not `new Date()`, so results are reproducible) as
UTC midnight, then diffs them to get `daysUntilRenewal`. A subscription is
`renewingSoon` when that value is between 0 and 7 inclusive. Anchoring both
sides to UTC avoids the classic off-by-one bug from comparing local time
against UTC across a DST boundary.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/subscriptions` | All subscriptions (enriched) + metrics block |
| `POST` | `/api/subscriptions` | Validate and create a subscription |
| `PATCH` | `/api/subscriptions/:id/status` | Toggle Active / Paused |
| `DELETE` | `/api/subscriptions/:id` | Remove a subscription |
| `GET` | `/api/metrics` | Metrics block alone |

**Metrics block:** `totalMonthlyBurn`, `upcomingRenewalsCount`, `activeCount`,
`pausedCount`, `pausedMonthlySavings`.

### Validation

Enforced server-side in `server/validators/subscriptionValidator.js`: name
required and ≤ 60 characters; cost numeric, finite, greater than zero; billing
cycle exactly `monthly` or `yearly`; renewal date a real `YYYY-MM-DD` calendar
date; status toggle limited to `active`/`paused`. Failures return `400` with a
field-keyed `errors` object that the form renders inline.

## The Vibe Check: pause without delete

Toggling a row's Active/Paused switch calls `PATCH /api/subscriptions/:id/status`.
The service only flips the `status` field — the record stays in the
repository. Because `calculateTotalMonthlyBurn` filters on `status === 'active'`,
the Total Monthly Burn Rate card drops that cost immediately in the response,
giving a real-time savings simulation. The frontend repaints the row with a
greyed-out `row--paused` class and re-renders the metrics from the response;
it never deletes anything from the DOM's data source, matching the server.

## Storage

Subscriptions are held in an in-memory `Map` seeded at startup, behind a
repository module. Swapping in a real database means rewriting
`server/repositories/subscriptionRepository.js` and nothing above it.
