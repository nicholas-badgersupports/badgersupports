/* URL context is a controlled workshop choice, never a source of personal answers or destinations. */
import { allQuestions, googleFormUrl } from "./forms.mjs";

const GOOGLE_ID = "1FAIpQLSdBv_pExBwlTtjmNwYH14zm1yN7eUqn7bqffahZ-chePbykVQ";
const GOOGLE_TOPICS = Object.freeze({
  support_network: "Building a Support Network",
  stress_self_care: "Stress Management & Self-Care",
  self_advocacy: "Self-Advocacy: Advocating for Yourself",
  housing: "Navigating Housing",
});

export function topicFromAddress(params) {
  const values = params.getAll("topic");
  return values.length === 1 && Object.hasOwn(GOOGLE_TOPICS, values[0]) ? values[0] : null;
}

export function workshopTopic(def, candidate) {
  if (def?.key !== "workshop-request" || !Object.hasOwn(GOOGLE_TOPICS, candidate || "")) return null;
  const row = allQuestions(def).find(({ q }) => q.id === "topics" && q.type === "checkboxes");
  if (!row || row.q.showIf || row.section.showIf) return null;
  const option = row.q.options?.find(o => o.id === candidate);
  return option ? { id: option.id, label: option.label } : null;
}

export function workshopElsewhere(def, topic) {
  const base = def.elsewhere;
  if (!topic || def.source?.publishedId !== GOOGLE_ID || base !== googleFormUrl(def)) return base;
  const url = new URL(base);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set("entry.1411124785", GOOGLE_TOPICS[topic.id]);
  return url.href;
}
