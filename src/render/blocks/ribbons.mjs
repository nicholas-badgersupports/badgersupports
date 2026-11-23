/* Color names select reference groups. Plain saved text keeps its own meaning and never
   inherits an association from a former list position. All illustrations are original vectors. */
import { html, raw } from "../html.mjs";
import { icon } from "../icons.mjs";
import { linkProblem } from "../../shared/links.mjs";

const ORDER = ["red","maroon","orange","gold","yellow","bright-green","lime","green","jade","teal","teal-purple","turquoise","light-blue","blue","dark-blue","two-tone-blue","denim","periwinkle","lavender","purple","pink","pink-blue","silver","gray","white","black","parkinsons"];
const ALIASES = new Map(ORDER.map(t => [t.replaceAll("-", " "), t]));

for (const [name,tone] of [["lime green","lime"],["dark green","green"],["teal & purple","teal-purple"],["black / gray","black"],["pink & blue","pink-blue"],["two-tone blue","two-tone-blue"],["blue denim","denim"],["parkinson’s uk","parkinsons"],["parkinson's uk","parkinsons"]]) ALIASES.set(name,tone);

/* Whether a name is one of the tones the artwork can draw. */
export function isRibbonTone(tone) { return ORDER.includes(tone); }

export function ribbonItem(item, meanings) {
  const text = typeof item === "string" ? item : item.text;
  const split = text.indexOf(" — ");
  const color = (split < 0 ? text : text.slice(0,split)).trim();
  const local = split < 0 ? "" : text.slice(split+3).trim();
  const tone = ALIASES.get(color.toLowerCase());
  return { text, local, tone, entry: tone ? meanings?.[tone.replaceAll("-", "_")] : null };
}

export /* One master ribbon, drawn once and recoloured per tone. The artwork was generated as a
 * single-colour satin ribbon, cleaned and traced into Bézier paths, then split into five
 * shade bands per side: ribbon-a0..a4 shade the main colour (the loop's right side and the
 * left tail), ribbon-b0..b4 the second colour (the loop's left side and the right tail),
 * mixed in ribbons.css. Two-colour tones set --ribbon-second; the rest read as one colour.
 * Denim keeps its woven pattern under the same traced shading, softened so the threads
 * show through.
 * The five flat bands read as steps at ribbon sizes, so each side's bands are painted
 * through a softening filter (see ribbonArt): the bands blur into one another, the flat
 * bands show through only where the blur thins at a coverage edge, and the result is
 * clipped to the bands' own outline — the shading runs continuously, like satin's,
 * while the silhouette, the fold-over edge and the two-colour split stay crisp. Each
 * side is filtered separately so the second colour never bleeds into the first. */
