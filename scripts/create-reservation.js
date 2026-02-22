#!/usr/bin/env node

const { chromium } = require("playwright");
const fs = require("fs");

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
  secure: typeof c.secure === "boolean" ? c.secure : true,
  httpOnly: c.httpOnly || false,
  sameSite: c.sameSite || "Lax",
}));

// -----------------------------
// Load reservation data
// -----------------------------
console.log("📦 Loading reservation data...");
const reservation = safeParse("RESERVATION_DATA", process.env.RESERVATION_DATA);

const dt = new Date(reservation.time);
if (Number.isNaN(dt.getTime())) {
  console.error("❌ RESERVATION_DATA.time is not a valid date:", reservation.time);
  process.exit(1);
}

const dateStr = dt.toISOString().split("T")[0];
const day = String(dt.getDate());
const hours = String(dt.getHours()).padStart(2, "0");
const minutes = String(dt.getMinutes()).padStart(2, "0");
const timeStr = `${hours}:${minutes}`;

const nameParts = String(reservation.name || "").trim().split(/\s+/).filter(Boolean);
const firstName = nameParts[0] || "Host";
const lastName = nameParts.slice(1).join(" ") || firstName;

// -----------------------------
// HELPERS (robust field targeting)
// -----------------------------
const DEFAULT_TIMEOUT = Number(process.env.PW_TIMEOUT_MS || 60000);

async function firstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const el = locator.nth(i);
    try {
      if (await el.isVisible()) return el;
    } catch {}
  }
  return locator.first();
}

async function getField(page, labelText) {
  // 1) Best case: accessible label
  const byLabel = page.getByLabel(labelText, { exact: false });
  if (await byLabel.count()) {
    const el = await firstVisible(byLabel);
    return el;
  }

  // 2) Find label element by text
  const label = page.locator(`label:has-text("${labelText}")`).first();
  await label.waitFor({ timeout: DEFAULT_TIMEOUT });

  // 2a) label[for] -> control by id
  const forId = await label.getAttribute("for");
  if (forId) {
    const byId = page.locator(`#${CSS.escape(forId)}`);
    if (await byId.count()) return (await firstVisible(byId));
  }

  // 2b) Search in the nearest "form row" container
  // Go up a bit, then search for common interactive controls.
  const container = label.locator(
    "xpath=ancestor-or-self::*[self::div or self::section or self::fieldset][1]"
  );

  const candidates = container.locator(
    [
      "input:visible",
      "textarea:visible",
      "[role='combobox']:visible",
      "[role='spinbutton']:visible",
      "[role='button']:visible",
      "button:visible",
      "[contenteditable='true']:visible",
    ].join(",")
  );

  await candidates.first().waitFor({ timeout: DEFAULT_TIMEOUT });
  return (await firstVisible(candidates));
}

async function clickField(page, labelText) {
  const el = await getField(page, labelText);
  await el.scrollIntoViewIfNeeded();
  await el.click({ force: true, timeout: DEFAULT_TIMEOUT });
  await page.waitForTimeout(150);
  return el;
}

async function fillOrType(page, labelText, value) {
  const el = await getField(page, labelText);
  await el.scrollIntoViewIfNeeded();

  // Prefer fill when supported
  try {
    await el.fill(String(value), { timeout: DEFAULT_TIMEOUT });
    return;
  } catch {}

  // Fallback: click + select-all + type
  await el.click({ force: true, timeout: DEFAULT_TIMEOUT });
  try {
    await page.keyboard.press("Control+A");
  } catch {}
  await page.keyboard.type(String(value), { delay: 30 });
}

async function selectOption(page, labelText, optionText) {
  // Many UI libs: click field -> options appear -> click option text
  await clickField(page, labelText);

  // Option may appear as text node, listbox option, etc.
  const opt = page
    .locator(`[role='option']:has-text("${optionText}")`)
    .or(page.locator(`text="${optionText}"`))
    .first();

  await opt.waitFor({ timeout: DEFAULT_TIMEOUT });
  await opt.click({ timeout: DEFAULT_TIMEOUT });
}

