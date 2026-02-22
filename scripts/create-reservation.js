#!/usr/bin/env node

const { chromium } = require("playwright");

// -----------------------------
// KONFIGURACE VÝBĚRŮ
// -----------------------------
const DURATION_OPTION = process.env.RES_DURATION_OPTION || "2:00";
const SOURCE_OPTION = process.env.RES_SOURCE_OPTION || "Telefon";
const OCCASION_OPTION = process.env.RES_OCCASION_OPTION || "Normální návštěva";

// -----------------------------
// Safe JSON parser
// -----------------------------
function safeParse(label, raw) {
  if (!raw) {
    console.error(`❌ ${label} is empty or undefined.`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ${label} is NOT valid JSON.`);
    console.error(`📄 RAW content received:\n${raw}`);
    process.exit(1);
  }
}

// -----------------------------
// Load cookies
// -----------------------------
console.log("🔑 Loading cookies...");

let cookiesRaw = process.env.DISH_COOKIES;

try {
  const decoded = Buffer.from(cookiesRaw, "base64").toString("utf-8");
  if (decoded.trim().startsWith("[")) cookiesRaw = decoded;
} catch {}

let cookies = safeParse("DISH_COOKIES", cookiesRaw);
cookies = cookies.map((c) => ({
  name: c.name,
  value: c.value,
  domain: c.domain || ".dish.co",
  path: c.path || "/",
  secure: true,
  httpOnly: c.httpOnly || false,
  sameSite: "Lax",
}));

// -----------------------------
// Load reservation data
// -----------------------------
console.log("📦 Loading reservation data...");
const reservation = safeParse("RESERVATION_DATA", process.env.RESERVATION_DATA);

const dt = new Date(reservation.time);
const dateStr = dt.toISOString().split("T")[0];
const day = String(dt.getDate());
const hours = String(dt.getHours()).padStart(2, "0");
const minutes = String(dt.getMinutes()).padStart(2, "0");
const timeStr = `${hours}:${minutes}`;

const nameParts = reservation.name.trim().split(/\s+/);
const firstName = nameParts[0];
const lastName = nameParts.slice(1).join(" ") || firstName;

// -----------------------------
// HELPERS
// -----------------------------
async function waitForGuestInput(page) {
  console.log("Hledám vstup pro počet hostů...");
  const input = page.locator('input[name="guestCount"], input[type="number"]');
  if (await input.count()) {
    await input.first().waitFor({ timeout: 15000 });
    console.log("Nalezen input pro počet hostů.");
    return input.first();
  }
  const button = page.locator('button:has-text("Počet hostů")');
  if (await button.count()) {
    await button.first().waitFor({ timeout: 15000 });
    console.log("Nalezen button pro počet hostů.");
    return button.first();
  }
  const label = page.locator('label:has-text("Počet hostů")').first();
  const wrapper = label.locator("xpath=../following-sibling::div[contains(@class,'col-sm')]" ).first();
  const oldButton = wrapper.locator('*[role="button"]:visible').first();
  if (await oldButton.count()) {
    await oldButton.waitFor({ timeout: 15000 });
    console.log("Nalezen původní button pro počet hostů.");
    return oldButton;
  }
  throw new Error("Nebyl nalezen žádný vstup pro Počet hostů.");
}

async function clickGuestInput(page) {
  const el = await waitForGuestInput(page);
  await el.scrollIntoViewIfNeeded();
  await el.click({ force: true });
  await page.waitForTimeout(200);
}

async function typeGuestCount(page, value) {
  const el = await waitForGuestInput(page);
  await el.scrollIntoViewIfNeeded();
  await el.fill(value);
  await page.waitForTimeout(200);
}

async function selectOption(page, labelText, optionText) {
  await clickInteractive(page, labelText);
  await page.waitForTimeout(300);
  await page.locator(`text="${optionText}"`).first().click();
}

async function clickInteractive(page, labelText) {
  const label = page.locator(`label:has-text("${labelText}")`).first();
  const wrapper = label.locator("xpath=../following-sibling::div[contains(@class,'col-sm')]" ).first();
  const el = wrapper.locator('*[role="button"]:visible').first();
  await el.scrollIntoViewIfNeeded();
  await el.click({ force: true });
  await page.waitForTimeout(200);
}

async function typeInto(page, labelText, value) {
  await clickInteractive(page, labelText);
  await page.keyboard.type(value, { delay: 40 });
}

// -----------------------------
// MAIN
// -----------------------------
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    const url = `https://reservation.dish.co/reservation/add?date=${dateStr}`;
    console.log(`🌐 Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Odstraň overlays
    await page.evaluate(() => {
      const uc = document.querySelector("#usercentrics-root");
      if (uc) uc.remove();
      document.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) el.shadowRoot.innerHTML = "";
      });
    });

    // 1) POČET HOSTŮ (NAHRADÍME robustní funkcí)
    console.log("👥 Setting guests:", reservation.people);
    await typeGuestCount(page, String(reservation.people));

    await page.waitForTimeout(1000);

    // 2) DATUM
    console.log("📅 Setting date:", day);
    await clickInteractive(page, "Datum");
    await page.waitForTimeout(300);
    await page.locator(`text="${day}"`).first().click();

    // 3) ČAS
    console.log("⏰ Setting time:", timeStr);
    await selectOption(page, "Čas", timeStr);

    // 4) DOBA TRVÁNÍ
    console.log("⏳ Setting duration:", DURATION_OPTION);
    await selectOption(page, "Doba trvání", DURATION_OPTION);

    // 5) ZDROJ
    console.log("📡 Setting source:", SOURCE_OPTION);
    await selectOption(page, "Zdroj", SOURCE_OPTION);

    // 6) PŘÍLEŽITOST
    console.log("🎯 Setting occasion:", OCCASION_OPTION);
    await selectOption(page, "Příležitost", OCCASION_OPTION);

    // 7) JMÉNO + PŘÍJMENÍ
    console.log("🧑 Setting surname:", lastName);
    await typeInto(page, "Příjmení", lastName);
    console.log("🧑 Setting firstname:", firstName);
    await typeInto(page, "Jméno", firstName);

    // 8) TELEFON
    console.log("📱 Setting phone:", reservation.phone);
    await typeInto(page, "Telefon", reservation.phone);

    // 9) POZNÁMKY
    if (reservation.notes) {
      console.log("📝 Setting notes:", reservation.notes);
      await typeInto(page, "Poznámky k rezervaci", reservation.notes);
    }

    // SUBMIT
    console.log("🚀 Submitting...");
    await page.locator('button:has-text("Uložit")').click({ force: true });

    await page.waitForTimeout(3000);

    console.log("✅ Reservation submitted.");
    console.log("📍 Final URL:", page.url());
  } catch (err) {
    console.error("❌ Error:", err);
    await page.screenshot({ path: "error.png" });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
