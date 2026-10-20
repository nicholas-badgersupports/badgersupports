/* The icon set. Every icon is drawn here on a 24-unit grid, in strokes, and each part of an icon
 * is its own element so it can move by itself: the pin drops and bounces, the envelope's flap
 * opens, the scissors snip, the calendar's page flips. The moves are in src/styles/motion.css;
 * src/client/site.js plays an icon's move when its link is pointed at or pressed (as Badger SPILL
 * does with its own icons), and nothing moves for anyone who asks for less motion.
 *
 * The hand is the organisation's own mark, not a drawing: the brand file itself, heart and all.
 * "hand" is the red hand with its white heart, for cream and white grounds; "hand-cream" is the
 * cream hand with its red heart, for red grounds.
 *
 * An icon is always decoration beside words that already say where a link goes, so every icon is
 * aria-hidden and none has a label of its own.
 */

import { html, raw } from "./html.mjs";

const PARTS = {
  arrow: `<path d="M4.5 12h14"/><path d="m13 6 6 6-6 6"/>`,
  back: `<path d="M19.5 12h-14"/><path d="m11 6-6 6 6 6"/>`,
  down: `<path d="M12 4.5v14"/><path d="m6 13 6 6 6-6"/>`,
  out: `<path d="M13.5 4.5h6v6"/><path d="m19.5 4.5-8 8"/><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>`,
  pin: `<path d="M12 21.5s-7-6-7-11.5a7 7 0 0 1 14 0c0 5.5-7 11.5-7 11.5Z"/><circle cx="12" cy="10" r="2.4"/>`,
  mail: `<rect x="3.5" y="6" width="17" height="12.5" rx="1.2"/><path d="m3.8 6.6 8.2 6.4 8.2-6.4"/>`,
  calendar: `<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10.5h16"/><path d="M8.5 3.5v4M15.5 3.5v4"/>`,
  chat: `<path d="M3.5 4.5h11v8.5H9l-3.2 3v-3H3.5z"/><path d="M14.5 8.5h6v8.5h-2.3v3l-3.2-3H11v-2"/>`,
  scissors: `<g><circle cx="6.5" cy="18" r="2.6"/><path d="M8.4 16.2 19.5 4"/></g><g><circle cx="17.5" cy="18" r="2.6"/><path d="M15.6 16.2 4.5 4"/></g>`,
  bulb: `<path d="M9.2 17.5h5.6M10.2 20.5h3.6"/><path d="M12 4a5.5 5.5 0 0 0-3.3 9.9c.5.4.8 1 .8 1.7v.4h5v-.4c0-.7.3-1.3.8-1.7A5.5 5.5 0 0 0 12 4Z"/><path d="M12 1v0.6M3.4 9.5h.8M19.8 9.5h.8M5.5 3.5l.6.6M18.5 3.5l-.6.6"/>`,
  badge: `<path d="M8 2.5l4 6 4-6"/><rect x="5.5" y="8.5" width="13" height="13" rx="1.5"/><circle cx="12" cy="13.5" r="2"/><path d="M9.3 18h5.4"/>`,
  question: `<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.9.8-.9 1.4v.5"/><path d="M12 16.9v.1"/>`,
  plus: `<path d="M12 5v14"/><path d="M5 12h14"/>`,
  star: `<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  play: `<path d="M8.5 5.2v13.6L19 12z"/>`,
  pause: `<path d="M9 5.5v13M15 5.5v13"/>`,
  jar: `<path d="M8 3.5h8v3H8z"/><path d="M8.5 6.5c-2 1.2-3 3-3 5.5v6a2.5 2.5 0 0 0 2.5 2.5h8a2.5 2.5 0 0 0 2.5-2.5v-6c0-2.5-1-4.3-3-5.5"/><path d="M10.5 12.3a1.5 1.5 0 1 1 2 1.4c-.5.2-.5.6-.5 1.1"/><path d="M12 17.3v.1"/>`,
  pencil: `<path d="M15.5 4.5l4 4L9 19l-5 1 1-5z"/><path d="M13.5 6.5l4 4"/>`,
  ribbon: `<path d="M9.5 21 15 10.5c.9-1.8 1-3 .5-4.2a3.6 3.6 0 0 0-7 0c-.5 1.2-.4 2.4.5 4.2L14.5 21"/>`,
};

/* the two brand files that carry the heart, by the ground they sit on (Connect's brand rule) */
const HANDS = { hand: "/assets/brand/bss-hand-red.png", "hand-cream": "/assets/brand/bss-hand-cream.png" };

export const ICONS = [...Object.keys(PARTS), ...Object.keys(HANDS)];

/* name: one of ICONS. cls: extra classes for the wrapper. */
export function icon(name, cls = "") {
  if (HANDS[name]) return html`<img class="${["ic ic-hand", cls].filter(Boolean).join(" ")}" data-i="hand" src="${HANDS[name]}" width="301" height="440" alt="" aria-hidden="true">`;
  const parts = PARTS[name];
  if (!parts) throw new Error(`no icon "${name}"`);
  return html`<svg class="${["ic", cls].filter(Boolean).join(" ")}" data-i="${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(parts)}</svg>`;
}
