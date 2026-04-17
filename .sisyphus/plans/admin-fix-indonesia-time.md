# Admin Fix + Indonesia Time Migration

## TL;DR

> **Quick Summary**: Fix the admin panel crash caused by missing button IDs, then migrate the entire system from UTC calendar-day semantics to Indonesia (GMT+7 / Asia/Jakarta) time. Remove EVENT_DATE entirely. Store timestamps as `YYYY-MM-DD HH:mm:ss`. Default admin filter is yesterday→tomorrow.
>
> **Deliverables**:
> - Fixed `public/admin/index.html` and `public/admin/app.js`
> - Jakarta time helpers in `src/worker/services/event-day.ts`
> - Updated backend routes (student, mentor, admin)
> - Updated DB layer (`src/worker/db/scan-records.ts`)
> - Updated frontend timezone pinning
> - Removed EVENT_DATE from types, tests, docs, scripts
> - Updated test suite for GMT+7 boundaries
>
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: T3 → T5/T6/T7/T8 → T9/T10/T11/T12/T13/T14/T15 → F1-F4

---

## Context

### Original Request
User reported that a QR scan wasn't showing up on the admin panel. Investigation revealed missing button IDs in `public/admin/index.html` causing a JS crash before `loadRecords()` could run.

User also requested:
- Remove `EVENT_DATE` completely
- Use Indonesia local time (GMT+7 / Asia/Jakarta) for all date logic
- Store `scanned_at` and `updated_at` as `YYYY-MM-DD HH:mm:ss`
- Admin default date filter = yesterday → tomorrow (3-day window)
- Duplicate scan prevention uses Indonesia calendar day

### Interview Summary
**Key Discussions**:
- `scanned_at` format: `YYYY-MM-DD HH:mm:ss` (space separator, no offset)
- `updated_at`: Same Indonesia local time format to avoid mixed timezone DB
- `EVENT_DATE`: Completely remove from codebase
- Admin filter default: Yesterday to Tomorrow
- Duplicate prevention: Indonesia calendar day
- Frontend timestamp display: Pinned to `Asia/Jakarta`

### Metis Review
**Identified Gaps** (addressed):
- `scanned_at` format must preserve `YYYY-MM-DD` prefix because DB queries use `substr(scanned_at, 1, 10)` → resolved with `YYYY-MM-DD HH:mm:ss`
- `updated_at` inconsistency risk → resolved by switching all `updated_at` generation to Indonesia local time
- Existing `utcDate` parameter names in DB functions → renamed to `dayKey`
- `auditAndBackfillEventDates` uses `substr(scanned_at, 1, 10)` → included in migration tasks
- Test boundary values need Jakarta midnight (`17:00:00Z`) → included in test rewrite tasks

---

## Work Objectives

### Core Objective
Fix the admin panel DOM crash and migrate all date/time logic from UTC to hard-coded Indonesia (Asia/Jakarta, GMT+7, no DST) semantics, removing EVENT_DATE entirely.

### Concrete Deliverables
- `public/admin/index.html` with correct button IDs
- `public/admin/app.js` with text button labels and Jakarta-aware defaults
- `src/worker/services/event-day.ts` with Jakarta helpers
- Updated `src/worker/routes/{student,mentor,admin}.ts`
- Updated `src/worker/db/scan-records.ts` with renamed params and Jakarta backfill
- Pinned timezone in `public/student/app.js` and `public/mentor/app.js`
- No `EVENT_DATE` references anywhere in source, tests, docs, or scripts
- Updated test suite reflecting GMT+7 day boundaries
- Updated seed data

### Definition of Done
- `npm test` passes
- `npm run test:e2e:admin` passes (if available)
- Admin panel loads records without JS errors
- Scan at `16:59:59Z` falls on Indonesia day N; scan at `17:00:00Z` falls on day N+1

### Must Have
- Admin HTML button IDs fixed
- Admin JS button labels match tests
- Jakarta day-key helpers implemented
- All routes use Jakarta day for filtering and deduplication
- `scanned_at` and `updated_at` stored as `YYYY-MM-DD HH:mm:ss`
- Admin default range = yesterday → tomorrow
- EVENT_DATE fully removed
- Tests updated for GMT+7 boundaries

