/* A native form as HTML, from its definition.
 *
 * The same function renders the static page (empty, at build) and the server's reply to a
 * no-JavaScript submission that needs correcting (with the person's answers and the errors), so
 * a mistake never costs anyone what they typed.
 *
 * Conventions: label above control; the error goes between label and control and is named by
 * aria-describedby; groups of choices are a fieldset with a legend; optional questions say
 * "(optional)" and required ones carry the required attribute. No helper text sits under a
 * control — a section's own instructions sit above its questions.
 */

import { html, attrs, jsonIsland } from "./html.mjs";
import { QUESTION_TYPES, OTHER, errorText, allQuestions } from "../shared/forms.mjs";
import { icon } from "./icons.mjs";

const fid = (q) => `f-${q.id}`;
const eid = (q) => `e-${q.id}`;

function optionLabelFor(def, cond, t) {
  const target = allQuestions(def).find(({ q }) => q.id === cond.question)?.q;
  const ids = "in" in cond ? cond.in : [cond.equals ?? cond.includes];
  const labels = ids.map((id) => (target?.options || []).find((o) => o.id === id)?.label || id);
  return labels.map((l) => `“${l}”`).join(` ${t("form.or")} `);
}

function control(q, value, otherValue, describedBy, t) {
  const common = { id: fid(q), name: q.id, required: q.required || null, "aria-describedby": describedBy, "aria-invalid": describedBy ? "true" : null };
  switch (q.type) {
    case "long":
      return html`<textarea${attrs({ ...common, rows: q.rows || 5, maxlength: q.maxLength || QUESTION_TYPES.long.max })}>${value || ""}</textarea>`;
    case "select":
      return html`<select${attrs(common)}><option value="">${t("form.choose")}</option>${q.options.map((o) => html`<option${attrs({ value: o.id, selected: value === o.id })}>${o.label}</option>`)}</select>`;
    case "choice":
    case "checkboxes": {
      const multi = q.type === "checkboxes";
      const picked = (id) => (multi ? (value || []).includes(id) : value === id);
      const opts = [...q.options, ...(q.allowOther ? [{ id: OTHER, label: t("form.other") }] : [])];
      return html`<div class="choices">${opts.map((o, i) => html`<label class="choice"><input${attrs({
        type: multi ? "checkbox" : "radio", name: q.id, value: o.id, id: i === 0 ? fid(q) : `${fid(q)}-${o.id}`,
        checked: picked(o.id), required: !multi && q.required ? true : null, "aria-describedby": i === 0 ? describedBy : null,
        "data-other": o.id === OTHER ? "" : null,
      })}><span>${o.label}</span></label>`)}${q.allowOther ? html`<input${attrs({ type: "text", class: "other-text", name: `${q.id}${OTHER}`, id: `${fid(q)}-other-text`, value: otherValue || "", maxlength: 200, "aria-label": t("form.otherLabel", { label: q.label }) })}>` : ""}</div>`;
    }
    case "confirm":
      return html`<label class="choice"><input${attrs({ ...common, type: "checkbox", value: "yes", checked: value === "yes" })}><span>${q.confirmText || q.label}</span></label>`;
    default: {
      const t = QUESTION_TYPES[q.type]?.input || "text";
      return html`<input${attrs({
        ...common, type: t, value: value ?? "",
        autocomplete: q.autocomplete || (t === "email" ? "email" : null),
        inputmode: q.type === "number" ? "numeric" : null,
        min: q.type === "number" ? q.min : null, max: q.type === "number" ? q.max : null,
        step: q.type === "datetime" ? 900 : null,
        maxlength: ["short", "email"].includes(q.type) ? q.maxLength || QUESTION_TYPES[q.type].max : null,
        spellcheck: q.type === "email" ? "false" : null,
      })}>`;
    }
  }
}

function field(def, q, values, errors, hidden, t) {
  const code = errors[q.id];
  const err = code ? html`<p class="field-error" id="${eid(q)}">${errorText(code, q, t)}</p>` : "";
  const describedBy = code ? eid(q) : null;
  const group = ["choice", "checkboxes"].includes(q.type);
  const label = html`${q.label}${q.required ? "" : html` <span class="optional">${t("form.optional")}</span>`}`;
  const cls = code ? "field has-error" : "field";
  const common = { class: cls, "data-q": q.id, hidden: hidden || null, "data-show-if": q.showIf ? JSON.stringify(q.showIf) : null };
  if (group) {
    return html`<fieldset${attrs(common)}><legend class="q-label">${label}</legend>${err}${control(q, values[q.id], values[`${q.id}${OTHER}`], describedBy, t)}</fieldset>`;
  }
  if (q.type === "confirm") return html`<div${attrs(common)}>${err}${control(q, values[q.id], null, describedBy, t)}</div>`;
  return html`<div${attrs(common)}><label for="${fid(q)}">${label}</label>${err}${control(q, values[q.id], null, describedBy, t)}</div>`;
}

/* errors: { questionId: code }. notice: { title, text } shown above the form (stale tab, closed
   while open, version changed). idemKey: carried through a no-JS correction so a resend is the
   same submission. */
