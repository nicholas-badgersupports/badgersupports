import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function isDirect(meta, entry = process.argv[1]) {
  if (!entry) return false;
  try { return fs.realpathSync(fileURLToPath(meta)) === fs.realpathSync(entry); }
  catch { return false; }
}