### Must NOT Have (Guardrails)
- No D1 migration/schema changes (event_date stays TEXT YYYY-MM-DD)
- No configurable timezone support beyond hard-coded Asia/Jakarta
- No CSV column changes
- No new dependencies unless absolutely necessary

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (tests exist and must be updated to match new behavior)
- **Framework**: Vitest + Playwright e2e

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (`playwright` skill) — navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (`curl`) — send requests, assert status + response fields
- **Library/Module**: Use Bash (`bun test`) — run targeted tests

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - start immediately):
├── T1: Fix admin HTML button IDs
├── T2: Fix admin JS button labels
├── T3: Build Jakarta time helpers
└── T4: Remove EVENT_DATE from types/docs/scripts

Wave 2 (Backend routes + DB - after T3):
├── T5: Update student.ts route
├── T6: Update mentor.ts route
├── T7: Update admin.ts route (yesterday→tomorrow default)
└── T8: Update DB scan-records.ts

Wave 3 (Frontend + Tests - after Wave 2):
├── T9: Update student/mentor frontend formatTimestamp
├── T10: Update admin frontend date handling
├── T11: Update unit tests (calendar-day-semantics + backfill)
├── T12: Update student-api integration tests
├── T13: Update mentor-api integration tests
├── T14: Update admin-api integration tests
└── T15: Update e2e seed data

Wave FINAL (After ALL tasks):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix
- **T1, T2, T4**: None → can start immediately
- **T3**: None → can start immediately; blocks T5, T6, T7, T8
- **T5-T8**: Depend on T3; can run in parallel with each other
- **T9-T15**: Depend on Wave 2 implementation; can run in parallel with each other
- **F1-F4**: Depend on T1-T15

---

## TODOs

- [ ] T1. **Fix admin HTML button IDs**

  **What to do**:
  - Add `id="apply-filters-button"` to the first `<button type="button">Apply</button>` in `public/admin/index.html`
  - Add `id="export-csv-button"` to the second `<button type="button">Export CSV</button>` in `public/admin/index.html`

  **Must NOT do**:
  - Do not change any other HTML structure
  - Do not change button text content

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `public/admin/index.html:31-34` - buttons are missing IDs
  - `public/admin/app.js:8-11` - JS expects these IDs
  - `test/integration/admin-page-dom.test.ts:35-36,61,65` - tests assert these IDs exist

  **Acceptance Criteria**:
  - [ ] `public/admin/index.html` contains `id="apply-filters-button"`
  - [ ] `public/admin/index.html` contains `id="export-csv-button"`
  - [ ] `npm test -- test/integration/admin-page-dom.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: DOM test passes after adding IDs
    Tool: Bash
    Steps:
      1. Run `npm test -- test/integration/admin-page-dom.test.ts`
    Expected Result: Exit code 0, all assertions pass
    Evidence: .sisyphus/evidence/task-t1-dom-test-pass.txt
  ```

  **Commit**: YES
  - Message: `fix(admin): add missing button IDs`
  - Files: `public/admin/index.html`

- [ ] T2. **Fix admin JS button labels**

  **What to do**:
  - In `public/admin/app.js`, change `editButton.textContent = "✏️"` to `"Edit"`
  - Change `saveButton.textContent = "💾"` to `"Save"`
  - Change `deleteButton.textContent = "❌"` to `"Delete"`

  **Must NOT do**:
  - Do not change any other app.js logic
  - Do not change class names or event handlers

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `public/admin/app.js:337-350` - emoji labels in createRecordRow
  - `test/integration/admin-page-app.test.ts` - expects "Edit", "Save", "Delete"
  - `test/e2e/admin-flow.spec.ts` - Playwright uses `getByRole("button", { name: "Edit" })`

  **Acceptance Criteria**:
  - [ ] `public/admin/app.js` uses text labels "Edit", "Save", "Delete"
  - [ ] `npm test -- test/integration/admin-page-app.test.ts` → PASS

  **QA Scenarios**:
  ```
  Scenario: App test passes after label fix
    Tool: Bash
    Steps:
      1. Run `npm test -- test/integration/admin-page-app.test.ts`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-t2-app-test-pass.txt
  ```

  **Commit**: YES
  - Message: `fix(admin): use text labels for action buttons`
  - Files: `public/admin/app.js`

