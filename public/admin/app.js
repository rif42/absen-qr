(function () {
  const elements = {
    status: document.getElementById("status-banner"),
    loading: document.getElementById("records-loading"),
    emptyState: document.getElementById("records-empty-state"),
    table: document.getElementById("records-table"),
    body: document.getElementById("records-table-body"),
    exportButton: document.getElementById("export-csv-button"),
  };

  const adminPath = getAdminPath();
  const state = {
    eventDate: "",
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

  async function loadRecords() {
    setLoading(true);
    setEmptyState(false);
    setTableVisible(false);
    setStatus("loading", "Loading records…");

    try {
      const response = await fetch(`${adminPath}/api/records`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(await readResponseMessage(response, `Records request failed with status ${response.status}.`));
      }

      const payload = await response.json();
      const normalized = normalizePayload(payload);

      state.eventDate = normalized.eventDate;
      state.records = normalized.records;
      state.students = normalized.students;
      state.mentors = normalized.mentors;
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

  async function handleExport() {
    setStatus("loading", "Opening CSV export…");

    if (typeof window.location.assign === "function") {
      window.location.assign(`${adminPath}/api/export.csv`);
      return;
    }

    if (typeof window.open === "function") {
      window.open(`${adminPath}/api/export.csv`);
      return;
    }

    setStatus("error", "CSV export is unavailable in this browser.");
  }

  function normalizePayload(payload) {
    return {
      eventDate: typeof payload?.eventDate === "string" ? payload.eventDate : "",
      students: normalizePeople(payload?.students),
      mentors: normalizePeople(payload?.mentors),
      records: Array.isArray(payload?.records) ? payload.records.map((record) => normalizeRecord(record)).filter(Boolean) : [],
    };
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
      notes: normalizeString(record.notes),
      updatedAt: normalizeString(record.updatedAt ?? record.updated_at),
    };
  }

  function renderRecords(records) {
    elements.body.replaceChildren();
    state.rowsByScanId.clear();

    for (const record of records) {
      const row = createRecordRow(record);
      state.rowsByScanId.set(record.scanId, { record, row });
      elements.body.appendChild(row);
    }
  }

  function createRecordRow(record) {
    const row = document.createElement("tr");
    row.dataset.scanId = record.scanId;

    const studentCell = document.createElement("td");
    const studentSelect = document.createElement("select");
    populateSelect(studentSelect, state.students, record.studentId, record.studentName);
    studentCell.appendChild(studentSelect);

    const mentorCell = document.createElement("td");
    const mentorSelect = document.createElement("select");
    populateSelect(mentorSelect, state.mentors, record.mentorId, record.mentorName);
    mentorCell.appendChild(mentorSelect);

    const notesCell = document.createElement("td");
    const notesTextarea = document.createElement("textarea");
    notesTextarea.value = record.notes;
    notesCell.appendChild(notesTextarea);

    const saveCell = document.createElement("td");
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save";
    saveCell.appendChild(saveButton);

    const deleteCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteCell.appendChild(deleteButton);

    saveButton.addEventListener("click", () => {
      void saveRecord(record.scanId, studentSelect.value, mentorSelect.value, notesTextarea.value);
    });

    deleteButton.addEventListener("click", () => {
      void deleteRecord(record.scanId, row);
    });

    row.append(studentCell, mentorCell, notesCell, saveCell, deleteCell);
    row._refs = {
      studentSelect,
      mentorSelect,
      notesTextarea,
      saveButton,
      deleteButton,
    };

    return row;
  }

  function populateSelect(select, people, selectedId, selectedName) {
    const options = new Map();

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

    const payload = buildPatchPayload(rowState.record, {
      studentId,
      mentorId,
      notes,
    });

    if (Object.keys(payload).length === 0) {
      setStatus("neutral", "No changes to save.");
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

      setStatus("success", `Saved ${scanId}.`);
    } catch (error) {
      setStatus("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      rowState.row._refs.saveButton.disabled = false;
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
