/* Google Analytics is the one thing measured from this site, and this file is the only one that
   may load Google's tag (queue item 22; docs/ANALYTICS.md). The build bakes the property's
   measurement id and the closed lists of form keys and place ids into the page as a
   "bss-analytics" island, and only when the build was given a verified id; without the island
   this file does nothing at all. The page's own label decides first and the path second, and
   only then does the tag load, told to send no page view of its own: the one page_view sent
   here carries the path alone, never a query string or a fragment. Events arrive as
   "bss:analytics" announcements (src/client/form.js) and go out only when the dictionary below
   names them and every value offered is on its closed list. No user id, no Connect identity,
   no answer and no free text is ever set: none of it is in the dictionary. */

/* The event dictionary: every event the site may send, with the only parameters it may carry.
   Anything not named here is dropped. */
export const EVENTS = {
  form_start: ["form"],
  form_submit_success: ["form"],
  drop_in: ["place"],
  calendar_add: [],
  reel_play: [],
};

/* What of an announced event may go out, or null when nothing of it may. A parameter the
   dictionary does not name is dropped; a form or place outside the closed lists ends the
   event, because the one parameter it exists to carry is not one this site may send. */
export function cleanEvent(name, detail = {}, lists = {}) {
  const params = EVENTS[name];
  if (!params) return null;
  const out = {};
  for (const param of params) {
    const value = detail[param];
    if (typeof value !== "string" || value === "") return null;
    if (param === "form" && !(lists.forms || []).includes(value)) return null;
    if (param === "place" && !(lists.places || []).includes(value)) return null;
    out[param] = value;
  }
  return out;
}

/* The paths measurement never runs on, whatever a page's label says: the staff pages, where
   sign-in happens, and the API's pages. Those pages carry the "none" label as well; this is
   the second lock, in case one does not. */
const PRIVATE_PATHS = ["/staff/", "/api/"];

export function measurable({ label, path }) {
  if (label !== "public") return false;
  return !PRIVATE_PATHS.some((p) => path === p.slice(0, -1) || path.startsWith(p));
}

function start() {
  const island = document.getElementById("bss-analytics");
  if (!island) return;
  let config = null;
  try { config = JSON.parse(island.textContent); } catch { return; }
  if (!config || !/^G-[A-Z0-9]{4,}$/.test(config.id || "")) return;
  if (!measurable({ label: document.body?.dataset.analytics, path: location.pathname })) return;

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args) => window.dataLayer.push(args);
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", config.id, { send_page_view: false });

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.id)}`;
  document.head.appendChild(tag);

  gtag("event", "page_view", { page_path: location.pathname });
  document.addEventListener("bss:analytics", (event) => {
    const { name, ...detail } = event.detail || {};
    const params = cleanEvent(name, detail, config);
    if (params) gtag("event", name, params);
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") start();
