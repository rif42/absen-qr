import { describe, expect, it } from "vitest";
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

  it("preserves the mentor app hook ids for identity, QR, and polling states", () => {
    const requiredIds = [
      "mentor-loading",
      "mentor-success",
      "mentor-error",
      "mentor-name",
      "mentor-meta",
      "mentor-error-message",
      "qr-loading",
      "qr-display",
      "qr-copy",
      "recent-scans-loading",
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
