# Bidirectional QR Scanning Implementation Plan

**Date:** 2026-06-06
**Topic:** Bidirectional QR Scanning
**Status:** draft

## Design Reference
- Design document: `thoughts/shared/designs/2026-06-06-bidirectional-qr-scanning-design.md`
- PRD: `docs/prd/mentor-student-qr-attendance-v1.md`
- Original implementation plan: `docs/implementation/mentor-student-qr-attendance-v1-plan.md`

## Problem Statement
Currently, only students can initiate attendance scans by scanning mentor QR codes. Mentors cannot scan student QR codes to record attendance. This limits flexibility in scenarios where mentors need to verify student attendance (e.g., mentor approaches students at a gathering rather than students queuing up to scan a mentor's static QR code).

## Constraints
- **No build step**: Frontend is vanilla HTML/CSS/JS served directly from `public/`.
- **Mobile-first**: Student page layout must work well on mobile devices.
- **Backward compatibility**: Existing mentor QR codes (`absenqr:v1:mentor:<id>`) must remain valid. Existing student page behavior must be preserved when in Scan mode.
- **v1 locked constraints**: Single UTC calendar-day attendance, one secret link per person, duplicate scans rejected, admin last-write-wins corrections.
- **Schema stability**: The `scan_records` table schema (`scan_id, student_id, mentor_id, event_date, scanned_at, entry_method, notes, updated_at`) is fixed. `student_id` always stores the student's `person_id`, `mentor_id` always stores the mentor's `person_id`.
- **Test coverage**: All existing tests must continue to pass; new tests must be added for bidirectional flows.

## Approach
We will implement bidirectional scanning by:

1. **Generalizing the QR payload parser** to handle both `student` and `mentor` roles.
2. **Extracting shared scan creation logic** into a backend service that handles both student-initiated and mentor-initiated scans, determining `student_id`/`mentor_id` placement based on parsed roles.
3. **Adding mode toggles** to both pages: student page defaults to Scan mode (existing behavior) with a new Show QR mode; mentor page defaults to Show QR mode (existing behavior) with a new Scan mode.
4. **Replicating the scanner UI** from the student page onto the mentor page, and the QR display UI from the mentor page onto the student page.
5. **Adding a new `POST /mentor/:token/api/scan` endpoint** that uses the shared scan service.
6. **Updating tests** to cover the new bidirectional flows, same-role rejection, self-scan rejection, and DOM contract changes.

## Architecture Overview

The system introduces bidirectional scanning while preserving the existing page structure and schema.

**Key insight:** Both roles now have dual capability (show QR + scan QR), but the UI is still split across two role-specific pages. The backend scan creation is unified through a shared service that maps roles to the fixed schema columns.

```
┌─────────────────┐     ┌─────────────────┐
│  Student Page   │     │   Mentor Page   │
│                 │     │                 │
│ [Scan QR mode]  │     │ [Show QR mode]  │
│  - Camera       │     │  - QR display   │
│  - Scan mentor  │     │  - Copy payload │
│                 │     │                 │
│ [Show QR mode]  │     │ [Scan QR mode]  │
│  - QR display   │     │  - Camera       │
│  - Copy payload │     │  - Scan student │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │  Shared Backend Logic │
         │                       │
         │  1. Parse QR payload  │
         │  2. Determine roles   │
         │  3. Map to schema     │
         │  4. Create scan       │
         └───────────────────────┘
```

## Components

### 1. QR Payload Parser (`src/worker/services/qr-payload.ts`)
**Current state:** `src/worker/services/mentor-qr.ts` only parses `absenqr:v1:mentor:<id>`.

**Change:** Rename to `qr-payload.ts` and generalize to parse:
- `absenqr:v1:student:<person_id>`
- `absenqr:v1:mentor:<person_id>`

**New return type:**
```typescript
type ParsedQrPayload = {
  role: "student" | "mentor";
  personId: string;
};
```

**Function signature:**
```typescript
export function parseQrPayload(qrPayload: string): ParsedQrPayload | null
```

### 2. Shared Scan Service (`src/worker/services/scan-submission.ts`)
**New file.** Extracts scan creation logic that is currently duplicated (or will be duplicated) between student and mentor routes.

**Responsibilities:**
- Parse QR payload using `parseQrPayload()`
- Look up scanned person using `findPersonById()`
- Validate scanned person exists
- Reject same-role scans (student scanning student, mentor scanning mentor)
- Reject self-scans
- Determine `studentId` and `mentorId` for the `scan_records` row
- Check for existing scan on the same UTC day using `findStudentMentorScanRecordByEventDate()`
- Create scan record using `createScanRecord()`
- Handle duplicate scan errors using `isDuplicateScanRecordError()`

**Function signature:**
```typescript
export type ScanSubmissionResult = {
  scan: {
    scanId: string;
    studentId: string;
    mentorId: string;
    eventDate: string;
    scannedAt: string;
  };
  scannedPerson: {
    personId: string;
    displayName: string;
  };
};

export async function submitScan(
  db: D1Database,
  scannerPerson: { person_id: string; display_name: string; role: "student" | "mentor" },
  qrPayload: string
): Promise<{ success: true; result: ScanSubmissionResult } | { success: false; response: Response }>
```

**Error responses:**
- Invalid QR payload: `400 "Invalid QR payload."`
- Scanned person not found: `400 "Invalid QR payload."`
- Same-role scan: `400 "You can only scan the opposite role."`
- Self-scan: `400 "You cannot scan yourself."`
- Duplicate scan today: `409 "Already scanned today."`
- Database error: `500 "Could not create scan record."`

### 3. Student Route (`src/worker/routes/student.ts`)
**Changes:**
1. **Update `GET /api/me`**: Add `qrPayload` and `qrSvg` to the response.
   - `qrPayload`: `absenqr:v1:student:${student.person_id}`
   - `qrSvg`: SVG rendered by `renderMentorQrSvg()` (function name stays as-is; it renders any payload)
   - Response format: keep existing `student` wrapper for backward compatibility, add `qrPayload` and `qrSvg` at top level
   ```json
   {
     "student": {
       "personId": "...",
       "displayName": "...",
       "secretId": "..."
     },
     "qrPayload": "absenqr:v1:student:...",
     "qrSvg": "<svg>...</svg>"
   }
   ```

2. **Update `POST /api/scan`**: Replace inline scan creation logic with call to `submitScan()`.
   - The scanner is a student; `scannerPerson.role = "student"`
   - `submitScan()` handles parsing, validation, duplicate checking, and creation
   - On success, return `{ ok: true, scan: result.scan, scannedPerson: result.scannedPerson }`
   - On failure, return the error response from `submitScan()`
   - Preserve existing fallback code path: if `fallbackCode` is provided in body, use existing fallback logic instead of QR scanning

### 4. Mentor Route (`src/worker/routes/mentor.ts`)
**Changes:**
1. **Add `POST /api/scan`**: New endpoint for mentor-initiated scans.
   - Request body: `{ qrPayload: string }`
   - Authenticate mentor via token (reuse existing `requireMentor()` middleware)
   - Call `submitScan()` with `scannerPerson.role = "mentor"`
   - On success, return `{ ok: true, scan: result.scan, scannedPerson: result.scannedPerson }`
   - On failure, return the error response from `submitScan()`
   - No fallback code path on mentor scan (not in design scope)

### 5. Student Frontend (`public/student/`)

#### `index.html` changes:
- Add mode toggle element above the scanner card:
  ```html
  <div class="mode-toggle" id="mode-toggle">
    <button type="button" class="mode-button mode-button-active" id="mode-scan" data-mode="scan">Scan QR</button>
    <button type="button" class="mode-button" id="mode-show" data-mode="show">Show QR</button>
  </div>
  ```
- Add QR display card after the scanner card (same position, toggled visibility):
  ```html
  <div class="card" id="qr-card" style="display: none;">
    <h2>Your QR Code</h2>
    <div class="qr-display" id="qr-display">
      <!-- SVG injected here -->
    </div>
    <div class="qr-payload-row">
      <code class="qr-payload" id="qr-payload"></code>
      <button type="button" class="qr-copy" id="qr-copy" title="Copy QR payload">Copy</button>
    </div>
    <p class="qr-hint">Show this QR code to a mentor to record your attendance.</p>
  </div>
  ```
- Keep existing scanner card (`#scanner-card`) with `id` added if not present

#### `app.js` changes:
- Add `normalizeQrData()` or extend existing data normalization to extract `qrPayload` and `qrSvg` from `/api/me` response
- Add mode state variable: `let currentMode = "scan";`
- Add mode toggle event listeners:
  ```javascript
  document.getElementById("mode-toggle").addEventListener("click", (e) => {
    if (!e.target.classList.contains("mode-button")) return;
    const mode = e.target.dataset.mode;
    setMode(mode);
  });
  ```
- Add `setMode(mode)` function:
  - Update `currentMode`
  - Toggle `mode-button-active` class on buttons
  - Show/hide `#scanner-card` and `#qr-card`
  - When switching to "show", render QR display
  - When switching to "scan", ensure scanner is active
- Add QR display rendering:
  ```javascript
  function renderQrDisplay(qrSvg, qrPayload) {
    const display = document.getElementById("qr-display");
    const payloadEl = document.getElementById("qr-payload");
    display.innerHTML = qrSvg;
    payloadEl.textContent = qrPayload;
  }
  ```
- Add copy button handler:
  ```javascript
  document.getElementById("qr-copy").addEventListener("click", async () => {
    const payload = document.getElementById("qr-payload").textContent;
    await navigator.clipboard.writeText(payload);
    const btn = document.getElementById("qr-copy");
    const original = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => btn.textContent = original, 2000);
  });
  ```
- Update `loadIdentity()` to store `qrPayload` and `qrSvg` globally for QR display mode

#### `styles.css` changes:
- Add mode toggle styles (pill-shaped segmented control):
  ```css
  .mode-toggle {
    display: flex;
    gap: 0;
    margin-bottom: 1rem;
    background: #f0f0f0;
    border-radius: 8px;
    padding: 4px;
  }
  .mode-button {
    flex: 1;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: #666;
    transition: all 0.2s;
  }
  .mode-button-active {
    background: #fff;
    color: #333;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  ```
- Add QR display card styles (reuse/adapt from mentor page):
  ```css
  #qr-card .qr-display {
    text-align: center;
    padding: 1.5rem;
    background: #fff;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  #qr-card .qr-display svg {
    max-width: 200px;
    width: 100%;
    height: auto;
  }
  #qr-card .qr-payload-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  #qr-card .qr-payload {
    flex: 1;
    font-size: 0.8rem;
    word-break: break-all;
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 4px;
  }
  #qr-card .qr-copy {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }
  #qr-card .qr-hint {
    font-size: 0.85rem;
    color: #666;
    text-align: center;
    margin: 0;
  }
  ```

### 6. Mentor Frontend (`public/mentor/`)

#### `index.html` changes:
- Add mode toggle element above the QR card:
  ```html
  <div class="mode-toggle" id="mode-toggle">
    <button type="button" class="mode-button" id="mode-scan" data-mode="scan">Scan QR</button>
    <button type="button" class="mode-button mode-button-active" id="mode-show" data-mode="show">Show QR</button>
  </div>
  ```
- Add scanner card after the QR card (same position, toggled visibility):
  ```html
  <div class="card" id="scanner-card" style="display: none;">
    <h2>Scan Student QR</h2>
    <div id="scanner-stage" class="scanner-stage">
      <video id="scanner-video" class="scanner-video" playsinline></video>
      <div id="scanner-overlay" class="scanner-overlay">
        <div class="scanner-frame"></div>
        <p class="scanner-hint">Point camera at a student's QR code</p>
      </div>
    </div>
    <button type="button" id="scanner-toggle-button" class="scanner-toggle-button">Start Camera</button>
    <div id="scan-success" class="scan-feedback scan-success" style="display: none;">
      <p>Attendance recorded for <span id="scan-success-name"></span></p>
    </div>
    <div id="scan-error" class="scan-feedback scan-error" style="display: none;">
      <p id="scan-error-message"></p>
    </div>
  </div>
  ```
- Include qr-scanner library in `<head>`:
  ```html
  <script type="module" src="/vendor/qr-scanner/qr-scanner.min.js"></script>
  ```

#### `app.js` changes:
- Add mode state variable: `let currentMode = "show";`
- Add mode toggle event listeners (same pattern as student page)
- Add `setMode(mode)` function:
  - Update `currentMode`
  - Toggle `mode-button-active` class on buttons
  - Show/hide `#qr-card` and `#scanner-card`
  - When switching to "scan", initialize/start scanner
  - When switching to "show", stop scanner
- Add scanner logic (replicate from student page with adjustments):
  ```javascript
  let qrScanner = null;
  let isScanning = false;

  async function initScanner() {
    if (qrScanner) return;
    const video = document.getElementById("scanner-video");
    qrScanner = new QrScanner(video, handleQrDecode, {
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
  }

  async function startScanner() {
    await initScanner();
    await qrScanner.start();
    isScanning = true;
    document.getElementById("scanner-toggle-button").textContent = "Stop Camera";
  }

  async function stopScanner() {
    if (!qrScanner || !isScanning) return;
    await qrScanner.stop();
    isScanning = false;
    document.getElementById("scanner-toggle-button").textContent = "Start Camera";
  }

  document.getElementById("scanner-toggle-button").addEventListener("click", () => {
    if (isScanning) {
      stopScanner();
    } else {
      startScanner();
    }
  });

  async function handleQrDecode(result) {
    const qrPayload = result.data;
    await stopScanner();
    try {
      const response = await fetch(`${API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrPayload }),
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        showScanSuccess(data.scannedPerson.displayName);
        await loadRecentScans(); // Refresh recent scans list
      } else {
        showScanError(data.error || "Scan failed");
      }
    } catch (err) {
      showScanError("Network error. Please try again.");
    }
  }

  function showScanSuccess(name) {
    const el = document.getElementById("scan-success");
    document.getElementById("scan-success-name").textContent = name;
    el.style.display = "block";
    document.getElementById("scan-error").style.display = "none";
    setTimeout(() => { el.style.display = "none"; }, 3000);
  }

  function showScanError(message) {
    const el = document.getElementById("scan-error");
    document.getElementById("scan-error-message").textContent = message;
    el.style.display = "block";
    document.getElementById("scan-success").style.display = "none";
    setTimeout(() => { el.style.display = "none"; }, 5000);
  }
  ```
- Add camera permission error handling (replicate from student page)

#### `styles.css` changes:
- Add mode toggle styles (same as student page)
- Add scanner card styles (reuse/adapt from student page):
  ```css
  #scanner-card .scanner-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 1rem;
  }
  #scanner-card .scanner-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  #scanner-card .scanner-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  #scanner-card .scanner-frame {
    width: 60%;
    aspect-ratio: 1;
    border: 2px solid rgba(255,255,255,0.5);
    border-radius: 12px;
  }
  #scanner-card .scanner-hint {
    color: rgba(255,255,255,0.8);
    font-size: 0.85rem;
    margin-top: 1rem;
    text-align: center;
    padding: 0 1rem;
  }
  #scanner-card .scanner-toggle-button {
    width: 100%;
    padding: 0.75rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  #scanner-card .scan-feedback {
    padding: 0.75rem;
    border-radius: 8px;
    text-align: center;
    font-size: 0.9rem;
  }
  #scanner-card .scan-success {
    background: #e8f5e9;
    color: #2e7d32;
  }
  #scanner-card .scan-error {
    background: #ffebee;
    color: #c62828;
  }
  ```

## Data Flow

### Student scans Mentor (existing flow, refactored)
1. Student loads `/student/:token` → `GET /api/me` returns identity + `qrPayload`/`qrSvg`
2. Student switches to "Show QR" mode (optional) → QR display rendered
3. Student in "Scan QR" mode → camera active
4. Student scans mentor QR → `POST /student/:token/api/scan` with `{ qrPayload }`
5. Backend: `submitScan()` parses payload → validates mentor exists → checks for duplicate → creates `scan_records` row
6. Frontend shows success/error feedback, history list refreshes

### Mentor scans Student (new flow)
1. Mentor loads `/mentor/:token` → `GET /api/me` returns identity + `qrPayload`/`qrSvg`
2. Mentor in "Show QR" mode (default) → QR display rendered
3. Mentor switches to "Scan QR" mode → scanner initialized
4. Mentor starts camera → scans student QR
5. `handleQrDecode()` sends `POST /mentor/:token/api/scan` with `{ qrPayload }`
6. Backend: `submitScan()` parses payload → validates student exists → checks for duplicate → creates `scan_records` row
7. Frontend shows success/error feedback, recent scans list refreshes

### Rejection flows
- **Same-role scan**: Student scans student QR → `submitScan()` detects `scannerPerson.role === scannedPerson.role` → returns 400
- **Self-scan**: Student scans own QR → `submitScan()` detects `scannerPerson.person_id === scannedPerson.person_id` → returns 400
- **Duplicate scan**: Same student-mentor pair already scanned today → `submitScan()` finds existing record → returns 409
- **Invalid QR**: Malformed payload or nonexistent person → returns 400

## Error Handling Strategy

### Backend
- **Invalid QR payload**: 400 Bad Request with `"Invalid QR payload."`
- **Person not found**: 400 Bad Request with `"Invalid QR payload."` (intentionally vague to avoid leaking existence)
- **Same-role scan**: 400 Bad Request with `"You can only scan the opposite role."`
- **Self-scan**: 400 Bad Request with `"You cannot scan yourself."`
- **Duplicate scan**: 409 Conflict with `"Already scanned today."`
- **Database errors**: 500 Internal Server Error with `"Could not create scan record."`

### Frontend
- **Camera permission denied**: Show inline error message in scanner card, offer retry
- **Network errors**: Show generic "Network error. Please try again." in scan error panel
- **Scan API errors**: Display backend error message in scan error panel (auto-dismiss after 5s)
- **Copy failure**: Gracefully handle `navigator.clipboard` failures (fallback to selection + execCommand or silent fail)

## Testing Strategy

### Unit Tests

#### `test/unit/mentor-qr.test.ts` → `test/unit/qr-payload.test.ts`
- Rename file and update import
- Add tests for student QR parsing:
  - `absenqr:v1:student:abc-123` → `{ role: "student", personId: "abc-123" }`
  - `absenqr:v1:student:` → `null`
- Keep existing mentor QR tests:
  - `absenqr:v1:mentor:abc-123` → `{ role: "mentor", personId: "abc-123" }`
- Add tests for invalid role:
  - `absenqr:v1:admin:abc-123` → `null`
- Add tests for malformed payloads:
  - Missing prefix: `student:abc-123` → `null`
  - Wrong version: `absenqr:v2:student:abc-123` → `null`
  - Extra segments: `absenqr:v1:student:abc-123:extra` → `null`

### Integration Tests - API

#### `test/integration/student-api.test.ts`
- Update `GET /api/me` test to assert presence of `qrPayload` and `qrSvg` in response
- Update `POST /api/scan` tests to use generalized payload (still scanning mentor QR; behavior should be identical)
- Add test: Student scans student QR → expects 400 with `"You can only scan the opposite role."`
- Add test: Student scans own QR → expects 400 with `"You cannot scan yourself."`
- Add test: Student scans valid mentor QR → success (existing test, verify still passes)

#### `test/integration/mentor-api.test.ts`
- Add test: `POST /api/scan` with valid student QR → expects 200 with `ok: true`, `scan`, `scannedPerson`
- Add test: Mentor scans mentor QR → expects 400 with `"You can only scan the opposite role."`
- Add test: Mentor scans own QR → expects 400 with `"You cannot scan yourself."`
- Add test: Mentor scans nonexistent student QR → expects 400 with `"Invalid QR payload."`
- Add test: Duplicate scan (same mentor-student pair, same day) → expects 409 with `"Already scanned today."`
- Add test: Unauthenticated request → expects 401

### Integration Tests - DOM

#### `test/integration/student-page-dom.test.ts`
- Add test: Mode toggle exists with two buttons ("Scan QR", "Show QR")
- Add test: Default mode shows scanner card, hides QR card
- Add test: Clicking "Show QR" shows QR card, hides scanner card
- Add test: QR display section contains SVG placeholder when identity loaded
- Add test: Copy button exists in QR display section
- Add test: Existing tests (history list, fallback form, etc.) still pass with toggle present

#### `test/integration/mentor-page-dom.test.ts`
- Add test: Mode toggle exists with two buttons ("Scan QR", "Show QR")
- Add test: Default mode shows QR card, hides scanner card
- Add test: Clicking "Scan QR" shows scanner card, hides QR card
- Add test: Scanner video element exists in scanner card
- Add test: Scanner toggle button exists ("Start Camera")
- Add test: Existing tests (QR display, fallback codes, recent scans) still pass with toggle present

## Task Order & Dependencies

### Batch 1: Backend Foundation (no dependencies)
- **Task 1.1**: Rename `src/worker/services/mentor-qr.ts` → `src/worker/services/qr-payload.ts`, generalize parser
- **Task 1.2**: Create `src/worker/services/scan-submission.ts` with `submitScan()`
- **Task 1.3**: Update `test/unit/mentor-qr.test.ts` → `test/unit/qr-payload.test.ts`

### Batch 2: Backend Routes (depends on Batch 1)
- **Task 2.1**: Update `src/worker/routes/student.ts` - add QR to `/api/me`, refactor `/api/scan` to use `submitScan()`
- **Task 2.2**: Update `src/worker/routes/mentor.ts` - add `POST /api/scan`
- **Task 2.3**: Update `test/integration/student-api.test.ts`
- **Task 2.4**: Update `test/integration/mentor-api.test.ts`

### Batch 3: Frontend Structure (depends on none, but coordinates with Batch 4)
- **Task 3.1**: Update `public/student/index.html` - add mode toggle, QR card
- **Task 3.2**: Update `public/mentor/index.html` - add mode toggle, scanner card, qr-scanner script

### Batch 4: Frontend Styling (depends on Batch 3)
- **Task 4.1**: Update `public/student/styles.css` - mode toggle, QR card styles
- **Task 4.2**: Update `public/mentor/styles.css` - mode toggle, scanner card styles

### Batch 5: Frontend Logic (depends on Batch 3 and 4)
- **Task 5.1**: Update `public/student/app.js` - mode toggle, QR display, copy handler
- **Task 5.2**: Update `public/mentor/app.js` - mode toggle, scanner initialization, scan handler

### Batch 6: DOM Tests (depends on Batch 3, 4, 5)
- **Task 6.1**: Update `test/integration/student-page-dom.test.ts`
- **Task 6.2**: Update `test/integration/mentor-page-dom.test.ts`

### Batch 7: Validation
- **Task 7.1**: Run all tests (`npm test`) and fix failures
- **Task 7.2**: Manual browser testing of both flows
- **Task 7.3**: Verify backward compatibility (existing mentor QR codes still work)

## Risks & Gotchas

1. **Schema interpretation**: The `scan_records` table has `student_id` and `mentor_id` as fixed role columns. The shared service must always place the student in `student_id` and mentor in `mentor_id`, regardless of who initiated the scan. This is handled by `submitScan()` determining IDs based on parsed roles.

2. **Duplicate check directionality**: `findStudentMentorScanRecordByEventDate()` takes `(studentId, mentorId, eventDate)`. Since the schema columns are role-based, the lookup is always by actual student and mentor IDs, so direction doesn't matter. The existing function works as-is for both student-initiated and mentor-initiated scans.

3. **QR SVG function naming**: `renderMentorQrSvg()` in `src/worker/services/mentor-qr-svg.ts` is named for mentors but actually renders any payload string. Do not rename it to avoid unnecessary import changes; just use it for student QR SVG generation too.

4. **Student page scanner stop/start**: When switching from "Scan" to "Show" mode on the student page, the scanner must be stopped to release camera resources. Ensure `setMode()` calls `stopScanner()` when leaving scan mode.

5. **Mentor page scanner initialization**: The qr-scanner library requires a `<video>` element and the `playsinline` attribute. Ensure the mentor page video element has these. Also ensure the library script is loaded before `app.js` runs.

6. **Fallback codes on student page**: The existing fallback code form (`#fallback-form`) should remain visible only in "Scan QR" mode. It is part of the scanner card flow.

7. **Copy button graceful degradation**: `navigator.clipboard` may fail or be unavailable. Implement a try/catch and optionally fall back to selecting text + `document.execCommand('copy')`.

8. **Existing student scan endpoint contract**: The current `POST /student/:token/api/scan` returns `{ ok: true, scan: { ... } }` on success. The shared service returns a richer structure. Ensure the route still returns the same contract (or add `scannedPerson` to the response without breaking the frontend, which may ignore extra fields).

9. **Test database seeding**: Integration tests for mentor scan will need a student person seeded in the test database. Verify test setup creates both students and mentors.

## Open Questions
- Should mentors have a fallback code input in their scanner view? (Design doc says no; scope is QR-only for mentor-initiated scans.)
- Should students be able to generate fallback codes? (Design doc says no; fallback codes remain mentor-generated only.)
- Should the mode preference be persisted (e.g., in `localStorage`)? (Design doc says no; default mode is fixed per page. Can be added later if requested.)

## Effort Estimate
- Backend changes: 2-3 hours
- Frontend student page: 2-3 hours
- Frontend mentor page: 3-4 hours (scanner logic replication)
- Tests: 2-3 hours
- Validation & bug fixes: 2 hours
- **Total: ~11-15 hours**
