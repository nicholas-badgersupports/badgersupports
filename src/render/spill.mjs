/* The Badger SPILL logo, as one picture. Badger SPILL is a Badger Supports program (its logo says
 * so), and the owner asked on 20 Oct 2026 for it to show on this site — in the homepage hero and
 * elsewhere — as its own logo, moving the way it moves on badgerspill.org. src/client/spill-logo.js
 * finds this picture by its address and sets it moving; without that file it is a still picture.
 *
 * Its alt is empty, always: the words beside it say what it is and where the link goes, and the
 * motion recognises the logo by the empty alt (as Badger SPILL's own does). Every page that shows it
 * loads spill-logo.js, so a block or the footer that calls this names that file. */

import { html } from "./html.mjs";

export const SPILL_CLIENT = "spill-logo.js";
const SRC = (w) => `/assets/brand/spill-logo-wide-${w}.webp`;

/* cls: the class on the picture (it becomes the class of the moving logo). sizes: its width on the page. */
export function spillLogo(cls, sizes, { eager = false } = {}) {
  return html`<img class="${["spill-logo", cls].filter(Boolean).join(" ")}" src="${SRC(480)}" srcset="${SRC(240)} 240w, ${SRC(480)} 480w, ${SRC(720)} 720w" sizes="${sizes}" width="240" height="164" alt="" decoding="async" loading="${eager ? "eager" : "lazy"}">`;
}
