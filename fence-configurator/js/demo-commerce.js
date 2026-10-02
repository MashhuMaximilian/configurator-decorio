// Illustrative tariff only. Never a Decorio commercial offer or a backend price.
export const DEMO_PRICE_VERSION = "demo-ron-2026-10-02.1";
export const PRICE_NOTICE =
  "Prețuri fictive pentru demonstrație, fără valoare comercială. Totalul include numai componentele listate; montajul, transportul și TVA-ul nu sunt calculate.";
export const money = (value) =>
  new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    maximumFractionDigits: 2,
  }).format(value);
const cents = (n) => Math.round(n * 100);
export function priceAssembly(assembly, catalog) {
  const lines = assembly.items.map((item) => {
    const [modelId, parameters] = item.id
        .replace(/^(gate|manual):/, "")
        .split("|"),
      model = catalog.models.find((m) => m.id === modelId);
    let params = {};
    try {
      params = Object.fromEntries(JSON.parse(parameters));
    } catch {}
    let unitPrice = 50,
      basis = "Tarif fictiv / articol";
    if (item.id.startsWith("post:") || item.id.includes("-post-")) {
      unitPrice = 150;
      basis = "Tarif fictiv / stâlp";
    } else if (item.id.startsWith("fixing:") || item.id.includes("-clamp-")) {
      unitPrice = 15;
      basis = "Tarif fictiv / set de prindere";
    } else if (model?.kind === "gate") {
      unitPrice =
        500 +
        650 *
          (params.width || model.defaults.width || 1) *
          (params.height || model.defaults.height || 1);
      basis = "500 lei + 650 lei/m², fictiv";
    } else if (model?.kind === "panel") {
      const rate = /mesh|chainlink|roll/.test(model.legacyGenerator) ? 80 : 250;
      unitPrice =
        item.unit === "role"
          ? 1200
          : item.unit === "m"
            ? rate * (params.height || 1)
            : (params.width || model.defaults.width || 1) *
              (params.height || model.defaults.height || 1) *
              rate;
      basis =
        item.unit === "role" ? "Tarif fictiv / rolă" : `${rate} lei/m², fictiv`;
    }
    const unitCents = cents(unitPrice),
      totalCents = Math.round(unitCents * item.quantity);
    return {
      ...item,
      unitPrice: unitCents / 100,
      total: totalCents / 100,
      basis,
    };
  });
  return {
    version: DEMO_PRICE_VERSION,
    demo: true,
    currency: "RON",
    notice: PRICE_NOTICE,
    lines,
    total: lines.reduce((sum, l) => sum + cents(l.total), 0) / 100,
  };
}
const cell = (value) =>
  '"' +
  String(value ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export function quoteCsv(entries) {
  const rows = [
    ["DEVIZ DEMONSTRATIV — NU ESTE OFERTĂ COMERCIALĂ"],
    [PRICE_NOTICE],
    ["Tarif", DEMO_PRICE_VERSION],
    [],
    [
      "Proiect",
      "Cod",
      "Produs / variantă",
      "Cantitate",
      "Unitate",
      "Preț unitar demo RON",
      "Total demo RON",
      "Observații",
      "Sursă",
    ],
  ];
  for (const entry of entries) {
    for (const l of entry.pricing.lines)
      rows.push([
        entry.name,
        l.code,
        l.label,
        l.quantity,
        l.unit,
        l.unitPrice,
        l.total,
        [l.notes, l.basis].filter(Boolean).join(" · "),
        l.source?.url,
      ]);
    rows.push([entry.name, "Subtotal demo", entry.pricing.total]);
    for (const issue of entry.issues || [])
      rows.push([entry.name, "De confirmat", issue.message]);
  }
  rows.push([
    "TOTAL DEMO RON",
    entries.reduce((sum, e) => sum + cents(e.pricing.total), 0) / 100,
  ]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
export function cartSnapshot(
  project,
  assembly,
  catalog,
  key = crypto.randomUUID(),
) {
  return {
    key,
    productId: "fence",
    name: project.name,
    project: structuredClone(project),
    pricing: priceAssembly(assembly, catalog),
    issues: structuredClone(assembly.issues),
    createdAt: new Date().toISOString(),
  };
}
