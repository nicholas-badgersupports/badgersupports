/* Every API route, with its access tier declared on the route itself. The router refuses to
 * load a route with no tier (netlify-backend-local-first: a forgotten wrapper is how a private
 * read ships public). Tiers:
 *   public    anyone; posts must come from this site's own pages and are rate-limited
 *   director  someone signed in through Connect (staff.mjs). The tier only proves a session; each
 *             route then checks the scope it needs: forms.read:<key> to read a form's answers,
 *             site.edit to change words with the edit button (a save publishes them), site.edit or
 *             site.publish for Refresh now, site.publish to download the edits file. Which roles hold which is a super
 *             admin's setting in Connect (Website Forms), not this site's.
 *
 * Sign-in itself (/api/auth/*) is public: it is how a session starts. Its failures are pages,
 * since a person lands on them, not a script.
 */

import { json, htmlResponse, wantsJson, readBody, readBytes, sameOrigin, connectionHash, rateLimit, HttpError } from "./http.mjs";
import { currentForm, submit, answersForPerson } from "./intake.mjs";
import { fileQuestion, fileName, isPdfType, storeFile } from "./files.mjs";
import { recordMood, moodCounts } from "./mood.mjs";
import { serverContent } from "./content.mjs";
import { connectConfig, signinQuotes } from "./connect.mjs";
import { deliverDue } from "./deliver.mjs";
import { startSignIn, finishSignIn, sessionFrom, signOut, can, returnPath } from "./staff.mjs";
import { formsFor, latestAnswers } from "./answers.mjs";
import { editSource, editEntry, editHistory, saveEdit, editsFile, waitingCount } from "./edits.mjs";
import { eventSections, calendarFile, forgetEvents } from "./live-events.mjs";
import { publishRevision, currentRevision, purgeTags } from "./published.mjs";
import { makeContext, chicagoDate } from "../../src/render/context.mjs";
import { renderPage } from "../../src/render/layout.mjs";
import { renderForm, renderDone, renderClosed } from "../../src/render/form.mjs";
import { formSection } from "../../src/render/blocks/form.mjs";
import { html } from "../../src/render/html.mjs";
import { readRaw, QUESTION_TYPES } from "../../src/shared/forms.mjs";
import { clientTable } from "../../src/shared/text.mjs";

export const TIERS = new Set(["public", "director"]);
export const FORM_PER_HOUR = 40;

function renderContext() {
  const c = serverContent();
  return makeContext({ site: c.site, media: c.media, builtPaths: c.builtPaths, routes: c.routes, data: { forms: c.forms, mood: c.mood }, text: c.text, prototype: c.prototype, assets: c.assets });
}

/* pageInfo.titleKey names a text key for the <title> when the page has no content title. */
function page(status, pageInfo, body, clients = []) {
  const ctx = renderContext();
  const title = pageInfo.title || ctx.t(pageInfo.titleKey);
  return htmlResponse(status, String(renderPage(ctx, { analytics: "none", noindex: true, ...pageInfo, title }, { body: body(ctx), clients })));
}

function formPage(def) {
  const p = serverContent().formPages?.[def.key];
  return { id: p?.id || `pg-form-${def.key}`, path: p?.path || `/forms/${def.key}/`, title: p?.title || def.title, blockId: p?.blockId, blockTitle: p?.blockTitle };
}

const formReply = (status, def, inner) => {
  const p = formPage(def);
  return page(status, p, (ctx) => formSection(def, inner(ctx), { id: p.blockId, title: p.blockTitle, ctx }), ["form.js"]);
};

/* The signed-in person, or 401. configured tells the staff page whether signing in can work on
   this copy of the site at all. */
async function requireDirector(req) {
  const who = await sessionFrom(req);
  if (!who) throw new HttpError(401, "auth.required", { configured: !!connectConfig() });
  return who;
}

/* auth.again: the session held this scope, and a fresh sign-in gives it back (staff.mjs). */
function need(who, scope) {
  if (can(who, scope)) return;
  throw new HttpError(403, who.lapsed && can({ scopes: who.lapsed }, scope) ? "auth.again" : "staff.forbidden");
}

const readsForms = (who) => who.scopes.some((s) => s.startsWith("forms.read:"));

/* Work that should not hold up the reply. Netlify keeps the function alive for it (waitUntil); a
   local server simply carries on. A failure is logged, never shown to the person waiting. */
function afterReply(context, work) {
  const done = Promise.resolve().then(work).catch((e) => console.error("after reply:", e));
  context?.waitUntil?.(done);
  return done;
}

