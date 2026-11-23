/* Hub events: the Student Mental Health Hub's own events — an open house, a recap, the next
 * gathering — each one record, in content/hub-events.json in the build and in the structure
 * document once a publisher saves it on the staff page (the Hub Events part, which is where new
 * events are made). Every record becomes a page at its own address: the redesigned event header
 * (blocks/eventhead.mjs), the people it features, its highlights and its programme, its extra
 * photos, the directions to its room, and the site's standing close (the accommodation words and
 * the what's-on-now card, whose words are the text registry's, below).
 *
 * The Open House recap is the first record, carried over word for word from the page file it
 * replaces, so its address (/initiatives/open-house/, in the menu) and everything below its
 * header read exactly as they did; only the header's design is new.
 *
 * A record with "hidden": true gets no page, so an event can be written before anyone is sent
 * to it and taken down without losing it. Records are shown in `order`, lowest first.
 */

import { photoProblems } from "./media.mjs";
import { ICONS } from "./icons.mjs";

export const HUB_EVENT_SCHEMA = "bss.hubevent/1";
export const HUB_EVENTS_SCHEMA = "bss.hubevents/1";

/* The longest each word of an event may be, and the most of each thing it may carry. The staff
   page reads the same numbers (the Hub Events part's limits), so what it refuses and what the
   build refuses are one list. */
export const EVENT_LIMITS = {
  title: 120, description: 300, label: 120, lead: 200, paragraph: 2000, paragraphs: 8,
  detail: 200, details: 6, photos: 3, linkLabel: 80, links: 4, people: 12, personName: 80,
  personRole: 120, personLine: 300, sectionTitle: 120, items: 12, itemText: 200, topicTerm: 160,
  topicText: 400, gallery: 8, directionsTitle: 120,
};

export const EVENT_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const EVENT_PATH_RE = /^\/([a-z0-9-]+\/)+$/;
export const EVENT_PROGRAMS = ["peer", "craft", "workshops"];

const isList = (v, max) => Array.isArray(v) && v.length <= max;
const words = (v, max, each) => isList(v, max) && v.every((x) => typeof x === "string" && x.trim() && x.length <= each);
const photoList = (v, max, opts, at, out) => {
  if (!isList(v, max)) { out.push(`${at}: at most ${max}`); return; }
  for (const p of v) for (const x of photoProblems(p, opts)) out.push(`${at}: ${x}`);
};
const linkList = (v, max, at, out) => {
  if (!isList(v, max)) { out.push(`${at}: at most ${max}`); return; }
  for (const l of v) {
    if (!l || typeof l !== "object" || !String(l.label || "").trim() || String(l.label).length > EVENT_LIMITS.linkLabel) out.push(`${at}: each link needs a label of at most ${EVENT_LIMITS.linkLabel} characters`);
    if (!l || typeof l.href !== "string" || !l.href.trim() || l.href.length > 2000) out.push(`${at}: each link needs an address`);
    if (l?.icon != null && !ICONS.includes(l.icon)) out.push(`${at}: icon "${l.icon}" is not one the site draws`);
  }
};

/* Every problem one record has, as sentences for the build's list. media: the library's ids;
   places: the room records, by id (a directions section needs a published room). */
