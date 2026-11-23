/* Withheld answers (workflow audit PF-10): when no definition can be found for a submission —
   neither its own version's nor the form's current one — the staff answers view used to render
   the raw stored answers with nothing stripped, failing open. It now withholds every answer and
   marks the row, so the reader sees an answer arrived and why it is not shown. The state is
   defensive (form versions are never deleted today); the row below is put there by hand. */

import test from "node:test";
import assert from "node:assert/strict";
import { freshServer } from "./helpers.mjs";
import { q } from "../netlify/lib/db.mjs";
import { latestAnswers } from "../netlify/lib/answers.mjs";

test("an answer with no readable definition is withheld whole, never rendered raw", async () => {
  await freshServer();
  await q(`INSERT INTO submissions (ref, form_key, form_version, idem_key, answers, anonymous, context)
           VALUES ('PF10-1', 'form-that-is-gone', 7, 'hand-pf10-1', $1::jsonb, false, '{}'::jsonb)`,
    [JSON.stringify({ work_study: "a confidential answer", note: "an ordinary one" })]);
  const out = await latestAnswers("form-that-is-gone");
  assert.ok(out, "the form's answers still answer, with its rows");
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].ref, "PF10-1");
  assert.equal(out.items[0].withheld, true);
  assert.deepEqual(out.items[0].answers, {});
  assert.deepEqual(out.columns, [], "no column is invented from an unread definition");
  assert.ok(!JSON.stringify(out).includes("confidential answer"), "the confidential answer is nowhere in the answer");
  assert.ok(!JSON.stringify(out).includes("an ordinary one"), "nor is any other answer: the withholding is whole");
});
