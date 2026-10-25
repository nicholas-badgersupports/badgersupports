/* The directors' backup workbook (owner, 24 Oct 2026: "a backup styled spreadsheet in the directors account that
 * has all of the forms answers, one tab for each form, as well as a dashboard and a landing page").
 *
 *   Start Here   what the file is, who may open it, and when it was last written
 *   Dashboard    one line per form: open or closed, answers in all, in 7 and 30 days, the latest, and how many
 *                wait for or failed to reach Connect. Counts only, never an answer
 *   one per form Reference, Received, Version, then a column per question, each cell through cellText()
 *
 * The outbox's sheets.backup rows (deliver.mjs) are written here, out of the request path. A row is written
 * only if its reference is not in its tab already, and turns `sent` only once it is there. Tabs are found by
 * developer metadata, so a renamed tab is still found. Columns keep their place: a question added later
 * goes at the end.
 *
 * Confidential answers are left out (docs/COMMUNICATIONS.md) unless BACKUP_CONFIDENTIAL=include: the owner's
 * words were "all of the forms answers", so this is a question for the owner, with this as the default.
 *
 * Nothing here has called Google. The Sheets client is a seam: the tests give a fake; deployed it is
 * googleSheets() below, which needs the owner's service account and the workbook shared with it (owner actions).
 */

import crypto from "node:crypto";
import { many } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { answerColumns, cellText } from "../../src/shared/forms.mjs";
import { makeT } from "../../src/shared/text.mjs";

const META = "bss.backup";
/* The brand's own colours (src/styles/tokens.css): cream and ink for the header, red for the title. No
   coloured edge on anything (owner, 24 Oct 2026). */
const rgb = (hex) => ({ red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 });
export const COLOURS = { cream: rgb("#F2EBE1"), ink: rgb("#393737"), red: rgb("#B60000"), paper: rgb("#FFFFFF"), band: rgb("#FAF7F2") };

let injected = null;
/* Tests install a fake: { spreadsheetId, sheets }. */
export function useBackup(b) { injected = b; }

/* The workbook and its client, or null while it is not set up. */
export function backupConfig(env = process.env) {
  if (injected) return injected;
  if (!env.BACKUP_SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT) return null;
  let account;
  try { account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT); } catch { return null; }
  return { spreadsheetId: env.BACKUP_SPREADSHEET_ID, sheets: googleSheets({ account }) };
}

export const includeConfidential = (env = process.env) => env.BACKUP_CONFIDENTIAL === "include";

/* Every column a form has had, across its shipped and published versions, in the order first seen. */
export async function columnsFor(key) {
  const defs = [serverContent().forms[key], ...(await many("SELECT definition FROM form_versions WHERE form_key = $1 ORDER BY version", [key])).map((r) => r.definition)].filter(Boolean);
  const seen = new Map();
  for (const def of defs) for (const c of answerColumns(def)) if (!seen.has(c.id)) seen.set(c.id, { ...c, def });
  return [...seen.values()].filter((c) => includeConfidential() || !c.confidential);
}

const when = (d) => new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC";

/* What each tab holds. Pure apart from reading the forms' versions and today's counts. */
export async function workbookPlan({ now = new Date() } = {}) {
  const c = serverContent();
  const t = makeT(c.text);
  const forms = Object.values(c.forms).sort((a, b) => a.title.localeCompare(b.title));
  const counts = Object.fromEntries((await many(
    `SELECT form_key, count(*)::int AS total,
            count(*) FILTER (WHERE received_at > now() - interval '7 days')::int AS week,
            count(*) FILTER (WHERE received_at > now() - interval '30 days')::int AS month,
            max(received_at) AS latest
       FROM submissions WHERE status <> 'spam' GROUP BY form_key`)).map((r) => [r.form_key, r]));
  const delivery = Object.fromEntries((await many(
    `SELECT s.form_key, count(*) FILTER (WHERE o.state = 'pending')::int AS waiting, count(*) FILTER (WHERE o.state = 'failed')::int AS failed
       FROM outbox o JOIN submissions s ON s.id = o.submission_id WHERE o.kind = 'connect.ingest' GROUP BY s.form_key`)).map((r) => [r.form_key, r]));
  const state = Object.fromEntries((await many("SELECT form_key, state FROM form_state")).map((r) => [r.form_key, r.state]));
  const start = [
    [t("backup.start.title")],
    [t("backup.start.what")],
    [t("backup.start.who")],
    ...(includeConfidential() ? [] : [[t("backup.start.confidential")]]),
    [t("backup.start.updated", { when: when(now) })],
    [""],
    [t("backup.start.forms")],
    ...forms.map((f) => [f.title]),
  ];
  const dashboard = [
    ["form", "state", "total", "week", "month", "latest", "waiting", "failed"].map((k) => t(`backup.col.${k}`)),
    ...forms.map((f) => {
      const n = counts[f.key] || {}, d = delivery[f.key] || {};
      return [f.title, (state[f.key] || f.state) === "open" ? t("backup.open") : t("backup.closed"), n.total || 0, n.week || 0, n.month || 0, n.latest ? when(n.latest) : "", d.waiting || 0, d.failed || 0];
    }),
  ];
  return { start, dashboard, forms };
}

