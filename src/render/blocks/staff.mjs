/* The staff page: a sign-in button for directors and admins, which sends them to Connect and back
   (netlify/lib/staff.mjs), and the tools staff.js draws once they are signed in — the forms their
   role lets them read, and the words they have changed with the edit button. Without a script the
   button still signs in; the tools need it. Nothing here is counted, and the page is never cached
   or indexed (content/pages/staff.json). */

import { html, attrs } from "../html.mjs";

export default {
  type: "staff",
  label: "Staff sign-in and tools",
  fields: { title: "text!", body: "paragraphs!", signIn: "text!" },
  data: [],
  client: "staff.js",
  analytics: "none",
  loading: "eager",
  render(b) {
    const body = Array.isArray(b.body) ? b.body : [b.body];
    return html`<section${attrs({ class: "staff band", "aria-labelledby": `${b.id}-h`, "data-block": b.id, "data-analytics": "off" })}><div class="wrap"><h1 id="${b.id}-h">${b.title}</h1><div class="text-body" data-staff-intro>${body.map((p) => html`<p>${p}</p>`)}</div><p class="staff-signin" data-staff-signin><a class="btn btn--big" href="/api/auth/start?return=/staff/">${b.signIn}</a></p><div class="staff-app" data-staff-app hidden></div></div></section>`;
  },
};
