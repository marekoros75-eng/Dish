"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
// __dirname náhrada pro ES modules
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path.dirname(__filename);
function readPayload(filePath) {
    // Hledáme payload.json v rootu repozitáře, ne v process.cwd()
    const absPath = path.resolve(__dirname, "../../", filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`Payload file not found: ${absPath}`);
        process.exit(1);
    }
    const raw = fs.readFileSync(absPath, "utf-8");
    let json;
    try {
        json = JSON.parse(raw);
    }
    catch (err) {
        console.error("Failed to parse payload.json:", err);
        process.exit(1);
    }
    const payload = json;
    if (!payload.name || !payload.phone || !payload.guests || !payload.date || !payload.time) {
        console.error("Invalid payload. Required fields: name, phone, guests, date, time.");
        process.exit(1);
    }
    return payload;
}
async function createDishReservation(payload) {
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
    }
    catch (err) {
        console.error("Failed to create reservation:", err);
        process.exit(1);
    }
}
main();
