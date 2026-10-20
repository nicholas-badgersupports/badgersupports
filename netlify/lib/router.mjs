/* Every API route, with its access tier declared on the route itself. The router refuses to
 * load a route with no tier (netlify-backend-local-first: a forgotten wrapper is how a private
 * read ships public). Tiers:
 *   public    anyone; posts must come from this site's own pages and are rate-limited
 *   director  a director or admin signed in through Connect, for the forms their claims name.
 *             Connect single sign-on does not exist yet, so this tier refuses everyone (401).
 */

import { json, htmlResponse, wantsJson, readBody, sameOrigin, connectionHash, rateLimit, HttpError } from "./http.mjs";
import { currentForm, submit, answersForPerson } from "./intake.mjs";
import { recordMood, moodCounts } from "./mood.mjs";
import { serverContent } from "./content.mjs";
import { makeContext, chicagoDate } from "../../src/render/context.mjs";
import { renderPage } from "../../src/render/layout.mjs";
import { renderForm, renderDone, renderClosed } from "../../src/render/form.mjs";
import { formSection } from "../../src/render/blocks/form.mjs";
import { html } from "../../src/render/html.mjs";
import { readRaw } from "../../src/shared/forms.mjs";

export const TIERS = new Set(["public", "director"]);

function context() {
  const c = serverContent();
  return makeContext({ site: c.site, media: c.media, builtPaths: c.builtPaths, routes: c.routes, data: { forms: c.forms, mood: c.mood }, text: c.text, prototype: c.prototype, assets: c.assets });
}

/* pageInfo.titleKey names a text key for the <title> when the page has no content title. */
function page(status, pageInfo, body, clients = []) {
  const ctx = context();
  const title = pageInfo.title || ctx.t(pageInfo.titleKey);
  return htmlResponse(status, String(renderPage(ctx, { analytics: "none", noindex: true, ...pageInfo, title }, { body: body(ctx), clients })));
}

function formPage(def) {
  const p = serverContent().formPages?.[def.key];
  return { id: p?.id || `pg-form-${def.key}`, path: p?.path || `/forms/${def.key}/`, title: p?.title || def.title, blockId: p?.blockId, blockTitle: p?.blockTitle };
}

const formReply = (status, def, inner) => {
  const p = formPage(def);
  return page(status, p, (ctx) => formSection(def, inner(ctx), { id: p.blockId, title: p.blockTitle }), ["form.js"]);
};

/* No session can exist until Connect single sign-on does. When it does, this verifies the
   session and returns its claims; until then it refuses, and so does every director route. */
async function requireDirector() {
  throw new HttpError(401, "auth.unavailable");
}

async function formState(req, [key]) {
  const f = await currentForm(key);
  if (!f) throw new HttpError(404, "form.unknown");
  return json(200, { ok: true, key, state: f.state, version: f.def.version, closedMessage: f.state === "closed" ? f.closedMessage : null });
}

async function formSubmit(req, [key], context) {
  const asJson = wantsJson(req);
  const body = await readBody(req);
  try {
    await rateLimit(`form:${key}:${connectionHash(req, context)}`, 10, 3600);
  } catch (e) {
    if (e.code !== "rate.limited" || asJson) throw e;
    const f = await currentForm(key);
    if (!f) throw new HttpError(404, "form.unknown");
    return formReply(429, f.def, (ctx) => renderForm(f.def, { t: ctx.t, values: readRaw(f.def, body), notice: { title: ctx.t("form.errors.title"), text: ctx.t("form.status.rateLimited") }, idemKey: body.get("_key") || "" }));
  }
  const r = await submit(key, body);
  if (asJson) {
    if (r.ok) return json(200, { ok: true, ref: r.ref });
    if (r.error === "form.closed") return json(409, { ok: false, error: r.error, closedMessage: r.closedMessage });
    return json(422, { ok: false, error: r.error, errors: r.errors, version: r.version });
  }
  if (r.ok) return formReply(200, r.def, (ctx) => renderDone(r.def, r.ref, ctx.t));
  if (r.error === "form.closed") return formReply(409, r.def, (ctx) => renderClosed(r.def, ctx.t, { title: ctx.t("form.closedNow.title"), answers: answersForPerson(r.def, r.raw) }));
  const changed = r.versionSeen && r.versionSeen !== r.version;
  return formReply(422, r.def, (ctx) => renderForm(r.def, {
    t: ctx.t, values: r.raw, errors: r.errors,
    notice: changed ? { title: ctx.t("form.updated.title"), text: ctx.t("form.updated.body") } : null,
    idemKey: typeof body.get === "function" ? body.get("_key") || "" : body._key || "",
  }));
}

