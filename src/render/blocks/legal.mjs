/* A legal document's current version as published in Connect (netlify/lib/legal.mjs). Placed on a page beside that
   page's own words: when Connect has published the document, composeSite (src/render/site.mjs) keeps the page head and
   this block and drops the page's other blocks; when it has not, this block draws nothing and the page's words stay.

   The words are plain text. A blank line starts a paragraph; a paragraph whose one line starts "## " is a heading.
   Web addresses (https) and email addresses become links. Nothing in the words is read as markup. */
import { html } from "../html.mjs";

const LINKABLE = /(https:\/\/[^\s<>"]+[^\s<>".,;:!?)]|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

function linked(line) {
  const parts = [];
  let at = 0;
  for (const m of line.matchAll(LINKABLE)) {
    if (m.index > at) parts.push(line.slice(at, m.index));
    const href = m[0].startsWith("https://") ? m[0] : `mailto:${m[0]}`;
    parts.push(html`<a href="${href}">${m[0]}</a>`);
    at = m.index + m[0].length;
  }
  parts.push(line.slice(at));
  return parts;
}

export function legalParagraphs(words) {
  return String(words).replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean).map((p) => {
    if (!p.includes("\n") && p.startsWith("## ")) return html`<h2>${p.slice(3).trim()}</h2>`;
    const lines = p.split("\n");
    return html`<p>${lines.map((l, i) => html`${i ? html`<br>` : ""}${linked(l)}`)}</p>`;
  });
}

export default {
  type: "legal",
  label: "Legal document from Connect",
  fields: { doc: "text!" },
  data: ["legal"],
  analytics: "none",
  loading: "lazy",
  render(b, ctx) {
    const doc = ctx.data.legal?.[b.doc];
    if (!doc) return "";
    const date = /^\d{4}-\d{2}-\d{2}/.test(doc.publishedAt) ? new Date(`${doc.publishedAt.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "";
    return html`<section class="text-block legal-doc band" data-block="${b.id}" data-legal-doc="${doc.id}" data-legal-version="${doc.version}"><div class="wrap"><div class="text-body">
      ${legalParagraphs(doc.words)}
      <p class="legal-version">${date ? ctx.t("legal.versionDated", { n: doc.version, date }) : ctx.t("legal.version", { n: doc.version })}</p>
    </div></div></section>`;
  },
};
