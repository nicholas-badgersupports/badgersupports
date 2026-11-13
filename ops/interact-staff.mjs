/* Behaviour in a real browser: 4. the staff page, in each state, and the edit button.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-staff.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

await part("staff page: signed in, no Sign In flash", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["forms.read:*", "site.edit"], slow: 600 });
  const s = await staffState(page);
  const seen = await page.evaluate(() => window.__seen);
  check(!seen.signIn && seen.checking && s.who === "Signed in as Robin Example" && !s.signIn,
    `staff signed in: the Sign In button never shows while the session is checked, a checking line does, then who is signed in (sign-in seen ${seen.signIn}, checking seen ${seen.checking}, "${s.who}")`);
  check(!s.intro && !s.quote, `staff signed in: the before-sign-in words and the quote give way to the tools (intro "${s.intro.slice(0, 40)}", quote "${s.quote}")`);
  await goStaff(page, "staff.forms.title");
  const f = await staffState(page);
  check(f.text.includes(words("staff.forms.how")), "staff signed in, a reader: the forms part says answers are worked through in Connect");
  check(!errors.length, `staff signed in: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("staff page: signed out", async () => {
  const { ctx, page } = await openStaff({ slow: 400 });
  const s = await staffState(page);
  const seen = await page.evaluate(() => window.__seen);
  check(s.signIn && !seen.checking && s.introParas === 1 && !s.help,
    `staff signed out: the button shows at once, no checking line, one short line before it, no help under it (checking seen ${seen.checking}, paragraphs ${s.introParas}, help ${s.help})`);
  const order = await page.evaluate(() => {
    const a = document.querySelector("[data-staff-signin] a"), q = document.querySelector("[data-staff-quote]");
    return !!q && !!(a.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check(order && s.quote === HARNESS_QUOTE, `staff signed out: Connect's quote shows under the sign-in button ("${s.quote}")`);
  await page.keyboard.press("Tab");
  let tabs = 0;
  while (tabs++ < 30 && !(await page.evaluate(() => !!document.activeElement?.closest("[data-staff-signin]")))) await page.keyboard.press("Tab");
  const next = await (async () => { await page.keyboard.press("Tab"); return page.evaluate(() => document.activeElement?.tagName); })();
  check(tabs < 30 && next !== "SUMMARY", `staff signed out, keyboard: Tab reaches Sign in, and no folded help comes next (after sign-in, ${next})`);
  await ctx.close();
});

await part("staff page: a past sign-in that has ended", async () => {
  const { ctx, page } = await openStaff({ hint: true });
  // the edit button may forget the hint before the staff page has said anything: wait for the page's own answer
  await page.waitForFunction((w) => [...document.querySelectorAll(".staff-note")].some((n) => n.textContent === w), words("staff.ended"), { timeout: 3000 }).catch(() => {});
  const s = await staffState(page);
  check(s.signIn && s.notes.includes(words("staff.ended")) && !s.hint && !s.who,
    `staff ended: says the sign-in has ended, offers Sign in, and forgets the hint (notes ${JSON.stringify(s.notes)}, hint ${s.hint})`);
  await ctx.close();
});

await part("staff page: another module clears the hint before staff starts", async () => {
  const { ctx, page } = await openStaff({ hint: true, init: () => {
    const observer = new MutationObserver(() => {
      if (!document.documentElement?.classList.contains("staff-hint")) return;
      document.cookie = "bss_staff_hint=; Path=/; Max-Age=0; SameSite=Lax";
      observer.disconnect();
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  } });
  await page.waitForFunction((w) => [...document.querySelectorAll(".staff-note")].some((n) => n.textContent === w), words("staff.ended"), { timeout: 3000 }).catch(() => {});
  const s = await staffState(page);
  check(s.signIn && s.notes.includes(words("staff.ended")) && !s.hint && !s.who,
    "staff ended: the page remembers its initial hint after another module clears the cookie");
  await ctx.close();
});

await part("staff page: the place to come back to", async () => {
  let { ctx, page } = await openStaff({ path: `${STAFF}?return=/forms/workshop-request/` });
  let s = await staffState(page);
  check(s.href === "/api/auth/start?return=%2Fforms%2Fworkshop-request%2F", `staff return: Sign in comes back to the page that sent you (${s.href})`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ path: `${STAFF}?return=//elsewhere.test/` }));
  s = await staffState(page);
  check(s.href === "/api/auth/start?return=/staff/", `staff return: an address off this site is ignored (${s.href})`);
  await ctx.close();
});

await part("staff sign-in: the address bar", async () => {
  await freshServer();
  const b64 = (n) => crypto.randomBytes(n).toString("base64url");
  const state = b64(24), code = b64(24), nonce = b64(16);
  await q(`INSERT INTO auth_starts (state_hash, verifier, nonce, return_to, expires_at) VALUES ($1, $2, $3, $4, now() + interval '10 minutes')`,
    [crypto.createHash("sha256").update(state).digest("hex"), b64(48), nonce, STAFF]);
  harnessCodes.set(code, nonce);
  let { ctx, page, errors, redirects } = await openStaff({ auth: state, path: `/api/auth/callback?code=${code}&state=${state}` });
  const s = await staffState(page);
  const bar = () => { const u = new URL(page.url()); return u.pathname + u.search; };
  const sent = redirects.join(" ");
  check(sent.startsWith(`${STAFF}?code=`) && bar() === STAFF && s.who === "Signed in as Robin Example" && !errors.length,
    `staff sign-in: after signing in the address bar reads ${STAFF}, though the redirect arrived as Netlify sends it (bar "${bar()}", redirect sent "${sent.replace(/=[^&]{6,}/g, "=…")}", "${s.who}"${errors.length ? `, errors: ${errors.join(" | ")}` : ""})`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ path: "/?code=a&state=b" }));
  check(bar() === "/?code=a&state=b", `staff sign-in: a page's own code and state stay for a browser that has not signed in (bar "${bar()}")`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ hint: true, path: "/?keep=1&code=a&state=b" }));
  check(bar() === "/?keep=1", `staff sign-in: only code and state leave the address, the rest of it stays (bar "${bar()}")`);
  await ctx.close();
});

await part("staff page: editor only", async () => {
  await freshServer();
  const { ctx, page } = await openStaff({ session: ["site.edit"] });
  const who = (await staffState(page)).who;
  /* Each view in turn: the headings and buttons this account is offered, gathered across its views. */
  const headings = [], buttons = [];
  for (const key of ["staff.nav.overview", "staff.forms.title", "staff.edit.title", "staff.pages.title", "staff.versions.title"]) {
    if (key !== "staff.nav.overview") await goStaff(page, key);
    const s = await staffState(page);
    headings.push(...s.headings); buttons.push(...s.buttons);
  }
  check(who && headings.includes(words("staff.forms.title")) && headings.includes(words("staff.edit.title")) && !buttons.includes(words("staff.answers.show")) && !buttons.includes(words("staff.switch.open")) && !buttons.includes(words("staff.edit.download")),
    `staff editor only: form wording and page tools without answers, intake controls or publishing (headings ${JSON.stringify(headings)})`);
  await ctx.close();
});

