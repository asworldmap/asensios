# content/media/004 — «La diplomacia también se come»

Cuatro fotografías. El relato ya está escrito y publicado como texto; los
anclajes están puestos en el cuerpo y esperan a estos archivos.

| Archivo | Anclaje | Papel | Qué buscar |
|---|---|---|---|
| `portada.jpg` | `cover` | **Apertura** | La sala o la mesa antes de que llegue la gente. Horizontal, ancha. Sitúa el lugar sin enseñar todavía la comida. |
| `sala.jpg` | `[[sala]]` | **Ambiente** | La noche mientras ocurre: gente de espaldas, manos, copas, la luz del salón. Nada de banderas ni de fotos de atril. |
| `mesa.jpg` | `[[mesa]]` | **Transición** | El servicio: la mesa puesta, un plato saliendo, el momento antes del bocado. |
| `plato-conejo.jpg` | `[[plato]]` | **Protagonista** | El ragú de conejo, en detalle y a máxima calidad. Que se vean los pistachos y el filo de la lámina de patata negra. Es la imagen más grande del relato. |
| `final.jpg` | `[[final]]` | **Cierre** | El plato terminado, una copa vacía, la salida. Pequeña y silenciosa. |

## Cómo publicarlas

1. Copia los archivos aquí con **exactamente** esos nombres.
2. En `content/relatos/004-la-diplomacia-tambien-se-come.md`, descomenta el
   bloque `cover:` / `media:` de la cabecera (quitar la `#` inicial de cada
   línea).
3. `git push`. El resto es automático.

## Notas técnicas

- JPEG, WebP, AVIF, PNG y GIF valen. Si dejas `plato-conejo.avif` o
  `.webp` junto al `.jpg`, el generador emite un `<picture>` y sirve el
  formato ligero a quien pueda leerlo.
- Las dimensiones se leen de la propia imagen, así que la página no da
  saltos mientras carga. No hace falta declarar nada.
- El lado largo de `plato-conejo` conviene que ronde los 2400 px; el resto,
  1800 px basta.
- Si una imagen declarada no existe, **la compilación falla a propósito** en
  lugar de publicar una foto rota.
- Este README no se publica: el generador no copia `README.md` al sitio.
