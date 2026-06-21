# asensios.com

Web personal de **Asensio Sabater** — _construyo comunidades, experiencias y oportunidades entre culturas._

Linktree premium + portfolio narrativo + zona de juegos. Estética inspirada en
**órbitas** (trayectorias, exploración, movimiento, conexiones) con un toque
mediterráneo, limpio y humano.

## Stack

- [Vite](https://vitejs.dev/) (multi-page, sin framework pesado)
- HTML + CSS (design system con tokens) + JavaScript vanilla
- Juegos en `<canvas>` puro, sin dependencias

## Rutas

| Ruta              | Descripción                                              |
| ----------------- | -------------------------------------------------------- |
| `/`               | Home tipo Linktree premium (identidad, enlaces, CTAs)    |
| `/business`       | Historia narrativa en 6 capítulos + "What I build" + CTA |
| `/games`          | Playroom: minijuegos _Fruit Dash_ y _Fruit Catch_        |
| `/trajectory.html`| Ruta legacy — redirige a `/business` (301)               |

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo
npm run build     # build de producción -> dist/
npm run preview   # sirve dist/
npm run lint      # eslint
```

## Despliegue

`npm run build` genera `dist/`, una carpeta estática lista para cualquier host.

- **Netlify**: usa `dist/_redirects` (incluye redirección legacy de `/trajectory.html`).
- **Vercel**: usa `vercel.json` (`cleanUrls` + redirecciones).
- Otros hosts estáticos: los enlaces internos usan barra final (`/business/`,
  `/games/`) para resolver el `index.html` en cualquier servidor.

El avatar (`public/avatar.svg`) es un monograma de marcador de posición; sustitúyelo
por una foto real (`public/avatar.svg` o `.jpg` actualizando el `src` en `index.html`)
cuando esté disponible.

## Estructura

```
index.html              Home
business/index.html     /business
games/index.html        /games
trajectory.html         Redirección legacy -> /business
src/
  styles/               Design system (tokens, home, business, games)
  lib/reveal.js         Scroll reveal + count-up
  games/                Fruit Dash + Fruit Catch (canvas)
public/                 avatar, favicon, og, robots, sitemap, _redirects
```
