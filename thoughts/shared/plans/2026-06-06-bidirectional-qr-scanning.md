# Bidirectional QR Scanning — Implementation Plan

**Date:** 2026-06-06  
**Topic:** Bidirectional QR Scanning with Role-Preserved Toggle  
**Status:** Draft  
**Design Reference:** [2026-06-06-bidirectional-qr-scanning-design.md](../designs/2026-06-06-bidirectional-qr-scanning-design.md)

---

## 1. Overview

This plan implements bidirectional QR scanning so both students and mentors can scan each other and display their own QR codes. The work is organized into 5 phases with clear dependencies and parallelization opportunities.

### Execution Order

| Phase | Files | Dependencies | Parallelizable |
|-------|-------|--------------|----------------|
| 1. Backend services | 3 files | None | — |
| 2. Backend routes | 2 files | Phase 1 | — |
| 3. Frontend HTML/CSS | 4 files | None | With Phase 1-2 |
| 4. Frontend JS | 2 files | Phase 3 | — |
| 5. Tests | 5+ files | Phase 2, 4 | — |

---

## 2. Phase 1: Backend Services (Foundation)

### 2.1 Generalize QR Parser

**File:** `src/worker/services/mentor-qr.ts` → `src/worker/services/qr-payload.ts`

**Changes:**
- Rename file from `mentor-qr.ts` to `qr-payload.ts`
- Rename function from `parseMentorQrPayload` to `parseQrPayload`
- Change return type from `{ mentorId: string } | null` to `{ role: 'student' \| 'mentor'; personId: string } | null`
- Support both prefixes: `absenqr:v1:mentor:` and `absenqr:v1:student:`
- Keep the same `PERSON_ID_PATTERN` validation

**Before:**
```typescript
const MENTOR_QR_PREFIX = "absenqr:v1:mentor:";
const PERSON_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseMentorQrPayload(qrPayload: string): { mentorId: string } | null {
  if (!qrPayload.startsWith(MENTOR_QR_PREFIX)) {
    return null;
  }
  const mentorId = qrPayload.slice(MENTOR_QR_PREFIX.length);
  if (!PERSON_ID_PATTERN.test(mentorId)) {
    return null;
  }
  return { mentorId };
}
```

**After:**
```typescript
const STUDENT_QR_PREFIX = "absenqr:v1:student:";
const MENTOR_QR_PREFIX = "absenqr:v1:mentor:";
const PERSON_ID_PATTERN = /^[a-z0-9-]+$/;

export function parseQrPayload(qrPayload: string): { role: 'student' | 'mentor'; personId: string } | null {
  let role: 'student' | 'mentor';
  let prefix: string;

  if (qrPayload.startsWith(STUDENT_QR_PREFIX)) {
    role = 'student';
    prefix = STUDENT_QR_PREFIX;
  } else if (qrPayload.startsWith(MENTOR_QR_PREFIX)) {
    role = 'mentor';
    prefix = MENTOR_QR_PREFIX;
  } else {
    return null;
  }

  const personId = qrPayload.slice(prefix.length);

  if (!PERSON_ID_PATTERN.test(personId)) {
    return null;
  }

  return { role, personId };
}
```

**Import updates required in:**
- `src/worker/routes/student.ts`: Change `parseMentorQrPayload` to `parseQrPayload`
- `test/unit/mentor-qr.test.ts`: Update import path and function name

### 2.2 Rename QR SVG Service

**File:** `src/worker/services/mentor-qr-svg.ts` → `src/worker/services/qr-svg.ts`

**Changes:**
- Rename file
- Rename export from `renderMentorQrSvg` to `renderQrSvg`
- No logic changes (already payload-agnostic)

**Import updates required in:**
- `src/worker/routes/mentor.ts`: Change `renderMentorQrSvg` to `renderQrSvg`

### 2.3 Create Shared Scan Service

**File:** `src/worker/services/scan-submission.ts` (new)

**Purpose:** Extract scan creation logic from `student.ts` so both student and mentor routes can use it.

**Interface:**
```typescript
interface ScanSubmissionResult {
  scan: ScanRecord;
  scannedPerson: {
    personId: string;
    displayName: string;
  };
}

interface ScanSubmissionError {
  code: 'INVALID_QR' | 'SAME_ROLE' | 'SELF_SCAN' | 'DUPLICATE_SCAN' | 'NOT_FOUND' | 'INTERNAL_ERROR';
  message: string;
  status: number;
}

export async function submitScan(
  db: D1Database,
  scannerPerson: { person_id: string; role: string; display_name: string },
  qrPayload: string
): Promise<ScanSubmissionResult> {
  // 1. Parse QR payload
  // 2. Look up scanned person by ID + role
  // 3. Validate scanned person exists
  // 4. Reject same-role scan
  // 5. Reject self-scan
  // 6. Determine studentId and mentorId
  // 7. Check for existing scan on same day
  // 8. Create scan record
  // 9. Return { scan, scannedPerson }
}
```

