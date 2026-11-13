/* The mood check-in, sent with fetch so the page stays put. Sends only the mood id. The answer
   shows one supportive line and how Badgers are doing today, as counts with words, never colour
   alone. Nothing here talks to analytics. A tap also bursts a little confetti from the feeling,
   as the live check-in does — decoration only, drawn here, and never for a visitor who asked
   their device to reduce motion. */

import { t } from "./text.js";

const form = document.querySelector("form[data-mood]");
const out = document.querySelector("[data-mood-result]");
if (form && out) {
  /* Each button's colour, laid on from its data-color: the generated sheet colours the build's
     feelings, and this gives a set saved in Site Settings its own colours in the same variable
     everything here reads. Set from script, as the site's style policy allows; the markup itself
     carries no style. */
  for (const b of form.querySelectorAll(".mood-btn")) if (b.dataset.color) b.style.setProperty("--mood", b.dataset.color);

  /* A short burst of confetti from the tapped feeling, on a canvas laid over the section and
     taken away when it settles. It starts before the answer is asked for and never waits for
     it, so a slow answer never delays it and it never delays the answer. Reduced motion: no
     canvas is made at all — the tap, the count and the reply work exactly the same. */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function confettiBurst(btn) {
    if (reduceMotion.matches) return;
    const section = btn.closest(".mood");
    if (!section || !section.getClientRects().length) return;
    const srect = section.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.className = "mood-confetti";
    canvas.setAttribute("aria-hidden", "true");
    canvas.width = Math.round(srect.width * dpr);
    canvas.height = Math.round(srect.height * dpr);
    section.append(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }
    const b = btn.getBoundingClientRect();
    const ox = (b.left + b.width / 2 - srect.left) * dpr;
    const oy = (b.top + b.height / 2 - srect.top) * dpr;
    const palette = [...form.querySelectorAll(".mood-btn")].map((x) => x.dataset.color).filter(Boolean);
    const colors = palette.length ? palette : ["#b60000"];
    const parts = Array.from({ length: 44 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const v = (5 + Math.random() * 7) * dpr;
      return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: (4 + Math.random() * 4) * dpr,
        h: (6 + Math.random() * 5) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        color: colors[i % colors.length], circle: i % 3 === 0 };
    });
    const start = performance.now();
    const LIFE = 950;
    (function frame(now) {
      const age = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (age < LIFE) {
        const fade = 1 - age / LIFE;
        for (const p of parts) {
          p.vy += 0.16 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.globalAlpha = Math.max(fade, 0); ctx.fillStyle = p.color;
          if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
          else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        requestAnimationFrame(frame);
      } else canvas.remove();
    })(start);
    setTimeout(() => canvas.remove(), LIFE + 500); // a hidden tab pauses the frames; never leave the canvas behind
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    if (!btn) return;
    for (const b of form.querySelectorAll(".mood-btn")) b.setAttribute("aria-pressed", String(b === btn));
    confettiBurst(btn);
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
      if (c.color) li.style.setProperty("--mood", c.color);
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