export function hubEventProblems(ev, { media = null, places = null, production = false } = {}) {
  const out = [];
  if (!ev || typeof ev !== "object") return ["an event is a record"];
  if (ev.schema !== HUB_EVENT_SCHEMA) out.push(`schema must be ${HUB_EVENT_SCHEMA}`);
  if (!EVENT_ID_RE.test(ev.id || "") || ev.id.length > 40) out.push("id must use a–z, 0–9 and single hyphens, at most 40 characters");
  if (!EVENT_PATH_RE.test(ev.path || "")) out.push("path must start and end with \"/\" and use a–z, 0–9 and hyphens");
  if (!String(ev.title || "").trim()) out.push("needs a title");
  if (String(ev.title || "").length > EVENT_LIMITS.title) out.push(`title is at most ${EVENT_LIMITS.title} characters`);
  if (String(ev.description || "").length > EVENT_LIMITS.description) out.push(`description is at most ${EVENT_LIMITS.description} characters`);
  if (String(ev.label || "").length > EVENT_LIMITS.label) out.push(`label is at most ${EVENT_LIMITS.label} characters`);
  if (String(ev.lead || "").length > EVENT_LIMITS.lead) out.push(`lead is at most ${EVENT_LIMITS.lead} characters`);
  if (ev.body !== undefined && !words(ev.body, EVENT_LIMITS.paragraphs, EVENT_LIMITS.paragraph)) out.push(`body is at most ${EVENT_LIMITS.paragraphs} paragraphs of ${EVENT_LIMITS.paragraph} characters`);
  if (ev.details !== undefined && !words(ev.details, EVENT_LIMITS.details, EVENT_LIMITS.detail)) out.push(`details is at most ${EVENT_LIMITS.details} lines of ${EVENT_LIMITS.detail} characters`);
  if (ev.photos !== undefined) photoList(ev.photos, EVENT_LIMITS.photos, { media, production }, "photos", out);
  if (ev.primary !== undefined && ev.primary !== null) linkList([ev.primary], 1, "primary", out);
  if (ev.links !== undefined) linkList(ev.links, EVENT_LIMITS.links, "links", out);
  if (ev.people !== undefined) {
    if (!isList(ev.people, EVENT_LIMITS.people)) out.push(`people: at most ${EVENT_LIMITS.people}`);
    else for (const p of ev.people) {
      if (!p || typeof p !== "object" || !String(p.name || "").trim()) { out.push("people: each person needs a name"); continue; }
      if (String(p.name).length > EVENT_LIMITS.personName) out.push(`people: a name is at most ${EVENT_LIMITS.personName} characters`);
      if (String(p.role || "").length > EVENT_LIMITS.personRole) out.push(`people: a role is at most ${EVENT_LIMITS.personRole} characters`);
      if (String(p.line || "").length > EVENT_LIMITS.personLine) out.push(`people: a line is at most ${EVENT_LIMITS.personLine} characters`);
      if (p.photo != null) for (const x of photoProblems(p.photo, { media, production })) out.push(`people: ${x}`);
    }
  }
  if (String(ev.peopleTitle || "").length > EVENT_LIMITS.sectionTitle) out.push(`peopleTitle is at most ${EVENT_LIMITS.sectionTitle} characters`);
  const section = (s, at) => {
    if (s === undefined || s === null) return;
    if (typeof s !== "object") { out.push(`${at}: a section is a record`); return; }
    if (String(s.title || "").length > EVENT_LIMITS.sectionTitle) out.push(`${at}: its title is at most ${EVENT_LIMITS.sectionTitle} characters`);
    if (s.body !== undefined && !words(s.body, 4, EVENT_LIMITS.paragraph)) out.push(`${at}: at most 4 paragraphs`);
    if (s.photos !== undefined) photoList(s.photos, 3, { media, production }, `${at} photos`, out);
  };
  section(ev.highlights, "highlights");
  if (ev.highlights?.items !== undefined) {
    if (!isList(ev.highlights.items, EVENT_LIMITS.items)) out.push(`highlights items: at most ${EVENT_LIMITS.items}`);
    else for (const it of ev.highlights.items) {
      if (!it || !String(it.text || "").trim() || String(it.text).length > EVENT_LIMITS.itemText) out.push(`highlights items: each needs words of at most ${EVENT_LIMITS.itemText} characters`);
      if (it?.icon != null && !ICONS.includes(it.icon)) out.push(`highlights items: icon "${it.icon}" is not one the site draws`);
    }
  }
  section(ev.programme, "programme");
  if (ev.programme !== undefined && ev.programme !== null) {
    if (ev.programme.program !== undefined && !EVENT_PROGRAMS.includes(ev.programme.program)) out.push(`programme: its program is one of ${EVENT_PROGRAMS.join(", ")}`);
    if (ev.programme.topics !== undefined) {
      if (!isList(ev.programme.topics, EVENT_LIMITS.items)) out.push(`programme topics: at most ${EVENT_LIMITS.items}`);
      else for (const tp of ev.programme.topics) {
        if (!tp || !String(tp.term || "").trim() || String(tp.term).length > EVENT_LIMITS.topicTerm) out.push(`programme topics: each needs a title of at most ${EVENT_LIMITS.topicTerm} characters`);
        if (String(tp?.text || "").length > EVENT_LIMITS.topicText) out.push(`programme topics: a line is at most ${EVENT_LIMITS.topicText} characters`);
        if (tp?.href != null && (typeof tp.href !== "string" || tp.href.length > 2000)) out.push("programme topics: an address is at most 2000 characters");
      }
    }
    if (ev.programme.links !== undefined) linkList(ev.programme.links, EVENT_LIMITS.links, "programme links", out);
  }
  if (ev.gallery !== undefined) photoList(ev.gallery, EVENT_LIMITS.gallery, { media, production }, "gallery", out);
  if (ev.place !== undefined && ev.place !== null && ev.place !== "") {
    if (!places || !places[ev.place]) out.push(`place "${ev.place}" is not a room`);
    else if (!places[ev.place].published) out.push(`place "${ev.place}" is not a published room`);
  }
  if (String(ev.directionsTitle || "").length > EVENT_LIMITS.directionsTitle) out.push(`directionsTitle is at most ${EVENT_LIMITS.directionsTitle} characters`);
  return out;
}

