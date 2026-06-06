---
date: 2026-06-06
topic: "QR Scan Feature for Mentor-Student Attendance"
status: validated
---

# QR Scan Feature Design

## Problem Statement

Implement a complete QR code scanning system that allows:
- **Students** to scan mentor QR codes using their device camera
- **Mentors** to display a persistent QR code for students to scan
- **The system** to validate scanned QR payloads and record mentor-student interactions

This feature is the core interaction mechanism for the attendance tracking system.

## Constraints

- **QR Format:** `absenqr:v1:mentor:<mentorId>` for mentors, `absenqr:v1:student:<studentId>` for students
- **Duplicate Prevention:** Same student→mentor pair on the same UTC calendar day rejected with 409
- **Server-Side QR Generation:** SVG generated on the server using `qrcode-svg` library
- **Scanner Library:** `qr-scanner` library for browser-based QR detection
- **No Build Step:** Frontend is vanilla HTML/CSS/JS
- **Mobile-First:** Student page optimized for mobile camera scanning
- **Single Event Day:** All scan records tied to one UTC calendar day

## Approach

**Chosen approach: Server-generated QR with client-side scanning**

- QR codes generated server-side as SVG for consistency and reliability
- Student browser uses `qr-scanner` library for real-time camera-based QR detection
- Student page has dual mode: scan mentor QR or show own QR
- Mentor page displays their QR code prominently with auto-refresh polling
- Scan validation happens server-side with D1 database constraints

**Rejected alternatives:**
- **Client-side QR generation:** Would require additional JS library, less consistent rendering
- **Native app:** Out of scope for v1 web-only requirement
- **Third-party QR API:** Adds external dependency and latency

## Architecture

### QR Payload Format
```
absenqr:v1:mentor:<person_id>
absenqr:v1:student:<person_id>
```

### QR Generation Flow
1. Mentor/student opens their secret link
2. Server generates QR payload string from their person_id
3. Server renders SVG using `qrcode-svg` library
4. SVG embedded in HTML response or returned via API

### Scan Flow
1. Student opens scanner mode on their page
2. Camera activates via `qr-scanner` library
3. QR code detected → payload extracted
4. Payload sent to `POST /api/scan` with `{ qrPayload }`
5. Server validates payload format and mentor existence
6. Server checks for duplicate scan (student+mentor+day)
7. If valid: creates scan record, returns 201 with mentor info
8. If duplicate: returns 409 with error message
9. Student UI shows success/error feedback
10. History refreshes to show new scan

## Components

### Backend Services

**`services/qr-payload.ts`**
- `parseQrPayload(payload): { role, personId } | null`
- Validates format using regex: `/^absenqr:v1:(mentor|student):(.+)$$/`
- Returns parsed components or null for invalid payloads

**`services/qr-svg.ts`**
- `renderQrSvg(payload): string`
- Uses `qrcode-svg` library to generate SVG string
- Consistent 256x256 rendering with high error correction

**`services/scan-submission.ts`**
- `submitScan(db, studentId, qrPayload, eventDate): ScanResult`
- Validates QR payload, checks mentor exists, prevents duplicates
- Creates scan record with `entry_method: 'qr'`
- Returns scan details or appropriate error

### API Routes

**Student Routes (`routes/student.ts`)**
- `GET /api/me` - Returns student identity + `qrPayload` + `qrSvg`
- `POST /api/scan` - Accepts `{ qrPayload }`, creates scan record
- `GET /api/history` - Returns student's scans for current day

**Mentor Routes (`routes/mentor.ts`)**
- `GET /api/me` - Returns mentor identity + `qrPayload` + `qrSvg`
- `GET /api/recent-scans` - Returns recent scans for polling

### Frontend

**Student Page (`public/student/`)**
- Mode toggle: "Scan QR" / "Show QR"
- Scanner view: Camera preview, start/stop button, feedback panel
- QR view: Display student's own QR code with copy button
- Fallback code entry for camera failures

**Mentor Page (`public/mentor/`)**
- Prominent QR code display (server-generated SVG)
- Copy-to-clipboard button for QR payload
- Recent scans list with auto-polling (10s interval)
- Notes entry for each scan

## Data Flow

```
Mentor opens page → GET /api/me → receives qrPayload + qrSvg → displays QR

Student opens scanner → camera starts → detects QR
  → POST /api/scan { qrPayload: "absenqr:v1:mentor:mentor123" }
  → Server validates payload → checks for duplicate
  → Creates scan record → returns { scan, mentor }
  → UI shows success → history refreshes
```

## Error Handling Strategy

| Scenario | Response | UI Behavior |
|----------|----------|-------------|
| Invalid QR format | 400 "Invalid mentor QR payload." | Shows error feedback |
| Duplicate scan | 409 "Duplicate mentor scan already recorded for this calendar day." | Shows duplicate warning |
| Mentor not found | 400 "Invalid mentor QR payload." | Shows error feedback |
| Camera permission denied | Client-side error | Shows retry button with instructions |
| No camera available | Client-side error | Shows fallback code option |
| Server error | 500 | Shows generic error with retry |

## Testing Strategy

### Unit Tests
- **`test/unit/qr-payload.test.ts`** - Tests parseQrPayload with valid/invalid inputs
- **`test/unit/scan-submission.test.ts`** - Tests scan validation, duplicate detection, record creation

### Integration Tests
- **`test/integration/student-api.test.ts`** - Tests /api/scan endpoint with various scenarios
- **`test/integration/mentor-api.test.ts`** - Tests /api/me returns QR data
- **`test/integration/student-page-dom.test.ts`** - Tests HTML structure and element IDs
- **`test/integration/student-page-app.test.ts`** - Tests scanner state machine and button behavior

### Test Coverage
- Valid QR payload scan → 201 success
- Duplicate scan detection → 409 conflict
- Invalid QR payload → 400 bad request
- UTC midnight boundary → allows scan on new day
- Camera permission handling → retry button visibility
- Mode toggle (scan/show QR) → view switching

## Open Questions

None. All requirements implemented and tested.

## Implementation Notes

- QR scanner library: `qr-scanner` loaded from `/vendor/qr-scanner/`
- Server-side QR: `qrcode-svg` npm package
- Polling interval: 10 seconds for recent scans
- SVG size: 256x256 pixels
- Copy feedback: 1.5 second timeout
