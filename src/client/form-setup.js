import { t } from "./text.js";

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(x => x !== null && x !== false && x !== undefined));
  return node;
};
const fields = ["title", "introduction", "closedMessage", "opensAt", "deadline", "closesAt"];
const dates = new Set(["opensAt", "deadline", "closesAt"]);
const labelKey = (key, form) => key === "deadline" && form.key === "staff-application" ? "priority" : key === "title" ? "titleLabel" : key;

/* The draft lives only in this component. Back preserves it; Cancel writes nothing. */
export function formSetupWizard({ forms, connectUrl, call, say, onSaved, onClose, initialKey = "" }) {
  const allowed = forms.filter(f => f.settings && (f.canEdit || f.canSwitch));
  const box = el("div", { className: "staff-setup", tabIndex: -1 }); box.dataset.formSetup = "";
  const title = el("h3", { id: "form-setup-title", tabIndex: -1, textContent: t("staff.setup.title") });
  box.setAttribute("aria-labelledby", title.id);
  const progress = el("progress", { max: 4, value: 1 }); progress.setAttribute("aria-label", t("staff.setup.progress"));
  const stepLine = el("p", { className: "staff-setup-step" }); stepLine.setAttribute("aria-live", "polite");
  const content = el("div"), error = el("p", { role: "alert", hidden: true }), actions = el("div", { className: "staff-actions" });
  box.append(title, stepLine, progress, content, error, actions);
  let index = 0, chosen = initialKey, form = null, draft = null, availability = "keep", pending = false;
  let controls = {}, baseline = {}, touched = new Set(), conflict = false;
  const choose = key => {
    if (form?.key === key) return;
    form = allowed.find(f => f.key === key) || null; chosen = key; touched = new Set(); availability = "keep";
    if (form) { baseline = { ...form.settings }; draft = { ...form.settings }; }
  };
  if (chosen) choose(chosen);
  const capture = () => {
    for (const [key, input] of Object.entries(controls)) {
      if (key === "choose") { choose(input.value); continue; }
      if (key === "state") { availability = input.value; continue; }
      const original = dates.has(key) ? baseline[key] : baseline[key] ?? form.defaults[key];
      if (input.value !== (original || "")) { draft[key] = input.value; touched.add(key); }
      else { draft[key] = baseline[key]; touched.delete(key); }
    }
  };
  const button = (key, run, quiet = false) => {
    const b = el("button", { type: "button", className: quiet ? "btn btn--quiet" : "btn", textContent: t(key), disabled: pending });
    b.addEventListener("click", () => { if (!pending) run(); }); return b;
  };
  const addField = key => {
    const date = dates.has(key), input = el(date || key === "title" ? "input" : "textarea", {
      ...(date ? { type: "datetime-local" } : key === "title" ? { type: "text", maxLength: 200, required: true } : { rows: 4, maxLength: 8000, required: key === "closedMessage" }),
      value: (date ? draft[key] : draft[key] ?? form.defaults[key]) || "",
      id: `setup-${form.key}-${key}`,
    });
    controls[key] = input;
    return el("div", { className: "field" }, el("label", { htmlFor: input.id, textContent: t(`staff.formSettings.${labelKey(key, form)}`) }), input);
  };
  const row = (label, value) => el("div", {}, el("dt", { textContent: label }), el("dd", { textContent: value || t("staff.setup.blank") }));
  const currentValue = key => (dates.has(key) ? baseline[key] : baseline[key] ?? form.defaults[key]) || "";
  const desiredValue = key => (dates.has(key) ? draft[key] : draft[key] ?? form.defaults[key]) || "";
  function render(focus = true) {
    controls = {}; error.hidden = true; error.textContent = ""; conflict = false;
    title.textContent = t("staff.setup.title"); progress.hidden = index === 4; progress.value = Math.min(index + 1, 4);
    stepLine.textContent = index === 4 ? t("staff.setup.complete") : t("staff.setup.step", { n: index + 1, total: 4, step: t(`staff.setup.step${index}`) });
    content.replaceChildren(); actions.replaceChildren();
    if (index === 0) {
      content.append(el("p", { textContent: t("staff.setup.intro") }));
      const select = el("select", { id: "setup-form" }, el("option", { value: "", textContent: t("staff.setup.choose") }), ...allowed.map(f => el("option", { value: f.key, textContent: f.title })));
      select.value = chosen; controls.choose = select;
      content.append(el("div", { className: "field" }, el("label", { htmlFor: select.id, textContent: t("staff.setup.form") }), select));
    } else if (index === 1) {
      content.append(el("h4", { textContent: form.title }));
      if (form.canEdit) content.append(...["title", "introduction", "closedMessage"].map(addField));
      else content.append(el("p", { textContent: t("staff.setup.wordsReadOnly") }), el("dl", { className: "staff-setup-review" }, ...["title", "introduction", "closedMessage"].map(k => row(t(`staff.formSettings.${labelKey(k, form)}`), desiredValue(k)))));
    } else if (index === 2) {
      content.append(el("p", { textContent: t("staff.formSettings.help") }));
      if (form.canSwitch) {
        const select = el("select", { id: "setup-state" }, ...["keep", "open", "closed"].map(value => el("option", { value, textContent: t(`staff.setup.state.${value}`) })));
        select.value = availability; controls.state = select;
        content.append(el("div", { className: "field" }, el("label", { htmlFor: select.id, textContent: t("staff.setup.availability") }), select), ...["opensAt", "deadline", "closesAt"].map(addField));
      } else content.append(el("p", { textContent: t("staff.setup.datesReadOnly") }));
      const warning = form.key === "email-list" ? "membership" : ["staff-application", "volunteer-application", "recommendation-letter"].includes(form.key) ? "recruitment" : form.key === "resource-request" ? "materials" : "delivery";
      content.append(el("p", { className: "staff-note", textContent: t(`staff.setup.warning.${warning}`) }));
    } else if (index === 3) {
      content.append(el("p", { textContent: t(availability === "open" ? "staff.setup.reviewOpen" : "staff.setup.review") }));
      const dl = el("dl", { className: "staff-setup-review" }, row(t("staff.setup.form"), desiredValue("title")), row(t("staff.setup.availability"), t(`staff.setup.state.${availability}`)));
      for (const key of fields) {
        const change = touched.has(key);
        const part = row(t(`staff.formSettings.${labelKey(key, form)}`), desiredValue(key));
        if (change) part.append(el("p", { className: "staff-setup-before", textContent: t("staff.setup.was", { value: currentValue(key) || t("staff.setup.blank") }) }));
        dl.append(part);
      }
      content.append(dl);
      if (form.workflow) content.append(el("p", { textContent: t("staff.setup.receiving", { owner: form.workflow.owner, destination: t(`staff.setup.destination.${form.workflow.destination}`) }) }));
      content.append(el("p", { className: "staff-note", textContent: t("staff.setup.deliveryNote") }));
      if (connectUrl) content.append(el("p", {}, el("a", { href: `${connectUrl}/`, target: "_blank", rel: "noopener", textContent: t("staff.answers.openConnect") })));
    } else {
      content.append(el("p", { textContent: t("staff.setup.saved", { title: form.title }) }), el("p", { textContent: t(form.stateReason === "scheduled" ? "staff.formSettings.enabledLater" : form.stateReason === "ended" ? "staff.formSettings.ended" : form.state === "open" ? "staff.switch.opened" : "staff.switch.closed", { title: form.title }) }),
        el("p", {}, el("a", { href: `/forms/${encodeURIComponent(form.key)}/`, target: "_blank", rel: "noopener", textContent: t("staff.setup.viewForm") })));
      actions.append(button("staff.setup.another", () => { index = 0; chosen = ""; form = null; draft = null; render(); }), button("staff.setup.done", () => onClose(form.key), true));
      if (focus) title.focus(); return;
    }
    actions.append(button("staff.setup.cancel", () => onClose(), true));
    if (index > 0) actions.append(button("staff.setup.back", () => { capture(); index--; render(); }, true));
    actions.append(button(index === 3 ? availability === "open" ? "staff.setup.applyOpen" : availability === "closed" ? "staff.setup.applyClose" : "staff.setup.apply" : "staff.setup.next", () => index === 3 ? save() : next()));
    if (focus) title.focus();
  }
  function next() {
    for (const input of Object.values(controls)) if (!input.checkValidity()) { input.reportValidity(); return; }
    capture();
    if (index === 0 && !form) { error.hidden = false; error.textContent = t("staff.setup.chooseRequired"); controls.choose.focus(); return; }
    index++; render();
  }
  async function reload() {
    if (pending) return; pending = true;
    const response = await call("/api/staff/forms").catch(() => ({ status: 0, body: {} })); pending = false;
    const latest = response.body.forms?.find(f => f.key === form.key);
    if (response.status !== 200 || !latest?.settings || (!latest.canEdit && !latest.canSwitch)) { showError(response); return; }
    if ([...touched].some(key => dates.has(key) ? !latest.canSwitch : !latest.canEdit) || (availability !== "keep" && !latest.canSwitch)) { showError({ status: 403, body: {} }); return; }
    const edits = Object.fromEntries([...touched].map(key => [key, draft[key]]));
    form = latest; baseline = { ...latest.settings }; draft = { ...latest.settings, ...edits };
    index = 3; render(); error.hidden = false; error.textContent = t("staff.setup.reloaded"); say(error.textContent);
  }
  function showError(response) {
    const code = response.body.error || ""; conflict = response.status === 409 && code === "settings.conflict";
    error.hidden = false;
    error.textContent = t(conflict ? "staff.setup.conflict" : code === "switch.empty" ? "staff.switch.empty" : code.startsWith("settings.") ? "staff.formSettings.invalid" : response.status === 401 || code === "auth.again" ? "staff.ended" : response.status === 403 ? "staff.forbidden" : "staff.loadError");
    if (conflict) actions.append(button("staff.setup.reload", reload, true));
    say(error.textContent); error.tabIndex = -1; error.focus();
  }
  async function save() {
    if (pending) return; pending = true; actions.querySelectorAll("button").forEach(b => { b.disabled = true; }); box.setAttribute("aria-busy", "true");
    const response = await call(`/api/staff/forms/${encodeURIComponent(form.key)}/setup`, { method: "POST", body: { settings: draft, state: availability, expectedState: form.manualState || form.state, formVersion: form.definitionVersion, ...(availability === "open" ? { confirm: form.key } : {}) } }).catch(() => ({ status: 0, body: {} }));
    pending = false; box.removeAttribute("aria-busy");
    if (!box.isConnected) return;
    if (response.status !== 200) { if (["settings.date", "settings.order"].includes(response.body.error)) index = 2; else if (response.body.error === "settings.words") index = 1; render(false); showError(response); return; }
    form = response.body.forms.find(f => f.key === form.key); allowed[allowed.findIndex(f => f.key === form.key)] = form; onSaved(form); index = 4; render();
    if (response.body.purgeError) content.append(el("p", { textContent: t("staff.switch.slow") }));
    say(t("staff.setup.saved", { title: form.title }));
  }
  render(false); queueMicrotask(() => title.focus());
  return box;
}
