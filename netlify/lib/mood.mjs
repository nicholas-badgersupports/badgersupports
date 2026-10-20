/* The mood check-in: one tap adds one to today's count for that mood. Nothing records who
   tapped, and nothing here is sent to analytics. */

import crypto from "node:crypto";
import { q, many } from "./db.mjs";
import { serverContent } from "./content.mjs";
import { HttpError } from "./http.mjs";
import { chicagoDate } from "../../src/render/context.mjs";

export async function moodCounts(day) {
  const cfg = serverContent().mood;
  const rows = await many("SELECT mood, n FROM mood_daily WHERE day = $1", [day]);
  const by = Object.fromEntries(rows.map((r) => [r.mood, Number(r.n)]));
  const counts = cfg.moods.map((m) => ({ id: m.id, label: m.label, n: by[m.id] || 0 }));
  return { counts, total: counts.reduce((s, c) => s + c.n, 0) };
}

export async function recordMood(id, now = new Date()) {
  const cfg = serverContent().mood;
  const mood = cfg.moods.find((m) => m.id === id);
  if (!mood) throw new HttpError(400, "mood.unknown");
  const day = chicagoDate(now);
  await q(`INSERT INTO mood_daily (day, mood, n) VALUES ($1, $2, 1)
           ON CONFLICT (day, mood) DO UPDATE SET n = mood_daily.n + 1`, [day, id]);
  const message = mood.messages[crypto.randomInt(mood.messages.length)];
  return { ok: true, mood: id, message, after: cfg.after, ...(await moodCounts(day)) };
}
