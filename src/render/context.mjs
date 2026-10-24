/* What every renderer is handed: the site content, the media manifest, data sources, the date,
 * and the link policy. Built once per build (ops/build.mjs) and once per server-rendered page
 * (netlify/functions/api.mjs), so a page looks the same whichever of the two produced it.
 */

import { html, attrs, breakAtSign } from "./html.mjs";
import { makeT } from "../shared/text.mjs";
import { icon } from "./icons.mjs";

export const TZ = "America/Chicago";

/* Today's date in Chicago as YYYY-MM-DD, whatever the machine's zone. */
export function chicagoDate(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => p.find((x) => x.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* text: the resolved word table (src/shared/text.mjs resolveText) — every word a renderer prints
   that is not page content comes from ctx.t. */
/* The programs that wear a colour of their own (src/styles/tokens.css); anything else is brand red. */
export const PROGRAMS = ["peer", "craft", "workshops"];

/* liveEvents: the events came from Connect, so between publishes the page asks Connect's current list
   again (src/render/layout.mjs, netlify/lib/live-events.mjs) and a calendar button opens the file the
   API writes from it (src/render/ics.mjs calendarHref), not the one written at the last publish. */
export function makeContext({ site, media, builtPaths, programs = new Map(), routes = [], data = {}, text, today, prototype = false, assets = {}, liveEvents = false, path = null }) {
  const mediaById = new Map((media?.items || []).map((m) => [m.id, m]));
  return {
    site,
    t: makeT(text),
    media: mediaById,
    data,
    today: today || chicagoDate(),
    prototype,
    assets,
    liveEvents,
    builtPaths: new Set(builtPaths || []),
    // A new path that replaces several live pages (the resource viewer) links to the first listed.
    liveFor: routes.reduce((m, r) => (r.path && r.live && !r.path.includes("{") && !m.has(r.path) ? m.set(r.path, r.live) : m), new Map()),
    pendingLinks: new Set(),
    // The page being rendered, so a list on it does not link back to it (W3C technique G128).
    path,
    link(href) { return resolveLink(this, href); },
    here(href) {
      const r = resolveLink(this, href);
      return !!this.path && !r.external && !r.pending && r.href === this.path;
    },
    // The program whose colour a link's page (or a section of this page) wears, or null: a circle or
    // door to the peer page is green.
    programOf(href) {
      if (href?.startsWith("#")) return programs.get(href) || null;
      if (!href || !href.startsWith("/")) return null;
      const p = href.split(/[?#]/)[0];
      return programs.get(p === "/" ? "/" : p.replace(/\/?$/, "/")) || null;
    },
  };
}

/* Where an href actually goes.
 *   - "#anchor", mailto:, tel: — as written.
 *   - An internal path this build produced — as written.
 *   - An internal path not built yet — its page on the live Google Sites site (content/routes.json
 *     says which, where the path changes), marked data-pending so the check can count them.
 *     Never "#", never a dead local link.
 *   - Connect — kept, and marked so the renderer can say the visitor is leaving for Connect.
 */
export function resolveLink(ctx, href) {
  if (!href) return { href: null };
  if (/^(#|mailto:|tel:)/.test(href)) return { href };
  if (href.startsWith(ctx.site.connectOrigin)) return { href, connect: true, external: true };
  if (/^https?:\/\//.test(href)) return { href, external: true };
  const path = href.split("#")[0].replace(/index\.html$/, "");
  const norm = path === "/" ? "/" : path.replace(/\/?$/, "/");
  if (ctx.builtPaths.has(norm)) return { href: norm + (href.includes("#") ? "#" + href.split("#")[1] : "") };
  ctx.pendingLinks.add(norm);
  const live = ctx.liveFor.get(norm) ?? path.replace(/\/$/, "");
  return { href: ctx.site.liveOrigin + encodeURI(live), pending: true };
}

/* An <a> with the right markers. Connect links say so in text a screen reader reads, and carry a
   small visible mark; pending links carry data-pending for the check and nothing visible.
   extra.icon puts an icon after the words (src/render/icons.mjs): a link that leaves the site
   always shows the arrow out of a box instead of the one it asked for, so nobody is surprised. */
export function link(ctx, href, label, extra = {}) {
  const r = ctx.link(href);
  const name = extra.icon ? (r.external && ["arrow", "down"].includes(extra.icon) ? "out" : extra.icon) : null;
  const cls = [extra.class, r.connect && !name ? "to-connect" : null].filter(Boolean).join(" ") || null;
  return html`<a${attrs({ href: r.href, class: cls, "data-pending": r.pending ? "" : null, "data-connect": r.connect ? "" : null, ...extra.attrs })}>${name ? html`<span class="go-label">${breakAtSign(label)}</span>${icon(name, "go-ic")}` : label}${r.connect ? html`<span class="sr-only"> ${ctx.t("link.toConnect")}</span>` : ""}</a>`;
}

/* The site's ordinary "go somewhere" link: its words, then a round badge with an icon that moves
   when the link is pointed at or pressed. */
export const go = (ctx, href, label, name = "arrow", cls = "") => link(ctx, href, label, { class: ["go", cls].filter(Boolean).join(" "), icon: name });