/* In the order they are shown: by their order number, then by id, so the order never depends on
   which store the records came from. */
export const sortHubEvents = (list) => [...list].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.id).localeCompare(String(b.id)));

/* The standing close of an event page, below the event's own sections: how to get to its room
   (the directions block, when the event names one), the accommodation words, and the card that
   sends a visitor to what is on now. The words are the text registry's (hubevent.*), the same
   on every event page; the accommodation address is the site's, as the directions block's own
   access words give it. */
function tail(ev, t, at) {
  const out = [];
  if (ev.place) out.push({ id: `${at}-directions`, type: "directions", anchor: "get-directions", heading: "h2", title: ev.directionsTitle || undefined, place: ev.place });
  out.push({ id: `${at}-access`, type: "text", title: t("hubevent.accessTitle"), body: [t("hubevent.accessBody")],
    links: [{ label: "accessibility@badgersupports.org", href: "mailto:accessibility@badgersupports.org", icon: "mail" }] });
  out.push({ id: `${at}-next`, type: "cta", title: t("hubevent.ctaTitle"), body: t("hubevent.ctaBody"),
    primary: { label: t("hubevent.ctaPrimary"), href: "/join/peer-support-groups/" },
    links: [{ label: t("hubevent.ctaGroups"), href: "/join/get-involved/" }, { label: t("hubevent.ctaUpdates"), href: "/forms/email-list/" }] });
  return out;
}

/* One page per event that is shown. t is the resolved word table, for the standing close and the
   one heading a record may leave to it. */
export function hubEventPages(events, t) {
  return sortHubEvents((events || []).filter((ev) => ev && !ev.hidden)).map((ev) => {
    const at = `b-${ev.id}`;
    const blocks = [{ id: `${at}-head`, type: "eventhead", title: ev.title, label: ev.label || undefined, lead: ev.lead || undefined,
      body: ev.body || [], details: ev.details || [], photos: ev.photos || [], primary: ev.primary || undefined, links: ev.links || [] }];
    if (ev.people?.length) blocks.push({ id: `${at}-people`, type: "featuring", title: ev.peopleTitle || t("hubevent.peopleTitle"), people: ev.people });
    if (ev.highlights?.title) blocks.push({ id: `${at}-highlights`, type: "expect", title: ev.highlights.title, body: ev.highlights.body || [], items: ev.highlights.items || [], photos: ev.highlights.photos || [] });
    if (ev.programme?.title) blocks.push({ id: `${at}-programme`, type: "program", variant: "topics", program: ev.programme.program || "peer", title: ev.programme.title, topics: ev.programme.topics || [], photos: ev.programme.photos || [], links: ev.programme.links || [] });
    if (ev.gallery?.length) blocks.push({ id: `${at}-gallery`, type: "gallery", photos: ev.gallery });
    blocks.push(...tail(ev, t, at));
    return { schema: "bss.page/1", id: `pg-${ev.id}`, path: ev.path, generated: "hub-event", title: ev.title,
      description: ev.description || "", analytics: "public", blocks };
  });
}