/* Public, and the same for everyone, so the CDN holds it a minute: a burst of asks does not wake the
   database. The browser asks each time; the server still decides at Send. */
const STATE_CACHE = { "netlify-cdn-cache-control": "public, s-maxage=60" };
async function formState(req, [key]) {
  noQuery(req);
  const f = await currentForm(key);
  if (!f) throw new HttpError(404, "form.unknown");
  return json(200, { ok: true, key, state: f.state, version: f.def.version, closedMessage: f.state === "closed" ? f.closedMessage : null }, STATE_CACHE);
}

async function formSubmit(req, [key], context) {
  const asJson = wantsJson(req);
  const body = await readBody(req);
  try {
    // 40 an hour per form per address: a class behind one campus address can all send it (cloud run §6)
    await rateLimit(`form:${key}:${connectionHash(req, context)}`, FORM_PER_HOUR, 3600);
  } catch (e) {
    if (e.code !== "rate.limited" || asJson) throw e;
    const f = await currentForm(key);
    if (!f) throw new HttpError(404, "form.unknown");
    const reply = formReply(429, f.def, (ctx) => renderForm(f.def, { t: ctx.t, ctx, values: readRaw(f.def, body), notice: { title: ctx.t("form.errors.title"), text: ctx.t("form.status.rateLimited") }, idemKey: body.get("_key") || "" }));
    for (const [k, v] of Object.entries(e.headers || {})) reply.headers.set(k, v);
    return reply;
  }
  const r = await submit(key, body);
  if (r.ok && !r.duplicate && !r.trapped) afterReply(context, () => deliverDue({ limit: 5 }));
  const changed = r.versionSeen && r.versionSeen !== r.version;
  const corrected = (ctx) => renderForm(r.def, {
    t: ctx.t, ctx, values: r.raw, errors: r.errors,
    notice: changed ? { title: ctx.t("form.updated.title"), text: ctx.t("form.updated.body"), kept: r.gone, keptText: ctx.t("form.updated.gone") } : null,
    idemKey: typeof body.get === "function" ? body.get("_key") || "" : body._key || "",
  });
  if (asJson) {
    if (r.ok) return json(200, { ok: true, ref: r.ref });
    if (r.error === "form.closed") return json(409, { ok: false, error: r.error, closedMessage: r.closedMessage });
    // The questions changed since the page was loaded: the reply carries the form as it now stands,
    // with the answers that still fit and each problem marked, for the page to put in place of its
    // own (src/client/form.js). The page's copy cannot mark a question it has never heard of.
    return json(422, { ok: false, error: r.error, errors: r.errors, version: r.version, ...(changed ? { form: String(corrected(renderContext())) } : {}) });
  }
  if (r.ok) return formReply(200, r.def, (ctx) => renderDone(r.def, r.ref, ctx.t));
  if (r.error === "form.closed") return formReply(409, r.def, (ctx) => renderClosed(r.def, ctx.t, { title: ctx.t("form.closedNow.title"), answers: answersForPerson(r.def, r.raw) }));
  return formReply(422, r.def, corrected);
}

/* One PDF for a file question, as soon as it is chosen (netlify/lib/files.mjs). Answered in JSON
   only: the page that uploads is the one with JavaScript, and without it the page says a file
   needs it. The checks cost nothing before the bytes are read. There is no route back out. */
async function formFile(req, [key], context) {
  await rateLimit(`file:${key}:${connectionHash(req, context)}`, 20, 3600);
  const form = await currentForm(key);
  if (!form) throw new HttpError(404, "form.unknown");
  const qn = fileQuestion(form, new URL(req.url).searchParams.get("q"));
  if (!isPdfType(req.headers.get("content-type"))) throw new HttpError(415, "file.notPdf");
  const bytes = await readBytes(req, QUESTION_TYPES.file.maxBytes);
  const fileId = await storeFile(form, qn, { name: fileName(req.headers.get("x-file-name")), bytes });
  return json(200, { ok: true, fileId });
}

/* Connect GOOGLE-SIGNIN, WORK item 20 — the staff page's optional quote, from Connect's one shared list (connect.mjs,
   signinQuotes). Public, read-only, names nobody; [] when Connect is not set up, the list is switched off or empty, or
   Connect does not answer. Never cached at the edge: a switch in Connect reaches the page within five minutes. */
