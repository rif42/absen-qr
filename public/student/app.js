(function () {
  const elements = {
    status: document.getElementById('status-banner'),
    identityLoading: document.getElementById('identity-loading'),
    identitySuccess: document.getElementById('identity-success'),
    identityError: document.getElementById('identity-error'),
    studentName: document.getElementById('student-name'),
    studentMeta: document.getElementById('student-meta'),
    errorMessage: document.getElementById('error-message'),
    historyLoading: document.getElementById('history-loading'),
    historyError: document.getElementById('history-error'),
    historyErrorMessage: document.getElementById('history-error-message'),
    historyEmpty: document.getElementById('history-empty'),
    historyList: document.getElementById('history-list'),
    retryButton: document.getElementById('retry-button'),
    historyRetryButton: document.getElementById('history-retry-button'),
  };

  const studentPath = getStudentPath();

  if (!studentPath) {
    showIdentityError('Invalid student link. Open this page from a /student/:secretToken URL.');
    return;
  }

  elements.retryButton.addEventListener('click', loadIdentity);
  elements.historyRetryButton.addEventListener('click', loadIdentity);
  loadIdentity();

  function getStudentPath() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const studentIndex = segments.indexOf('student');

    if (studentIndex === -1 || !segments[studentIndex + 1]) {
      return '';
    }

    return `/student/${segments[studentIndex + 1]}`;
  }

  async function loadIdentity() {
    setState('loading');

    try {
      const response = await fetch(`${studentPath}/api/me`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Identity request failed with status ${response.status}.`);
      }

      const payload = await response.json();
      const student = normalizeStudent(payload);

      if (!student) {
        throw new Error('Identity response did not include a student profile.');
      }

      renderIdentitySuccess(student);
      await loadHistory();
    } catch (error) {
      showIdentityError(error instanceof Error ? error.message : 'Identity request failed.');
    }
  }

  async function loadHistory() {
    elements.historyLoading.classList.remove('hidden');
    elements.historyError.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');

    try {
      const response = await fetch(`${studentPath}/api/history`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`History request failed with status ${response.status}.`);
      }

      const payload = await response.json();
      renderHistorySuccess(normalizeHistory(payload));
    } catch (error) {
      showHistoryError(error instanceof Error ? error.message : 'History request failed.');
    }
  }

  function normalizeStudent(payload) {
    const candidate = payload?.student || payload?.identity || payload?.person || payload;

    if (!candidate) {
      return null;
    }

    const displayName = candidate.displayName || candidate.display_name || candidate.name || candidate.fullName;
    const secretId = candidate.secretId || candidate.secret_id || candidate.id || candidate.studentId || candidate.student_id;

    if (!displayName) {
      return null;
    }

    return {
      displayName,
      secretId: secretId || 'Unknown secret id',
    };
  }

  function normalizeHistory(payload) {
    const source =
      Array.isArray(payload)
        ? payload
        : payload?.history || payload?.scans || payload?.records || payload?.mentorHistory || [];

    if (!Array.isArray(source)) {
      return [];
    }

    return source.map((entry) => ({
      mentorName:
        entry.mentorName || entry.mentor_name || entry.displayName || entry.display_name || entry.name || 'Mentor',
      scannedAt: entry.scannedAt || entry.scanned_at || entry.updatedAt || entry.updated_at || '',
    }));
  }

  function renderIdentitySuccess(student) {
    elements.identityLoading.classList.add('hidden');
    elements.identityError.classList.add('hidden');
    elements.identitySuccess.classList.remove('hidden');
    elements.historyLoading.classList.remove('hidden');
    elements.historyError.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();

    elements.studentName.textContent = student.displayName;
    elements.studentMeta.textContent = `Secret id: ${student.secretId}`;
    elements.status.textContent = 'Identity loaded. Loading today’s mentor history...';
    elements.status.className = 'status status-loading';
    document.title = `${student.displayName} • Student Attendance`;
  }

  function renderHistorySuccess(history) {
    elements.historyLoading.classList.add('hidden');
    elements.historyError.classList.add('hidden');

    if (history.length === 0) {
      elements.historyEmpty.classList.remove('hidden');
      elements.historyList.classList.add('hidden');
      elements.historyList.replaceChildren();
      elements.status.textContent = 'Identity loaded. No mentor scans recorded for today yet.';
      elements.status.className = 'status status-success';
      return;
    }

    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.remove('hidden');
    elements.historyList.replaceChildren(
      ...history.map((entry) => {
        const item = document.createElement('li');
        const mentorName = document.createElement('span');
        mentorName.className = 'history-name';
        mentorName.textContent = entry.mentorName;

        const meta = document.createElement('span');
        meta.className = 'history-meta';
        meta.textContent = entry.scannedAt
          ? `Scanned at ${formatTimestamp(entry.scannedAt)}`
          : 'Recorded for this event day.';

        item.append(mentorName, meta);
        return item;
      })
    );
    elements.status.textContent = 'Identity and mentor history loaded.';
    elements.status.className = 'status status-success';
  }

  function showIdentityError(message) {
    setState('error');
    elements.errorMessage.textContent = message;
    elements.status.textContent = 'Identity load failed.';
    elements.status.className = 'status status-error';
    elements.historyLoading.classList.add('hidden');
    elements.historyError.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();
  }

  function showHistoryError(message) {
    elements.historyLoading.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();
    elements.historyErrorMessage.textContent = message;
    elements.historyError.classList.remove('hidden');
    elements.status.textContent = 'Identity loaded, but mentor history could not be loaded.';
    elements.status.className = 'status status-error';
  }

  function setState(state) {
    elements.identityLoading.classList.toggle('hidden', state !== 'loading');
    elements.identitySuccess.classList.add('hidden');
    elements.identityError.classList.toggle('hidden', state !== 'error');
    elements.historyLoading.classList.toggle('hidden', state !== 'loading');
    if (state === 'loading') {
      elements.historyError.classList.add('hidden');
      elements.historyEmpty.classList.add('hidden');
      elements.historyList.classList.add('hidden');
    }
  }

  function formatTimestamp(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
})();