const RIBBON_SHADE_A = `<path class="ribbon-a2" d="M62.4 6C63.7 6.3 66.2 6.7 67.9 7.4C69.5 8.2 71.1 9.2 72.4 10.3C73.8 11.5 74.5 12.4 75.7 14.2C76.9 16 78.3 18.6 79.6 21.3C80.9 24 82.2 27.1 83.3 30.1C84.3 33.2 85.2 36.7 85.7 39.4C86.2 42.1 86.4 43.7 86.4 46.3C86.5 48.8 86.8 50.5 85.9 54.9C85 59.2 83.3 65.9 81 72.3L71.9 93.7L73.6 98L65.1 96.5L71.2 143.4L60.1 119.7L38.9 166.1L22.1 142.5L48.2 94.5L40.5 76L36.8 65L43.5 66.9L59.9 78.6L60.4 70.4C62 65.8 67.2 56.1 69.5 50.6C71.8 45.2 73.1 41 74.2 37.8L75.9 30.9L75.5 30L69 26.1L60 24.2L60 6L62.4 6Z"/><path class="ribbon-a4" d="M60 6L64.6 6.4C66 6.7 67.2 7.1 68.5 7.7C69.8 8.4 71.3 9.4 72.4 10.3C73.6 11.3 73.6 10.6 75.2 13.5C76.9 16.3 80.5 22.8 82.3 27.6C84.1 32.3 85.5 38 86.1 42.1C86.8 46.1 86.5 48.7 86.2 52.1C85.9 55.5 85.4 58.3 84.2 62.5C83 66.7 81.2 71.9 79.1 77.2L71.6 94.3L74.2 86.7C74.6 85.2 75.2 86.9 74.1 85C73 83.1 69.1 77.1 67.7 75.1L65.7 73.4L65.1 71.1L62.8 69.6L60.1 73.2L59.9 72.2L71.3 46.2L75.9 30.7L73.1 28.2C71.9 27.4 71.2 26.7 69 26.1L60 24.2L60 6Z"/><path class="ribbon-a1" d="M38.9 166.1L22.4 142.5L33.9 122.8L35.6 120.4L36.7 120.2L36.7 119.1L42.6 124.1L51.8 135.1L38.9 166.1Z"/><path class="ribbon-a3" d="M60 6L66.6 7C68.6 7.6 70.4 8.7 71.9 9.9C73.5 11.1 74.4 12.1 75.7 14.2C77.1 16.3 78.8 19.4 80.2 22.5C81.6 25.6 83.1 29.3 84.1 32.8C85.1 36.3 85.9 40.4 86.3 43.5C86.7 46.6 86.7 48.6 86.3 51.2L84.2 59.3L82.4 55.1C81.3 51.4 78.2 42.5 77.3 36.7L77 20.3L76.7 28.1L75.6 30.3L69.2 26.1L60 24.2L60 6Z"/><path class="ribbon-a1" d="M36.8 65L43.5 66.9L57.2 76.6L49 93.8L47.9 93L43.6 83.4L36.8 65Z"/><path class="ribbon-a0" d="M38.7 164.9L23.2 143L24.8 139.7L26.3 139.7L27 140.6L28.3 139.5L29.3 139.7L29.4 142.7L32.3 141.9L32.5 143.5L36.6 146.5L37.4 149.7L39.1 150.6L38.9 149.3L40.9 148.5L41.1 150.1L42.1 149.6L43 151.1L44 151.3L42.4 152.4L42.5 155.7L38.7 164.9Z"/><path class="ribbon-a0" d="M66.1 105.7L71.2 143.4L60.3 119.5L66.1 105.7Z"/><path class="ribbon-a0" d="M49.9 71.5L57.1 76.6L48.6 93.4L46.3 88.9C45.8 87.5 45.8 86.1 45.8 85.1L46.1 82.5L47 81.3L47.9 73.9L49.9 71.5Z"/><path class="ribbon-a1" d="M71.2 143.4L61.6 122.9L63.4 125.6L64.3 125.7L67.3 115.8L71.2 143.4Z"/><path class="ribbon-a1" d="M77.6 19L80.8 24.8C82 27.6 83.7 32.5 84.6 35.6C85.4 38.7 85.8 41.5 85.9 43.6L85.5 48.2L80 31.4L77.6 19Z"/><path class="ribbon-a2" d="M45.6 87.7L40.1 75L36.8 65L42.3 66.3L45.4 68.4L42.7 76.9L45.6 87.7Z"/><path class="ribbon-a1" d="M74.3 14.4L75.7 16.8C76.1 17.9 76.4 19.1 76.5 20.7C76.7 22.4 76.7 25 76.5 26.6L75.8 30.1L69.7 25.2L74.3 14.4Z"/><path class="ribbon-a0" d="M75.6 18.5L76.5 23.8L75.8 29.8L72.3 26.7L75.6 18.5Z"/><path class="ribbon-a3" d="M63.1 125.8L67.8 134.4L68.5 135L69.7 134.3L71.2 143.4L63.1 125.8Z"/><path class="ribbon-a1" d="M48.6 81.9L48.8 78.9L50.3 77.6L50.3 76.4L51.9 76.3L51.8 75.6L50.1 75.9L50.2 71.8L53.5 74.1L48.6 81.9Z"/><path class="ribbon-a1" d="M60.4 119.9L60.2 117.9L66.1 105.1L60.4 118.4L60.4 119.9Z"/><path class="ribbon-a0" d="M73.2 97.9L70 97.4L71.3 95L71.9 95.1L73.2 97.9Z"/><path class="ribbon-a4" d="M40.2 75.1L36.8 65L37.6 65.3L40.2 75.1Z"/>`;
const RIBBON_SHADE_B = `<path class="ribbon-b3" d="M65 96.3L72.3 97.3C73.9 97.7 73.1 96.3 74.5 98.8C76 101.4 77.3 105.4 81.2 112.6L98 142.4L81.5 166.1L71.1 142.4L65 96.3Z"/><path class="ribbon-b4" d="M60 6L60 24.2L50.6 26.2C48.4 26.9 47.7 27.7 46.7 28.5L44.2 30.8L48.7 45.8C51.3 52.4 58 65.1 59.9 70.6L60 78.7L43.1 66.7L36.7 65L34.4 55.9C34 53.1 33.7 50.5 33.7 48C33.6 45.5 33.8 43.6 34.2 41.1C34.6 38.7 35.1 36.4 35.9 33.4C36.8 30.5 38.2 26.5 39.4 23.6C40.6 20.7 41.9 18.2 43.1 16.1C44.3 14.1 45.4 12.8 46.6 11.5C47.8 10.2 48.8 9.3 50.1 8.5C51.5 7.7 53.1 7 54.7 6.6L60 6Z"/><path class="ribbon-b3" d="M44.5 39.9L60 70.9L60 78.7L43.1 66.7L37.6 65.3L44.5 39.9Z"/><path class="ribbon-b0" d="M60 6L60 24.2L51.3 26L44.2 30.3L43.5 28.4C43.4 26.8 43.2 22.6 43.4 20.6C43.5 18.5 43.8 17.4 44.2 16.1C44.6 14.7 45.1 13.6 45.8 12.5C46.5 11.4 47.5 10.5 48.5 9.7C49.5 8.9 50.5 8.2 51.7 7.7C52.9 7.1 54.4 6.6 55.7 6.4L60 6Z"/><path class="ribbon-b1" d="M69.5 133.5L65 96.3L73.6 98L77.9 108.6L76.9 115.6L73.9 123.1L72.5 124L71.1 131L69.5 133.5Z"/><path class="ribbon-b1" d="M49.5 53.2L50.9 54.4L59.6 71L57.3 76.8L45.5 68.3L46.3 63L49.5 53.2Z"/><path class="ribbon-b2" d="M60 6L60 24.2L54.1 25.1L48.3 27.1L53.8 24.1L54.3 18.3L53.8 8.1L48 10L53.7 6.9L60 6Z"/><path class="ribbon-b0" d="M67.3 115.8L65 96.3L72.9 97.8L73.5 98.7L67.3 115.8Z"/><path class="ribbon-b1" d="M53.8 8L54.4 18.3L53.9 24.1L45.9 28.7L50.5 24.9L50.1 12.6L49.4 10.3L47.8 10.8L45.6 14.1C45 15.3 44.5 15.9 44.2 18.1C43.9 20.3 43.7 25 43.8 27L44.6 30.2L44.1 30.2L43.2 21.8C43.4 19.2 44.1 16.3 44.8 14.3L48 10.1L53.8 8Z"/><path class="ribbon-b0" d="M52.4 59.5L55.8 64.9L56.2 67L57.4 67.4L59.3 71L57.1 76.6L53.5 74.2L56 67.4L53 66.7L51.4 69.2L50.5 69.3L50.1 70.9L49.4 70.6L52.4 59.5Z"/><path class="ribbon-b2" d="M66.1 105.7L65 96.3L70 97.3L66.1 105.7Z"/><path class="ribbon-b3" d="M46.4 11.6L43.8 20.1L44.3 30.2L43.4 26C43.2 24.3 43.2 22 43.4 20.1C43.6 18.3 44.1 16.5 44.6 15.1L46.4 11.6Z"/><path class="ribbon-b4" d="M81.5 166.1L73.9 149.3L81.3 165.1L82.4 164.7L81.5 166.1Z"/>`;
const RIBBON_SILHOUETTE = "M59.9 5.9C62.1 5.7 63.5 6.1 65 6.5C66.5 6.8 67.6 7.2 68.8 7.8C70 8.4 71.1 9.1 72.1 10C73.2 10.9 73.5 10.5 75.2 13.4C76.9 16.4 80.5 22.8 82.3 27.6C84.1 32.3 85.5 38 86.1 42.1C86.8 46.1 86.5 48.7 86.2 52.1C85.9 55.5 85.3 58.5 84.2 62.5C83.1 66.5 81.6 70.8 79.6 76.1L71.9 94.2L84.2 118.2L98 142.5L81.5 166.1L60.1 119.7L38.9 166.1L22.1 142.7L48.2 94.4L38.8 71.5C36.6 65.5 35.8 62.7 34.9 58.5C34.1 54.2 33.6 50 33.7 46C33.8 42 34.6 38.5 35.7 34.4C36.8 30.3 38.6 25.1 40.3 21.4C42 17.7 44.4 14.3 45.8 12.4C47.2 10.4 47.7 10.3 48.7 9.5C49.7 8.7 49.8 8.3 51.7 7.7C53.6 7.1 57.7 6.1 59.9 5.9Z M60 71.2L70.9 47.4L76 30.9L73.7 28.5C72.6 27.7 70.6 26.6 69.1 25.9C67.6 25.3 66.2 24.9 64.7 24.6C63.2 24.3 62.2 23.9 59.9 24.2C57.6 24.4 52.9 25.3 50.7 26C48.5 26.7 47.8 27.5 46.7 28.3L44.1 30.8L48.6 45.8L60 71.2Z";

