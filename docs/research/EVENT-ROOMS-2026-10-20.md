# Event rooms — what Badger Supports has used, 2026-10-20

The question: which rooms besides the Hub need a record in `content/places/`. Evidence is the live
site (crawled 19 Oct), Connect's event list (the events CSV in Connect's history, read-only) and the
location data in event photos on the shared Drive. Events are named here by type and date only.

## Rooms

| Room | Record | State | Used by | Evidence |
|---|---|---|---|---|
| Student Mental Health Hub, SAC 3203 | `sac-mhh` | published (kind `hub`) | peer groups, Dogs on Call, open house | live site, Connect list |
| Caucus Room, SAC 4th floor | `sac-caucus` | published | craft nights 8/25, 9/2, 10/6, 10/20; housing 10/13, 11/10 | live site, Connect list, photo GPS |
| Lutheran Campus Ministry, 325 N Mills St | `lcm` | published | craft night 9/14 | live site, Connect list, photo GPS |
| Multipurpose Room, SAC 4th floor | `sac-multipurpose` | published: the Caucus steps, its own map | craft night 10/14 | live site, Connect list, photo GPS |
| Tripp Commons, Memorial Union 2nd floor | `memorial-union-tripp` | published: address only | craft night 11/18 | live site, Connect list |
| Hearing Room, SAC 4th floor | `sac-hearing` | published: the Caucus steps, its own map | housing workshop 10/7 | live housing page, Connect list |
| The Marquee, Union South 2nd floor | `union-south-marquee` | published: address only | housing workshop 9/28 | Connect list only |

Every location in Connect's event list maps to one of these seven. Floors and addresses for the two
Union rooms come from the Wisconsin Union's own pages
([Union South](https://union.wisc.edu/visit/union-south),
[Tripp Commons](https://union.wisc.edu/host-your-event/spaces-and-facilities/memorial-union/tripp-commons));
the SAC rooms' floors from the live site.

All seven are published, as the owner ruled on 20 Oct: "Hearing Room and Multipurpose room can use the
Caucus room steps, edit the image of the map to show where the rooms are. Show addresses only for
Marquee and Tripp". A published room needs an address; steps are optional, and a room without them
shows its address card alone. The Hearing and Multipurpose maps are the live Caucus plan with the
orange moved onto the room the plan itself labels (4201 and 4213), drawn by `ops/room-map.mjs`. A
draft room still has no page and no link: an event in it shows the room's name and no directions.

## Not rooms

- **Partner-hosted workshops** (a FIG class, a residence program, partner groups, a newspaper): the
  host's room, not ours.
- **Tabling** (org fairs, a wellbeing fair, Paint the Town at Memorial Union, 9/27): a table, not a
  destination.
- **Campus Relations event at Olin House** (9/22): someone else's venue, like the workshops above.

## Unknown

Photos before 2026 carry no location data, and nothing written names the room for: craft nights in
2024-25 and 2025-26; EBNS events 2025-11-09, 2026-03-22, 2026-04-12; the leadership
social 2026-04-28; training sessions; the housing workshop of 2025-09-19. Dogs on Call 2025-26 was
probably the Hub. If any of these rooms return, they come in through Connect's saved rooms.

## Where rooms come from in production

Connect's saved rooms (Exchange request PUBLIC-SITE-EDITOR-2026-10-20, "Rooms: one list, not two")
and each public event naming its room by id (PUBLIC-EVENTS-EXPORT-2026-10-20). Both are already
filed; this finding needs no new request.