**Implementation details:**
- Use `parseQrPayload` from `qr-payload.ts`
- Use `findPersonById` from `db/people`
- Use `findStudentMentorScanRecordByEventDate` and `createScanRecord` from `db/scan-records`
- Use `getUtcDayKey` from `services/event-day`
- Use `crypto.randomUUID()` for scan ID
- Throw typed errors with `code` field for route-level handling

**Same-role rejection logic:**
```typescript
if (scannedPerson.role === scannerPerson.role) {
  throw createScanError('SAME_ROLE', 'You can only scan the opposite role.', 400);
}
```

**Self-scan rejection logic:**
```typescript
if (scannedPerson.person_id === scannerPerson.person_id) {
  throw createScanError('SELF_SCAN', 'You cannot scan yourself.', 400);
}
```

**Student/mentor ID assignment:**
```typescript
const studentId = scannerPerson.role === 'student' ? scannerPerson.person_id : scannedPerson.person_id;
const mentorId = scannerPerson.role === 'mentor' ? scannerPerson.person_id : scannedPerson.person_id;
```

---

## 3. Phase 2: Backend Routes (API Contracts)

### 3.1 Update Student Route

**File:** `src/worker/routes/student.ts`

#### 3.1.1 Update `/api/me` Response

**Before:**
```typescript
return json({
  student: {
    personId: student.person_id,
    displayName: student.display_name,
    secretId: student.secret_id
  }
});
```

**After:**
```typescript
const qrPayload = `absenqr:v1:student:${student.person_id}`;

return json({
  student: {
    personId: student.person_id,
    displayName: student.display_name,
    secretId: student.secret_id
  },
  qrPayload,
  qrSvg: renderQrSvg(qrPayload)
});
```

**Imports to add:**
```typescript
import { renderQrSvg } from "../services/qr-svg";
```

#### 3.1.2 Update `/api/scan` to Use Shared Service

**Before:** The route contains inline logic for:
- Parsing mentor QR payload
- Looking up mentor
- Checking duplicate scan
- Creating scan record
- Returning `{ scan, mentor }`

**After:** Replace the inline logic with:
```typescript
import { submitScan, isScanSubmissionError } from "../services/scan-submission";

// ... inside /api/scan handler ...

try {
  const result = await submitScan(env.DB, student, qrPayload);
  
  return json(
    {
      scan: {
        scanId: result.scan.scan_id,
        studentId: result.scan.student_id,
        mentorId: result.scan.mentor_id,
        eventDate: result.scan.event_date,
        scannedAt: result.scan.scanned_at
      },
      mentor: {
        personId: result.scannedPerson.personId,
        displayName: result.scannedPerson.displayName
      }
    },
    { status: 201 }
  );
} catch (error) {
  if (isScanSubmissionError(error)) {
    if (error.code === 'DUPLICATE_SCAN') {
      return conflict(error.message);
    }
    return badRequest(error.message);
  }
  return internalServerError("Could not create scan record.");
}
```

**Note:** The response shape preserves the `mentor` key for backward compatibility with the student frontend.

**Update error messages:**
- Change "Invalid mentor QR payload." → "Invalid QR payload." (in both parse and not-found cases)
- Change "Duplicate mentor scan already recorded for this calendar day." → "Already scanned today."

#### 3.1.3 Update `/api/redeem-code` Error Message

Change the duplicate scan error message:
- "Duplicate mentor scan already recorded for this calendar day." → "Already scanned today."

### 3.2 Update Mentor Route

**File:** `src/worker/routes/mentor.ts`

#### 3.2.1 Update `/api/me` to Use Renamed Service

**Before:**
```typescript
import { renderMentorQrSvg } from "../services/mentor-qr-svg";
// ...
qrSvg: renderMentorQrSvg(qrPayload)
```

**After:**
```typescript
import { renderQrSvg } from "../services/qr-svg";
// ...
qrSvg: renderQrSvg(qrPayload)
```

#### 3.2.2 Add `POST /api/scan` Endpoint

Add new handler block after `/api/me`:
```typescript
if (apiPath === "/scan") {
  if (request.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const mentor = await findPersonBySecretToken(env.DB, "mentor", secretToken);

  if (!mentor) {
    return notFound();
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid scan request body.");
  }

  const qrPayload =
    typeof requestBody === "object" && requestBody !== null && "qrPayload" in requestBody
      ? requestBody.qrPayload
      : null;

  if (typeof qrPayload !== "string") {
    return badRequest("Invalid QR payload.");
  }

  try {
    const result = await submitScan(env.DB, mentor, qrPayload);
    
    return json(
      {
        scan: {
          scanId: result.scan.scan_id,
          studentId: result.scan.student_id,
          mentorId: result.scan.mentor_id,
          eventDate: result.scan.event_date,
          scannedAt: result.scan.scanned_at
        },
        scannedPerson: {
          personId: result.scannedPerson.personId,
          displayName: result.scannedPerson.displayName
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (isScanSubmissionError(error)) {
      if (error.code === 'DUPLICATE_SCAN') {
        return conflict(error.message);
      }
      return badRequest(error.message);
    }
    return internalServerError("Could not create scan record.");
  }
}
```

