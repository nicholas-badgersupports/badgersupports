/* A native form as HTML, from its definition.
 *
 * The same function renders the static page (empty, at build) and the server's reply to a
 * no-JavaScript submission that needs correcting (with the person's answers and the errors), so
 * a mistake never costs anyone what they typed.
 *
 * Conventions: label above control; a question's help (its own instructions, as prose) sits
 * between label and control, then the error, and aria-describedby names both; groups of choices
 * are a fieldset with a legend; optional questions say "(optional)" and required ones carry the
 * required attribute. Each section's title is a heading, so the page reads h1 form, h2 section,
 * h3 heading inside a section's words. A section with no questions is words only, not a fieldset.
 */

import { html, attrs, jsonIsland, breakAtSign } from "./html.mjs";
import { QUESTION_TYPES, OTHER, LINK_MAX, errorText, allQuestions } from "../shared/forms.mjs";
import { icon } from "./icons.mjs";
import { go } from "./context.mjs";

const fid = (q) => `f-${q.id}`;
const eid = (q) => `e-${q.id}`;
const hid = (q) => `h-${q.id}`;

/* Prose (src/shared/forms.mjs proseProblem): a string is one paragraph; a list holds paragraphs,
   { heading }, { list, ordered }, { links } and { more, body }, which is a closed <details> under
   its label. `level` is the heading level its headings take.
   With ctx, links resolve the site's way and show as its pills; without, they are plain links. */
export function prose(v, { level = 3, ctx = null } = {}) {
  if (v == null || v === "") return "";
  return (typeof v === "string" ? [v] : v).map((p) => {
    if (typeof p === "string") return html`<p>${breakAtSign(p)}</p>`;
    if (p.heading) return level === 2 ? html`<h2>${p.heading}</h2>` : html`<h3>${p.heading}</h3>`;
    if (p.list) {
      const items = p.list.map((x) => html`<li>${breakAtSign(x)}</li>`);
      return p.ordered ? html`<ol>${items}</ol>` : html`<ul>${items}</ul>`;
    }
    if (p.links) return html`<ul class="more-links">${p.links.map((l) => html`<li>${ctx ? go(ctx, l.href, l.label) : html`<a href="${l.href}">${l.label}</a>`}</li>`)}</ul>`;
    if (p.more) return html`<details class="prose-more"><summary>${p.more}</summary><div class="prose-more-body">${prose(p.body, { level, ctx })}</div></details>`;
    return "";
  });
}

function optionLabelFor(def, cond, t) {
  const target = allQuestions(def).find(({ q }) => q.id === cond.question)?.q;
  const ids = "in" in cond ? cond.in : [cond.equals ?? cond.includes];
  const labels = ids.map((id) => (target?.options || []).find((o) => o.id === id)?.label || id);
  return labels.map((l) => `“${l}”`).join(` ${t("form.or")} `);
}

/* A ranking's value as option id -> rank: an object from the form's selects, or the list of ids
   (first choice first) a checked answer becomes. */
function rankOf(value, id) {
  if (Array.isArray(value)) return value.includes(id) ? String(value.indexOf(id) + 1) : "";
  const v = value && typeof value === "object" && Object.hasOwn(value, id) ? value[id] : "";
  return String(Array.isArray(v) ? v[0] ?? "" : v ?? "");
}