async function moodRead() {
  return json(200, { ok: true, ...(await moodCounts(chicagoDate())) });
}

async function moodTap(req, _m, context) {
  const asJson = wantsJson(req);
  const body = await readBody(req);
  await rateLimit(`mood:${connectionHash(req, context)}`, 30, 3600);
  const id = typeof body.get === "function" ? body.get("mood") : body.mood;
  const r = await recordMood(String(id || ""));
  if (asJson) return json(200, r);
  return page(200, { id: "pg-mood", path: "/", titleKey: "mood.pageTitle" }, (ctx) => html`<section class="mood mood--page band" aria-labelledby="mood-h"><div class="wrap">
  <h1 id="mood-h">${ctx.t("mood.pageTitle")}</h1>
  <p class="msg">${r.message}</p>
  <p>${ctx.t(r.total === 1 ? "mood.count.one" : "mood.count.other", { n: r.total })}</p>
  <ul class="mood-counts">${r.counts.map((c) => html`<li class="mood-${c.id}"><span>${c.label}</span> <span class="n">${c.n}</span></li>`)}</ul>
  <p>${r.after}</p>
  <p><a href="/">${ctx.t("mood.back")}</a></p>
</div></section>`);
}

export const ROUTES = [
  { name: "health", method: "GET", pattern: /^\/api\/health$/, tier: "public", run: async () => json(200, { ok: true }) },
  { name: "formState", method: "GET", pattern: /^\/api\/forms\/([a-z0-9-]{2,40})\/state$/, tier: "public", run: formState },
  { name: "formSubmit", method: "POST", pattern: /^\/api\/forms\/([a-z0-9-]{2,40})\/submit$/, tier: "public", run: formSubmit },
  { name: "moodRead", method: "GET", pattern: /^\/api\/mood$/, tier: "public", run: moodRead },
  { name: "moodTap", method: "POST", pattern: /^\/api\/mood$/, tier: "public", run: moodTap },
  { name: "staffSubmissions", method: "GET", pattern: /^\/api\/staff\/forms\/([a-z0-9-]{2,40})\/submissions$/, tier: "director", run: async () => { throw new HttpError(404, "not.found"); } },
  { name: "staffAny", method: "*", pattern: /^\/api\/staff(\/.*)?$/, tier: "director", run: async () => { throw new HttpError(404, "not.found"); } },
];

for (const r of ROUTES) if (!TIERS.has(r.tier)) throw new Error(`route ${r.name} declares no tier`);

function errorReply(req, status, code) {
  if (wantsJson(req) || new URL(req.url).pathname.startsWith("/api/staff")) return json(status, { ok: false, error: code });
  return page(status, { id: "pg-error", path: "/", titleKey: "errors.server.title" }, (ctx) => html`<section class="band" aria-labelledby="err-h"><div class="wrap">
  <h1 id="err-h">${ctx.t("errors.server.title")}</h1>
  <p>${ctx.t("errors.server.body")}</p>
</div></section>`);
}

export async function handle(req, context) {
  const { pathname } = new URL(req.url);
  const matches = ROUTES.filter((r) => r.pattern.test(pathname));
  const route = matches.find((r) => r.method === "*" || r.method === req.method);
  if (!route) return json(matches.length ? 405 : 404, { ok: false, error: matches.length ? "method.not-allowed" : "not.found" });
  try {
    if (route.method === "POST" && !sameOrigin(req)) throw new HttpError(403, "origin.refused");
    if (route.tier === "director") await requireDirector(req);
    return await route.run(req, pathname.match(route.pattern).slice(1), context);
  } catch (e) {
    if (e instanceof HttpError) return errorReply(req, e.status, e.code);
    if (e?.code === "config.missing") return errorReply(req, 503, "config.missing");
    console.error(`api ${route.name}:`, e);
    return errorReply(req, 500, "server.error");
  }
}
