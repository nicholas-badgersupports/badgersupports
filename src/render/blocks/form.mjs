/* A native form page body: its title and instructions, then the form — or, when the form is
   switched off, its closed message and no inputs at all. The switch is read again by the intake
   API on every submission, so a tab opened before the form closed still cannot send. */

import { html } from "../html.mjs";
import { renderForm, renderClosed } from "../form.mjs";

/* The page section around a form, its closed message or its confirmation. The intake API wraps
   its own replies (a correction, a confirmation) in the same section. */
export function formSection(def, inner, { id = `b-form-${def.key}`, title = null } = {}) {
  return html`<section class="form-page" aria-labelledby="${id}-h" data-block="${id}"><div class="wrap">
  <header class="form-head"><h1 id="${id}-h">${title || def.title}</h1>${(def.intro || []).map((p) => html`<p>${p}</p>`)}</header>
  ${inner}
</div></section>`;
}

export default {
  type: "form",
  label: "Native form",
  fields: { form: "form!", title: "text" },
  data: ["forms"],
  client: "form.js",
  analytics: "page",
  loading: "eager",
  render(b, ctx) {
    const def = ctx.data.forms?.[b.form];
    if (!def) throw new Error(`${b.id}: form "${b.form}" is not defined`);
    return formSection(def, def.state === "open" ? renderForm(def, { t: ctx.t }) : renderClosed(def, ctx.t), { id: b.id, title: b.title });
  },
};
