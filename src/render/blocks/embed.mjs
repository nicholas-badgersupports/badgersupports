/* A video from the organisation's Instagram, without Instagram on the page until someone asks for
 * it. The page shows the post's own caption and a Play button; pressing Play puts Instagram's
 * player in a frame (src/client/embed.js), and only then does the visitor's browser talk to
 * Instagram. Without JavaScript there is no Play button, only the link to watch it there.
 *
 * Used as a block of its own, and inside a program section in place of its photo (program.mjs).
 */

import { html } from "../html.mjs";
import { go } from "../context.mjs";
import { icon } from "../icons.mjs";

const URL_RE = /^https:\/\/www\.instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)\/?$/;

export const embedProblems = (e) => (URL_RE.test(e?.url || "") ? [] : [`"${e?.url}" is not an Instagram post or reel address`]).concat(e?.title ? [] : ["needs a title (what the video is, for screen readers)"]);

export function reel(ctx, e) {
  const [, kind, id] = e.url.match(URL_RE);
  return html`<figure class="reel" data-embed data-src="https://www.instagram.com/${kind}/${id}/embed/" data-title="${e.title}">
  <div class="reel-frame" data-embed-frame>
    <div class="reel-face">
      ${e.caption ? html`<p class="reel-caption">${e.caption}</p>` : ""}
      <button type="button" class="reel-play" data-embed-play>${icon("play")}<span>${ctx.t("embed.play")}</span></button>
      <p class="reel-notice">${ctx.t("embed.notice")}</p>
    </div>
  </div>
  <figcaption>${go(ctx, e.url, ctx.t("embed.open"), "out")}</figcaption>
</figure>`;
}

export default {
  type: "embed",
  label: "Instagram video",
  fields: { title: "text!", url: "text!", caption: "text" },
  data: [],
  client: "embed.js",
  analytics: "page",
  loading: "lazy",
  render(b, ctx) {
    return html`<section class="embed band" aria-label="${b.title}" data-block="${b.id}"><div class="wrap">${reel(ctx, b)}</div></section>`;
  },
};
