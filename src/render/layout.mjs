/* The page shell: head, prototype notice, announcement, header and navigation, main, support
 * line, footer. Used by the build for every page and by the API for the pages it renders itself
 * (a no-JS form correction, a mood reply).
 *
 * Navigation works without JavaScript: sub-menus are <details>, and on a phone the whole menu is
 * a wrapped list until the script turns it into a Menu button. The inline script in <head> only
 * adds class="js" before first paint, so the phone menu never flashes open.
 */

import { html, raw, attrs, jsonIsland } from "./html.mjs";
import { BLOCKS, liveBlocks, refreshes, renderBlock } from "./registry.mjs";
import { spillLogo, SPILL_CLIENT } from "./spill.mjs";
import { link } from "./context.mjs";
import { clientTable } from "../shared/text.mjs";
import { bareTitle, TITLE_JOIN } from "../shared/structure.mjs";

/* The page whose title puts the site's name first, and whose description is the site's search description. */
const HOME = "pg-home";

/* A page's title as drawn: its own words with the site's name added, first on the home page and last on every other,
   so a change of name reaches every title. A title that already carries the build's name or the current one (stored
   before titles were kept without it) carries it once. An empty title draws the name alone. */
export function pageTitle(page, site) {
  const first = page.id === HOME;
  const own = bareTitle(page.title, [...new Set([site.built?.name, site.name])], { first });
  if (!own) return site.name;
  return first ? site.name + TITLE_JOIN + own : own + TITLE_JOIN + site.name;
}

/* The search description a page draws: the site's on the home page, the page's own on every other. */
export const pageDescription = (page, site) => (page.id === HOME ? site.description : page.description);

/* The one inline script. Its hash goes into the Content-Security-Policy (ops/build.mjs). A browser
   that was signed in as staff also gets staff-hint, so the staff page shows "Checking your sign-in"
   instead of a Sign in button that would vanish a moment later; staff.js takes it off, and the
   timer does if staff.js never runs (src/render/blocks/staff.mjs). */
export const INLINE_JS = "var d=document.documentElement;d.classList.add('js');if(/(?:^|; )bss_staff_hint=1(?:;|$)/.test(document.cookie)){d.classList.add('staff-hint');setTimeout(function(){d.classList.remove('staff-hint')},8000)}";

function navItem(ctx, item, currentPath) {
  if (item.children) {
    return html`<li><details data-nav><summary>${item.label}</summary><ul class="sub">${item.children.map((c) => html`<li>${navLink(ctx, c, currentPath)}</li>`)}</ul></details></li>`;
  }
  return html`<li>${navLink(ctx, item, currentPath)}</li>`;
}

function navLink(ctx, item, currentPath) {
  const r = ctx.link(item.href);
  const current = !r.pending && !r.external && r.href === currentPath;
  return html`<a${attrs({ href: r.href, "aria-current": current ? "page" : null, "data-pending": r.pending ? "" : null })}>${item.label}</a>`;
}

function header(ctx, path) {
  const s = ctx.site;
  return html`<header class="site-header"><div class="wrap">
  <a class="brand" href="/"><img src="/assets/brand/bss-hand-red.png" width="301" height="440" alt=""><span>${ctx.t("header.wordmark")}</span><span class="sr-only"> ${ctx.t("header.homeSuffix")}</span></a>
  <button type="button" class="menu-toggle" aria-expanded="false" aria-controls="site-nav" data-menu-toggle>${ctx.t("header.menu")}</button>
  <nav class="nav" id="site-nav" aria-label="${ctx.t("header.navLabel")}"><ul>${s.nav.map((i) => navItem(ctx, i, path))}</ul></nav>
  ${s.headerAction ? html`<div class="header-action">${link(ctx, s.headerAction.href, s.headerAction.label, { class: "btn btn--quiet" })}</div>` : ""}
</div></header>`;
}

function supportLine(ctx) {
  const sl = ctx.site.supportLine;
  if (!sl?.enabled) return "";
  // The phone numbers in the sentence become links; everything else stays text.
  let parts = [sl.text];
  for (const l of sl.links || []) {
    parts = parts.flatMap((p) => {
      if (typeof p !== "string") return [p];
      const i = p.indexOf(l.label);
      if (i < 0) return [p];
      return [p.slice(0, i), html`<a href="${l.href}">${l.label}</a>`, p.slice(i + l.label.length)];
    });
  }
  return html`<aside class="support-line" aria-label="${ctx.t("support.label")}"><div class="wrap"><img src="/assets/brand/bss-hand-cream.png" width="301" height="440" alt=""><p>${parts}</p></div></aside>`;
}

/* The footer's accessibility line: its words with the build's address (or the current one, if the words were saved
   with it) replaced by the current address, linked. Words that hold neither are drawn, and the address linked after. */
