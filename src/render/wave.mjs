/* Not rendered since 23 October 2026: the wave is Badger SPILL's own mark, and the brand guide
 * keeps SPILL's identity to where SPILL is named. Kept so putting it back is one call per block
 * (pagehead, eventhero, program) plus the .has-wave rules in blocks.css as they stood on 23 Oct.
 *
 * The soft double wave along the foot of a page's heading band: the band's colour over a lighter
 * mix of it, like milk lapping. Badger SPILL's own wave (badger-spill site/assets/js/lib/waves.js),
 * drawn the same way so the two sites open their inner pages alike: an information page's heading
 * stands on a band of its colour with two waves at its foot, and the homepage has none.
 *
 * Stretched to the width of the band. Its colours come from CSS (blocks.css, the heading bands):
 * --wave-band for the band, --wave-under for the ground below it. Decoration only, so it is hidden
 * from screen readers and takes no focus. */

import { raw } from "./html.mjs";

const WAVES = [
  ["wave-back", "M0 0H400V22C366 12 334 12 300 22S234 32 200 22S134 12 100 22S34 32 0 22Z"],
  ["wave-fill", "M0 0H400V16C366 26 334 26 300 16S234 6 200 16S134 26 100 16S34 6 0 16Z"],
];

export const wave = () =>
  raw(`<svg class="wave" viewBox="0 0 400 34" preserveAspectRatio="none" aria-hidden="true" focusable="false">${WAVES.map(([cls, d]) => `<path class="${cls}" d="${d}"/>`).join("")}</svg>`);