**Imports to add:**
```typescript
import { submitScan, isScanSubmissionError } from "../services/scan-submission";
```

---

## 4. Phase 3: Frontend HTML & CSS

### 4.1 Student Page

#### 4.1.1 HTML Changes

**File:** `public/student/index.html`

**Add mode toggle** inside the `scanner-card` article, above the existing content:

```html
<article class="card scanner-card">
  <h2 class="card-label">Camera scanner</h2>
  
  <!-- NEW: Mode toggle -->
  <div class="mode-toggle" role="group" aria-label="Scanner mode">
    <button type="button" class="mode-toggle-btn is-active" data-mode="scan" id="mode-scan-btn">
      Scan QR
    </button>
    <button type="button" class="mode-toggle-btn" data-mode="show" id="mode-show-btn">
      Show QR
    </button>
  </div>
  
  <!-- Scanner view (existing, default visible) -->
  <div id="scanner-view">
    <!-- existing scanner content stays here -->
  </div>
  
  <!-- NEW: QR display view (hidden by default) -->
  <div id="qr-display-view" class="hidden">
    <div id="qr-display" class="qr-display" role="img" aria-label="Your QR code"></div>
    <button type="button" class="button qr-copy-button" id="qr-copy">Copy QR payload</button>
  </div>
  
  <!-- rest of existing content -->
</article>
```

**Specific changes:**
1. Wrap existing scanner content in `<div id="scanner-view">`
2. Add `<div id="qr-display-view" class="hidden">` with QR display and copy button
3. Add mode toggle div with two buttons

#### 4.1.2 CSS Changes

**File:** `public/student/styles.css`

**Add toggle styles:**
```css
.mode-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #16a34a;
}

.mode-toggle-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: #ffffff;
  color: #16a34a;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.mode-toggle-btn.is-active {
  background: #16a34a;
  color: #ffffff;
}

.mode-toggle-btn:hover:not(.is-active) {
  background: #f0fdf4;
}

.mode-toggle-btn:focus-visible {
  outline: 2px solid #16a34a;
  outline-offset: -2px;
}
```

**Add QR display styles (reuse from mentor page):**
```css
.qr-display {
  display: flex;
  justify-content: center;
  margin: 16px 0;
}

.qr-display svg {
  max-width: 100%;
  height: auto;
}

.qr-copy-button {
  width: 100%;
  margin-top: 8px;
}
```

### 4.2 Mentor Page

#### 4.2.1 HTML Changes

**File:** `public/mentor/index.html`

**Add mode toggle** inside the `qr-card` article:

```html
<article class="card qr-card">
  <h2>Mentor QR code</h2>
  
  <!-- NEW: Mode toggle -->
  <div class="mode-toggle" role="group" aria-label="QR mode">
    <button type="button" class="mode-toggle-btn" data-mode="scan" id="mode-scan-btn">
      Scan QR
    </button>
    <button type="button" class="mode-toggle-btn is-active" data-mode="show" id="mode-show-btn">
      Show QR
    </button>
  </div>
  
  <!-- QR view (existing, default visible) -->
  <div id="qr-display-view">
    <div id="qr-display" class="qr-display hidden" role="img" aria-label="Mentor QR code"></div>
    <button type="button" class="button qr-copy-button hidden" id="qr-copy">Copy QR payload</button>
  </div>
  
  <!-- NEW: Scanner view (hidden by default) -->
  <div id="scanner-view" class="hidden">
    <button type="button" id="scanner-permission-retry-button"
      class="button scanner-permission-retry-button hidden">
      Retry camera permission
    </button>
    
    <div class="scanner-stage" id="scanner-stage">
      <video id="scanner-video" class="scanner-video" muted playsinline
        aria-label="Student QR camera preview"></video>
      
      <div id="scanner-placeholder" class="scanner-placeholder">
        <p class="scanner-placeholder-title" id="scanner-placeholder-title">Preparing scanner…</p>
        <p class="scanner-placeholder-copy" id="scanner-placeholder-copy">
          Your mentor identity must load before the camera can start.
        </p>
      </div>
    </div>
    
    <div class="scanner-actions">
      <button type="button" class="button scanner-toggle-button" id="scanner-toggle-button" disabled>
        Start scanner
      </button>
      <p class="scanner-hint">
        Scan a student's QR code
      </p>
    </div>
    
    <div id="scanner-feedback" class="scan-feedback hidden" aria-live="polite">
      <p class="scan-feedback-title" id="scanner-feedback-title"></p>
      <p class="scan-feedback-copy" id="scanner-feedback-copy"></p>
    </div>
  </div>
</article>
```

