import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("admin browser flow", () => {
  test("covers admin record edit, reassignment, delete, export, and secret rejection", async ({ page }) => {
    await page.goto("/admin/local-admin-secret-token");

    await expect(page.locator("#records-table")).toBeVisible();

    const row = page.locator("#records-table-body tr").first();
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-row-state", "locked");
    await expect(row.locator("td")).toHaveCount(4);
    await expect(row.locator(".record-actions")).toHaveCount(1);
    await expect(row.locator("select")).toHaveCount(0);
    await expect(row.locator("textarea")).toHaveCount(0);

    await expect(row.locator("td").nth(0)).toContainText(/Student/);
    await expect(row.locator("td").nth(1)).toContainText(/Mentor/);
    await expect(row.getByRole("button", { name: "Edit" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();

    await row.getByRole("button", { name: "Edit" }).click();
    await expect(row).toHaveAttribute("data-row-state", "editing");
    await expect(row.locator(".record-actions")).toHaveCount(1);
    await expect(row.locator("select")).toHaveCount(2);
    await expect(row.locator("textarea")).toHaveCount(1);

    const studentSelect = row.locator("select").nth(0);
    const mentorSelect = row.locator("select").nth(1);
    const notesField = row.locator("textarea");
    const saveButton = row.getByRole("button", { name: "Save" });

    await expect(studentSelect).toBeEnabled();
    await expect(mentorSelect).toBeEnabled();
    await expect(notesField).toBeEnabled();
    await expect(saveButton).toBeEnabled();
    await expect(row.getByRole("button", { name: "Edit" })).toHaveCount(0);

    await notesField.fill("Updated by admin");
    await mentorSelect.selectOption({ label: "Mentor Local 02" });
    await row.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("#status-banner")).toContainText("Saved");
    await expect(row).toHaveAttribute("data-row-state", "locked");
    await expect(row.locator("select")).toHaveCount(0);
    await expect(row.locator("textarea")).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Edit" })).toBeVisible();

    await page.reload();
    await expect(page.locator("#records-table")).toBeVisible();
    const reloadedRow = page.locator("#records-table-body tr").first();
    await expect(reloadedRow).toHaveAttribute("data-row-state", "locked");
    await expect(reloadedRow.locator("td").nth(2)).toContainText("Updated by admin");
    await reloadedRow.getByRole("button", { name: "Edit" }).click();
    await expect(reloadedRow.locator("select").nth(1)).toHaveValue("mentor-002");

    await reloadedRow.locator("select").nth(1).selectOption({ label: "Mentor Local 03" });
    await reloadedRow.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("#status-banner")).toContainText("Saved");

    await page.reload();
    const reloadedReassignedRow = page.locator("#records-table-body tr").first();
    await reloadedReassignedRow.getByRole("button", { name: "Edit" }).click();
    const reassignedMentorSelect = reloadedReassignedRow.locator("select").nth(1);
    await expect(reassignedMentorSelect).toHaveValue("mentor-003");

    await reloadedReassignedRow.getByRole("button", { name: "Delete" }).click();
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
