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
type: cronica                # cronica | postal | despacho | momento | fotoensayo | interludio
section: cronicas            # defaults to the folder's section
location: "Santiago de Chile"
summary: "Una línea que aparece en portada, en el RSS y en Open Graph."
cover: "/media/004/portada.jpg"
coverAlt: "Descripción de la imagen"
note: "Nota al margen que aparece junto al texto."
media:
  - src: "/media/004/01.jpg"
    alt: "..."
    caption: "Providencia · 22:47"
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
