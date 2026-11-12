/* The Bus Route Explorer's page work (src/render/blocks/busroutes.mjs). The addresses a visitor
 * types go to this site's own /api/geocode — which places them with OpenStreetMap and keeps
 * nothing — and only their coordinates go on to /api/bus-routes, which classifies each
 * address × building pair from Madison Metro's route topology. No address is stored, in the
 * browser or on the server. The results table is the answer; the map under it is an aid drawn
 * from the same numbers. */

import { t } from "./text.js";

for (const box of document.querySelectorAll("[data-bus-routes]")) {
  const island = box.querySelector("script[type=\"application/json\"]");
  let buildings = [];
  try { buildings = JSON.parse(island.textContent).buildings || []; } catch { /* the checkboxes still name them */ }
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const form = box.querySelector("[data-bus-form]");
  const rows = box.querySelector("[data-bus-addresses]");
  const addBtn = box.querySelector("[data-bus-add]");
  const status = box.querySelector("[data-bus-status]");
  const resultsBox = box.querySelector("[data-bus-results]");
  const tableWrap = box.querySelector("[data-bus-table]");
  const mapBox = box.querySelector("[data-bus-map]");

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function renumber() {
    [...rows.querySelectorAll("[data-bus-row]")].forEach((row, i) => {
      const input = row.querySelector("[data-bus-address]");
      const label = row.querySelector("label");
      const remove = row.querySelector("[data-bus-remove]");
      input.id = `${form.id || "bus"}-addr-${i + 1}`;
      label.htmlFor = input.id;
      label.textContent = t("explore.bus.address", { n: i + 1 });
      remove.setAttribute("aria-label", t("explore.bus.remove", { n: i + 1 }));
      remove.hidden = rows.children.length <= 1;
    });
    addBtn.hidden = rows.children.length >= 5;
  }
  rows.addEventListener("click", (e) => {
    const remove = e.target.closest("[data-bus-remove]");
    if (remove) { remove.closest("[data-bus-row]").remove(); renumber(); }
  });
  addBtn.addEventListener("click", () => {
    const row = rows.children[0].cloneNode(true);
    row.querySelector("[data-bus-address]").value = "";
    rows.append(row);
    renumber();
    row.querySelector("[data-bus-address]").focus();
  });
  renumber();

  async function geocode(q) {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("geocode");
    const got = await res.json();
    return got.results || [];
  }

  function cellWords(cell) {
    const wrap = el("div", "bus-cell");
    const kind = cell.kind === "direct" ? t("explore.bus.direct") : cell.kind === "transfer" ? t("explore.bus.transfer") : t("explore.bus.none");
    wrap.append(el("p", "bus-kind", kind));
    if (cell.kind !== "none") {
      wrap.append(el("p", "bus-route", cell.routes.length === 2 ? t("explore.bus.routeTwo", { a: cell.routes[0], b: cell.routes[1] }) : t("explore.bus.routeOne", { routes: cell.routes[0] })));
      wrap.append(el("p", "bus-walk", t("explore.bus.walkTo", { m: cell.board.walkM, stop: cell.board.name })));
      if (cell.kind === "transfer") wrap.append(el("p", "bus-walk", t("explore.bus.changeAt", { stop: cell.via.name })));
      wrap.append(el("p", "bus-walk", t("explore.bus.walkFrom", { m: cell.alight.walkM, stop: cell.alight.name })));
    }
    return wrap;
  }

  function drawMap(places, legs) {
    mapBox.replaceChildren();
    if (!places.length) return;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    const kx = Math.cos((43.07 * Math.PI) / 180);
    const xs = places.map((p) => p.lon * kx), ys = places.map((p) => p.lat);
    const pad = 0.004;
    const minX = Math.min(...xs) - pad * kx, maxX = Math.max(...xs) + pad * kx;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const W = 800, H = Math.max(300, Math.min(560, (W * (maxY - minY)) / (maxX - minX || 1)));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "bus-svg");
    svg.setAttribute("role", "img");
    const X = (lon) => ((lon * kx - minX) / (maxX - minX)) * W;
    const Y = (lat) => H - ((lat - minY) / (maxY - minY)) * H;
    const node = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
    for (const leg of legs) {
      const pts = leg.map((p) => `${X(p.lon).toFixed(1)},${Y(p.lat).toFixed(1)}`).join(" ");
      svg.append(node("polyline", { points: pts, class: "bus-line" }));
    }
    for (const p of places) {
      const g = node("g", { class: `bus-pt bus-pt--${p.kind}` });
      g.append(node("title", {}, p.label));
      if (p.kind === "building") g.append(node("rect", { x: X(p.lon) - 7, y: Y(p.lat) - 7, width: 14, height: 14, class: "bus-sq" }));
      else g.append(node("circle", { cx: X(p.lon), cy: Y(p.lat), r: p.kind === "address" ? 9 : 5, class: p.kind === "address" ? "bus-dot--addr" : "bus-dot" }));
      if (p.kind === "address") g.append(node("text", { x: X(p.lon), y: Y(p.lat) + 4, class: "bus-pt-num" }, String(p.n)));
      if (p.kind !== "stop") g.append(node("text", { x: X(p.lon) + 11, y: Y(p.lat) + 4, class: "bus-pt-label" }, p.label));
      svg.append(g);
    }
    mapBox.append(svg);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = [...rows.querySelectorAll("[data-bus-address]")].map((i) => i.value.trim()).filter(Boolean);
    const chosen = [...box.querySelectorAll("[data-bus-building]:checked")].map((c) => c.value);
    if (!inputs.length) { status.textContent = t("explore.bus.needAddress"); return; }
    if (!chosen.length) { status.textContent = t("explore.bus.needBuilding"); return; }
    status.textContent = t("explore.bus.looking");
    resultsBox.hidden = true;
    try {
      const places = [];
      for (const q of inputs) {
        const found = await geocode(q);
        if (!found.length) { status.textContent = t("explore.bus.notFound", { q }); return; }
        places.push({ ...found[0], typed: q });
      }
      status.textContent = t("explore.bus.working");
      const res = await fetch("/api/bus-routes", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ points: places.map(({ label, typed, ...p }) => p), buildings: chosen }) });
      if (!res.ok) throw new Error("classify");
      const got = await res.json();
      const table = el("table", "bus-table");
      const thead = el("thead"); const hr = el("tr");
      hr.append(el("th", null, t("explore.bus.addressesHeader")));
      for (const id of chosen) hr.append(el("th", null, byId.get(id)?.name || id));
      thead.append(hr); table.append(thead);
      const tbody = el("tbody");
      got.results.forEach((row, i) => {
        const tr = el("tr");
        tr.append(el("th", null, `${i + 1}. ${places[i].label}`));
        for (const cell of row.cells) { const td = el("td"); td.append(cellWords(cell)); tr.append(td); }
        tbody.append(tr);
      });
      table.append(tbody);
      tableWrap.replaceChildren(table);
      const mapPlaces = [];
      const legs = [];
      places.forEach((p, i) => mapPlaces.push({ kind: "address", n: i + 1, label: p.label, lat: p.lat, lon: p.lon }));
      for (const id of chosen) { const b = byId.get(id); if (b) mapPlaces.push({ kind: "building", label: b.name, lat: b.lat, lon: b.lon }); }
      got.results.forEach((row, i) => {
        for (const cell of row.cells) {
          if (cell.kind === "none") continue;
          const b = byId.get(cell.building);
          const stops = [cell.board, ...(cell.via ? [cell.via] : []), cell.alight];
          for (const s of stops) if (!mapPlaces.some((p) => p.kind === "stop" && p.label === s.name)) mapPlaces.push({ kind: "stop", label: s.name, lat: s.lat, lon: s.lon });
          legs.push([places[i], cell.board, ...(cell.via ? [cell.via] : []), cell.alight, b]);
        }
      });
      drawMap(mapPlaces, legs);
      status.textContent = "";
      resultsBox.hidden = false;
      resultsBox.scrollIntoView({ block: "nearest" });
    } catch {
      status.textContent = t("explore.bus.failed");
    }
  });
}
