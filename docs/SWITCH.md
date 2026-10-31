# The switch

How www.badgersupports.org moves from Google Sites to this site, what was checked before it, and how to undo it.
Queue item 25 (`../WORK.md`). Checked 30 Oct 2026 on `23afc2e`. Nothing here has been switched, published or changed
in DNS; every step below is the owner's.

## How it was checked

Netlify Deploy Previews are off and the production site answers 401 (team login on every deploy), so nothing could be
checked on Netlify. Instead:

- **The site**: a production build (`node ops/build.mjs --production`) of `23afc2e`, with the photos, in a cloud copy,
  against a fake Connect sending fictional events and the repository's resource fixture. Served by the local rig
  (`ops/dev-server.mjs`), which hands every page address to the page function as Netlify does.
- **The domain**: read-only DNS lookups (Google's public resolver) and one unfollowed request to each address.
- **The gate**: `node ops/check.mjs --browser` on the same tree, with the photos, in Chromium 153 standing in for the
  pinned 151: exit 0 (tests, screenshots, accessibility and the interaction suite all passed).

A green result here proves this build in the local rig, not the live site. "Netlify's matcher" below means the
`netlify-redirector` package (0.5.0) that Netlify's command line uses; that it matches exactly as Netlify's servers do
is not verified.

## Results

| Check | Result | Left |
|---|---|---|
| Shortlinks | 52 `*.badgersupports.org` names are Squarespace forwards (`ext-sq.squarespace.com`). 12 forward to pages on www (below); 40 go to Google Docs, Sheets, Drive and Forms, Canva, Instagram, LinkedIn, WIN and a UW PDF. Changing only the `www` record touches none of them | Mendota Lodge (blocker 3) |
| The six subdomains | `win`, `insta`, `feedback`, `toolkit` forward away from www; `housing` and `apply` forward to www pages that this site answers (below) | `feedback` can point at `/forms/programming-feedback/` once that form opens (item 31) |
| The ribbons path | The rig sends `/initiatives/ribbons-%E0%B1%A8%E0%A7%8E` to `/initiatives/ribbons/` in upper or lower case. Netlify's matcher matches the upper-case form, which is what browsers send, with or without a final `/`; it does not match lower case | Confirm on the live site after the switch |
| Redirects | All 34 live addresses in `content/routes.json`, typed as the live site links them, end on their page. With a final `/` added, all 13 redirected addresses answer 404 in the rig, and so do the four team catch-alls; Netlify's matcher sends every case tried (four of the 13, and a team address with and without the `/`) to the right page | Blocker 4 |
| The privacy policy | `/operations/privacy-policy/` is built, and still names Google Sites, Google Analytics and Google Forms | Blocker 5 (queue item 4) |
| SEO | 40 pages: 36 indexable, all 36 in `sitemap.xml`, none of the 4 noindex pages in it; canonical `https://www.badgersupports.org/…` on all 40; one `<h1>`, `lang="en"` and a viewport on each; `robots.txt` names the sitemap. The live site has no `robots.txt` or sitemap | No page has a share picture (`og:image`); the live homepage has one. `/crawlers/` has no description; two descriptions run past 160 characters; `/forms/workshop-request/` and `/join/request-a-workshop/` share a title |
| Accessibility | axe 4.14 (WCAG 2.0, 2.1 and 2.2 A and AA) on all 40 pages at 390 and 1280 px: 80 of 80 measured, no violations. No sideways scroll at 320 px on any page | axe cannot score text on a gradient (the announcement bar and similar): check its contrast by eye. Lighthouse adds an ARIA role on the home page's support-network card, a skipped heading level there, and a "Learn More" link on Peer Support Groups |
| Mobile performance | Lighthouse 12.8 (phone, slow 4G simulated), behind a compressing proxy as Netlify compresses: performance 88 to 97 on seven pages; largest image 2.3 to 2.7 s; layout shift 0 to 0.006 except `/resources/` at 0.116 | On every page Lighthouse asks for the largest picture to be fetched first; the resource list moves as it loads |

The 12 shortlinks that forward to www, and what this site does with each page:

| Shortlink | Page on www | Here |
|---|---|---|
| `housing` | `/initiatives/housing-hub` | its page |
| `workshops` | `/join/request-a-workshop` | its page |
| `craft` | `/join/craft-nights` | its page |
| `join` | `/join/peer-support-groups` | its page |
| `apply` | `/join/get-involved` | its page |
| `house` | `/initiatives/open-house` | its page |
| `usq` | `/initiatives/university-square` | its page |
| `sac` | `/initiatives/student-activity-center` | its page |
| `mhh` | `/about/mh-hub` | 301 to `/directions/sac-mhh/` |
| `hearts` | `/initiatives/little-hearts` | 301 to `/directions/sac-mhh/` |
| `res` | `/resources/health` | 301 to `/resources/?topic=health` |
| `mendota` | `/operations/directions/mendota-lodge` | **404**: the live page exists ("Mendota Lodge"), but it was not in the 19 Oct crawl or `content/routes.json` |

## The domain today (read 30 Oct 2026)

- Nameservers are Google's (`ns-cloud-a1` to `a4.googledomains.com`). The records are edited in Squarespace Domains
  (the intranet's notes of 3 Aug 2026; the panel was not opened this session).
- `www` is a CNAME to `ghs.googlehosted.com` (Google Sites), with a TTL of 14,400 seconds.
- The bare `badgersupports.org` is four Squarespace addresses that answer 301 to `http://www.badgersupports.org/`.
- Mail is Google Workspace (MX). The apex holds SPF, two Google site verifications, a Microsoft and an Apple
  verification, and DMARC. There is no CAA record, so nothing stops Netlify's certificate.
- `style` is GitHub Pages and `home` is Connect on Netlify.

**Keep the nameservers.** Moving them to Netlify would mean recreating the mail, verification and 52 forwarding records
first. The switch changes one record.

## Before the switch

1. **Make production public.** Netlify, project `badgersupports-public`: team login protects every deploy today. Set it
   to protect non-production deploys only, at the moment of the switch, not before.
2. **Let staff sign in from www.** Connect registers one callback for this site,
   `https://badgersupports-public.netlify.app/api/auth/callback` (Connect's reply, Exchange
   `done/PUBLIC-EVENT-IDS-AND-SIGN-IN-2026-10-23.md`). Add `https://www.badgersupports.org/api/auth/callback` to
   Connect's `PUBLIC_SSO_CLIENTS`. It is a Netlify setting on Connect, so it is the owner's edit.
3. **Mendota Lodge.** Decide what `/operations/directions/mendota-lodge` becomes (a directions page here, or a 301),
   then add it to `content/routes.json`. Until it is there, `cutoverProblems()` cannot see it.
4. **Redirects with a final `/`.** The page function matches redirect lines exactly (`redirectFor()` in
   `netlify/lib/pages.mjs`): no splat, no optional `/`. Whether Netlify applies `_redirects` before the page function
   is not known. Teach `redirectFor()` the splat and the optional `/`, so the answer does not depend on it.
5. **The privacy policy** describes Google Sites, Analytics and Forms (queue item 4).
6. **Publish** the commit the switch will serve, with `../PUBLISH-WEBSITE-2026-10-23.command`.
7. **Shorten the undo.** If Squarespace offers a lower TTL for the `www` record (not checked), set it at least one
   current TTL before the switch, so an undo reaches visitors sooner.

Three things change for visitors and are the owner's to accept: the team page shows no people until Connect sends its
team export (`exports.team`), so the 38 member addresses of the 19 Oct crawl land on `/about/our-team/`; Google Analytics stops counting
www, because this site loads no tag (`ANALYTICS.md`); and links shared on social media show no picture.

## The switch

Nothing else in DNS changes.

1. **Netlify**, `badgersupports-public` › Domain management: add `www.badgersupports.org` as the primary domain. Do not
   add the bare domain, and do not choose Netlify DNS. Note the target Netlify shows for the CNAME.
2. **Netlify** › Site protection: team login on non-production deploys only.
3. **Squarespace Domains** › DNS: change the `www` CNAME from `ghs.googlehosted.com` to the target from step 1
   (Netlify's usual answer for a subdomain on outside DNS is `badgersupports-public.netlify.app`; use what step 1 shows).
4. **Netlify** › Domain management › HTTPS: confirm the certificate lists `www.badgersupports.org`. If it does not,
   press Renew certificate. Until it does, visitors who reach Netlify see a certificate warning.
5. **Check the live site** (below).

## Checking it

A session runs the item 25 checks against `https://www.badgersupports.org` (the PUBLIC-SITE handoff folder holds the
script): every live address and its `/` form, the 12 shortlinks, the ribbons spellings, `robots.txt`, `sitemap.xml`, a
404, and the headers. Then a person opens the home page, signs in at `/staff/`, and opens one shortlink on a phone.

## Undoing it

1. **Squarespace Domains**: set the `www` CNAME back to `ghs.googlehosted.com`.
2. Leave Netlify as it is. The custom domain and site protection do no harm while DNS points away.

This works only while Google Sites still holds its custom address, so **do not remove www from Google Sites' custom
domains** until the owner closes the switch. Visitors return to Google Sites as their DNS answer expires (the TTL
above). No form submission is stranded either way: the production forms are closed and link their Google Forms.

## After it holds

- Search Console: submit `https://www.badgersupports.org/sitemap.xml`. Which property type is verified is not known.
- Point `feedback` at `/forms/programming-feedback/` when that form opens (item 31).
- Optionally point the shortlinks at the new addresses (`mhh`, `hearts`, `res`) to save a hop, and the bare domain's
  forward at `https://` instead of `http://`.
- Remove www from Google Sites' custom domains, when the owner closes the switch.
