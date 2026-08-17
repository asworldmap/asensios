# Relatos desde Santiago — V3 architecture decision record

Date: 2026-08-14. Supersedes the hand-written HTML blog (V2).

## The contradiction we are building for

Old-fashioned and human on the surface; automated and contemporary underneath.
Every decision below is judged against that, not against novelty.

## What V2 was

Nine hand-maintained files in `blog/`, rsynced verbatim to
`/var/www/blog.asensios.com` by `.github/workflows/deploy-blog.yml`, served
by Caddy with automatic HTTPS. Publishing a story meant hand-editing the
story HTML, the homepage, the archive, the sitemap and the prev/next links
— five places, five chances to get it wrong.

## Decision 1 — build-time generator, no runtime

A small Node generator (`tools/blog/build.mjs`) reads Markdown + YAML
frontmatter from `content/` and writes a complete static site to
`blog-dist/`. Caddy still serves plain files; nothing executes at request
time. This is the smallest thing that removes the five-places problem.

Rejected: Next.js/Astro/Eleventy (a framework and its upgrade treadmill for
what is ~450 lines of templating), WordPress/any CMS (a database and an
attack surface for three Markdown folders), and writing our own Markdown
parser (a bug farm).

## Decision 2 — Node, not Python

The repository is already a Node project (Vite, eslint, npm scripts) and CI
already runs `npm ci`. A Python generator would mean a second toolchain in
the same pipeline for no benefit.

## Decision 3 — exactly two build-time dependencies

`marked` (Markdown) and `js-yaml` (frontmatter). Both are pure JS, tiny,
stable, and used only at build time — they ship nothing to the reader.
Everything else (templating, feeds, sitemap, image dimensions, prev/next)
is plain JavaScript in the generator, because it is a few dozen lines each
and a dependency would cost more than it saves.

## Decision 4 — self-hosted fonts from packages we already have

`@fontsource/instrument-serif` and `@fontsource/ibm-plex-mono` are already
dependencies of this repo. The build copies their woff2 files into the
output and `@font-face`s them locally. No external font CDN, no new
dependency, no third-party request from the reader's browser.

Instrument Serif carries the masthead and headlines; a system serif stack
(Iowan Old Style / Palatino / Georgia) carries long-form body text, because
it is what actually reads well at length on every platform; IBM Plex Mono
carries dates, issue numbers and section labels.

Deliberately **not** blackletter. Without a licensed display face available
offline, a blackletter masthead would have to be faked or fetched from a
CDN, and the brief warns against a novelty-German look. The masthead gets
its identity from scale, tight tracking, small caps and double rules
instead. A licensed display face can be dropped into
`tools/blog/theme/fonts/` and enabled with one `@font-face` block later.

## Decision 5 — URLs are permanent

The three existing stories keep their exact paths
(`/relatos/001-no-parti-el-dia-previsto.html` and siblings). The slug lives
in frontmatter, so the generator reproduces those routes rather than
inventing new ones. Nothing already shared or indexed breaks.

## Decision 6 — no invented content

Only the three real relatos are migrated. `postales/`, `despachos/` and
`momentos/` exist as empty, documented folders. The front page renders
**only sections that actually have content**, so the newspaper grows into
its own structure as Asensio writes, rather than shipping with placeholder
stories. The visual identity therefore has to come from typography,
hierarchy and editorial furniture — which is the right place for it anyway.

## Decision 7 — deferred on purpose

- **Image transcoding (AVIF/WebP)** — would mean `sharp`, a heavy native
  dependency, for an archive that currently has no photographs. The build
  already emits `srcset` when variants exist beside the original, plus
  intrinsic `width`/`height` read from the file header to prevent layout
  shift. Add `sharp` when there is a real photo archive to justify it.
- **Maps** — the brief calls them optional and warns against decoration.
  Locations are captured in frontmatter, so the data will be there when a
  map earns its place.
- **Cartas al autor submission** — the component ships, the network call
  does not. See below.
- **Instagram sync** — adapter boundary only. See below.

## Data flow

```
content/**.md + content/media/**        source of truth, hand-written
        │
        ├── tools/blog/build.mjs        the printing press
        │      marked + js-yaml → HTML, feeds, sitemap, manifest
        │
        ▼
blog-dist/                              generated, gitignored
        │
        ├── .github/workflows/deploy-blog.yml
        │      npm ci → npm run build:blog → rsync --delete
        ▼
/var/www/blog.asensios.com              Caddy, automatic HTTPS
```

## Cartas al autor

A `mailto:` the generator writes in full at build time — subject, greeting
and the canonical URL of the relato it belongs to. There is no form, no
endpoint, no database and no third-party form service, so the link works
with JavaScript switched off and nothing is stored anywhere: the letter
goes from the reader's own mail client to a personal inbox.

Presented as a colophon line ("Escríbeme un mensaje"), not a comment box.
Nothing a reader sends is published, and the address is shown in plain text
beside the link so a browser that cannot open a mail client still leaves
them somewhere to write to.

The form this replaced was permanently disabled — a component waiting for a
backend that was never going to be worth running for a personal newspaper.

## Instagram

Instagram is treated as an ephemeral **source**, never as infrastructure.
The site reads `content/social/instagram.json`, a plain adapter file with a
documented schema. Media referenced there is served from our own
`/media/`, so the page never depends on Instagram being up and never leaks
a reader's request to Meta.

No official Meta/Instagram API credentials exist in this repository or
environment (checked: no secrets, no config, no client). Nothing was
scraped and no unofficial endpoint is used. When Asensio's account is
eligible for the official Instagram Graph API, an ingestion script can
write that same JSON file server-side without the frontend changing at all.

## Author workflow

```
write content/relatos/004-....md   +   drop files in content/media/004/
git commit && git push
        ↓  CI builds and deploys
story page, front page, archive, section pages, prev/next,
sitemap, RSS, Open Graph, canonicals, WhatsApp copy — all regenerated
```

No hand-editing of `index.html`, the archive, the sitemap or navigation,
ever again.
