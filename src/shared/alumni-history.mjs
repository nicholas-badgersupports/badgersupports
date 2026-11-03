/* Only a reviewed display subset crosses into public history. Contact/research records are not a display source. */
export const ALUMNI_SCHEMA = "bss.alumni-history/1";
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const ORGANIZATIONS = new Set(["BSS", "BSN"]);
const words = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[<>@]|https?:\/\/|www\./i.test(value);
export const emptyHistory = () => ({ schema: ALUMNI_SCHEMA, groups: [] });

export function publicHistory(input) {
  const bad = (at) => { throw Object.assign(new Error("Alumni display data is not valid."), { code: "alumni.invalid", at }); };
  if (!input || input.schema !== ALUMNI_SCHEMA || input.approved !== true || typeof input.revision !== "string" || !ID.test(input.revision) || !/^\d{4}-\d{2}-\d{2}$/.test(input.asOf || "") || !Array.isArray(input.groups)) bad("source");
  const date = new Date(`${input.asOf}T12:00:00Z`);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.asOf || input.asOf > today) bad("source date");
  const groupIds = new Set(), peopleIds = new Set(), year = Number(input.asOf.slice(0, 4));
  const future = value => [...value.matchAll(/\b(?:19|20)\d{2}\b/g)].some(m => Number(m[0]) > year);
  const groups = input.groups.map((group, gi) => {
    if (!group || typeof group.id !== "string" || !ID.test(group.id) || groupIds.has(group.id) || !ORGANIZATIONS.has(group.organization) || !words(group.heading, 100) || !Array.isArray(group.people)) bad(`group ${gi + 1}`);
    if (future(group.heading)) bad(`group ${gi + 1}`);
    groupIds.add(group.id);
    const people = group.people.map((person, pi) => {
      const at = `group ${gi + 1}, row ${pi + 1}`;
      if (!person || typeof person.id !== "string" || !ID.test(person.id) || peopleIds.has(person.id) || !words(person.name, 200) || !words(person.years, 100) || !Array.isArray(person.titles) || person.titles.length > 20 || person.titles.some(t => !words(t, 200))) bad(at);
      const years = [...person.years.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m => Number(m[0]));
      if (!years.length || years.some(y => y > year) || person.titles.some(future)) bad(at);
      peopleIds.add(person.id);
      return { id: person.id, name: person.name.trim(), years: person.years.trim(), titles: [...new Set(person.titles.map(t => t.trim()))] };
    });
    return { id: group.id, heading: group.heading.trim(), organization: group.organization, people };
  });
  return { schema: ALUMNI_SCHEMA, approved: true, asOf: input.asOf, revision: input.revision, groups };
}

/* Preparation is local and explicit. Confirmed current/uncertain/onboarding-only records never enter its output.
   Existing content approval is represented here; this is not a new approval or automatic status inference. */
export function prepareHistory(input) {
  if (input?.schema !== "bss.alumni-review/1" || input.approved !== true || !Array.isArray(input.groups)) throw Object.assign(new Error("A reviewed display subset is required."), { code: "alumni.approval" });
  let excluded = 0, included = 0;
  const groups = input.groups.map(group => ({ ...group, people: (group.people || []).filter(person => {
    const keep = person.status === "former" && person.displayApproved === true && person.currentStudentLeader === false;
    if (keep) included++; else excluded++;
    return keep;
  }) }));
  const result = publicHistory({ ...input, schema: ALUMNI_SCHEMA, groups });
  return { result, included, excluded };
}
