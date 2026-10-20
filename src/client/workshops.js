/* Workshop previews (src/render/blocks/workshops.mjs). Without this file every workshop shows, one
   under another, and every activity still works; with it:
     - the workshop names become tabs (arrow keys move between them), one workshop at a time;
     - the network map shows one circle's list at a time, beside the map;
     - a full bingo line lights up and is announced;
     - a choice's verdict is announced as well as shown.
   Nothing is stored or sent. */

for (const ws of document.querySelectorAll("[data-ws]")) {
  const list = ws.querySelector("[data-ws-tabs]");
  const tabs = [...list.querySelectorAll("[data-tab]")];
  const panels = tabs.map((t) => ws.querySelector(`[data-panel="${t.dataset.tab}"]`));
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", ws.closest("section").querySelector("h2").textContent);
  for (const li of list.children) li.setAttribute("role", "presentation");
  const select = (i, focus) => {
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      panels[j].hidden = i !== j;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.setAttribute("role", "tab");
    t.setAttribute("aria-controls", panels[i].id);
    t.id = `${panels[i].id}-tab`;
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", t.id);
    panels[i].tabIndex = -1;
    t.addEventListener("click", (e) => { e.preventDefault(); select(i, false); });
    t.addEventListener("keydown", (e) => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      select((n + tabs.length) % tabs.length, true);
    });
  });
  const start = Math.max(0, panels.findIndex((p) => `#${p.id}` === location.hash));
  ws.classList.add("is-tabbed");
  select(start, false);
}

/* the network map: one circle open at a time */
for (const act of document.querySelectorAll('[data-act="network"]')) {
  const btns = [...act.querySelectorAll("[data-area]")];
  const panel = (b) => act.querySelector(`[data-area-panel="${b.dataset.area}"]`);
  const open = (b) => btns.forEach((x) => {
    const on = x === b;
    x.setAttribute("aria-expanded", String(on));
    panel(x).hidden = !on;
  });
  for (const b of btns) {
    b.setAttribute("role", "button");
    b.setAttribute("aria-controls", panel(b).id);
    b.addEventListener("click", (e) => { e.preventDefault(); open(b); });
    b.addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); open(b); } });
  }
  act.classList.add("is-live");
  open(btns[0]);
}

/* bingo: three in a row, across, down or corner to corner */
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
for (const act of document.querySelectorAll('[data-act="bingo"]')) {
  const boxes = [...act.querySelectorAll("input[type=checkbox]")];
  const win = act.querySelector("[data-win]");
  act.addEventListener("change", () => {
    const lit = new Set(LINES.filter((l) => l.every((i) => boxes[i].checked)).flat());
    boxes.forEach((b, i) => b.closest("label").classList.toggle("is-line", lit.has(i)));
    const had = act.classList.contains("has-line");
    act.classList.toggle("has-line", lit.size > 0);
    if (lit.size && !had) win.textContent = win.dataset.win;
    if (!lit.size) win.textContent = "";
  });
}

/* a choice: its verdict is shown by the stylesheet and read out here */
for (const act of document.querySelectorAll('[data-act="choose"]')) {
  const status = act.querySelector("[data-say-status]");
  act.addEventListener("change", (e) => {
    const v = e.target.closest("label")?.querySelector(".say-verdict");
    if (v) status.textContent = v.textContent;
  });
}
