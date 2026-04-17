(function () {
  const elements = {
    status: document.getElementById("status-banner"),
    loading: document.getElementById("records-loading"),
    emptyState: document.getElementById("records-empty-state"),
    table: document.getElementById("records-table"),
    body: document.getElementById("records-table-body"),
    exportButton: document.getElementById("export-csv-button"),
    startDate: document.getElementById("startDate"),
    endDate: document.getElementById("endDate"),
    applyButton: document.getElementById("apply-filters-button"),
  };

  const adminPath = getAdminPath();
  const state = {
    filter: {
      startDate: "",
      endDate: "",
    },
    records: [],
    students: [],
    mentors: [],
    rowsByScanId: new Map(),
  };

  if (!adminPath) {
    setStatus("error", "Invalid admin link.");
    setLoading(false);
    setEmptyState(true);
    return;
  }

  elements.exportButton.addEventListener("click", handleExport);
  elements.applyButton.addEventListener("click", handleApplyFilters);
  void loadRecords();

  function getAdminPath() {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const adminIndex = segments.indexOf("admin");

    if (adminIndex === -1 || !segments[adminIndex + 1]) {
      return "";
    }

    return `/admin/${segments[adminIndex + 1]}`;
  }

  function setLoading(isVisible) {
    elements.loading.classList.toggle("hidden", !isVisible);
  }

  function setEmptyState(isVisible) {
    elements.emptyState.classList.toggle("hidden", !isVisible);
  }

  function setTableVisible(isVisible) {
    elements.table.classList.toggle("hidden", !isVisible);
  }

  function setStatus(tone, message) {
    elements.status.classList.remove("status-loading", "status-success", "status-error", "status-neutral");
    elements.status.classList.add("status", `status-${tone}`);
    elements.status.textContent = message;
  }

  async function loadRecords(requestedFilter = readUrlDateFilter(), syncUrl = false) {
    const requestFilter = isValidDateRange(requestedFilter.startDate, requestedFilter.endDate) ? requestedFilter : null;
    const requestUrl = buildRecordsUrl(requestFilter);

    setLoading(true);
    setEmptyState(false);
    setTableVisible(false);
    setStatus("loading", "Loading records…");

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, `Records request failed with status ${response.status}.`));
      }

      const payload = await response.json();
      const normalized = normalizePayload(payload);
      const activeFilter = normalized.dateFilter || requestFilter || state.filter;

      state.filter = activeFilter;
      state.records = normalized.records;
      state.students = normalized.students;
      state.mentors = normalized.mentors;
      syncDateFilterInputs(activeFilter);

      if (syncUrl || !requestFilter) {
        replaceUrlForDateFilter(activeFilter);
      }

      renderRecords(normalized.records);

      setLoading(false);

      if (normalized.records.length === 0) {
        setEmptyState(true);
        setTableVisible(false);
        setStatus("neutral", "No records available yet.");
        return;
      }

      setEmptyState(false);
      setTableVisible(true);
      setStatus("success", "Records loaded and ready.");
    } catch (error) {
      setLoading(false);
      setEmptyState(true);
      setTableVisible(false);
      setStatus("error", error instanceof Error ? error.message : "Records request failed.");
    }
  }

  async function handleApplyFilters(event) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    const nextFilter = {
      startDate: normalizeString(elements.startDate.value),
      endDate: normalizeString(elements.endDate.value),
    };

    if (!nextFilter.startDate || !nextFilter.endDate) {
      setStatus("error", "Start and end dates are required.");
      return;
    }

    if (!isValidDateRange(nextFilter.startDate, nextFilter.endDate)) {
      setStatus("error", "Start date must be on or before end date.");
      return;
    }

    await loadRecords(nextFilter, true);
  }

  async function handleExport() {
    setStatus("loading", "Opening CSV export…");

    const exportUrl = buildExportUrl(state.filter);

    if (typeof window.location.assign === "function") {
      window.location.assign(exportUrl);
      return;
    }

    if (typeof window.open === "function") {
      window.open(exportUrl);
      return;
    }

    setStatus("error", "CSV export is unavailable in this browser.");
  }

  function normalizePayload(payload) {
    return {
      eventDate: typeof payload?.eventDate === "string" ? payload.eventDate : "",
      students: normalizePeople(payload?.students),
      mentors: normalizePeople(payload?.mentors),
      dateFilter: normalizeDateFilter(payload?.dateFilter),
      records: Array.isArray(payload?.records) ? payload.records.map((record) => normalizeRecord(record)).filter(Boolean) : [],
    };
  }

  function readUrlDateFilter() {
    const searchParams = new URLSearchParams(window.location.search || "");

    return {
      startDate: normalizeString(searchParams.get("startDate")),
      endDate: normalizeString(searchParams.get("endDate")),
    };
  }

  function normalizeDateFilter(filter) {
    if (!filter || typeof filter !== "object") {
      return null;
    }

    const startDate = normalizeString(filter.startDate ?? filter.start_date ?? filter.start);
    const endDate = normalizeString(filter.endDate ?? filter.end_date ?? filter.end);

    if (!isValidDateRange(startDate, endDate)) {
      return null;
    }

    return {
      startDate,
      endDate,
    };
  }

  function isValidDateRange(startDate, endDate) {
    return isEventDate(startDate) && isEventDate(endDate) && startDate <= endDate;
  }

  function isEventDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function buildDateRangeSearch(filter) {
    if (!isValidDateRange(filter.startDate, filter.endDate)) {
      return "";
    }

    const searchParams = new URLSearchParams();
    searchParams.set("startDate", filter.startDate);
    searchParams.set("endDate", filter.endDate);
    return searchParams.toString();
  }

  function buildRecordsUrl(filter) {
    const search = filter ? buildDateRangeSearch(filter) : "";

    return search ? `${adminPath}/api/records?${search}` : `${adminPath}/api/records`;
  }

  function buildExportUrl(filter) {
    const search = filter ? buildDateRangeSearch(filter) : "";

    return search ? `${adminPath}/api/export.csv?${search}` : `${adminPath}/api/export.csv`;
  }

  function syncDateFilterInputs(filter) {
    elements.startDate.value = filter.startDate;
    elements.endDate.value = filter.endDate;
  }

  function replaceUrlForDateFilter(filter) {
    if (!window.history || typeof window.history.replaceState !== "function") {
      return;
    }

    const search = buildDateRangeSearch(filter);

    if (!search) {
      return;
    }

    window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
  }

  function normalizePeople(source) {
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map((person) => ({
        personId: normalizeString(person?.personId ?? person?.person_id ?? person?.id),
        displayName: normalizeString(person?.displayName ?? person?.display_name ?? person?.name ?? person?.fullName),
      }))
      .filter((person) => person.personId && person.displayName);
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const scanId = normalizeString(record.scanId ?? record.scan_id);

    if (!scanId) {
      return null;
    }

    return {
      scanId,
      studentId: normalizeString(record.studentId ?? record.student_id),
      studentName: normalizeString(record.studentName ?? record.student_name),
      studentSecretId: normalizeString(record.studentSecretId ?? record.student_secret_id),
      mentorId: normalizeString(record.mentorId ?? record.mentor_id),
      mentorName: normalizeString(record.mentorName ?? record.mentor_name),
      eventDate: normalizeString(record.eventDate ?? record.event_date),
      scannedAt: normalizeString(record.scannedAt ?? record.scanned_at),
      entryMethod: record.entryMethod === "fallback_code" ? "fallback_code" : "qr",
      notes: normalizeString(record.notes),
      updatedAt: normalizeString(record.updatedAt ?? record.updated_at),
    };
  }

  function renderRecords(records) {
    elements.body.replaceChildren();
    state.rowsByScanId.clear();

    for (const record of records) {
      const row = createRecordRow(record);
      elements.body.appendChild(row);
    }
  }

  function createRecordRow(record) {
    const row = document.createElement("tr");
    row.dataset.scanId = record.scanId;
    const rowState = {
      record,
      row,
      isLocked: true,
    };

    const studentCell = document.createElement("td");
    const studentText = document.createElement("span");
    studentText.className = "record-text";
    const studentSelect = document.createElement("select");
    studentCell.append(studentText);

    const mentorCell = document.createElement("td");
    const mentorText = document.createElement("span");
    mentorText.className = "record-text";
    const mentorFallbackBadge = document.createElement("span");
    mentorFallbackBadge.id = "fallback-badge";
    mentorFallbackBadge.className = "fallback-badge";
    mentorFallbackBadge.textContent = "fallback";
    mentorFallbackBadge.style.display = "none";
    const mentorSelect = document.createElement("select");
    mentorCell.append(mentorText, mentorFallbackBadge);

    const notesCell = document.createElement("td");
    const notesText = document.createElement("span");
    notesText.className = "record-text";
    const notesTextarea = document.createElement("textarea");
    notesTextarea.value = record.notes;
    notesCell.append(notesText);

    const actionCell = document.createElement("td");
    const actionWrap = document.createElement("div");
    actionWrap.className = "record-actions";
    actionWrap.style.display = "flex";
    actionWrap.style.flexDirection = "row";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "✏️";
    editButton.className = "action-secondary";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "💾";
    saveButton.className = "action-primary";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "❌";
    deleteButton.className = "action-danger";
    actionWrap.append(editButton, deleteButton);
    actionCell.appendChild(actionWrap);

    editButton.addEventListener("click", () => {
      setRowLockedState(rowState, false);
    });

    saveButton.addEventListener("click", () => {
      void saveRecord(record.scanId, studentSelect.value, mentorSelect.value, notesTextarea.value);
    });

    deleteButton.addEventListener("click", () => {
      void deleteRecord(record.scanId, row);
    });

    row.append(studentCell, mentorCell, notesCell, actionCell);
    row._refs = {
      studentCell,
      mentorCell,
      notesCell,
      actionCell,
      studentText,
      mentorText,
      mentorFallbackBadge,
      notesText,
      studentSelect,
      mentorSelect,
      notesTextarea,
      actionWrap,
      editButton,
      saveButton,
      deleteButton,
    };

    rowState.refs = row._refs;
    setRowLockedState(rowState, true);
    state.rowsByScanId.set(record.scanId, rowState);

    return row;
  }

  function setRowLockedState(rowState, isLocked) {
    rowState.isLocked = isLocked;
    rowState.row.dataset.rowState = isLocked ? "locked" : "editing";
    rowState.row.classList.toggle("row-locked", isLocked);
    rowState.row.classList.toggle("row-editing", !isLocked);
    rowState.row.setAttribute("aria-readonly", String(isLocked));

    rowState.refs.studentText.textContent = rowState.record.studentName || rowState.record.studentId;
    rowState.refs.mentorText.textContent = rowState.record.mentorName || rowState.record.mentorId;
    rowState.refs.notesText.textContent = rowState.record.notes || "";

    populateSelect(rowState.refs.studentSelect, state.students, rowState.record.studentId, rowState.record.studentName);
    populateSelect(rowState.refs.mentorSelect, state.mentors, rowState.record.mentorId, rowState.record.mentorName);
    rowState.refs.notesTextarea.value = rowState.record.notes;

    rowState.refs.studentSelect.disabled = isLocked;
    rowState.refs.mentorSelect.disabled = isLocked;
    rowState.refs.notesTextarea.disabled = isLocked;

    rowState.refs.saveButton.disabled = isLocked;
    rowState.refs.editButton.disabled = !isLocked;
    rowState.refs.deleteButton.disabled = false;

    if (isLocked) {
      rowState.refs.studentCell.replaceChildren(rowState.refs.studentText);
      rowState.refs.mentorCell.replaceChildren(rowState.refs.mentorText);
      rowState.refs.notesCell.replaceChildren(rowState.refs.notesText);
      rowState.refs.actionWrap.replaceChildren(rowState.refs.editButton, rowState.refs.deleteButton);
      // Show fallback badge only for fallback_code records
      const isFallback = rowState.record.entryMethod === "fallback_code";
      rowState.refs.mentorFallbackBadge.style.display = isFallback ? "inline" : "none";
      return;
    }

    rowState.refs.studentCell.replaceChildren(rowState.refs.studentSelect);
    rowState.refs.mentorCell.replaceChildren(rowState.refs.mentorSelect, rowState.refs.mentorFallbackBadge);
    rowState.refs.notesCell.replaceChildren(rowState.refs.notesTextarea);
    rowState.refs.actionWrap.replaceChildren(rowState.refs.saveButton, rowState.refs.deleteButton);
    // Hide badge in edit mode
    rowState.refs.mentorFallbackBadge.style.display = "none";
  }

  function populateSelect(select, people, selectedId, selectedName) {
    const options = new Map();

    select.replaceChildren();

    for (const person of people) {
      options.set(person.personId, person.displayName);
    }

    if (selectedId && !options.has(selectedId)) {
      options.set(selectedId, selectedName || selectedId);
    }

    for (const [value, label] of options.entries()) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (value === selectedId) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.value = selectedId || select.value || "";
  }

  async function saveRecord(scanId, studentId, mentorId, notes) {
    const rowState = state.rowsByScanId.get(scanId);

    if (!rowState) {
      return;
    }

    if (rowState.isLocked) {
      return;
    }

    const payload = buildPatchPayload(rowState.record, {
      studentId,
      mentorId,
      notes,
    });

    if (Object.keys(payload).length === 0) {
      setStatus("neutral", "No changes to save.");
      setRowLockedState(rowState, true);
      return;
    }

    rowState.row._refs.saveButton.disabled = true;
    rowState.row._refs.deleteButton.disabled = true;
    setStatus("loading", `Saving ${scanId}…`);

    try {
      const response = await fetch(`${adminPath}/api/records/${encodeURIComponent(scanId)}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, `Save failed with status ${response.status}.`));
      }

      const updatedRecord = normalizeRecord(await response.json());

      if (updatedRecord) {
        rowState.record = updatedRecord;
        state.records = state.records.map((record) => (record.scanId === scanId ? updatedRecord : record));
        rowState.row._refs.studentSelect.value = updatedRecord.studentId;
        rowState.row._refs.mentorSelect.value = updatedRecord.mentorId;
        rowState.row._refs.notesTextarea.value = updatedRecord.notes;
      }

      setRowLockedState(rowState, true);
      setStatus("success", `Saved ${scanId}.`);
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      rowState.row._refs.saveButton.disabled = rowState.isLocked;
      rowState.row._refs.deleteButton.disabled = false;
    }
  }

  async function deleteRecord(scanId, row) {
    const rowState = state.rowsByScanId.get(scanId);

    if (!rowState) {
      return;
    }

    rowState.row._refs.saveButton.disabled = true;
    rowState.row._refs.deleteButton.disabled = true;
    setStatus("loading", `Deleting ${scanId}…`);

    try {
      const response = await fetch(`${adminPath}/api/records/${encodeURIComponent(scanId)}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, `Delete failed with status ${response.status}.`));
      }

      const payload = await response.json();

      if (!payload || payload.deleted !== true) {
        throw new Error("Delete failed.");
      }

      row.remove();
      state.rowsByScanId.delete(scanId);
      state.records = state.records.filter((record) => record.scanId !== scanId);

      if (state.records.length === 0) {
        setEmptyState(true);
        setTableVisible(false);
      }

      setStatus("success", `Deleted ${scanId}.`);
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : "Delete failed.");
      setRowLockedState(rowState, rowState.isLocked);
      rowState.row._refs.deleteButton.disabled = false;
    }
  }

  function buildPatchPayload(record, nextValues) {
    const payload = {};

    if (normalizeString(nextValues.notes) !== record.notes) {
      payload.notes = normalizeString(nextValues.notes);
    }

    if (normalizeString(nextValues.studentId) !== record.studentId) {
      payload.studentId = normalizeString(nextValues.studentId);
    }

    if (normalizeString(nextValues.mentorId) !== record.mentorId) {
      payload.mentorId = normalizeString(nextValues.mentorId);
    }

    return payload;
  }

  async function readResponseMessage(response, fallbackMessage) {
    try {
      const payload = await response.json();
      const message = payload?.error || payload?.message || payload?.detail || payload?.reason;

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    } catch {
      // Fall back to the generic message.
    }

    return fallbackMessage;
  }

  function normalizeString(value) {
    return typeof value === "string" ? value : "";
  }
})();
