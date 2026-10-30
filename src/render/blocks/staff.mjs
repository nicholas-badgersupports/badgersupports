/* The staff page: a sign-in button for directors and admins, which sends them to Connect and back
   (netlify/lib/staff.mjs), and the tools staff.js draws once they are signed in — the forms their
   role lets them read, and the words they have changed with the edit button. Without a script the
   button still signs in; the tools need it. Nothing here is counted, and the page is never cached
   or indexed (content/pages/staff.json).
   Before sign-in the page holds one short line, the button, and an optional quote under it, from
   Connect's one shared list (Connect GOOGLE-SIGNIN: /api/signin-quotes, filled by staff.js, empty
   and hidden until then and whenever Connect has none to show). The help that was folded under the
   button is gone with the same change: Connect's own sign-in page says what is needed. A browser that was signed in before
   carries the staff_hint class from the inline script (src/render/layout.mjs): the checking line
   shows in place of the button until staff.js knows, so a signed-in director never sees Sign in
   flash up. */

import { html, attrs } from "../html.mjs";

export default {
  type: "staff",
  label: "Staff sign-in and tools",
  fields: { title: "text!", body: "paragraphs!", signIn: "text!" },
  data: [],
  client: "staff.js",
  analytics: "none",
  loading: "eager",
  render(b, ctx) {
    const body = Array.isArray(b.body) ? b.body : [b.body];
    return html`<section${attrs({ class: "staff band", "aria-labelledby": `${b.id}-h`, "data-block": b.id, "data-analytics": "off" })}><div class="wrap"><h1 id="${b.id}-h" tabindex="-1">${b.title}</h1><div class="text-body" data-staff-intro>${body.map((p) => html`<p>${p}</p>`)}</div><p class="staff-checking" data-staff-checking hidden>${ctx.t("staff.checking")}</p><p class="staff-signin" data-staff-signin><a class="btn btn--big" href="/api/auth/start?return=/staff/">${b.signIn}</a></p><p class="staff-quote" data-staff-quote hidden></p><div class="staff-app" data-staff-app hidden></div></div></section>`;
  },
};