**Add qr-scanner library import** in `<head>`:
```html
<script type="module" src="/mentor/app.js"></script>
<!-- Add this line -->
<script type="module" src="/vendor/qr-scanner/qr-scanner.min.js"></script>
```

Wait — the student page uses `import QrScanner from '/vendor/qr-scanner/qr-scanner.min.js';` in its app.js. The mentor page should do the same. No HTML change needed for the library; just add the import in mentor/app.js.

#### 4.2.2 CSS Changes

**File:** `public/mentor/styles.css`

**Add toggle styles** (same as student page):
```css
.mode-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #16a34a;
}

.mode-toggle-btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: #ffffff;
  color: #16a34a;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.mode-toggle-btn.is-active {
  background: #16a34a;
  color: #ffffff;
}

.mode-toggle-btn:hover:not(.is-active) {
  background: #f0fdf4;
}

.mode-toggle-btn:focus-visible {
  outline: 2px solid #16a34a;
  outline-offset: -2px;
}
```

**Add scanner styles** (adapted from student page):
```css
.scanner-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #f8fafc;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}

.scanner-stage.is-active {
  background: #000000;
}

.scanner-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}

.scanner-placeholder-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #0f172a;
}

.scanner-placeholder-copy {
  font-size: 14px;
  color: #64748b;
}

.scanner-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scanner-toggle-button {
  width: 100%;
}

.scanner-hint {
  text-align: center;
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.scan-feedback {
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
}

.scan-feedback.is-success {
  background: #f0fdf4;
  border: 1px solid #16a34a;
}

.scan-feedback.is-error {
  background: #fef2f2;
  border: 1px solid #dc2626;
}

.scan-feedback-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.scan-feedback.is-success .scan-feedback-title {
  color: #16a34a;
}

.scan-feedback.is-error .scan-feedback-title {
  color: #dc2626;
}

.scan-feedback-copy {
  font-size: 14px;
  color: #334155;
  margin: 0;
}

.scanner-permission-retry-button {
  margin-bottom: 12px;
  width: 100%;
}
```

---

## 5. Phase 4: Frontend JavaScript

### 5.1 Student Page

**File:** `public/student/app.js`

#### 5.1.1 Add New DOM Element References

Add to `elements` object:
```javascript
modeScanBtn: document.getElementById('mode-scan-btn'),
modeShowBtn: document.getElementById('mode-show-btn'),
scannerView: document.getElementById('scanner-view'),
qrDisplayView: document.getElementById('qr-display-view'),
qrDisplay: document.getElementById('qr-display'),
qrCopy: document.getElementById('qr-copy'),
```

#### 5.1.2 Add Mode State and Toggle Logic

Add state variable:
```javascript
let currentMode = 'scan'; // 'scan' | 'show'
```

Add event listeners in initialization:
```javascript
elements.modeScanBtn.addEventListener('click', () => switchMode('scan'));
elements.modeShowBtn.addEventListener('click', () => switchMode('show'));
elements.qrCopy.addEventListener('click', copyQrPayload);
```

Add mode switching function:
```javascript
function switchMode(mode) {
  if (mode === currentMode) return;
  
  currentMode = mode;
  
  // Update toggle buttons
  elements.modeScanBtn.classList.toggle('is-active', mode === 'scan');
  elements.modeShowBtn.classList.toggle('is-active', mode === 'show');
  
  // Show/hide views
  elements.scannerView.classList.toggle('hidden', mode !== 'scan');
  elements.qrDisplayView.classList.toggle('hidden', mode !== 'show');
  
  // Pause scanner when switching away from scan mode
  if (mode !== 'scan' && scannerActive) {
    stopScanner(false);
  }
}
```

#### 5.1.3 Add QR Display Logic

Store QR data when identity loads:
```javascript
let studentQrPayload = '';
let studentQrSvg = '';

// Inside loadIdentity, after parsing response:
studentQrPayload = payload.qrPayload || '';
studentQrSvg = payload.qrSvg || '';
renderStudentQr();
```

Add render function:
```javascript
function renderStudentQr() {
  if (studentQrSvg) {
    elements.qrDisplay.innerHTML = studentQrSvg;
    elements.qrCopy.disabled = !studentQrPayload;
    elements.qrCopy.textContent = studentQrPayload ? 'Copy QR payload' : 'QR payload unavailable';
  }
}
```

Add copy function:
```javascript
async function copyQrPayload() {
  if (!studentQrPayload) return;
  
  try {
    await navigator.clipboard.writeText(studentQrPayload);
    elements.qrCopy.textContent = 'Copied';
    setTimeout(() => {
      elements.qrCopy.textContent = 'Copy QR payload';
    }, 1500);
  } catch {
    elements.qrCopy.textContent = 'Copy failed';
  }
}
```

