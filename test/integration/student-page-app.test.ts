import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

type Listener = (event?: { preventDefault(): void }) => void | Promise<void>;

const qrScannerState = vi.hoisted(() => ({
  hasCamera: vi.fn(),
  start: vi.fn(),
  pause: vi.fn(),
  destroy: vi.fn(),
  instances: [] as unknown[],
}));

function createQrScannerMock() {
  return class MockQrScanner {
    static NO_QR_CODE_FOUND = "NO_QR_CODE_FOUND";
    static hasCamera = qrScannerState.hasCamera;

    start = qrScannerState.start;
    pause = qrScannerState.pause;
    destroy = qrScannerState.destroy;

    constructor() {
      qrScannerState.instances.push(this);
    }
  };
}

const studentAppSource = readFileSync(new URL("../../public/student/app.js", import.meta.url), "utf8");
const studentAppExecutableSource = studentAppSource
  .replace("﻿", "")
  .split("import QrScanner from '/vendor/qr-scanner/qr-scanner.min.js';")
  .join("");

function executeStudentPageApp() {
  const runStudentPageApp = new Function("QrScanner", `${studentAppExecutableSource}\n//# sourceURL=public/student/app.js`);
  runStudentPageApp(createQrScannerMock());
}


class FakeClassList {
  private readonly classes = new Set<string>();

  add(...names: string[]) {
    for (const name of names) {
      this.classes.add(name);
    }
  }

  remove(...names: string[]) {
    for (const name of names) {
      this.classes.delete(name);
    }
  }

  toggle(name: string, force?: boolean) {
    if (force === true) {
      this.classes.add(name);
      return true;
    }

    if (force === false) {
      this.classes.delete(name);
      return false;
    }

    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }

    this.classes.add(name);
    return true;
  }

  contains(name: string) {
    return this.classes.has(name);
  }

  toString() {
    return [...this.classes].join(" ");
  }
}

class FakeElement {
  readonly tagName: string;
  readonly classList = new FakeClassList();
  readonly children: FakeElement[] = [];
  readonly listeners = new Map<string, Listener[]>();
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  textContent = "";
  innerHTML = "";
  className = "";
  value = "";
  disabled = false;
  hidden = false;
  style: Record<string, string> = {};

  constructor(tagName: string, readonly id = "") {
    this.tagName = tagName.toUpperCase();
  }

  append(...nodes: Array<FakeElement | string>) {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.textContent += node;
        continue;
      }

      this.appendChild(node);
    }
  }

  appendChild(node: FakeElement) {
    node.parent = this;
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes: Array<FakeElement | string>) {
    this.children.length = 0;
    this.textContent = "";

    for (const node of nodes) {
      this.append(node);
    }
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);

    if (name === "class") {
      this.className = value;
    }
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  async dispatch(type: string) {
    const listeners = this.listeners.get(type) ?? [];
    const event = { preventDefault() {} };

    for (const listener of listeners) {
      await listener(event);
    }
  }

  click() {
    return this.dispatch("click");
  }
}

function createDocument(elements: Record<string, FakeElement>) {
  return {
    title: "",
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getElementById(id: string) {
      return elements[id] ?? null;
    },
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
    createDocumentFragment() {
      return new FakeElement("fragment");
    },
  };
}