function control(q, value, otherValue, aria, t) {
  const common = { id: fid(q), name: q.id, required: q.required || null, "aria-describedby": aria.describedBy, "aria-invalid": aria.invalid ? "true" : null };
  switch (q.type) {
    case "long":
      return html`<textarea${attrs({ ...common, rows: q.rows || 5, maxlength: q.maxLength || QUESTION_TYPES.long.max })}>${value || ""}</textarea>`;
    case "links": {
      const max = q.maxLinks || QUESTION_TYPES.links.maxItems;
      return html`<textarea${attrs({ ...common, rows: q.rows || max, maxlength: max * (LINK_MAX + 2), inputmode: "url", spellcheck: "false", autocomplete: "off" })}>${Array.isArray(value) ? value.join("\n") : value || ""}</textarea>`;
    }
    case "select":
      return html`<select${attrs(common)}><option value="">${t("form.choose")}</option>${q.options.map((o) => html`<option${attrs({ value: o.id, selected: value === o.id })}>${o.label}</option>`)}</select>`;
    /* The address can choose the resource (?<question id>=<resource id>, src/client/form.js), so a
       resource's own Report a Problem opens with it chosen. */
    case "resource":
      return html`<select${attrs({ ...common, "data-from-address": "" })}><option value="">${t("form.choose")}</option>${(q.resources || []).map((r) => html`<option${attrs({ value: r.id, selected: value === r.id })}>${r.name}</option>`)}</select>`;
    case "rank": {
      const places = q.options.map((_, i) => String(i + 1));
      return html`<div class="rank">${q.options.map((o, i) => {
        const id = i === 0 ? fid(q) : `${fid(q)}-${o.id}`;
        const now = rankOf(value, o.id);
        return html`<div class="rank-row"><label for="${id}">${o.label}</label><select${attrs({
          id, name: `${q.id}.${o.id}`, required: q.required || null, "aria-label": t("form.rankLabel", { option: o.label }),
          "aria-describedby": i === 0 ? aria.describedBy : null, "aria-invalid": i === 0 && aria.invalid ? "true" : null,
        })}><option value="">${t("form.choose")}</option>${places.map((n) => html`<option${attrs({ value: n, selected: now === n })}>${n}</option>`)}</select></div>`;
      })}</div>`;
    }
    case "choice":
    case "checkboxes": {
      const multi = q.type === "checkboxes";
      const picked = (id) => (multi ? (value || []).includes(id) : value === id);
      const opts = [...q.options, ...(q.allowOther ? [{ id: OTHER, label: t("form.other") }] : [])];
      return html`<div class="choices">${opts.map((o, i) => html`<label class="choice"><input${attrs({
        type: multi ? "checkbox" : "radio", name: q.id, value: o.id, id: i === 0 ? fid(q) : `${fid(q)}-${o.id}`,
        checked: picked(o.id), required: !multi && q.required ? true : null,
        "aria-describedby": i === 0 ? aria.describedBy : null, "aria-invalid": i === 0 && aria.invalid ? "true" : null,
        "data-other": o.id === OTHER ? "" : null,
      })}><span>${o.label}</span></label>`)}${q.allowOther ? html`<input${attrs({ type: "text", class: "other-text", name: `${q.id}${OTHER}`, id: `${fid(q)}-other-text`, value: otherValue || "", maxlength: 200, "aria-label": t("form.otherLabel", { label: q.label }) })}>` : ""}</div>`;
    }
    case "confirm":
      return html`<label class="choice"><input${attrs({ ...common, type: "checkbox", value: "yes", checked: value === "yes" })}><span>${q.confirmText || q.label}</span></label>`;
    case "file": {
      /* The chosen file goes up on its own (src/client/form.js) and this form sends only the id the
         server gave it, in the hidden input. The file input has no name, so a file is never posted
         with the answers. Without JavaScript nothing can go up, and the page says so. */
      const kept = Array.isArray(value) ? value[0] || "" : value || "";
      return html`<div class="upload" data-upload="${q.id}"><input${attrs({ ...common, name: null, type: "file", accept: QUESTION_TYPES.file.accept, required: q.required && !kept ? true : null, "data-file": "" })}><input${attrs({ type: "hidden", name: q.id, value: kept, "data-file-id": "" })}><p class="upload-status" role="status" aria-live="polite" data-upload-status></p><noscript><p class="upload-note">${t("form.upload.needsScript")}</p></noscript></div>`;
    }
    default: {
      const input = QUESTION_TYPES[q.type]?.input || "text";
      return html`<input${attrs({
        ...common, type: input, value: value ?? "",
        autocomplete: q.autocomplete || (input === "email" ? "email" : input === "tel" ? "tel" : null),
        inputmode: q.type === "number" ? "numeric" : null,
        min: q.type === "number" ? q.min : null, max: q.type === "number" ? q.max : null,
        step: q.type === "datetime" ? 900 : null,
        maxlength: ["short", "email", "tel"].includes(q.type) ? q.maxLength || QUESTION_TYPES[q.type].max : null,
        spellcheck: q.type === "email" ? "false" : null,
      })}>`;
    }
  }
}

function field(def, q, values, errors, t, ctx) {
  const code = errors[q.id];
  const help = q.help ? html`<div class="field-help" id="${hid(q)}">${prose(q.help, { ctx })}</div>` : "";
  const err = code ? html`<p class="field-error" id="${eid(q)}">${errorText(code, q, t)}</p>` : "";
  const aria = { describedBy: [q.help ? hid(q) : null, code ? eid(q) : null].filter(Boolean).join(" ") || null, invalid: !!code };
  const group = ["choice", "checkboxes", "rank"].includes(q.type);
  const label = html`${q.label}${q.required ? "" : html` <span class="optional">${t("form.optional")}</span>`}`;
  const cls = code ? "field has-error" : "field";
  const common = { class: cls, "data-q": q.id, "data-show-if": q.showIf ? JSON.stringify(q.showIf) : null };
  const input = control(q, values[q.id], values[`${q.id}${OTHER}`], aria, t);
  if (group) return html`<fieldset${attrs(common)}><legend class="q-label">${label}</legend>${help}${err}${input}</fieldset>`;
  // A confirmation's label is its checkbox's words; a heading-like label above it says what it is about.
  if (q.type === "confirm") return html`<div${attrs(common)}>${q.confirmText ? html`<p class="q-label">${label}</p>` : ""}${help}${err}${input}</div>`;
  return html`<div${attrs(common)}><label for="${fid(q)}">${label}</label>${help}${err}${input}</div>`;
}

