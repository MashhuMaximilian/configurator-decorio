import {
  APP_ID,
  placementIssue,
  fitRunToModules,
  replaceAllFences,
  emptyProject,
  assertProject,
  importProject,
  selectionOf,
  resolveProject,
  drawProposal,
  gateProposal,
  placeGate,
  gateSpan,
  nearestRun,
  projectPoint,
  changeElement,
  moveCorner,
  resizeRun,
  removeElement,
  addAccessory,
  distance,
  addRun,
} from "./builder-engine.js";
import {
  modelById,
  defaultProduct,
  resolveProduct,
  configureParameter,
  parameterAlternatives,
  hasModelVisual,
} from "./ontology.js";
import { BuilderScene } from "./builder-scene.js";
import { SharedUndoManager } from "../../shared-ui/src/history/undoManager.js";
import { mountStandaloneConfiguratorShell } from "../../shared-ui/src/standaloneShell.js";
import { bindPanelRange } from "../../shared-ui/src/components/panelControls.js";
import { renderCartMenu } from "../../shared-ui/src/components/cartMenu.js";
import {
  priceAssembly,
  cartSnapshot,
  quoteCsv,
  money,
  PRICE_NOTICE,
} from "./demo-commerce.js";
const CART_KEY = "decorio:demo-cart:v1";
let demoCart = [],
  editingCartKey = null;
const $ = (s) => document.querySelector(s),
  el = (t, text, cls) => {
    const e = document.createElement(t);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  },
  opt = (value, label) => {
    const e = el("option", label);
    e.value = value;
    return e;
  };
const local = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname),
  KEY = APP_ID + ":v3:builder-draft";
let catalog,
  state,
  assembly,
  scene,
  shell,
  brush,
  tool = "select",
  selected = null,
  start = null,
  proposal = null,
  category = "panel",
  replaceTarget = null,
  limit = 40,
  inspectingBrush = false,
  future = [],
  handing = "left",
  movingGate = null,
  toastTimer,
  ghostTimer,
  hoverKey = "",
  oldDraft = null,
  cleanups = [],
  cloudReady = false;
