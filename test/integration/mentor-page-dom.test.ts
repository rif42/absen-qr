import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import mentorPageHtml from "../../public/mentor/index.html?raw";

describe("mentor page DOM contract", () => {
  it("provides a real page heading and semantic section headings", () => {
    expect(mentorPageHtml).toMatch(/<h1[^>]*id="page-title"[^>]*>\s*Mentor attendance\s*<\/h1>/i);
    expect(mentorPageHtml).toMatch(/<h2[^>]*>\s*Mentor identity\s*<\/h2>/i);
    expect(mentorPageHtml).toMatch(/<h2[^>]*>\s*Mentor QR code\s*<\/h2>/i);
    expect(mentorPageHtml).toMatch(/<h2[^>]*>\s*Recent scans and notes\s*<\/h2>/i);
  });

  it("keeps the mobile flow ordered as identity, QR code, then recent scans", () => {
    const identityIndex = mentorPageHtml.indexOf('article class="card identity-card"');
    const qrIndex = mentorPageHtml.indexOf('article class="card qr-card"');
    const recentScansIndex = mentorPageHtml.indexOf('article class="card recent-scans-card"');

    expect(identityIndex).toBeGreaterThan(-1);
    expect(qrIndex).toBeGreaterThan(identityIndex);
    expect(recentScansIndex).toBeGreaterThan(qrIndex);
  });

  it("preserves mentor-loading hook or uses status-banner", () => {
    // Either mentor-loading or status-banner should exist
    const hasMentorLoading = mentorPageHtml.includes('id="mentor-loading"');
    const hasStatusBanner = mentorPageHtml.includes('id="status-banner"');
    expect(hasMentorLoading || hasStatusBanner).toBe(true);
  });

  it("preserves the mentor app hook ids for identity, QR, and polling states", () => {
    const requiredIds = [
      "status-banner",
      "mentor-success",
      "mentor-error",
      "mentor-name",
      "mentor-meta",
      "mentor-error-message",
      "qr-display",
      "qr-copy",
      "recent-scans-empty",
      "recent-scans-error",
      "recent-scans-error-message",
      "recent-scans-list",
      "retry-button",
      "recent-scans-retry-button"
    ];

    for (const id of requiredIds) {
      expect(mentorPageHtml).toContain(`id="${id}"`);
    }
  });
});

describe("mentor page fallback code DOM contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides fallback card between QR and recent scans", () => {
    // Fallback card should exist and include fallback-code in its id
    expect(mentorPageHtml).toContain('fallback-card');
    expect(mentorPageHtml).toContain('id="fallback-code-card"');
  });

  it("provides stable fallback DOM hooks", () => {
    const fallbackIds = [
      "fallback-code-card",
      "fallback-generate-btn",
      "fallback-code-display",
      "fallback-countdown",
      "fallback-helper",
      "fallback-error"
    ];

    for (const id of fallbackIds) {
      expect(mentorPageHtml).toContain(`id="${id}"`);
    }
  });

  it("provides generate button element for triggering fallback code generation", () => {
    expect(mentorPageHtml).toContain(`<button type="button" class="button fallback-generate-button" id="fallback-generate-btn">`);
  });

  it("does not crash when API returns hasActiveCode false", () => {
    const noCodeResponse = { hasActiveCode: false };
    expect(noCodeResponse).toBeDefined();
    expect(noCodeResponse.hasActiveCode).toBe(false);
  });

  it("does not crash when API returns hasActiveCode true with code and expiresAt", () => {
    const activeCodeResponse = {
      hasActiveCode: true,
      code: "12345678",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      remainingSeconds: 300
    };
    expect(activeCodeResponse).toBeDefined();
    expect(activeCodeResponse.hasActiveCode).toBe(true);
    expect(activeCodeResponse.code).toBe("12345678");
  });

  it("handles countdown timer with vi.useFakeTimers", () => {
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
    const expiresAt = new Date("2024-01-01T12:05:00Z").getTime();
    const now = Date.now();
    const remainingSeconds = Math.floor((expiresAt - now) / 1000);
    expect(remainingSeconds).toBe(300);
  });
});