#### 5.1.4 Update Error Messages

Update `buildScanError` to handle generic error messages:
```javascript
function buildScanError(status, payload) {
  const detail = getPayloadMessage(payload);

  if (status === 400) {
    return createScanError('Invalid QR code', detail || 'The decoded QR payload is not a valid attendance link.');
  }

  if (status === 409) {
    return createScanError('Duplicate scan', detail || 'You already scanned this person today. Try a different person or stop the scanner.');
  }
  // ... rest unchanged
}
```

### 5.2 Mentor Page

**File:** `public/mentor/app.js`

#### 5.2.1 Add Scanner Library Import

At the top of the file:
```javascript
import QrScanner from '/vendor/qr-scanner/qr-scanner.min.js';
```

#### 5.2.2 Add New DOM Element References

Add to `elements` object:
```javascript
modeScanBtn: document.getElementById("mode-scan-btn"),
modeShowBtn: document.getElementById("mode-show-btn"),
scannerView: document.getElementById("scanner-view"),
qrDisplayView: document.getElementById("qr-display-view"),
scannerStage: document.getElementById("scanner-stage"),
scannerVideo: document.getElementById("scanner-video"),
scannerPlaceholder: document.getElementById("scanner-placeholder"),
scannerPlaceholderTitle: document.getElementById("scanner-placeholder-title"),
scannerPlaceholderCopy: document.getElementById("scanner-placeholder-copy"),
scannerToggleButton: document.getElementById("scanner-toggle-button"),
scannerPermissionRetryButton: document.getElementById("scanner-permission-retry-button"),
scannerFeedback: document.getElementById("scanner-feedback"),
scannerFeedbackTitle: document.getElementById("scanner-feedback-title"),
scannerFeedbackCopy: document.getElementById("scanner-feedback-copy"),
```

#### 5.2.3 Add Scanner State Variables

Add to state:
```javascript
let qrScanner = null;
let scannerAvailability = 'unknown';
let scannerActive = false;
let scannerStarting = false;
let scannerProcessing = false;
let scanHandled = false;
let currentMode = 'show'; // 'scan' | 'show'
```

#### 5.2.4 Add Mode Toggle Logic

Add event listeners:
```javascript
elements.modeScanBtn.addEventListener("click", () => switchMode("scan"));
elements.modeShowBtn.addEventListener("click", () => switchMode("show"));
elements.scannerToggleButton.addEventListener("click", toggleScanner);
elements.scannerPermissionRetryButton.addEventListener("click", startScanner);
```

Add mode switching:
```javascript
function switchMode(mode) {
  if (mode === currentMode) return;
  
  currentMode = mode;
  
  elements.modeScanBtn.classList.toggle("is-active", mode === "scan");
  elements.modeShowBtn.classList.toggle("is-active", mode === "show");
  
  elements.scannerView.classList.toggle("hidden", mode !== "scan");
  elements.qrDisplayView.classList.toggle("hidden", mode !== "show");
  
  if (mode === "scan") {
    prepareScanner();
    stopPollingRecentScans(); // Pause polling while scanning
  } else {
    stopScanner(true);
    startPollingRecentScans(); // Resume polling
  }
}
```

#### 5.2.5 Add Scanner Functions (Adapted from Student)

Copy the following functions from `public/student/app.js` with adaptations:
- `prepareScanner()` — adapt for mentor path
- `toggleScanner()` — adapt for mentor state
- `startScanner()` — adapt for mentor path and UI
- `stopScanner()` — same logic
- `destroyScanner()` — same logic
- `handleScanDecoded()` — POST to `${mentorPath}/api/scan`
- `handleScanDecodeError()` — same logic
- `normalizeDecodedPayload()` — same logic
- `buildScanError()` — adapt error messages
- `createScanError()` — same logic
- `getPayloadMessage()` — same logic
- `readJson()` — same logic
- `isPermissionDeniedError()` — same logic
- `isCameraUnavailableError()` — same logic
- All scanner UI state functions (`setScannerLoading`, `setScannerStarting`, etc.)

**Key adaptations for mentor scanner:**
- Use `mentorPath` instead of `studentPath`
- POST to `${mentorPath}/api/scan`
- Response uses `scannedPerson` instead of `mentor`
- On success, refresh recent scans instead of history
- Alert text: "SCAN SUCCESSFUL! " + (responseBody.scannedPerson?.displayName || 'Student')

