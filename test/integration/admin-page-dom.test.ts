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
      "startDate",
      "endDate",
      "date-sort",
      "apply-filters-button",
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

    expect(adminPageHtml).toMatch(/<table[^>]*id="records-table"[^>]*>[\s\S]*<thead>[\s\S]*<tbody[^>]*id="records-table-body"[^>]*><\/tbody>[\s\S]*<\/table>/i);
    expect(adminPageHtml).toMatch(/<table[^>]*id="records-table"[^>]*>[\s\S]*<thead>[\s\S]*<th[^>]*>\s*Student name\s*<\/th>[\s\S]*<th[^>]*>\s*Mentor name\s*<\/th>[\s\S]*<th[^>]*>\s*Notes\s*<\/th>[\s\S]*<th[^>]*>\s*Scanned date\s*<\/th>[\s\S]*<th[^>]*>\s*Action\s*<\/th>[\s\S]*<\/thead>[\s\S]*<tbody[^>]*id="records-table-body"[^>]*><\/tbody>[\s\S]*<\/table>/i);
    expect(countMatches(adminPageHtml, /<th\b/gi)).toBe(5);
    expect(countMatches(adminPageHtml, /<tr\b/gi)).toBe(1);
  });

  it("keeps filter controls in the filter card and date sort in records", () => {
    const controlsCardMatch = adminPageHtml.match(/<section[^>]*id="controls-card"[\s\S]*?<\/section>/i);
    const recordsCardMatch = adminPageHtml.match(/<section[^>]*id="records-card"[\s\S]*?<\/section>/i);

    expect(controlsCardMatch).not.toBeNull();
    expect(recordsCardMatch).not.toBeNull();

    const controlsCard = controlsCardMatch?.[0] ?? "";
    const recordsCard = recordsCardMatch?.[0] ?? "";

    expect(controlsCard).toMatch(/id="export-csv-button"/i);
    expect(controlsCard).toMatch(/id="startDate"[^>]*type="date"|type="date"[^>]*id="startDate"/i);
    expect(controlsCard).toMatch(/id="endDate"[^>]*type="date"|type="date"[^>]*id="endDate"/i);
    expect(countMatches(controlsCard, /type="date"/gi)).toBe(2);
    expect(countMatches(controlsCard, /<select\b/gi)).toBe(0);
    expect(countMatches(controlsCard, /id="apply-filters-button"/gi)).toBe(1);

    expect(recordsCard).toMatch(/id="date-sort"/i);
    expect(recordsCard).toMatch(/<option[^>]*value="recent"[^>]*>\s*Recent\s*<\/option>/i);
    expect(recordsCard).toMatch(/<option[^>]*value="none"[^>]*>\s*None\s*<\/option>/i);
    expect(recordsCard.indexOf('id="records-card-title"')).toBeGreaterThan(-1);
    expect(recordsCard.indexOf('id="date-sort"')).toBeGreaterThan(recordsCard.indexOf('id="records-card-title"'));
    expect(recordsCard.indexOf('id="records-table"')).toBeGreaterThan(recordsCard.indexOf('id="date-sort"'));
    expect(countMatches(recordsCard, /<select\b/gi)).toBe(1);
  });
});
