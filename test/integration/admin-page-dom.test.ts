import { describe, expect, it } from "vitest";
import adminPageHtml from "../../public/admin/index.html?raw";

function countMatches(source: string, needle: RegExp): number {
  return [...source.matchAll(needle)].length;
}

describe("admin page DOM contract", () => {
  it("provides a real page heading and a minimal records shell", () => {
    expect(adminPageHtml).toMatch(/<h1[^>]*id="page-title"[^>]*>\s*Admin records\s*<\/h1>/i);
    expect(adminPageHtml).toMatch(/<main[^>]*class="shell"[^>]*>/i);
    expect(adminPageHtml).toMatch(/<section[^>]*class="stack"[^>]*>/i);
    expect(adminPageHtml).toMatch(/<section[^>]*id="controls-card"[^>]*>/i);
    expect(adminPageHtml).toMatch(/<section[^>]*id="records-card"[^>]*>/i);
    expect(adminPageHtml).toMatch(/<link[^>]*rel="stylesheet"[^>]*href="\.\/styles\.css"[^>]*>/i);
  });

  it("keeps the shell ordered as title, controls, then records", () => {
    const titleIndex = adminPageHtml.indexOf('id="page-title"');
    const controlsIndex = adminPageHtml.indexOf('id="controls-card"');
    const recordsIndex = adminPageHtml.indexOf('id="records-card"');

    expect(titleIndex).toBeGreaterThan(-1);
    expect(controlsIndex).toBeGreaterThan(titleIndex);
    expect(recordsIndex).toBeGreaterThan(controlsIndex);
  });

  it("locks each static hook exactly once", () => {
    const requiredIds = [
      "page-title",
      "status-banner",
      "controls-card",
      "export-csv-button",
      "records-card",
      "records-loading",
      "records-empty-state",
      "records-table",
      "records-table-body"
    ];

    for (const id of requiredIds) {
      expect(countMatches(adminPageHtml, new RegExp(`id=\\"${id}\\"`, "g"))).toBe(1);
    }
  });
});
