# Graph Report - .  (2026-04-17)

## Corpus Check
- Corpus is ~48,501 words - fits in a single context window. You may not need a graph.

## Summary
- 344 nodes · 687 edges · 34 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 144 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `e` - 37 edges
2. `json()` - 25 edges
3. `handleAdminApi()` - 21 edges
4. `handleStudentApi()` - 16 edges
5. `loadRecords()` - 14 edges
6. `startScanner()` - 13 edges
7. `handleMentorApi()` - 13 edges
8. `loadMentorIdentity()` - 11 edges
9. `loadIdentity()` - 11 edges
10. `handleScanDecoded()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `handleAdminApi()` --calls--> `listAdminExportRows()`  [INFERRED]
  src\worker\routes\admin.ts → src\worker\db\admin-records.ts
- `expectLatestAdminRecord()` --calls--> `json()`  [INFERRED]
  test\integration\admin-api.test.ts → src\worker\services\http.ts
- `Student Page Full UI` --references--> `Student Role`  [EXTRACTED]
  student-page-full.png → README.md
- `Mobile-First Student Design` --rationale_for--> `Student Page Mobile UI`  [INFERRED]
  AGENTS.md → student-mobile-redesign.png
- `Sequential Student Flow` --rationale_for--> `Student Page Mobile UI`  [INFERRED]
  AGENTS.md → student-mobile-redesign.png

## Hyperedges (group relationships)
- **Three-Role QR Attendance System** — student_role, mentor_role, admin_role [EXTRACTED 1.00]
- **API Surface** — student_apis, mentor_apis, admin_apis [EXTRACTED 1.00]
- **Implementation Phases** — phase_1_scaffolding, phase_2_student_flow, phase_3_mentor_flow, phase_4_admin_flow, phase_5_hardening [EXTRACTED 1.00]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (33): handleAdminApi(), handleAdminPage(), isAuthorizedAdminSecret(), isPatchPayloadRecord(), parseAdminRecordPatchPayload(), resolveAdminDateRange(), serializeAdminExportCsv(), getConfiguredEventDate() (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (1): e

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (27): applyRecentScanItemState(), cleanup(), findRecentScan(), formatTimestamp(), getResponseErrorMessage(), hideScanFeedback(), loadHistory(), loadIdentity() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (33): Absen QR System, Admin APIs, Admin Page UI, Admin Role, Cloudflare Workers + D1, CSV Export, Duplicate Scan Prevention, Implementation Plan v1 (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.2
Nodes (28): buildScanError(), createScanError(), destroyScanner(), getPayloadMessage(), handleScanDecoded(), handleScanDecodeError(), isCameraUnavailableError(), isPermissionDeniedError() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (25): buildApplySql(), buildArtifact(), buildCanonicalRoster(), buildProductionLink(), countTokenChanges(), createPersonIdentity(), defaultRunCommand(), executeLoggedCommand() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (25): buildDateRangeSearch(), buildExportUrl(), buildPatchPayload(), buildRecordsUrl(), deleteRecord(), handleApplyFilters(), handleExport(), isEventDate() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (9): createAdminDom(), createDocument(), FakeClassList, FakeElement, loadAdminPageApp(), createRecentScanItem(), createRecordRow(), populateSelect() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (11): createAdminMockDatabase(), createAdminMockDatabase(), applyAdminScanRecordUpdate(), buildAdminJoinedRow(), cloneState(), createMockD1Database(), createStatement(), extractPlaceholderIndex() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (10): deleteAdminRecord(), findAdminRecordById(), getAdminRecordsPayload(), listAdminExportRows(), listAdminMentorOptions(), listAdminRecords(), listAdminStudentOptions(), mapAdminRecord() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (6): createAssetFetcher(), createEnv(), expectLatestAdminRecord(), expectRecordsAndExportToBeEmpty(), expectRecordsAndExportToReflectLatestValues(), fetchAdminApi()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (2): makeJsonResult(), runCommand()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (2): createAssetFetcher(), createEnv()

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (2): createAssetFetcher(), createEnv()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): createAssetFetcher(), createEnv()

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (1): QRCode

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (1): Phase 5 Hardening

## Knowledge Gaps
- **18 isolated node(s):** `QRCode`, `Duplicate Scan Prevention`, `Secret-Link Access`, `Student APIs`, `Mentor APIs` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (2 nodes): `qr-scanner-worker.min.js`, `createWorker()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (2 nodes): `QRCode`, `qrcode-svg.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (2 nodes): `handleRootRoute()`, `root.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `runWranglerCommand()`, `admin.setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `countMatches()`, `admin-page-dom.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `playwright.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `admin-page-app.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `admin-flow.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `mentor-page-dom.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `student-page-dom.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `real-roster.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `calendar-day-backfill.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `calendar-day-semantics.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `mentor-qr.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `mock-d1.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `Phase 5 Hardening`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.