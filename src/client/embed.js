/* Play puts the Instagram player in the frame; until then nothing on the page comes from
   Instagram (src/render/blocks/embed.mjs). The Play button only exists for script-run pages. */

for (const fig of document.querySelectorAll("[data-embed]")) {
  const btn = fig.querySelector("[data-embed-play]");
  const frame = fig.querySelector("[data-embed-frame]");
  btn.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = fig.dataset.src;
    f.title = fig.dataset.title;
    f.allow = "encrypted-media; picture-in-picture";
    f.loading = "eager";
    f.setAttribute("allowfullscreen", "");
    frame.replaceChildren(f);
    fig.classList.add("is-playing");
    f.focus();
  });
}
