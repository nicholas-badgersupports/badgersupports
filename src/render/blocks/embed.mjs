/* A video from the organisation's Instagram, shown in Instagram's own player as the page opens,
 * with no Play button in front of it. The frame loads lazily, so a page
 * whose reel is far below the fold asks Instagram only when it nears the screen; once it loads,
 * Instagram may set its own cookies. Without JavaScript the frame still shows.
 *
 * Used as a block of its own, and inside a program section in place of its photo (program.mjs).
 */

import { html } from "../html.mjs";
import { go } from "../context.mjs";

const URL_RE = /^https:\/\/www\.instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/;

export const embedProblems = (e) => (URL_RE.test(e?.url || "") ? [] : [`"${e?.url}" is not an Instagram post or reel address`]).concat(e?.title ? [] : ["needs a title (what the video is, for screen readers)"]);

export function reel(ctx, e) {
  const [, kind, id] = e.url.match(URL_RE);
  return html`<figure class="reel is-playing">
  <div class="reel-frame"><iframe src="https://www.instagram.com/${kind}/${id}/embed/" title="${e.title}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
  <figcaption>${e.caption ? html`<p class="reel-caption">${e.caption}</p>` : ""}${go(ctx, e.url, ctx.t("embed.open"), "out")}</figcaption>
</figure>`;
}

export default {
  type: "embed",
  label: "Instagram video",
  fields: { title: "text!", url: "text!", caption: "text" },
  data: [],
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    return html`<section class="embed band" aria-label="${b.title}" data-block="${b.id}"><div class="wrap">${reel(ctx, b)}</div></section>`;
  },
};
