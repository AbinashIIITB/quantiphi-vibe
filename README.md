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
                          costEngine / validators
```

```
server/
├── server.js                  HTTP bootstrap, API + static mounting
├── config/                    port, fixed reference date, billing/status enums
├── core/                      router, JSON request/response helpers, ApiError
├── routes/                    route table
├── controllers/               request ⇄ service translation only
├── services/
│   ├── subscriptionService.js orchestration + server-side enrichment
│   └── costEngine.js          Cost Uniformity Engine
├── repositories/              in-memory store (swappable for a database)
├── models/                    Subscription factory
├── validators/                server-side input validation
└── middleware/                static file serving
public/
├── index.html
├── styles/main.css
└── scripts/{api,render,app}.js
```

**All business logic runs on the server.** The browser never normalizes a
billing cycle or computes a total — it renders values the API already
calculated. `GET /api/subscriptions` returns each record with a server-computed
`monthlyCost` field, which you can confirm with
`curl http://localhost:3000/api/subscriptions`.

### Cost Uniformity Engine (`server/services/costEngine.js`)

Subscriptions bill on different cycles, so their raw costs cannot be summed
meaningfully. Every subscription is normalized to a common monthly rate —
`monthly → cost`, `yearly → cost / 12` — before any total is taken. Rounding is
applied once to the final total rather than per row, so many yearly items do not
accumulate rounding drift.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/subscriptions` | All subscriptions with server-computed fields |
| `POST` | `/api/subscriptions` | Validate and create a subscription |

### Validation

Enforced server-side in `server/validators/subscriptionValidator.js`: name
required and ≤ 60 characters; cost numeric, finite, greater than zero; billing
cycle exactly `monthly` or `yearly`; renewal date a real `YYYY-MM-DD` calendar
date. Failures return `400` with a field-keyed `errors` object that the form
renders inline.

## Storage

Subscriptions are held in an in-memory `Map` seeded at startup, behind a
repository module. Swapping in a real database means rewriting
`server/repositories/subscriptionRepository.js` and nothing above it.