/* Requests that add a tab, tagged so it is found again whatever it is called, with its header styled. */
function addTab(title, tag, sheetId, { header = true } = {}) {
  return [
    { addSheet: { properties: { sheetId, title, gridProperties: { frozenRowCount: header ? 1 : 0 } } } },
    { createDeveloperMetadata: { developerMetadata: { metadataKey: META, metadataValue: tag, location: { sheetId }, visibility: "DOCUMENT" } } },
    header
      ? { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: COLOURS.cream, textFormat: { bold: true, foregroundColor: COLOURS.ink } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } }
      : { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 18, foregroundColor: COLOURS.red } } }, fields: "userEnteredFormat(textFormat)" } },
    ...(header ? [{ addBanding: { bandedRange: { range: { sheetId, startRowIndex: 0 }, rowProperties: { headerColor: COLOURS.cream, firstBandColor: COLOURS.paper, secondBandColor: COLOURS.band } } } }] : []),
  ];
}

const quoted = (title) => `'${String(title).replace(/'/g, "''")}'`;

/* Write the outbox rows given (deliver.mjs), and the Start Here and Dashboard tabs. Returns the set of
   references now in the workbook, which is what turns a row `sent`. */
export async function writeBackup({ spreadsheetId, sheets }, rows) {
  const meta = await sheets.get(spreadsheetId);
  const tabs = new Map();
  let nextId = 1000;
  for (const s of meta.sheets || []) {
    nextId = Math.max(nextId, (s.properties?.sheetId || 0) + 1);
    const tag = (s.developerMetadata || []).find((m) => m.metadataKey === META)?.metadataValue;
    if (tag) tabs.set(tag, s.properties);
  }
  const plan = await workbookPlan();
  const adds = [];
  const ensure = (tag, title, opts) => {
    if (!tabs.has(tag)) { const sheetId = nextId++; tabs.set(tag, { sheetId, title }); adds.push(...addTab(title, tag, sheetId, opts)); }
    return tabs.get(tag);
  };
  const t = makeT(serverContent().text);
  const startTab = ensure("start", plan.start[0][0], { header: false });
  const dashTab = ensure("dashboard", t("backup.dashboard.title"), {});
  const byForm = new Map();
  for (const r of rows) byForm.set(r.form_key, [...(byForm.get(r.form_key) || []), r]);
  const formTabs = new Map();
  for (const key of byForm.keys()) {
    const def = plan.forms.find((f) => f.key === key);
    formTabs.set(key, ensure(`form:${key}`, (def?.title || key).slice(0, 90), {}));
  }
  if (adds.length) await sheets.batchUpdate(spreadsheetId, adds);

  const present = new Set();
  const after = await sheets.get(spreadsheetId);
  for (const [key, list] of byForm) {
    const tab = formTabs.get(key);
    const existing = (await sheets.valuesGet(spreadsheetId, `${quoted(tab.title)}!A1:ZZ`)).values || [];
    const fixed = [t("backup.col.ref"), t("backup.col.received"), t("backup.col.version")];
    // the columns as they stand (kept as metadata on the tab), with any new question added at the end, so a
    // column never moves under answers already written
    const kept = columnIds(after, tab.sheetId);
    const ids = [...kept];
    const cols = await columnsFor(key);
    for (const c of cols) if (!ids.includes(c.id)) ids.push(c.id);
    const label = new Map(cols.map((c) => [c.id, c.label]));
    await sheets.valuesUpdate(spreadsheetId, `${quoted(tab.title)}!A1`, [[...fixed, ...ids.map((id) => label.get(id) || id)]]);
    if (ids.length !== kept.length) {
      await sheets.batchUpdate(spreadsheetId, [
        ...(kept.length ? [{ deleteDeveloperMetadata: { dataFilter: { developerMetadataLookup: { metadataKey: `${META}.columns`, metadataLocation: { sheetId: tab.sheetId } } } } }] : []),
        { createDeveloperMetadata: { developerMetadata: { metadataKey: `${META}.columns`, metadataValue: JSON.stringify(ids), location: { sheetId: tab.sheetId }, visibility: "DOCUMENT" } } },
      ]);
    }
    const have = new Set(existing.slice(1).map((r) => r[0]));
    for (const ref of have) present.add(ref);
    const def = cols[0]?.def;
    const fresh = list.filter((r) => !have.has(r.ref));
    if (fresh.length) {
      await sheets.valuesAppend(spreadsheetId, `${quoted(tab.title)}!A1`, fresh.map((r) => [r.ref, when(r.received_at), r.form_version, ...ids.map((id) => cellText(cols.find((c) => c.id === id)?.def || def, id, r.answers?.[id]))]));
      for (const r of fresh) present.add(r.ref);
    }
  }
  await sheets.valuesUpdate(spreadsheetId, `${quoted(startTab.title)}!A1`, plan.start);
  await sheets.valuesUpdate(spreadsheetId, `${quoted(dashTab.title)}!A1`, plan.dashboard);
  return present;
}

