# Graph Report - absen-qr  (2026-06-09)

## Corpus Check
- 89 files · ~135,646 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1419 nodes · 2490 edges · 68 communities (62 shown, 6 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 167 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae118e92`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]

## God Nodes (most connected - your core abstractions)
1. `e` - 37 edges
2. `e` - 37 edges
3. `json()` - 28 edges
4. `handleAdminApi()` - 22 edges
5. `handleStudentApi()` - 21 edges
6. `handleAdminApi()` - 21 edges
7. `handleMentorApi()` - 19 edges
8. `handleStudentApi()` - 18 edges
9. `Implementation Plan: scan_records Schema Migration` - 17 edges
10. `handleMentorApi()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `json()` --calls--> `expectLatestAdminRecord()`  [INFERRED]
  src/worker/services/http.ts → test/integration/admin-api.test.ts
- `Student Role` --references--> `Student Page Full UI`  [EXTRACTED]
  README.md → student-page-full.png
- `Mobile-First Student Design` --rationale_for--> `Student Page Mobile UI`  [INFERRED]
  AGENTS.md → student-mobile-redesign.png
- `Sequential Student Flow` --rationale_for--> `Student Page Mobile UI`  [INFERRED]
  AGENTS.md → student-mobile-redesign.png
- `Restrained Accent Colors` --rationale_for--> `Student Page Mobile UI`  [INFERRED]
  AGENTS.md → student-mobile-redesign.png

## Hyperedges (group relationships)
- **Three-Role QR Attendance System** — student_role, mentor_role, admin_role [EXTRACTED 1.00]
- **API Surface** — student_apis, mentor_apis, admin_apis [EXTRACTED 1.00]
- **Implementation Phases** — phase_1_scaffolding, phase_2_student_flow, phase_3_mentor_flow, phase_4_admin_flow, phase_5_hardening [EXTRACTED 1.00]

## Communities (68 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (24): handleAdminApi(), handleAdminPage(), isAuthorizedAdminSecret(), isPatchPayloadRecord(), parseAdminRecordPatchPayload(), serializeAdminExportCsv(), consumeFallbackCode(), badRequest() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (67): buildDateRangeSearch(), buildExportUrl(), buildPatchPayload(), buildRecordsUrl(), compareRecordsByRecentScan(), createRecordRow(), deleteRecord(), formatEventDate() (+59 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (89): applyRecentScanItemState(), cleanup(), findRecentScan(), formatTimestamp(), generateFallbackCode(), getResponseErrorMessage(), hideScanFeedback(), loadFallbackCodeState() (+81 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (82): buildFallbackError(), buildScanError(), createScanError(), getPayloadMessage(), handleScanDecoded(), handleScanDecodeError(), hideFallbackForm(), isCameraUnavailableError() (+74 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (33): Absen QR System, Admin APIs, Admin Page UI, Admin Role, Cloudflare Workers + D1, CSV Export, Duplicate Scan Prevention, Implementation Plan v1 (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (56): buildApplySql(), buildArtifact(), buildCanonicalRoster(), buildProductionLink(), countTokenChanges(), createPersonIdentity(), defaultRunCommand(), executeLoggedCommand() (+48 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (37): applyAdminScanRecordUpdate(), applyFallbackCodeUpdate(), buildAdminJoinedRow(), cloneFallbackCode(), cloneFallbackCodeState(), createStatement(), extractPlaceholderIndex(), extractSetAssignments() (+29 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (34): buildAdminRecordSelectQuery(), deleteAdminRecord(), findAdminRecordById(), getAdminRecordsPayload(), isMissingScanRecordsEntryMethodColumnError(), listAdminExportRows(), listAdminMentorOptions(), listAdminRecords() (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (15): createAssetFetcher(), createEnv(), expectLatestAdminRecord(), expectRecordsAndExportToBeEmpty(), expectRecordsAndExportToReflectLatestValues(), fetchAdminApi(), createAssetFetcher(), createEnv() (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (10): createAdminDom(), createDocument(), FakeClassList, loadAdminPageApp(), createAdminDom(), createDocument(), FakeClassList, FakeElement (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (10): makeJsonResult(), runCommand(), REAL_ROSTER, ImportUsersModule, makeJsonResult(), ParsedUserRow, RemotePeopleRow, runCommand() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.20
Nodes (9): createAssetFetcher(), createEnv(), FetchHandler, MockEnv, WorkerContext, WorkerEnv, WorkerRequest, createAssetFetcher() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.28
Nodes (8): createAssetFetcher(), createEnv(), FetchHandler, WorkerContext, WorkerEnv, WorkerRequest, createAssetFetcher(), createEnv()

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (9): createAssetFetcher(), createEnv(), FetchHandler, WorkerContext, WorkerEnv, WorkerRequest, resetFallbackCodeThrottle(), createAssetFetcher() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.50
Nodes (3): QRCode, QRCode, QRCodeOptions

### Community 17 - "Community 17"
Cohesion: 0.21
Nodes (9): handleRootRoute(), worker, ApiRouteMatch, Env, PageRouteMatch, Role, ROLE_VALUES, ScanRecord (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.05
Nodes (74): __INTERNAL_WRANGLER_MIDDLEWARE__, __Facade_ScheduledController__, wrapExportedHandler(), wrapWorkerEntrypoint(), badRequest(), buildAdminRecordSelectQuery(), checkThrottle(), conflict() (+66 more)

### Community 24 - "Community 24"
Cohesion: 0.04
Nodes (46): 1. Live mentor updates, 2. Secret-link misuse, 3. Data correction complexity, 4. Duplicate-scan enforcement, Admin APIs, Admin Page, API Surface, Architecture Overview (+38 more)

### Community 28 - "Community 28"
Cohesion: 0.26
Nodes (11): listAdminExportRows(), auditAndBackfillEventDates(), createMockD1Database(), readMockD1State(), REAL_MENTORS, REAL_MENTORS_BY_NAME, REAL_STUDENTS, REAL_STUDENTS_BY_NAME (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.04
Nodes (46): 1. QR Payload Parser (`src/worker/services/qr-payload.ts`), 2. Shared Scan Service (`src/worker/services/scan-submission.ts`), 3. Student Route (`src/worker/routes/student.ts`), 4. Mentor Route (`src/worker/routes/mentor.ts`), 5. Student Frontend (`public/student/`), 6. Mentor Frontend (`public/mentor/`), `app.js` changes:, `app.js` changes: (+38 more)

### Community 30 - "Community 30"
Cohesion: 0.24
Nodes (8): resolveAdminDateRange(), getConfiguredEventDate(), getCurrentUtcDate(), getUtcDayKey(), isEventDate(), getCurrentUtcDate(), getUtcDayKey(), isEventDate()

### Community 31 - "Community 31"
Cohesion: 0.05
Nodes (41): 10. Rollback Plan, 1. File Inventory, 2. Migration SQL, 3. Type Changes, 4. DB Query Rewrites, 5. Service & Route Changes, 6. Frontend Changes, 7. Test Updates (+33 more)

### Community 32 - "Community 32"
Cohesion: 0.05
Nodes (41): people, scan_records, base_url, commands, contract_version, d1, binding, config_path (+33 more)

### Community 35 - "Community 35"
Cohesion: 0.06
Nodes (32): 1. Role-specific secret-link entry points, 2. Student QR scan flow, 3. Student same-day history, 4. Mentor QR display and immediate live note entry, 5. Admin transaction log, 6. Admin CSV export, 7. Admin manual correction, 8. Stable identity model (+24 more)

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (14): createDocument(), createQrScannerMock(), createSessionStorage(), createStudentDom(), executeStudentPageApp(), FakeClassList, FakeElement, flushMicrotasks() (+6 more)

### Community 37 - "Community 37"
Cohesion: 0.07
Nodes (27): Absen QR - Mentor-Student QR Attendance System, Admin Flow, API Endpoints, Architecture, Configuration, Constraints, Contributing, D1 Database Binding (+19 more)

### Community 38 - "Community 38"
Cohesion: 0.07
Nodes (26): dependencies, csv-parse, qrcode-svg, @types/bun, devDependencies, @cloudflare/workers-types, @playwright/test, @types/node (+18 more)

### Community 39 - "Community 39"
Cohesion: 0.08
Nodes (24): 1. Database Migration (`migrations/0004_directional_scan_records.sql`), 2. Types (`src/worker/types.ts`), 3. DB Layer (`src/worker/db/scan-records.ts`), 4. Admin DB Layer (`src/worker/db/admin-records.ts`), 5. Scan Submission Service (`src/worker/services/scan-submission.ts`), 6. Routes (`src/worker/routes/student.ts`, `mentor.ts`, `admin.ts`), 7. Mock D1 (`test/support/mock-d1.ts`), 8. Tests (+16 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (23): API Changes, Approach, Architecture, Backend, Backend, Components, Constraints, Data Flow (+15 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (16): consumeFallbackCode(), getFallbackCodeByValue(), findPersonById(), findPersonBySecretToken(), createScanRecord(), findScanRecordByPairAndDate(), findPersonById(), findPersonBySecretToken() (+8 more)

### Community 42 - "Community 42"
Cohesion: 0.09
Nodes (22): admin.ts, Files NOT to Modify, Files to Modify (22 files), Goal, Implementation Plan: scan_records Schema Migration, Integration Tests, mentor.ts, Risk Mitigation (+14 more)

### Community 43 - "Community 43"
Cohesion: 0.19
Nodes (18): AdminRecordPatchPayload, handleAdminApi(), handleAdminPage(), isAuthorizedAdminSecret(), isPatchPayloadRecord(), parseAdminRecordPatchPayload(), resolveAdminDateRange(), serializeAdminExportCsv() (+10 more)

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (20): API Routes, Approach, Architecture, Backend Services, Components, Constraints, Data Flow, Error Handling Strategy (+12 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (18): Alternatives Considered, API Changes, Architecture, Backend, Chosen Approach: Generalized Directed Scan Edge, Components, Constraints, Data Flow (+10 more)

### Community 46 - "Community 46"
Cohesion: 0.16
Nodes (11): BackfillCollision, BackfillResult, CreateScanRecordInput, findScanRecordById(), isDuplicateScanRecordError(), listPersonHistory(), updateScanRecordNotes(), handleMentorApi() (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.13
Nodes (14): Blocked, Constraints & Preferences, Critical Context, Done, File Operations, Goal, In Progress, Key Decisions (+6 more)

### Community 48 - "Community 48"
Cohesion: 0.14
Nodes (13): compilerOptions, allowJs, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, noEmit (+5 more)

### Community 49 - "Community 49"
Cohesion: 0.14
Nodes (13): Blocked, Constraints & Preferences, Critical Context, Done, File Operations, Goal, In Progress, Key Decisions (+5 more)

### Community 50 - "Community 50"
Cohesion: 0.14
Nodes (13): Blocked, Constraints & Preferences, Critical Context, Done, File Operations, Goal, In Progress, Key Decisions (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.14
Nodes (13): Blocked, Constraints & Preferences, Critical Context, Done, File Operations, Goal, In Progress, Key Decisions (+5 more)

### Community 52 - "Community 52"
Cohesion: 0.24
Nodes (6): createFallbackCode(), getActiveFallbackCodeForMentor(), MentorFallbackCodeRecord, createFallbackCode(), getActiveFallbackCodeForMentor(), renderQrSvg()

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (5): graphify, Project documentation first, Source of truth, Student-page design language, Working rules for agents

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (3): ASSETS, LocalD1Database, localEnv

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (5): edges, hyperedges, input_tokens, nodes, output_tokens

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (5): created_at, query, row_count, rows, table

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (5): created_at, query, row_count, rows, table

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (4): args, csvPath, escapedNameForSql, slugifiedName

### Community 59 - "Community 59"
Cohesion: 0.40
Nodes (4): Implementation Plans, Notes, Product Requirements Documents, Project Documentation

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): edges, hyperedges, nodes

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (4): createAdminMockDatabase(), createAdminMockDatabase(), cloneState(), createMockD1Database()

## Knowledge Gaps
- **472 isolated node(s):** `nodes`, `edges`, `hyperedges`, `nodes`, `edges` (+467 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `json()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 9`, `Community 43`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `handleMentorApi()` connect `Community 0` to `Community 6`, `Community 41`, `Community 46`, `Community 52`, `Community 30`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Why does `e` connect `Community 3` to `Community 34`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `json()` (e.g. with `handleAdminApi()` and `deleteRecord()`) actually correct?**
  _`json()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **What connects `nodes`, `edges`, `hyperedges` to the rest of the system?**
  _472 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.060939060939060936 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05322953923837576 - nodes in this community are weakly interconnected._