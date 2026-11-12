/* Section navigation: the segmented, icon-led bar that moves a visitor between the sections of
 * one page — a room's route, its next sessions and its access notes, or the rooms index's hubs
 * and room list. One component, so every in-page jump looks and behaves the same: a row of
 * segments, each an icon and its words, that scrolls sideways on a phone instead of shrinking
 * its targets below 44px. In a side column (a room page's, beside the content it navigates)
 * the caller asks for the "stack" variant: the same segments standing upright, each whole,
 * where a sideways bar would be wider than the column. Items are plain { href, label, icon }
 * links; the caller resolves the href, so a segment can point at a section anchor or at
 * another page. */
import { html } from "./html.mjs";
import { icon } from "./icons.mjs";

export function sectionNav(ctx, label, items, variant) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "";
  return html`<nav class="${variant ? `secnav secnav--${variant}` : "secnav"}" aria-label=${label}><ul>${list.map((it) => html`<li><a class="secnav-item" href=${it.href}>${icon(it.icon || "arrow", "secnav-ic")}<span>${it.label}</span></a></li>`)}</ul></nav>`;
}
