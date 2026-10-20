/* The page's words for browser modules: the keys they need, sent by the build in a JSON island
   (src/shared/text.mjs CLIENT_TEXT). A missing key shows nothing rather than the key's name. */

const island = document.getElementById("bss-text");
const table = island ? JSON.parse(island.textContent) : {};

export const t = (key, vars = {}) => String(table[key] ?? "").replace(/\{\{(\w+)\}\}/g, (m, v) => (v in vars ? String(vars[v]) : m));
