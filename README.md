# Rideora

White-label cab, van and chauffeur booking platform by **Fascinora**. Each cab operator gets their own install: their brand, domain, fleet, prices and data.

**Proprietary software. © Fascinora. Not for redistribution.**

## What's included

**Website (customers)**
- Booking for one-way, round-trip, hourly chauffeur and airport transfers
- Fixed fares from distance and vehicle category, with airport fee, night surcharge, round-trip discount, extras, promo codes and tax shown line by line
- Card payment online (Razorpay or Stripe), pay the driver, or corporate account
- Booking reference and email confirmation; customers can view or cancel online until a cut-off
- Services, fleet, coverage, FAQ and contact form, all edited from the CMS

**CMS portal (`/admin`)**
- Dashboard: bookings and revenue trends, upcoming trips, vehicle mix, fleet availability
- Bookings: search, filter, export CSV, full history, assign driver and vehicle, refunds, phone bookings
- Dispatch board: Pending → Confirmed → Assigned → On trip → Completed
- Vehicles, drivers, vehicle categories and rates, extras, promo codes (limits, expiry), saved places
- Website content, branding (name, colour, contacts, currency, time zone), region presets
- Staff logins with roles: admin, dispatcher, driver

**Driver app (`/driver`)**: phone-friendly list of assigned trips with call, directions, start and complete.

**Emails**: booking received/confirmed, driver assigned (customer and driver), cancelled, completed, refund, new-booking and new-enquiry alerts to the office.

## Stack

| Part | Technology |
|---|---|
| Website, CMS, driver app | Angular 22 (standalone components, signals) |
| API | NestJS 11, TypeORM, PostgreSQL 16 |
| Security | bcrypt passwords, JWT sessions, role guards, rate limiting, Helmet CSP, server-side pricing and payment verification |
| Hosting | Docker Compose: app + PostgreSQL + Caddy (automatic HTTPS) |

## Run locally

```bash
# 1. PostgreSQL with a database "rideora" (user/password rideora)
# 2. API
cd api && npm install && npx tsc -p .
DATABASE_URL=postgres://rideora:rideora@localhost:5432/rideora JWT_SECRET=$(openssl rand -hex 32) \
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Admin12345 REGION=dubai SEED_DEMO=true node dist/main.js
# 3. Web (dev server with live reload, proxies /api to :3000)
cd web && npm install && npx ng serve
```

Open http://localhost:4200 (website), /admin (CMS), /driver (drivers). For a production-like run, `npx ng build` in `web/` and the API serves the site on :3000.

Tests: `cd api && npx tsc -p . && npm test` (fare engine and payment amounts).

## Deploy for a customer

See [docs/DEPLOY.md](docs/DEPLOY.md). Owner handbook: [docs/OWNER-GUIDE.md](docs/OWNER-GUIDE.md).

## Changing the database

Edit entities in `api/src/entities`, build, then generate a migration:
`cd api && npx tsc -p . && DATABASE_URL=... npx typeorm migration:generate -d dist/data-source.js src/migrations/Name`.
Migrations run automatically when the app starts.