const history = new SharedUndoManager({
  capture: () => structuredClone(state),
  restore: (s) => {
    future.push(structuredClone(state));
    state = assertProject(s, catalog);
    selected = null;
    start = null;
    refresh();
    persist();
  },
});
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 5500);
}
function safe(fn) {
  return (...args) => {
    try {
      const p = fn(...args);
      p?.catch?.((e) => toast(e.message));
    } catch (e) {
      toast(e.message);
    }
  };
}
function click(id, fn) {
  $(id).onclick = safe(fn);
}
function persist() {
  try {
    if (!shell?.authUser) localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast("Exportă proiectul JSON pentru a-l păstra.");
  }
}
function commit(next, { fit = false } = {}) {
  next = assertProject(next, catalog);
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  history.record();
  future = [];
  state = next;
  clearTimeout(ghostTimer);
  proposal = null;
  hoverKey = "";
  refresh(fit);
  persist();
  shell?.markDirty();
}
function message(title, text) {
  $("#instruction").textContent = title;
  $("#feedback").textContent = text;
}
function help() {
  scene?.setAnchor(tool === "fence" ? start : null);
  if (tool === "fence")
    message(
      start
        ? "Continuă gardul din capătul marcat"
        : "Alege de unde începe gardul",
      start
        ? "Alege direcția și capătul următor. Esc încheie."
        : "Click–click sau trage pentru prima latură.",
    );
  else if (tool === "gate")
    message(
      "Așază poarta pe gard",
      "Apropie poarta de o latură și confirmă cu un click. R schimbă sensul.",
    );
  else if (tool === "erase")
    message(
      "Alege ce ștergi",
      "Click pe o poartă sau o latură. Poți anula operația.",
    );
  else
    message(
      state.segments.length
        ? "Gardul tău, în lucru"
        : "Construiește gardul tău",
      state.segments.length
        ? "Click pe gard sau poartă pentru modificare. Trage un colț pentru a-l muta."
        : "Alege un gard din trusa de jos.",
    );
}
function setTool(value) {
  tool = value;
  start = null;
  movingGate = null;
  cancelPreview();
  selected = null;
  $("#piece-wheel").hidden = true;
  $("#inspector").hidden = true;
  scene.setTool(value);
  document.body.dataset.tool = value;
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.tool === value)),
    );
  $("#active-piece").hidden = !["fence", "gate"].includes(tool);
  $("#drawing-options").hidden = tool !== "fence";
  $("#welcome").hidden =
    state.segments.length > 0 || tool !== "select" || !$("#catalog").hidden;
  syncBrush();
  help();
}
function syncBrush() {
  if (!brush) return;
  const m = modelById(catalog, brush.modelId);
  $("#active-photo").src = m.images[0] || "";
  $("#active-photo").hidden = !m.images.length;
  $("#active-name").textContent = m.name;
  $("#active-config").textContent = resolveProduct(
    catalog,
    brush,
  ).variant.label;
  $("#flip-gate").hidden = tool !== "gate";
  $("#active-kind").textContent =
    tool === "gate" ? "POARTĂ DE PLASAT" : "GARD DE CONSTRUIT";
  $("#place-length").disabled = !start;
  syncNumericProposal();
}
function syncNumericProposal() {
  if (tool !== "fence" || !brush) return;
  const r = resolveProduct(catalog, brush),
    v = Number($("#run-length").value),
    modular =
      $("#module-snap").checked &&
      !r.model.custom &&
      !["chainlink", "roll-welded"].includes(r.model.legacyGenerator),
    actual = modular
      ? Math.max(1, Math.round(v / r.variant.width)) * r.variant.width
      : v;
  $("#numeric-proposal").textContent =
    Number.isFinite(actual) && actual > 0
      ? "Latură rezultată: " +
        actual.toFixed(2) +
        " m" +
        (modular
          ? " · " + Math.round(actual / r.variant.width) + " panouri"
          : "")
      : "";
}
function refresh(fit = false) {
  assembly = resolveProject(state, catalog);
  $("#visual-status").hidden = !assembly.parts.some(
    (p) =>
      ["panel", "gate"].includes(p.kind) &&
      p.visual?.status !== "reconstructed",
  );
  scene.show(assembly, state, catalog, { selected, fit });
  $("#length-summary").textContent = assembly.totalLength.toFixed(2) + " m";
  $("#pieces-summary").textContent =
    assembly.parts.filter((p) => p.kind === "panel").length +
    " panouri · " +
    state.gates.length +
    " porți";
  $("#list-count").textContent = assembly.items.length;
  $("#demo-price").textContent =
    "Total demo: " + money(priceAssembly(assembly, catalog).total);
  $("#add-cart").disabled = !assembly.items.length;
  $("#add-cart").textContent = editingCartKey
    ? "Actualizează în coș"
    : "Adaugă în coș";
  $("#issues-button").hidden = !state.segments.length;
  $("#issues-button").textContent =
    assembly.totalGaps > 0
      ? assembly.totalGaps.toFixed(2) + " m de completat"
      : "Montaj de confirmat";
  $("#undo").disabled = !history.stack.length;
  $("#redo").disabled = !future.length;
  $("#welcome").hidden =
    state.segments.length > 0 || tool !== "select" || !$("#catalog").hidden;
  shell?.setProjectName(state.name);
  if (selected || !$("#inspector").hidden) renderInspector();
  syncBrush();
  help();
}
function cancelPreview() {
  clearTimeout(ghostTimer);
  proposal = null;
  hoverKey = "";
  if (assembly && scene) scene.show(assembly, state, catalog, { selected });
}
function snapPoint(point) {
  const near = state.nodes.find((n) => distance(n, point) < 0.22);
  return near
    ? { x: near.x, y: near.y, nodeId: near.id }
    : { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 };
}
function preview(next, label) {
  proposal = next;
  message(label.title, label.text);
  clearTimeout(ghostTimer);
  ghostTimer = setTimeout(() => {
    if (proposal === next)
      scene.show(resolveProject(next, catalog), next, catalog, {
        selected,
        ghost: true,
        fit: false,
      });
  }, 35);
}
function hover(point, event) {
  try {
    if (
      tool === "select" &&
      event.dragging &&
      event.down?.hit?.type === "gate"
    ) {
      const gate = state.gates.find((g) => g.id === event.down.hit.id);
      const q = gateProposal(state, selectionOf(gate), point, catalog, {
        id: gate.id,
        handing: gate.handing,
      });
      preview(q.next, {
        title: "Mută poarta",
        text: "Eliberează pentru plasare pe latura indicată.",
      });
      return;
    }
    if (
      tool === "select" &&
      event.dragging &&
      event.down?.hit?.type === "node"
    ) {
      const p = snapPoint(point),
        key = "move" + p.x + "," + p.y;
      if (key === hoverKey) return;
      hoverKey = key;
      preview(moveCorner(state, event.down.hit.id, p, catalog), {
        title: "Mută colțul",
        text: "Eliberează pentru confirmare. Anulează revine la forma anterioară.",
      });
      return;
    }
    if (tool === "fence") {
      const a = start || (event.dragging ? snapPoint(event.down.point) : null);
      if (!a) return;
      const p = snapPoint(point),
        key = "fence" + p.x + "," + p.y;
      if (key === hoverKey) return;
      hoverKey = key;
      const q = drawProposal(state, brush, a, p, catalog, {
        ortho: $("#ortho").checked,
        snapModules: $("#module-snap").checked,
        exact: !!p.nodeId,
      });
      const count =
        resolveProject(q.next, catalog).parts.filter((p) => p.kind === "panel")
          .length - assembly.parts.filter((p) => p.kind === "panel").length;
      preview(q.next, {
        title:
          q.length.toFixed(2) +
          " m · " +
          ((Math.atan2(q.b.y - a.y, q.b.x - a.x) * 180) / Math.PI).toFixed(1) +
          "° · " +
          count +
          " panouri",
        text: "Click sau eliberează pentru plasare. Dimensiunile produselor rămân reale.",
      });
      return;
    }
    if (tool === "gate") {
      const key =
        "gate" + Math.round(point.x * 10) + "," + Math.round(point.y * 10);
      if (key === hoverKey) return;
      hoverKey = key;
      const q = gateProposal(state, brush, point, catalog, {
        id: movingGate,
        handing,
      });
      preview(q.next, {
        title: "Poartă · " + q.span.toFixed(2) + " m",
        text:
          "Poziție la " +
          q.offset.toFixed(2) +
          " m de începutul laturii. Click plasează · R inversează.",
      });
    }
  } catch (error) {
    cancelPreview();
    message("Alege altă poziție", error.message);
  }
}
function release(point, event) {
  try {
    if (tool === "select") {
      if (event.dragging && ["node", "gate"].includes(event.down.hit?.type)) {
        if (proposal) commit(proposal);
        else cancelPreview();
        return;
      }
      if (!event.dragging) select(event.hit);
      return;
    }
    if (tool === "erase") {
      if (event.hit && event.hit.type !== "node")
        commit(removeElement(state, event.hit, catalog));
      return;
    }
    if (tool === "fence") {
      const p = snapPoint(point),
        a = start || (event.dragging ? snapPoint(event.down.point) : null);
      if (!a) {
        start = p;
        syncBrush();
        help();
        return;
      }
      const q = drawProposal(state, brush, a, p, catalog, {
        ortho: $("#ortho").checked,
        snapModules: $("#module-snap").checked,
        exact: !!p.nodeId,
      });
      commit(q.next);
      start = q.b;
      syncBrush();
      if (p.nodeId) setTool("select");
      else help();
      return;
    }
    if (tool === "gate") {
      const q = gateProposal(state, brush, point, catalog, {
        id: movingGate,
        handing,
      });
      const id = q.next.gates.at(-1).id;
      commit(q.next);
      setTool("select");
      select({ type: "gate", id });
      toast("Poarta a fost așezată în gard. Poți modifica poziția sau sensul.");
    }
  } catch (error) {
    toast(error.message);
    cancelPreview();
  }
}
function select(target) {
  setTool("select");
  if (target?.type === "node") {
    const edge = state.segments.find(
      (s) => s.a === target.id || s.b === target.id,
    );
    target = edge ? { type: "run", id: edge.id } : null;
  }
  selected = target;
  inspectingBrush = false;
  $("#catalog").hidden = true;
  $("#inspector").hidden = true;
  refresh();
}
function openCatalog(kind, { replace = null } = {}) {
  $("#piece-wheel").hidden = true;
  category = kind;
  replaceTarget = replace;
  limit = 40;
  $("#catalog").hidden = false;
  $("#inspector").hidden = true;
  $("#welcome").hidden = true;
  $("#catalog-title").textContent =
    (replace ? "Înlocuiește: " : "") +
    { panel: "Garduri", gate: "Porți", accessory: "Accesorii" }[kind];
  $("#search").value = "";
  $("#family").replaceChildren(
    opt("", "Toate familiile"),
    ...catalog.families
      .filter((f) =>
        catalog.models.some((m) => m.family === f.id && matchesKind(m, kind)),
      )
      .map((f) => opt(f.id, f.name)),
  );
  renderCatalog();
}
function matchesKind(m, kind) {
  return kind === "accessory"
    ? !["panel", "gate"].includes(m.kind)
    : m.kind === kind;
}
function sameDesign(m) {
  const run =
    selected?.type === "run"
      ? state.segments.find((s) => s.id === selected.id)
      : state.segments[0];
  if (!run) return false;
  const ref = modelById(catalog, run.modelId).visual?.evidence || [];
  return (m.visual?.infill?.evidence || []).some((e) => ref.includes(e));
}
function renderCatalog() {
  const q = $("#search").value.trim().toLowerCase(),
    family = $("#family").value,
    priority = [
      "panouri-bordurate-vega-b",
      "d-94a19ed2e5ef",
      "d-dd44fd6ecf24",
      "d-65247b2c3b82",
      "d-08eb4d4d880b",
      "d-fbf2d284033c",
    ];
  const models = catalog.models
    .filter(
      (m) =>
        m.inScope &&
        matchesKind(m, category) &&
        (!family || m.family === family) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          m.commercialVariants.some((v) => v.sku.toLowerCase().includes(q))),
    )
    .sort(
      (a, b) =>
        (category === "gate" && sameDesign(a) ? -100 : 0) -
        (category === "gate" && sameDesign(b) ? -100 : 0) +
        (priority.includes(a.id)
          ? priority.indexOf(a.id)
          : -Number(hasModelVisual(a)) + 100) -
        (priority.includes(b.id)
          ? priority.indexOf(b.id)
          : -Number(hasModelVisual(b)) + 100),
    );
  $("#catalog-info").textContent =
    models.length + " produse · alege o piesă pentru proiect";
  $("#more").hidden = models.length <= limit;
  $("#cards").replaceChildren(
    ...models.slice(0, limit).map((m) => {
      const b = el("button", undefined, "piece-card");
      b.setAttribute("aria-label", m.name);
      b.setAttribute("aria-pressed", String(brush?.modelId === m.id));
      if (m.images[0]) {
        const img = el("img");
        img.src = m.images[0];
        img.alt = "";
        img.loading = "lazy";
        b.append(img);
      }
      b.append(
        el("strong", m.name.replace("Panou Rezidential ", "")),
        el(
          "small",
          category === "accessory"
            ? "Adaugă în lista proiectului"
            : placementIssue(m)
              ? "Dimensiuni de confirmat"
              : category === "gate" && sameDesign(m)
                ? "Același desen · montaj de confirmat"
                : hasModelVisual(m)
                  ? "Configurează și plasează"
                  : "Planificare · fără model 3D",
        ),
      );
      b.onclick = safe(() => choose(m));
      return b;
    }),
  );
}
function choose(model) {
  if (category === "accessory") {
    selected = { type: "accessory-catalog", id: model.id };
    inspectingBrush = false;
    $("#catalog").hidden = true;
    $("#inspector").hidden = false;
    renderInspector();
    return;
  }
  if (placementIssue(model)) {
    modal(model.name, (host) => {
      host.append(el("p", placementIssue(model)));
      const link = el("a", "Vezi documentația produsului");
      link.href = model.sources[0].url;
      link.target = "_blank";
      link.rel = "noopener";
      host.append(link);
    });
    return;
  }
  let product = defaultProduct(catalog, model.id);
  if (category === "gate" && !replaceTarget && selected?.type === "run") {
    const run = state.segments.find((s) => s.id === selected.id);
    for (const key of ["height", "color"])
      if (run?.parameters[key] !== undefined)
        try {
          product = configureParameter(
            catalog,
            product,
            key,
            run.parameters[key],
          );
        } catch {}
  }
  if (replaceTarget) {
    const target = replaceTarget;
    commit(changeElement(state, target, product, catalog));
    replaceTarget = null;
    select(target);
    toast("Modelul a fost schimbat. Anulează revine la piesa anterioară.");
    return;
  }
  brush = product;
  $("#catalog").hidden = true;
  setTool(category === "gate" ? "gate" : "fence");
  if (!state.segments.length && category === "gate")
    message(
      "Desenează mai întâi latura gardului",
      "Poarta se așază pe o latură. Alege Garduri pentru a începe.",
    );
}
function field(label, input) {
  const wrap = el("label", label);
  wrap.append(input);
  return wrap;
}
function number(
  label,
  value,
  onChange,
  { min = 0.1, max = 500, step = 0.01 } = {},
) {
  const input = el("input");
  input.type = "number";
  Object.assign(input, { value, min, max, step });
  let applied = String(value);
  const apply = safe(() => {
    if (input.value === applied) return;
    const previous = applied;
    applied = input.value;
    try {
      onChange(Number(input.value));
    } catch (e) {
      applied = previous;
      throw e;
    }
  });
  input.onchange = apply;
  input.onblur = apply;
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    }
  };
  return field(label, input);
}
function actionButton(text, fn, cls) {
  const b = el("button", text, cls);
  b.onclick = safe(fn);
  return b;
}
function currentSelection() {
  if (inspectingBrush) return brush;
  const item =
    selected?.type === "gate"
      ? state.gates.find((g) => g.id === selected.id)
      : state.segments.find((s) => s.id === selected?.id);
  return item ? selectionOf(item) : null;
}
function updateProduct(next) {
  if (inspectingBrush) {
    brush = next;
    cancelPreview();
    renderInspector();
    syncBrush();
    return;
  }
  commit(changeElement(state, selected, next, catalog));
}
function parameterChange(key, value) {
  const current = currentSelection();
  try {
    updateProduct(configureParameter(catalog, current, key, value));
  } catch (error) {
    const proposals = parameterAlternatives(catalog, current, key, value);
    if (!proposals.length) throw error;
    modal("Opțiuni disponibile împreună", (host) => {
      host.append(
        el(
          "p",
          "Combinația aleasă nu este publicată. Alege o combinație disponibilă:",
        ),
      );
      for (const p of proposals)
        host.append(
          actionButton(
            p.changes.map((c) => c.label + ": " + c.to).join(" · "),
            () => {
              updateProduct(p.selection);
              $("#dialog").close();
            },
          ),
        );
    });
  }
}
function renderInspector() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  $("#properties").replaceChildren();
  $("#element-actions").replaceChildren();
  $("#piece-wheel").replaceChildren();
  $("#piece-wheel").hidden = true;
  if (!inspectingBrush && selected?.type === "accessory-catalog") {
    const m = modelById(catalog, selected.id);
    showPiece(
      m,
      "ACCESORIU PENTRU PROIECT",
      "Se adaugă în lista de materiale. Compatibilitatea și includerea într-un kit se verifică înainte de comandă.",
    );
    let quantity = 1;
    $("#properties").append(
      number("Cantitate (articole din catalog)", 1, (v) => (quantity = v), {
        min: 1,
        max: 10000,
        step: 1,
      }),
    );
    $("#element-actions").append(
      actionButton(
        "Adaugă în lista proiectului",
        () => {
          commit(addAccessory(state, m.id, quantity, catalog));
          $("#inspector").hidden = true;
          toast("Accesoriul este în lista proiectului.");
        },
        "primary",
      ),
    );
    return;
  }
  const product = currentSelection();
  if (!product) return;
  const r = resolveProduct(catalog, product),
    m = r.model;
  showPiece(
    m,
    inspectingBrush
      ? "PIESA DE PLASAT"
      : selected.type === "gate"
        ? "POARTĂ SELECTATĂ"
        : "GARDUL ACESTEI LATURI",
    hasModelVisual(m)
      ? inspectingBrush
        ? "Configurează piesa, apoi plaseaz-o în gard."
        : selected?.type === "gate"
          ? "Reprezentare orientativă a mecanismului. Proprietățile modifică poarta selectată; spațiul de operare se confirmă la montaj."
          : "Proprietățile modifică gardul de pe latura selectată."
      : "Fără model 3D verificat: scena arată numai spațiul rezervat, nu produsul final.",
  );
  const fixed = [];
  for (const d of m.parameters) {
    if (["fixed", "derived"].includes(d.type)) {
      fixed.push(
        d.label + ": " + r.parameters[d.id] + (d.unit ? " " + d.unit : ""),
      );
      continue;
    }
    const wrap = el("div", undefined, "property");
    if (d.type === "number") {
      const label = el("label", d.label + (d.unit ? " (" + d.unit + ")" : "")),
        row = el("div", undefined, "range-row"),
        range = el("input"),
        input = el("input");
      range.type = "range";
      input.type = "number";
      input.id = "param-" + d.id;
      label.htmlFor = input.id;
      range.setAttribute("aria-label", d.label + " curseur");
      for (const e of [range, input])
        Object.assign(e, {
          min: d.min ?? d.step,
          max: d.max,
          step: d.step,
          value: r.parameters[d.id],
        });
      row.append(range, input);
      wrap.classList.add("range-control");
      wrap.append(label, row);
      cleanups.push(
        bindPanelRange(wrap, {
          clamp: false,
          onInvalid: () => toast("Dimensiunea depășește limitele publicate."),
          onChange: (v, { immediate }) => {
            if (immediate && currentSelection()?.parameters[d.id] !== v)
              safe(() => parameterChange(d.id, v))();
          },
        }),
      );
    } else if (d.type === "color") {
      wrap.append(el("label", d.label));
      const palette = el("div", undefined, "palette");
      for (const value of d.values) {
        const b = actionButton("", () => parameterChange(d.id, value));
        b.setAttribute("aria-label", "Culoare " + value);
        b.setAttribute("aria-pressed", String(r.parameters[d.id] === value));
        b.style.setProperty("--swatch", d.swatches[value]);
        b.append(el("i"));
        palette.append(b);
      }
      wrap.append(palette, el("small", r.parameters[d.id]));
      if (d.allowRequestedRal) {
        const input = el("input");
        input.type = "text";
        input.placeholder = "RALxxxx";
        input.value = /^RAL/.test(r.parameters[d.id]) ? r.parameters[d.id] : "";
        input.onchange = safe(() =>
          parameterChange(d.id, input.value.trim().toUpperCase()),
        );
        wrap.append(
          field("Alt RAL solicitat", input),
          el(
            "small",
            "Culoarea exactă se confirmă. În scenă folosim gri neutru pentru un RAL fără mostră.",
          ),
        );
      }
    } else {
      const input = el("select");
      input.append(
        ...d.values.map((v) =>
          opt(v, String(v) + (d.unit ? " " + d.unit : "")),
        ),
      );
      input.value = r.parameters[d.id];
      input.onchange = safe(() =>
        parameterChange(
          d.id,
          typeof d.values[0] === "number" ? Number(input.value) : input.value,
        ),
      );
      wrap.append(field(d.label + (d.unit ? " (" + d.unit + ")" : ""), input));
    }
    $("#properties").append(wrap);
  }
  const actions = $("#element-actions");
  if (inspectingBrush) {
    actions.append(
      actionButton(
        "Gata — plasează în proiect",
        () => {
          $("#inspector").hidden = true;
          help();
        },
        "primary",
      ),
    );
  } else if (selected.type === "run") {
    const run = state.segments.find((s) => s.id === selected.id),
      a = state.nodes.find((n) => n.id === run.a),
      b = state.nodes.find((n) => n.id === run.b);
    actions.append(
      number("Lungimea laturii (m)", Number(distance(a, b).toFixed(3)), (v) =>
        commit(resizeRun(state, run.id, v, catalog)),
      ),
    );
    if (!m.custom && !["chainlink", "roll-welded"].includes(m.legacyGenerator))
      actions.append(
        actionButton("▥ Ajustează la module", () => {
          const next = fitRunToModules(state, run.id, catalog);
          commit(next);
          toast(
            "Latura și pozițiile porților au fost ajustate la module întregi. Anulează revine la forma anterioară.",
          );
        }),
      );
    if (m.custom) {
      const check = el("input");
      check.type = "checkbox";
      check.checked = run.autoFit;
      check.onchange = safe(() =>
        commit({
          ...state,
          segments: state.segments.map((s) =>
            s.id === run.id ? { ...s, autoFit: check.checked } : s,
          ),
        }),
      );
      const label = field(
        "Adaptează panourile la comandă între colțuri și porți",
        check,
      );
      label.className = "check";
      actions.append(
        label,
        el(
          "small",
          "Lățimea configurată este preferată; fiecare panou derivat respectă limitele publicate.",
          "muted",
        ),
      );
    }
    actions.append(
      actionButton("⇄ Schimbă gardul", () =>
        openCatalog("panel", { replace: selected }),
      ),
      actionButton("▦ Aplică peste tot", () => {
        commit(replaceAllFences(state, selectionOf(run), catalog));
        toast(
          "Gardul a fost aplicat pe toate laturile. Poți anula această operație.",
        );
      }),
      actionButton("⊓ Adaugă poartă", () => openCatalog("gate")),
      actionButton("＋ Continuă gardul", () => {
        brush = selectionOf(run);
        setTool("fence");
        start = { x: b.x, y: b.y };
        syncBrush();
        help();
      }),
    );
  } else {
    const gate = state.gates.find((g) => g.id === selected.id);
    actions.append(
      number(
        "Poziție de la începutul laturii (m)",
        gate.offset,
        (v) =>
          commit(
            placeGate(state, selectionOf(gate), gate.segmentId, v, catalog, {
              id: gate.id,
              handing: gate.handing,
            }),
          ),
        { min: 0 },
      ),
      actionButton("↔ Inversează poarta", () =>
        commit({
          ...state,
          gates: state.gates.map((g) =>
            g.id === gate.id
              ? { ...g, handing: g.handing === "left" ? "right" : "left" }
              : g,
          ),
        }),
      ),
      actionButton("✥ Mută poarta", () => {
        brush = selectionOf(gate);
        setTool("gate");
        movingGate = gate.id;
        handing = gate.handing;
      }),
      actionButton("⇄ Schimbă poarta", () =>
        openCatalog("gate", { replace: selected }),
      ),
    );
  }
  if (!inspectingBrush)
    actions.append(
      actionButton(
        "Șterge " + (selected.type === "gate" ? "poarta" : "latura"),
        () => {
          commit(removeElement(state, selected, catalog));
          select(null);
        },
        "danger",
      ),
    );
  if (fixed.length) {
    const details = el("details"),
      summary = el("summary", "Date fixe ale produsului");
    details.append(summary, ...fixed.map((t) => el("p", t, "muted")));
    actions.append(details);
  }
  const source = el("a", "Detalii pe Decorio ↗");
  source.href = r.source.url;
  source.target = "_blank";
  source.rel = "noopener";
  actions.append(source);
  if (!inspectingBrush && ["run", "gate"].includes(selected?.type)) {
    const wheel = $("#piece-wheel");
    const title = el(
      "strong",
      selected.type === "gate" ? "Poartă selectată" : "Latură selectată",
    );
    const close = actionButton("×", () => select(null));
    close.setAttribute("aria-label", "Deselectează piesa");
    const heading = el("header");
    heading.append(title, close);
    wheel.append(heading);
    wheel.append(
      actionButton("⚙ Proprietăți", () => {
        $("#inspector").hidden = false;
        wheel.hidden = true;
      }),
    );
    for (const button of [...actions.children].filter(
      (e) => e.tagName === "BUTTON",
    ))
      wheel.append(button);
    wheel.hidden = !$("#catalog").hidden || !$("#inspector").hidden;
    positionWheel();
  }
}
function positionWheel() {
  const wheel = $("#piece-wheel");
  if (wheel.hidden || !scene || !selected) return;
  const point = scene.selectionScreenPoint(selected);
  if (!point) {
    wheel.hidden = true;
    return;
  }
  const world = $("#world").getBoundingClientRect();
  const width = wheel.offsetWidth,
    height = wheel.offsetHeight;
  wheel.style.left =
    Math.max(world.left + 8, Math.min(world.right - width - 8, point.x + 20)) +
    "px";
  wheel.style.top =
    Math.max(
      world.top + 64,
      Math.min(world.bottom - height - 8, point.y - height / 2),
    ) + "px";
}
function showPiece(m, context, note) {
  $("#inspector-context").textContent = context;
  $("#piece-name").textContent = m.name;
  $("#piece-photo").src = m.images[0] || "";
  $("#piece-photo").hidden = !m.images.length;
  $("#piece-note").textContent = note;
}
function modal(title, build) {
  $("#dialog-title").textContent = title;
  $("#dialog-content").replaceChildren();
  build($("#dialog-content"));
  if (!$("#dialog").open) $("#dialog").showModal();
}
function download(name, type, text) {
  const a = el("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function showList() {
  modal("Piesele proiectului", (host) => {
    host.append(
      el(
        "p",
        assembly.totalLength.toFixed(2) +
          " m de împrejmuire · " +
          state.gates.length +
          " porți",
      ),
      el("p", PRICE_NOTICE, "muted"),
    );
    const table = el("table"),
      head = el("tr");
    for (const t of [
      "Piesă",
      "Cantitate",
      "Preț demo / unitate",
      "Total demo",
      "Observații",
    ])
      head.append(el("th", t));
    table.append(head);
    for (const item of priceAssembly(assembly, catalog).lines) {
      const row = el("tr");
      for (const text of [
        item.label,
        item.quantity + " " + item.unit,
        money(item.unitPrice),
        money(item.total),
        item.notes,
      ])
        row.append(el("td", text));
      table.append(row);
    }
    host.append(table);
    if (state.accessories.length) {
      host.append(el("h3", "Accesorii adăugate manual"));
      for (const item of state.accessories) {
        const row = el("div", undefined, "manual-row");
        row.append(
          el("span", modelById(catalog, item.modelId).name),
          number(
            "Cantitate",
            item.quantity,
            (v) => {
              commit({
                ...state,
                accessories: state.accessories.map((a) =>
                  a.id === item.id ? { ...a, quantity: v } : a,
                ),
              });
              showList();
            },
            { min: 1, max: 10000, step: 1 },
          ),
          actionButton("Elimină", () => {
            commit(
              removeElement(state, { type: "accessory", id: item.id }, catalog),
            );
            showList();
          }),
        );
        host.append(row);
      }
    }
    const actions = el("div", undefined, "list-actions");
    actions.append(
      actionButton("Export CSV", () =>
        download(
          "decorio-componente.csv",
          "text/csv;charset=utf-8",
          quoteCsv([cartSnapshot(state, assembly, catalog)]),
        ),
      ),
      actionButton("Export proiect JSON", () =>
        download(
          "decorio-proiect.json",
          "application/json",
          JSON.stringify(state, null, 2),
        ),
      ),
      actionButton("Import proiect", () => $("#import-json").click()),
    );
    host.append(actions);
    const details = el("details"),
      summary = el("summary", "De verificat înainte de montaj"),
      list = el("ul", undefined, "issue-list");
    for (const text of [...new Set(assembly.issues.map((i) => i.message))])
      list.append(el("li", text));
    details.append(summary, list);
    host.append(details);
  });
}
function updateCartCount() {
  $("#open-cart").textContent = "Coș demo · " + demoCart.length;
}
function showCart() {
  modal("Coșul proiectelor · demo", (host) => {
    host.append(
      el("p", PRICE_NOTICE),
      el(
        "p",
        "Coș salvat în acest browser. Fiecare proiect păstrează configurația și lista de piese.",
        "muted",
      ),
    );
    const shared = el("div", undefined, "shared-ui-host decorio-cart");
    // Reuse the platform cart view. This demo adapter never invokes the real quotation endpoint.
    const template = document.createElement("template");
    template.innerHTML = renderCartMenu(
      "ro-RO",
      demoCart.map((e) => ({
        key: e.key,
        name: e.name,
        productId: "fence",
        costAmount: e.pricing.total,
        currency: "RON",
      })),
      { open: true },
    );
    const quote = template.content.querySelector('[data-action="cart-quote"]');
    quote.dataset.action = "demo-quote";
    quote.textContent = "Pregătește cererea de ofertă";
    shared.append(template.content);
    shared.onclick = safe((event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const key = button.dataset.cartKey;
      if (button.dataset.action === "demo-quote") return showQuote();
      if (button.dataset.action === "cart-edit") {
        const entry = demoCart.find((e) => e.key === key);
        commit(assertProject(structuredClone(entry.project), catalog), {
          fit: true,
        });
        editingCartKey = key;
        setTool("select");
        refresh();
        $("#dialog").close();
        toast(
          "Editezi copia din coș. Apasă Actualizează în coș când ai terminat.",
        );
        return;
      }
      const next =
        button.dataset.action === "cart-empty"
          ? []
          : demoCart.filter((e) => e.key !== key);
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      demoCart = next;
      if (!demoCart.some((e) => e.key === editingCartKey))
        editingCartKey = null;
      updateCartCount();
      refresh();
      showCart();
    });
    host.append(shared);
  });
}
function showQuote() {
  modal("Pregătește cererea de ofertă", (host) => {
    host.append(
      el(
        "p",
        "Descarcă devizul și configurațiile pentru verificare. În această demonstrație nu se trimite o solicitare către Decorio.",
      ),
      el("p", PRICE_NOTICE),
      el(
        "strong",
        "Total demonstrativ: " +
          money(demoCart.reduce((n, e) => n + e.pricing.total, 0)),
      ),
    );
    host.append(
      actionButton("Descarcă devizul CSV", () =>
        download(
          "decorio-deviz-DEMO.csv",
          "text/csv;charset=utf-8",
          quoteCsv(demoCart),
        ),
      ),
      actionButton("Descarcă dosarul cererii JSON", () =>
        download(
          "decorio-cerere-DEMO.json",
          "application/json",
          JSON.stringify(
            {
              type: "decorio-demo-quote",
              version: 1,
              notice: PRICE_NOTICE,
              projects: demoCart,
            },
            null,
            2,
          ),
        ),
      ),
    );
    for (const entry of demoCart) {
      const details = el("details");
      details.append(
        el("summary", entry.name + " · " + money(entry.pricing.total)),
        el(
          "p",
          "Listă preliminară: " +
            entry.issues.length +
            " observații de verificat, incluse în deviz.",
        ),
      );
      details.append(
        actionButton("Descarcă acest proiect pentru reimport", () =>
          download(
            "decorio-proiect.json",
            "application/json",
            JSON.stringify(entry.project, null, 2),
          ),
        ),
      );
      host.append(details);
    }
    host.append(actionButton("Înapoi la coș", showCart));
  });
}
click("#open-cart", showCart);
click("#add-cart", () => {
  if (!assembly.items.length)
    throw Error("Adaugă întâi garduri, porți sau accesorii în proiect.");
  if (!editingCartKey && demoCart.length >= 30)
    throw Error("Coșul poate păstra cel mult 30 de proiecte.");
  const entry = cartSnapshot(
    state,
    assembly,
    catalog,
    editingCartKey || undefined,
  );
  const next = editingCartKey
    ? demoCart.map((e) => (e.key === editingCartKey ? entry : e))
    : [...demoCart, entry];
  localStorage.setItem(CART_KEY, JSON.stringify(next));
  demoCart = next;
  editingCartKey = null;
  updateCartCount();
  refresh();
  showCart();
});
function rectangle() {
  if (modelById(catalog, brush.modelId).kind !== "panel")
    brush = defaultProduct(catalog, "d-94a19ed2e5ef");
  let width = 10,
    depth = 5;
  modal("Un început dreptunghiular", (host) => {
    const fields = el("div", undefined, "form-grid");
    fields.append(
      number("Lungime (m)", width, (v) => (width = v)),
      number("Adâncime (m)", depth, (v) => (depth = v)),
    );
    host.append(
      el(
        "p",
        "Construiește cu " +
          modelById(catalog, brush.modelId).name +
          ". Poți schimba apoi gardurile și adăuga porți.",
      ),
      fields,
      actionButton(
        "Construiește dreptunghiul",
        () => {
          let next = state;
          const x = state.nodes.length
              ? Math.max(...state.nodes.map((n) => n.x)) + 5
              : 0,
            points = [
              { x, y: 0 },
              { x: x + width, y: 0 },
              { x: x + width, y: depth },
              { x, y: depth },
              { x, y: 0 },
            ];
          for (let i = 0; i < 4; i++)
            next = addRun(next, points[i], points[i + 1], brush, catalog);
          commit(next, { fit: true });
          setTool("select");
          $("#dialog").close();
        },
        "primary",
      ),
    );
  });
}
async function init() {
  if (
    !local &&
    ![
      "decorio.360configurator.ro",
      "decorio.360configurator.com",
      "decorio.360konfigurator.de",
    ].includes(location.hostname)
  )
    throw Error("Această aplicație este rezervată Decorio.");
  catalog = await fetch("./ontology.json").then((r) => r.json());
  state = emptyProject(catalog);
  try {
    const savedCart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(savedCart) || savedCart.length > 30)
      throw Error("Coș invalid");
    demoCart = savedCart.map((entry) => {
      const project = assertProject(entry.project, catalog);
      return cartSnapshot(
        project,
        resolveProject(project, catalog),
        catalog,
        entry.key,
      );
    });
  } catch {
    toast(
      "Coșul local nu a putut fi restaurat. Fișierul salvat nu a fost suprascris.",
    );
  }
  updateCartCount();
  brush = defaultProduct(catalog, "d-94a19ed2e5ef");
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) state = assertProject(JSON.parse(saved), catalog);
    const old = localStorage.getItem(APP_ID + ":v2:guest-draft");
    if (old) {
      oldDraft = JSON.parse(old);
      $("#old-project").hidden = false;
    }
  } catch (e) {
    toast("Proiectul salvat necesită verificare: " + e.message);
  }
  scene = new BuilderScene($("#world"), {
    hover,
    release,
    cancel: () => {
      cancelPreview();
      help();
    },
  });
  scene.controls.addEventListener("change", positionWheel);
  window.addEventListener("resize", positionWheel);
  setTool("select");
  refresh(true);
  if (!local)
    try {
      const { requireTenantConfiguratorAccess } =
        await import("../../shared-ui/src/tenantBootstrap.js");
      const t = await requireTenantConfiguratorAccess("fence");
      cloudReady = t?.slug === "decorio" && t.exists && t.status === "active";
    } catch {}
  shell = mountStandaloneConfiguratorShell({
    productType: "Fence",
    productId: "fence",
    defaultProjectName: "Gardul meu",
    brandSrc: catalog.logoUrl || "/shared-ui/assets/360CONFIGURATOR.png",
    brandAlt: "Decorio",
    storagePrefix: "decorio:fence:v3",
    fixedPreferences: { locale: "ro-RO", units: "metric", currency: "RON" },
    capabilities: {
      cart: false,
      bookDemo: false,
      ar: false,
      language: false,
      analytics: false,
      authentication: cloudReady,
      save: cloudReady,
      share: cloudReady,
      undo: true,
      reset: true,
    },
    tools: { items: [] },
    callbacks: {
      captureState: () => structuredClone(state),
      restoreState: (snapshot) => {
        editingCartKey = null;
        state = importProject(snapshot, catalog);
        history.clear();
        future = [];
        setTool("select");
        refresh(true);
        persist();
        return true;
      },
      onProjectNameChange: (name) => {
        state = { ...state, name };
        persist();
      },
      resetConfiguration: () => {
        editingCartKey = null;
        commit(emptyProject(catalog), { fit: true });
        setTool("select");
        return true;
      },
      onUndo: () => {
        setTool("select");
        return history.undo();
      },
      getShareUrl: async () => {
        const { createShareUrl } =
          await import("../../shared-ui/src/shareState.js");
        return createShareUrl({ productType: "fence", state });
      },
      onPreferenceChange: (key, value) => {
        if (key === "quality") scene.surface.setQuality(value);
      },
    },
  });
  shell.setProjectName(state.name);
}
for (const b of document.querySelectorAll("[data-catalog]"))
  b.onclick = () => openCatalog(b.dataset.catalog);
