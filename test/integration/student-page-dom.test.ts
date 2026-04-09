import { describe, expect, it } from "vitest";
import studentPageHtml from "../../public/student/index.html?raw";

describe("student page DOM contract", () => {
  it("provides a real page heading and semantic section headings", () => {
    expect(studentPageHtml).toMatch(/<h1[^>]*id="page-title"[^>]*>\s*Student attendance\s*<\/h1>/i);
    expect(studentPageHtml).toMatch(/<h2[^>]*>\s*Student identity\s*<\/h2>/i);
    expect(studentPageHtml).toMatch(/<h2[^>]*>\s*Camera scanner\s*<\/h2>/i);
    expect(studentPageHtml).toMatch(/<h2[^>]*>\s*History\s*<\/h2>/i);
  });

  it("keeps the mobile flow ordered as identity, scanner, then history", () => {
    const identityIndex = studentPageHtml.indexOf('article class="card identity-card"');
    const scannerIndex = studentPageHtml.indexOf('article class="card scanner-card"');
    const historyIndex = studentPageHtml.indexOf('article class="card history-card"');

    expect(identityIndex).toBeGreaterThan(-1);
    expect(scannerIndex).toBeGreaterThan(identityIndex);
    expect(historyIndex).toBeGreaterThan(scannerIndex);
  });

  it("preserves every app.js hook id used by the student runtime", () => {
    const requiredIds = [
      "status-banner",
      "identity-loading",
      "identity-success",
      "identity-error",
      "student-name",
      "student-meta",
      "error-message",
      "scanner-stage",
      "scanner-video",
      "scanner-placeholder",
      "scanner-placeholder-title",
      "scanner-placeholder-copy",
      "scanner-status",
      "scanner-feedback",
      "scanner-feedback-title",
      "scanner-feedback-copy",
      "scanner-toggle-button",
      "history-loading",
      "history-error",
      "history-error-message",
      "history-empty",
      "history-list",
      "retry-button",
      "history-retry-button"
    ];

    for (const id of requiredIds) {
      expect(studentPageHtml).toContain(`id="${id}"`);
    }
  });
});
