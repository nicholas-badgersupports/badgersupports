/* The per-program requesting switch (owner, 23 Nov 2026): one saved row per program that has
 * been switched off, in program_state (migration 012). No row means the program takes requests,
 * which is every program's state until a director switches it off, so the site behaves as it did
 * before the switch existed. The pages function reads the rows at every draw (pages.mjs), as it
 * reads a form's switch, so a switch takes hold as soon as its pages are cleared from the CDN. */
import { q, many } from "./db.mjs";
import { REQUEST_PROGRAMS, programByKey } from "../../src/shared/programs.mjs";

export async function programRows() {
  return many("SELECT program_key, state, changed_by, changed_at FROM program_state");
}

/* The keys of the programs switched off now. Throws when the store cannot be read; callers that
 * draw for visitors catch it and draw every program as on, as formsNow does for a form's switch. */
export async function programsOff() {
  const rows = await programRows();
  return new Set(rows.filter((r) => r.state === "off").map((r) => r.program_key));
}

/* Every program, in the order the staff page lists them, with its switch as it stands. */
export async function programsForStaff() {
  const off = await programsOff();
  return REQUEST_PROGRAMS.map((p) => ({ key: p.key, name: p.name, requesting: !off.has(p.key) }));
}

export async function setProgramState(key, state, by) {
  if (!programByKey(key)) return false;
  await q(
    `INSERT INTO program_state (program_key, state, changed_by, changed_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (program_key) DO UPDATE SET state = EXCLUDED.state, changed_by = EXCLUDED.changed_by, changed_at = now()`,
    [key, state, by || null],
  );
  return true;
}