async function signinQuotesRoute() {
  return json(200, { ok: true, quotes: await signinQuotes(connectConfig()) }, { "cache-control": "no-store" });
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

async function authLimit(req, context) {
  await rateLimit(`auth:${connectionHash(req, context)}`, 30, 3600);
}

async function authStart(req, _m, context) {
  await authLimit(req, context);
  return startSignIn(req);
}

async function authCallback(req, _m, context) {
  await authLimit(req, context);
  return finishSignIn(req);
}

const authSignOut = (req) => signOut(req, { asJson: wantsJson(req) });

/* Whether anyone is signed in here, always 200, so the staff page can ask without the browser
   logging a refusal for every visitor who is not staff. */
const authStatus = async (req) => json(200, { ok: true, signedIn: !!(await sessionFrom(req)), configured: !!connectConfig() });

/* The revision the pages are drawn with now, for the editor: its number and time, or why it cannot be read. */
async function publishedNow() {
  try {
    const r = await currentRevision({ fresh: true });
    return { published: r ? { n: r.n, at: r.at } : null };
  } catch (e) {
    return { published: null, publishError: e.code || "publish.unavailable" };
  }
}

async function staffMe(req, _m, _c, who) {
  const canEdit = can(who, "site.edit");
  const canPublish = can(who, "site.publish");
  return json(200, {
    ok: true, name: who.name, canEdit, canPublish, canRead: readsForms(who), readAgain: !!who.lapsed?.length,
    connectUrl: connectConfig()?.url || null,
    waiting: canEdit || canPublish ? await waitingCount() : 0,
    ...(canEdit || canPublish ? await publishedNow() : {}),
    text: clientTable(serverContent().text, ["edit.js"]),
  });
}

/* Opening the staff page only reads. A new submission wakes delivery, and Try again sends the
   reader's own forms (owner ruling, 24 Oct 2026). */
async function staffForms(req, _m, _c, who) {
  return json(200, { ok: true, ...(await formsFor(who)) });
}

async function staffSubmissions(req, [key], _c, who) {
  need(who, `forms.read:${key}`);
  const r = await latestAnswers(key);
  if (!r) throw new HttpError(404, "form.unknown");
  return json(200, { ok: true, ...r });
}

/* Try again sends only the forms this reader may read: every form for forms.read:*, otherwise the
   ones named. Someone else's waiting answers stay where they are. */
async function staffRetry(req, _m, _c, who) {
  if (!readsForms(who)) throw new HttpError(403, who.lapsed?.length ? "auth.again" : "staff.forbidden");
  const forms = can(who, "forms.read:*") ? null
    : who.scopes.filter((s) => s.startsWith("forms.read:")).map((s) => s.slice("forms.read:".length));
  const r = await deliverDue({ limit: 20, force: true, forms });
  return json(200, { ok: true, ...r, ...(await formsFor(who)) });
}

async function editSourceRoute(req, _m, _c, who) {
  need(who, "site.edit");
  return json(200, { ok: true, entries: await editSource(new URL(req.url).searchParams.get("page")) });
}

/* Every version saved for one place, newest first; Restore in the edit box saves one of them again
   through editSave, so it passes the same checks and becomes the newest. */
async function editHistoryRoute(req, _m, _c, who) {
  need(who, "site.edit");
  return json(200, { ok: true, ...(await editHistory(new URL(req.url).searchParams.get("target"))) });
}

/* The cache tags a saved word touches: its own page, or every page for the menus, footer and shared lines,
   which the event feeds also print. */
const tagsFor = (target) => {
  const m = String(target).match(/^page:(pg-[a-z0-9-]+):/);
  return m ? [`page:${m[1]}`] : ["page", "events"];
};

/* A permitted save publishes (owner, 24 Oct 2026): the saved words become the next revision the pages are
   drawn with (published.mjs, pages.mjs), and the pages they touch are cleared from the CDN. It grants no
   scope and approves nothing else. If the revision cannot be written the save is still kept, and the reply
   says so; Refresh now tries again. */
async function editSave(req, _m, _c, who) {
  need(who, "site.edit");
  const body = await readBody(req);
  if (body instanceof URLSearchParams) throw new HttpError(415, "body.type");
  const r = await saveEdit(who, body);
  let published = null, publishError = null;
  if (r.changed) {
    try {
      published = await publishRevision(who);
      await purgeTags(tagsFor(body.target)).catch((e) => console.error("purge:", e.code || e.message));
    } catch (e) {
      publishError = e.code || "publish.unavailable";
      console.error("publish:", e.message);
    }
  }
  return json(200, { ok: true, changed: r.changed, entry: await editEntry(body.target), waiting: await waitingCount(), published, publishError });
}

/* Refresh now: the pages and the event feeds drawn again from now, for someone who may edit or publish
   words, checked here. JSON from this site only (a form elsewhere cannot send JSON without asking first),
   six an hour per person and one a minute for the whole site. It writes the revision again if the last
   write failed, forgets the held Connect list and clears the `page` and `events` tags. A visitor has no way
   to ask for this: no query string, header or cookie on a public address does it. */
export const REFRESH_PER_PERSON = 6;
export const REFRESH_SITE_SECONDS = 60;
async function refreshRoute(req, _m, _c, who) {
  if (!can(who, "site.edit") && !can(who, "site.publish")) throw new HttpError(403, "staff.forbidden");
  const body = await readBody(req);
  if (body instanceof URLSearchParams) throw new HttpError(415, "body.type");
  await rateLimit(`refresh:${who.sub}`, REFRESH_PER_PERSON, 3600);
  await rateLimit("refresh:site", 1, REFRESH_SITE_SECONDS);
  let publishError = null, purgeError = null;
  try { await publishRevision(who); } catch (e) { publishError = e.code || "publish.unavailable"; }
  forgetEvents();
  try { await purgeTags(["page", "events"]); } catch (e) { purgeError = e.code || "purge.unavailable"; }
  return json(200, { ok: true, ...(await publishedNow()), ...(publishError ? { publishError } : {}), ...(purgeError ? { purgeError } : {}) });
}

/* ?download=1 is the file a publish lays over the site: saved as content/edits.json. Changing words
   and handing them to a publish are separate permissions, so this needs site.publish. */
async function editsFileRoute(req, _m, _c, who) {
  need(who, "site.publish");
  const file = await editsFile();
  if (new URL(req.url).searchParams.get("download") !== "1") return json(200, { ok: true, ...file, waiting: await waitingCount() });
  return new Response(`${JSON.stringify(file, null, 2)}\n`, { status: 200, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff",
    "content-disposition": 'attachment; filename="edits.json"',
  } });
}

