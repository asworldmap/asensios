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

## Capa de motion — "A life in motion"

Añadida sobre la web existente sin tocar su contenido, estructura ni estilos.

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Despegue orbital | Home → `/business/` | La interfaz retrocede y nos alejamos de Murcia → España → Europa → Tierra → espacio; se dibujan las rutas a Berlín, Helsinki, Seúl y Japón; aterrizamos en la trayectoria. |
| Asensio Worldmap | Fondo de la historia en `/business/` | Globo editorial vinculado al scroll: el planeta gira de Europa a Asia y luego cruza el Pacífico hacia Sudamérica. Santiago aparece el último. |
| Warp | Home / `/business/` → `/games/` | Túnel de estrellas breve para que el Playroom pertenezca al mismo universo. |

Controles del despegue: se puede saltar (clic, `Esc`, `Enter`) y *scrubbear*
con la rueda — hacia abajo avanza, hacia arriba retrocede.

Decisiones técnicas:

- **Sin librerías de animación.** GSAP + ScrollTrigger (~70 kB gz) serían varias
  veces el JS total del sitio para efectos que aquí ocupan ~5 kB.
- **Todo procedural en canvas 2D.** Sin vídeo, sin secuencias de imágenes, sin
  WebGL ni texturas: pesa casi nada, es independiente de la resolución y —
  clave— se puede *scrubbear* con el scroll, cosa imposible con un clip.
- **Carga diferida.** Los módulos cinematográficos son chunks aparte que se
  piden al pasar el ratón/foco sobre el enlace. La carga inicial no cambia.
- **Progressive enhancement.** Desktop completo · tablet simplificado · móvil
  ligero y rápido. Con `prefers-reduced-motion` la navegación es normal.
- **Sin repintado ocioso.** El worldmap sólo dibuja al hacer scroll o al fundir;
  cuando el globo está quieto no consume nada.

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

- **Hostinger (VPS, Apache/LiteSpeed)**: sube el contenido de `dist/` al
  document root. Incluye `.htaccess` con la redirección legacy y la caché.
- **Netlify**: usa `dist/_redirects`.
- **Vercel**: usa `vercel.json` (`cleanUrls` + redirecciones).
- Otros hosts estáticos: los enlaces internos usan barra final (`/business/`,
  `/games/`) para resolver el `index.html` en cualquier servidor.

## Estructura

```
index.html              Home
business/index.html     /business
games/index.html        /games
trajectory.html         Redirección legacy -> /business
src/
  styles/               Design system (tokens, home, business, games) + cinematic
  lib/reveal.js         Scroll reveal + count-up
  lib/motion.js         Utilidades de motion, arrival y cableado de transiciones
  lib/globe.js          Globo ortográfico: proyección, rutas, nodos
  lib/cinematic.js      Transiciones orbit / warp (chunk diferido)
  lib/worldmap.js       Asensio Worldmap vinculado al scroll (chunk diferido)
  games/                Fruit Dash + Fruit Catch (canvas)
public/                 avatar, favicon, og, robots, sitemap, _redirects, .htaccess
```
