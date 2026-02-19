import fs from "fs";
import { chromium } from "playwright";

// -----------------------------------------------------------------------------
// 1) LOAD & VALIDATE PAYLOAD FROM FILE
// -----------------------------------------------------------------------------

function loadPayloadFromFile(): {
  date: string;
  time: string;
  table: number;
  notes: string;
} {
  const payloadPath = process.argv[2];

  if (!payloadPath) {
    throw new Error("Missing payload file path argument (expected: node ... createDishReservation.ts payload.json).");
  }

  if (!fs.existsSync(payloadPath)) {
    throw new Error(`Payload file not found at path: ${payloadPath}`);
  }

  const raw = fs.readFileSync(payloadPath, "utf8").trim();

  if (!raw) {
    throw new Error("Payload file is empty.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("RAW PAYLOAD CONTENT:", raw);
    throw new Error("Payload file does not contain valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.error("RAW PAYLOAD CONTENT:", raw);
    throw new Error("Payload JSON is not an object.");
  }

  if (!parsed.date) throw new Error("Missing required field: date");
  if (!parsed.time) throw new Error("Missing required field: time");
  if (parsed.table === undefined || parsed.table === null) {
    throw new Error("Missing required field: table");
  }

  return {
    date: String(parsed.date),
    time: String(parsed.time),
    table: Number(parsed.table),
    notes: parsed.notes ? String(parsed.notes) : "",
  };
}

const data = loadPayloadFromFile();

console.log("=== PAYLOAD LOADED FROM FILE ===");
console.log(JSON.stringify(data, null, 2));
console.log("================================");

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

  console.log("Opening reservation page (may redirect to login)…");

  await page.goto(`${baseUrl}/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle",
  });

  // ---------------------------------------------------------------------------
  // LOGIN IF NEEDED
  // ---------------------------------------------------------------------------

  if (page.url().includes("login") || page.url().includes("signin")) {
    console.log("Login required. Filling login form…");

    const emailTab = page.getByRole("tab", { name: /email/i });
    if (await emailTab.isVisible().catch(() => false)) {
      await emailTab.click();
    }

    await page
      .getByLabel(/username|email/i)
      .or(page.getByPlaceholder(/email/i))
      .fill(DISH_USERNAME);

    await page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i))
      .fill(DISH_PASSWORD);

    await page
      .getByRole("button", { name: /sign in|log in|přihlásit/i })
      .click();

    console.log("Waiting for login to complete…");
    await page.waitForLoadState("networkidle");
  }

  // ---------------------------------------------------------------------------
  // OPEN RESERVATION PAGE AFTER LOGIN
  // ---------------------------------------------------------------------------

  console.log("Opening reservation page after login…");

  await page.goto(`${baseUrl}/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle",
  });

  console.log("Reservation page loaded. Filling form…");

  // ---------------------------------------------------------------------------
  // FORM FILLING – selektory jsou obecné, případně je doladíme podle UI
  // ---------------------------------------------------------------------------

  const dateField = page.getByLabel(/date|datum/i);
  if (await dateField.isVisible().catch(() => false)) {
    await dateField.fill(data.date);
  }

  const timeField = page.getByLabel(/time|čas/i);
  if (await timeField.isVisible().catch(() => false)) {
    await timeField.fill(data.time);
  }

  const tableField = page.getByLabel(/table|stůl/i);
  if (await tableField.isVisible().catch(() => false)) {
    await tableField.fill(String(data.table));
  }

  if (data.notes.trim() !== "") {
    const notesField = page.getByLabel(/note|poznámka/i);
    if (await notesField.isVisible().catch(() => false)) {
      await notesField.fill(data.notes);
    }
  }

  console.log("Submitting reservation…");

  await page
    .getByRole("button", {
      name: /create|vytvořit|uložit|reservation/i,
    })
    .click();

  console.log("Waiting for confirmation…");

  await page.waitForTimeout(2000);
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





