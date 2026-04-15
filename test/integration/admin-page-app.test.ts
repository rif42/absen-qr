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
  className = "";
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
    startDate: new FakeElement("input", "startDate"),
    endDate: new FakeElement("input", "endDate"),
    applyButton: new FakeElement("button", "apply-filters-button"),
  };

  elements.table.appendChild(elements.body);

  const document = createDocument({
    "status-banner": elements.status,
    "records-loading": elements.loading,
    "records-empty-state": elements.empty,
    "records-table": elements.table,
    "records-table-body": elements.body,
    "export-csv-button": elements.exportButton,
    startDate: elements.startDate,
    endDate: elements.endDate,
    "apply-filters-button": elements.applyButton,
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

async function loadAdminPageApp(
  pathname: string,
  responses: Array<ReturnType<typeof mockResponse>>,
  search = ""
) {
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
  const replaceState = vi.fn();
  vi.stubGlobal("window", {
    location: { pathname, search },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    locationAssign: vi.fn(),
    open: vi.fn(),
    history: { replaceState },
    setTimeout,
    clearTimeout,
  });

  const browserWindow = (globalThis as unknown as {
    window: {
      location: { pathname: string; assign?: ReturnType<typeof vi.fn> };
      open: ReturnType<typeof vi.fn>;
      history: { replaceState: ReturnType<typeof vi.fn> };
    };
  }).window;

  browserWindow.location.assign = vi.fn();

  await import("../../public/admin/app.js");

  return { elements, fetchMock, exportAssign: browserWindow.location.assign, replaceState };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("admin page app", () => {
  it("renders each record as four compact cells and swaps controls in edit mode", async () => {
    const payload = {
      records: [
        {
          scanId: "scan-001",
          studentId: "student-001",
          studentName: "Student Local 01",
          mentorId: "mentor-001",
          mentorName: "Mentor Local 01",
          notes: "Initial notes",
          eventDate: "2026-04-11",
          scannedAt: "2026-04-11T08:00:00.000Z",
          updatedAt: "2026-04-11T08:00:00.000Z",
        },
      ],
      students: [
        { personId: "student-001", displayName: "Student Local 01" },
        { personId: "student-002", displayName: "Student Local 02" },
      ],
      mentors: [
        { personId: "mentor-001", displayName: "Mentor Local 01" },
        { personId: "mentor-002", displayName: "Mentor Local 02" },
      ],
      dateFilter: { startDate: "2026-04-11", endDate: "2026-04-11" },
    };

    const { elements } = await loadAdminPageApp("/admin/admin-secret-token/", [mockResponse(payload)]);

    await Promise.resolve();
    await Promise.resolve();

    const row = elements.body.children[0];
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;
    expect(elements.body.children).toHaveLength(1);
    expect(row.children).toHaveLength(4);
    expect(row.dataset.rowState).toBe("locked");
    expect(refs.studentText.textContent).toContain("Student Local 01");
    expect(refs.mentorText.textContent).toContain("Mentor Local 01");
    expect(refs.notesText.textContent).toContain("Initial notes");
    expect(collectByTag(row, "select")).toHaveLength(0);
    expect(collectByTag(row, "textarea")).toHaveLength(0);
    expect(collectByTag(row, "button")).toHaveLength(2);
    expect(refs.actionCell.children).toHaveLength(1);
    expect(refs.actionCell.children[0].className).toBe("record-actions");
    expect(collectByTag(row, "button")[0].textContent).toBe("Edit");
    expect(collectByTag(row, "button")[1].textContent).toBe("Delete");

    await refs.editButton.click();

    expect(row.dataset.rowState).toBe("editing");
    expect(collectByTag(row, "select")).toHaveLength(2);
    expect(collectByTag(row, "textarea")).toHaveLength(1);
    expect(collectByTag(row, "button")).toHaveLength(2);
    expect(refs.actionCell.children).toHaveLength(1);
    expect(refs.actionCell.children[0].className).toBe("record-actions");
    expect(collectByTag(row, "button")[0].textContent).toBe("Save");
    expect(collectByTag(row, "button")[1].textContent).toBe("Delete");
  });

  it("loads the active date range from the URL and keeps export aligned", async () => {
    const payload = {
      records: [],
      students: [],
      mentors: [],
      dateFilter: { startDate: "2026-04-11", endDate: "2026-04-11" },
    };

    const { elements, fetchMock, exportAssign } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      
      [mockResponse(payload), mockResponse("student name,secret id,mentor scanned,date,notes\n", {
        headers: { "content-type": "text/csv; charset=utf-8" },
      })],
      "?startDate=2026-04-11&endDate=2026-04-11"
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/admin-secret-token/api/records?startDate=2026-04-11&endDate=2026-04-11",
      expect.any(Object)
    );
    expect(elements.startDate.value).toBe("2026-04-11");
    expect(elements.endDate.value).toBe("2026-04-11");

    await elements.exportButton.click();

    expect(exportAssign).toHaveBeenCalledWith(
      "/admin/admin-secret-token/api/export.csv?startDate=2026-04-11&endDate=2026-04-11"
    );
  });

  it("uses server dateFilter for the default range and normalizes the URL", async () => {
    const payload = {
      records: [],
      students: [],
      mentors: [],
      dateFilter: { startDate: "2026-04-11", endDate: "2026-04-11" },
    };

    const { elements, fetchMock, replaceState } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload)]
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith("/admin/admin-secret-token/api/records", expect.any(Object));
    expect(elements.startDate.value).toBe("2026-04-11");
    expect(elements.endDate.value).toBe("2026-04-11");
    expect(replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/admin/admin-secret-token/?startDate=2026-04-11&endDate=2026-04-11"
    );
  });

  it("blocks invalid apply attempts before issuing a fetch", async () => {
    const payload = {
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
      students: [{ personId: "student-1", displayName: "Ada Lovelace" }],
      mentors: [{ personId: "mentor-1", displayName: "Grace Hopper" }],
      dateFilter: { startDate: "2026-04-11", endDate: "2026-04-11" },
    };

    const { elements, fetchMock } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload)]
    );

    await Promise.resolve();
    await Promise.resolve();

    elements.startDate.value = "2026-04-12";
    elements.endDate.value = "2026-04-11";
    await elements.applyButton.click();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(elements.status.textContent).toContain("Start date must be on or before end date.");
    expect(elements.body.children).toHaveLength(1);
    expect(elements.body.children[0].dataset.rowState).toBe("locked");
  });

  it("blocks empty apply attempts before issuing a fetch", async () => {
    const payload = {
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
      students: [{ personId: "student-1", displayName: "Ada Lovelace" }],
      mentors: [{ personId: "mentor-1", displayName: "Grace Hopper" }],
      dateFilter: { startDate: "2026-04-11", endDate: "2026-04-11" },
    };

    const { elements, fetchMock } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload)]
    );

    await Promise.resolve();
    await Promise.resolve();

    elements.startDate.value = "";
    elements.endDate.value = "2026-04-11";
    await elements.applyButton.click();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(elements.status.textContent).toContain("Start and end dates are required.");
    expect(elements.body.children).toHaveLength(1);
    expect(elements.body.children[0].dataset.rowState).toBe("locked");
  });

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

  it("locks rows by default and unlocks only the targeted row", async () => {
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
        {
          scanId: "scan-2",
          studentId: "student-2",
          studentName: "Katherine Johnson",
          studentSecretId: "student-secret-2",
          mentorId: "mentor-2",
          mentorName: "Margaret Hamilton",
          eventDate: "2026-04-11",
          scannedAt: "2026-04-11T09:00:00.000Z",
          notes: "Second row notes",
          updatedAt: "2026-04-11T09:00:00.000Z",
        },
      ],
    };

    const { elements, fetchMock } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload)]
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(elements.empty.classList.contains("hidden")).toBe(true);
    expect(elements.body.children).toHaveLength(2);
    expect(elements.status.textContent).toBe("Records loaded and ready.");

    const row = elements.body.children[0];
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;

    expect(collectByTag(row, "select")).toHaveLength(0);
    expect(collectByTag(row, "textarea")).toHaveLength(0);
    expect(collectByTag(row, "button")).toHaveLength(2);
    expect(row.dataset.rowState).toBe("locked");
    expect(row.classList.contains("row-locked")).toBe(true);
    expect(row.classList.contains("row-editing")).toBe(false);
    expect(refs.editButton.textContent).toBe("Edit");
    expect(refs.deleteButton.textContent).toBe("Delete");
    expect(refs.editButton.disabled).toBe(false);
    expect(refs.deleteButton.disabled).toBe(false);

    await refs.editButton.click();

    expect(row.dataset.rowState).toBe("editing");
    expect(row.classList.contains("row-locked")).toBe(false);
    expect(row.classList.contains("row-editing")).toBe(true);
    expect(collectByTag(row, "select")).toHaveLength(2);
    expect(collectByTag(row, "textarea")).toHaveLength(1);
    expect(refs.studentSelect.disabled).toBe(false);
    expect(refs.mentorSelect.disabled).toBe(false);
    expect(refs.notesTextarea.disabled).toBe(false);
    expect(refs.saveButton.disabled).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(elements.body.children[1]).toBeTruthy();
    const secondRow = elements.body.children[1];
    const secondRefs = (secondRow as unknown as { _refs: Record<string, FakeElement> })._refs;

    expect(collectByTag(secondRow, "select")).toHaveLength(0);
    expect(collectByTag(secondRow, "textarea")).toHaveLength(0);
    expect(secondRefs.editButton.disabled).toBe(false);
    expect(secondRefs.deleteButton.disabled).toBe(false);
    expect(secondRow.dataset.rowState).toBe("locked");
    expect(secondRow.classList.contains("row-locked")).toBe(true);
    expect(secondRow.classList.contains("row-editing")).toBe(false);
  });

  it("ignores save while locked", async () => {
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
      [mockResponse(payload)]
    );

    await Promise.resolve();
    await Promise.resolve();

    const row = elements.body.children[0];
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;

    await refs.saveButton.click();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(elements.status.textContent).toBe("Records loaded and ready.");
  });

  it("patches only changed fields and re-locks after success", async () => {
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
      scanId: "scan-1",
      studentId: "student-1",
      studentName: "Ada Lovelace",
      studentSecretId: "student-secret-1",
      mentorId: "mentor-1",
      mentorName: "Grace Hopper",
      eventDate: "2026-04-11",
      scannedAt: "2026-04-11T08:00:00.000Z",
      notes: "Updated by admin",
      updatedAt: "2026-04-11T10:00:00.000Z",
    };

    const { elements, fetchMock } = await loadAdminPageApp(
      "/admin/admin-secret-token/",
      [mockResponse(payload), mockResponse(updatedRecord)]
    );

    await Promise.resolve();
    await Promise.resolve();

    const row = elements.body.children[0];
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;

    await refs.editButton.click();
    refs.notesTextarea.value = "Updated by admin";
    await refs.saveButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/admin/admin-secret-token/api/records/scan-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ notes: "Updated by admin" }),
      })
    );
    expect(refs.notesText.textContent).toBe("Updated by admin");
    expect(refs.studentSelect.disabled).toBe(true);
    expect(refs.mentorSelect.disabled).toBe(true);
    expect(refs.notesTextarea.disabled).toBe(true);
    expect(refs.saveButton.disabled).toBe(true);
    expect(elements.status.textContent).toContain("Saved scan-1.");
  });

  it("skips patch for unchanged save and re-locks", async () => {
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
      [mockResponse(payload)]
    );

    await Promise.resolve();
    await Promise.resolve();

    const row = elements.body.children[0];
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;

    await refs.editButton.click();
    await refs.saveButton.click();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(elements.status.textContent).toBe("No changes to save.");
    expect(refs.notesTextarea.disabled).toBe(true);
    expect(refs.saveButton.disabled).toBe(true);
  });

  it("keeps attempted values editable after a failed save", async () => {
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
      [mockResponse(payload), mockResponse({ error: "Save blocked" }, { status: 500 })]
    );

    await Promise.resolve();
    await Promise.resolve();

    const row = elements.body.children[0];
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;

    await refs.editButton.click();
    refs.notesTextarea.value = "Attempted note";
    await refs.saveButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(elements.status.textContent).toContain("Save blocked");
    expect(refs.notesTextarea.disabled).toBe(false);
    expect(refs.notesTextarea.value).toBe("Attempted note");
    expect(refs.saveButton.disabled).toBe(false);
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
    const refs = (row as unknown as { _refs: Record<string, FakeElement> })._refs;

    await refs.deleteButton.click();

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
    const failedRefs = (failedRow as unknown as { _refs: Record<string, FakeElement> })._refs;

    await failedRefs.deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(failedDeleteMount.elements.body.children).toHaveLength(1);
    expect(failedDeleteMount.elements.status.textContent).toContain("Delete blocked");
    expect(failedRow.dataset.rowState).toBe("locked");
    expect(collectByTag(failedRow, "select")).toHaveLength(0);
    expect(collectByTag(failedRow, "textarea")).toHaveLength(0);
    expect(failedRefs.editButton.disabled).toBe(false);
    expect(failedRefs.deleteButton.disabled).toBe(false);
  });
});
