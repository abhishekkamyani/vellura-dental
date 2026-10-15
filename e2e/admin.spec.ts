import { expect, test, type Page } from "@playwright/test";

// Requires the database to be migrated and seeded: npm run db:seed && npm run db:seed-admin
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@velluradental.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password123";

async function signIn(page: Page, password = ADMIN_PASSWORD) {
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("admin dashboard", () => {
  test("redirects visitors who are not signed in to the login page", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("rejects an incorrect password", async ({ page }) => {
    await page.goto("/login");
    await signIn(page, "not-the-password");

    await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("lists the seeded appointments for a signed-in admin, then signs out", async ({ page }) => {
    await page.goto("/admin");
    await signIn(page);

    await expect(page.getByRole("heading", { name: "Upcoming bookings" })).toBeVisible();
    await expect(page.getByTestId("admin-email")).toHaveText(ADMIN_EMAIL);

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Patient" })).toBeVisible();

    const confirmed = table.getByRole("row", { name: /Isabella Laurent/ });
    await expect(confirmed).toContainText("Vellura Signature Cleaning");
    await expect(confirmed).toContainText("Confirmed");

    const cancelled = table.getByRole("row", { name: /Amelia Fontaine/ });
    await expect(cancelled).toContainText("Veneer Consultation");
    await expect(cancelled).toContainText("Cancelled");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("manual booking", () => {
  test("an admin can add an appointment for a patient who called in", async ({ page }) => {
    const patient = `Walk-in ${Date.now()}`;

    await page.goto("/login");
    await signIn(page);
    await page.waitForURL("**/admin");

    await page.getByRole("button", { name: "New appointment" }).click();
    const dialog = page.getByRole("dialog", { name: "New appointment" });
    await dialog.getByLabel("Patient name").fill(patient);
    await dialog.getByLabel("Phone").fill("+1 555 123 4567");
    await dialog.getByLabel("Service").selectOption({ label: "Veneer Consultation (45 min)" });

    // Tomorrow is the default date. Pick the first free time the clinic offers.
    const timeSelect = dialog.getByLabel(/Start time/);
    await expect(timeSelect.locator("option").nth(1)).toBeAttached();
    const firstTime = await timeSelect.locator("option").nth(1).getAttribute("value");
    await timeSelect.selectOption(firstTime ?? "");

    await dialog.getByRole("button", { name: "Book appointment" }).click();
    await expect(dialog).toBeHidden();

    const row = page.getByRole("table").getByRole("row", { name: new RegExp(patient) });
    await expect(row).toContainText("Veneer Consultation");
    await expect(row).toContainText("Confirmed");
  });
});