function accessibility(ctx) {
  const f = ctx.site.footer;
  const words = f.accessibility;
  const email = f.accessibilityEmail;
  if (!email) return words;
  const a = html`<a href="mailto:${email}">${email}</a>`;
  for (const was of new Set([ctx.site.built?.accessibilityEmail, email])) {
    const i = was ? words.indexOf(was) : -1;
    if (i >= 0) return [words.slice(0, i), a, words.slice(i + was.length)];
  }
  return [words, " ", a];
}

function footer(ctx) {
  const f = ctx.site.footer;
  return html`<footer class="site-footer"><div class="wrap">
  <div class="footer-top">
    <div class="footer-brand">
      <div class="brand-row"><img src="/assets/brand/bss-hand-cream.png" width="301" height="440" alt=""><span class="wordmark">${ctx.t("header.wordmark")}</span></div>
      <p>${f.address}</p>
      <p>${f.affiliation}</p>
      <p>${f.funding}</p>
      ${f.spill ? link(ctx, f.spill.href, html`${spillLogo("footer-spill-logo", "6rem")}<span>${f.spill.label}</span>`, { class: "footer-spill" }) : ""}
    </div>
    ${f.columns.map((c) => html`<div><h2>${c.title}</h2><ul>${c.links.map((l) => html`<li>${link(ctx, l.href, l.label)}</li>`)}</ul></div>`)}
  </div>
  <div class="footer-bottom">
    <p>${accessibility(ctx)}</p>
    <ul class="social" aria-label="${ctx.t("footer.socialLabel")}">${f.social.map((l) => html`<li>${link(ctx, l.href, l.label)}</li>`)}</ul>
    <ul aria-label="${ctx.t("footer.legalLabel")}">${f.legal.map((l) => html`<li>${link(ctx, l.href, l.label)}</li>`)}${f.staffSignIn ? html`<li class="staff-link">${link(ctx, f.staffSignIn.href, f.staffSignIn.label)}</li>` : ""}</ul>
  </div>
</div></footer>`;
}

function protoNotice(ctx) {
  if (!ctx.prototype) return "";
  return html`<div class="proto" role="note"><strong>${ctx.t("proto.title")}</strong> ${ctx.t("proto.body")}</div>`;
}

/* page: the page JSON. body: optional pre-rendered main content (API pages), with the browser
   modules it needs in `clients`. */
export function renderPage(ctx, page, { body = null, status = null, clients: extra = [] } = {}) {
  const blocks = body ? [] : liveBlocks(page, ctx.today);
  const top = blocks.filter((b) => BLOCKS[b.type].placement === "top");
  const main = blocks.filter((b) => BLOCKS[b.type].placement !== "top");
  // A page built from Connect's events with a block that can show them again asks for them between
  // publishes; schedule.js does the asking (netlify/lib/live-events.mjs answers).
  const refreshing = ctx.liveEvents && blocks.some(refreshes);
  const clients = [...new Set([...blocks.flatMap((b) => [].concat(BLOCKS[b.type].client || [])), ...(refreshing ? ["schedule.js"] : []), ...extra, ...(ctx.site.footer.spill ? [SPILL_CLIENT] : [])])];
  const a = ctx.assets;
  const canonical = ctx.site.origin + page.path;
  const title = pageTitle(page, ctx.site);
  const description = pageDescription(page, ctx.site);
  const preload = page.preloadImage ? html`<link rel="preload" as="image" href="${page.preloadImage.href}" imagesrcset="${page.preloadImage.srcset}" imagesizes="${page.preloadImage.sizes}" type="${page.preloadImage.type}" fetchpriority="high">` : "";
  return html`<!doctype html>
<html lang="${ctx.site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${description ? html`<meta name="description" content="${description}">` : ""}
${page.noindex || ctx.prototype ? html`<meta name="robots" content="noindex">` : ""}
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
${description ? html`<meta property="og:description" content="${description}">` : ""}
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#B60000">
<link rel="icon" href="/assets/brand/bss-hand-red.png" type="image/png">
<link rel="preload" href="/assets/fonts/montserrat-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/montserrat-800.woff2" as="font" type="font/woff2" crossorigin>
${preload}
<link rel="stylesheet" href="${a.css}">
<script>${raw(INLINE_JS)}</script>
<script type="module" src="${a.js["site.js"]}"></script>
${clients.map((c) => html`<script type="module" src="${a.js[c]}"></script>`)}
${Object.keys(clientTable(ctx.t.table, clients)).length ? jsonIsland("bss-text", clientTable(ctx.t.table, clients)) : ""}
</head>
<body${attrs({ "data-page": page.id, "data-analytics": page.analytics || "public", "data-status": status, "data-refresh": refreshing ? "events" : null })}>
<a class="skip" href="#main">${ctx.t("page.skip")}</a>
${protoNotice(ctx)}
${top.map((b) => renderBlock(b, ctx))}
${header(ctx, page.path)}
<main${attrs({ id: "main", tabindex: "-1", "data-program": page.program })}>
${body ?? main.map((b) => renderBlock(b, ctx))}
</main>
${supportLine(ctx)}
${footer(ctx)}
</body>
</html>
`;
}