/* The events between publishes (live-events.mjs). The same answer serves everyone, so the CDN holds
   it: five minutes when it came from Connect, half a minute when Connect could not be read and it is
   the publish's list. A query string is refused rather than ignored, so nobody can ask past the
   cache to Connect. */
const LIVE_CACHE = { "cache-control": "public, max-age=60", "netlify-cdn-cache-control": "public, durable, s-maxage=300, stale-while-revalidate=600", "netlify-cache-tag": "events" };
const STALE_CACHE = { "cache-control": "public, max-age=30", "netlify-cdn-cache-control": "public, s-maxage=30", "netlify-cache-tag": "events" };

function noQuery(req) {
  if (new URL(req.url).search) throw new HttpError(400, "query.refused");
}

async function eventsPage(req, [pageId]) {
  noQuery(req);
  const r = await eventSections(pageId);
  if (!r) throw new HttpError(404, "not.found");
  return json(200, { ok: true, today: r.today, blocks: r.blocks }, r.stale ? STALE_CACHE : LIVE_CACHE);
}

async function eventCalendar(req, [eventId]) {
  noQuery(req);
  const r = await calendarFile(eventId);
  if (!r) throw new HttpError(404, "not.found");
  return new Response(r.text, { status: 200, headers: { "content-type": "text/calendar; charset=utf-8", "x-content-type-options": "nosniff", ...(r.stale ? STALE_CACHE : LIVE_CACHE) } });
}

