# Absen QR - Mentor-Student QR Attendance System

A lightweight QR-driven attendance system for mentoring events. Built on Cloudflare Workers + D1 for a simple, serverless architecture.

**Live Demo:** https://absen-qr.phantast-check.workers.dev

## Overview

Absen QR supports a three-role workflow for tracking mentor-student interactions during single-day events:

- **Students** scan mentor QR codes and view their same-day mentor history
- **Mentors** display a persistent QR code and capture notes immediately after each student scan
- **Admins** inspect, correct, and export the complete event-day records

## Features

### Student Flow
- Open your private secret link
- Use device camera to scan mentor QR codes
- Get immediate success/failure feedback
- View same-day mentor scan history
- Duplicate scan prevention (same student→mentor on same day rejected)

### Mentor Flow
- Open your private secret link
- Display your stable QR code throughout the event
- Page auto-updates when students scan (polling)
- Enter notes immediately while interaction is fresh
- View recent scan history with student names

### Admin Flow
- Secure secret-link access
- View all scan transactions for the event-day
- Edit notes on existing records
- Delete erroneous records
- Reassign records to correct student/mentor
- Export CSV with fixed column order: `student name, secret id, mentor scanned, date, notes`

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite-based)
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **QR Generation:** Server-side SVG generation with qrcode-svg
- **Testing:** Vitest
- **Type Safety:** TypeScript

## Quick Start

### Prerequisites
- Node.js
- Cloudflare account with Workers enabled
- Wrangler CLI authenticated

### Local Development

```bash
# Install dependencies
npm install

# Set up local D1 database
npm run d1:migrate:local

# Seed with demo data (5 students + 5 mentors)
npm run seed:local

# Start local dev server
npm run dev
```

### Demo URLs (Local)

After seeding, you can access the demo with these secret links:

- **Student:** http://localhost:8787/student/local-student-token-001
- **Mentor:** http://localhost:8787/mentor/local-mentor-token-001
- **Admin:** http://localhost:8787/admin/local-admin-secret-token

### Deploy to Production

```bash
# 1. Create remote D1 database
wrangler d1 create "absen-qr"

# 2. Update wrangler.jsonc with your database_id

# 3. Set admin secret
wrangler secret put ADMIN_SECRET

# 4. Run remote migrations
wrangler d1 migrations apply absen-qr --remote

# 5. Seed remote database
wrangler d1 execute absen-qr --remote --file ./seed/dev.sql

# 6. Deploy
wrangler deploy
```

## Architecture

### Data Model

**people table**
- `person_id` - unique identifier
- `display_name` - human-readable name
- `role` - `student` or `mentor`
- `secret_id` - internal secret identifier
- `secret_path_token` - URL-safe secret token

**scan_records table**
- `scan_id` - unique scan identifier
- `student_id` - foreign key to people
- `mentor_id` - foreign key to people
- `event_date` - YYYY-MM-DD format
- `scanned_at` - ISO timestamp
- `notes` - mentor notes
- `updated_at` - last modification timestamp

### API Endpoints

**Student APIs**
- `GET /api/student/me` - Get student identity
- `POST /api/student/scan` - Record a mentor scan
- `GET /api/student/history` - Get same-day mentor history

**Mentor APIs**
- `GET /api/mentor/me` - Get mentor identity + QR payload + QR SVG
- `GET /api/mentor/recent-scans` - Get recent scans for live updates
- `POST /api/mentor/notes/:scanId` - Save notes for a scan

**Admin APIs**
- `GET /api/admin/records` - List all event-day records
- `PATCH /api/admin/records/:scanId` - Edit record
- `DELETE /api/admin/records/:scanId` - Delete record
- `GET /api/admin/export.csv` - Export CSV

### QR Payload Format

Mentor QR codes encode: `absenqr:v1:mentor:<mentorId>`

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- test/integration/student-api.test.ts
npm test -- test/integration/mentor-api.test.ts
npm test -- test/integration/student-page-dom.test.ts
npm test -- test/integration/mentor-page-dom.test.ts

# Type checking
npm run typecheck
```

## Configuration

### Environment Variables

Set via Wrangler secrets or `wrangler.jsonc` vars:

- `ADMIN_SECRET` - Secret token for admin access (set via `wrangler secret put`)
- `EVENT_DATE` - Event date in YYYY-MM-DD format (set in wrangler.jsonc vars)

### D1 Database Binding

The Worker expects a D1 binding named `DB`:

```jsonc
{
  "d1_databases": [{
    "binding": "DB",
    "database_name": "absen-qr",
    "database_id": "your-database-id",
    "preview_database_id": "your-database-id",
    "migrations_dir": "./migrations"
  }]
}
```

## Constraints

This v1 implementation is designed for:
- **Single event-day only** - no multi-day support
- **5 mentors + 5 students** - pilot scale
- **Secret-link access** - no traditional login/auth
- **Web-only** - no native app
- **CSV export only** - no PDF reporting
- **Last-write-wins** - admin corrections overwrite

## Project Structure

```
├── docs/
│   ├── prd/                          # Product Requirements Documents
│   └── implementation/               # Implementation plans
├── public/
│   ├── student/                      # Student role pages
│   ├── mentor/                       # Mentor role pages
│   └── admin/                        # Admin role pages
├── src/worker/
│   ├── index.ts                      # Worker entry point
│   ├── routes/                       # API route handlers
│   ├── services/                     # Business logic
│   ├── db/                           # Database queries
│   ├── validation/                   # Input validation
│   └── types.ts                      # TypeScript types
├── migrations/                       # D1 migration files
├── seed/                             # Database seed data
├── test/
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   └── support/                      # Test utilities
├── wrangler.jsonc                    # Worker configuration
├── package.json
└── tsconfig.json
```

## How to Use (Student Guide)

1. **Get your secret link** from the event organizer
2. **Open the link** on your phone or laptop browser
3. **Tap "Start Scanner"** and allow camera access
4. **Point your camera** at a mentor's QR code
5. **Wait for the beep** - you'll see success confirmation
6. **View your history** - scroll down to see mentors you've scanned today
7. **Try scanning the same mentor again** - you'll see "Already scanned today"

## How to Use (Mentor Guide)

1. **Get your secret link** from the event organizer
2. **Open the link** on a laptop or tablet
3. **Keep the page open** - your QR code stays visible
4. **When a student scans you**, the page will update automatically
5. **Enter notes** in the text area for that student
6. **Click "Save Notes"** - notes are saved immediately

## How to Use (Admin Guide)

1. **Get the admin secret link** from the deployment team
2. **Open the link** to view all scan records
3. **Export CSV** anytime for reporting
4. **Edit notes** by clicking on any record
5. **Delete records** if they were created in error
6. **Reassign records** if a student was misidentified

## License

MIT

## Contributing

See project documentation in `docs/` for detailed specs and implementation plans.

---

Built with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent) - an AI orchestrator for software development.