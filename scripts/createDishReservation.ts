import { chromium } from "playwright";

// -----------------------------------------------------------------------------
// 1) LOAD & VALIDATE PAYLOAD
// -----------------------------------------------------------------------------

function loadPayload() {
  const raw = process.env.RESERVATION_PAYLOAD;

  if (!raw || raw.trim() === "") {
    throw new Error("RESERVATION_PAYLOAD is empty or missing.");
  }

  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("RAW PAYLOAD:", raw);
    throw new Error("RESERVATION_PAYLOAD is not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.error("RAW PAYLOAD:", raw);
    throw new Error("RESERVATION_PAYLOAD is not a valid object.");
  }

  if (!parsed.date) throw new Error("Missing required field: date");
  if (!parsed.time) throw new Error("Missing required field: time");
  if (parsed.table === undefined || parsed.table === null) {
    throw new Error("Missing required field: table");
  }

  parsed.notes = parsed.notes ?? "";

  return parsed;
}

const data = loadPayload();

console.log("=== PAYLOAD LOADED ===");
console.log(JSON.stringify(data, null, 2));
console.log("=======================");

// -----------------------------------------------------------------------------
// 2) LOAD CREDENTIALS
// -----------------------------------------------------------------------------

const DISH_USERNAME = process.env.DISH_USERNAME;
const DISH_PASSWORD = process.env.DISH_PASSWORD;

if (!DISH_USERNAME || !DISH_PASSWORD) {
  throw new Error("Missing DISH_USERNAME or DISH_PASSWORD environment variables.");
}

// -----------------------------------------------------------------------------
// 3) MAIN AUTOMATION
// -----------------------------------------------------------------------------

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const baseUrl = "https://reservation.dish.co";

  console.log("Opening reservation page (will redirect to login if needed)…");

  await page.goto(`${baseUrl}/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle",
  });

  // ---------------------------------------------------------------------------
  // LOGIN PAGE
  // ---------------------------------------------------------------------------

  if (page.url().includes("login") || page.url().includes("signin")) {
    console.log("Login required. Filling login form…");

    // Switch to email tab if present
    const emailTab = page.getByRole("tab", { name: /email/i });
    if (await emailTab.isVisible().catch(() => false)) {
      await emailTab.click();
    }

    // Username/email
    await page
      .getByLabel(/username|email/i)
      .or(page.getByPlaceholder(/email/i))
      .fill(DISH_USERNAME);

    // Password
    await page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i))
      .fill(DISH_PASSWORD);

    // Submit
    await page
      .getByRole("button", { name: /sign in|log in|přihlásit/i })
      .click();

    console.log("Waiting for login to complete…");
    await page.waitForLoadState("networkidle");
  }

  // ---------------------------------------------------------------------------
  // OPEN RESERVATION PAGE AGAIN (now authenticated)
  // ---------------------------------------------------------------------------

  console.log("Opening reservation page after login…");

  await page.goto(`${baseUrl}/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle",
  });

  console.log("Reservation page loaded. Filling form…");

  // ---------------------------------------------------------------------------
  // FORM FILLING — these selectors are robust and language‑agnostic
  // ---------------------------------------------------------------------------

  // Date
  const dateField = page.getByLabel(/date|datum/i);
  if (await dateField.isVisible().catch(() => false)) {
    await dateField.fill(data.date);
  }

  // Time
  const timeField = page.getByLabel(/time|čas/i);
  if (await timeField.isVisible().catch(() => false)) {
    await timeField.fill(data.time);
  }

  // Table
  const tableField = page.getByLabel(/table|stůl/i);
  if (await tableField.isVisible().catch(() => false)) {
    await tableField.fill(String(data.table));
  }

  // Notes
  if (data.notes.trim() !== "") {
    const notesField = page.getByLabel(/note|poznámka/i);
    if (await notesField.isVisible().catch(() => false)) {
      await notesField.fill(data.notes);
    }
  }

  // ---------------------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------------------

  console.log("Submitting reservation…");

  await page
    .getByRole("button", {
      name: /create|vytvořit|uložit|reservation/i,
    })
    .click();

  console.log("Waiting for confirmation…");

  await page.waitForSelector(
    /reservation created|rezervace byla úspěšně vytvořena/i,
    { timeout: 15000 }
  );

  console.log("Reservation successfully created!");
  await browser.close();
}

run().catch((err) => {
  console.error("Reservation failed:");
  console.error(err);
  process.exit(1);
});




