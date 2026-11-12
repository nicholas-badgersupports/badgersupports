/* The Bus Route Explorer (WORK item 45, EXPLORE-I-BUS-ROUTES): several prospective housing
 * addresses against several campus buildings, classified from Madison Metro's route topology
 * as a direct bus, one transfer, or no suitable connection, with walking distances only — the
 * site's data holds no times, so none can be shown. The buildings are content
 * (content/transit/buildings.json); the comparison itself runs in netlify/lib/transit.mjs, and
 * src/client/bus-routes.js drives it. Addresses are looked up by the site's own function and are
 * not kept; the words above the button say so, on the page, before anyone types. */

import { html, jsonIsland } from "../html.mjs";
import { icon } from "../icons.mjs";

export default {
  type: "busroutes",
  label: "Bus Route Explorer",
  fields: { title: "text!", lead: "text", privacy: "text", credit: "text" },
  data: ["transitBuildings"],
  client: "bus-routes.js",
  styles: "busroutes.css",
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const buildings = ctx.data.transitBuildings || [];
    return html`<section class="busroutes band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-bus-routes><div class="wrap">
  <h2 id="${b.id}-h">${b.title}</h2>
  ${b.lead ? html`<p class="lead">${b.lead}</p>` : ""}
  ${jsonIsland(`${b.id}-data`, { buildings })}
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
    <fieldset class="bus-buildings">
      <legend>${ctx.t("explore.bus.buildings")}</legend>
      <div class="bus-building-list">${buildings.map((x) => html`<label class="bus-building"><input type="checkbox" value="${x.id}" data-bus-building> ${x.name}</label>`)}</div>
    </fieldset>
    ${b.privacy ? html`<p class="bus-privacy">${b.privacy}</p>` : ""}
    <p class="bus-go"><button type="submit" class="btn btn--big">${ctx.t("explore.bus.compare")}</button></p>
  </form>
  <div class="bus-status" aria-live="polite"><p data-bus-status></p></div>
  <div class="bus-results" data-bus-results hidden>
    <h3>${ctx.t("explore.bus.results")}</h3>
    <div class="bus-tablewrap" data-bus-table></div>
    <h3>${ctx.t("explore.bus.mapTitle")}</h3>
    <div class="bus-map" data-bus-map></div>
    <p class="bus-maplegend">${ctx.t("explore.bus.mapLegend")}</p>
  </div>
  ${b.credit ? html`<p class="bus-credit">${b.credit}</p>` : ""}
</div></section>`;
  },
};
