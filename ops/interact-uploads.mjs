/* Behaviour in a real browser: 2. uploads, and a form's shape.
 *
 * One group of the suite that was ops/interact.mjs, split under proposal C-40 (audit item
 * P1, 13 November 2026) — see ops/interact-harness.mjs for why, and for the browser, the
 * check/part machinery and every helper these parts use. Run through check.mjs --browser
 * (ops/suites.mjs lists the groups in order), or on its own against a local server:
 *   BASE=http://127.0.0.1:8911 TODAY=2026-10-20 node ops/interact-uploads.mjs
 * Fictional files and people only. */
import { finish } from "./finish.mjs";
import { BASE, CLIENT_ID, COMPACT, DAY, HARNESS_QUOTE, HARNESS_SSO, NEXT, ORIGIN, PAGE, PDF, ROOT, STAFF, TEXT, TODAY, WORKSHOP, at, browser, canonicalJson, check, checkEventDays, closeAndTally, crypto, editTwoPlaces, emailState, fakeId, fillWorkshop, formState, freshServer, goStaff, handle, harnessCodes, hmacB64u, ipN, many, menuState, netlifyLocation, one, openEvents, openForm, openMenu, openStaff, openWorkshop, part, post, pressSend, publishWorkshop, q, questionsOf, replacements, reply, resState, results, resume, searchState, send, serverContent, showField, sleep, staffSession, staffState, useConnect, weekDays, weekState, widths, words, workshopAnswers } from "./interact-harness.mjs";

for (const [what, files] of replacements) await part(`upload ${what}`, async () => {
  const { ctx, page, errors } = await openForm([1200]);
  await page.setInputFiles("#f-resume", { name: "resume.pdf", mimeType: "application/pdf", buffer: PDF });
  const going = await resume(page);
  await page.setInputFiles("#f-resume", files);
  const sent = await pressSend(page);
  check(sent.status !== words("form.upload.wait") && sent.summary && sent.resumeListed,
    `upload ${what} while the first is still going: Send answers with the missing resume, not "wait" (status "${sent.status}", summary ${sent.summary})`);
  await sleep(1400);
  const after = await resume(page);
  check(going.status.startsWith("Uploading") && after.id === "", `upload ${what}: the first file's late reply does not come back (id "${after.id}", status "${after.status}")`);
  const again = await pressSend(page);
  check(again.status !== words("form.upload.wait"), `upload ${what}: Send still answers after the late reply (status "${again.status}")`);
  check(!errors.length, `upload ${what}: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("upload replaced by a second PDF", async () => {
  const { ctx, page, errors } = await openForm([1200, 100]);
  await page.setInputFiles("#f-resume", { name: "old.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.setInputFiles("#f-resume", { name: "new.pdf", mimeType: "application/pdf", buffer: PDF });
  await sleep(400);
  const mid = await resume(page);
  await sleep(1200);
  const after = await resume(page);
  check(mid.id === fakeId(1) && after.id === fakeId(1) && after.status.includes("new.pdf"), `a second PDF replaces the first, and the first's late reply is ignored (id ${after.id}, "${after.status}")`);
  const sent = await pressSend(page);
  check(sent.status !== words("form.upload.wait") && sent.summary && !sent.resumeListed, `with the replacement up, Send checks the rest of the form and the resume counts as answered`);
  check(!errors.length, `replacement: no script errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await ctx.close();
});

await part("upload still going", async () => {
  const { ctx, page } = await openForm([800]);
  await page.setInputFiles("#f-resume", { name: "resume.pdf", mimeType: "application/pdf", buffer: PDF });
  const sent = await pressSend(page);
  check(sent.status === words("form.upload.wait"), `Send during a real upload still says to wait ("${sent.status}")`);
  await sleep(1000);
  const after = await page.evaluate(() => document.querySelector("[data-form-status]").textContent);
  check(after !== words("form.upload.wait"), `once that upload is up, the wait message goes ("${after}")`);
  await ctx.close();
});

await part("a form's width", async () => {
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + PAGE, { waitUntil: "networkidle" });
    const r = await widths(page);
    check(r.fields > 10 && !r.short.length, `@${width}: every question takes the ${r.form}px column (${r.fields} questions${r.short.length ? `; narrower: ${r.short.slice(0, 4).join(", ")}` : ""})`);
    check(!r.narrow.length, `@${width}: every text box and list fills its question${r.narrow.length ? ` (not: ${r.narrow.slice(0, 4).join(", ")})` : ""}`);
    if (width === 1280) check(r.compacts.length && r.compacts.every(Boolean), `@1280: a short value's control stays compact (${r.compacts.length} of them)`);
    check(r.sideways <= 0, `@${width}: nothing scrolls sideways`);
    await ctx.close();
  }
});

await part("Other answer fields at phone and desktop widths", async () => {
  const paths = ["/forms/staff-application/", "/forms/volunteer-application/", "/forms/program-request/", "/forms/programming-feedback/"];
  for (const js of [true, false]) for (const width of [1280, 768, 390, 320]) for (const path of paths) {
    const branches = js && path.includes("programming-feedback") ? ["workshop", "craft", "peer"] : [null];
    for (const branch of branches) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js });
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: "load" });
      if (branch) await page.locator(`input[name="category"][value="${branch}"]`).check();
      const measure = async () => {
        let ok = true, n = 0;
        for (const input of await page.locator("input.other-text:visible").all()) {
          n++;
          await input.fill("An example Other answer");
          const r = await input.evaluate(el => {
            const b = el.getBoundingClientRect(), p = el.closest(".choices").getBoundingClientRect();
            return { width: b.width, right: b.right, parentRight: p.right, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, value: el.value };
          });
          ok &&= r.width >= 100 && r.right <= r.parentRight + 1 && r.overflow <= 0 && r.value === "An example Other answer";
        }
        return { ok, n };
      };
      let fits = false, count = 0;
      if (js) {
        // A long form is walked a section at a time: choose Other on each step that offers it,
        // and measure each step's boxes while that step is up.
        const stepIds = await page.locator("[data-step-link]").evaluateAll((bs) => bs.map((b) => b.dataset.stepLink)).catch(() => []);
        let allOk = true;
        for (const id of stepIds.length ? stepIds : [null]) {
          if (id) await page.locator(`[data-step-link="${id}"]`).click().catch(() => {});
          for (const control of await page.locator('input[value="__other"]').all()) if (await control.isVisible()) await control.check();
          const m = await measure();
          count += m.n; allOk &&= m.ok;
        }
        fits = count > 0 && allOk;
      } else {
        const m = await measure();
        count = m.n; fits = m.ok && count > 0;
        // Without JavaScript a form that uploads a PDF gives its other way in instead of its questions.
        if (!count && await page.locator("form.has-uploads").count()) {
          check(await page.getByRole("heading", { name: words("form.upload.alternativeTitle") }).isVisible(), `Other input no JS @${width} ${path}: the upload form gives its other way in`);
          await ctx.close(); continue;
        }
      }
      check(fits, `Other input ${js ? "JS" : "no JS"} @${width} ${path}${branch ? `/${branch}` : ""}: ${count} fields fit, stay usable and accept typing`);
      await ctx.close();
    }
  }
});

