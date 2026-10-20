/* HTML out of template literals, escaped by default.
 *
 * html`<p>${text}</p>` escapes `text`. To insert markup that is already safe — another html``
 * result — pass it as is: results are SafeHtml objects and are not escaped twice. Arrays are
 * joined. null, undefined and false render as nothing, so `${cond && html`…`}` works.
 * There is no way to mark an arbitrary string safe except raw(), and raw() is only used on
 * strings this codebase produced (JSON data islands, inline CSS it wrote itself).
 */

export class SafeHtml {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => MAP[c]);

function part(v) {
  if (v == null || v === false || v === true) return "";
  if (v instanceof SafeHtml) return v.s;
  if (Array.isArray(v)) return v.map(part).join("");
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

export const raw = (s) => new SafeHtml(String(s));

/* Text in which an email address is kept whole and moves to a line of its own rather than splitting
   at its @ beside the words before it. Only an address too long for its pill or panel breaks, before
   the @, so on a phone "@badgersupports.org" wraps whole. Escaped like any other value. */
const ADDRESS = /([^\s@]+@[^\s@]*[^\s@.,;:!?)])/;
export const breakAtSign = (s) =>
  typeof s === "string" && s.includes("@")
    ? s.split(ADDRESS).map((p, i) => (i % 2 ? html`<span class="addr">${p.slice(0, p.indexOf("@"))}<wbr>${p.slice(p.indexOf("@"))}</span>` : p))
    : s;

/* A JSON data island. `<` is escaped so a value can never close the script element. */
export const jsonIsland = (id, data) =>
  raw(`<script type="application/json" id="${esc(id)}">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`);

/* Attribute list from an object: { class: "a", hidden: true, "data-x": 1, skip: null }. */
export function attrs(obj) {
  return raw(Object.entries(obj)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`))
    .join(""));
}
