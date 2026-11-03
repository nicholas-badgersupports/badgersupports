/* Validate/prepare a private approved display subset locally. This command never reads Drive or writes live storage. */
import fs from "node:fs";
import path from "node:path";
import { isDirect } from "./direct.mjs";
import { prepareHistory } from "../src/shared/alumni-history.mjs";
import { finish } from "./finish.mjs";

if (isDirect(import.meta.url)) {
  try {
    const args = process.argv.slice(2), source = args.find(a => !a.startsWith("--"));
    if (!source || args.some(a => a.startsWith("--") && !a.startsWith("--out="))) throw new Error("Use: node ops/alumni-history.mjs private-reviewed.json [--out=private-display.json]");
    const { result, included, excluded } = prepareHistory(JSON.parse(fs.readFileSync(source, "utf8")));
    const out = args.find(a => a.startsWith("--out="))?.slice(6);
    if (out) {
      const destination = path.join(fs.realpathSync(path.dirname(path.resolve(out))), path.basename(out));
      let parent = path.dirname(destination);
      for (;;) {
        if (fs.existsSync(path.join(parent, ".git"))) throw new Error("Keep prepared display data outside source repositories.");
        const next = path.dirname(parent); if (next === parent) break; parent = next;
      }
      fs.writeFileSync(destination, JSON.stringify(result, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    }
    console.log(`alumni history: ${included} included, ${excluded} excluded; valid display subset; ${out ? "private local output written" : "no output written"}; no live change`);
    finish(0);
  } catch (e) {
    console.error(`alumni history: validation failed${e.at ? ` at ${e.at}` : ""}${e.code ? ` (${e.code})` : ""}. No live change.`);
    finish(1);
  }
}
