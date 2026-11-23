/* The Bus Routes page's script (Explore redesign, approved 15 Nov 2026).
 *
 * Three jobs, in the page's own order. Next Buses: the three stop panels are
 * filled from /api/transit/departures — the site's function merges Metro's
 * static timetable with Metro's live GTFS-RT — and re-read every half minute;
 * a departure the live feed speaks for counts down, one it does not keeps its
 * clock time and says Scheduled, and the line over the panels says which state
 * the page is in, so a dead feed is announced, never hidden. One Route at a
 * Time: the chosen route's variants, its stop strip, the next departures at the
 * chosen stop, and its true shape on a Leaflet map (loaded only when the map
 * is first drawn) with the route's buses from the Vehicle Positions feed.
 * From Your Address: each address is placed by /api/geocode — looked up, never
 * kept — and the stops within a short walk are read from the timetable data the
 * page already holds, with their next departures from the same live answer.
 *
 * Nothing here writes a word of its own: every label comes from the page's
 * text table, and rows are built node by node. */

import { t } from "./text.js";

const root = document.querySelector("[data-bus-routes]");
if (root) {
  const data = JSON.parse(document.getElementById(`${root.getAttribute("data-block")}-data`).textContent);
  /* A variant's stops ride slash-joined in the data file (the builder's note
     in ops/transit.mjs says why); the page reads them as numbers from here. */
  for (const list of data.variants || []) for (const v of list) v.stops = String(v.stops ?? "").split("/").filter((x) => x !== "").map(Number);
  const routeByName = new Map((data.routes || []).map((r) => [r.name, r]));
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  const REFRESH_MS = 30_000;
  const WALK_M = 500, WALK_PER_MIN = 80;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const fmtTime = (iso) => timeFmt.format(new Date(iso));
  const dayFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const dayWords = (iso) => (iso ? dayFmt.format(new Date(`${iso}T12:00:00Z`)) : "");
  /* The timetable has ended (the answer's lapsed state, PF-6): the words the panels and the
     route rows stand in place of their lists, matching the ones the page was drawn with. */
  const endedText = (body) => t("explore.bus.ended", { end: dayWords(body.feedEnd), updated: dayWords(body.updated || body.feedEnd) });
  const badgeEl = (name) => el("span", `bus-badge bus-badge--r${name}`, name);
  const freeEl = () => el("span", "bus-free", t("explore.bus.free"));

  function bigText(d) {
    if (!d.live) return fmtTime(d.time);
    const mins = Math.round((Date.parse(d.time) - Date.now()) / 60_000);
    if (mins <= 0) return t("explore.bus.due");
    if (mins < 60) return t("explore.bus.min", { n: mins });
    return fmtTime(d.time);
  }
  function delayText(d) {
    if (d.delaySec == null || Math.abs(d.delaySec) < 60) return "";
    const n = Math.round(Math.abs(d.delaySec) / 60);
    return d.delaySec > 0 ? t("explore.bus.late", { n }) : t("explore.bus.early", { n });
  }
  function depRow(d, next) {
    const row = el("div", "bus-row");
    row.append(badgeEl(d.route));
    const mid = el("span", "bus-dir", `${t("explore.bus.to")} ${d.headsign}`);
    const route = routeByName.get(d.route);
    if (route && route.free) mid.append(freeEl());
    row.append(mid);
    const eta = el("span", "bus-eta");
    if (d.cancelled) {
      eta.append(el("span", "bus-big bus-cancelled", t("explore.bus.cancelled")));
    } else {
      eta.append(el("span", "bus-big", bigText(d)));
      const bits = [];
      if (next && next.length) bits.push(`${t("explore.bus.then")} ${next.map((x) => fmtTime(x.time)).join(" · ")}`);
      const delay = delayText(d);
      if (delay) bits.push(delay);
      if (!d.live) bits.push(t("explore.bus.scheduledTag"));
      if (bits.length) eta.append(el("span", "bus-more", bits.join(" · ")));
    }
    row.append(eta);
    return row;
  }
  /* One stop set's departures, one row per route and direction: the soonest
   * bus is the row, the two after it ride along as "then" times. A trip that
   * serves two stops of the set counts once, at its earliest time. */
  function groupsFor(body, stopIds) {
    const byTrip = new Map();
    for (const gid of stopIds) for (const d of body.stops?.[gid] || []) {
      const cur = byTrip.get(d.trip);
      if (!cur || d.time < cur.time) byTrip.set(d.trip, d);
    }
    const groups = new Map();
    for (const d of byTrip.values()) {
      const key = `${d.route}|${d.headsign}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    return [...groups.values()]
      .map((list) => list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)))
      .sort((a, b) => Date.parse(a[0].time) - Date.parse(b[0].time));
  }
  async function fetchDeps(stopIds, routeName) {
    const q = new URLSearchParams({ stops: stopIds.join(",") });
    if (routeName) q.set("route", routeName);
    const res = await fetch(`/api/transit/departures?${q}`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("departures");
    return res.json();
  }
  function retryButton(onClick) {
    const p = el("p", "bus-retryline");
    const btn = el("button", "btn btn--quiet", t("explore.bus.retry"));
    btn.type = "button";
    btn.addEventListener("click", onClick);
    p.append(btn);
    return p;
  }

  /* — the panels — */
  const statusLine = root.querySelector("[data-bus-status]");
  const alertsBox = root.querySelector("[data-bus-alerts]");
  const panelRows = [...root.querySelectorAll("[data-bus-panel-rows]")];
  let panelBody = null;
  function renderAlerts(alerts) {
    alertsBox.replaceChildren();
    if (!alerts || !alerts.length) { alertsBox.hidden = true; return; }
    for (const a of alerts) {
      const box = el("div", "bus-alert");
      const head = el("p", "bus-alert-head");
      if (a.url) { const link = el("a", "", a.header || ""); link.href = a.url; head.append(link); }
      else head.textContent = a.header || "";
      box.append(head);
      if (a.description) box.append(el("p", "bus-alert-body", a.description));
      alertsBox.append(box);
    }
    alertsBox.hidden = false;
  }
  function renderPanels() {
    if (!panelBody) return;
    if (panelBody.lapsed) {
      data.panels.forEach((panel, i) => {
        const box = panelRows[i];
        if (box) box.replaceChildren(el("p", "bus-none", endedText(panelBody)));
      });
      renderAlerts([]);
      return;
    }
    data.panels.forEach((panel, i) => {
      const box = panelRows[i];
      if (!box) return;
      box.replaceChildren();
      const groups = groupsFor(panelBody, panel.stops).slice(0, 8);
      if (!groups.length) { box.append(el("p", "bus-none", t("explore.bus.noneToday"))); return; }
      for (const list of groups) box.append(depRow(list[0], list.slice(1, 3)));
    });
    renderAlerts(panelBody.alerts);
  }
  async function loadPanels() {
    const stopIds = [...new Set(data.panels.flatMap((p) => p.stops))];
    try {
      panelBody = await fetchDeps(stopIds);
      statusLine.textContent = panelBody.lapsed ? endedText(panelBody) : panelBody.live ? t("explore.bus.statusLive") : t("explore.bus.statusScheduled");
      renderPanels();
    } catch {
      if (panelBody) { renderPanels(); return; }
      statusLine.textContent = t("explore.bus.statusDown");
      panelRows.forEach((box) => {
        box.replaceChildren(el("p", "bus-none", t("explore.bus.failed")));
        box.append(retryButton(() => { box.replaceChildren(el("p", "bus-loading", t("explore.bus.loading"))); loadPanels(); }));
      });
    }
  }

  /* — one route at a time — */
  const state = { route: data.home || 0, variant: data.homeVariant || 0, stop: null };
  const chips = [...root.querySelectorAll("[data-bus-chip]")];
  const variantSel = root.querySelector("[data-bus-variant]");
  const routeRows = root.querySelector("[data-bus-route-rows]");
  const fromLine = root.querySelector("[data-bus-from]");
  const strip = root.querySelector("[data-bus-strip]");
  const routeHead = root.querySelector(".bus-routehead");
  const mapNote = root.querySelector("[data-bus-mapnote]");
  const variant = () => (data.variants?.[state.route] || [])[state.variant] || null;
  let routeBody = null;

  function selectStop(si) {
    state.stop = si;
    renderStrip(); renderFrom(); loadRouteDeps(); drawRoute();
  }
  function renderStrip() {
    const v = variant();
    const route = data.routes[state.route];
    strip.className = `bus-strip bus-strip--r${route.name}`;
    strip.replaceChildren();
    if (!v) return;
    if (state.stop == null || !v.stops.includes(state.stop)) state.stop = v.stops[0];
    v.stops.forEach((si, i) => {
      const li = el("li", i === 0 || i === v.stops.length - 1 ? "key" : "");
      const btn = el("button", `bus-stopbtn${si === state.stop ? " is-here" : ""}`, data.stops[si]?.name || "");
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(si === state.stop));
      btn.addEventListener("click", () => selectStop(si));
      li.append(btn);
      strip.append(li);
    });
  }
  function renderFrom() {
    const s = data.stops[state.stop];
    fromLine.textContent = s ? t("explore.bus.fromStop", { stop: s.name }) : "";
  }
  function renderRouteHead() {
    const route = data.routes[state.route];
    const big = badgeEl(route.name);
    big.classList.add("bus-badge--big");
    routeHead.querySelector(".bus-badge")?.replaceWith(big);
    const name = routeHead.querySelector(".bus-routename");
    name.replaceChildren(document.createTextNode(route.long));
    if (route.free) name.append(freeEl());
    variantSel.replaceChildren();
    (data.variants?.[state.route] || []).forEach((v, i) => {
      const opt = el("option", "", `${t("explore.bus.to")} ${v.headsign}`);
      opt.value = String(i);
      opt.selected = i === state.variant;
      variantSel.append(opt);
    });
  }
  function renderRouteRows() {
    routeRows.replaceChildren();
    if (!routeBody) { routeRows.append(el("p", "bus-loading", t("explore.bus.loading"))); return; }
    if (routeBody.lapsed) { routeRows.append(el("p", "bus-none", endedText(routeBody))); return; }
    const s = data.stops[state.stop];
    const groups = s ? groupsFor(routeBody, [s.id]) : [];
    if (!groups.length) { routeRows.append(el("p", "bus-none", t("explore.bus.noneToday"))); return; }
    for (const list of groups.slice(0, 4)) routeRows.append(depRow(list[0], list.slice(1, 3)));
  }
  async function loadRouteDeps() {
    const s = data.stops[state.stop];
    if (!s) return;
    try {
      routeBody = await fetchDeps([s.id], data.routes[state.route].name);
      renderRouteRows();
    } catch {
      if (routeBody) { renderRouteRows(); return; }
      routeRows.replaceChildren(el("p", "bus-none", t("explore.bus.failed")));
      routeRows.append(retryButton(() => { routeBody = null; renderRouteRows(); loadRouteDeps(); }));
    }
  }
  chips.forEach((chip) => chip.addEventListener("click", () => {
    state.route = Number(chip.getAttribute("data-bus-chip"));
    state.variant = 0;
    const vs = data.variants?.[state.route] || [];
    vs.forEach((v, i) => { if (v.trips > (vs[state.variant]?.trips || 0)) state.variant = i; });
    state.stop = null;
    chips.forEach((c) => { const on = c === chip; c.classList.toggle("is-on", on); c.setAttribute("aria-pressed", String(on)); });
    renderRouteHead(); renderStrip(); renderFrom(); routeBody = null; renderRouteRows(); loadRouteDeps(); drawRoute();
  }));
  variantSel.addEventListener("change", () => {
    state.variant = Number(variantSel.value);
    state.stop = null;
    renderStrip(); renderFrom(); routeBody = null; renderRouteRows(); loadRouteDeps(); drawRoute();
  });

  /* — the map: Leaflet, loaded on first draw; the route's shape and stops,
   * then its buses. A map that cannot load leaves a note, never a hole. — */
  let L = null, map = null, routeLayer = null, busLayer = null;
  async function ensureMap() {
    if (map) return true;
    if (!data.vendorJs) { mapNote.textContent = t("explore.bus.failed"); return false; }
    try { await import(data.vendorJs); } catch { mapNote.textContent = t("explore.bus.failed"); return false; }
    L = window.L;
    if (!L) { mapNote.textContent = t("explore.bus.failed"); return false; }
    /* keyboard: false — the map's own pane is not a keyboard stop (the page's
       controls all are), which also keeps the zoom buttons out of a nested
       focusable container for the accessibility check. */
    map = L.map(root.querySelector("[data-bus-map]"), { scrollWheelZoom: false, keyboard: false });
    /* The tiles are Esri's World Street Map service: a proper tile provider,
       no key, OpenStreetMap among its credited sources. CARTO's basemaps —
       the first choice — now answer keyless requests with an "API KEY
       REQUIRED" tile (checked 16 Nov 2026), which would ship a watermarked
       map; Esri's service answers with the map itself. */
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Esri, HERE, Garmin, and the GIS user community',
      maxZoom: 18,
    }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    busLayer = L.layerGroup().addTo(map);
    mapNote.hidden = true;
    return true;
  }
  async function drawRoute() {
    if (!await ensureMap()) return;
    const v = variant();
    const route = data.routes[state.route];
    routeLayer.clearLayers();
    if (!v) return;
    const pts = (data.shapes?.[v.shape] || []).map(([la, lo]) => [la, lo]);
    if (pts.length) L.polyline(pts, { color: `#${route.color}`, weight: 5, opacity: 0.9 }).addTo(routeLayer);
    for (const si of v.stops) {
      const s = data.stops[si];
      if (!s) continue;
      const sel = si === state.stop;
      L.circleMarker([s.lat, s.lon], { radius: sel ? 8 : 5, color: `#${route.color}`, weight: 3, fillColor: sel ? `#${route.color}` : "#FFFFFF", fillOpacity: 1 })
        .addTo(routeLayer).bindTooltip(s.name);
    }
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.05));
    loadBuses();
  }
  async function loadBuses() {
    if (!map) return;
    try {
      const res = await fetch(`/api/transit/vehicles?route=${encodeURIComponent(data.routes[state.route].name)}`, { headers: { accept: "application/json" } });
      if (!res.ok) return;
      const body = await res.json();
      busLayer.clearLayers();
      for (const veh of body.vehicles || []) {
        /* A bus dot is a sighting, not a control: interactive: false keeps it
           out of the keyboard order and off the accessibility tree's list of
           unnamed buttons. The departures carry the same news in words. */
        L.marker([veh.lat, veh.lon], { interactive: false, icon: L.divIcon({ className: "bus-vehwrap", html: '<span class="bus-veh"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(busLayer);
      }
    } catch { /* the buses are an aid; the departures stand without them */ }
  }

  /* — from your address — */
  const form = root.querySelector("[data-bus-form]");
  const rowsBox = root.querySelector("[data-bus-addresses]");
  const addBtn = root.querySelector("[data-bus-add]");
  const addrStatus = root.querySelector("[data-bus-addr-status]");
  const addrResults = root.querySelector("[data-bus-address-results]");
  const MAX = 5;
  const rows = () => [...rowsBox.querySelectorAll("[data-bus-row]")];
  function renumber() {
    rows().forEach((row, i) => {
      row.querySelector("label").textContent = t("explore.bus.address", { n: i + 1 });
      row.querySelector("[data-bus-remove]").setAttribute("aria-label", t("explore.bus.remove", { n: i + 1 }));
    });
    addBtn.hidden = rows().length >= MAX;
  }
  function wireRow(row) {
    row.querySelector("[data-bus-remove]").addEventListener("click", () => { row.remove(); renumber(); });
  }
  rows().forEach(wireRow);
  addBtn.addEventListener("click", () => {
    if (rows().length >= MAX) return;
    const first = rows()[0];
    const row = first.cloneNode(true);
    const input = row.querySelector("[data-bus-address]");
    input.value = "";
    input.id = "";
    row.querySelector("label").htmlFor = "";
    rowsBox.append(row);
    wireRow(row);
    renumber();
    row.querySelector("[data-bus-address]").focus();
  });
  const haversineM = (la1, lo1, la2, lo2) => {
    const R = 6_371_000, rad = Math.PI / 180;
    const dla = (la2 - la1) * rad, dlo = (lo2 - lo1) * rad;
    const a = Math.sin(dla / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dlo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  async function geocode(q) {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("geocode");
    const body = await res.json();
    return body.results || { ok: false };
  }
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const inputs = rows().map((r) => r.querySelector("[data-bus-address]")).filter((i) => i.value.trim());
    addrResults.replaceChildren();
    if (!inputs.length) { addrStatus.textContent = t("explore.bus.needAddress"); return; }
    const placed = [];
    for (let i = 0; i < inputs.length; i++) {
      const q = inputs[i].value.trim();
      addrStatus.textContent = inputs.length > 1 ? t("explore.bus.lookingCount", { n: i + 1, total: inputs.length }) : t("explore.bus.looking");
      let r;
      try { r = await geocode(q); } catch { addrStatus.textContent = t("explore.bus.lookupFailed", { q }); return; }
      if (!r.ok || typeof r.lat !== "number") { addrStatus.textContent = t("explore.bus.notFound", { q }); return; }
      if (r.state && r.state !== "WI") { addrStatus.textContent = t("explore.bus.outsideArea", { q, place: r.label || q }); return; }
      if (r.city && !/madison/i.test(r.city)) { addrStatus.textContent = t("explore.bus.elsewhere", { city: r.city }); return; }
      if (r.lat < 42.9 || r.lat > 43.25 || r.lon < -89.75 || r.lon > -89.15) { addrStatus.textContent = t("explore.bus.outsideArea", { q, place: r.label || q }); return; }
      placed.push({ label: r.label || q, lat: r.lat, lon: r.lon });
    }
    /* The stops within a short walk of each address, from the page's own
     * timetable data; their departures come from the one live answer. */
    const near = placed.map((p) => {
      const list = [];
      (data.stops || []).forEach((s, si) => {
        const m = haversineM(p.lat, p.lon, s.lat, s.lon);
        if (m <= WALK_M) list.push({ si, m });
      });
      return list.sort((a, b) => a.m - b.m).slice(0, 6);
    });
    const allIds = [...new Set(near.flatMap((list) => list.map((x) => data.stops[x.si].id)))];
    addrStatus.textContent = t("explore.bus.working");
    let body = null;
    try { body = await fetchDeps(allIds); } catch { body = null; }
    addrStatus.textContent = "";
    placed.forEach((p, i) => {
      const card = el("div", "bus-panel bus-addrcard");
      card.append(el("h3", "", p.label));
      const list = near[i];
      if (!list.length || !body) { card.append(el("p", "bus-none", t("explore.bus.noStop"))); addrResults.append(card); return; }
      let shown = 0;
      for (const { si, m } of list) {
        const s = data.stops[si];
        const groups = groupsFor(body, [s.id]);
        for (const g of groups) {
          if (shown >= 6) break;
          const row = depRow(g[0], g.slice(1, 3));
          const walk = el("span", "bus-walk", t("explore.bus.walkMin", { stop: s.name, n: Math.max(1, Math.round(m / WALK_PER_MIN)) }));
          row.querySelector(".bus-dir").append(walk);
          card.append(row);
          shown++;
        }
        if (shown >= 6) break;
      }
      if (!shown) card.append(el("p", "bus-none", t("explore.bus.noneToday")));
      addrResults.append(card);
    });
    addrResults.scrollIntoView({ block: "nearest" });
  });

  /* — start, and keep the times honest — */
  if (state.stop == null) { const v = variant(); if (v) state.stop = v.stops[0]; }
  strip.querySelectorAll("[data-bus-stop]").forEach((btn) => btn.addEventListener("click", () => selectStop(Number(btn.getAttribute("data-bus-stop")))));
  renderFrom();
  loadPanels();
  loadRouteDeps();
  drawRoute();
  setInterval(() => {
    if (document.hidden) return;
    loadPanels();
    loadRouteDeps();
    loadBuses();
  }, REFRESH_MS);
}
