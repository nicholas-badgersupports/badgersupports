/* The Badger SPILL logo, moving: Badger SPILL's own logo motion (badger-spill
 * site/assets/js/lib/logo-motion.js), brought here unchanged in what it does so SPILL looks and
 * moves the same on both sites. The picture is shown twice and cut along the edge of the milk
 * (blocks.css › Badger SPILL), so the bottle with the cow on it tips about its mouth while the
 * spilled milk stays on the floor, glugs, ripples and splashes. Only transforms and opacity move.
 *
 * It says hello once when it first comes into view (under five seconds, then still: WCAG 2.2.2). A
 * logo inside a link glugs when a mouse or the keyboard reaches the link; any other logo plays the
 * next of three moves on each click. Nothing moves for anyone who asks for less motion. A picture
 * other than the logo is left as it is. The logo carries no words of its own (its alt is empty; the
 * words beside it say what it is), so this file puts none on the page. */

const LOGO_SRC = /\/assets\/brand\/spill-logo-wide-(240|480|720)\.webp(\?.*)?$/;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isLogo = (img) => img.tagName === "IMG" && LOGO_SRC.test(img.getAttribute("src") || "") && !img.getAttribute("alt");
const part = (cls) => {
  const el = document.createElement("span");
  el.className = cls;
  el.setAttribute("aria-hidden", "true");
  return el;
};

// Each move: its length, the bottle's tilt in degrees and the milk's stretch [x, y] at points
// through it (fractions of the move), and when the puddle ripples or splashes (with how many drops).
const MOVES = {
  hello: { duration: 3400,   // tips to pour, glugs twice while it holds, settles with a little rock
    tilt: [[0, 0], [0.16, 4], [0.3, 3.4], [0.42, 4.2], [0.56, 3.6], [0.72, -1.4], [0.84, 0.6], [0.93, -0.2], [1, 0]],
    milk: [[0, 1, 1], [0.18, 1.03, 1.07], [0.3, 1.01, 1.02], [0.44, 1.04, 1.08], [0.58, 1.01, 1.02], [0.74, 0.99, 0.98], [1, 1, 1]],
    ripples: [0.2, 0.46], splashes: [] },
  glug: { duration: 1100,    // one glug, for a pointer or the keyboard reaching the link
    tilt: [[0, 0], [0.3, 3], [0.62, -1], [0.82, 0.4], [1, 0]],
    milk: [[0, 1, 1], [0.34, 1.03, 1.06], [0.7, 0.995, 0.99], [1, 1, 1]],
    ripples: [0.3], splashes: [] },
  splash: { duration: 1300,  // a quick tip and drops jumping out of the puddle
    tilt: [[0, 0], [0.18, 2.5], [0.45, -0.8], [0.7, 0.3], [1, 0]],
    milk: [[0, 1, 1], [0.2, 1.04, 1.08], [0.5, 0.99, 0.98], [1, 1, 1]],
    ripples: [0.2], splashes: [[0.18, 3]] },
  seesaw: { duration: 1200,  // rocks on its mouth like a seesaw
    tilt: [[0, 0], [0.18, 6], [0.42, -3], [0.62, 2], [0.8, -0.8], [1, 0]],
    milk: [[0, 1, 1], [0.2, 1.03, 1.07], [0.44, 0.99, 0.97], [0.64, 1.02, 1.04], [1, 1, 1]],
    ripples: [0.2], splashes: [] },
  pour: { duration: 1800,    // tips right up and empties a little more
    tilt: [[0, 0], [0.2, 8], [0.4, 7.2], [0.6, 7.6], [0.78, -1.6], [0.9, 0.5], [1, 0]],
    milk: [[0, 1, 1], [0.22, 1.05, 1.1], [0.36, 1.02, 1.03], [0.5, 1.06, 1.12], [0.64, 1.01, 1.02], [0.8, 0.99, 0.98], [1, 1, 1]],
    ripples: [0.25, 0.5], splashes: [[0.25, 2], [0.5, 3]] },
};
const CLICK_MOVES = ["splash", "seesaw", "pour"];

const staged = new WeakMap();
const seen = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    seen.unobserve(e.target);
    const s = staged.get(e.target);
    if (!s) continue;
    s.bottle.decode().catch(() => {}).then(() => setTimeout(() => { if (e.target.isConnected) play(e.target, "hello"); }, 300));
  }
}, { threshold: 0.6 }) : null;