export function ribbonArt(tone, id) {
  const softId = `${id}-soft`;
  const soft = raw(`<filter id="${softId}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.4"/><feComposite in2="SourceGraphic" operator="over"/><feComposite in2="SourceAlpha" operator="in"/></filter>`);
  const sideA = raw(`<g filter="url(#${softId})">${RIBBON_SHADE_A}</g>`);
  const sideB = raw(`<g filter="url(#${softId})">${RIBBON_SHADE_B}</g>`);
  if (tone === "denim") {
    const patternId = `${id}-pattern`;
    return html`<svg class="ribbon-art ribbon-denim" viewBox="0 0 120 172" aria-hidden="true" focusable="false"><pattern id="${patternId}" width="16" height="16" patternUnits="userSpaceOnUse"><path class="ribbon-pattern-ground" d="M0 0H16V16H0Z"/><path class="ribbon-pattern-thread" d="M-8 8L8-8M0 16L16 0M8 24L24 8"/></pattern>${soft}<path fill="url(#${patternId})" fill-rule="evenodd" d="${RIBBON_SILHOUETTE}"/><g opacity=".5">${sideA}${sideB}</g></svg>`;
  }
  return html`<svg class="ribbon-art ribbon-${tone}" viewBox="0 0 120 172" aria-hidden="true" focusable="false">${soft}${sideA}${sideB}</svg>`;
}

