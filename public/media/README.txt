public/media/ — el pack de cinco fotos reales
==============================================

Estos cinco archivos NO están en el repositorio: llegaron a la conversación
como imágenes, no como ficheros en disco, así que no se pueden escribir ni
recortar aquí. No se ha generado ninguna sustituta.

El sistema que los consume (assets/) sí está completo: `.ph`, la reserva de
proporción, el object-position de cada uno y la degradación en
src/lib/media.js. Copia los cinco archivos aquí con estos nombres exactos y
las dos primeras historias del capítulo quedan completas sin tocar código.

  finland-2018.webp            Finlandia · capítulo 1        4:5 · 1000×1250
  korea-cherry-signpost.webp   Corea del Sur · capítulo 2     4:5 · 1000×1250

Reservados para cuando exista una sección que los aloje (no se han añadido
capítulos nuevos en este paso — ver nota en el PR):

  eu-parliament.webp           16:9 · 1920×1080
  japan-torii-swy.webp         4:5 · 1000×1250
  beemoney-byg-stage.webp      3:2 · 1500×1000

Mientras un archivo no exista, esa foto simplemente no aparece: el capítulo
vuelve a una columna sola. No hay huecos rotos ni peticiones repetidas.

WebP calidad ~82, por debajo de 180 KB cada una, sin EXIF ni geolocalización
(`-strip` / `-metadata none`).

Pendiente — capítulo KEIKOA (v3):

  keikoa-team.webp             País Vasco · KEIKOA         3:2 · sugerido ~1600×1066

El bloque ya está montado en trajectory/index.html como `.moment--wide
.has-media` apuntando a este nombre exacto. En cuanto el archivo exista aquí,
la foto aparece sin tocar código; si el aspect ratio real es distinto a 3:2,
cambia la clase `.ph-3x2` de esa figura por la que corresponda (`.ph-4x5`,
`.ph-4x3`, `.ph-16x9`, `.ph-9x16`).
