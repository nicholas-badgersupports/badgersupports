# Explore Campus feeds — verification, 11 November 2026

Written before the EXPLORE-A-EVENTS build (WORK item 41), as its entry requires: the UW Events API
documentation and terms read, the Wisconsin Union feed's format and completeness confirmed, and the
time-zone question settled against the site's existing event handling. Checked live on 11 Nov 2026.

## UW–Madison Events (today.wisc.edu)

- Documentation: https://today.wisc.edu/api-docs/. The API is read-only (GET only); appending `.json`
  to a today.wisc.edu address returns the matching view as a JSON array. Endpoints exist by department,
  by tag, by feed and by search term, plus a single-event view. The general listing
  `https://today.wisc.edu/events.json` answers the same shape.
- Parameters: `limit` / `per_page` (maximum 100), `page`, `date`, `start`, `end` (YYYY-MM-DD), `tags`.
  The build pages through the listing for a window from today to 62 days out and stops at the first
  short page, with a hard cap of 6 pages (600 events).
- Fields used: `id`, `title`, `subtitle`, `description`, `startDate8601` / `endDate8601` (ISO 8601
  instants with the Chicago offset), `allDayEvent`, `cost` (empty string when the source states no
  cost), `url`, `sponsor`, `tags`, `location`, `building.name`. Because the feed carries true instants,
  no wall-clock conversion is applied to UW events, so nothing can be shifted across a daylight-saving
  change (the PUBLIC-EVENT-TIME-INSTANTS concern in Connect's queue).
- Terms: the documentation publishes no rate limit, key or attribution requirement. The explorer links
  every card to the official listing and names the source ("UW–Madison Events"), reads at most once
  per refresh cycle, and keeps the last good answer when a read fails, so this site's load on the API
  stays at a few requests per half hour.

## Wisconsin Union events

- The calendar is https://union.wisc.edu/events-and-activities/event-calendar/. The queue entry names
  its feed as `…/event-calendar/feed_1`. **Checked 11 Nov 2026: `feed_1` carries titles only** — 170
  `<event>` elements, each with an `event_title` and a `source`, and no date, time, place or link.
  It cannot fill a single explorer card, so it cannot be the feed the entry's acceptance lines assume.
- The same calendar's full feed at `…/event-calendar/feed` (no suffix) carries the same 170 events
  with `event_start_date`, `event_start_time`, `event_end_time`, `event_title`, `event_sponsor`,
  `category`, `status`, `location`, `venue`, `room`, `cost`, `url` and `event_id`. The build reads the
  full feed and reads `feed_1` as well only to count it; the count read and the count shown are both
  recorded in the build report and in the API answer (`report`), so a silent drop is visible.
- Values seen on 11 Nov 2026: `status` is `None` (shown as nothing) or `sold_out` (shown as "Sold
  out", because the source states it); `cost` is empty when unstated and a price string when stated;
  `event_sponsor` is `None` when there is none. All three are carried only when the source states
  them, per the entry's rule 8.
- The feed gives wall times with no offset. The Union is in Madison, so its times are read as
  America/Chicago wall times and turned into instants by the site's own Chicago conversion
  (`src/shared/chicago-time.mjs`), the same conversion Connect's events already use.
- An event whose `event_date` names a later end date than its start date runs to that date; otherwise
  it ends on its start date.

## Badger Supports programs

Connect's existing public events export, read the way the rest of the site reads it
(`ops/connect-feed.mjs`, `netlify/lib/live-events.mjs` — the ≤30-minute public-content path of item
34). The explorer takes Connect's dated events only; the weekly groups keep their own pages. A Badger
Supports card is labelled as a Badger Supports program and named as its own source, so it is distinct
from an external listing by words, not by colour alone.

## Deduplication

A listing present in both the UW feed and the Union feed (the Union cross-posts to the campus
calendar) merges into one card when the normalized title, the start instant (to the minute) and the
normalized venue all match. The merged card keeps both source links and names both sources. A
fixture proving this is in `test/campus-events.test.mjs`.

## Refresh and failure

The explorer's answer is served by `GET /api/campus-events` (`netlify/lib/campus-events.mjs`): the
two feeds are read at most once every five minutes by a warm function, the CDN holds an answer five
minutes, and a failed read answers with the last good list and its "last updated" time. A publish
also writes the build's own read into the page, so the page is useful before any script runs.
