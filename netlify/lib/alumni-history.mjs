/* Alumni history on a page draw. With Connect set up, its signed publicAlumniHistory is the source, read on every draw
   and never cached, so a removal in Connect shows on the next request. Its reply passes the same publicHistory check a
   local record does. A failed or invalid read shows the unavailable state, never an older roster. Without Connect (the
   local rig, the tests), the approved record in the publication store is read instead. */
import { noteGet } from "./published.mjs";
import { call, serviceConfigNow } from "./connect.mjs";
import { publicHistory, emptyHistory, ALUMNI_SCHEMA } from "../../src/shared/alumni-history.mjs";

async function fromConnect(cfg) {
  const reply = await call(cfg, { action: "publicAlumniHistory" });
  if (reply.schema !== ALUMNI_SCHEMA || !Array.isArray(reply.groups)) throw Object.assign(new Error("Unexpected alumni history"), { code: "connect.bad-reply" });
  // Before the first save Connect answers groups:[] with no approval or revision: nothing is published yet.
  return reply.approved === undefined && !reply.groups.length ? null : reply;
}

export async function alumniNow(config) {
  if (config?.enabled !== true) return { value: emptyHistory(), state: "disabled", stale: false, unavailable: false };
  try {
    const cfg = serviceConfigNow();
    const record = cfg ? await fromConnect(cfg) : await noteGet("public-alumni-history");
    if (!record) return { value: emptyHistory(), state: "empty", stale: false, unavailable: false };
    const value = publicHistory(record);
    return { value, state: value.groups.some(g => g.people.length) ? "ready" : "empty", stale: false, unavailable: false };
  } catch (e) {
    console.error(`public content: alumni history could not be read (${e.code || "error"})`);
    return { value: emptyHistory(), state: "unavailable", stale: true, unavailable: true };
  }
}
