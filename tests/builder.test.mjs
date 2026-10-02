import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  placementIssue,
  fitRunToModules,
  projectPoint,
  drawProposal,
  replaceAllFences,
  emptyProject,
  addRun,
  resolveProject,
  placeGate,
  removeElement,
  resizeRun,
  addAccessory,
  importProject,
  assertProject,
  changeElement,
  gateProposal,
} from "../fence-configurator/js/builder-engine.js";
import {
  defaultProduct,
  configureParameter,
} from "../fence-configurator/js/ontology.js";
const c = JSON.parse(
    readFileSync(new URL("../catalog/ontology.json", import.meta.url)),
  ),
  fence = defaultProduct(c, "d-94a19ed2e5ef"),
  gate = defaultProduct(c, "d-65247b2c3b82");
test("a catalog gate actually replaces fence space; custom panels refit between both gate jambs", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = placeGate(s, gate, s.segments[0].id, 4.4, c);
  const a = resolveProject(s, c),
    panels = a.parts.filter((p) => p.kind === "panel"),
    g = a.parts.find((p) => p.kind === "gate");
  assert.equal(g.a.x, 4.4);
  assert.equal(g.b.x, 5.6000000000000005);
  assert.equal(panels.length, 4);
  for (const p of panels) {
    assert.ok(Math.abs(p.variant.width - 2.2) < 1e-5);
    assert.ok(p.b.x <= 4.40001 || p.a.x >= 5.59999);
  }
  assert.equal(a.totalGaps, 0);
  assert.ok(a.issues.some((i) => i.code === "gate-opening"));
  assert.ok(a.issues.some((i) => i.code === "gate-compatibility"));
});
test("move, replace, reverse and delete gate preserve the fence and recalculate the occupied space", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = placeGate(s, gate, s.segments[0].id, 4.4, c);
  const id = s.gates[0].id;
  s = placeGate(s, gate, s.segments[0].id, 2, c, { id, handing: "right" });
  assert.equal(s.gates.length, 1);
  assert.equal(s.gates[0].handing, "right");
  const narrow = configureParameter(c, gate, "width", 0.9);
  s = changeElement(s, { type: "gate", id }, narrow, c);
  assert.equal(
    resolveProject(s, c).parts.find((p) => p.kind === "gate").variant.width,
    0.9,
  );
  s = removeElement(s, { type: "gate", id }, c);
  assert.equal(s.gates.length, 0);
  assert.equal(
    resolveProject(s, c).parts.filter((p) => p.kind === "panel").length,
    5,
  );
});
test("gate overlap, overflow and resize through a gate are rejected without modifying the project", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = placeGate(s, gate, s.segments[0].id, 4, c);
  const before = JSON.stringify(s);
  assert.throws(() => placeGate(s, gate, s.segments[0].id, 4.5, c), /suprapun/);
  assert.throws(
    () => placeGate(s, gate, s.segments[0].id, 9.5, c),
    /depășește/,
  );
  assert.throws(() => resizeRun(s, s.segments[0].id, 4, c), /depășește/);
  assert.equal(JSON.stringify(s), before);
});
test("mixed styles can be planned with explicit technical issues; accessories and gates persist", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = addRun(
    s,
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    defaultProduct(c, "panouri-bordurate-vega-b"),
    c,
  );
  s = placeGate(s, gate, s.segments[0].id, 4.4, c);
  const accessory = c.models.find((m) => m.kind === "accessory");
  s = addAccessory(s, accessory.id, 3, c);
  const a = resolveProject(s, c);
  assert.ok(a.issues.some((i) => i.code === "mixed-joint"));
  assert.equal(
    a.items.find((i) => i.id === "manual:" + accessory.id).quantity,
    3,
  );
  assert.deepEqual(
    resolveProject(importProject(JSON.parse(JSON.stringify(s)), c), c),
    a,
  );
});
test("fixed panels never stretch to conceal a gate remainder", () => {
  let s = addRun(
    emptyProject(c),
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    defaultProduct(c, "panouri-bordurate-vega-b"),
    c,
  );
  s = placeGate(s, gate, s.segments[0].id, 5, c);
  const a = resolveProject(s, c);
  assert.equal(a.parts.filter((p) => p.kind === "panel").length, 3);
  assert.ok(Math.abs(a.totalGaps - 1.3) < 1e-5);
  for (const p of a.parts.filter((p) => p.kind === "panel"))
    assert.equal(p.variant.width, 2.5);
});
test("crossings become explicit nodes, and unknown data stays rejected", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = addRun(s, { x: 5, y: -5 }, { x: 5, y: 5 }, fence, c);
  assert.equal(s.segments.length, 4);
  assert.equal(s.nodes.filter((n) => n.x === 5 && n.y === 0).length, 1);
  assert.throws(() => assertProject({ ...s, catalogVersion: "unknown" }, c));
});
test("custom dimensions distribute the increment without artificial gaps and BOM matches geometry", () => {
  const s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 5, y: 0 }, fence, c),
    a = resolveProject(s, c),
    p = a.parts.filter((p) => p.kind === "panel");
  assert.deepEqual(
    p.map((x) => x.variant.width),
    [1.66, 1.67, 1.67],
  );
  assert.equal(a.totalGaps, 0);
  assert.ok(Math.abs(p.at(-1).b.x - 5) < 1e-9);
  assert.equal(
    a.items
      .filter((i) => i.label.startsWith("Panou"))
      .reduce((sum, i) => sum + i.quantity, 0),
    3,
  );
});
test("gate snapping at a non-centimetric run end cannot round beyond the perimeter", () => {
  const s = addRun(
      emptyProject(c),
      { x: 0, y: 0 },
      { x: 5.006, y: 0 },
      fence,
      c,
    ),
    q = gateProposal(s, gate, { x: 5.006, y: 0 }, c);
  assert.ok(Math.abs(q.offset + q.span - 5.006) < 1e-9);
  assert.equal(q.next.gates.length, 1);
});
test("every dimensioned catalog fence and gate can enter the builder; missing geometry stays explicit", () => {
  for (const m of c.models.filter(
    (m) =>
      m.inScope && m.parameters.length && ["panel", "gate"].includes(m.kind),
  )) {
    if (placementIssue(m)) {
      assert.match(placementIssue(m), /Unitatea/);
      continue;
    }
    const p = defaultProduct(c, m.id);
    let s;
    if (m.kind === "panel")
      s = addRun(
        emptyProject(c),
        { x: 0, y: 0 },
        { x: Math.max(0.1, p.parameters.width * 2), y: 0 },
        p,
        c,
      );
    else {
      s = addRun(
        emptyProject(c),
        { x: 0, y: 0 },
        { x: Math.max(20, p.parameters.width + 5), y: 0 },
        fence,
        c,
      );
      s = placeGate(s, p, s.segments[0].id, 1, c);
    }
    const a = resolveProject(s, c);
    assert.ok(
      a.parts.some((p) => p.kind === m.kind),
      m.name,
    );
    for (const i of a.items)
      assert.ok(Number.isFinite(i.quantity) && i.quantity > 0, m.name);
  }
});
test("roll purchasing quantities aggregate before rounding across disconnected runs", () => {
  const m = c.models.find(
      (m) => m.parameters.length && m.commercialVariants[0]?.legacy.rollLength,
    ),
    p = defaultProduct(c, m.id),
    roll = m.commercialVariants[0].legacy.rollLength;
  let s = addRun(
    emptyProject(c),
    { x: 0, y: 0 },
    { x: roll * 0.4, y: 0 },
    p,
    c,
  );
  s = addRun(s, { x: 0, y: 2 }, { x: roll * 0.4, y: 2 }, p, c);
  const a = resolveProject(s, c),
    r = a.items.find((i) => i.unit === "role");
  assert.equal(r.quantity, 1);
  assert.ok(Math.abs(r.netLength - roll * 0.8) < 1e-5);
});
test("scene complexity is bounded before geometry allocation", () => {
  const tiny = configureParameter(c, fence, "width", 0.1);
  assert.throws(
    () => addRun(emptyProject(c), { x: -500, y: 0 }, { x: 500, y: 0 }, tiny, c),
    /1.500/,
  );
});

