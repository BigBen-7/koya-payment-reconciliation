// Payment reconciliation.
//
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js

const fs = require("fs");

// Latest attempt per txn_id (by timestamp). Unreadable lines and events
// without a txn_id are ignored.
const latest = new Map();

const lines = fs.readFileSync("payments.jsonl", "utf8").split("\n");
for (const line of lines) {
  if (line.trim().length === 0) continue;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue; // line can't be read
  }
  if (event === null || typeof event !== "object" || !event.txn_id) continue;

  const time = Date.parse(event.ts);
  const prev = latest.get(event.txn_id);
  if (!prev || time > prev.time) {
    latest.set(event.txn_id, { time, event });
  }
}

// Amounts may be numbers or strings with thousands separators ("4,817.06").
function parseAmount(value) {
  if (typeof value === "number") return value;
  return Number(String(value).replace(/,/g, ""));
}

// Sum in kobo (integers) to avoid floating-point drift.
let totalKobo = 0;
let count = 0;
for (const { event } of latest.values()) {
  if (event.status === "success") {
    totalKobo += Math.round(parseAmount(event.amount) * 100);
    count += 1;
  }
}
const total = totalKobo / 100;

const expected = parseInt(fs.readFileSync("expected.txt", "utf8").trim(), 10);

if (count !== expected) {
  console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
  console.log("Something in the data isn't being handled the way the README describes.");
} else {
  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Your code: KOYA-${Math.round(total)}`);
}