- [ ] T3. **Build Jakarta time helpers**

  **What to do**:
  - In `src/worker/services/event-day.ts`:
    - Remove `getConfiguredEventDate(env)`
    - Replace `getCurrentUtcDate()` with `getCurrentJakartaDate()` returning `YYYY-MM-DD` in Asia/Jakarta
    - Replace `getUtcDayKey(timestamp)` with `getJakartaDayKey(timestamp)` deriving Jakarta date from a Date or ISO string
    - Add `getIndonesiaTimestamp()` returning `YYYY-MM-DD HH:mm:ss` in Asia/Jakarta
  - Use `toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta', ... })` or equivalent reliable approach
  - Indonesia does not observe DST

  **Must NOT do**:
  - Do not introduce external date libraries
  - Do not keep UTC-derived functions under old names

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T5, T6, T7, T8
  - **Blocked By**: None

  **References**:
  - `src/worker/services/event-day.ts:1-31` - current UTC helpers
  - `src/worker/validation/scan-records.ts` - `isEventDate` regex used for validation

  **Acceptance Criteria**:
  - [ ] `getCurrentJakartaDate()` exists and returns correct `YYYY-MM-DD`
  - [ ] `getJakartaDayKey(timestamp)` handles Date and string inputs
  - [ ] `getIndonesiaTimestamp()` returns `YYYY-MM-DD HH:mm:ss`
  - [ ] `getConfiguredEventDate` removed
  - [ ] `npm test -- test/unit/calendar-day-semantics.test.ts` → will be updated later, but helpers compile

  **QA Scenarios**:
  ```
  Scenario: Jakarta midnight boundary
    Tool: Bash (node/bun REPL)
    Preconditions: None
    Steps:
      1. Call getJakartaDayKey("2026-01-14T16:59:59Z")
      2. Assert result === "2026-01-14"
      3. Call getJakartaDayKey("2026-01-14T17:00:00Z")
      4. Assert result === "2026-01-15"
    Expected Result: Both assertions pass
    Evidence: .sisyphus/evidence/task-t3-boundary.txt

  Scenario: Current date at known Jakarta time
    Tool: Bash (node/bun REPL)
    Steps:
      1. Mock Date to 2026-01-15T10:00:00Z
      2. Call getCurrentJakartaDate()
      3. Assert result === "2026-01-15" (17:00 Jakarta)
      4. Mock Date to 2026-01-15T16:00:00Z
      5. Call getCurrentJakartaDate()
      6. Assert result === "2026-01-15" (23:00 Jakarta)
      7. Mock Date to 2026-01-15T17:00:00Z
      8. Call getCurrentJakartaDate()
      9. Assert result === "2026-01-16" (00:00 Jakarta)
    Expected Result: All assertions pass
    Evidence: .sisyphus/evidence/task-t3-current-date.txt
  ```

  **Commit**: YES
  - Message: `feat(time): add Jakarta time helpers and remove EVENT_DATE`
  - Files: `src/worker/services/event-day.ts`
  - Pre-commit: `npm run typecheck`

- [ ] T4. **Remove EVENT_DATE from types, docs, scripts**

  **What to do**:
  - Remove `EVENT_DATE: string` from `src/worker/types.ts`
  - Remove `--var EVENT_DATE:2026-04-11` from `package.json` `dev:e2e` script
  - Remove `EVENT_DATE` from all test env factories (`test/integration/student-api.test.ts`, `mentor-api.test.ts`, `admin-api.test.ts`)
  - Remove `EVENT_DATE` mention from `README.md`
  - Update `docs/prd/mentor-student-qr-attendance-v1.md` and `docs/implementation/mentor-student-qr-attendance-v1-plan.md` to replace "UTC calendar-day" with "GMT+7 (Asia/Jakarta) calendar-day"

  **Must NOT do**:
  - Do not change any business logic in these files beyond removing EVENT_DATE references
  - Do not add new scope to docs

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T12, T13, T14
  - **Blocked By**: None

  **References**:
  - `src/worker/types.ts:22` - EVENT_DATE in Env type
  - `package.json:8` - dev:e2e script
  - `README.md:165` - env docs
  - `docs/prd/mentor-student-qr-attendance-v1.md` - UTC references
  - `docs/implementation/mentor-student-qr-attendance-v1-plan.md` - UTC references

  **Acceptance Criteria**:
  - [ ] No `EVENT_DATE` references remain in `src/`, `test/`, `package.json`, `README.md`
  - [ ] Docs updated to describe GMT+7 semantics
  - [ ] `npm run typecheck` passes

  **QA Scenarios**:
  ```
  Scenario: EVENT_DATE fully removed
    Tool: Bash (grep)
    Steps:
      1. Run `grep -r "EVENT_DATE" src/ test/ package.json README.md docs/ || echo "clean"`
    Expected Result: Output contains "clean" (exit 0 or 1 with no matches)
    Evidence: .sisyphus/evidence/task-t4-no-event-date.txt
  ```

  **Commit**: YES
  - Message: `chore: remove EVENT_DATE from types, tests, docs, and scripts`
  - Files: multiple (see above)

