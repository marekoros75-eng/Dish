import { chromium } from 'playwright';

async function run() {
  const data = JSON.parse(process.env.RESERVATION_PAYLOAD);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`https://reservation.dish.co/reservation/add?date=${data.date}`, {
    waitUntil: 'networkidle'
  });

  await page.getByLabel(/Počet/i).fill(String(data.guests));
  await page.getByLabel(/Datum/i).fill(data.date);
  await page.getByLabel(/Čas/i).fill(data.time);
  await page.getByLabel(/Doba trvání/i).selectOption(data.duration);
  await page.getByLabel(/Zdroj/i).selectOption(data.source);
  await page.getByLabel(/Příležitost/i).selectOption(data.occasion);
  await page.getByLabel(/Příjmení/i).fill(data.lastName);
  await page.getByLabel(/Jméno/i).fill(data.firstName);
  await page.getByLabel(/Telefon/i).fill(data.phone);
  await page.getByLabel(/E-mail/i).fill(data.email);
  await page.getByLabel(/Poznámka/i).fill(data.note ?? "");

  await page.getByRole('button', { name: /Rezervovat|Odeslat/i }).click();

  await page.waitForTimeout(3000);
  await browser.close();
}

run();
