/* The Bus Routes page (Explore redesign, approved 15 Nov 2026): departures first,
 * in the pattern of a transit app — the next buses at the stops that matter, one
 * route at a time with its true shape on a real map, and the buses from a
 * housing address for the decision that page exists to serve.
 *
 * What the server draws: the three stop panels' shells (their departures are
 * live and arrive by script), the route panel for the 80 with its full stop
 * strip (so the page says something true with no script at all), the address
 * form, and the credit line. The data — stops, routes with Metro's own colours,
 * thinned shapes, each route's drawn variants — is built from Metro's published
 * timetable by ops/transit-build.mjs into content/transit/transit-data.json and
 * rides to the script in the island; the panels' stop sets are content
 * (content/transit/panels.json). Live times come from the site's own function
 * (netlify/lib/transit-live.mjs merging the timetable with Metro's GTFS-RT);
 * the map is Leaflet over CARTO's OpenStreetMap tiles, vendored by the build —
 * no hand-drawn diagram anywhere. Addresses are looked up by /api/geocode and
 * are not kept; the words above the button say so before anyone types. */

import { html, jsonIsland } from "../html.mjs";
import { icon } from "../icons.mjs";

const MAX_ADDRESSES = 5;
const TRACKER_URL = "https://metromap.cityofmadison.com/bustime/wireless/html/home.jsp";

const badge = (route, big = false) => html`<span class="bus-badge bus-badge--r${route.name}${big ? " bus-badge--big" : ""}">${route.name}</span>`;
const freeTag = (ctx, route) => (route && route.free ? html` <span class="bus-free">${ctx.t("explore.bus.free")}</span>` : "");
const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const feedSpan = (feed) => {
  if (!feed?.from || !feed?.to) return "";
  const from = new Date(`${feed.from}T12:00:00Z`);
  const to = new Date(`${feed.to}T12:00:00Z`);
  const year = to.getUTCFullYear();
  const sameYear = from.getUTCFullYear() === year;
  return ` (feed ${feed.version}, ${dayFmt.format(from)}${sameYear ? "" : ` ${from.getUTCFullYear()}`} – ${dayFmt.format(to)} ${year})`;
};