await part("folded help", async () => {
  for (const js of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: js });
    const page = await ctx.newPage();
    // The volunteer form keeps folded help in its intro; the staff form shows its text open, as the live form does.
    await page.goto(BASE + "/forms/volunteer-application/", { waitUntil: "networkidle" });
    const folds = await page.evaluate(() => [...document.querySelectorAll("details.prose-more")].map((d) => d.open));
    check(folds.length > 0 && folds.every((o) => !o), `${js ? "" : "no JavaScript: "}${folds.length} folds, all closed until asked for`);
    // Without JavaScript this form uploads PDFs, so its questions (and their folds) give way to the contact alternative.
    if (!js) {
      check(await page.getByRole("heading", { name: words("form.upload.alternativeTitle") }).isVisible() && !(await page.locator("form.bss-form").isVisible()),
        "no JavaScript: the upload form shows its contact alternative instead of folds it could not send");
      await ctx.close(); continue;
    }
    const first = page.locator("details.prose-more > summary").first();
    if (js) {
      await first.focus();
      await page.keyboard.press("Enter");
      const opened = await page.evaluate(() => { const d = document.querySelector("details.prose-more"); return d.open && d.querySelector(".prose-more-body").getBoundingClientRect().height > 0; });
      await page.keyboard.press("Space");
      const shut = await page.evaluate(() => !document.querySelector("details.prose-more").open);
      check(opened && shut, `a fold opens with Enter and closes with Space from its label (${opened}, ${shut})`);
    } else {
      await first.click();
      check(await page.evaluate(() => document.querySelector("details.prose-more").open), "no JavaScript: a fold still opens when its label is pressed");
    }
    await ctx.close();
  }
});

finish(await closeAndTally("interact-uploads"));