- [ ] T5. **Update student.ts route for Jakarta time**

  **What to do**:
  - In `src/worker/routes/student.ts`:
    - Replace `getCurrentUtcDate, getUtcDayKey` imports with `getCurrentJakartaDate, getJakartaDayKey, getIndonesiaTimestamp`
    - Change `scannedAt = new Date().toISOString()` to `scannedAt = getIndonesiaTimestamp()`
    - Change `eventDate = getUtcDayKey(scannedAt)` to `eventDate = getJakartaDayKey(scannedAt)`
    - Change `currentUtcDate = getUtcDayKey(new Date())` to `currentJakartaDate = getCurrentJakartaDate()`
    - Pass `currentJakartaDate` to `listStudentHistory` and `findStudentMentorScanRecordByEventDate`
  - Remove unused `getCurrentUtcDate` import if present

  **Must NOT do**:
  - Do not change API response shapes
  - Do not change validation logic beyond timezone

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T6, T7, T8)
  - **Parallel Group**: Wave 2
  - **Blocks**: T12
  - **Blocked By**: T3

  **References**:
  - `src/worker/routes/student.ts:1-170` - current implementation
  - `src/worker/db/scan-records.ts:61-100` - history and duplicate check functions

  **Acceptance Criteria**:
  - [ ] `student.ts` compiles and typechecks
  - [ ] `scanned_at` stored as `YYYY-MM-DD HH:mm:ss`
  - [ ] Duplicate check uses Jakarta day
  - [ ] History filter uses Jakarta day

  **QA Scenarios**:
  ```
  Scenario: Student scan stores Indonesia timestamp
    Tool: Bash (curl against local dev server or REPL)
    Steps:
      1. POST /api/student/scan with valid mentor QR
      2. Inspect D1 scan_records table
      3. Assert scanned_at matches pattern /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    Expected Result: Pattern matches and date is Jakarta day
    Evidence: .sisyphus/evidence/task-t5-student-scan.txt
  ```

  **Commit**: YES (group with Wave 2)

- [ ] T6. **Update mentor.ts route for Jakarta time**

  **What to do**:
  - In `src/worker/routes/mentor.ts`:
    - Replace `getCurrentUtcDate` import with `getCurrentJakartaDate, getIndonesiaTimestamp`
    - Change `currentUtcDate = getCurrentUtcDate()` to `currentJakartaDate = getCurrentJakartaDate()`
    - Pass `currentJakartaDate` to `listMentorRecentScans`
    - Change `new Date().toISOString()` in notes update to `getIndonesiaTimestamp()`

  **Must NOT do**:
  - Do not change API response shapes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T5, T7, T8)
  - **Parallel Group**: Wave 2
  - **Blocks**: T13
  - **Blocked By**: T3

  **References**:
  - `src/worker/routes/mentor.ts:1-132` - current implementation

  **Acceptance Criteria**:
  - [ ] `mentor.ts` compiles and typechecks
  - [ ] Recent scans filtered by Jakarta day
  - [ ] Notes updated_at uses Indonesia timestamp

  **QA Scenarios**:
  ```
  Scenario: Mentor recent scans use Jakarta day
    Tool: Bash (curl or REPL)
    Steps:
      1. GET /api/mentor/recent-scans
      2. Assert response contains only scans from Jakarta current day
    Expected Result: Correct day filtering
    Evidence: .sisyphus/evidence/task-t6-mentor-scans.txt
  ```

  **Commit**: YES (group with Wave 2)

