const POLL_INTERVAL_MS = 10_000;
const COPY_RESET_MS = 1_500;

(function () {
  const elements = {
    mentorLoading: document.getElementById("mentor-loading"),
    mentorSuccess: document.getElementById("mentor-success"),
    mentorError: document.getElementById("mentor-error"),
    mentorName: document.getElementById("mentor-name"),
    mentorMeta: document.getElementById("mentor-meta"),
    mentorErrorMessage: document.getElementById("mentor-error-message"),
    retryButton: document.getElementById("retry-button"),
    qrLoading: document.getElementById("qr-loading"),
    qrDisplay: document.getElementById("qr-display"),
    qrCopy: document.getElementById("qr-copy"),
    recentScansLoading: document.getElementById("recent-scans-loading"),
    recentScansEmpty: document.getElementById("recent-scans-empty"),
    recentScansError: document.getElementById("recent-scans-error"),
    recentScansErrorMessage: document.getElementById("recent-scans-error-message"),
    recentScansList: document.getElementById("recent-scans-list"),
    recentScansRetryButton: document.getElementById("recent-scans-retry-button"),
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
  };
  const draftNotes = new Map();
  const scanMessages = new Map();
  const savingScanIds = new Set();

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
  elements.qrCopy.addEventListener("click", () => {
    void copyQrPayload();
  });
  window.addEventListener("pagehide", cleanup);

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
  }

  function resetPageState() {
    elements.mentorLoading.classList.remove("hidden");
    elements.mentorSuccess.classList.add("hidden");
    elements.mentorError.classList.add("hidden");

    elements.qrLoading.classList.remove("hidden");
    elements.qrDisplay.classList.add("hidden");
    elements.qrDisplay.replaceChildren();
    elements.qrCopy.classList.add("hidden");
    elements.qrCopy.disabled = true;
    elements.qrCopy.textContent = "Copy QR payload";

    elements.recentScansLoading.classList.remove("hidden");
    elements.recentScansEmpty.classList.add("hidden");
    elements.recentScansError.classList.add("hidden");
    elements.recentScansList.classList.add("hidden");
    elements.recentScansList.replaceChildren();

    state.recentScans = [];
    state.recentScansLoaded = false;
    state.scanItems = new Map();
    draftNotes.clear();
    scanMessages.clear();
    savingScanIds.clear();
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
      elements.recentScansLoading.classList.remove("hidden");
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
    elements.mentorLoading.classList.add("hidden");
    elements.mentorError.classList.add("hidden");
    elements.mentorSuccess.classList.remove("hidden");
    elements.mentorName.textContent = mentor.displayName;
    elements.mentorMeta.textContent = `Secret id: ${mentor.secretId} · Person id: ${mentor.personId}`;
    document.title = `${mentor.displayName} • Mentor attendance`;
  }

  function renderQrCode(mentor) {
    elements.qrLoading.classList.add("hidden");
    elements.qrDisplay.innerHTML = mentor.qrSvg;
    elements.qrDisplay.classList.remove("hidden");
    elements.qrCopy.classList.remove("hidden");
    elements.qrCopy.disabled = !mentor.qrPayload;
    elements.qrCopy.textContent = mentor.qrPayload ? "Copy QR payload" : "QR payload unavailable";
  }

  async function copyQrPayload() {
    if (!state.mentor?.qrPayload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(state.mentor.qrPayload);
      elements.qrCopy.textContent = "Copied";

      if (state.copyResetTimer) {
        window.clearTimeout(state.copyResetTimer);
      }

      state.copyResetTimer = window.setTimeout(() => {
        elements.qrCopy.textContent = "Copy QR payload";
        state.copyResetTimer = null;
      }, COPY_RESET_MS);
    } catch {
      elements.qrCopy.textContent = "Copy failed";
    }
  }

  function renderRecentScans(scans) {
    elements.recentScansLoading.classList.add("hidden");
    elements.recentScansError.classList.add("hidden");

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

    actions.append(saveButton, saveMessage);

    item.append(header, noteState, label, textarea, actions);

    item._refs = {
      studentName,
      scanMeta,
      noteState,
      textarea,
      saveButton,
      saveMessage,
    };

    textarea.addEventListener("input", () => {
      draftNotes.set(scan.scanId, textarea.value);
      scanMessages.delete(scan.scanId);
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

    refs.studentName.textContent = scan.studentName;
    refs.scanMeta.textContent = scan.scannedAt
      ? `Scanned ${formatTimestamp(scan.scannedAt)}`
      : "Recorded for this event day.";
    refs.noteState.textContent = draft !== undefined
      ? `Draft note: ${draft || "(empty)"}`
      : savedNotes
        ? `Saved note: ${savedNotes}`
        : "No notes saved yet.";

    if (refs.textarea.value !== displayNotes && !draftNotes.has(scan.scanId)) {
      refs.textarea.value = displayNotes;
    }

    const isSaving = savingScanIds.has(scan.scanId);
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
    elements.mentorLoading.classList.add("hidden");
    elements.mentorSuccess.classList.add("hidden");
    elements.mentorError.classList.remove("hidden");
    elements.mentorErrorMessage.textContent = message;

    elements.qrLoading.classList.add("hidden");
    elements.qrDisplay.classList.add("hidden");
    elements.qrDisplay.replaceChildren();
    elements.qrCopy.classList.add("hidden");

    elements.recentScansLoading.classList.add("hidden");
    elements.recentScansEmpty.classList.add("hidden");
    elements.recentScansError.classList.add("hidden");
    elements.recentScansList.classList.add("hidden");
    elements.recentScansList.replaceChildren();
  }

  function showRecentScansError(message) {
    elements.recentScansLoading.classList.add("hidden");
    elements.recentScansEmpty.classList.add("hidden");
    elements.recentScansError.classList.remove("hidden");
    elements.recentScansErrorMessage.textContent = message;

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
})();