function section(def, s, values, errors, t, ctx) {
  const qs = s.questions || [];
  const showIf = s.showIf ? JSON.stringify(s.showIf) : null;
  const only = s.showIf ? html`<p class="section-intro" data-only-if>${t("form.onlyIf", { options: optionLabelFor(def, s.showIf, t) })}</p>` : "";
  const intro = s.intro ? html`<div class="section-intro">${prose(s.intro, { ctx })}</div>` : "";
  if (qs.length === 0) return html`<div${attrs({ class: "section is-words", "data-section": s.id, "data-show-if": showIf })}><h2>${s.title}</h2>${only}${intro}</div>`;
  return html`<fieldset${attrs({ class: "section", "data-section": s.id, "data-show-if": showIf })}>
    <legend><h2>${s.title}</h2></legend>
    ${only}${intro}
    ${qs.map((q) => field(def, q, values, errors, t, ctx))}
  </fieldset>`;
}

/* errors: { questionId: code }. notice: { title, text } shown above the form (stale tab, closed
   while open, version changed), with `kept` label/value rows under `keptText` when answers are
   given back rather than sent. idemKey: carried through a no-JS correction so a resend is the
   same submission. ctx: the render context, for links inside the form's words. preview: the form
   shown for review while it is closed (prototype builds only); the browser sends nothing. */
export function renderForm(def, { t, values = {}, errors = {}, notice = null, idemKey = "", ctx = null, preview = false }) {
  const anyErrors = Object.keys(errors).length > 0;
  const anyRequired = allQuestions(def).some(({ q }) => q.required);
  const ordered = allQuestions(def).filter(({ q }) => errors[q.id]);
  const shown = notice || (preview ? { title: t("form.preview.title"), text: t("form.preview.body") } : null);
  return html`<form${attrs({ class: "bss-form", method: "post", action: `/api/forms/${def.key}/submit`, "data-form": def.key, "data-version": def.version, "data-preview": preview ? "" : null })}>
  <input type="hidden" name="_form" value="${def.key}"><input type="hidden" name="_version" value="${def.version}"><input type="hidden" name="_key" value="${idemKey}" data-idem>
  <div class="hp" aria-hidden="true"><label>${t("form.trap")} <input type="text" name="_website" tabindex="-1" autocomplete="off" value=""></label></div>
  <div${attrs({ class: "error-summary", tabindex: "-1", "data-error-summary": "", hidden: !anyErrors, role: anyErrors ? "alert" : null })}>
    <h2>${t("form.errors.title")}</h2>
    <p>${ordered.length === 1 ? t("form.errors.one") : t("form.errors.many", { n: ordered.length })}</p>
    <ul data-error-list>${ordered.map(({ q }) => html`<li><a href="#${fid(q)}">${errorText(errors[q.id], q, t)}</a></li>`)}</ul>
  </div>
  <div${attrs({ class: "form-notice", "data-form-notice": "", hidden: !shown })}>${shown ? html`<h2>${shown.title}</h2><p>${shown.text}</p>${shown.kept?.length ? html`<p>${shown.keptText}</p><dl class="kept-answers">${shown.kept.map((a) => html`<dt>${a.label}</dt><dd>${a.value}</dd>`)}</dl>` : ""}` : ""}</div>
  ${anyRequired && t("form.rule") ? html`<p class="form-rule">${t("form.rule")}</p>` : ""}
  ${def.sections.map((s) => section(def, s, values, errors, t, ctx))}
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
  return html`<div class="closed-panel" data-form-closed="${def.key}"><h2>${title || t("form.closed.title")}</h2><p>${breakAtSign(def.closedMessage)}</p>${away}${answers ? html`<p>${t("form.closedNow.copy")}</p><dl class="kept-answers">${answers.map((a) => html`<dt>${a.label}</dt><dd>${a.value}</dd>`)}</dl>` : ""}</div>`;
}

/* "Your reference is {{ref}}" with the reference in its own span, wherever the editor puts it. */
export function refLine(t, ref) {
  const [before, after = ""] = t("form.done.ref").split("{{ref}}");
  return html`<p>${before}<span class="ref">${ref}</span>${after}</p>`;
}

export function renderDone(def, ref, t) {
  return html`<div class="done-panel" data-form-done><h2 tabindex="-1">${def.confirmation?.title || t("form.done.title")}</h2>
  ${refLine(t, ref)}
  ${(def.confirmation?.body || []).map((p) => html`<p>${breakAtSign(p)}</p>`)}
</div>`;
}

/* What the browser is given: enough to show and hide branches and to check answers before
   sending. Words already on the page (help, intros) and internal notes (review, proposed,
   workflow, source) stay out. */
const Q_KEYS = ["id", "type", "label", "required", "options", "allowOther", "showIf", "maxLength", "min", "max", "maxSelected", "maxLinks"];
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
