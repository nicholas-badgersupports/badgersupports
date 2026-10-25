/* Connect's public lists, read at build time: the events a director made public and the resources a
 * director approved. The production build reads these in place of the hand-typed fixtures, so the
 * published site shows what Connect holds on the day it was built.
 *
 * Two signed calls (netlify/lib/connect.mjs, the same signature the forms use):
 *   publicEvents          { events, weekly } from today to 56 days ahead, and `recent`, the last few that
 *                         have ended, once Connect sends it (Exchange PUBLIC-EVENTS-RECENT-2026-10-23)
 *   publicResourceExport  { resources, sourceUpdatedAt }
 * Connect sends only what a director ticked in Admin › Resources › Public Website List, and never a
 * description, a contact, who an event is for, volunteers or sign-ups.
 *
 * Configuration is environment only, as for the forms:
 *   CONNECT_URL, PUBLIC_SITE_SERVICE_KEY_ID, PUBLIC_SITE_SERVICE_SECRET (32 characters or more)
 * The sign-in secret is not needed here.
 *
 * How an event becomes a row on this site is content/connect-feed.json: its type names the program,
 * words in its title name a series (a page's own events, such as Dogs on Call), and words in its
 * room name one of content/places. Every public event is something people attend (owner, 20 Oct
 * 2026), so every one is a drop-in. Connect's `full` is left out: sign-ups are the team's, so a full
 * event is one with enough volunteers, which says nothing to someone deciding whether to come.
 */

import fs from "node:fs";
import path from "node:path";
import { call, serviceConfig } from "../netlify/lib/connect.mjs";
import { addDays } from "../src/render/events.mjs";

export const FEED_SCHEMA = "bss.connect-feed/1";
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// An event id becomes a file name (`calendar/connect-<id>.ics`) and a calendar UID, so it must fit the live
// calendar route, /api/calendar/[A-Za-z0-9_-]{1,120}.ics, after the 8 characters of "connect-".
const EVENT_ID = /^[A-Za-z0-9_-]{1,112}$/;
// The longest run an event's endDate is believed for; past it the event shows on its first day only.
export const LONGEST_DAYS = 14;

/* A build run on the laptop never gets the key as Netlify holds it: Netlify hands it a short stand-in for every
   secret, and that stand-in wins over a variable of the same name (measured 23 Oct 2026). So the owner's publish
   file passes the key as PUBLISH_SERVICE_SECRET, a name Netlify does not hold, and it wins here. */
const buildEnv = (env) => (env.PUBLISH_SERVICE_SECRET ? { ...env, PUBLIC_SITE_SERVICE_SECRET: env.PUBLISH_SERVICE_SECRET } : env);

/* Connect's address and key from the environment, or null when any is missing. */
export const feedConfig = (env = process.env) => serviceConfig(buildEnv(env));

/* Which of the three serviceConfig needs is missing or malformed, by name only: a value is never shown. */
export function feedConfigGaps(given = process.env) {
  const env = buildEnv(given);
  const out = [];
  const url = String(env.CONNECT_URL || "");
  if (!/^https?:\/\/[^\s/]+$/.test(url.replace(/\/+$/, ""))) out.push(url ? "CONNECT_URL is not an address such as https://connect.example.org" : "CONNECT_URL is missing");
  if (!env.PUBLIC_SITE_SERVICE_KEY_ID) out.push("PUBLIC_SITE_SERVICE_KEY_ID is missing");
  const secret = String(env.PUBLIC_SITE_SERVICE_SECRET || "");
  const hint = given.PUBLISH_SERVICE_SECRET ? "" : " (on the laptop the publish file passes it as PUBLISH_SERVICE_SECRET)";
  if (secret.length < 32) out.push(`PUBLIC_SITE_SERVICE_SECRET is ${secret ? "shorter than 32 characters" : "missing"}${hint}`);
  return out;
}

export function readFeedRules(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "content/connect-feed.json"), "utf8"));
}

