/* Color names select reference groups. Plain saved text keeps its own meaning and never
   inherits an association from a former list position. All illustrations are original vectors. */
import { html } from "../html.mjs";
import { icon } from "../icons.mjs";
import { link } from "../context.mjs";
import { linkProblem } from "../../shared/links.mjs";

const ORDER = ["red","maroon","orange","gold","yellow","bright-green","lime","green","jade","teal","teal-purple","turquoise","light-blue","blue","dark-blue","two-tone-blue","denim","periwinkle","lavender","purple","pink","pink-blue","silver","gray","white","black","parkinsons"];
const ALIASES = new Map(ORDER.map(t => [t.replaceAll("-", " "), t]));
for (const [name,tone] of [["lime green","lime"],["dark green","green"],["teal & purple","teal-purple"],["black / gray","black"],["pink & blue","pink-blue"],["two-tone blue","two-tone-blue"],["blue denim","denim"],["parkinson’s uk","parkinsons"],["parkinson's uk","parkinsons"]]) ALIASES.set(name,tone);

export function ribbonItem(item, meanings) {
  const text = typeof item === "string" ? item : item.text;
  const split = text.indexOf(" — ");
  const color = (split < 0 ? text : text.slice(0,split)).trim();
  const local = split < 0 ? "" : text.slice(split+3).trim();
  const tone = ALIASES.get(color.toLowerCase());
  return { text, local, tone, entry: tone ? meanings?.[tone.replaceAll("-", "_")] : null };
}

export function ribbonArt(tone, id) {
  const patterned = tone === "denim";
  const back = patterned ? id+"-pattern" : id+"-back", front = patterned ? id+"-pattern" : id+"-front";
  return html`<svg class="ribbon-art ribbon-${tone}" viewBox="0 0 120 172" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="${id}-back" x1="0" y1="0" x2="1" y2="0"><stop class="ribbon-shade" offset="0"/><stop class="ribbon-shine" offset=".3"/><stop class="ribbon-satin" offset=".65"/><stop class="ribbon-shade" offset="1"/></linearGradient>
    <linearGradient id="${id}-front" x1="0" y1="0" x2="1" y2=".2"><stop class="ribbon-front-shade" offset="0"/><stop class="ribbon-front-base" offset=".25"/><stop class="ribbon-front-shine" offset=".5"/><stop class="ribbon-front-base" offset=".8"/><stop class="ribbon-front-shade" offset="1"/></linearGradient>
    ${patterned ? html`<pattern id="${id}-pattern" width="16" height="16" patternUnits="userSpaceOnUse"><path class="ribbon-pattern-ground" d="M0 0H16V16H0Z"/><path class="ribbon-pattern-thread" d="M-8 8L8-8M0 16L16 0M8 24L24 8"/></pattern>` : ""}
  </defs>
  <path class="ribbon-tail ribbon-back" fill="url(#${back})" d="M55 84L77 98L29 165L9 151Z"/>
  <path class="ribbon-tail ribbon-loop" fill="url(#${back})" fill-rule="evenodd" d="M60 6C34 6 23 24 29 47C35 69 50 91 60 105C70 91 85 69 91 47C97 24 86 6 60 6ZM60 25C47 25 42 36 47 50C51 62 57 75 60 80C64 74 70 62 74 50C79 36 73 25 60 25Z"/>
  <path class="ribbon-front" fill="url(#${front})" d="M60 6C34 6 23 24 29 47C35 69 50 91 60 105L60 80C57 75 51 62 47 50C42 36 47 25 60 25Z"/>
  <path class="ribbon-fold" d="M57 92L69 110L77 98L65 81Z"/>
  <path class="ribbon-tail ribbon-front" fill="url(#${front})" d="M48 89L65 81L111 151L91 166Z"/>
  <path class="ribbon-edge-light" d="M44 12C26 23 33 48 44 66L98 153"/>
  </svg>`;
}

function details(item,b,ctx) {
  return html`<div class="ribbon-details"><div class="ribbon-popup-art">${ribbonArt(item.tone,item.id+"-detail")}</div><div class="ribbon-popup-copy">
    ${item.local ? html`<section class="ribbon-local"><h3>${b.localLabel}</h3><p>${item.local}</p></section>` : ""}
    <h3>${b.otherLabel}</h3><ul class="ribbon-causes">${item.entry.causes.map(c=>html`<li>${c}</li>`)}</ul>
    ${item.entry.note ? html`<p class="ribbon-context">${item.entry.note}</p>` : ""}
    <ul class="ribbon-references">${item.entry.references.map(r=>html`<li>${link(ctx,r.href,r.label,{class:"ribbon-source",icon:"out"})}</li>`)}</ul>
  </div></div>`;
}

export default {
  type:"ribbons", label:"Ribbon cards", fields:{title:"text!",items:"words!",meanings:"ribbonmeanings!",note:"text",openLabel:"text!",closeLabel:"text!",dialogLabel:"text!",localLabel:"text!",otherLabel:"text!"},
  data:[], styles:"ribbons.css", client:"ribbons.js", analytics:"none", loading:"lazy",
  render(b,ctx) {
    const items=b.items.map((w,i)=>({...ribbonItem(w,b.meanings),id:`${b.id}-r${i}`})).sort((a,z)=>(a.entry?ORDER.indexOf(a.tone):999)-(z.entry?ORDER.indexOf(z.tone):999));
    return html`<section id="${b.anchor||b.id}" class="ribbon-gallery band" aria-labelledby="${b.id}-h" data-block="${b.id}" data-ribbon-gallery><div class="wrap">
      <header class="ribbon-gallery-head"><h2 id="${b.id}-h">${b.title}</h2>${b.note?html`<p>${b.note}</p>`:""}</header>
      <ul class="ribbon-grid">${items.map(item=>item.entry?html`<li><details class="ribbon-card"><summary><span class="ribbon-card-art">${ribbonArt(item.tone,item.id)}</span><span class="ribbon-caption"><span class="ribbon-name">${item.entry.title}</span><span class="ribbon-open"><span class="sr-only">${b.openLabel}</span>${icon("plus")}</span></span></summary>${details(item,b,ctx)}</details></li>`:html`<li class="ribbon-card ribbon-plain"><p>${item.text}</p></li>`)}</ul>
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
