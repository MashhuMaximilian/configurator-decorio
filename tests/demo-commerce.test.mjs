import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  priceAssembly,
  quoteCsv,
  cartSnapshot,
  PRICE_NOTICE,
} from "../fence-configurator/js/demo-commerce.js";
import {
  emptyProject,
  addRun,
  placeGate,
  resolveProject,
} from "../fence-configurator/js/builder-engine.js";
import { defaultProduct } from "../fence-configurator/js/ontology.js";
const c = JSON.parse(
  fs.readFileSync(new URL("../catalog/ontology.json", import.meta.url)),
);
test("demo totals price exactly the BOM quantities and detached snapshots retain gates and parameters", () => {
  let s = addRun(
    emptyProject(c),
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    defaultProduct(c, "d-94a19ed2e5ef"),
    c,
  );
  s = placeGate(s, defaultProduct(c, "d-65247b2c3b82"), s.segments[0].id, 2, c);
  const a = resolveProject(s, c),
    price = priceAssembly(a, c),
    entry = cartSnapshot(s, a, c);
  assert.equal(
    price.lines.find((l) => l.id.startsWith("gate:")).unitPrice,
    1670,
  );
  assert.equal(price.lines.length, a.items.length);
  assert.equal(price.demo, true);
  assert.equal(price.currency, "RON");
  assert.equal(
    price.total,
    price.lines.reduce((sum, l) => sum + Math.round(l.total * 100), 0) / 100,
  );
  for (const line of price.lines)
    assert.equal(
      line.total,
      Math.round(line.unitPrice * 100 * line.quantity) / 100,
    );
  const original = JSON.stringify(entry);
  s.gates[0].offset = 3;
  assert.equal(JSON.stringify(entry), original);
  assert.deepEqual(resolveProject(entry.project, c).items, a.items);
  const csv = quoteCsv([entry]);
  assert.ok(csv.includes(PRICE_NOTICE));
  assert.ok(csv.includes(String(price.total)));
  assert.ok(csv.includes("De confirmat"));
});
test("price export escapes formula labels and includes every repeated cart project", () => {
  const entry = {
    name: "=1+1",
    pricing: {
      total: 12,
      lines: [
        {
          label: "@SUM(A1)",
          quantity: 2,
          unit: "buc",
          unitPrice: 6,
          total: 12,
        },
      ],
    },
    issues: [],
  };
  const csv = quoteCsv([entry, entry]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'@SUM(A1)"'));
  assert.ok(csv.includes('"TOTAL DEMO RON";"24"'));
});
