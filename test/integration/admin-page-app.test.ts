import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event?: { preventDefault(): void }) => void | Promise<void>;

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
  readonly id = "";
  readonly dataset: Record<string, string> = {};
  readonly classList = new FakeClassList();
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  parent: FakeElement | null = null;
  textContent = "";
  innerHTML = "";
  value = "";
  disabled = false;
  type = "";
  role = "";
  ariaLive = "";

  constructor(tagName: string, id = "") {
    this.tagName = tagName.toUpperCase();
    Object.defineProperty(this, "id", {
      value: id,
      enumerable: true,
      configurable: true,
    });
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

  remove() {
    if (!this.parent) {
      return;
    }

    const index = this.parent.children.indexOf(this);

    if (index >= 0) {
      this.parent.children.splice(index, 1);
    }

    this.parent = null;
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
    if (name === "role") {
      this.role = value;
    }
    if (name === "aria-live") {
      this.ariaLive = value;
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

function createRowCell(tagName: string) {
  return new FakeElement(tagName);
}

function createDocument(elements: Record<string, FakeElement>) {
  return {
    getElementById(id: string) {
      return elements[id] ?? null;
    },
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
    createDocumentFragment() {
      return new FakeElement("fragment");
    },
    title: "",
  };
}

function createAdminDom() {
  const elements = {
    status: new FakeElement("div", "status-banner"),
    loading: new FakeElement("div", "records-loading"),
    empty: new FakeElement("p", "records-empty-state"),
    table: new FakeElement("table", "records-table"),
    body: new FakeElement("tbody", "records-table-body"),
    exportButton: new FakeElement("button", "export-csv-button"),
  };

  elements.table.appendChild(elements.body);

  const document = createDocument({
    "status-banner": elements.status,
    "records-loading": elements.loading,
    "records-empty-state": elements.empty,
    "records-table": elements.table,
    "records-table-body": elements.body,
    "export-csv-button": elements.exportButton,
  });

  return { elements, document };
}

function collectByTag(root: FakeElement, tagName: string): FakeElement[] {
  const upperTagName = tagName.toUpperCase();
  const collected: FakeElement[] = [];

  for (const child of root.children) {
    if (child.tagName === upperTagName) {
      collected.push(child);
    }

    collected.push(...collectByTag(child, upperTagName));
  }

  return collected;
}

function mockResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    headers: new Map(Object.entries(init?.headers ?? {})),
    async json() {
      return body;
    },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

async function loadAdminPageApp(pathname: string, responses: Array<ReturnType<typeof mockResponse>>) {
  vi.resetModules();
  const { elements, document } = createAdminDom();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = responses.shift();

    if (!response) {
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }

    return response as never;
  });

  vi.stubGlobal("document", document);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {
    location: { pathname },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    locationAssign: vi.fn(),
    open: vi.fn(),
    setTimeout,
    clearTimeout,
  });

  const browserWindow = (globalThis as unknown as {
    window: {
      location: { pathname: string; assign?: ReturnType<typeof vi.fn> };
      open: ReturnType<typeof vi.fn>;
    };
  }).window;

  browserWindow.location.assign = vi.fn();

  await import("../../public/admin/app.js");

  return { elements, fetchMock, exportAssign: browserWindow.location.assign };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("admin page app", () => {
  it("loads records, renders rows, and exports through the server endpoint", async () => {
    const payload = {
      eventDate: "2026-04-11",
      students: [{ personId: "student-1", displayName: "Ada Lovelace" }],
      mentors: [{ personId: "mentor-1", displayName: "Grace Hopper" }],
      records: [],
    };

    const { elements, fetchMock, exportAssign } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload), mockResponse("student name,secret id,mentor scanned,date,notes\n", {
        headers: { "content-type": "text/csv; charset=utf-8" },
      })]
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("/admin/admin-secret-token/api/records", expect.any(Object));
    expect(elements.loading.classList.contains("hidden")).toBe(true);
    expect(elements.empty.classList.contains("hidden")).toBe(false);
    expect(elements.status.textContent).toContain("No records");

    await elements.exportButton.click();

    expect(exportAssign).toHaveBeenCalledWith("/admin/admin-secret-token/api/export.csv");
  });

  it("renders editable rows and saves only changed fields", async () => {
    const payload = {
      eventDate: "2026-04-11",
      students: [
        { personId: "student-1", displayName: "Ada Lovelace" },
        { personId: "student-2", displayName: "Katherine Johnson" },
      ],
      mentors: [
        { personId: "mentor-1", displayName: "Grace Hopper" },
        { personId: "mentor-2", displayName: "Margaret Hamilton" },
      ],
      records: [
        {
          scanId: "scan-1",
          studentId: "student-1",
          studentName: "Ada Lovelace",
          studentSecretId: "student-secret-1",
          mentorId: "mentor-1",
          mentorName: "Grace Hopper",
          eventDate: "2026-04-11",
          scannedAt: "2026-04-11T08:00:00.000Z",
          notes: "Initial notes",
          updatedAt: "2026-04-11T08:00:00.000Z",
        },
      ],
    };

    const updatedRecord = {
      ...payload.records[0],
      notes: "Updated notes",
      mentorName: "Margaret Hamilton",
    };

    const { elements, fetchMock } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload), mockResponse({ ...updatedRecord })]
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(elements.empty.classList.contains("hidden")).toBe(true);
    expect(elements.body.children).toHaveLength(1);
    expect(elements.status.textContent).toBe("Records loaded and ready.");

    const row = elements.body.children[0];
    const selects = collectByTag(row, "select");
    const textarea = collectByTag(row, "textarea")[0];
    const buttons = collectByTag(row, "button");

    expect(selects).toHaveLength(2);
    expect(textarea).toBeTruthy();
    expect(buttons).toHaveLength(2);

    selects[0].value = "student-2";
    await selects[0].dispatch("change");
    textarea.value = "Updated notes";
    await textarea.dispatch("input");
    selects[1].value = "mentor-2";
    await selects[1].dispatch("change");
    await buttons[0].click();

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/admin-secret-token/api/records/scan-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ notes: "Updated notes", studentId: "student-2", mentorId: "mentor-2" }),
      })
    );
    expect(elements.status.textContent).toContain("Saved");
  });

  it("deletes rows and reports failures deterministically", async () => {
    const payload = {
      eventDate: "2026-04-11",
      students: [{ personId: "student-1", displayName: "Ada Lovelace" }],
      mentors: [{ personId: "mentor-1", displayName: "Grace Hopper" }],
      records: [
        {
          scanId: "scan-1",
          studentId: "student-1",
          studentName: "Ada Lovelace",
          studentSecretId: "student-secret-1",
          mentorId: "mentor-1",
          mentorName: "Grace Hopper",
          eventDate: "2026-04-11",
          scannedAt: "2026-04-11T08:00:00.000Z",
          notes: "Initial notes",
          updatedAt: "2026-04-11T08:00:00.000Z",
        },
      ],
    };

    const { elements, fetchMock } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload), mockResponse({ deleted: true, scanId: "scan-1" }), mockResponse({ error: "Delete blocked" }, { status: 500 })]
    );

    await Promise.resolve();
    await Promise.resolve();

    const row = elements.body.children[0];
    const buttons = collectByTag(row, "button");

    await buttons[1].click();

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/admin-secret-token/api/records/scan-1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(elements.body.children).toHaveLength(0);
    expect(elements.status.textContent).toContain("Deleted");

    const failedDeleteMount = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload), mockResponse({ error: "Delete blocked" }, { status: 500 })]
    );

    await Promise.resolve();
    await Promise.resolve();

    const failedRow = failedDeleteMount.elements.body.children[0];
    const failedButtons = collectByTag(failedRow, "button");

    await failedButtons[1].click();
    await Promise.resolve();
    await Promise.resolve();

    expect(failedDeleteMount.elements.body.children).toHaveLength(1);
    expect(failedDeleteMount.elements.status.textContent).toContain("Delete blocked");
  });
});