function details(item,b) {
  return html`<div class="ribbon-details"><div class="ribbon-popup-art">${ribbonArt(item.tone,item.id+"-detail")}</div><div class="ribbon-popup-copy">
    ${item.local ? html`<section class="ribbon-local"><h3>${b.localLabel}</h3><p>${item.local}</p></section>` : ""}
    <h3>${b.otherLabel}</h3><ul class="ribbon-causes">${item.entry.causes.map(c=>html`<li>${c}</li>`)}</ul>
    ${item.entry.note ? html`<p class="ribbon-context">${item.entry.note}</p>` : ""}
  </div></div>`;
}

export default {
  type:"ribbons", label:"Ribbon cards", fields:{title:"text!",items:"words!",meanings:"ribbonmeanings!",note:"text",openLabel:"text!",closeLabel:"text!",dialogLabel:"text!",localLabel:"text!",otherLabel:"text!"},
  data:[], styles:"ribbons.css", client:"ribbons.js", analytics:"none", loading:"lazy",
  render(b,ctx) {
    const items=b.items.map((w,i)=>({...ribbonItem(w,b.meanings),id:`${b.id}-r${i}`})).sort((a,z)=>(a.entry?ORDER.indexOf(a.tone):999)-(z.entry?ORDER.indexOf(z.tone):999));
    return html`<section id="${b.anchor||b.id}" class="ribbon-gallery band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-ribbon-gallery><div class="wrap">
      <header class="ribbon-gallery-head"><h2 id="${b.id}-h">${b.title}</h2>${b.note?html`<p>${b.note}</p>`:""}</header>
      <ul class="ribbon-grid">${items.map(item=>item.entry?html`<li><details class="ribbon-card"><summary><span class="ribbon-card-art">${ribbonArt(item.tone,item.id)}</span><span class="ribbon-caption"><span class="ribbon-name">${item.entry.title}</span><span class="ribbon-open"><span class="sr-only">${b.openLabel}</span>${icon("plus")}</span></span></summary>${details(item,b)}</details></li>`:html`<li class="ribbon-card ribbon-plain"><p>${item.text}</p></li>`)}</ul>
      <dialog class="ribbon-dialog" aria-labelledby="${b.id}-dialog-title" data-ribbon-dialog><div class="ribbon-dialog-head"><div><p>${b.dialogLabel}</p><h2 id="${b.id}-dialog-title" data-ribbon-title></h2></div><button type="button" class="go ribbon-close" data-ribbon-close>${b.closeLabel}${icon("plus")}</button></div><div data-ribbon-body></div></dialog>
    </div></section>`;
  },
};

export function ribbonProblems(b) {
  const out=[];
  if(!Array.isArray(b.items)||!b.items.length)out.push(`${b.id}: ribbons need items`);
  if(!b.meanings||typeof b.meanings!=="object"||Array.isArray(b.meanings))return [...out,`${b.id}: meanings must be reference groups`];
  for(const [tone,entry]of Object.entries(b.meanings)){
    if(!ORDER.includes(tone.replaceAll("_", "-")))out.push(`${b.id}: unknown ribbon ${tone}`);
    if(!entry||typeof entry.title!=="string"||!entry.title.trim())out.push(`${b.id}: ${tone} needs a title`);
    if(!Array.isArray(entry?.causes)||!entry.causes.length||entry.causes.some(c=>typeof c!=="string"||!c.trim()||c.length>500))out.push(`${b.id}: ${tone} needs a readable cause list`);
    if(!Array.isArray(entry?.references)||!entry.references.length||entry.references.some(r=>!r||typeof r.label!=="string"||!r.label.trim()||linkProblem(r.href)))out.push(`${b.id}: ${tone} needs valid reference links`);
  }
  for(const item of b.items||[])if(typeof (typeof item==="string"?item:item?.text)!=="string")out.push(`${b.id}: an item needs text`);
  return out;
}