function stageLogo(img) {
  if (img.closest(".logo-stage") || !isLogo(img) || !img.animate) return;
  const stage = document.createElement("span");
  stage.className = `${img.className} logo-stage`.trim();
  const s = { bottle: img, anims: new Map(), busyUntil: 0, turn: 0 };
  const milk = img.cloneNode();
  milk.removeAttribute("id");
  milk.className = "logo-layer logo-milk";
  milk.setAttribute("aria-hidden", "true");
  s.milk = milk;
  img.className = "logo-layer logo-bottle";
  img.replaceWith(stage);
  stage.append(img, milk);
  staged.set(stage, s);

  const link = stage.parentNode.closest("a, button");
  if (link) {
    const glug = () => { if (performance.now() > s.busyUntil) play(stage, "glug"); };
    link.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") glug(); });
    link.addEventListener("focus", () => { if (link.matches(":focus-visible")) glug(); });
  } else {
    stage.classList.add("is-playful");
    stage.addEventListener("click", () => play(stage, CLICK_MOVES[s.turn++ % CLICK_MOVES.length]));
  }
  if (seen) seen.observe(stage);
}

/* A move starts from wherever the logo is, so a click in the middle of one never makes it jump. */
function play(stage, name) {
  const s = staged.get(stage);
  if (!s) return;
  const m = MOVES[name];
  if (reduceMotion()) { if (name !== "hello" && name !== "glug") ripple(stage, true); return; }
  const parts = [
    [s.bottle, m.tilt.map(([offset, deg]) => ({ offset, transform: `rotate(${deg}deg)`, easing: "ease-in-out" }))],
    [s.milk, m.milk.map(([offset, x, y]) => ({ offset, transform: `scale(${x}, ${y})`, easing: "ease-in-out" }))]];
  for (const [el, frames] of parts) {
    const now = getComputedStyle(el).transform;
    if (now && now !== "none") frames[0].transform = now;
    if (s.anims.has(el)) s.anims.get(el).cancel();
    s.anims.set(el, el.animate(frames, { duration: m.duration }));
  }
  s.busyUntil = performance.now() + m.duration;
  for (const at of m.ripples) setTimeout(() => ripple(stage), at * m.duration);
  for (const [at, count] of m.splashes) setTimeout(() => splash(stage, count), at * m.duration);
}

/* A ring spreading across the puddle (for less motion: the ring only fades in and out). */
function ripple(stage, still = false) {
  if (!stage.isConnected || stage.querySelectorAll(".logo-ripple").length > 3) return;
  const r = part("logo-ripple");
  stage.append(r);
  const a = still
    ? r.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], { duration: 900 })
    : r.animate([{ transform: "scale(0.25)", opacity: 0.9 }, { transform: "scale(1.15)", opacity: 0 }], { duration: 750, easing: "cubic-bezier(.2,.7,.3,1)" });
  a.onfinish = a.oncancel = () => r.remove();
}

/* Drops of milk jumping out of the puddle and falling back. Distances are in the drop's own size,
 * so they scale with the logo. */
function splash(stage, count) {
  if (!stage.isConnected || stage.querySelectorAll(".logo-drop").length > 8) return;
  for (let i = 0; i < count; i++) {
    const drop = part("logo-drop");
    drop.style.left = `${86 + i * 3 + Math.random() * 2}%`;
    stage.append(drop);
    const dx = (i - (count - 1) / 2) * 140 + Math.random() * 60 - 30, up = 260 + Math.random() * 140;
    const a = drop.animate([
      { transform: "translate(0, 0) scale(0.4)", opacity: 0, easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: `translate(${dx * 0.55}%, -${up}%) scale(1)`, opacity: 1, offset: 0.45, easing: "cubic-bezier(.5,0,.8,.5)" },
      { transform: `translate(${dx}%, 20%) scale(0.6)`, opacity: 0 }],
    { duration: 760 + i * 60, delay: i * 40, fill: "backwards" });
    a.onfinish = a.oncancel = () => drop.remove();
  }
}

for (const img of document.querySelectorAll("img")) stageLogo(img);