**Example adapted `handleScanDecoded`:**
```javascript
async function handleScanDecoded(result) {
  if (scanHandled) return;
  
  scanHandled = true;
  scannerProcessing = true;
  
  await stopScanner(true);
  
  const qrPayload = normalizeDecodedPayload(result);
  
  if (!qrPayload) {
    scannerProcessing = false;
    setScannerErrorState(
      'Unreadable QR code.',
      'The camera read something, but it did not contain a usable payload.',
      false
    );
    return;
  }
  
  setPageStatus('loading', 'QR code decoded. Saving the student scan…');
  setScannerProcessing('QR code decoded. Saving the student scan…', 'The camera has paused while the decoded payload is being sent to the attendance service.', true);
  
  try {
    const response = await fetch(`${mentorPath}/api/scan`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qrPayload }),
    });
    
    const responseBody = await readJson(response);
    
    if (!response.ok) {
      throw buildScanError(response.status, responseBody);
    }
    
    setScanFeedback('success', 'Scan recorded', 'The student scan was accepted. Refreshing recent scans now.');
    
    await loadRecentScans({ showLoading: false });
    
    alert('SCAN SUCCESSFUL! ' + (responseBody.scannedPerson?.displayName || 'Student'));
    
    setPageStatus('success', 'Student scan recorded. Recent scans have been refreshed.');
    setScannerStopped('Scanner stopped. Tap Start scanner to scan another student QR code.', 'Start scanner', false);
  } catch (error) {
    const feedbackTitle = error instanceof Error && typeof error.title === 'string' ? error.title : 'Scan failed';
    const feedbackCopy = error instanceof Error ? error.message : 'The student QR code could not be saved.';
    
    setScanFeedback('error', feedbackTitle, feedbackCopy);
    setPageStatus('error', feedbackCopy);
    setScannerStopped('Scanner stopped. Fix the issue and tap Start scanner to try again.', 'Start scanner', false);
  } finally {
    scannerProcessing = false;
  }
}
```

#### 5.2.6 Update `resetPageState`

Add scanner reset:
```javascript
function resetPageState() {
  // ... existing code ...
  
  // Reset scanner state
  stopScanner(true);
  if (qrScanner) {
    destroyScanner();
  }
  scannerAvailability = 'unknown';
  scanHandled = false;
  
  // Reset mode to show
  currentMode = 'show';
  elements.modeScanBtn.classList.remove("is-active");
  elements.modeShowBtn.classList.add("is-active");
  elements.scannerView.classList.add("hidden");
  elements.qrDisplayView.classList.remove("hidden");
}
```

#### 5.2.7 Add `stopPollingRecentScans` Helper

```javascript
function stopPollingRecentScans() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}
```

---

## 6. Phase 5: Tests

### 6.1 Unit Tests

#### 6.1.1 Update QR Parser Tests

**File:** `test/unit/mentor-qr.test.ts` → `test/unit/qr-payload.test.ts`

**Changes:**
- Rename file
- Update import: `parseQrPayload` from `../../src/worker/services/qr-payload`
- Add test cases for student prefix

**New test cases:**
```typescript
describe("parseQrPayload", () => {
  it("returns the mentor role and id from a valid v1 mentor QR payload", () => {
    expect(parseQrPayload("absenqr:v1:mentor:mentor-001")).toEqual({
      role: "mentor",
      personId: "mentor-001"
    });
  });

  it("returns the student role and id from a valid v1 student QR payload", () => {
    expect(parseQrPayload("absenqr:v1:student:student-001")).toEqual({
      role: "student",
      personId: "student-001"
    });
  });

  it("rejects payloads with the wrong prefix", () => {
    expect(parseQrPayload("mentor-001")).toBeNull();
  });

  it("rejects payloads with invalid person id characters", () => {
    expect(parseQrPayload("absenqr:v1:mentor:MENTOR_001")).toBeNull();
  });
});
```

### 6.2 Integration API Tests

#### 6.2.1 Update Student API Tests

**File:** `test/integration/student-api.test.ts`

**Changes:**

1. **Update `/api/me` test** to expect `qrPayload` and `qrSvg`:
```typescript
await expect(response.json()).resolves.toMatchObject({
  student: {
    personId: student1.person_id,
    displayName: student1.display_name,
    secretId: student1.secret_id
  },
  qrPayload: `absenqr:v1:student:${student1.person_id}`,
  qrSvg: expect.stringContaining("<svg")
});
```

2. **Update error message assertions**:
   - "Invalid mentor QR payload." → "Invalid QR payload."
   - "Duplicate mentor scan already recorded for this calendar day." → "Already scanned today."

