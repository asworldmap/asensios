public/cinematic/ — los dos vídeos reales del sitio
=====================================================

  earth-limb.webm    + earth-limb.mp4     16:9   ~2.5s
  pacific-andes.webm + pacific-andes.mp4  16:9   ~3.0s

Metraje real (no generado por IA), recortado y reexportado sin audio para
uso web: 960px de ancho, VP9/WebM como formato principal y H.264/MP4 como
fallback, ambos sin pista de audio.

El código que los consume vive en src/lib/cinema.js, enganchado en
src/lib/cinematic.js (despegue orbital, momento "Tierra") y
src/lib/worldmap.js (globo editorial, llegada a Santiago). Está cubierto
por tests/media.js.

Si un archivo faltara, el códec no se soportase o el visitante prefiera
menos movimiento, la escena sigue siendo 100% procedural — igual que antes
— y no queda ninguna referencia rota ni ninguna petición de red repetida.

Nunca crear aquí archivos vacíos o de relleno: un .webm de 0 bytes es peor
que la ausencia, porque el navegador sí lo descarga.
