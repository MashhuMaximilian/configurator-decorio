import {
  modelById,
  resolveProduct,
  productSignature,
  hasModelVisual,
} from "./ontology.js";
import {
  deriveAssembly as deriveLegacy,
  assertState as validateLegacy,
  csv as serializeCsv,
} from "./project.js";
export const APP_ID = "decorio-fence",
  VERSION = 3;
const clone = (x) => structuredClone(x),
  EPS = 1e-5;
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const uid = (prefix) => prefix + "_" + crypto.randomUUID().replaceAll("-", "");
export const emptyProject = (catalog) => ({
  appId: APP_ID,
  schemaVersion: VERSION,
  catalogVersion: catalog.version,
  name: "Gardul meu",
  nodes: [],
  segments: [],
  gates: [],
  accessories: [],
  options: { dimensions: true },
});
export function placementIssue(model) {
  if (!model.parameters.length)
    return "Dimensiunile necesare plasării nu sunt publicate.";
  if (model.defaults.width > 500)
    return (
      "Unitatea lățimii din sursă este neclară (" +
      model.defaults.width +
      " m). Plasarea așteaptă confirmarea datelor."
    );
  return null;
}
export function selectionOf(e) {
  return { modelId: e.modelId, parameters: { ...e.parameters } };
}
export function assertProject(input, catalog) {
  if (
    !input ||
    input.appId !== APP_ID ||
    input.schemaVersion !== VERSION ||
    input.catalogVersion !== catalog.version
  )
    throw Error("Proiectul sau versiunea catalogului nu este compatibilă.");
  if (
    !["nodes", "segments", "gates", "accessories"].every((k) =>
      Array.isArray(input[k]),
    )
  )
    throw Error("Fișier de proiect incomplet.");
  if (
    input.nodes.length > 300 ||
    input.segments.length > 300 ||
    input.gates.length > 100 ||
    input.accessories.length > 500
  )
    throw Error("Împarte proiectul în zone mai mici.");
  if (
    typeof input.name !== "string" ||
    input.name.length > 120 ||
    typeof input.options?.dimensions !== "boolean"
  )
    throw Error("Date de proiect invalide.");
  const ids = new Set();
  for (const e of [
    ...input.nodes,
    ...input.segments,
    ...input.gates,
    ...input.accessories,
  ]) {
    if (typeof e.id !== "string" || !e.id || ids.has(e.id))
      throw Error("Identificatori invalizi.");
    ids.add(e.id);
  }
  for (const p of input.nodes)
    if (![p.x, p.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 500))
      throw Error("Planul este limitat la 500 m față de origine.");
  const nodes = new Map(input.nodes.map((n) => [n.id, n]));
  let estimatedModules = 0;
  for (const s of input.segments) {
    if (
      !nodes.has(s.a) ||
      !nodes.has(s.b) ||
      distance(nodes.get(s.a), nodes.get(s.b)) < 0.1
    )
      throw Error("Latura trebuie să aibă cel puțin 10 cm.");
    const r = resolveProduct(catalog, s);
    if (placementIssue(r.model)) throw Error(placementIssue(r.model));
    if (r.model.kind !== "panel") throw Error("Alege un gard pentru latură.");
    if (s.autoFit !== undefined && typeof s.autoFit !== "boolean")
      throw Error("Regulă de dimensionare invalidă.");
    estimatedModules += Math.ceil(
      distance(nodes.get(s.a), nodes.get(s.b)) / Math.max(0.1, r.variant.width),
    );
    if (estimatedModules > 1500)
      throw Error(
        "Proiectul depășește 1.500 de module. Împarte-l în zone mai mici.",
      );
  }
  for (let i = 0; i < input.segments.length; i++)
    for (let j = i + 1; j < input.segments.length; j++) {
      const a = input.segments[i],
        b = input.segments[j],
        hit = intersection(
          nodes.get(a.a),
          nodes.get(a.b),
          nodes.get(b.a),
          nodes.get(b.b),
        );
      if (hit?.overlap)
        throw Error("Gardurile se suprapun. Alege altă poziție.");
      if (hit && !([a.a, a.b].includes(b.a) || [a.a, a.b].includes(b.b)))
        throw Error("Intersecția trebuie să aibă un colț comun.");
    }
  for (const g of input.gates) {
    const s = input.segments.find((s) => s.id === g.segmentId),
      r = resolveProduct(catalog, g);
    if (placementIssue(r.model)) throw Error(placementIssue(r.model));
    if (
      !s ||
      r.model.kind !== "gate" ||
      !Number.isFinite(g.offset) ||
      g.offset < 0 ||
      !["left", "right"].includes(g.handing)
    )
      throw Error("Poziție de poartă invalidă.");
    const span = gateSpan(r);
    if (g.offset + span > distance(nodes.get(s.a), nodes.get(s.b)) + EPS)
      throw Error(
        "Poarta depășește latura. Mărește latura sau alege o poartă mai îngustă.",
      );
    for (const other of input.gates) {
      if (other.id === g.id || other.segmentId !== g.segmentId) continue;
      const end = other.offset + gateSpan(resolveProduct(catalog, other));
      if (g.offset < end - EPS && g.offset + span > other.offset + EPS)
        throw Error("Porțile se suprapun. Mută poarta în zona liberă.");
    }
  }
  for (const item of input.accessories) {
    const m = modelById(catalog, item.modelId);
    if (
      m.kind === "panel" ||
      m.kind === "gate" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10000
    )
      throw Error("Cantitate de accesoriu invalidă.");
  }
  return clone(input);
}
export function importProject(input, catalog) {
  if (input?.schemaVersion === 2) {
    const old = validateLegacy(input, catalog);
    return assertProject(
      {
        ...old,
        schemaVersion: VERSION,
        segments: old.segments.map((s) => ({ ...s, autoFit: false })),
        accessories: [],
      },
      catalog,
    );
  }
  return assertProject(input, catalog);
}
export function gateSpan(resolved) {
  return resolved.variant.opening || resolved.variant.width;
}
export function projectPoint(state, runId, offset) {
  const s = state.segments.find((s) => s.id === runId),
    a = state.nodes.find((n) => n.id === s.a),
    b = state.nodes.find((n) => n.id === s.b),
    t = offset / distance(a, b);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function nearestRun(state, point) {
  let best;
  for (const s of state.segments) {
    const a = state.nodes.find((n) => n.id === s.a),
      b = state.nodes.find((n) => n.id === s.b),
      length = distance(a, b),
      offset = Math.max(
        0,
        Math.min(
          length,
          ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) /
            length,
        ),
      ),
      p = projectPoint(state, s.id, offset),
      d = distance(p, point);
    if (!best || d < best.distance)
      best = { segmentId: s.id, offset, distance: d, point: p, length };
  }
  return best;
}
function intersection(a, b, c, d) {
  const rx = b.x - a.x,
    ry = b.y - a.y,
    sx = d.x - c.x,
    sy = d.y - c.y,
    den = rx * sy - ry * sx,
    dx = c.x - a.x,
    dy = c.y - a.y;
  if (Math.abs(den) < EPS) {
    if (Math.abs(dx * ry - dy * rx) > EPS) return null;
    const r2 = rx * rx + ry * ry,
      t0 = (dx * rx + dy * ry) / r2,
      t1 = ((d.x - a.x) * rx + (d.y - a.y) * ry) / r2;
    return Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > EPS
      ? { overlap: true }
      : null;
  }
  const t = (dx * sy - dy * sx) / den,
    u = (dx * ry - dy * rx) / den;
  if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS)
    return { x: a.x + rx * t, y: a.y + ry * t, t, u };
  return null;
}
export function addRun(state, a, b, product, catalog, { autoFit = true } = {}) {
  const next = clone(state);
  function node(p) {
    let n = next.nodes.find((n) => distance(n, p) < 0.015);
    if (!n) {
      n = { id: uid("n"), x: p.x, y: p.y };
      next.nodes.push(n);
    }
    return n;
  }
  const start = node(a),
    end = node(b);
  next.segments.push({
    id: uid("r"),
    a: start.id,
    b: end.id,
    ...selectionOf(product),
    autoFit,
  });
  const original = [...next.segments],
    cuts = new Map(
      original.map((s) => [
        s.id,
        [
          { id: s.a, t: 0 },
          { id: s.b, t: 1 },
        ],
      ]),
    ),
    get = (id) => next.nodes.find((n) => n.id === id);
  for (let i = 0; i < original.length; i++)
    for (let j = i + 1; j < original.length; j++) {
      const s = original[i],
        t = original[j],
        hit = intersection(get(s.a), get(s.b), get(t.a), get(t.b));
      if (hit?.overlap) throw Error("Gardurile se suprapun.");
      if (!hit) continue;
      for (const [edge, fraction] of [
        [s, hit.t],
        [t, hit.u],
      ]) {
        const offset = fraction * distance(get(edge.a), get(edge.b));
        if (
          next.gates.some(
            (g) =>
              g.segmentId === edge.id &&
              offset > g.offset + EPS &&
              offset < g.offset + gateSpan(resolveProduct(catalog, g)) - EPS,
          )
        )
          throw Error(
            "Gardul ar traversa o poartă. Mută ramificația în afara deschiderii.",
          );
      }
      const n = node(hit);
      cuts.get(s.id).push({ id: n.id, t: hit.t });
      cuts.get(t.id).push({ id: n.id, t: hit.u });
    }
  next.segments = [];
  const oldGates = next.gates;
  next.gates = [];
  for (const s of original) {
    const points = [
      ...new Map(cuts.get(s.id).map((p) => [p.id, p])).values(),
    ].sort((a, b) => a.t - b.t);
    const runLength = distance(get(s.a), get(s.b));
    for (let i = 1; i < points.length; i++) {
      const child = {
        ...s,
        id: i === 1 ? s.id : uid("r"),
        a: points[i - 1].id,
        b: points[i].id,
      };
      next.segments.push(child);
      const from = points[i - 1].t * runLength,
        to = points[i].t * runLength;
      for (const gate of oldGates.filter((g) => g.segmentId === s.id)) {
        if (
          gate.offset >= from - EPS &&
          gate.offset + gateSpan(resolveProduct(catalog, gate)) <= to + EPS
        )
          next.gates.push({
            ...gate,
            segmentId: child.id,
            offset: Math.max(0, gate.offset - from),
          });
      }
    }
  }
  return assertProject(next, catalog);
}
export function drawProposal(
  state,
  product,
  a,
  target,
  catalog,
  { ortho = true, snapModules = true, exact = false } = {},
) {
  const r = resolveProduct(catalog, product);
  let angle = Math.atan2(target.y - a.y, target.x - a.x),
    length = distance(a, target);
  if (length < 0.1) throw Error("Alege capătul laturii.");
  if (ortho && !exact) {
    angle = (Math.round(angle / (Math.PI / 2)) * Math.PI) / 2;
    length = Math.abs(
      (target.x - a.x) * Math.cos(angle) + (target.y - a.y) * Math.sin(angle),
    );
  }
  if (
    snapModules &&
    !exact &&
    !r.model.custom &&
    !["chainlink", "roll-welded"].includes(r.model.legacyGenerator)
  )
    length =
      Math.max(1, Math.round(length / r.variant.width)) * r.variant.width;
  const b = exact
    ? { x: target.x, y: target.y }
    : { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length };
  return {
    next: addRun(state, a, b, product, catalog),
    a,
    b,
    length: distance(a, b),
    angle: (angle * 180) / Math.PI,
  };
}
export function placeGate(
  state,
  product,
  runId,
  offset,
  catalog,
  { id, handing = "left" } = {},
) {
  const problem = placementIssue(modelById(catalog, product.modelId));
  if (problem) throw Error(problem);
  const next = clone(state);
  next.gates = next.gates.filter((g) => g.id !== id);
  next.gates.push({
    id: id || uid("g"),
    segmentId: runId,
    offset,
    handing,
    ...selectionOf(product),
  });
  return assertProject(next, catalog);
}
export function gateProposal(
  state,
  product,
  point,
  catalog,
  { id, handing = "left" } = {},
) {
  const near = nearestRun(state, point);
  if (!near || near.distance > 2)
    throw Error("Apropie poarta de o latură a gardului.");
  const r = resolveProduct(catalog, product),
    span = gateSpan(r);
  if (span > near.length)
    throw Error(
      "Poarta este mai lată decât latura. Alege altă latură sau micșorează poarta.",
    );
  const offset = Math.min(
    near.length - span,
    Math.round(Math.max(0, near.offset - span / 2) * 100) / 100,
  );
  return {
    next: placeGate(state, product, near.segmentId, offset, catalog, {
      id,
      handing,
    }),
    segmentId: near.segmentId,
    offset,
    span,
  };
}
export function changeElement(state, target, product, catalog) {
  const next = clone(state),
    list = target.type === "gate" ? next.gates : next.segments,
    e = list.find((e) => e.id === target.id);
  if (!e) throw Error("Selectează piesa pe care vrei să o schimbi.");
  Object.assign(e, selectionOf(product));
  return assertProject(next, catalog);
}
export function replaceAllFences(state, product, catalog) {
  return assertProject(
    {
      ...state,
      segments: state.segments.map((s) => ({ ...s, ...selectionOf(product) })),
    },
    catalog,
  );
}
export function moveCorner(state, id, point, catalog, { align = true } = {}) {
  const next = clone(state),
    node = state.nodes.find((n) => n.id === id);
  if (!node) throw Error("Colț necunoscut.");
  for (const axis of ["x", "y"]) {
    const linked = new Set([id]),
      queue = [id];
    if (align)
      while (queue.length) {
        const n = queue.shift();
        for (const edge of state.segments.filter(
          (e) => e.a === n || e.b === n,
        )) {
          const other = edge.a === n ? edge.b : edge.a,
            a = state.nodes.find((p) => p.id === n),
            b = state.nodes.find((p) => p.id === other);
          if (!linked.has(other) && Math.abs(a[axis] - b[axis]) < EPS) {
            linked.add(other);
            queue.push(other);
          }
        }
      }
    for (const n of next.nodes) if (linked.has(n.id)) n[axis] = point[axis];
  }
  return assertProject(next, catalog);
}
export function resizeRun(state, id, length, catalog) {
  const s = state.segments.find((s) => s.id === id),
    a = state.nodes.find((n) => n.id === s.a),
    b = state.nodes.find((n) => n.id === s.b),
    ratio = length / distance(a, b);
  if (!Number.isFinite(length) || length < 0.1 || length > 500)
    throw Error("Lungime între 0,1 și 500 m.");
  return moveCorner(
    state,
    b.id,
    { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio },
    catalog,
  );
}
export function removeElement(state, target, catalog) {
  const next = clone(state);
  if (target.type === "run") {
    next.segments = next.segments.filter((s) => s.id !== target.id);
    next.gates = next.gates.filter((g) => g.segmentId !== target.id);
    next.nodes = next.nodes.filter((n) =>
      next.segments.some((s) => s.a === n.id || s.b === n.id),
    );
  } else if (target.type === "gate")
    next.gates = next.gates.filter((g) => g.id !== target.id);
  else next.accessories = next.accessories.filter((a) => a.id !== target.id);
  return assertProject(next, catalog);
}
export function addAccessory(state, modelId, quantity, catalog) {
  const next = clone(state),
    existing = next.accessories.find((a) => a.modelId === modelId);
  if (existing) existing.quantity += quantity;
  else next.accessories.push({ id: uid("a"), modelId, quantity });
  return assertProject(next, catalog);
}
export function resolveProject(state, catalog) {
  assertProject(state, catalog);
  const parts = [],
    items = new Map(),
    issues = [],
    posts = new Map();
  let totalLength = 0,
    totalGaps = 0;
  const issue = (message, segmentId = "", code = "confirmation") => {
    if (!issues.some((i) => i.message === message && i.segmentId === segmentId))
      issues.push({ message, segmentId, code });
  };
  const row = (key, data) => {
    const old = items.get(key);
    if (old) old.quantity += data.quantity;
    else items.set(key, { id: key, code: "", unit: "buc", notes: "", ...data });
  };
  for (const run of state.segments) {
    const a = state.nodes.find((n) => n.id === run.a),
      b = state.nodes.find((n) => n.id === run.b),
      length = distance(a, b),
      r = resolveProduct(catalog, run),
      gates = state.gates
        .filter((g) => g.segmentId === run.id)
        .sort((a, b) => a.offset - b.offset);
    totalLength += length;
    const ranges = [];
    let start = 0;
    for (const gate of gates) {
      const g = resolveProduct(catalog, gate),
        span = gateSpan(g);
      ranges.push([start, gate.offset]);
      start = gate.offset + span;
      parts.push({
        kind: "gate",
        elementId: gate.id,
        segmentId: run.id,
        a: projectPoint(state, run.id, gate.offset),
        b: projectPoint(state, run.id, start),
        variant: g.variant,
        resolved: g,
        visual: g.visual,
        product: { name: g.model.name },
        generator: g.model.legacyGenerator,
        handing: gate.handing,
      });
      row("gate:" + productSignature(gate), {
        code: g.commercial?.sku || "",
        label: g.model.name + " · " + g.variant.label,
        quantity: 1,
        unit: g.variant.included?.length ? "set" : "buc",
        source: g.source,
        notes:
          "Poartă completă; componentele declarate incluse nu se adaugă separat.",
      });
      if (!g.variant.opening)
        issue(
          "Poarta este planificată la lățimea produsului. Golul între stâlpi și rosturile de montaj trebuie confirmate.",
          run.id,
          "gate-opening",
        );
      if (
        !g.model.compatibleWith.some((id) =>
          r.model.sourceProductIds.includes(id),
        )
      )
        issue(
          "Prinderea porții de acest gard nu este încă validată. Verifică stâlpii și piesele de legătură.",
          run.id,
          "gate-compatibility",
        );
      issue(
        g.model.legacyGenerator === "sliding"
          ? "Rezervă și verifică spațiul lateral pentru culisare."
          : "Verifică spațiul liber pentru deschiderea porții.",
        run.id,
        "gate-operation",
      );
    }
    ranges.push([start, length]);
    const chunks = [];
    for (const [from, to] of ranges) {
      const span = to - from;
      if (span < EPS) continue;
      const product = selectionOf(run),
        wd = r.model.parameters.find((d) => d.id === "width");
      let fitted = false;
      if (run.autoFit && r.model.custom && wd?.type === "number") {
        const minimum = wd.min || 0.1,
          nMin = Math.max(1, Math.ceil((span - EPS) / wd.max)),
          nMax = Math.floor((span + EPS) / minimum);
        if (nMax >= nMin) {
          const n = Math.min(
              nMax,
              Math.max(nMin, Math.round(span / r.variant.width)),
            ),
            step = wd.step || 0.001,
            units = Math.floor((span + EPS) / step),
            low = Math.floor(units / n),
            extra = units - low * n;
          // Distribute the published dimension increment; e.g. 5 m = 1.66 + 1.67 + 1.67, never three stretched panels.
          if (
            low * step >= minimum - EPS &&
            (low + (extra ? 1 : 0)) * step <= wd.max + EPS
          ) {
            let cursor = from;
            for (const [count, u] of [
              [n - extra, low],
              [extra, low + 1],
            ])
              if (count) {
                const width = Number((u * step).toFixed(6)),
                  end = cursor + width * count;
                chunks.push({
                  from: cursor,
                  to: end,
                  product: {
                    ...product,
                    parameters: { ...product.parameters, width },
                  },
                });
                cursor = end;
              }
            if (to - cursor > EPS) {
              parts.push({
                kind: "gap",
                segmentId: run.id,
                elementId: run.id,
                a: projectPoint(state, run.id, cursor),
                b: projectPoint(state, run.id, to),
              });
              totalGaps += to - cursor;
              issue(
                "Rămâne un spațiu mai mic decât incrementul dimensional publicat. Confirmă rostul de montaj.",
                run.id,
                "gap",
              );
            }
            fitted = true;
          }
        }
      }
      if (!fitted) chunks.push({ from, to, product });
    }
    for (const { from, to, product } of chunks) {
      const pa = projectPoint(state, run.id, from),
        pb = projectPoint(state, run.id, to),
        single = {
          appId: APP_ID,
          schemaVersion: 2,
          catalogVersion: catalog.version,
          name: state.name,
          nodes: [
            { id: "a", ...pa },
            { id: "b", ...pb },
          ],
          segments: [{ id: "s", a: "a", b: "b", ...product }],
          gates: [],
          options: state.options,
        };
      const resolved = deriveLegacy(single, catalog),
        signature = productSignature(product);
      for (const part of resolved.parts) {
        part.segmentId = run.id;
        part.elementId = run.id;
        if (part.kind === "post") {
          const key =
            part.point.x.toFixed(5) +
            "," +
            part.point.y.toFixed(5) +
            "|" +
            part.variant.post.system +
            "|" +
            part.variant.post.height +
            "|" +
            part.variant.finish;
          if (!posts.has(key)) posts.set(key, part);
          continue;
        }
        if (part.kind === "gap") {
          totalGaps += distance(part.a, part.b);
          issue(
            "Rămâne un spațiu de " +
              distance(part.a, part.b).toFixed(3) +
              " m. Ajustează lungimea laturii, poziția porții sau alege un panou la comandă.",
            run.id,
            "gap",
          );
        }
        parts.push(part);
      }
      for (const item of resolved.items)
        if (!item.id.includes("-post-") && !item.id.includes("-clamp-"))
          row(signature + "|" + item.id, {
            ...item,
            id: undefined,
            ...(Number.isFinite(item.netLength)
              ? {
                  quantity: item.netLength,
                  unit: "m",
                  rollLength: r.variant.rollLength,
                  notes: "Necesar net; fără pierderi sau suprapuneri.",
                }
              : {}),
          });
      for (const i of resolved.issues)
        if (i.code !== "remainder") issue(i.message, run.id, i.code);
      if (!hasModelVisual(r.model))
        issue(
          "Acest gard este documentat în catalog, dar nu are încă model 3D. Planul arată conturul său.",
          run.id,
          "visual",
        );
    }
    issue(
      "Cantități preliminare: rosturile, fundațiile și prinderile se confirmă pentru montaj.",
      run.id,
    );
  }
  for (const post of posts.values()) {
    parts.push(post);
    const v = post.variant,
      p = v.post;
    row("post:" + p.name + p.height + v.finish, {
      label: p.name + " · " + p.height + " m · " + v.finish,
      quantity: 1,
      source: p.source,
      notes: p.notes || "Capacul inclus nu se numără separat.",
    });
    if (p.clamps)
      row("fixing:" + p.system + v.finish, {
        label: "Set prindere " + p.system + " · " + v.finish,
        quantity: p.clamps,
        unit: "set",
        source: p.source,
        notes: "Prinderea la colțuri și lângă porți se confirmă.",
      });
  }
  for (const item of state.accessories) {
    const m = modelById(catalog, item.modelId);
    row("manual:" + m.id, {
      label: m.name,
      quantity: item.quantity,
      unit: "articole",
      source: m.sources[0],
      notes:
        "Cantitate de articole comerciale, cu ambalajul din denumire. Adăugat manual. Verifică potrivirea și dacă este deja inclus într-un kit.",
    });
  }
  // Planning different systems at a shared corner is allowed, but never sold as a validated connection.
  for (const node of state.nodes) {
    const runs = state.segments.filter(
      (r) => r.a === node.id || r.b === node.id,
    );
    if (new Set(runs.map((r) => productSignature(r))).size > 1)
      issue(
        "Îmbinare între configurații diferite: stâlpii și prinderile necesită confirmare.",
        "",
        "mixed-joint",
      );
  }
  return {
    parts,
    items: [...items.entries()].map(([id, item]) => ({
      ...item,
      id,
      ...(item.rollLength
        ? {
            netLength: item.quantity,
            quantity: Math.ceil((item.quantity - EPS) / item.rollLength),
            unit: "role",
            notes:
              item.notes +
              " " +
              item.rollLength +
              " m/rolă; necesar net " +
              item.quantity.toFixed(2) +
              " m.",
          }
        : {}),
    })),
    issues,
    totalLength: Number(totalLength.toFixed(3)),
    totalGaps: Number(totalGaps.toFixed(3)),
    complete: false,
  };
}
export const csv = (assembly, state) => serializeCsv(assembly, state);