3. **Add test for scanning a student QR** (should fail with same-role error):
```typescript
it("rejects scanning a student QR payload (same role)", async () => {
  const database = createMockD1Database();
  const fetchHandler = worker.fetch as FetchHandler;
  const response = await fetchHandler(
    new Request(`https://example.com/student/${student1.secret_path_token}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        qrPayload: `absenqr:v1:student:${student2.person_id}`
      })
    }) as WorkerRequest,
    createEnv(database),
    {} as WorkerContext
  );

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: "You can only scan the opposite role."
  });
});
```

4. **Add test for self-scan**:
```typescript
it("rejects scanning your own QR payload", async () => {
  const database = createMockD1Database();
  const fetchHandler = worker.fetch as FetchHandler;
  const response = await fetchHandler(
    new Request(`https://example.com/student/${student1.secret_path_token}/api/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        qrPayload: `absenqr:v1:student:${student1.person_id}`
      })
    }) as WorkerRequest,
    createEnv(database),
    {} as WorkerContext
  );

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: "You cannot scan yourself."
  });
});
```

#### 6.2.2 Add Mentor Scan Tests

**File:** `test/integration/mentor-api.test.ts`

**Add new test suite** at the end:

```typescript
describe("POST /api/scan", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${configuredEventDate}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a scan record from a valid student QR payload", async () => {
    const database = createMockD1Database();
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request(`https://example.com/mentor/${mentor1.secret_path_token}/api/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrPayload: `absenqr:v1:student:${student1.person_id}`
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      scan: {
        studentId: student1.person_id,
        mentorId: mentor1.person_id,
        eventDate: configuredEventDate
      },
      scannedPerson: {
        personId: student1.person_id,
        displayName: student1.display_name
      }
    });
  });

  it("rejects scanning a mentor QR payload (same role)", async () => {
    const database = createMockD1Database();
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request(`https://example.com/mentor/${mentor1.secret_path_token}/api/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrPayload: `absenqr:v1:mentor:${mentor2.person_id}`
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "You can only scan the opposite role."
    });
  });

  it("rejects scanning your own QR payload", async () => {
    const database = createMockD1Database();
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request(`https://example.com/mentor/${mentor1.secret_path_token}/api/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrPayload: `absenqr:v1:mentor:${mentor1.person_id}`
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "You cannot scan yourself."
    });
  });

  it("rejects a duplicate student scan for the same event day", async () => {
    const database = createMockD1Database({
      scanRecords: [
        {
          scan_id: "scan-duplicate-existing",
          student_id: student1.person_id,
          mentor_id: mentor1.person_id,
          event_date: configuredEventDate,
          scanned_at: `${configuredEventDate}T08:00:00.000Z`,
          notes: "",
          updated_at: `${configuredEventDate}T08:00:00.000Z`
        }
      ]
    });
    const fetchHandler = worker.fetch as FetchHandler;
    const response = await fetchHandler(
      new Request(`https://example.com/mentor/${mentor1.secret_path_token}/api/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qrPayload: `absenqr:v1:student:${student1.person_id}`
        })
      }) as WorkerRequest,
      createEnv(database),
      {} as WorkerContext
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Already scanned today."
    });
  });
});
```

### 6.3 DOM Tests

#### 6.3.1 Update Student Page DOM Tests

**File:** `test/integration/student-page-dom.test.ts`

**Add new test cases:**

```typescript
it("has a mode toggle with scan and show buttons", () => {
  expect(studentPageHtml).toContain('id="mode-scan-btn"');
  expect(studentPageHtml).toContain('id="mode-show-btn"');
  expect(studentPageHtml).toContain('data-mode="scan"');
  expect(studentPageHtml).toContain('data-mode="show"');
});

it("has a QR display view that is hidden by default", () => {
  expect(studentPageHtml).toContain('id="qr-display-view"');
  const viewMatch = studentPageHtml.match(/id="qr-display-view"[^>]*class="([^"]*)"/);
  expect(viewMatch?.[1]).toContain('hidden');
});

it("has a QR display container and copy button", () => {
  expect(studentPageHtml).toContain('id="qr-display"');
  expect(studentPageHtml).toContain('id="qr-copy"');
});
```

#### 6.3.2 Update Mentor Page DOM Tests

**File:** `test/integration/mentor-page-dom.test.ts`

**Add new test cases:**

```typescript
it("has a mode toggle with scan and show buttons", () => {
  expect(mentorPageHtml).toContain('id="mode-scan-btn"');
  expect(mentorPageHtml).toContain('id="mode-show-btn"');
});

it("has a scanner view that is hidden by default", () => {
  expect(mentorPageHtml).toContain('id="scanner-view"');
  const viewMatch = mentorPageHtml.match(/id="scanner-view"[^>]*class="([^"]*)"/);
  expect(viewMatch?.[1]).toContain('hidden');
});

it("has scanner video and toggle button elements", () => {
  expect(mentorPageHtml).toContain('id="scanner-video"');
  expect(mentorPageHtml).toContain('id="scanner-toggle-button"');
  expect(mentorPageHtml).toContain('id="scanner-feedback"');
});
```

### 6.4 Student Page App Tests

**File:** `test/integration/student-page-app.test.ts`

**Update `createStudentDom`** to include new elements:
```typescript
modeScanBtn: new FakeElement("button", "mode-scan-btn"),
modeShowBtn: new FakeElement("button", "mode-show-btn"),
scannerView: new FakeElement("div", "scanner-view"),
qrDisplayView: new FakeElement("div", "qr-display-view"),
qrDisplay: new FakeElement("div", "qr-display"),
qrCopy: new FakeElement("button", "qr-copy"),
```

**Update fetch mock** for `/api/me` to include QR data:
```typescript
if (url.endsWith("/api/me")) {
  return mockResponse({
    student: { displayName: "Student Local 01", secretId: "student-secret-001" },
    qrPayload: "absenqr:v1:student:student-001",
    qrSvg: "<svg></svg>"
  });
}
```

**Add test for mode toggle:**
```typescript
it("switches between scan and show modes", async () => {
  const { elements } = await loadStudentPageApp();
  
  // Default: scan mode
  expect(elements.scannerView.classList.contains("hidden")).toBe(false);
  expect(elements.qrDisplayView.classList.contains("hidden")).toBe(true);
  expect(elements.modeScanBtn.classList.contains("is-active")).toBe(true);
  
  // Switch to show mode
  await elements.modeShowBtn.click();
  
  expect(elements.scannerView.classList.contains("hidden")).toBe(true);
  expect(elements.qrDisplayView.classList.contains("hidden")).toBe(false);
  expect(elements.modeShowBtn.classList.contains("is-active")).toBe(true);
});
```

---

## 7. Batching & Parallelization Strategy

### Batch 1: Backend Foundation (Sequential)
1. `src/worker/services/qr-payload.ts` (rename + generalize)
2. `src/worker/services/qr-svg.ts` (rename)
3. `src/worker/services/scan-submission.ts` (new)

### Batch 2: Backend Routes (Sequential, depends on Batch 1)
4. `src/worker/routes/student.ts` (update `/api/me`, refactor `/api/scan`)
5. `src/worker/routes/mentor.ts` (update `/api/me`, add `/api/scan`)

### Batch 3: Frontend HTML/CSS (Parallel with Batch 2)
6. `public/student/index.html` (add toggle + QR view)
7. `public/student/styles.css` (add toggle + QR styles)
8. `public/mentor/index.html` (add toggle + scanner view)
9. `public/mentor/styles.css` (add toggle + scanner styles)

### Batch 4: Frontend JS (Sequential, depends on Batch 3)
10. `public/student/app.js` (add toggle + QR logic)
11. `public/mentor/app.js` (add toggle + scanner logic)

### Batch 5: Tests (Sequential, depends on Batch 2 & 4)
12. `test/unit/qr-payload.test.ts` (rename + update)
13. `test/integration/student-api.test.ts` (update)
14. `test/integration/mentor-api.test.ts` (add scan tests)
15. `test/integration/student-page-dom.test.ts` (add toggle tests)
16. `test/integration/mentor-page-dom.test.ts` (add toggle tests)
17. `test/integration/student-page-app.test.ts` (update + add toggle tests)

---

## 8. Verification Checklist

### Functionality
- [ ] Student `/api/me` returns `qrPayload` and `qrSvg`
- [ ] Mentor `/api/me` still returns `qrPayload` and `qrSvg`
- [ ] Student can scan mentor QR (existing flow preserved)
- [ ] Mentor can scan student QR (new flow)
- [ ] Same-role scan rejected with 400
- [ ] Self-scan rejected with 400
- [ ] Duplicate scan rejected with 409
- [ ] Student page toggle switches between scanner and QR display
- [ ] Mentor page toggle switches between QR display and scanner
- [ ] Student QR copy button works
- [ ] Mentor QR copy button still works

### Error Handling
- [ ] Invalid QR payload returns 400 with "Invalid QR payload."
- [ ] Non-existent person returns 400 with "Invalid QR payload."
- [ ] Duplicate scan returns 409 with "Already scanned today."

### Testing
- [ ] All existing tests pass
- [ ] New unit tests for generalized QR parser
- [ ] New integration tests for mentor scan endpoint
- [ ] Updated DOM tests for toggle elements
- [ ] Updated app tests for mode switching

### Backward Compatibility
- [ ] Existing mentor QR codes (`absenqr:v1:mentor:*`) still parse correctly
- [ ] Student `/api/scan` response still includes `mentor` key
- [ ] Existing DOM hook IDs preserved
- [ ] No changes to admin functionality

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing student flow | Preserve `/api/scan` response shape (`mentor` key). Run full student test suite after changes. |
| Breaking existing mentor flow | Mentor `/api/me` keeps same response shape. QR display logic unchanged. |
| Scanner not working on mentor page | Reuse exact scanner initialization from student page. Test with real camera. |
| Mobile layout issues | Test student page toggle on mobile viewport. Keep mobile-first ordering. |
| Test flakiness from DOM changes | Preserve all existing hook IDs. Only add new ones. |