- [ ] T7. **Update admin.ts route for Jakarta time**

  **What to do**:
  - In `src/worker/routes/admin.ts`:
    - Replace `getCurrentUtcDate` import with `getCurrentJakartaDate, getIndonesiaTimestamp`
    - Update `resolveAdminDateRange` fallback: when no query params, return `{ startDate: yesterday, endDate: tomorrow }` computed from current Jakarta date
    - Change `currentUtcDate` references to `currentJakartaDate`
    - Change CSV filename from `attendance-${currentUtcDate}.csv` to `attendance-${currentJakartaDate}.csv`
    - Change `updatedAt: new Date().toISOString()` in PATCH to `updatedAt: getIndonesiaTimestamp()`
  - Yesterday/tomorrow computed as: today - 1 day and today + 1 day in Jakarta timezone

  **Must NOT do**:
  - Do not change the CSV column order
  - Do not change PATCH/DELETE behavior beyond timestamps

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T5, T6, T8)
  - **Parallel Group**: Wave 2
  - **Blocks**: T10, T14
  - **Blocked By**: T3

  **References**:
  - `src/worker/routes/admin.ts:1-274` - current implementation

  **Acceptance Criteria**:
  - [ ] Admin /records with no params returns dateFilter startDate=yesterday, endDate=tomorrow (Jakarta)
  - [ ] Admin /export.csv filename uses Jakarta current date
  - [ ] Admin PATCH updated_at uses Indonesia timestamp

  **QA Scenarios**:
  ```
  Scenario: Admin default range is yesterday to tomorrow
    Tool: Bash (curl or REPL)
    Preconditions: Mock current Jakarta date to 2026-01-15
    Steps:
      1. GET /api/admin/records with no query params
      2. Assert response.dateFilter.startDate === "2026-01-14"
      3. Assert response.dateFilter.endDate === "2026-01-16"
    Expected Result: Both assertions pass
    Evidence: .sisyphus/evidence/task-t7-admin-range.txt
  ```

  **Commit**: YES (group with Wave 2)

- [ ] T8. **Update DB scan-records.ts**

  **What to do**:
  - In `src/worker/db/scan-records.ts`:
    - Rename parameter `utcDate` to `dayKey` in `listStudentHistory`, `findStudentMentorScanRecordByEventDate`, `listMentorRecentScans`
    - Update `auditAndBackfillEventDates` to use Jakarta day extraction instead of UTC day extraction from `scanned_at`
    - Import and use `getJakartaDayKey` from `../services/event-day` in the backfill function
  - The `substr(scanned_at, 1, 10)` logic stays exactly the same because `YYYY-MM-DD HH:mm:ss` preserves the prefix

  **Must NOT do**:
  - Do not change SQL query structure
  - Do not change column types

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T5, T6, T7)
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: T3

  **References**:
  - `src/worker/db/scan-records.ts:1-266` - current implementation

  **Acceptance Criteria**:
  - [ ] Parameter `utcDate` renamed to `dayKey` everywhere
  - [ ] `auditAndBackfillEventDates` uses Jakarta day derivation
  - [ ] Typecheck passes

  **QA Scenarios**:
  ```
  Scenario: Backfill uses Jakarta day
    Tool: Bash (bun test -- test/unit/calendar-day-backfill.test.ts after T11 updates)
    Steps:
      1. Run updated backfill tests
    Expected Result: PASS
    Evidence: .sisyphus/evidence/task-t8-backfill.txt
  ```

  **Commit**: YES (group with Wave 2)