test("replace perimeter preserves gates and points; source-unit conflicts remain visible but unplaceable", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = placeGate(s, gate, s.segments[0].id, 2, c);
  const changed = replaceAllFences(
    s,
    defaultProduct(c, "panouri-bordurate-vega-b"),
    c,
  );
  assert.deepEqual(changed.nodes, s.nodes);
  assert.deepEqual(changed.gates, s.gates);
  assert.equal(changed.segments[0].modelId, "panouri-bordurate-vega-b");
  assert.throws(
    () =>
      placeGate(s, defaultProduct(c, "d-e292708c8dde"), s.segments[0].id, 0, c),
    /Unitatea/,
  );
});

test("branching away from a gate preserves its world position; cutting through it fails atomically", () => {
  let s = addRun(emptyProject(c), { x: 0, y: 0 }, { x: 10, y: 0 }, fence, c);
  s = placeGate(s, gate, s.segments[0].id, 7, c);
  const before = JSON.stringify(s);
  assert.throws(
    () => addRun(s, { x: 7.5, y: 0 }, { x: 7.5, y: 3 }, fence, c),
    /poartă/,
  );
  assert.equal(JSON.stringify(s), before);
  const next = addRun(s, { x: 5, y: 0 }, { x: 5, y: 3 }, fence, c);
  assert.equal(next.segments.length, 3);
  assert.equal(next.gates.length, 1);
  assert.equal(next.gates[0].id, s.gates[0].id);
  assert.deepEqual(
    projectPoint(next, next.gates[0].segmentId, next.gates[0].offset),
    { x: 7, y: 0 },
  );
});
test("orthogonal drawing follows the cursor projection rather than inflating length from diagonal distance", () => {
  const q = drawProposal(
    emptyProject(c),
    fence,
    { x: 0, y: 0 },
    { x: 5, y: 1 },
    c,
  );
  assert.ok(Math.abs(q.length - 5) < 1e-9);
  assert.equal(q.b.y, 0);
});

test("explicit module fitting adjusts gate offsets and perimeter length together, without stretching", () => {
  let s = addRun(
    emptyProject(c),
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    defaultProduct(c, "panouri-bordurate-vega-b"),
    c,
  );
  s = placeGate(s, gate, s.segments[0].id, 4.4, c);
  const original = JSON.stringify(s),
    fitted = fitRunToModules(s, s.segments[0].id, c),
    a = resolveProject(fitted, c);
  assert.equal(fitted.gates[0].offset, 5);
  assert.equal(a.totalLength, 11.2);
  assert.equal(a.totalGaps, 0);
  assert.equal(a.parts.filter((p) => p.kind === "panel").length, 4);
  assert.equal(JSON.stringify(s), original);
});
