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
    historyEmpty: document.getElementById('history-empty'),
    historyList: document.getElementById('history-list'),
    retryButton: document.getElementById('retry-button'),
  };

  const studentPath = getStudentPath();

  if (!studentPath) {
    showError('Invalid student link. Open this page from a /student/:secretToken URL.');
    return;
  }

  elements.retryButton.addEventListener('click', loadIdentity);
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

      renderSuccess(student, normalizeHistory(payload));
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Identity request failed.');
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
      payload?.history ||
      payload?.scans ||
      payload?.records ||
      payload?.mentorHistory ||
      [];

    if (!Array.isArray(source)) {
      return [];
    }

    return source.map((entry) => ({
      mentorName:
        entry.mentorName || entry.mentor_name || entry.displayName || entry.display_name || entry.name || 'Mentor',
      scannedAt: entry.scannedAt || entry.scanned_at || entry.updatedAt || entry.updated_at || '',
    }));
  }

  function renderSuccess(student, history) {
    elements.identityLoading.classList.add('hidden');
    elements.identityError.classList.add('hidden');
    elements.identitySuccess.classList.remove('hidden');
    elements.historyLoading.classList.add('hidden');

    elements.studentName.textContent = student.displayName;
    elements.studentMeta.textContent = `Secret id: ${student.secretId}`;
    elements.status.textContent = 'Identity loaded successfully.';
    elements.status.className = 'status status-success';
    document.title = `${student.displayName} • Student Attendance`;

    if (history.length === 0) {
      elements.historyEmpty.classList.remove('hidden');
      elements.historyList.classList.add('hidden');
      elements.historyList.replaceChildren();
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
  }

  function showError(message) {
    setState('error');
    elements.errorMessage.textContent = message;
    elements.status.textContent = 'Identity load failed.';
    elements.status.className = 'status status-error';
    elements.historyLoading.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();
  }

  function setState(state) {
    elements.identityLoading.classList.toggle('hidden', state !== 'loading');
    elements.identitySuccess.classList.add('hidden');
    elements.identityError.classList.toggle('hidden', state !== 'error');
    elements.historyLoading.classList.toggle('hidden', state !== 'loading');
    if (state === 'loading') {
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
