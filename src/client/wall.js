/* "Show other notes": swaps the visible notes for others from the same list. Nothing rotates
   by itself; a note changes only when someone asks. */

for (const wall of document.querySelectorAll("[data-wall]")) {
  const btn = wall.querySelector("[data-wall-more]");
  const data = wall.querySelector('script[type="application/json"]');
  if (!btn || !data) continue;
  const all = JSON.parse(data.textContent);
  const n = Number(wall.dataset.wall) || 8;
  const list = wall.querySelector(".notes");
  let seen = new Set([...list.children].map((li) => li.textContent));
  btn.hidden = false;
  btn.addEventListener("click", () => {
    let pool = all.filter((t) => !seen.has(t));
    if (pool.length < n) { seen = new Set(); pool = all.slice(); }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const next = pool.slice(0, n);
    next.forEach((t) => seen.add(t));
    list.replaceChildren(...next.map((t) => { const li = document.createElement("li"); li.className = "note"; li.textContent = t; return li; }));
  });
}