for (const b of document.querySelectorAll("[data-tool]"))
  b.onclick = () => setTool(b.dataset.tool);
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => {
    scene.setView(b.dataset.view);
    document
      .querySelectorAll("[data-view]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    refresh();
  };
click("#new-project", () =>
  modal("Începe un proiect nou", (host) => {
    host.append(
      el(
        "p",
        "Proiectul curent poate fi exportat înainte. Poți reveni cu Anulează în această sesiune.",
      ),
      actionButton("Exportă proiectul curent", () =>
        download(
          "decorio-proiect.json",
          "application/json",
          JSON.stringify(state, null, 2),
        ),
      ),
      actionButton(
        "Începe de la zero",
        () => {
          editingCartKey = null;
          commit(emptyProject(catalog), { fit: true });
          brush = defaultProduct(catalog, "d-94a19ed2e5ef");
          setTool("select");
          $("#dialog").close();
        },
        "primary",
      ),
    );
  }),
);
click("#begin", () => openCatalog("panel"));
click("#rectangle", rectangle);
click("#close-catalog", () => {
  $("#catalog").hidden = true;
  replaceTarget = null;
  refresh();
});
click("#close-inspector", () => {
  $("#inspector").hidden = true;
  if (selected) renderInspector();
});
click("#fit", () => scene.fit());
click("#edit-brush", () => {
  inspectingBrush = true;
  $("#inspector").hidden = false;
  $("#catalog").hidden = true;
  renderInspector();
});
click("#flip-gate", () => {
  handing = handing === "left" ? "right" : "left";
  cancelPreview();
  toast(
    "Sensul porții a fost inversat. Apropie-o de latură pentru previzualizare.",
  );
});
click("#cancel-tool", () => setTool("select"));
click("#finish", () => setTool("select"));
$("#run-length").oninput = $("#module-snap").onchange = syncNumericProposal;
click("#place-length", () => {
  if (!start) throw Error("Alege punctul de pornire în scenă.");
  const length = Number($("#run-length").value),
    angle = (Number($("#run-angle").value) * Math.PI) / 180,
    q = drawProposal(
      state,
      brush,
      start,
      {
        x: start.x + Math.cos(angle) * length,
        y: start.y + Math.sin(angle) * length,
      },
      catalog,
      { ortho: false, snapModules: $("#module-snap").checked },
    );
  commit(q.next);
  start = q.b;
  syncBrush();
  help();
});
click("#undo", () => {
  setTool("select");
  return history.undo();
});
click("#redo", () => {
  if (future.length) {
    history.record();
    state = future.pop();
    setTool("select");
    refresh();
    persist();
  }
});
click("#open-list", showList);
click("#issues-button", showList);
click("#close-dialog", () => $("#dialog").close());
click("#more", () => {
  limit += 40;
  renderCatalog();
});
$("#search").oninput = $("#family").onchange = () => {
  limit = 40;
  renderCatalog();
};
click("#old-project", () =>
  modal("Deschide o copie a proiectului anterior", (host) => {
    host.append(
      el(
        "p",
        "Gardurile și porțile existente vor fi importate în noul builder. Originalul rămâne salvat separat.",
      ),
      actionButton(
        "Deschide copia",
        () => {
          editingCartKey = null;
          commit(importProject(oldDraft, catalog), { fit: true });
          setTool("select");
          $("#dialog").close();
        },
        "primary",
      ),
    );
  }),
);
$("#import-json").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 1500000) throw Error("Fișier prea mare.");
    const input = JSON.parse(await f.text());
    if (input.schemaVersion === 2) {
      modal("Import din editorul anterior", (host) =>
        host.append(
          el(
            "p",
            "Importăm o copie a gardului și porților în noul format. Originalul rămâne neschimbat.",
          ),
          actionButton("Importă copia", () => {
            editingCartKey = null;
            commit(importProject(input, catalog), { fit: true });
            setTool("select");
            $("#dialog").close();
          }),
        ),
      );
    } else {
      editingCartKey = null;
      commit(importProject(input, catalog), { fit: true });
      setTool("select");
      $("#dialog").close();
    }
  } catch (e) {
    toast(e.message);
  } finally {
    e.target.value = "";
  }
};
document.addEventListener(
  "keydown",
  safe((e) => {
    if (e.target.matches("input,select,textarea") || $("#dialog").open) return;
    if (e.key === "Escape") {
      setTool("select");
      $("#catalog").hidden = true;
      $("#inspector").hidden = true;
    }
    if (e.key.toLowerCase() === "r" && tool === "gate") {
      handing = handing === "left" ? "right" : "left";
      hoverKey = "";
      toast(
        handing === "left"
          ? "Deschidere spre stânga"
          : "Deschidere spre dreapta",
      );
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      setTool("select");
      history.undo();
    }
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selected &&
      !inspectingBrush
    ) {
      e.preventDefault();
      commit(removeElement(state, selected, catalog));
      select(null);
    }
  }),
);
init().catch((e) => toast(e.message));