function mockResponse(body: unknown, init?: { status?: number }) {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    async json() {
      return body;
    },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

function createStudentDom() {
  const elements = {
    status: new FakeElement("div", "status-banner"),
    identityLoading: new FakeElement("div", "identity-loading"),
    identitySuccess: new FakeElement("div", "identity-success"),
    identityError: new FakeElement("div", "identity-error"),
    studentName: new FakeElement("p", "student-name"),
    studentMeta: new FakeElement("p", "student-meta"),
    errorMessage: new FakeElement("p", "error-message"),
    scannerStage: new FakeElement("div", "scanner-stage"),
    scannerVideo: new FakeElement("video", "scanner-video"),
    scannerPlaceholder: new FakeElement("div", "scanner-placeholder"),
    scannerPlaceholderTitle: new FakeElement("p", "scanner-placeholder-title"),
    scannerPlaceholderCopy: new FakeElement("p", "scanner-placeholder-copy"),
    scannerStatus: new FakeElement("p", "scanner-status"),
    scannerFeedback: new FakeElement("div", "scanner-feedback"),
    scannerFeedbackTitle: new FakeElement("p", "scanner-feedback-title"),
    scannerFeedbackCopy: new FakeElement("p", "scanner-feedback-copy"),
    scannerToggleButton: new FakeElement("button", "scanner-toggle-button"),
    scannerPermissionRetryButton: new FakeElement("button", "scanner-permission-retry-button"),
    fallbackRevealBtn: new FakeElement("button", "fallback-reveal-btn"),
    fallbackForm: new FakeElement("div", "fallback-form"),
    fallbackCodeInput: new FakeElement("input", "fallback-code-input"),
    fallbackSubmitBtn: new FakeElement("button", "fallback-submit-btn"),
    fallbackCancelBtn: new FakeElement("button", "fallback-cancel-btn"),
    historyError: new FakeElement("div", "history-error"),
    historyErrorMessage: new FakeElement("p", "history-error-message"),
    historyEmpty: new FakeElement("div", "history-empty"),
    historyList: new FakeElement("ul", "history-list"),
    retryButton: new FakeElement("button", "retry-button"),
    historyRetryButton: new FakeElement("button", "history-retry-button"),
  };

  elements.scannerPermissionRetryButton.classList.add("hidden");

  const document = createDocument({
    "status-banner": elements.status,
    "identity-loading": elements.identityLoading,
    "identity-success": elements.identitySuccess,
    "identity-error": elements.identityError,
    "student-name": elements.studentName,
    "student-meta": elements.studentMeta,
    "error-message": elements.errorMessage,
    "scanner-stage": elements.scannerStage,
    "scanner-video": elements.scannerVideo,
    "scanner-placeholder": elements.scannerPlaceholder,
    "scanner-placeholder-title": elements.scannerPlaceholderTitle,
    "scanner-placeholder-copy": elements.scannerPlaceholderCopy,
    "scanner-status": elements.scannerStatus,
    "scanner-feedback": elements.scannerFeedback,
    "scanner-feedback-title": elements.scannerFeedbackTitle,
    "scanner-feedback-copy": elements.scannerFeedbackCopy,
    "scanner-toggle-button": elements.scannerToggleButton,
    "scanner-permission-retry-button": elements.scannerPermissionRetryButton,
    "fallback-reveal-btn": elements.fallbackRevealBtn,
    "fallback-form": elements.fallbackForm,
    "fallback-code-input": elements.fallbackCodeInput,
    "fallback-submit-btn": elements.fallbackSubmitBtn,
    "fallback-cancel-btn": elements.fallbackCancelBtn,
    "history-error": elements.historyError,
    "history-error-message": elements.historyErrorMessage,
    "history-empty": elements.historyEmpty,
    "history-list": elements.historyList,
    "retry-button": elements.retryButton,
    "history-retry-button": elements.historyRetryButton,
  });

  return { elements, document };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function loadStudentPageApp(options?: { scannerStartImpl?: () => Promise<void> }) {
  vi.resetModules();
  qrScannerState.hasCamera.mockReset();
  qrScannerState.hasCamera.mockResolvedValue(true);
  qrScannerState.start.mockReset();
  qrScannerState.start.mockImplementation(
    options?.scannerStartImpl ?? (async () => {
      throw Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    })
  );
  qrScannerState.pause.mockReset();
  qrScannerState.pause.mockResolvedValue(undefined);
  qrScannerState.destroy.mockReset();
  qrScannerState.destroy.mockImplementation(() => {});
  qrScannerState.instances.length = 0;

  const { elements, document } = createStudentDom();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/me")) {
      return mockResponse({ student: { displayName: "Student Local 01", secretId: "student-secret-001" } });
    }

    if (url.endsWith("/api/history")) {
      return mockResponse({ history: [] });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const location = {
    pathname: "/student/local-student-token-001",
    hostname: "localhost",
    search: "",
  };

  const notification = {
    permission: "denied",
    requestPermission: vi.fn(),
  };

  vi.stubGlobal("document", document);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", location);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(),
    },
  });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("alert", vi.fn());
  vi.stubGlobal("window", {
    location,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    history: { replaceState: vi.fn() },
    isSecureContext: true,
    Notification: notification,
    setTimeout,
    clearTimeout,
  });

  executeStudentPageApp();

  await flushMicrotasks();

  return { elements, fetchMock };
}

