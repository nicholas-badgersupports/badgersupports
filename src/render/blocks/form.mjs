/* A native form page body: its title and instructions, then the form — or, when the form is
   switched off, its closed message and no inputs at all. The switch is read again by the intake
   API on every submission, so a tab opened before the form closed still cannot send. */

import { html } from "../html.mjs";
import { renderForm, renderClosed, prose } from "../form.mjs";
import { proseText } from "../../shared/forms.mjs";

/* Characters of intro past which the sheet stops staying beside the questions (forms.css is-long):
   a sticky sheet taller than the window would hide its own end. */
const LONG_INTRO = 700;

/* The page section around a form, its closed message or its confirmation. The intake API wraps
   its own replies (a correction, a confirmation) in the same section. The form's intro is prose
   whose headings sit under the page's h1. A form shown only to say it has moved (`elsewhere`)
   keeps its intro: it says what the form is for. */
export function formSection(def, inner, { id = `b-form-${def.key}`, title = null, ctx = null } = {}) {
  return html`<section class="form-page" aria-labelledby="${id}-h" data-block="${id}"><div class="wrap">
  <header class="${proseText(def.intro).join(" ").length > LONG_INTRO ? "form-head is-long" : "form-head"}"><h1 id="${id}-h">${title || def.title}</h1>${prose(def.intro, { level: 2, ctx })}</header>
  ${inner}
</div></section>`;
}

/* A review page for each form that is closed in its own right and has questions, so the team
   can read and try a form before it opens. Prototype builds only (ops/build.mjs): never indexed,
   never counted, and the browser sends nothing from it. */
export function formPreviewPages(forms, t) {
  return Object.values(forms)
    .filter((def) => def.state === "closed" && (def.sections || []).some((s) => (s.questions || []).length))
    .map((def) => ({
      schema: "bss.page/1",
      id: `pg-preview-${def.key}`,
      path: `/forms/${def.key}/preview/`,
      generated: "form-preview",
      title: t("form.preview.pageTitle", { form: def.title }),
      description: t("form.preview.pageDescription", { form: def.title }),
      analytics: "none",
      noindex: true,
      blocks: [{ id: `b-preview-${def.key}`, type: "form", form: def.key, preview: true }],
    }));
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
    /* `preview` is set only on the review pages a prototype build makes for a closed form
       (ops/build.mjs formPreviewPages): the form as it will look when it opens, sending nothing. */
    const preview = !!(b.preview && ctx.prototype);
    const inner = def.state === "open" || preview ? renderForm(def, { t: ctx.t, ctx, preview }) : renderClosed(def, ctx.t);
    return formSection(def, inner, { id: b.id, title: b.title, ctx });
  },
};
