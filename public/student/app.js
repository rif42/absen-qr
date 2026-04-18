import QrScanner from '/vendor/qr-scanner/qr-scanner.min.js';

(function () {
  const elements = {
    status: document.getElementById('status-banner'),
    identitySuccess: document.getElementById('identity-success'),
    identityError: document.getElementById('identity-error'),
    studentName: document.getElementById('student-name'),
    studentMeta: document.getElementById('student-meta'),
    errorMessage: document.getElementById('error-message'),
    scannerStage: document.getElementById('scanner-stage'),
    scannerVideo: document.getElementById('scanner-video'),
    scannerPlaceholder: document.getElementById('scanner-placeholder'),
    scannerPlaceholderTitle: document.getElementById('scanner-placeholder-title'),
    scannerPlaceholderCopy: document.getElementById('scanner-placeholder-copy'),
    scannerFeedback: document.getElementById('scanner-feedback'),
    scannerFeedbackTitle: document.getElementById('scanner-feedback-title'),
    scannerFeedbackCopy: document.getElementById('scanner-feedback-copy'),
    scannerToggleButton: document.getElementById('scanner-toggle-button'),
    fallbackRevealBtn: document.getElementById('fallback-reveal-btn'),
    fallbackForm: document.getElementById('fallback-form'),
    fallbackCodeInput: document.getElementById('fallback-code-input'),
    fallbackSubmitBtn: document.getElementById('fallback-submit-btn'),
    fallbackCancelBtn: document.getElementById('fallback-cancel-btn'),
    historyError: document.getElementById('history-error'),
    historyErrorMessage: document.getElementById('history-error-message'),
    historyEmpty: document.getElementById('history-empty'),
    historyList: document.getElementById('history-list'),
    retryButton: document.getElementById('retry-button'),
    historyRetryButton: document.getElementById('history-retry-button'),
  };

  function isDevHostname(hostname) {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') {
      return true;
    }
    const parts = hostname.split('.');
    if (parts.length === 4) {
      const octets = parts.map(Number);
      if (octets.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
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

  const studentPath = getStudentPath();
  let qrScanner = null;
  let scannerAvailability = 'unknown';
  let scannerActive = false;
  let scannerStarting = false;
  let scannerProcessing = false;
  let scanHandled = false;
  let studentReady = false;

  if (!studentPath) {
    showIdentityError('Invalid student link. Open this page from a /student/:secretToken URL.');
    return;
  }

  elements.retryButton.addEventListener('click', loadIdentity);
  elements.historyRetryButton.addEventListener('click', loadIdentity);
  elements.scannerToggleButton.addEventListener('click', toggleScanner);
  elements.fallbackRevealBtn.addEventListener('click', showFallbackForm);
  elements.fallbackCancelBtn.addEventListener('click', hideFallbackForm);
  elements.fallbackSubmitBtn.addEventListener('click', submitFallbackCode);
  window.addEventListener('pagehide', destroyScanner);
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
    studentReady = false;
    setState('loading');
    hideScanFeedback();
    await stopScanner(true);
    setScannerLockedState('Preparing scanner…', 'Your student identity must load before the camera can start.', 'neutral');

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
      studentReady = true;
      await prepareScanner();
    } catch (error) {
      studentReady = false;
      await stopScanner(true);
      showIdentityError(error instanceof Error ? error.message : 'Identity request failed.');
    }
  }

  async function loadHistory() {
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
    elements.identityError.classList.add('hidden');
    elements.identitySuccess.classList.remove('hidden');
    elements.historyError.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();

    elements.studentName.textContent = student.displayName;
    // elements.studentMeta.textContent = `Secret id: ${student.secretId}`;
    elements.status.textContent = 'Identity loaded. Loading today’s mentor history...';
    elements.status.className = 'status status-loading';
    document.title = `${student.displayName} • Student Attendance`;
  }

  function renderHistorySuccess(history) {
    elements.historyError.classList.add('hidden');

    if (history.length === 0) {
      elements.historyEmpty.classList.remove('hidden');
      elements.historyList.classList.add('hidden');
      elements.historyList.replaceChildren();
      elements.status.textContent = 'Identity loaded. No scans yet.';
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
    elements.status.textContent = 'Identity and history loaded.';
    elements.status.className = 'status status-success';
  }

  function showIdentityError(message) {
    setState('error');
    elements.errorMessage.textContent = message;
    elements.status.textContent = 'Identity load failed.';
    elements.status.className = 'status status-error';
    elements.historyError.classList.add('hidden');
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();
    setScannerUnavailable('Your student link needs to load before camera scanning can begin.', true);
  }

  function showHistoryError(message) {
    elements.historyEmpty.classList.add('hidden');
    elements.historyList.classList.add('hidden');
    elements.historyList.replaceChildren();
    elements.historyErrorMessage.textContent = message;
    elements.historyError.classList.remove('hidden');
    elements.status.textContent = 'Identity loaded, but mentor history could not be loaded.';
    elements.status.className = 'status status-error';
  }

  function setState(state) {
    elements.identitySuccess.classList.add('hidden');
    elements.identityError.classList.toggle('hidden', state !== 'error');
    if (state === 'loading') {
      elements.historyError.classList.add('hidden');
      elements.historyEmpty.classList.add('hidden');
      elements.historyList.classList.add('hidden');
    }
  }

  async function prepareScanner() {
    if (!studentReady) {
      return;
    }

    if (!window.isSecureContext && !isDevHostname(location.hostname)) {
      setScannerUnavailable('Camera scanning requires HTTPS or localhost. Open the page in a secure context to continue.', true);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScannerUnavailable('This browser does not support camera access for QR scanning.', true);
      return;
    }

    if (scannerAvailability === 'ready' && qrScanner) {
      setScannerStopped('Scanner stopped. Tap Start scanner to read a mentor QR code.', 'Start scanner', false);
      return;
    }

    setScannerLoading('Checking camera availability…', 'We are looking for a usable camera on this device.', true);

    const hasCamera = await QrScanner.hasCamera().catch(() => false);

    if (!hasCamera) {
      setScannerUnavailable('No camera was found on this device. Connect a camera or use a device with camera access.', true);
      return;
    }

    if (!qrScanner) {
      qrScanner = new QrScanner(
        elements.scannerVideo,
        handleScanDecoded,
        {
          preferredCamera: 'environment',
          maxScansPerSecond: 8,
          returnDetailedScanResult: true,
          onDecodeError: handleScanDecodeError,
        }
      );
    }

    scannerAvailability = 'ready';
    setScannerStopped('Scanner stopped. Tap Start scanner to read a mentor QR code.', 'Start scanner', false);
  }

  async function toggleScanner() {
    if (!studentReady || scannerAvailability === 'unavailable') {
      return;
    }

    if (scannerActive || scannerStarting || scannerProcessing) {
      await stopScanner(false);
      return;
    }

    await startScanner();
  }

  async function startScanner() {
    if (!studentReady) {
      return;
    }

    if (scannerAvailability !== 'ready' || !qrScanner) {
      await prepareScanner();

      if (scannerAvailability !== 'ready' || !qrScanner) {
        return;
      }
    }

    hideScanFeedback();
    scanHandled = false;
    scannerStarting = true;
    scannerProcessing = false;
    setPageStatus('loading', 'Opening camera…');
    setScannerStarting('Starting camera…', 'Allow camera access when your browser asks, then point the device at a mentor QR code.', true);

    try {
      await qrScanner.start();
      scannerActive = true;
      scannerStarting = false;
      setPageStatus('loading', 'Camera active. Point it at a mentor QR code.');
      setScannerScanning('Camera active. Point it at a mentor QR code.', 'When a mentor QR is recognized, the camera will pause and the scan will be saved.', false);
    } catch (error) {
      scannerStarting = false;
      scannerActive = false;

      if (isPermissionDeniedError(error)) {
        setScannerPermissionDenied(
          'Camera permission was denied. Allow access in your browser settings, then tap Start scanner again.',
          false
        );
        return;
      }

      if (isCameraUnavailableError(error)) {
        setScannerUnavailable(
          'The browser could not find an available camera. Attach a camera or switch devices, then try again.',
          true
        );
        return;
      }

      setScannerErrorState(
        'Camera scanner failed to start.',
        error instanceof Error ? error.message : 'The browser rejected camera access or could not open the camera.',
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

    if (!fromReset && scannerAvailability === 'ready') {
      setScannerStopped('Scanner stopped. Tap Start scanner to scan another mentor QR code.', 'Start scanner', false);
      setPageStatus('neutral', 'Scanner stopped.');
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
        'Unreadable QR code.',
        'The camera read something, but it did not contain a usable mentor payload.',
        false
      );
      return;
    }

    setPageStatus('loading', 'QR code decoded. Saving the mentor scan…');
    setScannerProcessing('QR code decoded. Saving the mentor scan…', 'The camera has paused while the decoded payload is being sent to the attendance service.', true);

    try {
      const response = await fetch(`${studentPath}/api/scan`, {
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

      setScanFeedback(
        'success',
        'Scan recorded',
        'Your mentor scan was accepted. Refreshing today\'s history now.'
      );

      await loadHistory();

      // Show dialog on successful scan
      alert('SCAN SUCCESSFUL! ' + (responseBody.mentor?.displayName || 'Mentor'));

      setPageStatus('success', 'Mentor scan recorded. Today’s history has been refreshed.');
      setScannerStopped('Scanner stopped. Tap Start scanner to scan another mentor QR code.', 'Start scanner', false);
    } catch (error) {
      const feedbackTitle = error instanceof Error && typeof error.title === 'string' ? error.title : 'Scan failed';
      const feedbackCopy = error instanceof Error ? error.message : 'The mentor QR code could not be saved.';

      setScanFeedback(
        'error',
        feedbackTitle,
        feedbackCopy
      );
      setPageStatus('error', feedbackCopy);
      setScannerStopped('Scanner stopped. Fix the issue and tap Start scanner to try again.', 'Start scanner', false);
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
      'Camera read error.',
      error instanceof Error ? error.message : 'The camera could not decode that frame cleanly.',
      false
    );
  }

  function setPageStatus(tone, message) {
    elements.status.textContent = message;
    elements.status.className = `status status-${tone}`;
  }

  function setScannerLoading(title, copy, disableButton) {
    scannerAvailability = 'loading';
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = title;
    elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton('Starting camera…', true, disableButton);
  }

  function setScannerStarting(title, copy, disableButton) {
    scannerAvailability = 'ready';
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = title;
    elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton('Opening camera…', true, disableButton);
  }

  function setScannerScanning(title, copy, disableButton) {
    updateScannerStage(true);
    elements.scannerPlaceholderTitle.textContent = title;
    elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton('Stop scanner', false, disableButton);
  }

  function setScannerProcessing(title, copy, disableButton) {
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = title;
    elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton('Scanner paused', true, disableButton);
  }

  function setScannerStopped(copy, buttonText, disableButton) {
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = 'Scanner stopped';
    elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton(buttonText, true, disableButton);
  }

  function setScannerUnavailable(copy, disableButton) {
    scannerAvailability = 'unavailable';
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = 'Camera unavailable';
    elements.scannerPlaceholderCopy.textContent = copy;
    setPageStatus('error', 'Camera unavailable.');
    setScannerButton('Start scanner', true, disableButton);
  }

  function setScannerPermissionDenied(copy, disableButton) {
    scannerAvailability = 'ready';
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = 'Camera permission denied';
    elements.scannerPlaceholderCopy.textContent = copy;
    setPageStatus('error', 'Camera permission denied.');
    setScannerButton('Start scanner', false, disableButton);
  }

  function setScannerErrorState(title, copy, disableButton) {
    scannerAvailability = 'ready';
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = title;
    elements.scannerPlaceholderCopy.textContent = copy;
    setPageStatus('error', title);
    setScannerButton('Start scanner', false, disableButton);
  }

  function setScannerLockedState(title, copy, tone) {
    scannerAvailability = 'unknown';
    updateScannerStage(false);
    elements.scannerPlaceholderTitle.textContent = title;
    elements.scannerPlaceholderCopy.textContent = copy;
    setScannerButton('Start scanner', true, true);
  }

  function setScannerPill(tone, text) {
    elements.scannerStatus.textContent = text;
    elements.scannerStatus.className = `status status-${tone}`;
  }

  function setScannerButton(label, restart, disableButton) {
    elements.scannerToggleButton.textContent = label;
    elements.scannerToggleButton.disabled = disableButton;

    if (!disableButton && restart) {
      elements.scannerToggleButton.disabled = false;
    }
  }

  function updateScannerStage(active) {
    elements.scannerStage.classList.toggle('is-active', active);
  }

  function setScanFeedback(tone, title, copy) {
    elements.scannerFeedback.classList.remove('hidden');
    elements.scannerFeedback.classList.toggle('is-success', tone === 'success');
    elements.scannerFeedback.classList.toggle('is-error', tone === 'error');
    elements.scannerFeedbackTitle.textContent = title;
    elements.scannerFeedbackCopy.textContent = copy;
    elements.scannerFeedback.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    elements.scannerFeedback.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  }

  function hideScanFeedback() {
    elements.scannerFeedback.classList.add('hidden');
    elements.scannerFeedback.classList.remove('is-success', 'is-error');
    elements.scannerFeedbackTitle.textContent = '';
    elements.scannerFeedbackCopy.textContent = '';
  }

  function showFallbackForm() {
    elements.fallbackForm.classList.remove('hidden');
    elements.fallbackCodeInput.value = '';
    hideScanFeedback();
  }

  function hideFallbackForm() {
    elements.fallbackForm.classList.add('hidden');
    elements.fallbackCodeInput.value = '';
  }

  async function submitFallbackCode() {
    const rawCode = elements.fallbackCodeInput.value || '';
    const code = rawCode.replace(/\s/g, '');

    if (!code || !/^\d{8}$/.test(code)) {
      showFallbackError('Please enter a valid 8-digit code.');
      return;
    }

    elements.fallbackSubmitBtn.disabled = true;
    hideScanFeedback();

    try {
      const response = await fetch(`${studentPath}/api/redeem-code`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const responseBody = await readJson(response);

      if (!response.ok) {
        throw buildFallbackError(response.status, responseBody);
      }

      setScanFeedback(
        'success',
        'Code accepted',
        'Your mentor scan was recorded. Refreshing today\u2019s history now.'
      );

      await loadHistory();

      // Show dialog on successful scan
      alert('SCAN SUCCESSFUL! ' + (responseBody.scan?.mentorName || 'Mentor'));
      hideFallbackForm();
      await stopScanner(true);
      setPageStatus('success', 'Mentor scan recorded. Today\u2019s history has been refreshed.');
      setScannerStopped('Scanner stopped. Tap Start scanner to scan another mentor QR code.', 'Start scanner', false);
    } catch (error) {
      const feedbackTitle = error instanceof Error && typeof error.title === 'string' ? error.title : 'Code submission failed';
      const feedbackCopy = error instanceof Error ? error.message : 'The one-time code could not be redeemed.';

      showFallbackError(feedbackCopy);
    } finally {
      elements.fallbackSubmitBtn.disabled = false;
    }
  }

  function showFallbackError(message) {
    setScanFeedback('error', 'Code rejected', message);
  }

  function buildFallbackError(status, payload) {
    const detail = getPayloadMessage(payload);

    if (status === 400) {
      return createScanError('Invalid or expired fallback code.', detail || 'Invalid or expired fallback code.');
    }

    if (status === 409) {
      return createScanError('Duplicate scan', detail || 'Duplicate mentor scan already recorded for this calendar day.');
    }

    if (status === 429) {
      return createScanError('Too many attempts', detail || 'Too many failed redemption attempts. Please wait a moment and try again.');
    }

    if (status === 401 || status === 403) {
      return createScanError('Submission blocked', detail || 'This student link is not allowed to submit codes right now.');
    }

    return createScanError('Code submission failed', detail || `Code submission failed with status ${status}.`);
  }

  function normalizeDecodedPayload(result) {
    const raw = typeof result === 'string' ? result : result?.data;

    if (typeof raw !== 'string') {
      return '';
    }

    return raw.trim();
  }

  function buildScanError(status, payload) {
    const detail = getPayloadMessage(payload);

    if (status === 400) {
      return createScanError('Invalid QR code', detail || 'The decoded QR payload is not a valid mentor attendance link.');
    }

    if (status === 409) {
      return createScanError('Duplicate scan', 'You already scanned this mentor today. Try a different mentor or stop the scanner.');
    }

    if (status === 401 || status === 403) {
      return createScanError('Scan blocked', detail || 'This student link is not allowed to submit scans right now.');
    }

    return createScanError('Scan failed', detail || `Scan submission failed with status ${status}.`);
  }

  function createScanError(title, message) {
    const error = new Error(message);
    error.title = title;
    return error;
  }

  function getPayloadMessage(payload) {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const message = payload.message || payload.error || payload.detail || payload.reason;

    if (typeof message === 'string') {
      return message;
    }

    if (message && typeof message === 'object') {
      return message.message || message.error || message.detail || message.reason || '';
    }

    return '';
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function isPermissionDeniedError(error) {
    const message = `${error?.name || ''} ${error instanceof Error ? error.message : error || ''}`.toLowerCase();
    return (
      message.includes('notallowederror') ||
      message.includes('permission denied') ||
      message.includes('denied') ||
      message.includes('securityerror')
    );
  }

  function isCameraUnavailableError(error) {
    const message = `${error?.name || ''} ${error instanceof Error ? error.message : error || ''}`.toLowerCase();
    return (
      message.includes('notfounderror') ||
      message.includes('overconstrainederror') ||
      message.includes('camera not found') ||
      message.includes('camera unavailable')
    );
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

