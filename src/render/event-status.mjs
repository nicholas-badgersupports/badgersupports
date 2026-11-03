import { html } from "./html.mjs";
import { eventState } from "../shared/event-state.mjs";
import { timeUnconfirmed } from "./ics.mjs";
import { go } from "./context.mjs";

export function eventClass(base, row, now) {
  const state = eventState(row, now);
  return [base, state === "ended" ? "is-past" : state === "happening" ? "is-happening" : null].filter(Boolean).join(" ");
}

export const timeNotice = (ctx, row) => row && timeUnconfirmed(row) ? html`<span class="time-unconfirmed">${ctx.t("schedule.timeUnconfirmed")}</span>` : "";
export const timeContact = ctx => go(ctx, "mailto:directors@badgersupports.org", ctx.t("schedule.confirmTime"), "mail");
export const eventTags = (ctx, row) => html`<span class="ongoing-tag">${ctx.t("schedule.happening")}</span><span class="ended-tag">${ctx.t("schedule.ended")}</span>${timeNotice(ctx, row)}`;
