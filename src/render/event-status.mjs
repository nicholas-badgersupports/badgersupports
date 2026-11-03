import { html } from "./html.mjs";
import { eventState } from "../shared/event-state.mjs";

export function eventClass(base, row, now) {
  const state = eventState(row, now);
  return [base, state === "ended" ? "is-past" : state === "happening" ? "is-happening" : null].filter(Boolean).join(" ");
}

export const eventTags = ctx => html`<span class="ongoing-tag">${ctx.t("schedule.happening")}</span><span class="ended-tag">${ctx.t("schedule.ended")}</span>`;
