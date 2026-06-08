---
date: 2026-06-06
topic: "Bidirectional QR Scanning with Role-Preserved Toggle"
status: validated
---

## Problem Statement

Currently only students can scan mentors. The student page has a camera scanner; the mentor page displays a QR code. We need both roles to be able to scan each other and display their own QR codes, while preserving the existing role-specific page structures and features.

## Constraints

- v1 is locked: single UTC calendar-day, duplicate scans rejected, admin last-write-wins
- Both pages must remain role-specific (student page at `/student/:token`, mentor at `/mentor/:token`)
- Existing mentor QR codes must remain valid
- Mobile-first layout for student page
- No build step (vanilla HTML/CSS/JS)

## Approach

Add a **mode toggle** to both pages that switches between **Scan QR** and **Show QR** modes. Each page defaults to its existing primary mode (student → Scan, mentor → Show). Extract scan creation logic into a shared backend service that handles bidirectional scanning.

I considered unifying both pages into a single generic page, but rejected it because:
- Mentor page has unique features (notes editing, fallback codes) not needed on student page
- Student page has a simpler mobile-first layout that shouldn't inherit mentor complexity
- Preserving separate pages is cleaner and matches the PRD's role-specific architecture

## Architecture

### Frontend

Both `public/student/` and `public/mentor/` pages get:

1. **Mode Toggle** - Pill-shaped segmented control above the main view
2. **Scanner View** - Camera-based QR scanner (existing student logic)
3. **QR Display View** - SVG QR code display (existing mentor logic)

The main view area swaps content based on toggle state. Other page sections (student history, mentor recent scans + fallback codes) remain visible regardless of mode.

### Backend

1. **Generalized QR Parser** - Supports `absenqr:v1:student:` and `absenqr:v1:mentor:` prefixes
2. **Shared Scan Service** - Extracted from student routes, handles bidirectional scan creation
3. **Student `/api/me`** - Now returns `qrPayload` and `qrSvg` alongside identity
4. **Mentor `POST /api/scan`** - New endpoint using the shared scan service

## Components

### Mode Toggle (Frontend)

- Positioned above the scanner/QR card on both pages
- Two buttons: "Scan QR" and "Show QR"
- Active state: green fill (`#16a34a`), white text
- Inactive state: white background, green text/border
- Clicking switches mode and updates the main view
- Keyboard accessible (button elements)

### Scanner View (Frontend)

On **mentor page** (new):
- Include `qr-scanner` library in HTML
- Reuse scanner initialization, start/stop, decode handling from student page
- POST scanned QR to `/mentor/:token/api/scan`
- Same feedback UI (success/error panels)
- Same camera permission and error handling

On **student page** (existing, preserved):
- No changes to scanner behavior
- Already posts to `/student/:token/api/scan`

### QR Display View (Frontend)

On **student page** (new):
- Fetch QR SVG from `/api/me` response
- Render SVG in a styled container (same styling as mentor page)
- Hidden by default (default mode is Scan QR)

On **mentor page** (existing, preserved):
- No changes to QR display behavior
- Visible by default (default mode is Show QR)

### Shared Scan Service (Backend)

Extracted into `src/worker/services/scan-submission.ts`:

**Inputs:**
- `scannerPerson` - the authenticated person making the scan
- `qrPayload` - the decoded QR string

**Logic:**
1. Parse QR payload to extract role and personId
2. Look up scanned person in DB
3. Validate scanned person exists
4. Reject if same role (student can't scan student, mentor can't scan mentor)
5. Reject if self-scan
6. Determine `studentId` and `mentorId` for the record
7. Check for existing scan on same day
8. Create scan record

**Returns:** `{ scan, scannedPerson }`

### API Changes

**Student `/api/me` (modified):**
```
GET /student/:token/api/me
Response: { personId, displayName, secretId, qrPayload, qrSvg }
```

**Mentor `/api/scan` (new):**
```
POST /mentor/:token/api/scan
Body: { qrPayload: string }
Response: { scan: ScanRecord, scannedPerson: { personId, displayName } }
```

**Student `/api/scan` (generalized):**
- Same endpoint, now accepts both student and mentor QR payloads
- Uses shared scan service

## Data Flow

### Student Shows QR (New Flow)

1. Student opens their secret link
2. Page loads in "Scan QR" mode (default)
3. `/api/me` returns identity + `qrPayload` + `qrSvg`
4. Student toggles to "Show QR"
5. QR SVG renders in the display area
7. Mentor scans the displayed QR code

### Mentor Scans Student (New Flow)

1. Mentor opens their secret link
2. Page loads in "Show QR" mode (default)
3. Mentor toggles to "Scan QR"
4. Scanner initializes, camera preview appears
5. Mentor scans a student's QR code
6. Frontend POSTs `{ qrPayload }` to `/mentor/:token/api/scan`
7. Backend validates the student exists
8. Backend creates scan record with correct student/mentor IDs
9. Success feedback shown on mentor page
10. Recent scans list refreshes automatically

### Existing Flows (Preserved)

- Student scans mentor: unchanged
- Mentor displays QR: unchanged
- Student views history: unchanged
- Mentor views recent scans + notes: unchanged

## Error Handling

| Scenario | Status | Message |
|---|---|---|
| Same-role scan | 400 | "You can only scan the opposite role." |
| Self-scan | 400 | "You cannot scan yourself." |
| Invalid QR payload | 400 | "Invalid QR payload." |
| Scanned person not found | 400 | "Invalid QR payload." |
| Duplicate scan today | 409 | "Already scanned today." |
| Camera permission denied | UI | Permission retry button |

## Testing Strategy

- **Unit tests:**
  - Generalized QR parser handles both student and mentor prefixes
  - Shared scan service correctly assigns student/mentor IDs
  - Same-role and self-scan rejection

- **Integration tests:**
  - Mentor `POST /api/scan` with valid student QR
  - Mentor `POST /api/scan` with same-role QR (rejected)
  - Student `POST /api/scan` still works with mentor QR
  - Student `/api/me` returns QR payload and SVG

- **DOM tests:**
  - Toggle renders on both pages
  - Mode switching updates visible content
  - Default modes are correct

- **E2E tests:**
  - Mentor scans student end-to-end
  - Student scans mentor end-to-end (existing, preserved)

## Files Changed

### Frontend
- `public/student/index.html` - Add toggle, QR display section
- `public/student/app.js` - Add QR display logic, toggle handling
- `public/student/styles.css` - Add toggle styles, QR display styles
- `public/mentor/index.html` - Add toggle, scanner section
- `public/mentor/app.js` - Add scanner logic, toggle handling
- `public/mentor/styles.css` - Add toggle styles, scanner styles

### Backend
- `src/worker/services/mentor-qr.ts` - Generalize to parse both roles (rename to `qr-payload.ts`)
- `src/worker/services/scan-submission.ts` - New shared scan service
- `src/worker/routes/student.ts` - Add QR to `/api/me`, use shared scan service
- `src/worker/routes/mentor.ts` - Add `POST /api/scan` endpoint

### Tests
- `test/unit/mentor-qr.test.ts` - Update for generalized parser
- `test/integration/student-api.test.ts` - Update for QR in `/api/me`
- `test/integration/mentor-api.test.ts` - Add scan endpoint tests
- New DOM tests for toggle on both pages

## Open Questions

None - requirements are clear.