- [ ] T9. **Update student/mentor frontend formatTimestamp**

  **What to do**:
  - In `public/student/app.js` and `public/mentor/app.js`:
    - Update `formatTimestamp(value)` to use `timeZone: 'Asia/Jakarta'` explicitly
    - Example: `new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })`
  - Ensure the function handles the new `YYYY-MM-DD HH:mm:ss` input gracefully (it should, because `new Date('2026-04-17 14:30:00')` parses correctly in JS)

  **Must NOT do**:
  - Do not change other frontend logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T10-T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Wave 2

  **References**:
  - `public/student/app.js` - formatTimestamp
  - `public/mentor/app.js` - formatTimestamp

  **Acceptance Criteria**:
  - [ ] Both formatTimestamp functions pin timezone to Asia/Jakarta
  - [ ] DOM tests still pass

  **QA Scenarios**:
  ```
  Scenario: Frontend displays Jakarta time
    Tool: Playwright or Node REPL
    Steps:
      1. Call formatTimestamp("2026-04-17 10:00:00")
      2. Assert output contains "17 Apr 2026" or similar Jakarta-local date
    Expected Result: Date is rendered in Jakarta timezone
    Evidence: .sisyphus/evidence/task-t9-frontend-time.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T10. **Update admin frontend date handling**

  **What to do**:
  - In `public/admin/app.js`:
    - Update `isEventDate(value)` if needed (the current `new Date(\`${value}T00:00:00.000Z\`)` validation is still functionally correct for validating a YYYY-MM-DD string; can be kept or simplified)
    - Ensure `normalizeDateFilter` and `buildDateRangeSearch` continue to work with YYYY-MM-DD strings
    - If the backend returns `dateFilter` with yesterday→tomorrow defaults, the frontend should accept and display them without modification
  - Minimal changes expected; mostly verify compatibility

  **Must NOT do**:
  - Do not add complex frontend date math

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9, T11-T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T7

  **References**:
  - `public/admin/app.js:200-212` - isEventDate
  - `public/admin/app.js:66-120` - loadRecords

  **Acceptance Criteria**:
  - [ ] Admin page DOM tests pass
  - [ ] Admin page app tests pass

  **QA Scenarios**:
  ```
  Scenario: Admin date inputs accept backend defaults
    Tool: Playwright
    Steps:
      1. Load admin page
      2. Assert startDate and endDate inputs are populated with yesterday/tomorrow
    Expected Result: Inputs show correct default range
    Evidence: .sisyphus/evidence/task-t10-admin-dates.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T11. **Update unit tests for Jakarta time**

  **What to do**:
  - In `test/unit/calendar-day-semantics.test.ts`:
    - Replace UTC boundary tests with Jakarta boundary tests
    - Test that `2026-01-15T16:59:59Z` → `"2026-01-15"` (23:59:59 Jakarta)
    - Test that `2026-01-15T17:00:00Z` → `"2026-01-16"` (00:00:00 Jakarta)
    - Test `getCurrentJakartaDate()` with mocked times
  - In `test/unit/calendar-day-backfill.test.ts` (if exists):
    - Update to use Jakarta day derivation
  - Add a unit test asserting `scanned_at.slice(0, 10)` matches the Jakarta date

  **Must NOT do**:
  - Do not keep UTC-specific assertions

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9, T10, T12-T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T3, T8

  **References**:
  - `test/unit/calendar-day-semantics.test.ts`
  - `test/unit/calendar-day-backfill.test.ts` (check existence)

  **Acceptance Criteria**:
  - [ ] Unit tests reflect Jakarta midnight boundary (`17:00:00Z`)
  - [ ] `npm test -- test/unit/` passes

  **QA Scenarios**:
  ```
  Scenario: Unit tests pass
    Tool: Bash
    Steps:
      1. Run `npm test -- test/unit/`
    Expected Result: All pass
    Evidence: .sisyphus/evidence/task-t11-unit-tests.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T12. **Update student-api integration tests**

  **What to do**:
  - In `test/integration/student-api.test.ts`:
    - Remove `EVENT_DATE` from `createEnv`
    - Update `vi.setSystemTime` calls to use Jakarta-relevant boundary times
    - Update assertions about `eventDate` to match Jakarta day
    - Update scan timestamp assertions to expect `YYYY-MM-DD HH:mm:ss`
  - Ensure duplicate-scan test covers Jakarta day boundary

  **Must NOT do**:
  - Do not change API endpoint paths or request shapes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9-T11, T13-T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T4, T5

  **References**:
  - `test/integration/student-api.test.ts`

  **Acceptance Criteria**:
  - [ ] `npm test -- test/integration/student-api.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Student API tests pass
    Tool: Bash
    Steps:
      1. Run `npm test -- test/integration/student-api.test.ts`
    Expected Result: All pass
    Evidence: .sisyphus/evidence/task-t12-student-api.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T13. **Update mentor-api integration tests**

  **What to do**:
  - In `test/integration/mentor-api.test.ts`:
    - Remove `EVENT_DATE` from `createEnv` and all overrides
    - Update frozen times to Jakarta-relevant boundaries
    - Update assertions about recent-scans day filtering
    - Update notes updated_at assertions to expect Indonesia timestamp format

  **Must NOT do**:
  - Do not change API endpoint paths

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9-T12, T14-T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T6

  **References**:
  - `test/integration/mentor-api.test.ts`

  **Acceptance Criteria**:
  - [ ] `npm test -- test/integration/mentor-api.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Mentor API tests pass
    Tool: Bash
    Steps:
      1. Run `npm test -- test/integration/mentor-api.test.ts`
    Expected Result: All pass
    Evidence: .sisyphus/evidence/task-t13-mentor-api.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T14. **Update admin-api integration tests**

  **What to do**:
  - In `test/integration/admin-api.test.ts`:
    - Remove `EVENT_DATE` from `createEnv`
    - Update test names that mention "UTC day" to "Jakarta day"
    - Update fallback assertions: default range should be yesterday→tomorrow, not single day
    - Update `withFrozenTime` timestamps to Jakarta-relevant times
    - Update CSV filename assertions

  **Must NOT do**:
  - Do not change CSV column assertions

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9-T13, T15)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T7

  **References**:
  - `test/integration/admin-api.test.ts`

  **Acceptance Criteria**:
  - [ ] `npm test -- test/integration/admin-api.test.ts` passes

  **QA Scenarios**:
  ```
  Scenario: Admin API tests pass
    Tool: Bash
    Steps:
      1. Run `npm test -- test/integration/admin-api.test.ts`
    Expected Result: All pass
    Evidence: .sisyphus/evidence/task-t14-admin-api.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T15. **Update e2e seed data**

  **What to do**:
  - In `seed/e2e-admin.sql`:
    - Update `scanned_at` and `updated_at` values from UTC ISO strings to `YYYY-MM-DD HH:mm:ss` in Jakarta time
    - Ensure `event_date` values still align with the Jakarta day of those timestamps
  - Check other seed files (`seed/dev.sql` etc.) and apply the same conversion

  **Must NOT do**:
  - Do not change `event_date` column format

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9-T14)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T3

  **References**:
  - `seed/e2e-admin.sql`
  - `seed/dev.sql`

  **Acceptance Criteria**:
  - [ ] Seed files use `YYYY-MM-DD HH:mm:ss` for timestamp columns
  - [ ] `event_date` values align with Jakarta day of those timestamps

  **QA Scenarios**:
  ```
  Scenario: Seed data is valid
    Tool: Bash (grep)
    Steps:
      1. Search seed SQL for UTC Z timestamps
      2. Assert none remain
    Expected Result: No Z-timestamp strings in seed files
    Evidence: .sisyphus/evidence/task-t15-seed.txt
  ```

  **Commit**: YES (group with Wave 3)

- [ ] T16. **Run graphify update**

  **What to do**:
  - Execute `graphify update .` from the project root to refresh the knowledge graph after all code changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: T1-T15

  **Acceptance Criteria**:
  - [ ] `graphify update .` completes successfully

  **QA Scenarios**:
  ```
  Scenario: Graphify updated
    Tool: Bash
    Steps:
      1. Run `graphify update .`
    Expected Result: Exit code 0
    Evidence: .sisyphus/evidence/task-t16-graphify.txt
  ```

  **Commit**: NO ( tooling artifact)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `npm test` + `npm run lint` if available. Review all changed files for `as any`, empty catches, `console.log`, commented-out code, unused imports, AI slop patterns.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy
- Group commits by wave or by logical concern
- Example messages:
  - `fix(admin): add missing button IDs and text labels`
  - `feat(time): add Jakarta time helpers and remove EVENT_DATE`
  - `refactor(routes): switch student/mentor/admin to Jakarta day`
  - `test(time): update tests for GMT+7 boundaries`

---

## Success Criteria

### Verification Commands
```bash
npm test                    # Expected: all pass
npm run typecheck           # Expected: 0 errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Admin panel shows records without JS errors
- [ ] No EVENT_DATE references remain in source/tests/docs