/** Explicit user action: align gate offsets and the end of a side to full catalog modules. */
export function fitRunToModules(state, runId, catalog) {
  const run = state.segments.find((s) => s.id === runId);
  if (!run) throw Error("Selectează o latură.");
  const r = resolveProduct(catalog, run);
  if (
    r.model.custom ||
    ["chainlink", "roll-welded"].includes(r.model.legacyGenerator)
  )
    throw Error("Acest gard folosește lungimi la comandă sau plasă continuă.");
  const next = clone(state),
    width = r.variant.width;
  const length = distance(
    state.nodes.find((n) => n.id === run.a),
    state.nodes.find((n) => n.id === run.b),
  );
  let oldCursor = 0,
    cursor = 0;
  const gates = state.gates
    .filter((g) => g.segmentId === runId)
    .sort((a, b) => a.offset - b.offset);
  for (const gate of gates) {
    cursor +=
      Math.max(0, Math.round((gate.offset - oldCursor) / width)) * width;
    next.gates.find((g) => g.id === gate.id).offset = Number(cursor.toFixed(6));
    const span = gateSpan(resolveProduct(catalog, gate));
    cursor += span;
    oldCursor = gate.offset + span;
  }
  cursor +=
    Math.max(gates.length ? 0 : 1, Math.round((length - oldCursor) / width)) *
    width;
  return resizeRun(next, runId, Number(cursor.toFixed(6)), catalog);
}
