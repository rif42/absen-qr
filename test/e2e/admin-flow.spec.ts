import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("admin browser flow", () => {
  test("covers admin record edit, reassignment, delete, export, and secret rejection", async ({ page }) => {
    await page.goto("/admin/local-admin-secret-token");

    await expect(page.locator("#records-table")).toBeVisible();

    const row = page.locator("#records-table-body tr").first();
    await expect(row).toBeVisible();

    const notesField = row.locator("textarea");
    await notesField.fill("Updated by admin");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("#status-banner")).toContainText("Saved");

    await page.reload();
    await expect(page.locator("#records-table")).toBeVisible();
    await expect(page.locator("#records-table-body tr").first().locator("textarea")).toHaveValue("Updated by admin");

    const reloadedRow = page.locator("#records-table-body tr").first();
    const mentorSelect = reloadedRow.locator("select").nth(1);
    await mentorSelect.selectOption({ label: "Mentor Local 02" });
    await reloadedRow.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("#status-banner")).toContainText("Saved");
    await expect(mentorSelect).toHaveValue("mentor-002");

    await page.reload();
    const reassignedMentorSelect = page.locator("#records-table-body tr").first().locator("select").nth(1);
    await expect(reassignedMentorSelect).toHaveValue("mentor-002");

    const rowAfterReassign = page.locator("#records-table-body tr").first();
    await rowAfterReassign.getByRole("button", { name: "Delete" }).click();
    await expect(page.locator("#records-table-body tr")).toHaveCount(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = await readFile(downloadPath!, "utf8");
    expect(csv.split(/\r?\n/, 1)[0]).toBe("student name,secret id,mentor scanned,date,notes");

    const forbiddenPage = await page.context().newPage();
    const forbiddenResponse = await forbiddenPage.goto("/admin/not-the-secret");
    expect(forbiddenResponse?.status()).toBe(403);
    await expect(forbiddenPage.locator("#records-table")).toHaveCount(0);
  });
});