export default {
  type: "busroutes",
  label: "Bus Routes",
  fields: { nextTitle: "text!", routeTitle: "text!", addressTitle: "text!", privacy: "text", credit: "text" },
  data: ["transitData", "transitPanels"],
  client: "bus-routes.js",
  vendor: ["leaflet"],
  styles: "busroutes.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const data = ctx.data.transitData || { stops: [], routes: [], shapes: [], variants: [], feed: null };
    const panels = (ctx.data.transitPanels?.panels || []).map((p) => ({ label: p.label, stops: p.stops }));
    const routes = data.routes || [];
    const routeIdx = new Map(routes.map((r, i) => [r.name, i]));
    const home = routeIdx.has("80") ? routeIdx.get("80") : 0;
    const homeVariants = data.variants?.[home] || [];
    let homeVariant = 0;
    homeVariants.forEach((v, i) => { if (v.trips > (homeVariants[homeVariant]?.trips || 0)) homeVariant = i; });
    const hv = homeVariants[homeVariant];
    /* A variant's stops ride slash-joined in the data file (the builder's
       note in ops/transit.mjs says why); the strip reads them as numbers. */
    const hvStops = hv ? String(hv.stops).split("/").filter((x) => x !== "").map(Number) : [];
    const island = {
      feed: data.feed, stops: data.stops, routes, shapes: data.shapes, variants: data.variants,
      panels, home, homeVariant, vendorJs: ctx.assets.vendor?.leaflet?.js || null,
      tracker: TRACKER_URL,
    };
    return html`<section class="busroutes band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-bus-routes><div class="wrap">
  ${jsonIsland(`${b.id}-data`, island)}
  <h2 id="${b.id}-h">${b.nextTitle}</h2>
  <p class="bus-status" data-bus-status aria-live="polite">${ctx.t("explore.bus.loading")}</p>
  <div class="bus-alerts" data-bus-alerts hidden></div>
  <div class="bus-panels">
    ${panels.map((p) => html`<div class="bus-panel">
      <h3>${p.label}</h3>
      <div data-bus-panel-rows><p class="bus-loading">${ctx.t("explore.bus.loading")}</p></div>
      <p class="bus-panel-foot"><a href="${TRACKER_URL}">${ctx.t("explore.bus.tracker")}</a></p>
    </div>`)}
  </div>
  <h2 class="bus-h2">${b.routeTitle}</h2>
  <div class="bus-chips" role="group" aria-label="${ctx.t("explore.bus.routeLabel")}" data-bus-chips>
    ${routes.map((r, i) => html`<button type="button" class="bus-chip${i === home ? " is-on" : ""}" data-bus-chip="${i}" aria-pressed="${i === home ? "true" : "false"}">${badge(r)}<span class="bus-chip-name">${r.long}</span></button>`)}
  </div>
  <div class="bus-route" data-bus-route>
    <div class="bus-routehead">
      ${badge(routes[home] || { name: "" }, true)}
      <div class="bus-routehead-main">
        <p class="bus-routename">${routes[home]?.long || ""}${freeTag(ctx, routes[home])}</p>
        <label class="bus-variant-label">${ctx.t("explore.bus.to")}
          <select data-bus-variant aria-label="${ctx.t("explore.bus.variantLabel")}">
            ${homeVariants.map((v, i) => html`<option value="${i}"${i === homeVariant ? " selected" : ""}>${ctx.t("explore.bus.to")} ${v.headsign}</option>`)}
          </select>
        </label>
      </div>
    </div>
    <p class="bus-from" data-bus-from></p>
    <div data-bus-route-rows><p class="bus-loading">${ctx.t("explore.bus.loading")}</p></div>
    <div class="bus-routegrid">
      <ol class="bus-strip bus-strip--r${routes[home]?.name || ""}" data-bus-strip>
        ${hv ? hvStops.map((si, i) => html`<li${i === 0 || i === hvStops.length - 1 ? ` class="key"` : ""}><button type="button" class="bus-stopbtn${i === 0 ? " is-here" : ""}" data-bus-stop="${si}" aria-pressed="${i === 0 ? "true" : "false"}">${data.stops[si]?.name || ""}</button></li>`) : ""}
      </ol>
      <div class="bus-mapwrap" role="region" aria-label="${ctx.t("explore.bus.mapLabel")}">
        <div class="bus-map" data-bus-map></div>
        <p class="bus-mapnote" data-bus-mapnote>${ctx.t("explore.bus.loading")}</p>
      </div>
    </div>
  </div>
  <h2 class="bus-h2">${b.addressTitle}</h2>
  <form class="bus-form" data-bus-form>
    <div class="bus-addresses" data-bus-addresses>
      ${[1, 2].map((n) => html`<div class="bus-address" data-bus-row>
        <label for="${b.id}-addr-${n}">${ctx.t("explore.bus.address", { n })}</label>
        <div class="bus-address-line">
          <input id="${b.id}-addr-${n}" type="text" autocomplete="street-address" data-bus-address>
          <button type="button" class="bus-remove" data-bus-remove aria-label="${ctx.t("explore.bus.remove", { n })}">${icon("close")}</button>
        </div>
      </div>`)}
    </div>
    <p class="bus-addrow"><button type="button" class="btn btn--quiet" data-bus-add>${ctx.t("explore.bus.addAddress")}</button></p>
    ${b.privacy ? html`<p class="bus-privacy">${b.privacy}</p>` : ""}
    <p class="bus-go"><button type="submit" class="btn btn--big">${ctx.t("explore.bus.compare")}</button></p>
  </form>
  <div class="bus-status" aria-live="polite"><p data-bus-addr-status></p></div>
  <div data-bus-address-results></div>
  <p class="bus-door">${ctx.t("explore.bus.door")} <a href="https://transitapp.com">${ctx.t("explore.bus.transitApp")}</a> · <a href="https://www.google.com/maps">${ctx.t("explore.bus.googleMaps")}</a></p>
  ${b.credit ? html`<p class="bus-credit">${b.credit}${feedSpan(data.feed)}</p>` : ""}
</div></section>`;
  },
};
