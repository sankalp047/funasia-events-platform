# 🎪 FunAsia Events Platform

A full-stack ticketing platform for concerts, cultural events, conferences, and sports.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  React Frontend │────▶│  Express REST API │────▶│  PostgreSQL   │
│  (Vite + React) │     │  (Node.js)       │     │  (Supabase)   │
└─────────────────┘     └────────┬─────────┘     └───────────────┘
                                 │
┌─────────────────┐     ┌────────┴─────────┐     ┌───────────────┐
│  Mobile App     │────▶│  Same API        │     │  Supabase     │
│  (React Native) │     │  /api/*          │     │  Auth + Storage│
└─────────────────┘     └──┬──────────┬────┘     └───────────────┘
                           │          │
                    ┌──────┴──┐  ┌────┴──────┐
                    │ Stripe  │  │  Mailgun  │
                    │ Payments│  │  Emails   │
                    └─────────┘  └───────────┘
```

## User Flow

1. **Login** → Email/password, Google OAuth, or Phone OTP (Supabase Auth)
2. **Browse Events** → Location-based (PostGIS, 100mi radius) or filter by city/state
3. **Event Page** → View media carousel, seat map image, pricing tiers, food options
4. **Select Tickets** → Choose tier, select seats, add food/drinks
5. **Checkout** → Seats reserved for **5 minutes** → Stripe Checkout
6. **Payment** → Stripe processes → Webhook confirms order
7. **Confirmation** → Mailgun sends email with **individual barcodes per attendee**
8. **Entry** → Mobile app scans barcodes at venue (separate project)

## Admin Flow

1. **Create Event** → Name, description, venue, media (images 16:9 / short video), timing
2. **Set Pricing** → Ticket tiers with per-tier limits, free or paid
3. **Add Food/Drinks** → Optional food options with pricing
4. **Set Payout** → Connect Stripe account for bank payouts
5. **Publish** → Event goes live
6. **Track Sales** → Real-time dashboard, attendee lists, check-in stats

## Super Admin

- Manage all users (promote to admin, view all)
- Manage all events (publish/cancel any event)
- Platform settings (fees, reservation timeout, etc.)
- Financial overview (total revenue, platform earnings)
- Audit log of all activity

---

## Project Structure

```
funasia/
├── backend/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Full DB schema (users, events, orders, seats, food, payouts)
│   │   └── 002_rpc_functions.sql     # PostGIS geo search, atomic counters
│   ├── src/
│   │   ├── config/
│   │   │   ├── supabase.js           # Supabase client (public + admin)
│   │   │   └── stripe.js             # Stripe client
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT auth, role guards
│   │   │   └── validate.js           # Joi schemas for all endpoints
│   │   ├── routes/
│   │   │   ├── auth.routes.js        # Register, login, Google, phone OTP
│   │   │   ├── events.routes.js      # Search (geo), detail, CRUD
│   │   │   ├── orders.routes.js      # Reserve seats, Stripe checkout, cancel
│   │   │   ├── webhook.routes.js     # Stripe webhooks → confirm + email
│   │   │   ├── admin.routes.js       # Dashboard, sales, check-in, Stripe Connect
│   │   │   └── superadmin.routes.js  # Platform management
│   │   ├── services/
│   │   │   └── email.service.js      # Mailgun + barcode generation
│   │   └── server.js                 # Express app + cron for reservation cleanup
│   ├── .env.example
│   └── package.json
└── frontend/                          # React app (Vite)
```

---

## Setup Guide

### 1. Supabase

1. Create project at [supabase.com](https://supabase.com)
2. Enable **PostGIS** extension in SQL editor
3. Run `migrations/001_initial_schema.sql`
4. Run `migrations/002_rpc_functions.sql`
5. Enable Auth providers: Email, Google, Phone
6. Create storage bucket `event-media` (public)

### 2. Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Get API keys (test mode)
3. Set up webhook endpoint: `https://your-api.com/api/webhooks/stripe`
4. Listen for: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`
5. Enable **Stripe Connect** for admin payouts

### 3. Mailgun

1. Create account at [mailgun.com](https://www.mailgun.com)
2. Add and verify your domain
3. Get API key

### 4. Backend

```bash
cd backend
cp .env.example .env   # Fill in all keys
npm install
npm run dev             # Starts on :4000
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev             # Starts on :5173
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Email/password signup |
| POST | /api/auth/login | Email/password login |
| POST | /api/auth/google | Initiate Google OAuth |
| POST | /api/auth/google/callback | Exchange OAuth code |
| POST | /api/auth/phone/otp | Send phone OTP |
| POST | /api/auth/phone/verify | Verify OTP |
| GET | /api/auth/me | Get current user |
| PATCH | /api/auth/me | Update profile |
| POST | /api/auth/refresh | Refresh token |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/events?lat=&lng=&radius_miles=100 | Search events by location |
| GET | /api/events?city=Dallas&state=TX | Search by city/state |
| GET | /api/events/:id | Event detail + tiers + seats + food |
| POST | /api/events | Create event (admin) |
| POST | /api/events/:id/publish | Publish event |
| POST | /api/events/:id/media | Upload media URLs |
| PATCH | /api/events/:id | Update event |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/orders | Create order (reserves seats 5 min) → returns Stripe checkout URL |
| GET | /api/orders | List user's orders |
| GET | /api/orders/:id | Order detail |
| POST | /api/orders/:id/cancel | Cancel reserved order |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard | Sales stats, revenue charts |
| GET | /api/admin/events/:id/orders | Orders for an event |
| GET | /api/admin/events/:id/attendees | Attendee list for check-in |
| POST | /api/admin/checkin | Scan barcode |
| POST | /api/admin/stripe/connect | Setup payout bank account |

### Super Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/super-admin/dashboard | Platform-wide stats |
| GET | /api/super-admin/users | All users |
| PATCH | /api/super-admin/users/:id/role | Change user role |
| GET | /api/super-admin/events | All events (any status) |
| PATCH | /api/super-admin/events/:id/status | Force publish/cancel |
| GET/PATCH | /api/super-admin/settings | Platform fee config |
| GET | /api/super-admin/orders | All orders |
| GET | /api/super-admin/payouts | All payouts |

---

## Key Features

- **5-minute seat reservation** with auto-release cron
- **PostGIS location search** (100mi default radius)
- **Stripe Checkout** with webhook confirmation
- **Stripe Connect** for admin payouts to their bank
- **Mailgun emails** with auto-generated barcodes per attendee
- **Barcode check-in API** ready for mobile scanner app
- **Flexible platform fees** (% + flat, configurable by super admin)
- **Promo codes** (% or flat discount, per-event or platform-wide)
- **Food/drink add-ons** per event
- **Audit log** for all actions
- **Row Level Security** on Supabase
- **Rate limiting** on auth + API endpoints