await part("staff page: when the words last reached the site, and Refresh Now", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"] });
  await goStaff(page, "staff.edit.title");
  const before = words("staff.edit.timing").split("{{when}}")[0];
  let s = await staffState(page);
  check(s.text.includes(before + words("staff.edit.neverUpdated")), `refresh: the page says changes take up to 30 minutes, and that nothing has been published yet ("${s.text.split("\n").find((l) => l.startsWith(before)) || ""}")`);
  const button = page.getByRole("button", { name: words("staff.edit.refresh") });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((w) => document.querySelector("[role=status]")?.textContent === w, words("staff.edit.refreshed"), { timeout: 5000 }).catch(() => {});
  s = await staffState(page);
  const line = s.text.split("\n").find((l) => l.startsWith(before)) || "";
  check(/\d{4}/.test(line) && !line.includes(words("staff.edit.neverUpdated")), `refresh: pressed by keyboard, the line names when the site last updated ("${line}")`);
  await button.click();
  await page.waitForTimeout(300);
  s = await staffState(page);
  check(s.text.includes(words("staff.edit.refreshSoon")), "refresh: pressed again within the minute, it says to wait, and nothing else happens");
  check(!errors.length, `refresh: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("staff page: answers the account may no longer read", async () => {
  await freshServer();
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), { ip: "198.51.100.201" });
  const { ctx, page } = await openStaff({ session: ["forms.read:workshop-request"], slow: 500 });
  await goStaff(page, "staff.forms.title");
  await q("UPDATE staff_sessions SET scopes = '[\"site.edit\"]'::jsonb");
  const show = page.getByRole("button", { name: words("staff.answers.show") });
  await show.click({ timeout: 3000 });
  await sleep(350); // the words change after 200 ms; the answer takes 500
  const waiting = await page.evaluate(() => { const b = document.querySelector(".staff-form button"); return { text: b.textContent, busy: b.getAttribute("aria-busy") }; });
  check(waiting.text === words("staff.answers.loading") && waiting.busy === "true", `staff answers: while they load the button says so (${JSON.stringify(waiting)})`);
  await sleep(700);
  const s = await staffState(page);
  check(s.notes.includes(words("staff.forbidden")) && !s.tables, `staff answers refused: the reason shows where the answers would be (notes ${JSON.stringify(s.notes)})`);
  await ctx.close();
});

await part("staff page: Open and Close a form", async () => {
  await freshServer();
  // Forms ship open; a director closed this one earlier, so the run starts from a closed switch row.
  await q("INSERT INTO form_state (form_key, state, changed_by) VALUES ('resource-problem', 'closed', 'fixture')");
  const { ctx, page, errors } = await openStaff({ session: ["forms.switch:resource-problem"] });
  await goStaff(page, "staff.forms.title");
  const rows = async () => (await q("SELECT state FROM form_state WHERE form_key = 'resource-problem'")).rows.map((r) => r.state);
  const untouched = async () => (await rows()).join() === "closed";
  const card = () => page.evaluate(() => {
    const li = document.querySelector(".staff-form");
    return { chip: li?.querySelector(".staff-chip")?.textContent, buttons: [...(li?.querySelectorAll(".staff-switch button") || [])].map((b) => b.textContent),
      text: li?.textContent || "", focus: document.activeElement?.textContent || "", forms: document.querySelectorAll(".staff-form").length };
  });
  const first = await card();
  check(first.forms === 1 && first.chip === words("staff.forms.state.closed") && first.buttons.join("|") === words("staff.switch.open") && !first.text.includes(words("staff.forms.none")),
    `staff switch: someone who may only switch a form sees it closed, with Open and no answers (${JSON.stringify(first)})`);
  await page.getByRole("button", { name: words("staff.switch.open") }).click();
  const asked = await card();
  check(asked.buttons.join("|") === `${words("staff.switch.yes")}|${words("staff.switch.cancel")}` && asked.focus === words("staff.switch.yes") && await untouched(),
    `staff switch: Open asks again first, with the yes focused, and sends nothing (${JSON.stringify(asked)})`);
  await page.getByRole("button", { name: words("staff.switch.cancel") }).click();
  const kept = await card();
  check(kept.buttons.join("|") === words("staff.switch.open") && kept.focus === words("staff.switch.open") && await untouched(), `staff switch: Keep It Closed puts Open back, focused (${JSON.stringify(kept)})`);
  await page.getByRole("button", { name: words("staff.switch.open") }).click();
  await page.getByRole("button", { name: words("staff.switch.yes") }).click();
  await page.waitForFunction((w) => document.querySelector(".staff-form .staff-chip")?.textContent === w, words("staff.forms.state.open"));
  const open = await card();
  check(open.buttons.join("|") === words("staff.switch.close") && open.focus === words("staff.switch.close") && /is open\./.test(open.text) && (await rows()).join() === "open",
    `staff switch: the yes opens it; the chip, the button and the line follow the server (${JSON.stringify(open)})`);
  await page.getByRole("button", { name: words("staff.switch.close") }).click();
  await page.waitForFunction((w) => document.querySelector(".staff-form .staff-chip")?.textContent === w, words("staff.forms.state.closed"));
  check((await rows()).join() === "closed" && (await card()).buttons.join("|") === words("staff.switch.open"), "staff switch: Close goes at once, with no second question");
  check(!errors.length, `staff switch: no script errors (${errors.join("; ")})`);
  await ctx.close();
});

await part("staff page: Back after signing out", async () => {
  await freshServer();
  await handle(post("/api/forms/workshop-request/submit", workshopAnswers(), { json: false }), { ip: "198.51.100.202" });
  const { ctx, page } = await openStaff({ session: ["forms.read:*"] });
  await goStaff(page, "staff.forms.title");
  await page.getByRole("button", { name: words("staff.answers.show") }).click();
  await page.waitForSelector(".staff-table");
  /* Headless Chromium here keeps no page in the back-forward cache (measured), so the events a
     browser fires when it stores and restores one are fired by hand. */
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  const stored = await staffState(page);
  check(!stored.tables && !stored.who, `staff Back: leaving the page takes the answers off it before a browser stores it (tables ${stored.tables})`);
  await q("DELETE FROM staff_sessions");
  await ctx.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await sleep(400);
  const back = await staffState(page);
  check(back.signIn && !back.who && !back.tables, `staff Back: coming back to a stored page checks again, and a signed-out browser sees Sign in (who "${back.who}")`);
  await ctx.close();
});

await part("staff page: the connection drops", async () => {
  await freshServer();
  // Down for every check until Try again; the edit button asks too, and may ask first.
  let down = true;
  const { ctx, page } = await openStaff({ session: ["forms.read:*"], fail: (p) => p === "/api/staff/me" && down });
  let s = await staffState(page);
  check(s.notes.includes(words("staff.loadError")) && s.buttons.includes(words("staff.tryAgain")) && !s.checking, `staff offline: says so, with Try again, and stops checking (buttons ${JSON.stringify(s.buttons)})`);
  down = false;
  await page.getByRole("button", { name: words("staff.tryAgain") }).click({ timeout: 3000 });
  await sleep(400);
  s = await staffState(page);
  check(s.who === "Signed in as Robin Example" && !s.notes.includes(words("staff.loadError")), `staff offline: Try again signs in without a reload ("${s.who}")`);
  await ctx.close();
});

await part("staff page: phone and no JavaScript", async () => {
  let { ctx, page } = await openStaff({ viewport: { width: 390, height: 844 } });
  const box = await page.locator("[data-staff-signin] a").boundingBox();
  check(box && box.y + box.height <= 844, `staff phone: Sign in is on the first screen at 390×844 (bottom ${box ? Math.round(box.y + box.height) : "none"})`);
  await ctx.close();
  ({ ctx, page } = await openStaff({ hint: true, js: false }));
  const s = await staffState(page);
  check(s.signIn && !s.checking, `staff without JavaScript: Sign in shows even after a past sign-in, and no checking line (sign-in ${s.signIn}, checking ${s.checking})`);
  await ctx.close();
});

await part("edit button: the sign-in ends while words are in the box", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/" });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.locator("[data-block] [data-edit-target]").first().click({ timeout: 3000 });
  await q("DELETE FROM staff_sessions");
  await page.fill(".edit-dialog textarea", "Words typed before the sign-in ended");
  await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.querySelector(".edit-status a"), null, { timeout: 3000 }).catch(() => {});
  const box = await page.evaluate(() => {
    const a = document.querySelector(".edit-status a");
    return { status: document.querySelector(".edit-status").textContent, href: a?.getAttribute("href"), target: a?.target, rel: a?.rel, value: document.querySelector(".edit-dialog textarea").value, open: document.querySelector(".edit-dialog").open };
  });
  check(box.open && box.value === "Words typed before the sign-in ended" && box.status.startsWith(words("edit.error.signedOut")),
    `edit button, sign-in ended: the box stays open with the words in it, and says so ("${box.status}")`);
  check(box.href === "/api/auth/start?return=%2F" && box.target === "_blank" && /noopener/.test(box.rel),
    `edit button, sign-in ended: Sign in again opens in a new tab and comes back to this page (${box.href}, ${box.target})`);
  check(!errors.length, `edit button, sign-in ended: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("edit button: other words opened while a save is still going", async () => {
  const { ctx, page, errors, first, box, mark } = await editTwoPlaces({ conflict: false });
  check(box.open && box.value === "Words still being typed for the second place" && !box.save,
    `edit button, two places: the first save's answer leaves the box open on the second words, Save usable (${JSON.stringify(box)})`);
  check((await mark(first).textContent()).trim() === "Made-up words for the first place", "edit button, two places: the first place shows its saved words");
  check(!errors.length, `edit button, two places: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("edit button: a conflict answered after other words are opened", async () => {
  const { ctx, page, first, second, box } = await editTwoPlaces({ conflict: true });
  check(box.open && box.value === "Words still being typed for the second place",
    `edit button, conflict for the first place: the second words stay in the box (${JSON.stringify(box.value)})`);
  await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
  await sleep(1600);
  const rows = Object.fromEntries((await many("SELECT target, value FROM content_edits")).map((r) => [r.target, r.value]));
  check(rows[second] === "Words still being typed for the second place" && rows[first] === "Made-up words someone else saved",
    `edit button, conflict for the first place: Save keeps the second words in the second place and leaves the first alone (${JSON.stringify(rows)})`);
  await ctx.close();
});

await part("edit button: a section switched off, by keyboard, under More words", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/" });
  const target = "page:pg-home:b-home-announce/enabled";
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const marked = await page.evaluate((t) => !!document.querySelector(`[data-edit-target="${t}"]`), target);
  await page.getByRole("button", { name: words("edit.more") }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("b-home-announce/enabled");
  const item = page.locator(".edit-more-list .edit-pick");
  const found = await item.count();
  const name = await item.first().locator(".edit-pick-where").textContent().catch(() => "");
  await item.first().focus();
  await page.keyboard.press("Enter");
  const control = await page.evaluate(() => { const c = document.getElementById("edit-d-v"); return { tag: c?.tagName, options: [...(c?.options || [])].map((o) => o.textContent), value: c?.value, focused: document.activeElement === c, key: document.querySelector(".edit-key code")?.textContent }; });
  check(!marked && found === 1 && control.key === target && control.tag === "SELECT" && control.options.join("|") === `${words("edit.on")}|${words("edit.off")}` && control.value === "true" && control.focused,
    `typed value: not marked on the page, found under More words by its key, opened as a focused list of On and Off (${JSON.stringify({ marked, found, control })})`);
  check(name.startsWith(`${words("edit.field.enabled")}, `) && !name.includes(target),
    `typed value: More words names it by what it is and its section, not by its key ("${name}")`);
  // Native selects handle arrow keys differently across platforms; type the option's label.
  await page.keyboard.type(words("edit.off"));
  const selected = await page.locator("#edit-d-v").inputValue();
  check(selected === "false", `typed value: keyboard selects Off (${selected})`);
  await page.keyboard.press("Tab");
  const onSave = await page.evaluate(() => document.activeElement?.type === "submit");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".edit-dialog").open, null, { timeout: 3000 }).catch(() => {});
  check(onSave, "typed value: Tab from the list reaches Save");
  const row = await one("SELECT value FROM content_edits WHERE target = $1", [target]);
  check(row?.value === "false", `typed value: Off is saved by keyboard (${JSON.stringify(row)})`);
  check(!errors.length, `typed value: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("edit button: a photo and a link's address, from the page", async () => {
  await freshServer();
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/" });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const photo = await page.evaluate(() => {
    const img = document.querySelector("main [data-block] picture img[data-edit-target]");
    const others = [...document.querySelectorAll("main picture[class*='media-m-']")].map((p) => [...p.classList].find((c) => c.startsWith("media-m-")).slice(6));
    return img && { target: img.getAttribute("data-edit-target"), label: img.getAttribute("aria-label"), tab: img.tabIndex, shown: [...img.closest("picture").classList].find((c) => c.startsWith("media-m-")).slice(6), others };
  });
  check(photo && photo.tab === 0 && photo.label?.startsWith(`${words("edit.field.photo")}, `) && !photo.label.includes(photo.target),
    `photo: outlined on the page, in the Tab order, named by what it is and its section (${JSON.stringify(photo && { target: photo.target, label: photo.label, tab: photo.tab })})`);
  if (photo) {
    const img = page.locator(`img[data-edit-target="${photo.target}"]`);
    await img.focus();
    await page.keyboard.press("Enter");
    const box = await page.evaluate(() => ({ open: document.querySelector(".edit-dialog").open, key: document.querySelector(".edit-key code")?.textContent, value: document.getElementById("edit-d-v")?.value, where: document.querySelector(".edit-where")?.textContent }));
    check(box.open && box.key === photo.target && box.value === photo.shown && box.where === photo.label,
      `photo: Enter opens it, with its library id and the same name (${JSON.stringify(box)})`);
    const next = photo.others.find((id) => id !== photo.shown);
    await page.fill("#edit-d-v", next);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.querySelector(".edit-dialog").open, null, { timeout: 3000 }).catch(() => {});
    const row = await one("SELECT value FROM content_edits WHERE target = $1", [photo.target]);
    const back = await page.evaluate(() => document.activeElement?.getAttribute("data-edit-target"));
    check(row?.value === next && back === photo.target, `photo: another library photo is saved by keyboard, and focus comes back to the photo (${JSON.stringify({ row, back })})`);
  }

  const words_ = await page.evaluate(() => {
    for (const n of document.querySelectorAll("main [data-block] a[href^='/'] [data-edit-target], main [data-block] a[href^='/'][data-edit-target]")) {
      if (!n.closest("picture")) return { target: n.getAttribute("data-edit-target"), href: n.closest("a").getAttribute("href") };
    }
    return null;
  });
  await page.locator(`[data-edit-target="${words_?.target}"]`).first().click({ timeout: 3000 });
  const linkButton = page.getByRole("button", { name: words("edit.link") });
  const offered = await linkButton.isVisible();
  const section = await page.evaluate(() => {
    const d = document.querySelector(".edit-section");
    return { hidden: d.hidden, title: d.querySelector("summary").textContent, names: [...d.querySelectorAll(".edit-pick-where")].map((n) => n.textContent) };
  });
  check(offered && !section.hidden && /\(\d+\)$/.test(section.title) && section.names.length && section.names.every((n) => n.includes(", ")),
    `link: the box for a link's words offers its address, and lists the section's other values by name (${JSON.stringify({ words_, offered, title: section.title, first: section.names[0] })})`);
  await linkButton.focus();
  await page.keyboard.press("Enter");
  const link = await page.evaluate(() => ({ key: document.querySelector(".edit-key code")?.textContent, value: document.getElementById("edit-d-v")?.value, focused: document.activeElement?.id === "edit-d-v", where: document.querySelector(".edit-where")?.textContent }));
  check(link.key?.endsWith("/href") && link.value === words_?.href && link.focused && link.where.startsWith(`${words("edit.field.href")}, `),
    `link: Change Where This Link Goes opens the address the link has on the page, focused, named (${JSON.stringify(link)})`);
  await page.keyboard.press("Escape");
  const back = await page.evaluate(() => document.activeElement?.getAttribute("data-edit-target"));
  check(back === words_?.target, `link: closing the box gives focus back to the words it was opened from (${back})`);

  await page.getByRole("button", { name: words("edit.done") }).click({ timeout: 3000 });
  const after = await page.evaluate(() => ({ marked: document.querySelectorAll("[data-edit-target]").length, labelled: document.querySelectorAll("main picture img[aria-label]").length }));
  check(after.marked === 0 && after.labelled === 0, `photo: Done Editing takes the outline, the Tab stop and the name away again (${JSON.stringify(after)})`);
  check(!errors.length, `photo and link: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

await part("edit button: the key, earlier versions and Restore", async () => {
  await freshServer();
  let asks = 0;
  const { ctx, page, errors } = await openStaff({ session: ["site.edit"], path: "/", slow: (p) => (p === "/api/staff/edit/history" ? [0, 1000, 2500][asks++] ?? 0 : 0) });
  await page.getByRole("button", { name: words("edit.button") }).click({ timeout: 3000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("is-editing"), null, { timeout: 3000 });
  const [first, second] = await page.evaluate(() => [...new Set([...document.querySelectorAll("main [data-block] [data-edit-target]")].map((n) => n.getAttribute("data-edit-target")))].slice(0, 2));
  const mark = (target) => page.locator(`[data-edit-target="${target}"]`).first();
  const closed = () => page.waitForFunction(() => !document.querySelector(".edit-dialog").open, null, { timeout: 3000 });
  for (const v of ["Made-up first version", "Made-up second version"]) {
    await mark(first).click({ timeout: 3000 });
    await page.fill(".edit-dialog textarea", v);
    await page.getByRole("button", { name: words("edit.save") }).click({ timeout: 3000 });
    await closed();
  }
  await mark(first).click({ timeout: 3000 });
  const key = await page.evaluate(() => document.querySelector(".edit-key code")?.textContent);
  check(key === first, `edit box: shows the words' permanent key (${key})`);
  await page.locator(".edit-history summary").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".edit-versions li"), null, { timeout: 3000 }).catch(() => {});
  const list = await page.evaluate(() => [...document.querySelectorAll(".edit-versions li")].map((li) => {
    const b = li.querySelector("button");
    return { words: li.querySelector(".edit-version-words").textContent, notes: [...li.querySelectorAll(".edit-by")].map((p) => p.textContent), restore: b ? document.getElementById(b.getAttribute("aria-describedby"))?.textContent : null };
  }));
  check(list.length === 1 && list[0].words === "Made-up first version" && list[0].restore === "Made-up first version" && list[0].notes.join().startsWith("Robin Example, "),
    `edit box: Earlier versions lists the words saved before, not the words already in the box, with who and when, and Restore named by its words (${JSON.stringify(list)})`);
  await page.getByRole("button", { name: words("edit.restore") }).focus();
  await page.keyboard.press("Enter");
  await closed().catch(() => {});
  const rows = (await many("SELECT value FROM content_edit_history WHERE target = $1 ORDER BY id", [first])).map((r) => r.value);
  const back = await page.evaluate(() => document.activeElement?.getAttribute("data-edit-target"));
  check((await mark(first).textContent()).trim() === "Made-up first version" && rows.join("|") === "Made-up first version|Made-up second version|Made-up first version" && back === first,
    `edit box: Restore saves the earlier words as the newest version, shows them, and gives focus back to them (${JSON.stringify({ rows, back })})`);

  await mark(first).click({ timeout: 3000 });
  await page.locator(".edit-history summary").click({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await mark(second).click({ timeout: 3000 });
  await page.locator(".edit-history summary").click({ timeout: 3000 });
  await sleep(1600);
  const between = await page.evaluate(() => ({ key: document.querySelector(".edit-key code")?.textContent, items: document.querySelectorAll(".edit-versions li").length, line: document.querySelector(".edit-versions-list")?.textContent }));
  check(between.key === second && between.items === 0 && between.line === words("edit.history.loading"),
    `edit box: an answer about the first words, come after the box moved on, is not shown for the second (${JSON.stringify(between)})`);
  await sleep(2400);
  const after = await page.evaluate(() => document.querySelector(".edit-versions-list")?.textContent);
  check(after === words("edit.history.none"), `edit box: the second words' own answer is shown ("${after}")`);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: words("edit.more") }).click({ timeout: 3000 });
  await page.fill("#edit-find", "text:page.skip");
  const found = await page.locator(".edit-more-list .edit-pick").count();
  await page.locator(".edit-more-list .edit-pick").first().click({ timeout: 3000 });
  const picked = await page.evaluate(() => document.querySelector(".edit-key code")?.textContent);
  check(found === 1 && picked === "text:page.skip", `More words: searching a key finds those words, and the box shows the key (${JSON.stringify({ found, picked })})`);
  await page.keyboard.press("Escape");
  check(!errors.length, `edit box, versions: no script errors${errors.length ? ` (${errors[0]})` : ""}`);
  await ctx.close();
});

finish(await closeAndTally("interact-staff"));
