import { chromium } from "playwright";

async function run() {
  const raw = process.env.RESERVATION_PAYLOAD;
  if (!raw) throw new Error("Missing RESERVATION_PAYLOAD");

  const data = JSON.parse(raw);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 1) Otevřít formulář
  await page.goto(`https://reservation.dish.co/reservation/add?date=${data.date}`, {
    waitUntil: "networkidle"
  });

  // 2) Najít všechny inputy
  const inputs = page.locator("input");

  // DISH má stabilní pořadí inputů:
  // 0 = počet hostů
  // 1 = datum
  // 2 = čas
  // 3 = jméno
  // 4 = příjmení
  // 5 = telefon
  // 6 = email

  await inputs.nth(0).fill(String(data.guests));
  await inputs.nth(1).fill(data.date);
  await inputs.nth(2).fill(data.time);
  await inputs.nth(3).fill(data.firstName);
  await inputs.nth(4).fill(data.lastName);
  await inputs.nth(5).fill(data.phone);
  await inputs.nth(6).fill(data.email);

  // 3) Selecty (Doba trvání, Zdroj, Příležitost)
  const selects = page.locator("select");

  await selects.nth(0).selectOption(data.duration);
  await selects.nth(1).selectOption(data.source);
  await selects.nth(2).selectOption(data.occasion);

  // 4) Poznámka
  await page.locator("textarea").fill(data.note ?? "");

  // 5) Odeslat formulář
  await page.getByRole("button").click();

  // 6) Počkat na potvrzení
  await page.waitForTimeout(4000);

  await browser.close();
}

run();
