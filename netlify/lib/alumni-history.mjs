import { noteGet } from "./published.mjs";
import { publicHistory, emptyHistory } from "../../src/shared/alumni-history.mjs";

export async function alumniNow(config) {
  if (config?.enabled !== true) return { value: emptyHistory(), state: "disabled", stale: false, unavailable: false };
  try {
    const record = await noteGet("public-alumni-history");
    if (!record) return { value: emptyHistory(), state: "empty", stale: false, unavailable: false };
    const value = publicHistory(record);
    return { value, state: value.groups.some(g => g.people.length) ? "ready" : "empty", stale: false, unavailable: false };
  } catch {
    return { value: emptyHistory(), state: "unavailable", stale: true, unavailable: true };
  }
}
