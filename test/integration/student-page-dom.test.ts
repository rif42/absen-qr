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
      "history-retry-button",
      "fallback-reveal-btn",
      "fallback-form",
      "fallback-code-input",
      "fallback-submit-btn",
      "fallback-cancel-btn",
    ];

    for (const id of requiredIds) {
      expect(studentPageHtml).toContain(`id="${id}"`);
    }
  });

  describe("fallback code entry", () => {
    it("has a fallback reveal button below the scanner controls", () => {
      const revealBtnIndex = studentPageHtml.indexOf('id="fallback-reveal-btn"');
      const scannerHintIndex = studentPageHtml.indexOf('scanner-hint');

      expect(revealBtnIndex).toBeGreaterThan(-1);
      expect(revealBtnIndex).toBeGreaterThan(scannerHintIndex);
    });

    it("has a hidden fallback form with input, submit, and cancel elements", () => {
      expect(studentPageHtml).toContain('id="fallback-form"');
      expect(studentPageHtml).toContain('id="fallback-code-input"');
      expect(studentPageHtml).toContain('id="fallback-submit-btn"');
      expect(studentPageHtml).toContain('id="fallback-cancel-btn"');

      // Form should be hidden by default
      const formClassIndex = studentPageHtml.indexOf('id="fallback-form"');
      const hiddenClassBeforeClose = studentPageHtml.lastIndexOf('hidden', formClassIndex + 20);
      const formOpenTag = studentPageHtml.indexOf('>', formClassIndex);
      expect(hiddenClassBeforeClose).toBeGreaterThan(-1);
      expect(hiddenClassBeforeClose).toBeLessThan(formOpenTag);
    });

    it("has helper copy explaining the one-time code expiry", () => {
      expect(studentPageHtml).toMatch(/expires in 5 minutes/i);
    });

    it("does not auto-expand the fallback form on page load", () => {
      // The fallback form should have the hidden class and not have it removed
      // by any auto-behavior scripts in the HTML
      const fallbackFormMatch = studentPageHtml.match(/id="fallback-form"[^>]*class="([^"]*)"/);
      expect(fallbackFormMatch).not.toBeNull();
      expect(fallbackFormMatch![1]).toContain('hidden');
    });
  });
});
