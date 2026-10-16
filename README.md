# Vellura Dental

A luxury dental clinic booking portal with an AI concierge, built on Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui, PostgreSQL (Prisma), Auth.js v5, Google Gemini API, and Framer Motion.

## Quick start

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npm run db:up               # optional: PostgreSQL via Docker (skip if PostgreSQL runs locally)
npm run db:migrate          # set up the database schema
npm run seed                # admin account and sample services
npm run dev                 # http://localhost:3000
```

Admin portal: <http://localhost:3000/admin>. The seeded account is `admin@velluradental.com` with password `password123`.

## Features

- **AI Concierge.** Chat-based booking powered by Google Gemini, with Groq fallback. Patients describe their treatment needs in natural language and receive available time slots.
- **Live availability.** The clinic's schedule updates in real-time as appointments are booked or cancelled.
- **Service management.** Admins define treatments, duration, and imagery; the concierge learns from these descriptions.
- **Phone validation.** Booking requires a valid phone number; the system prevents duplicate bookings for the same slot.
- **Timezone-aware.** All times respect the clinic's timezone (defaults to Asia/Karachi), never the server's local time.
- **Admin dashboard.** Manage services, view appointments, and monitor clinic operations.

## Demo data

Everything `npm run seed` loads is fictional:

- **Admin account** uses a placeholder email `admin@velluradental.com`.
- **Services** are sample dental treatments; replace with your own in the admin panel.
- **Images** are free-license stock photography from Unsplash, fetched live by keyword (or curated if offline).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | e.g. `postgresql://vellura:vellura@localhost:5433/vellura_dental?schema=public` |
| `AUTH_SECRET` | yes | Session encryption key. Generate with `openssl rand -base64 33` |
| `AUTH_TRUST_HOST` | yes (non-Vercel) | `true` |
| `GEMINI_API_KEY` | yes | Google Gemini API key from https://aistudio.google.com/apikey |
| `CLINIC_TIMEZONE` | no | IANA timezone (defaults to `Asia/Karachi`) |
| `GEMINI_MODEL` | no | Gemini model to use (defaults to `gemini-2.5-flash`) |
| `GROQ_API_KEY` | no | Groq API key as fallback (create at https://console.groq.com/keys) |
| `GROQ_MODEL` | no | Groq model if Gemini is unavailable (defaults to `openai/gpt-oss-120b`) |
| `GEMINI_FALLBACK_MODEL` | no | Secondary Gemini model when primary is overloaded |
| `UNSPLASH_ACCESS_KEY` | no | Unsplash API key; omit to use curated photos |
| `ADMIN_EMAIL` | no | Admin email for seeding (defaults to `admin@velluradental.com`) |
| `ADMIN_PASSWORD` | no | Admin password for seeding (defaults to `password123`) |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development, production build, production server |
| `npm run db:up` / `db:down` | Start or stop the PostgreSQL container from `docker-compose.yml` |
| `npm run db:migrate` | Deploy pending Prisma migrations |
| `npm run seed` | Upsert the admin account and seeded services |
| `npm run db:seed-admin` | Seed (or reset) only the admin account |
| `npm run lint` | ESLint |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |

If a local PostgreSQL service already listens on port 5433, change the host port in `docker-compose.yml` (for example `5434:5432`) and update `DATABASE_URL`.

## Structure

```
app/
  page.tsx                 public portal: home, service descriptions, concierge chat
  login/                   credentials sign-in
  admin/                   clinic dashboard: manage services and view appointments (protected)
  api/chat/                concierge chat endpoint (Gemini + Groq fallback)
  api/auth/                Auth.js route handler
  layout.tsx               root layout, global styles
components/
  chat/                    concierge widget, message rendering
  site/                    public portal (hero, feature cards, FAQ, footer)
  ui/                      shadcn/ui components (card, button, input, etc.)
lib/
  prisma.ts                PostgreSQL connection cache
  clinic.ts                clinic config (name, hours, contact)
  unsplash.ts              Unsplash image fetching
prisma/
  schema.prisma            data models (Service, Appointment, User, Session)
  seed.ts                  seeded data (admin, sample services)
scripts/seed-admin.ts      admin account creation / reset
```

## Notes

- **App Router.** Next.js 16 with the latest app directory conventions.
- **Route protection.** The admin layout verifies the session on the server.
- **Timezone safety.** Clinic times are always rendered in the clinic's timezone, never the browser's or server's local time.
- **Concierge fallback.** If Gemini API is down or rate-limited, the system automatically tries Groq. If both fail, the chat returns a friendly error.
- **PostgreSQL.** The project includes a `docker-compose.yml` for local development. For production, connect to a hosted PostgreSQL instance (e.g., Neon, AWS RDS, Railway).

## Developer

Built and maintained by **Abhishek Kamyani**, a Full Stack Developer from Pakistan with 2+ years of experience building web products with React, Next.js and Node.js.

- **Currently:** Full Stack Developer (Next.js) at AlFactor Inc., plus freelance work
- **Education:** BS Computer Science, Sukkur IBA University
- **Skills:** React, Next.js, TypeScript, Tailwind CSS, Node.js, Express, PostgreSQL, Prisma, REST APIs, Jest, Playwright, Docker, CI/CD
- **Other projects:** Aura Estates (real estate CRM), Tone Shift AI, AI Chef Mate (React Native)

**Contact**

- Portfolio: https://abhishekkamyani.vercel.app/
- Email: abhishekkamyani@gmail.com
- LinkedIn: https://linkedin.com/in/abhishekkamyani
