// scripts/createDishReservation.ts

import * as fs from "fs";
import * as path from "path";

interface DishReservationPayload {
  name: string;
  phone: string;
  guests: number;
  date: string; // ISO string nebo "YYYY-MM-DD"
  time: string; // "HH:mm"
  note?: string;
}

function readPayload(filePath: string): DishReservationPayload {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`Payload file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse payload.json as JSON:", err);
    process.exit(1);
  }

  const payload = json as Partial<DishReservationPayload>;

  if (!payload.name || !payload.phone || !payload.guests || !payload.date || !payload.time) {
    console.error("Invalid payload: name, phone, guests, date and time are required.");
    console.error("Got:", payload);
    process.exit(1);
  }

  return payload as DishReservationPayload;
}

async function createDishReservation(payload: DishReservationPayload): Promise<void> {
  // Tady by normálně byl call na Dish API nebo cokoliv dalšího.
  // Zatím jen simulace – ať máš funkční základ.

  console.log("Creating DISH reservation with payload:");
  console.log(JSON.stringify(payload, null, 2));

  // TODO: sem pak doplníš reálný HTTP request na Dish / Lovable / cokoliv.
}

async function main() {
  const payloadFile = process.argv[2] || "payload.json";

  console.log(`Using payload file: ${payloadFile}`);

  const payload = readPayload(payloadFile);

  try {
    await createDishReservation(payload);
    console.log("Reservation created successfully (simulated).");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create reservation:", err);
    process.exit(1);
  }
}

main();
