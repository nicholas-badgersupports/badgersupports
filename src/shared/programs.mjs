/* The programs a visitor can ask for, and the switch that turns asking off for one of them
 * (owner, 23 Nov 2026). One row per program: the pages that are the program's own, the line its
 * empty schedule shows, where its "request" link goes, and which choices on the shared request
 * forms belong to it. The staff page holds one toggle per program (netlify/lib/programs.mjs reads
 * the saved rows); a program with no saved row takes requests, as every program did before the
 * switch existed. Turning a program off hides its pages the way a retired page is hidden and
 * takes its choices off the request forms, so neither the page nor the form can be used for it.
 *
 * `comingSoon` and `requestLabel` name words in content/text.json, so every line a visitor reads
 * stays editable like the rest of the site. `name` is the program's own name as staff know it; it
 * labels the toggle on the staff page and is not shown to visitors. */

export const REQUEST_PROGRAMS = Object.freeze([
  {
    key: "housing",
    name: "Navigating Housing",
    pages: ["pg-housing-hub", "pg-btw-navigating-housing"],
    comingSoon: "events.comingSoon.workshops",
    requestLabel: "events.request.housing",
    requestHref: "/forms/workshop-request/?topic=housing",
    formOptions: [{ form: "workshop-request", question: "topics", option: "housing" }],
    topics: ["housing"],
  },
  {
    key: "workshops",
    name: "Wellness Workshops",
    pages: ["pg-request-a-workshop", "pg-btw-stress-management-self-care", "pg-btw-support-networks"],
    comingSoon: "events.comingSoon.workshops",
    requestLabel: "events.request.workshops",
    requestHref: "/forms/workshop-request/",
    formOptions: [
      { form: "workshop-request", question: "topics", option: "support_network" },
      { form: "workshop-request", question: "topics", option: "stress_self_care" },
      { form: "workshop-request", question: "topics", option: "self_advocacy" },
    ],
    topics: ["support_network", "stress_self_care", "self_advocacy"],
  },
  {
    key: "peer",
    name: "Peer Support Groups",
    pages: ["pg-peer-groups"],
    comingSoon: "events.comingSoon.groups",
    requestLabel: "events.request.peer",
    requestHref: "/forms/program-request/?topic=peer_support_group",
    formOptions: [{ form: "program-request", question: "request_type", option: "peer_support_group" }],
    topics: ["peer_support_group"],
  },
  {
    key: "craft",
    name: "Craft Nights",
    pages: ["pg-craft-nights"],
    comingSoon: "events.comingSoon.craft",
    requestLabel: "events.request.craft",
    requestHref: "/forms/programming-feedback/",
    formOptions: [],
    topics: [],
  },
  {
    key: "training",
    name: "Volunteer Training",
    pages: [],
    comingSoon: null,
    requestLabel: null,
    requestHref: null,
    formOptions: [{ form: "program-request", question: "request_type", option: "volunteer_training" }],
    topics: ["volunteer_training"],
  },
  {
    key: "dogs",
    name: "Dogs on Call",
    pages: ["pg-dogs-on-call"],
    comingSoon: "events.comingSoon.visits",
    requestLabel: null,
    requestHref: null,
    formOptions: [],
    topics: [],
  },
]);

const byKey = new Map(REQUEST_PROGRAMS.map((p) => [p.key, p]));
const byPage = new Map(REQUEST_PROGRAMS.flatMap((p) => p.pages.map((id) => [id, p])));
const byTopic = new Map(REQUEST_PROGRAMS.flatMap((p) => p.topics.map((id) => [id, p])));

export const programByKey = (key) => byKey.get(key) || null;
export const programForPage = (pageId) => byPage.get(pageId) || null;
export const programForTopic = (topic) => byTopic.get(topic) || null;

/* The program an event hero or event list speaks for, from the fields those blocks already
 * carry: a series names the program where the calendar's own program word is wider (the housing
 * hub's events are workshops, but the page is Navigating Housing's). */
export function programForEvents(program, series) {
  if (series === "housing-hub") return byKey.get("housing");
  if (series === "dogs-on-call") return byKey.get("dogs");
  if (program === "craft") return byKey.get("craft");
  if (program === "peer") return byKey.get("peer");
  if (program === "workshops") return byKey.get("workshops");
  return null;
}

/* A form definition with the switched-off programs' choices taken out: the choice is not drawn,
 * and an answer naming it fails the form's own checks, as a choice the form does not offer does.
 * Only the question that carries a removed choice is copied; the rest of the definition is the
 * object it was given. */
export function withoutProgramOptions(def, off) {
  if (!def || !off?.size) return def;
  const drop = new Map(); // question id -> Set of option ids, for this form only
  for (const p of REQUEST_PROGRAMS) {
    if (!off.has(p.key)) continue;
    for (const fo of p.formOptions) {
      if (fo.form !== def.key) continue;
      if (!drop.has(fo.question)) drop.set(fo.question, new Set());
      drop.get(fo.question).add(fo.option);
    }
  }
  if (!drop.size) return def;
  const sections = (def.sections || []).map((s) => {
    if (!(s.questions || []).some((q) => drop.has(q.id))) return s;
    return {
      ...s,
      questions: s.questions.map((q) => (drop.has(q.id) && Array.isArray(q.options)
        ? { ...q, options: q.options.filter((o) => !drop.get(q.id).has(o.id)) }
        : q)),
    };
  });
  return { ...def, sections };
}
