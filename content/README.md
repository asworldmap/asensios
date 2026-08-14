# content/ — the source of truth

Everything a reader sees is generated from this folder by
`tools/blog/build.mjs`. Never edit generated HTML.

```
relatos/    crónicas — long-form stories        → /relatos/<slug>.html
postales/   image-led, 50–250 words             → /postales/<slug>.html
despachos/  short notes on work and the city    → /despachos/<slug>.html
momentos/   short vertical video                → /momentos/<slug>.html
media/      photographs and video               → /media/...
social/     instagram.json adapter (see file)
```

## Frontmatter

Required: `title`, `slug`, `date`. Everything else is optional.

```yaml
---
title: "De cómo..."
slug: "004-de-como"          # becomes the URL — never change it after publishing
date: 2026-08-18
type: cronica                # cronica | cronica-visual | postal | despacho | momento | fotoensayo
section: cronicas            # defaults to the folder's section
palette: mesa                # optional accent palette (only "mesa" so far)
location: "Santiago de Chile"
summary: "Una línea que aparece en portada, en el RSS y en Open Graph."
cover: "/media/004/portada.jpg"
coverAlt: "Descripción de la imagen"
note: "Nota al margen que aparece junto al texto."
media:
  - src: "/media/004/01.jpg"
    alt: "..."
    caption: "Providencia · 22:47"
    anchor: plato            # optional — see below
    size: full               # inset | wide | full (cronica-visual only)
  - src: "/media/004/clip.mp4"
    poster: "/media/004/clip.jpg"
    caption: "14 segundos desde Santiago"
featured: true               # promotes it to the front-page lead
draft: false                 # true keeps it out of the build
carta: false                 # hides the "Carta al autor" block on this piece
---

El cuerpo del relato, en Markdown.
```

`type` selects the editorial layout; all types share one publication
identity. Media is matched by extension: `.mp4/.webm/.mov` render as
video, everything else as a figure. Drop `foto.avif` or `foto.webp`
beside `foto.jpg` and the build emits a `<picture>` automatically.

Referencing a photograph that isn't in `content/media/` fails the build
rather than publishing a broken image. Drafts are exempt, so a piece can be
written before its media arrives.

## Anchors — placing an image on a beat

Give a media item an `anchor`, then write `[[anchor]]` alone on its own line
in the body. The image lands exactly there instead of queueing at the end.
`[[nota]]` is reserved: it places the frontmatter `note` as a pull quote.

An anchor with no media behind it prints nothing, so a story can be
published as text first and gain its photographs later without the
placeholders ever showing up on the page.

Anchors and `size` only change the layout in `type: cronica-visual`, which
holds the text at reading measure and lets images break wider around it.