export function renderForm(def, { t, values = {}, errors = {}, notice = null, idemKey = "" }) {
  const anyErrors = Object.keys(errors).length > 0;
  const anyRequired = allQuestions(def).some(({ q }) => q.required);
  const ordered = allQuestions(def).filter(({ q }) => errors[q.id]);
  return html`<form class="bss-form" method="post" action="/api/forms/${def.key}/submit" data-form="${def.key}" data-version="${def.version}">
  <input type="hidden" name="_form" value="${def.key}"><input type="hidden" name="_version" value="${def.version}"><input type="hidden" name="_key" value="${idemKey}" data-idem>
  <div class="hp" aria-hidden="true"><label>${t("form.trap")} <input type="text" name="_website" tabindex="-1" autocomplete="off" value=""></label></div>
  <div${attrs({ class: "error-summary", tabindex: "-1", "data-error-summary": "", hidden: !anyErrors, role: anyErrors ? "alert" : null })}>
    <h2>${t("form.errors.title")}</h2>
    <p>${ordered.length === 1 ? t("form.errors.one") : t("form.errors.many", { n: ordered.length })}</p>
    <ul data-error-list>${ordered.map(({ q }) => html`<li><a href="#${fid(q)}">${errorText(errors[q.id], q, t)}</a></li>`)}</ul>
  </div>
  <div${attrs({ class: "form-notice", "data-form-notice": "", hidden: !notice })}>${notice ? html`<h2>${notice.title}</h2><p>${notice.text}</p>` : ""}</div>
  ${anyRequired && t("form.rule") ? html`<p class="form-rule">${t("form.rule")}</p>` : ""}
  ${def.sections.map((s) => {
    return html`<fieldset${attrs({ class: "section", "data-section": s.id, "data-show-if": s.showIf ? JSON.stringify(s.showIf) : null })}>
    <legend>${s.title}</legend>
    ${s.showIf ? html`<p class="section-intro" data-only-if>${t("form.onlyIf", { options: optionLabelFor(def, s.showIf, t) })}</p>` : ""}
    ${s.intro ? html`<p class="section-intro">${s.intro}</p>` : ""}
    ${(s.questions || []).map((q) => field(def, q, values, errors, false, t))}
  </fieldset>`;
  })}
  <div class="form-actions"><button type="submit" class="btn" data-submit>${def.submitLabel || t("form.send")}</button><p class="form-status" role="status" aria-live="polite" data-form-status></p></div>
  ${jsonIsland(`form-def-${def.key}`, publicDefinition(def))}
</form>`;
}

/* A form that is switched off. One served elsewhere for now (`elsewhere`, set at launch by
   launchForms) shows only the way to its Google Form, as the page's one big button under its own
   title and intro; the closing message is for a form that is off, not one that has moved. */
export function renderClosed(def, t, { title = null, answers = null } = {}) {
  const away = def.elsewhere ? html`<p><a class="btn btn--big" href="${def.elsewhere}" data-form-elsewhere><span class="go-label">${t("form.elsewhere.go")}</span>${icon("out", "go-ic")}</a></p>` : "";
  if (away && !answers) return html`<div class="closed-panel is-elsewhere" data-form-closed="${def.key}">${away}</div>`;
  return html`<div class="closed-panel" data-form-closed="${def.key}"><h2>${title || t("form.closed.title")}</h2><p>${def.closedMessage}</p>${away}${answers ? html`<p>${t("form.closedNow.copy")}</p><dl class="kept-answers">${answers.map((a) => html`<dt>${a.label}</dt><dd>${a.value}</dd>`)}</dl>` : ""}</div>`;
}

/* "Your reference is {{ref}}" with the reference in its own span, wherever the editor puts it. */
export function refLine(t, ref) {
  const [before, after = ""] = t("form.done.ref").split("{{ref}}");
  return html`<p>${before}<span class="ref">${ref}</span>${after}</p>`;
}

export function renderDone(def, ref, t) {
  return html`<div class="done-panel" data-form-done><h2 tabindex="-1">${def.confirmation?.title || t("form.done.title")}</h2>
  ${refLine(t, ref)}
  ${(def.confirmation?.body || []).map((p) => html`<p>${p}</p>`)}
</div>`;
}

/* What the browser is given: enough to show and hide branches and to check answers before
   sending. Internal notes (review, proposed, workflow, source) stay on the server. */
const Q_KEYS = ["id", "type", "label", "required", "options", "allowOther", "showIf", "maxLength", "min", "max", "maxSelected"];
export function publicDefinition(def) {
  return {
    schema: def.schema, key: def.key, version: def.version, title: def.title, state: def.state,
    sections: def.sections.map((s) => ({
      id: s.id, title: s.title, showIf: s.showIf,
      questions: (s.questions || []).map((q) => Object.fromEntries(Q_KEYS.filter((k) => q[k] !== undefined).map((k) => [k, k === "options" ? q.options.map((o) => ({ id: o.id, label: o.label })) : q[k]]))),
    })),
    confirmation: { title: def.confirmation?.title, body: def.confirmation?.body || [] },
  };
}