/* What is wrong with the rules file, as sentences. */
export function feedRuleProblems(rules, places) {
  const out = [];
  if (rules?.schema !== FEED_SCHEMA) return [`schema is ${FEED_SCHEMA}`];
  for (const [type, t] of Object.entries(rules.types || {})) if (!["peer", "craft", "workshops", "other"].includes(t?.program)) out.push(`types.${type}: program is peer, craft, workshops or other`);
  const ids = new Set();
  for (const s of rules.series || []) {
    if (!/^[a-z0-9-]+$/.test(s?.id || "") || ids.has(s.id)) out.push(`series: each has its own id, in lower case`);
    ids.add(s?.id);
    if (!s?.words?.length) out.push(`series ${s?.id}: needs words to match in an event's title`);
  }
  if (rules.weekly?.place && !places[rules.weekly.place]) out.push(`weekly.place "${rules.weekly.place}" is not a room in content/places/`);
  for (const r of rules.rooms || []) if (!places[r?.place]) out.push(`rooms: "${r?.place}" is not a room in content/places/`);
  return out;
}

export const seriesIds = (rules) => (rules.series || []).map((s) => s.id);

/* Lower case, accents off, anything not a letter or digit a single space. */
export const words = (s) => ` ${String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/* The room the words name, by the longest phrase found whole in them, or null. */
export function roomFor(rules, room) {
  const w = words(room);
  let best = null;
  for (const r of rules.rooms || []) for (const phrase of r.words || []) {
    const p = words(phrase);
    if (p.trim() && w.includes(p) && (!best || p.length > best.len)) best = { place: r.place, len: p.length };
  }
  return best?.place || null;
}

function seriesFor(rules, title) {
  const w = words(title);
  return (rules.series || []).find((s) => (s.words || []).some((p) => w.includes(words(p)))) || null;
}

/* Connect's two lists as the site's event source (src/render/events.mjs): recurring rows from the
   weekly groups, dated rows from the events. Words that name no room become a place of their own,
   shown unlinked. Returns { events, dropped }, `dropped` naming each event left out and why. */
export function mapEvents(reply, rules) {
  const recurring = [];
  const dated = [];
  const dropped = [];
  const rooms = {};
  const placeFor = (room, fallback) => {
    const id = roomFor(rules, room);
    if (id) return id;
    const text = String(room || "").trim();
    if (!text) return fallback || null;
    const key = `connect-room:${words(text).trim().replace(/ /g, "-")}`;
    rooms[key] = { name: text.slice(0, 120), detail: "", href: null };
    return key;
  };
  const wk = rules.weekly || {};
  for (const w of reply.weekly || []) {
    if (!Number.isInteger(w?.weekday) || w.weekday < 0 || w.weekday > 6 || !HM.test(w.start || "")) { dropped.push(`weekly ${w?.id || "?"}: no weekday or start time`); continue; }
    recurring.push({
      id: `connect-weekly-${w.id}`, program: wk.program || "peer", title: wk.title || w.title || "Peer support group",
      weekday: w.weekday, start: w.start, ...(HM.test(w.end || "") ? { end: w.end } : {}),
      place: placeFor(w.room, wk.place), signup: "none",
      ...(w.from ? { from: w.from } : {}), ...(w.until ? { until: w.until } : {}), ...(w.skip?.length ? { skip: w.skip } : {}),
      ...(wk.href ? { href: wk.href } : {}),
    });
  }
  // `recent` is the last few public events that have ended, newest first, for a page's "Recent" list
  // (Exchange PUBLIC-EVENTS-RECENT-2026-10-23). A Connect that does not send it leaves those lists empty.
  const seen = new Set();
  const recent = (Array.isArray(reply.recent) ? reply.recent : []).map((e) => ({ e, past: true }));
  for (const { e, past } of [...(reply.events || []).map((e) => ({ e, past: false })), ...recent]) {
    if (!e?.id || !e.title || !DAY.test(e.date || "")) { dropped.push(`event ${e?.id || "?"}: no id, title or date`); continue; }
    if (!EVENT_ID.test(String(e.id))) { dropped.push(`event ${JSON.stringify(String(e.id).slice(0, 40))} (${e.date}): id is not letters, digits, - or _`); continue; }
    if (seen.has(e.id)) { dropped.push(`event ${e.id} (${e.date}): listed twice`); continue; }
    if (past && DAY.test(reply.today || "") && e.date >= reply.today) { dropped.push(`event ${e.id} (${e.date}): listed as recent but not before today`); continue; }
    // The last day of an event that runs over several days. An end before the start, or more than LONGEST_DAYS
    // on, is not believed: the event shows on its first day and the build names it.
    let endDate = null;
    if (DAY.test(e.endDate || "") && e.endDate > e.date) {
      if (e.endDate <= addDays(e.date, LONGEST_DAYS)) endDate = e.endDate;
      else dropped.push(`event ${e.id} (${e.date}): end date ${e.endDate} is more than ${LONGEST_DAYS} days on, so it shows on its first day only`);
    } else if (DAY.test(e.endDate || "") && e.endDate < e.date) dropped.push(`event ${e.id} (${e.date}): end date ${e.endDate} is before it starts, so it shows on its first day only`);
    if (past && DAY.test(reply.today || "") && (endDate || e.date) >= reply.today) { dropped.push(`event ${e.id} (${e.date}): listed as recent but not over before today`); continue; }
    seen.add(e.id);
    // A row needs a start time to sit in the timetable; an event saved without one is left out.
    if (!HM.test(e.start || "")) { dropped.push(`event ${e.id} (${e.date}): no start time`); continue; }
    const t = rules.types?.[e.type] || { program: rules.otherProgram || "other" };
    const s = seriesFor(rules, e.title);
    const href = s?.href || t.href || null;
    dated.push({
      id: `connect-${e.id}`, program: s?.program || t.program, ...(s ? { series: s.id } : {}),
      title: String(e.title).slice(0, 160), short: String(e.short || e.title).slice(0, 160),
      date: e.date, ...(endDate ? { endDate } : {}), start: e.start, ...(HM.test(e.end || "") ? { end: e.end } : {}),
      place: placeFor(e.room, null), signup: "none", ...(href ? { href } : {}),
    });
  }
  return { events: { schema: "bss.events-fixture/1", fixture: false, source: "connect", timezone: reply.tz || "America/Chicago", recurring, dated, rooms }, dropped };
}

/* Connect's approved resources, in the fixture's shape (Connect projects them as the fixture does). */
export function mapResources(reply) {
  const resources = Array.isArray(reply.resources) ? reply.resources.filter((r) => r && r.id && r.name) : [];
  return { schema: "bss.resources-fixture/1", fixture: false, source: "connect", sourceUpdatedAt: reply.sourceUpdatedAt || null, resources };
}

/* Both lists, or a problem saying why not. Never throws. */
export async function readConnectFeed(cfg, rules, env = process.env) {
  if (!cfg) return { problem: `Connect is not set up for this build (${feedConfigGaps(env).join("; ") || "no Connect address and key were given"}): CONNECT_URL, PUBLIC_SITE_SERVICE_KEY_ID and PUBLIC_SITE_SERVICE_SECRET are needed in the build's environment` };
  try {
    const ev = await call(cfg, { action: "publicEvents" });
    const res = await call(cfg, { action: "publicResourceExport" });
    if (ev.schema !== 1 || !Array.isArray(ev.events) || !Array.isArray(ev.weekly)) return { problem: "Connect's event list was not in the shape this site reads (schema 1)" };
    if (res.schema !== 1 || !Array.isArray(res.resources)) return { problem: "Connect's resource list was not in the shape this site reads (schema 1)" };
    const { events, dropped } = mapEvents(ev, rules);
    return { events, resources: mapResources(res), dropped, version: { events: ev.version || null, resources: res.catalogVersion || null }, today: ev.today || null };
  } catch (e) {
    return { problem: `Connect could not be read (${e.code || "error"}): ${e.message}` };
  }
}