function createSessionStorage(initialValues?: Record<string, string>) {
  const store = new Map(Object.entries(initialValues ?? {}));

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

async function loadStudentPageAppWithOptions(options?: {
  scannerStartImpl?: () => Promise<void>;
  historyPayload?: unknown;
  sessionStorage?: ReturnType<typeof createSessionStorage>;
  alertMock?: ReturnType<typeof vi.fn>;
}) {
  vi.resetModules();
  qrScannerState.hasCamera.mockReset();
  qrScannerState.hasCamera.mockResolvedValue(true);
  qrScannerState.start.mockReset();
  qrScannerState.start.mockImplementation(
    options?.scannerStartImpl ?? (async () => {
      throw Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
    })
  );
  qrScannerState.pause.mockReset();
  qrScannerState.pause.mockResolvedValue(undefined);
  qrScannerState.destroy.mockReset();
  qrScannerState.destroy.mockImplementation(() => {});
  qrScannerState.instances.length = 0;

  const { elements, document } = createStudentDom();
  const historyPayload = options?.historyPayload ?? { history: [] };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/me")) {
      return mockResponse({ student: { displayName: "Student Local 01", secretId: "student-secret-001" } });
    }

    if (url.endsWith("/api/history")) {
      return mockResponse(historyPayload);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  const location = {
    pathname: "/student/local-student-token-001",
    hostname: "localhost",
    search: "",
  };

  const notification = {
    permission: "denied",
    requestPermission: vi.fn(),
  };
  const alertMock = options?.alertMock ?? vi.fn();
  const sessionStorage = options?.sessionStorage ?? createSessionStorage();

  vi.stubGlobal("document", document);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", location);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(),
    },
  });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("alert", alertMock);
  vi.stubGlobal("sessionStorage", sessionStorage);
  vi.stubGlobal("window", {
    location,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    history: { replaceState: vi.fn() },
    isSecureContext: true,
    Notification: notification,
    sessionStorage,
    setTimeout,
    clearTimeout,
  });

  executeStudentPageApp();

  await flushMicrotasks();

  return { elements, fetchMock, alertMock, sessionStorage };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("student page app", () => {
  it("keeps the permission retry button hidden during normal scanner states", async () => {
    const { elements } = await loadStudentPageApp({ scannerStartImpl: async () => {} });

    expect(elements.scannerPermissionRetryButton.classList.contains("hidden")).toBe(true);

    await elements.scannerToggleButton.click();
    await flushMicrotasks();

    expect(elements.scannerPermissionRetryButton.classList.contains("hidden")).toBe(true);
  });

  it("shows the permission retry button only after scanner permission is denied", async () => {
    const { elements } = await loadStudentPageApp();

    expect(elements.scannerPermissionRetryButton.classList.contains("hidden")).toBe(true);

    await elements.scannerToggleButton.click();
    await flushMicrotasks();

    expect(elements.scannerPermissionRetryButton.classList.contains("hidden")).toBe(false);
  });

  it("re-enters scanner startup when the permission retry button is clicked", async () => {
    const { elements } = await loadStudentPageApp();

    await elements.scannerToggleButton.click();
    await flushMicrotasks();

    expect(qrScannerState.start).toHaveBeenCalledTimes(1);

    await elements.scannerPermissionRetryButton.click();
    await flushMicrotasks();

    expect(qrScannerState.start).toHaveBeenCalledTimes(2);
  });

  it("does not re-notify the same student note after a page refresh", async () => {
    const sharedSessionStorage = createSessionStorage();
    const sharedAlertMock = vi.fn();
    const historyPayload = {
      history: [
        {
          mentorName: "Mentor Alpha",
          scannedAt: "2026-04-23T10:00:00Z",
          notes: "Great follow-up",
        },
      ],
    };

    await loadStudentPageAppWithOptions({
      historyPayload,
      sessionStorage: sharedSessionStorage,
      alertMock: sharedAlertMock,
    });

    await loadStudentPageAppWithOptions({
      historyPayload,
      sessionStorage: sharedSessionStorage,
      alertMock: sharedAlertMock,
    });

    expect(sharedAlertMock).toHaveBeenCalledTimes(1);
  });
});
