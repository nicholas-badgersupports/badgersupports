/* The page's words for browser modules: the keys they need, sent by the build in a JSON island
   (src/shared/text.mjs CLIENT_TEXT). A missing key shows nothing rather than the key's name. */

/* Outside a browser (the suites import the modules that import this) there is no island and
   every word is missing, which is this module's answer for a missing key anyway. */
const island = typeof document === "undefined" ? null : document.getElementById("bss-text");
const table = island ? JSON.parse(island.textContent) : {};

export const t = (key, vars = {}) => String(table[key] ?? "").replace(/\{\{(\w+)\}\}/g, (m, v) => (v in vars ? String(vars[v]) : m));
