/* Only the original program request's offered choices may prefill its native or Google form. */
import { allQuestions, googleFormUrl } from "./forms.mjs";
import { topicFromAddress } from "./workshop-topic.mjs";
const GOOGLE_ID = "1FAIpQLSdu0_H2uGutYJwoEJDECXTI1zEP-8fShhwlABZIoy7LDDTP6w";
const TYPES = Object.freeze({ volunteer_training: "Volunteer Training (for your group or team)", peer_support_group: "Peer Support Group (for you, your members or community)" });
export function formTopicFromAddress(params) {
  const workshop = topicFromAddress(params);
  const values = params.getAll("topic");
  return workshop || (values.length === 1 && Object.hasOwn(TYPES, values[0]) ? values[0] : null);
}
export function programTopic(def, candidate) {
  if (def?.key !== "program-request" || !Object.hasOwn(TYPES, candidate || "")) return null;
  const row = allQuestions(def).find(({q}) => q.id === "request_type" && q.type === "checkboxes");
  if (!row || row.q.showIf || row.section.showIf) return null;
  const option = row.q.options?.find(o => o.id === candidate);
  return option ? { id: option.id, label: option.label } : null;
}
export function programElsewhere(def, topic) {
  if (!topic || def?.key !== "program-request" || def.source?.publishedId !== GOOGLE_ID || def.elsewhere !== googleFormUrl(def)) return def.elsewhere;
  const url = new URL(def.elsewhere);
  url.searchParams.set("usp", "pp_url"); url.searchParams.set("entry.70593572", TYPES[topic.id]);
  return url.href;
}