/* The question ids a tab's columns hold, in order, from its metadata. */
function columnIds(meta, sheetId) {
  const s = (meta.sheets || []).find((x) => x.properties?.sheetId === sheetId);
  const m = (s?.developerMetadata || []).find((x) => x.metadataKey === `${META}.columns`);
  try { return JSON.parse(m?.metadataValue || "[]"); } catch { return []; }
}

/* ------------------------------------------------------------------ Google Sheets, deployed only */

/* A Sheets client for a service account: a token signed here (RS256, node:crypto), then the five calls the
   writer makes. NOT RUN: it needs the owner's service account and the workbook shared with it. */
export function googleSheets({ account, fetch = globalThis.fetch, now = () => Date.now() }) {
  let token = null;
  const b64u = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
  async function bearer() {
    if (token && token.until > now() + 60_000) return token.value;
    const iat = Math.floor(now() / 1000);
    const claim = { iss: account.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 };
    const unsigned = `${b64u({ alg: "RS256", typ: "JWT" })}.${b64u(claim)}`;
    const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url");
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
    const body = await res.json();
    if (!res.ok || !body.access_token) throw Object.assign(new Error("Google refused the service account"), { code: "backup.auth" });
    token = { value: body.access_token, until: now() + (body.expires_in || 3600) * 1000 };
    return token.value;
  }
  const base = "https://sheets.googleapis.com/v4/spreadsheets";
  async function api(path, init = {}) {
    const res = await fetch(`${base}/${path}`, { ...init, headers: { authorization: `Bearer ${await bearer()}`, "content-type": "application/json", ...(init.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(`Sheets answered ${res.status}`), { code: "backup.refused" });
    return body;
  }
  const enc = encodeURIComponent;
  return {
    get: (id) => api(`${enc(id)}?fields=sheets(properties(sheetId,title),developerMetadata)`),
    batchUpdate: (id, requests) => api(`${enc(id)}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) }),
    valuesGet: (id, range) => api(`${enc(id)}/values/${enc(range)}`),
    valuesUpdate: (id, range, values) => api(`${enc(id)}/values/${enc(range)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values }) }),
    valuesAppend: (id, range, values) => api(`${enc(id)}/values/${enc(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values }) }),
  };
}
