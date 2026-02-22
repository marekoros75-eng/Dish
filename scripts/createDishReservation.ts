import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

interface DishReservationPayload {
  name: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  note?: string;
}

// __dirname náhrada pro ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readPayload(filePath: string): DishReservationPayload {
  // Hledáme payload.json v rootu repozitáře, ne v process.cwd()
  const absPath = path.resolve(__dirname, "../../", filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`Payload file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse payload.json:", err);
    process.exit(1);
  }

  const payload = json as Partial<DishReservationPayload>;

  if (!payload.name || !payload.phone || !payload.guests || !payload.date || !payload.time) {
    console.error("Invalid payload. Required fields: name, phone, guests, date, time.");
    process.exit(1);
  }

  return payload as DishReservationPayload;
}

async function createDishReservation(payload: DishReservationPayload): Promise<void> {
  console.log("Simulating DISH reservation creation...");
  console.log(JSON.stringify(payload, null, 2));

  // TODO: sem doplníš reálné volání API nebo automatizaci
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