// -----------------------------
// MAIN
// -----------------------------
(async () => {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  await context.addCookies(cookies);

  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);

  try {
    const url = `https://reservation.dish.co/reservation/add?date=${dateStr}`;
    console.log(`🌐 Navigating to: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: DEFAULT_TIMEOUT });

    // Guard against invalid cookies / redirect to login
    const currentUrl = page.url();
    if (/login|signin|auth/i.test(currentUrl)) {
      throw new Error(
        `Not authenticated (redirected to login). Check DISH_COOKIES. Current URL: ${currentUrl}`
      );
    }

    // Attempt to remove common cookie/consent overlays
    await page.evaluate(() => {
      const uc = document.querySelector("#usercentrics-root");
      if (uc) uc.remove();

      // Some overlays live in shadow roots; nuking them can help
      document.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) el.shadowRoot.innerHTML = "";
      });
    });

    // Optional: store "before" artifacts (helps debugging flaky UI)
    try {
      await page.screenshot({ path: "before.png", fullPage: true });
      fs.writeFileSync("before.html", await page.content(), "utf-8");
    } catch {}

    // -----------------------------
    // 1) POČET HOSTŮ
    // -----------------------------
    console.log("👥 Setting guests:", reservation.people);
    await fillOrType(page, "Počet hostů", String(reservation.people));
    await page.waitForTimeout(500);

    // -----------------------------
    // 2) DATUM
    // -----------------------------
    console.log("📅 Setting date:", day);
    await clickField(page, "Datum");
    await page.waitForTimeout(200);
    await page.locator(`text="${day}"`).first().click();

    // -----------------------------
    // 3) ČAS
    // -----------------------------
    console.log("⏰ Setting time:", timeStr);
    await selectOption(page, "Čas", timeStr);

    // -----------------------------
    // 4) DOBA TRVÁNÍ
    // -----------------------------
    console.log("⏳ Setting duration:", DURATION_OPTION);
    await selectOption(page, "Doba trvání", DURATION_OPTION);

    // -----------------------------
    // 5) ZDROJ
    // -----------------------------
    console.log("📡 Setting source:", SOURCE_OPTION);
    await selectOption(page, "Zdroj", SOURCE_OPTION);

    // -----------------------------
    // 6) PŘÍLEŽITOST
    // -----------------------------
    console.log("🎯 Setting occasion:", OCCASION_OPTION);
    await selectOption(page, "Příležitost", OCCASION_OPTION);

    // -----------------------------
    // 7) JMÉNO + PŘÍJMENÍ
    // -----------------------------
    console.log("🧍 Setting surname:", lastName);
    await fillOrType(page, "Příjmení", lastName);

    console.log("🧍 Setting firstname:", firstName);
    await fillOrType(page, "Jméno", firstName);

    // -----------------------------
    // 8) TELEFON
    // -----------------------------
    console.log("📱 Setting phone:", reservation.phone);
    await fillOrType(page, "Telefon", reservation.phone);

    // -----------------------------
    // 9) POZNÁMKY
    // -----------------------------
    if (reservation.notes) {
      console.log("📝 Setting notes:", reservation.notes);
      await fillOrType(page, "Poznámky k rezervaci", reservation.notes);
    }

    // -----------------------------
    // SUBMIT
    // -----------------------------
    console.log("🚀 Submitting...");
    await page.locator('button:has-text("Uložit")').click({ force: true, timeout: DEFAULT_TIMEOUT });

    await page.waitForTimeout(3000);

    console.log("✅ Reservation submitted.");
    console.log("📍 Final URL:", page.url());

    // Optional: store "after" artifacts
    try {
      await page.screenshot({ path: "after.png", fullPage: true });
      fs.writeFileSync("after.html", await page.content(), "utf-8");
    } catch {}
  } catch (err) {
    console.error("❌ Error:", err);
    try {
      await page.screenshot({ path: "error.png", fullPage: true });
      fs.writeFileSync("error.html", await page.content(), "utf-8");
    } catch {}
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
