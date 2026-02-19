import { chromium } from "playwright";

// --- Load and validate payload -------------------------------------------------

const raw = process.env.RESERVATION_PAYLOAD;

if (!raw) {
  throw new Error("Missing RESERVATION_PAYLOAD environment variable.");
}

let data: any;
try {
  data = JSON.parse(raw);
} catch (e) {
  throw new Error("Invalid JSON in RESERVATION_PAYLOAD.");
}

if (!data.date) throw new Error("Missing required field: date");
if (!data.time) throw new Error("Missing required field: time");
if (data.table === undefined || data.table === null)
  throw new Error("Missing required field: table");

data.notes = data.notes ?? "";

// --- Logging -------------------------------------------------------------------

console.log("=== DISH Reservation Payload ===");
console.log(JSON.stringify(data, null, 2));
console.log("================================");

// --- Playwright automation ------------------------------------------------------

async function run() {
  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  console.log("Navigating to DISH reservation page…");

  await page.goto(
    `https://reservation.dish.co/reservation/add?date=${data.date}`,
    { waitUntil: "networkidle" }
  );

  // --- Fill form fields --------------------------------------------------------

  console.log("Filling reservation form…");

  // Date
  await page.getByLabel("Datum").fill(data.date);

  // Time
  await page.getByLabel("Čas").fill(data.time);

  // Table
  await page.getByLabel("Stůl").fill(String(data.table));

  // Notes (optional)
  if (data.notes.trim() !== "") {
    await page.getByLabel("Poznámka").fill(data.notes);
  }

  // --- Submit ------------------------------------------------------------------

  console.log("Submitting reservation…");

  await page.getByRole("button", { name: "Vytvořit rezervaci" }).click();

  // Wait for confirmation
  await page.waitForSelector("text=Rezervace byla úspěšně vytvořena", {
    timeout: 15000,
  });

  console.log("Reservation successfully created!");

  await browser.close();
}

run().catch((err) => {
  console.error("Reservation failed:");
  console.error(err);
  process.exit(1);
});
