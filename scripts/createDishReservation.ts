import { chromium } from "playwright";

// ---------- Payload loading & validation ----------

const raw = process.env.RESERVATION_PAYLOAD;

if (!raw) {
  throw new Error("Missing RESERVATION_PAYLOAD environment variable.");
}

let data: any;
try {
  data = JSON.parse(raw);
} catch {
  throw new Error("Invalid JSON in RESERVATION_PAYLOAD.");
}

if (!data.date) throw new Error("Missing required field: date");
if (!data.time) throw new Error("Missing required field: time");
if (data.table === undefined || data.table === null) {
  throw new Error("Missing required field: table");
}

data.notes = data.notes ?? "";

// ---------- Credentials from env ----------

const DISH_USERNAME = process.env.DISH_USERNAME;
const DISH_PASSWORD = process.env.DISH_PASSWORD;

if (!DISH_USERNAME || !DISH_PASSWORD) {
  throw new Error("Missing DISH_USERNAME or DISH_PASSWORD environment variables.");
}

console.log("=== DISH Reservation Payload ===");
console.log(JSON.stringify(data, null, 2));
console.log("================================");

// ---------- Main automation ----------

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const baseUrl = "https://reservation.dish.co";

  // --- Login page ---
  console.log("Opening login page…");
  await page.goto(`${baseUrl}/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle",
  });

  // Přepnutí na login emailem (pro jistotu)
  const emailTab = page.getByRole("tab", { name: /email/i });
  if (await emailTab.isVisible().catch(() => false)) {
    await emailTab.click();
  }

  console.log("Filling login form…");

  // Pole „Username or email“
  await page
    .getByLabel(/username or email/i)
    .or(page.getByPlaceholder(/email/i))
    .fill(DISH_USERNAME);

  // Pole „Password“
  await page
    .getByLabel(/password/i)
    .or(page.getByPlaceholder(/password/i))
    .fill(DISH_PASSWORD);

  // Tlačítko přihlášení
  await page
    .getByRole("button", { name: /sign in|log in|přihlásit/i })
    .click();

  // Počkáme, až se načte samotný nástroj rezervací
  console.log("Waiting for reservation tool to load…");
  await page.waitForLoadState("networkidle");

  // Pro jistotu znovu přejdeme na URL s datem (po loginu už by mělo pustit dál)
  await page.goto(`${baseUrl}/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle",
  });

  console.log("Reservation page loaded, filling form…");

  // --- Tady musíš doladit selektory podle skutečného UI rezervace ---
  // Níže jsou rozumné defaulty, které můžeš upravit podle textů/labelů na stránce.

  // Datum (pokud je na stránce editovatelné)
  const dateInput = page.getByLabel(/datum/i).or(page.getByPlaceholder(/datum/i));
  if (await dateInput.isVisible().catch(() => false)) {
    await dateInput.fill(data.date);
  }

  // Čas
  const timeInput = page.getByLabel(/čas/i).or(page.getByPlaceholder(/time/i));
  if (await timeInput.isVisible().catch(() => false)) {
    await timeInput.fill(data.time);
  }

  // Stůl
  const tableInput = page.getByLabel(/stůl|table/i).or(
    page.getByPlaceholder(/stůl|table/i)
  );
  if (await tableInput.isVisible().catch(() => false)) {
    await tableInput.fill(String(data.table));
  }

  // Poznámka (volitelné)
  if (data.notes.trim() !== "") {
    const notesInput = page.getByLabel(/poznámka|note/i).or(
      page.getByPlaceholder(/poznámka|note/i)
    );
    if (await notesInput.isVisible().catch(() => false)) {
      await notesInput.fill(data.notes);
    }
  }

  console.log("Submitting reservation…");

  await page
    .getByRole("button", {
      name: /vytvořit rezervaci|create reservation|uložit/i,
    })
    .click();

  // Potvrzení – text si případně uprav podle reálného UI
  await page.waitForTimeout(2000); // krátká pauza
  await page.waitForSelector(/rezervace byla úspěšně vytvořena|reservation created/i, {
    timeout: 15000,
  });

  console.log("Reservation successfully created.");
  await browser.close();
}

run().catch((err) => {
  console.error("Reservation failed:");
  console.error(err);
  process.exit(1);
});



