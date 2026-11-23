/* The mood check-in, sent with fetch so the page stays put. Sends only the mood id. The answer
   shows one supportive line and how Badgers are doing today, as counts with words, never colour
   alone. Nothing here talks to analytics. A saved tap also bursts a little confetti from the feeling,
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

  /* The celebration: one of three little shows, picked at random on each saved tap — a bloom
     of petals bursting from the feeling, petals drifting down the band, or bubbles rising
     from the feeling. The pieces are drawn as real shapes and moved the way the established
     confetti work moves its pieces (canvas-confetti is the reference): every piece carries
     its own size, speed, spin and lifetime, drawn from ranges rather than one shared value;
     a burst is layered in bands of speeds so it reads as one organic bloom; speed decays
     against air drag while gravity pulls; and flat pieces tumble — their drawn height is
     scaled by the cosine of a turning tilt, so a piece flips edge-on as it turns and shows
     a darker back, the way a real scrap of paper does. Falling pieces sway on a sine and
     rock with the sway instead of dropping straight. No colour values live here: the
     feelings' colours come from the buttons, and light and shade are laid on with white
     and black at part strength. The canvas lies over the section and is taken away when
     the show settles, and the falling petals dissolve before they can reach the reply
     below. It fires only once the tap has been saved, so the celebration never runs ahead
     of the answer it celebrates, and a save that fails gets no show.
     Reduced motion: no canvas is made at all — the tap, the count and the reply work exactly the same. */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const WHITE = "#ffffff";
  const BLACK = "#000000";

  /* A petal, drawn around its centre with its tip up: two unlike curves meeting at the tip
     and the base, the right side fuller than the left, so the shape reads as a petal rather
     than an ellipse or a mirrored leaf. */
  function petalPath(ctx, w, l) {
    ctx.beginPath();
    ctx.moveTo(0, -l / 2);
    ctx.bezierCurveTo(w * 0.60, -l * 0.32, w * 0.56, l * 0.20, 0, l / 2);
    ctx.bezierCurveTo(-w * 0.42, l * 0.20, -w * 0.46, -l * 0.32, 0, -l / 2);
    ctx.closePath();
  }

  /* A petal at its tilt: face up it wears a soft sheen and the fold down its middle; turned
     past edge-on it shows its back, the same colour shaded; at edge-on it is a sliver. */
  function drawPetal(ctx, p, alpha) {
    const tilt = Math.cos(p.flip);
    ctx.save();
    ctx.translate(p.x + (p.swayX || 0), p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, tilt);
    petalPath(ctx, p.w, p.l);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fill();
    if (tilt > 0.25) {
      ctx.globalAlpha = alpha * 0.10;
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -p.l * 0.38);
      ctx.quadraticCurveTo(p.w * 0.10, 0, 0, p.l * 0.40);
      ctx.globalAlpha = alpha * 0.22;
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = Math.max(1, p.w * 0.07);
      ctx.stroke();
    } else if (tilt < -0.25) {
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = BLACK;
      ctx.fill();
    }
    ctx.restore();
  }

  /* A pollen dot: a small round bead in the feeling's colour with one point of light on it.
     In the bloom these are the deliberate accents among the petals, not filler. */
  function drawDot(ctx, p, alpha) {
    ctx.save();
    ctx.translate(p.x + (p.swayX || 0), p.y);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(-p.r * 0.32, -p.r * 0.32, p.r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* A bubble: glass first — white laid on, then the feeling's colour over it, each at part
     strength, so the bubble reads as a tint of its colour rather than a flat disc — then
     the rim, then the light. The light always comes from the same corner of the room: a
     crescent high on the left and a fainter one low on the right, and neither turns or
     wobbles with the bubble. */
  function drawBubble(ctx, p, alpha) {
    const r = p.r * p.grow;
    ctx.save();
    ctx.translate(p.x + (p.swayX || 0), p.y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.10;
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.globalAlpha = alpha * 0.16;
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.stroke();
    ctx.strokeStyle = WHITE;
    ctx.lineCap = "round";
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, Math.PI * 0.95, Math.PI * 1.5);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.28;
    ctx.lineWidth = Math.max(1, r * 0.11);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.66, Math.PI * 0.12, Math.PI * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  /* The ring a bubble leaves as it pops: a thin circle in its colour, widening and thinning
     as it fades. */
  function drawRing(ctx, p, alpha) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, p.r * 0.10 * (1 - p.frac));
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* Show one: the bloom. Petals and pollen dots burst from the tapped feeling in every
     direction, in three bands of speed at once — the layering the confetti libraries use
     to keep a burst from looking like one shell of identical pieces. Half the petals wear
     the tapped feeling's own colour. Air drag is strong, so the bloom opens, hangs, and
     drifts down as it fades, settled inside about a second and three quarters. */
  function bloomShow(env) {
    const parts = [];
    for (let i = 0; i < 66; i++) {
      const dot = i >= 50;
      const a = Math.random() * Math.PI * 2;
      const band = Math.random();
      const v = (band < 0.4 ? 6.5 + Math.random() * 4.5 : band < 0.75 ? 3.8 + Math.random() * 2.8 : 1.8 + Math.random() * 2.2) * env.dpr;
      const l = (9 + Math.random() * 6) * env.dpr;
      parts.push({
        kind: dot ? "dot" : "petal",
        x: env.ox, y: env.oy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.1 * env.dpr,
        drag: 0.90 + Math.random() * 0.05,
        w: l * 0.52, l, r: (1.6 + Math.random() * 1.5) * env.dpr,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.16,
        flip: Math.random() * Math.PI * 2, vflip: (0.10 + Math.random() * 0.22) * (Math.random() < 0.5 ? -1 : 1),
        born: 0, life: 1350 + Math.random() * 400,
        color: i % 2 ? env.own : env.colors[i % env.colors.length],
        swayX: 0,
      });
    }
    return {
      parts, life: 1800,
      step(p, a, dt) {
        const dragF = Math.pow(p.drag, dt);
        p.vx *= dragF;
        p.vy = p.vy * dragF + 0.055 * env.dpr * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vflip * dt;
        const fadeTop = env.replyTop - 130 * env.dpr;
        p.alphaMul = p.y <= fadeTop ? 1 : Math.max(0, (env.replyTop - 40 * env.dpr - p.y) / (90 * env.dpr));
      },
    };
  }

  /* Show two: petals drifting down. Petals in the five feelings' colours enter across the
     top of the band and fall the way leaves fall — each easing up to its own gentle terminal
     speed, swaying on a sine, rocking with the sway, and turning slowly enough to show a
     face, an edge and a back in turn. They dissolve as they near the reply below, so the
     answer is never covered, and the last of them is gone by about three seconds. */
  function petalFallShow(env) {
    const parts = [];
    const LIFE = 3050;
    for (let i = 0; i < 42; i++) {
      const born = i * 16 + Math.random() * 160;
      const l = (12 + Math.random() * 8) * env.dpr;
      parts.push({
        kind: "petal",
        x: Math.random() * env.W, y: (-14 - Math.random() * 26) * env.dpr,
        vy: 0, term: (0.6 + Math.random() * 0.65) * env.dpr,
        w: l * 0.52, l,
        phase: Math.random() * Math.PI * 2,
        swayAmp: (9 + Math.random() * 9) * env.dpr,
        swaySpeed: 0.0016 + Math.random() * 0.0012,
        rockAmp: 0.55 + Math.random() * 0.35,
        flip: Math.random() * Math.PI * 2, vflip: (0.05 + Math.random() * 0.06) * (Math.random() < 0.5 ? -1 : 1),
        born, life: LIFE - born, fadeFrom: 0.75,
        color: env.colors[i % env.colors.length],
        swayX: 0, rot: 0,
      });
    }
    const fadeTop = env.replyTop - 150 * env.dpr;
    const fadeSpan = 114 * env.dpr;
    return {
      parts, life: LIFE,
      step(p, a, dt) {
        p.vy += (p.term - p.vy) * 0.03 * dt;
        p.y += p.vy * dt;
        p.swayX = Math.sin(a * p.swaySpeed + p.phase) * p.swayAmp;
        p.rot = Math.sin(a * p.swaySpeed * 0.8 + p.phase) * p.rockAmp;
        p.flip += p.vflip * dt;
        p.alphaMul = p.y < fadeTop ? 1 : Math.max(0, 1 - (p.y - fadeTop) / fadeSpan);
      },
    };
  }

  /* Show three: bubbles rising. Tinted bubbles float up from the tapped feeling, wobbling
     as they rise and swelling a little, the smaller ones behind the larger. Each pops at
     its own moment near the end of its rise — a widening ring and three droplets — and the
     last of them is gone by about two and a third seconds. */
  function bubbleShow(env) {
    const parts = [];
    const LIFE = 2350;
    for (let i = 0; i < 34; i++) {
      const born = i * 13 + Math.random() * 130;
      parts.push({
        kind: "bubble",
        x: env.ox + (Math.random() - 0.5) * env.bw * 0.92,
        y: env.oy + (Math.random() - 0.5) * env.bh * 0.5,
        vy: (0.85 + Math.random() * 1.05) * env.dpr,
        r: (3 + Math.random() * 6.5) * env.dpr,
        grow: 1,
        phase: Math.random() * Math.PI * 2,
        swayAmp: (3.5 + Math.random() * 3) * env.dpr,
        swaySpeed: 0.0028 + Math.random() * 0.0016,
        born, life: Math.min(1500 + Math.random() * 450, LIFE - born), fadeFrom: 0.97,
        popAt: 0.8 + Math.random() * 0.17, popped: false,
        color: env.colors[i % env.colors.length],
        swayX: 0,
      });
    }
    parts.sort((m, n) => m.r - n.r);
    return {
      parts, life: LIFE,
      step(p, a, dt, env2, show) {
        if (p.kind === "ring") { p.r += 0.55 * env.dpr * dt; return; }
        if (p.kind === "dot") {
          p.vy += 0.03 * env.dpr * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          return;
        }
        p.y -= p.vy * dt;
        p.swayX = Math.sin(a * p.swaySpeed + p.phase) * p.swayAmp;
        p.grow = 1 + p.frac * 0.3;
        if (!p.popped && p.frac >= p.popAt) {
          p.popped = true;
          p.alphaMul = 0;
          const px = p.x + p.swayX;
          show.parts.push({ kind: "ring", x: px, y: p.y, r: p.r * p.grow, born: p.born + a, life: 170, color: p.color, swayX: 0, frac: 0 });
          for (let k = 0; k < 3; k++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = (0.5 + Math.random() * 0.9) * env.dpr;
            show.parts.push({ kind: "dot", x: px, y: p.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.3 * env.dpr, r: (0.9 + Math.random() * 0.8) * env.dpr, born: p.born + a, life: 190, color: p.color, swayX: 0, frac: 0 });
          }
        }
      },
    };
  }

  /* The frame loop every show runs on: real time, not frame counts, so a slow device slows
     nothing down — each step is measured in sixtieths of a second, capped so a stalled tab
     cannot make the pieces jump. A piece fades in as it is born and out over the last part
     of its life; the show's own step can fade it sooner (the falling petals near the reply).
     When the show's time is spent the canvas is taken away, and a timer behind the loop
     takes it away even if a hidden tab pauses the frames. */
  function runShow(env, show) {
    const start = performance.now();
    let last = start;
    (function frame(now) {
      const age = now - start;
      const dt = Math.min(Math.max(now - last, 0), 50) / 16.667;
      last = now;
      env.ctx.clearRect(0, 0, env.W, env.H);
      if (age >= show.life) { env.canvas.remove(); return; }
      for (let i = 0; i < show.parts.length; i++) {
        const p = show.parts[i];
        const a = age - p.born;
        if (a < 0) continue;
        const frac = a / p.life;
        if (frac >= 1) continue;
        p.frac = frac;
        show.step(p, a, dt, env, show);
        let alpha = Math.min(a / 130, 1);
        const fadeFrom = p.fadeFrom === undefined ? 0.68 : p.fadeFrom;
        if (frac > fadeFrom) alpha *= 1 - (frac - fadeFrom) / (1 - fadeFrom);
        if (p.alphaMul !== undefined) alpha *= p.alphaMul;
        if (alpha <= 0) continue;
        if (p.kind === "petal") drawPetal(env.ctx, p, alpha);
        else if (p.kind === "dot") drawDot(env.ctx, p, alpha);
        else if (p.kind === "bubble") drawBubble(env.ctx, p, alpha);
        else if (p.kind === "ring") drawRing(env.ctx, p, alpha);
      }
      requestAnimationFrame(frame);
    })(start);
    setTimeout(() => env.canvas.remove(), show.life + 600);
  }

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
    const palette = [...form.querySelectorAll(".mood-btn")].map((x) => x.dataset.color).filter(Boolean);
    const colors = palette.length ? palette : ["#b60000"];
    const orect = out.getBoundingClientRect();
    const env = {
      ctx, canvas, dpr, W: canvas.width, H: canvas.height,
      ox: (b.left + b.width / 2 - srect.left) * dpr,
      oy: (b.top + b.height / 2 - srect.top) * dpr,
      bw: b.width * dpr, bh: b.height * dpr,
      colors, own: btn.dataset.color || colors[0],
      /* The reply's top edge, so the falling petals can dissolve before they reach it.
         If it cannot be measured, the last two fifths of the band stand in for it. */
      replyTop: orect.height ? (orect.top - srect.top) * dpr : canvas.height * 0.6,
    };
    const shows = [bloomShow, petalFallShow, bubbleShow];
    runShow(env, shows[Math.floor(Math.random() * shows.length)](env));
  }

  /* While the tap is being saved, the buttons rest disabled under a "Sending…" line in the
     result's own place: a second tap cannot send twice, and the wait is never silent. The
     confetti waits for the saved answer. A failure leaves the error line there, and the
     buttons free up to try again. */
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    if (!btn || sending) return;
    sending = true;
    const buttons = form.querySelectorAll(".mood-btn");
    for (const b of buttons) { b.setAttribute("aria-pressed", String(b === btn)); b.disabled = true; }
    form.setAttribute("aria-busy", "true");
    const finish = () => { sending = false; for (const b of buttons) b.disabled = false; form.removeAttribute("aria-busy"); };
    out.replaceChildren(Object.assign(document.createElement("p"), { textContent: t("mood.sending") }));
    out.hidden = false;
    let body;
    try {
      const res = await fetch("/api/mood", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ mood: btn.value }) });
      body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error || "failed");
    } catch {
      out.hidden = false;
      out.replaceChildren(Object.assign(document.createElement("p"), { textContent: t("mood.error") }));
      out.focus();
      finish();
      return;
    }
    /* One frame later, so the burst measures the band with the reply in place: the canvas
       covers the whole band and the reply's top edge is real, not the sending line's. */
    requestAnimationFrame(() => confettiBurst(btn));
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
    finish();
  });
}
