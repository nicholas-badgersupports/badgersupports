/* The outbox on its timer (workflow audit PF-2): every fifteen minutes, give deliver.mjs's full
   pass — Connect ingest, receipts, team notices, the backup workbook — its run. Until this
   function existed the pass had no caller: receipts, notices and backups could never send, and a
   failed ingest was retried only when an unrelated submission happened to arrive.

   Fifteen minutes is the rhythm the retry arithmetic already assumes (deliver.mjs): a failed row
   waits two, four, eight, then fifteen minutes at most, so the longest wait plus one run of this
   timer stays inside the thirty minutes the owner settled for a retry (docs/COMMUNICATIONS.md;
   WORK item 18, whose activation list names this schedule). A run with nothing due reads the
   next-due note in the published store and returns without waking the database (runOutbox). */

import { runOutbox } from "../lib/deliver.mjs";

export default async () => {
  try {
    const out = await runOutbox();
    if (out.woke) console.log(`outbox: ${JSON.stringify(out)}`);
  } catch (e) {
    /* A failed run is logged, never answered as one: the next run is fifteen minutes away, and
       every row keeps its own back-off and attempt count either way. */
    console.error(`outbox: the scheduled run failed (${e.code || e.message})`);
  }
  return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
};

export const config = { schedule: "*/15 * * * *" };
