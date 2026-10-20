/* The mood check-in, sent with fetch so the page stays put. Sends only the mood id. The answer
   shows one supportive line and how Badgers are doing today, as counts with words, never colour
   alone. Nothing here talks to analytics. */

import { t } from "./text.js";

const form = document.querySelector("form[data-mood]");
const out = document.querySelector("[data-mood-result]");
if (form && out) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    if (!btn) return;
    for (const b of form.querySelectorAll(".mood-btn")) b.setAttribute("aria-pressed", String(b === btn));
    let body;
    try {
      const res = await fetch("/api/mood", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ mood: btn.value }) });
      body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || "failed");
    } catch {
      out.hidden = false;
      out.replaceChildren(Object.assign(document.createElement("p"), { textContent: t("mood.error") }));
      out.focus();
      return;
    }
    const total = body.counts.reduce((s, c) => s + c.n, 0) || 1;
    const msg = Object.assign(document.createElement("p"), { className: "msg", textContent: body.message });
    const head = Object.assign(document.createElement("p"), { textContent: t(body.total === 1 ? "mood.count.one" : "mood.count.other", { n: body.total }) });
    const ul = document.createElement("ul");
    ul.className = "mood-bars";
    for (const c of body.counts) {
      const li = document.createElement("li");
      li.className = `mood-${c.id}`;
      const label = Object.assign(document.createElement("span"), { textContent: c.label });
      const bar = Object.assign(document.createElement("span"), { className: "bar" });
      const fill = document.createElement("span");
      fill.style.width = `${Math.round((c.n / total) * 100)}%`;
      bar.append(fill);
      const n = Object.assign(document.createElement("span"), { className: "n", textContent: String(c.n) });
      li.append(label, bar, n);
      ul.append(li);
    }
    const after = Object.assign(document.createElement("p"), { textContent: body.after });
    out.replaceChildren(msg, head, ul, after);
    out.hidden = false;
    out.focus();
  });
}
