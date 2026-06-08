import QrScanner from '/vendor/qr-scanner/qr-scanner.min.js';

const POLL_INTERVAL_MS = 10_000;
const COPY_RESET_MS = 1_500;

(function () {
  const elements = {
    status: document.getElementById("status-banner"),
    mentorSuccess: document.getElementById("mentor-success"),
    mentorError: document.getElementById("mentor-error"),
    mentorName: document.getElementById("mentor-name"),
    mentorMeta: document.getElementById("mentor-meta"),
    mentorErrorMessage: document.getElementById("mentor-error-message"),
    retryButton: document.getElementById("retry-button"),
    qrDisplay: document.getElementById("qr-display"),
    qrCopy: document.getElementById("qr-copy"),
    fallbackCodeCard: document.getElementById("fallback-code-card"),
    fallbackGenerateBtn: document.getElementById("fallback-generate-btn"),
    fallbackCodeDisplay: document.getElementById("fallback-code-display"),
    fallbackCountdown: document.getElementById("fallback-countdown"),
    fallbackHelper: document.getElementById("fallback-helper"),
    fallbackError: document.getElementById("fallback-error"),
    recentScansEmpty: document.getElementById("recent-scans-empty"),
    recentScansError: document.getElementById("recent-scans-error"),
    recentScansErrorMessage: document.getElementById("recent-scans-error-message"),
    recentScansList: document.getElementById("recent-scans-list"),
    recentScansRetryButton: document.getElementById("recent-scans-retry-button"),
    modeToggle: document.getElementById("mode-toggle"),
    modeScanBtn: document.getElementById("mode-scan"),
    modeShowBtn: document.getElementById("mode-show"),
    qrView: document.getElementById("qr-view"),
    scannerView: document.getElementById("scanner-view"),
    scannerStage: document.getElementById("scanner-stage"),
    scannerVideo: document.getElementById("scanner-video"),
    scannerPlaceholder: document.getElementById("scanner-placeholder"),
    scannerPlaceholderTitle: document.getElementById("scanner-placeholder-title"),
    scannerPlaceholderCopy: document.getElementById("scanner-placeholder-copy"),
    scannerFeedback: document.getElementById("scanner-feedback"),
    scannerFeedbackTitle: document.getElementById("scanner-feedback-title"),
    scannerFeedbackCopy: document.getElementById("scanner-feedback-copy"),
    scannerToggleButton: document.getElementById("scanner-toggle-button"),
    scannerPermissionRetryButton: document.getElementById("scanner-permission-retry-button"),
    scannerStatus: document.getElementById("scanner-status"),
    helpButton: document.getElementById("help-button"),
    helpModal: document.getElementById("help-modal"),
    helpModalClose: document.getElementById("help-modal-close"),
  };

  const mentorPath = getMentorPath();
  const state = {
    mentor: null,
    recentScans: [],
    recentScansLoaded: false,
    recentScansFetchId: 0,
    pollTimer: null,
    copyResetTimer: null,
    scanItems: new Map(),
    fallbackCode: null,
    fallbackExpiresAt: null,
    fallbackCountdownTimer: null,
  };
  const draftNotes = new Map();
  const scanMessages = new Map();
  const savingScanIds = new Set();
  const editingScanIds = new Set();

  let currentMode = "show"; // 'scan' or 'show'
  let qrScanner = null;
  let scannerAvailability = "unknown";
  let scannerActive = false;
  let scannerStarting = false;
  let scannerProcessing = false;
  let scanHandled = false;

  if (!mentorPath) {
    showIdentityError("Invalid mentor link. Open this page from a /mentor/:secretToken URL.");
    return;
  }

  elements.retryButton.addEventListener("click", () => {
    void loadMentorIdentity();
  });
  elements.recentScansRetryButton.addEventListener("click", () => {
    void loadRecentScans({ showLoading: !state.recentScansLoaded });
  });

  elements.fallbackGenerateBtn.addEventListener("click", () => {
    void generateFallbackCode();
  });

  if (elements.modeScanBtn) {
    elements.modeScanBtn.addEventListener("click", () => switchMode("scan"));
  }
  if (elements.modeShowBtn) {
    elements.modeShowBtn.addEventListener("click", () => switchMode("show"));
  }
  if (elements.scannerToggleButton) {
    elements.scannerToggleButton.addEventListener("click", toggleScanner);
  }
  if (elements.scannerPermissionRetryButton) {
    elements.scannerPermissionRetryButton.addEventListener("click", startScanner);
  }

  window.addEventListener("pagehide", cleanup);

  if (elements.helpButton && elements.helpModal && elements.helpModalClose) {
    elements.helpButton.addEventListener("click", () => {
      elements.helpModal.classList.remove("hidden");
    });
    elements.helpModalClose.addEventListener("click", () => {
      elements.helpModal.classList.add("hidden");
    });
    elements.helpModal.addEventListener("click", (e) => {
      if (e.target === elements.helpModal) {
        elements.helpModal.classList.add("hidden");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !elements.helpModal.classList.contains("hidden")) {
        elements.helpModal.classList.add("hidden");
      }
    });
  }

  resetPageState();
  void loadMentorIdentity();

  function getMentorPath() {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const mentorIndex = segments.indexOf("mentor");

    if (mentorIndex === -1 || !segments[mentorIndex + 1]) {
      return "";
    }

    return `/mentor/${segments[mentorIndex + 1]}`;
  }

  function cleanup() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = null;
    }

    if (state.copyResetTimer) {
      window.clearTimeout(state.copyResetTimer);
      state.copyResetTimer = null;
    }

    if (state.fallbackCountdownTimer) {
      window.clearInterval(state.fallbackCountdownTimer);
      state.fallbackCountdownTimer = null;
    }

    if (qrScanner) {
      try {
        qrScanner.destroy();
      } catch (e) { }
      qrScanner = null;
    }
  }

  function resetPageState() {
    elements.status.textContent = "Loading mentor identity…";
    elements.status.className = "status status-loading";
    elements.mentorSuccess.classList.add("hidden");
    elements.mentorError.classList.add("hidden");

    elements.qrDisplay.classList.add("hidden");
    elements.qrDisplay.replaceChildren();
    elements.qrCopy.classList.add("hidden");
    elements.qrCopy.disabled = true;
    elements.qrCopy.textContent = "Copy QR payload";

    elements.fallbackCodeCard.classList.add("hidden");
    elements.fallbackCodeDisplay.classList.add("hidden");
    elements.fallbackGenerateBtn.classList.add("hidden");
    elements.fallbackHelper.textContent = "";
    elements.fallbackError.textContent = "";
    elements.fallbackError.classList.add("hidden");
    elements.fallbackCountdown.textContent = "";

    elements.recentScansEmpty.classList.add("hidden");
    elements.recentScansError.classList.add("hidden");
    elements.recentScansList.classList.add("hidden");
    elements.recentScansList.replaceChildren();

    state.recentScans = [];
    state.recentScansLoaded = false;
    state.scanItems = new Map();
    state.fallbackCode = null;
    state.fallbackExpiresAt = null;
    draftNotes.clear();
    scanMessages.clear();
    savingScanIds.clear();
    editingScanIds.clear();
  }

  async function loadMentorIdentity() {
    cleanup();
    resetPageState();

    try {
      const response = await fetch(`${mentorPath}/api/me`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, `Identity request failed with status ${response.status}.`));
      }

      const payload = await response.json();
      const mentor = normalizeMentor(payload);

      if (!mentor) {
        throw new Error("Identity response did not include a mentor profile.");
      }

      state.mentor = mentor;
      renderMentorIdentity(mentor);
      renderQrCode(mentor);
      await loadFallbackCodeState();
      await loadRecentScans({ showLoading: true });
      startPollingRecentScans();
    } catch (error) {
      state.mentor = null;
      showIdentityError(error instanceof Error ? error.message : "Identity request failed.");
    }
  }

  async function loadRecentScans({ showLoading = false } = {}) {
    if (!state.mentor) {
      return;
    }

    const fetchId = state.recentScansFetchId + 1;
    state.recentScansFetchId = fetchId;

    if (showLoading && !state.recentScansLoaded) {
      elements.status.textContent = "Loading recent scans…";
      elements.status.className = "status status-loading";
      elements.recentScansError.classList.add("hidden");
      elements.recentScansEmpty.classList.add("hidden");
      elements.recentScansList.classList.add("hidden");
    }

    try {
      const response = await fetch(`${mentorPath}/api/recent-scans`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, `Recent scans request failed with status ${response.status}.`));
      }

      const payload = await response.json();
      if (fetchId !== state.recentScansFetchId) {
        return;
      }

      state.recentScans = normalizeRecentScans(payload).sort((left, right) => {
        return toTimestamp(right.scannedAt) - toTimestamp(left.scannedAt);
      });
      state.recentScansLoaded = true;
      renderRecentScans(state.recentScans);
    } catch (error) {
      if (fetchId !== state.recentScansFetchId) {
        return;
      }

      showRecentScansError(error instanceof Error ? error.message : "Recent scans request failed.");
    }
  }

  function startPollingRecentScans() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
    }

    state.pollTimer = window.setInterval(() => {
      void loadRecentScans({ showLoading: false });
    }, POLL_INTERVAL_MS);
  }

  async function loadFallbackCodeState() {
    if (!state.mentor) {
      return;
    }

    try {
      const response = await fetch(`${mentorPath}/api/fallback-code`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();

      if (payload.hasActiveCode) {
        state.fallbackCode = payload.code;
        state.fallbackExpiresAt = payload.expiresAt;
        renderFallbackCode(payload.code, payload.expiresAt);
        startFallbackCountdown();
      } else {
        renderFallbackCodeEmpty();
      }
    } catch {
      // Silent fail - fallback is optional.
    }
  }

  function renderFallbackCode(code, expiresAt) {
    elements.fallbackCodeCard.classList.remove("hidden");
    elements.fallbackCodeDisplay.classList.remove("hidden");
    elements.fallbackGenerateBtn.classList.add("hidden");
    elements.fallbackHelper.textContent = "A new code can be generated after this one expires.";
    elements.fallbackHelper.classList.remove("hidden");
    elements.fallbackError.classList.add("hidden");

    const codeEl = elements.fallbackCodeDisplay.querySelector(".fallback-code-value");
    if (codeEl) {
      codeEl.textContent = code;
    }
  }

  function renderFallbackCodeEmpty() {
    elements.fallbackCodeCard.classList.remove("hidden");
    elements.fallbackCodeDisplay.classList.add("hidden");
    elements.fallbackGenerateBtn.classList.remove("hidden");
    elements.fallbackHelper.textContent = "";
    elements.fallbackHelper.classList.add("hidden");
    elements.fallbackError.classList.add("hidden");
    elements.fallbackCountdown.textContent = "";
  }

  function startFallbackCountdown() {
    if (state.fallbackCountdownTimer) {
      window.clearInterval(state.fallbackCountdownTimer);
    }

    state.fallbackCountdownTimer = window.setInterval(() => {
      updateFallbackCountdown();
    }, 1000);
  }

  function updateFallbackCountdown() {
    if (!state.fallbackExpiresAt) {
      return;
    }

    const expires = new Date(state.fallbackExpiresAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expires - now) / 1000));

    if (remaining <= 0) {
      if (state.fallbackCountdownTimer) {
        window.clearInterval(state.fallbackCountdownTimer);
        state.fallbackCountdownTimer = null;
      }

      void loadFallbackCodeState();
      return;
    }

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    elements.fallbackCountdown.textContent = `${minutes}m ${seconds}s remaining`;
  }

  async function generateFallbackCode() {
    if (!state.mentor) {
      return;
    }

    elements.fallbackGenerateBtn.disabled = true;
    elements.fallbackGenerateBtn.textContent = "Generating…";
    elements.fallbackError.classList.add("hidden");

    try {
      const response = await fetch(`${mentorPath}/api/fallback-code`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 409) {
          elements.fallbackError.textContent = "Active fallback code already exists.";
          elements.fallbackError.classList.remove("hidden");
          elements.fallbackGenerateBtn.disabled = false;
          elements.fallbackGenerateBtn.textContent = "Generate one-time code";
          return;
        }

        throw new Error(await getResponseErrorMessage(response, `Generate failed with status ${response.status}.`));
      }

      const payload = await response.json();

      state.fallbackCode = payload.code;
      state.fallbackExpiresAt = payload.expiresAt;
      renderFallbackCode(payload.code, payload.expiresAt);
      startFallbackCountdown();
    } catch (error) {
      elements.fallbackError.textContent = error instanceof Error ? error.message : "Failed to generate code.";
      elements.fallbackError.classList.remove("hidden");
      elements.fallbackGenerateBtn.disabled = false;
      elements.fallbackGenerateBtn.textContent = "Generate one-time code";
    }
  }

  function normalizeMentor(payload) {
    const candidate = payload?.mentor || payload?.identity || payload?.person || payload;

    if (!candidate) {
      return null;
    }

    const displayName = candidate.displayName || candidate.display_name || candidate.name || candidate.fullName;
    const secretId = candidate.secretId || candidate.secret_id || candidate.id || candidate.mentorId || candidate.personId;
    const personId = candidate.personId || candidate.person_id || candidate.id || candidate.mentorId || candidate.secretId;
    const qrPayload = payload?.qrPayload || candidate.qrPayload || "";
    const qrSvg = payload?.qrSvg || candidate.qrSvg || "";

    if (!displayName || !qrSvg) {
      return null;
    }

    return {
      displayName,
      secretId: secretId || "Unknown secret id",
      personId: personId || "Unknown person id",
      qrPayload,
      qrSvg,
    };
  }

  function normalizeRecentScans(payload) {
    const source = Array.isArray(payload)
      ? payload
      : payload?.recentScans || payload?.scans || payload?.records || [];

    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((entry) => ({
        scanId: entry.scanId || entry.scan_id || "",
        studentName: entry.studentName || entry.student_name || entry.displayName || entry.display_name || entry.name || "Student",
        scannedAt: entry.scannedAt || entry.scanned_at || entry.updatedAt || entry.updated_at || "",
        notes: typeof entry.notes === "string" ? entry.notes : "",
      }))
      .filter((entry) => entry.scanId);
  }

  function renderMentorIdentity(mentor) {
    elements.mentorError.classList.add("hidden");
    elements.mentorSuccess.classList.remove("hidden");
    elements.mentorName.textContent = mentor.displayName;
    // elements.mentorMeta.textContent = `Secret id: ${mentor.secretId} · Person id: ${mentor.personId}`;
    document.title = `${mentor.displayName} • Mentor attendance`;
  }

  function renderQrCode(mentor) {
    elements.qrDisplay.innerHTML = mentor.qrSvg;
    elements.qrDisplay.classList.remove("hidden");
    elements.qrCopy.classList.remove("hidden");
    elements.qrCopy.disabled = !mentor.qrPayload;
    elements.qrCopy.textContent = mentor.qrPayload ? "Copy QR payload" : "QR payload unavailable";
  }

  function renderRecentScans(scans) {
    elements.recentScansError.classList.add("hidden");
    elements.status.textContent = "Identity loaded. Polling for scans…";
    elements.status.className = "status status-success";

    if (scans.length === 0) {
      elements.recentScansList.classList.add("hidden");
      elements.recentScansList.replaceChildren();
      elements.recentScansEmpty.classList.remove("hidden");
      return;
    }

    elements.recentScansEmpty.classList.add("hidden");
    elements.recentScansList.classList.remove("hidden");

    const existingItems = state.scanItems;
    const nextItems = new Map();
    const fragment = document.createDocumentFragment();

    for (const scan of scans) {
      const item = existingItems.get(scan.scanId) || createRecentScanItem(scan);
      applyRecentScanItemState(item, scan);
      nextItems.set(scan.scanId, item);
      fragment.append(item);
    }

    elements.recentScansList.replaceChildren(fragment);
    state.scanItems = nextItems;

    for (const key of existingItems.keys()) {
      if (!nextItems.has(key)) {
        draftNotes.delete(key);
        scanMessages.delete(key);
        savingScanIds.delete(key);
        editingScanIds.delete(key);
      }
    }
  }

  function createRecentScanItem(scan) {
    const item = document.createElement("li");
    item.className = "scan-item";
    item.dataset.scanId = scan.scanId;

    const header = document.createElement("div");
    header.className = "scan-header";

    const headerText = document.createElement("div");
    const studentName = document.createElement("p");
    studentName.className = "scan-name";
    const scanMeta = document.createElement("p");
    scanMeta.className = "scan-meta";
    headerText.append(studentName, scanMeta);

    header.append(headerText);

    const noteState = document.createElement("p");
    noteState.className = "scan-note-state";

    const label = document.createElement("label");
    label.className = "note-label";
    label.htmlFor = `note-${scan.scanId}`;
    label.textContent = "Mentor notes";

    const textarea = document.createElement("textarea");
    textarea.className = "note-input";
    textarea.id = `note-${scan.scanId}`;
    textarea.rows = 4;
    textarea.placeholder = "Write notes for this scan.";

    const actions = document.createElement("div");
    actions.className = "scan-actions";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "button scan-save-button";
    saveButton.textContent = "Save notes";

    const saveMessage = document.createElement("p");
    saveMessage.className = "scan-save-message";
    saveMessage.setAttribute("aria-live", "polite");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button scan-edit-button";
    editButton.textContent = "Edit notes";

    actions.append(editButton, saveButton, saveMessage);

    item.append(header, noteState, label, textarea, actions);

    item._refs = {
      studentName,
      scanMeta,
      noteState,
      label,
      textarea,
      editButton,
      saveButton,
      saveMessage,
    };

    textarea.addEventListener("input", () => {
      draftNotes.set(scan.scanId, textarea.value);
      scanMessages.delete(scan.scanId);
      updateRecentScanItem(scan);
    });

    editButton.addEventListener("click", () => {
      editingScanIds.add(scan.scanId);
      updateRecentScanItem(scan);
    });

    saveButton.addEventListener("click", () => {
      void saveScanNotes(scan.scanId);
    });

    return item;
  }

  function applyRecentScanItemState(item, scan) {
    const refs = item._refs;
    const savedNotes = scan.notes || "";
    const draft = draftNotes.has(scan.scanId) ? draftNotes.get(scan.scanId) : undefined;
    const displayNotes = draft !== undefined ? draft : savedNotes;

    const isEditing = editingScanIds.has(scan.scanId) || !savedNotes;

    refs.studentName.textContent = scan.studentName;
    refs.scanMeta.textContent = scan.scannedAt
      ? `Scanned ${formatTimestamp(scan.scannedAt)}`
      : "Recorded for this event day.";
    refs.noteState.textContent = displayNotes || "No notes saved yet.";

    if (refs.textarea.value !== displayNotes && !draftNotes.has(scan.scanId)) {
      refs.textarea.value = displayNotes;
    }

    const isSaving = savingScanIds.has(scan.scanId);

    refs.noteState.classList.toggle("hidden", isEditing);
    refs.label.classList.toggle("hidden", !isEditing);
    refs.textarea.classList.toggle("hidden", !isEditing);
    refs.editButton.classList.toggle("hidden", isEditing);
    refs.saveButton.classList.toggle("hidden", !isEditing);
    refs.textarea.disabled = isSaving;
    refs.saveButton.disabled = isSaving;
    refs.saveButton.textContent = isSaving ? "Saving…" : "Save notes";

    const message = scanMessages.get(scan.scanId);
    refs.saveMessage.textContent = message?.text || "";
    refs.saveMessage.className = message ? `scan-save-message is-${message.tone}` : "scan-save-message";
    item.classList.toggle("is-saving", isSaving);
  }

  function updateRecentScanItem(scan) {
    if (!scan) {
      return;
    }

    const item = state.scanItems.get(scan.scanId);

    if (item) {
      applyRecentScanItemState(item, scan);
    }
  }

  async function saveScanNotes(scanId) {
    const item = state.scanItems.get(scanId);

    if (!state.mentor || !item) {
      return;
    }

    const refs = item._refs;
    const notes = refs.textarea.value;

    if (notes.length > 2_000) {
      scanMessages.set(scanId, { text: "Notes must be 2,000 characters or fewer.", tone: "error" });
      updateRecentScanItem(findRecentScan(scanId));
      return;
    }

    savingScanIds.add(scanId);
    scanMessages.set(scanId, { text: "Saving notes…", tone: "neutral" });
    updateRecentScanItem(findRecentScan(scanId));

    try {
      const response = await fetch(`${mentorPath}/api/notes/${encodeURIComponent(scanId)}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, `Note save failed with status ${response.status}.`));
      }

      const payload = await response.json();
      const savedNotes = payload?.scan?.notes ?? notes;
      const record = findRecentScan(scanId);

      if (record) {
        record.notes = savedNotes;
      }

      draftNotes.delete(scanId);
      editingScanIds.delete(scanId);
      scanMessages.set(scanId, { text: "Notes saved.", tone: "success" });
      updateRecentScanItem(findRecentScan(scanId));
    } catch (error) {
      scanMessages.set(scanId, {
        text: error instanceof Error ? error.message : "Note save failed.",
        tone: "error",
      });
      updateRecentScanItem(findRecentScan(scanId));
    } finally {
      savingScanIds.delete(scanId);
      updateRecentScanItem(findRecentScan(scanId));
    }
  }

  function findRecentScan(scanId) {
    return state.recentScans.find((scan) => scan.scanId === scanId) || null;
  }

  function showIdentityError(message) {
    elements.mentorSuccess.classList.add("hidden");
    elements.mentorError.classList.remove("hidden");
    elements.mentorErrorMessage.textContent = message;

    elements.qrDisplay.classList.add("hidden");
    elements.qrDisplay.replaceChildren();
    elements.qrCopy.classList.add("hidden");

    elements.recentScansEmpty.classList.add("hidden");
    elements.status.textContent = "Identity load failed.";
    elements.status.className = "status status-error";
    elements.recentScansError.classList.add("hidden");
    elements.recentScansList.classList.add("hidden");
    elements.recentScansList.replaceChildren();
  }

  function showRecentScansError(message) {
    elements.recentScansEmpty.classList.add("hidden");
    elements.recentScansError.classList.remove("hidden");
    elements.recentScansErrorMessage.textContent = message;

    elements.status.textContent = "Identity loaded, but failed to load recent scans.";
    elements.status.className = "status status-error";

    if (state.recentScans.length > 0) {
      elements.recentScansList.classList.remove("hidden");
    } else {
      elements.recentScansList.classList.add("hidden");
      elements.recentScansList.replaceChildren();
    }
  }

  async function getResponseErrorMessage(response, fallbackMessage) {
    try {
      const clone = response.clone();
      const payload = await clone.json();

      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        return payload.error;
      }
    } catch {
      // Ignore parse errors and fall back to the generic message.
    }

    return fallbackMessage;
  }

  function formatTimestamp(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function toTimestamp(value) {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  // ── Mode switching ───────────────────────────────────────────────

  function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    if (elements.modeScanBtn) {
      elements.modeScanBtn.classList.toggle("mode-btn-active", mode === "scan");
    }
    if (elements.modeShowBtn) {
      elements.modeShowBtn.classList.toggle("mode-btn-active", mode === "show");
    }

    if (mode === "show") {
      if (elements.qrView) elements.qrView.classList.remove("hidden");
      if (elements.scannerView) elements.scannerView.classList.add("hidden");
      stopScanner(true);
    } else {
      if (elements.qrView) elements.qrView.classList.add("hidden");
      if (elements.scannerView) elements.scannerView.classList.remove("hidden");
      prepareScanner();
    }
  }

  // ── Scanner functions (adapted from student/app.js) ──────────────

  function isDevHostname(hostname) {
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1") {
      return true;
    }
    const parts = hostname.split(".");
    if (parts.length === 4) {
      const octets = parts.map(Number);
      if (octets.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
        // 10.x.x.x
        if (octets[0] === 10) return true;
        // 172.16-31.x.x
        if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
        // 192.168.x.x
        if (octets[0] === 192 && octets[1] === 168) return true;
      }
    }
    return false;
  }

  async function prepareScanner() {
    if (!state.mentor) {
      return;
    }

    if (!window.isSecureContext && !isDevHostname(location.hostname)) {
      setScannerUnavailable("Camera scanning requires HTTPS or localhost. Open the page in a secure context to continue.", true);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScannerUnavailable("This browser does not support camera access for QR scanning.", true);
      return;
    }

    if (scannerAvailability === "ready" && qrScanner) {
      setScannerStopped("Scanner stopped. Tap Start scanner to read a student QR code.", "Start scanner", false);
      return;
    }

    setScannerLoading("Checking camera availability…", "We are looking for a usable camera on this device.", true);

    const hasCamera = await QrScanner.hasCamera().catch(() => false);

    if (!hasCamera) {
      setScannerUnavailable("No camera was found on this device. Connect a camera or use a device with camera access.", true);
      return;
    }

    if (!qrScanner) {
      qrScanner = new QrScanner(
        elements.scannerVideo,
        handleScanDecoded,
        {
          preferredCamera: "environment",
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
          onDecodeError: handleScanDecodeError,
        }
      );
    }

    scannerAvailability = "ready";
    setScannerStopped("Scanner stopped. Tap Start scanner to read a student QR code.", "Start scanner", false);
  }

  async function toggleScanner() {
    if (!state.mentor || scannerAvailability === "unavailable") {
      return;
    }

    if (scannerActive || scannerStarting || scannerProcessing) {
      await stopScanner(false);
      return;
    }

    await startScanner();
  }

  async function startScanner() {
    if (!state.mentor) {
      return;
    }

    if (scannerAvailability !== "ready" || !qrScanner) {
      await prepareScanner();

      if (scannerAvailability !== "ready" || !qrScanner) {
        return;
      }
    }

    hideScanFeedback();
    scanHandled = false;
    scannerStarting = true;
    scannerProcessing = false;
    setPageStatus("loading", "Opening camera…");
    setScannerStarting("Starting camera…", "Allow camera access when your browser asks, then point the device at a student QR code.", true);

    try {
      await qrScanner.start();
      scannerActive = true;
      scannerStarting = false;
      setPageStatus("loading", "Camera active. Point it at a student QR code.");
      setScannerScanning("Camera active. Point it at a student QR code.", "When a student QR is recognized, the camera will pause and the scan will be saved.", false);
    } catch (error) {
      scannerStarting = false;
      scannerActive = false;

      if (isPermissionDeniedError(error)) {
        setScannerPermissionDenied(
          "Camera permission was denied. Allow access in your browser settings, then tap Start scanner again.",
          false
        );
        return;
      }

      if (isCameraUnavailableError(error)) {
        setScannerUnavailable(
          "The browser could not find an available camera. Attach a camera or switch devices, then try again.",
          true
        );
        return;
      }

      setScannerErrorState(
        "Camera scanner failed to start.",
        error instanceof Error ? error.message : "The browser rejected camera access or could not open the camera.",
        false
      );
    }
  }

  async function stopScanner(fromReset) {
    scannerStarting = false;
    scannerProcessing = false;

    if (qrScanner) {
      try {
        await qrScanner.pause(true);
      } catch (error) {
        // Ignore pause failures; the UI will still move back to the stopped state.
      }
    }

    scannerActive = false;

    if (!fromReset && scannerAvailability === "ready") {
      setScannerStopped("Scanner stopped. Tap Start scanner to scan another student QR code.", "Start scanner", false);
      setPageStatus("neutral", "Scanner stopped.");
    }
  }

  async function destroyScanner() {
    await stopScanner(true);

    if (qrScanner) {
      try {
        qrScanner.destroy();
      } catch (error) {
        // Ignore destroy failures during page teardown.
      }

      qrScanner = null;
    }
  }

  async function handleScanDecoded(result) {
    if (scanHandled) {
      return;
    }

    scanHandled = true;
    scannerProcessing = true;

    await stopScanner(true);

    const qrPayload = normalizeDecodedPayload(result);

    if (!qrPayload) {
      scannerProcessing = false;
      setScannerErrorState(
        "Unreadable QR code.",
        "The camera read something, but it did not contain a usable student payload.",
        false
      );
      return;
    }

    setPageStatus("loading", "QR code decoded. Saving the student scan…");
    setScannerProcessing("QR code decoded. Saving the student scan…", "The camera has paused while the decoded payload is being sent to the attendance service.", true);

    try {
      const response = await fetch(`${mentorPath}/api/scan`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrPayload }),
      });

      const responseBody = await readJson(response);

      if (!response.ok) {
        throw buildScanError(response.status, responseBody);
      }

      const scannedPerson = responseBody?.scannedPerson;
      const studentName = scannedPerson?.displayName || scannedPerson?.display_name || scannedPerson?.name || "Student";

      setScanFeedback(
        "success",
        "Scan recorded",
        `Student scan accepted: ${studentName}. Refreshing recent scans now.`
      );

      await loadRecentScans({ showLoading: true });

      setPageStatus("success", "Student scan recorded. Recent scans have been refreshed.");
      setScannerStopped("Scanner stopped. Tap Start scanner to scan another student QR code.", "Start scanner", false);
    } catch (error) {
      const feedbackTitle = error instanceof Error && typeof error.title === "string" ? error.title : "Scan failed";
      const feedbackCopy = error instanceof Error ? error.message : "The student QR code could not be saved.";

      setScanFeedback(
        "error",
        feedbackTitle,
        feedbackCopy
      );
      setPageStatus("error", feedbackCopy);
      setScannerStopped("Scanner stopped. Fix the issue and tap Start scanner to try again.", "Start scanner", false);
    } finally {
      scannerProcessing = false;
    }
  }

  async function handleScanDecodeError(error) {
    if (error === QrScanner.NO_QR_CODE_FOUND || `${error}`.includes(QrScanner.NO_QR_CODE_FOUND)) {
      return;
    }

    if (!scannerActive && !scannerStarting) {
      return;
    }

    scannerActive = false;
    scannerStarting = false;
    await stopScanner(true);

    setScannerErrorState(
      "Camera read error.",
      error instanceof Error ? error.message : "The camera could not decode that frame cleanly.",
      false
    );
  }

  // ── Scanner UI helpers ───────────────────────────────────────────

  function setPageStatus(tone, message) {
    elements.status.textContent = message;
    elements.status.className = `status status-${tone}`;
  }

  function setScannerLoading(title, copy, disableButton) {
    scannerAvailability = "loading";
    updateScannerStage(false);
    setScannerPermissionRetryVisible(false);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = title;
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton("Starting camera…", true, disableButton);
  }

  function setScannerStarting(title, copy, disableButton) {
    scannerAvailability = "ready";
    updateScannerStage(false);
    setScannerPermissionRetryVisible(false);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = title;
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton("Opening camera…", true, disableButton);
  }

  function setScannerScanning(title, copy, disableButton) {
    updateScannerStage(true);
    setScannerPermissionRetryVisible(false);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = title;
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton("Stop scanner", false, disableButton);
  }

  function setScannerProcessing(title, copy, disableButton) {
    updateScannerStage(false);
    setScannerPermissionRetryVisible(false);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = title;
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton("Scanner paused", true, disableButton);
  }

  function setScannerStopped(copy, buttonText, disableButton) {
    updateScannerStage(false);
    setScannerPermissionRetryVisible(false);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = "Scanner stopped";
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton(buttonText, true, disableButton);
  }

  function setScannerUnavailable(copy, disableButton) {
    scannerAvailability = "unavailable";
    updateScannerStage(false);
    setScannerPermissionRetryVisible(true);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = "Camera unavailable";
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setPageStatus("error", "Camera unavailable.");
    setScannerButton("Start scanner", true, disableButton);
  }

  function setScannerPermissionDenied(copy, disableButton) {
    scannerAvailability = "ready";
    updateScannerStage(false);
    setScannerPermissionRetryVisible(true);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = "Camera permission denied";
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setPageStatus("error", "Camera permission denied.");
    setScannerButton("Start scanner", false, disableButton);
  }

  function setScannerErrorState(title, copy, disableButton) {
    scannerAvailability = "ready";
    updateScannerStage(false);
    setScannerPermissionRetryVisible(true);
    if (elements.scannerPlaceholderTitle) elements.scannerPlaceholderTitle.textContent = title;
    if (elements.scannerPlaceholderCopy) elements.scannerPlaceholderCopy.textContent = copy;
    setPageStatus("error", title);
    setScannerButton("Start scanner", false, disableButton);
  }

  function setScannerButton(label, restart, disableButton) {
    if (!elements.scannerToggleButton) return;
    elements.scannerToggleButton.textContent = label;
    elements.scannerToggleButton.disabled = disableButton;

    if (!disableButton && restart) {
      elements.scannerToggleButton.disabled = false;
    }
  }

  function setScannerPermissionRetryVisible(isVisible) {
    if (elements.scannerPermissionRetryButton) {
      elements.scannerPermissionRetryButton.classList.toggle("hidden", !isVisible);
    }
  }

  function updateScannerStage(active) {
    if (elements.scannerStage) {
      elements.scannerStage.classList.toggle("is-active", active);
    }
  }

  function setScanFeedback(tone, title, copy) {
    if (!elements.scannerFeedback) return;
    elements.scannerFeedback.classList.remove("hidden");
    elements.scannerFeedback.classList.toggle("is-success", tone === "success");
    elements.scannerFeedback.classList.toggle("is-error", tone === "error");
    if (elements.scannerFeedbackTitle) elements.scannerFeedbackTitle.textContent = title;
    if (elements.scannerFeedbackCopy) elements.scannerFeedbackCopy.textContent = copy;
    elements.scannerFeedback.setAttribute("role", tone === "error" ? "alert" : "status");
    elements.scannerFeedback.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
  }

  function hideScanFeedback() {
    if (elements.scannerFeedback) {
      elements.scannerFeedback.classList.add("hidden");
      elements.scannerFeedback.classList.remove("is-success", "is-error");
    }
    if (elements.scannerFeedbackTitle) elements.scannerFeedbackTitle.textContent = "";
    if (elements.scannerFeedbackCopy) elements.scannerFeedbackCopy.textContent = "";
  }

  // ── Scanner helper functions ─────────────────────────────────────

  function normalizeDecodedPayload(result) {
    const raw = typeof result === "string" ? result : result?.data;

    if (typeof raw !== "string") {
      return "";
    }

    return raw.trim();
  }

  function buildScanError(status, payload) {
    const detail = getPayloadMessage(payload);

    if (status === 400) {
      return createScanError("Invalid QR code", detail || "The decoded QR payload is not a valid student attendance link.");
    }

    if (status === 409) {
      return createScanError("Duplicate scan", "This student has already been scanned today.");
    }

    if (status === 401 || status === 403) {
      return createScanError("Scan blocked", detail || "This mentor link is not allowed to submit scans right now.");
    }

    return createScanError("Scan failed", detail || `Scan submission failed with status ${status}.`);
  }

  function createScanError(title, message) {
    const error = new Error(message);
    error.title = title;
    return error;
  }

  function getPayloadMessage(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const message = payload.message || payload.error || payload.detail || payload.reason;

    if (typeof message === "string") {
      return message;
    }

    if (message && typeof message === "object") {
      return message.message || message.error || message.detail || message.reason || "";
    }

    return "";
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function isPermissionDeniedError(error) {
    const message = `${error?.name || ""} ${error instanceof Error ? error.message : error || ""}`.toLowerCase();
    return (
      message.includes("notallowederror") ||
      message.includes("permission denied") ||
      message.includes("denied") ||
      message.includes("securityerror")
    );
  }

  function isCameraUnavailableError(error) {
    const message = `${error?.name || ""} ${error instanceof Error ? error.message : error || ""}`.toLowerCase();
    return (
      message.includes("notfounderror") ||
      message.includes("overconstrainederror") ||
      message.includes("camera not found") ||
      message.includes("camera unavailable")
    );
  }
})();