export const ROUTES = [
  { name: "health", method: "GET", pattern: /^\/api\/health$/, tier: "public", run: async () => json(200, { ok: true }) },
  { name: "formState", method: "GET", pattern: /^\/api\/forms\/([a-z0-9-]{2,40})\/state$/, tier: "public", run: formState },
  { name: "formSubmit", method: "POST", pattern: /^\/api\/forms\/([a-z0-9-]{2,40})\/submit$/, tier: "public", run: formSubmit },
  { name: "formFile", method: "POST", pattern: /^\/api\/forms\/([a-z0-9-]{2,40})\/files$/, tier: "public", run: formFile },
  { name: "eventsPage", method: "GET", pattern: /^\/api\/events\/(pg-[a-z0-9-]{2,80})$/, tier: "public", run: eventsPage },
  { name: "eventCalendar", method: "GET", pattern: /^\/api\/calendar\/([A-Za-z0-9_-]{1,120})\.ics$/, tier: "public", run: eventCalendar },
  { name: "moodRead", method: "GET", pattern: /^\/api\/mood$/, tier: "public", run: moodRead },
  { name: "moodTap", method: "POST", pattern: /^\/api\/mood$/, tier: "public", run: moodTap },
  { name: "authStart", method: "GET", pattern: /^\/api\/auth\/start$/, tier: "public", run: authStart },
  { name: "authCallback", method: "GET", pattern: /^\/api\/auth\/callback$/, tier: "public", run: authCallback },
  { name: "authSignOut", method: "POST", pattern: /^\/api\/auth\/signout$/, tier: "public", run: authSignOut },
  { name: "authStatus", method: "GET", pattern: /^\/api\/auth\/status$/, tier: "public", run: authStatus },
  { name: "signinQuotes", method: "GET", pattern: /^\/api\/signin-quotes$/, tier: "public", run: signinQuotesRoute },
  { name: "staffMe", method: "GET", pattern: /^\/api\/staff\/me$/, tier: "director", run: staffMe },
  { name: "staffForms", method: "GET", pattern: /^\/api\/staff\/forms$/, tier: "director", run: staffForms },
  { name: "staffSubmissions", method: "GET", pattern: /^\/api\/staff\/forms\/([a-z0-9-]{2,40})\/submissions$/, tier: "director", run: staffSubmissions },
  { name: "staffRetry", method: "POST", pattern: /^\/api\/staff\/outbox\/retry$/, tier: "director", run: staffRetry },
  { name: "editSource", method: "GET", pattern: /^\/api\/staff\/edit\/source$/, tier: "director", run: editSourceRoute },
  { name: "editHistory", method: "GET", pattern: /^\/api\/staff\/edit\/history$/, tier: "director", run: editHistoryRoute },
  { name: "editSave", method: "POST", pattern: /^\/api\/staff\/edit\/save$/, tier: "director", run: editSave },
  { name: "editsFile", method: "GET", pattern: /^\/api\/staff\/edits$/, tier: "director", run: editsFileRoute },
  { name: "refresh", method: "POST", pattern: /^\/api\/staff\/refresh$/, tier: "director", run: refreshRoute },
  { name: "staffAny", method: "*", pattern: /^\/api\/staff(\/.*)?$/, tier: "director", run: async () => { throw new HttpError(404, "not.found"); } },
];

for (const r of ROUTES) if (!TIERS.has(r.tier)) throw new Error(`route ${r.name} declares no tier`);

/* What a person reads when signing in goes wrong, by error code. */
const AUTH_WHY = { "auth.unavailable": "unavailable", "auth.state": "state", "auth.expired": "expired", "auth.unreachable": "unreachable", "auth.refused": "refused", "rate.limited": "rateLimited" };

function errorReply(req, status, code, extra = {}, headers = {}) {
  const { pathname } = new URL(req.url);
  if (wantsJson(req) || pathname.startsWith("/api/staff") || pathname.startsWith("/api/events/") || /^\/api\/forms\/[^/]+\/files$/.test(pathname)) return json(status, { ok: false, error: code, ...extra }, headers);
  if (pathname.startsWith("/api/calendar/") && status === 404) {
    return page(status, { id: "pg-calendar-gone", path: "/", titleKey: "calendar.gone.title" }, (ctx) => html`<section class="band" aria-labelledby="cal-h"><div class="wrap">
  <h1 id="cal-h">${ctx.t("calendar.gone.title")}</h1>
  <p>${ctx.t("calendar.gone.body")}</p>
  <p><a href="/">${ctx.t("calendar.gone.back")}</a></p>
</div></section>`);
  }
  if (pathname.startsWith("/api/auth/")) {
    const why = AUTH_WHY[code] || "failed";
    // Back to the staff page, still carrying the page Sign in was to come back to.
    const onward = pathname === "/api/auth/start" ? returnPath(new URL(req.url).searchParams.get("return")) : "/staff/";
    const back = onward === "/staff/" ? "/staff/" : `/staff/?return=${encodeURIComponent(onward)}`;
    return page(status, { id: "pg-auth", path: "/staff/", titleKey: "auth.error.title" }, (ctx) => html`<section class="band" aria-labelledby="auth-h"><div class="wrap">
  <h1 id="auth-h">${ctx.t("auth.error.title")}</h1>
  <p>${ctx.t(`auth.error.${why}`)}</p>
  <p><a href="${back}">${ctx.t("auth.error.back")}</a></p>
</div></section>`);
  }
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
    const who = route.tier === "director" ? await requireDirector(req) : null;
    return await route.run(req, pathname.match(route.pattern).slice(1), context, who);
  } catch (e) {
    if (e instanceof HttpError) {
      const reply = errorReply(req, e.status, e.code, e.extra, e.headers);
      for (const [k, v] of Object.entries(e.headers || {})) reply.headers.set(k, v);
      return reply;
    }
    if (e?.code === "config.missing") return errorReply(req, 503, "config.missing");
    console.error(`api ${route.name}:`, e);
    return errorReply(req, 500, "server.error");
  }
}
