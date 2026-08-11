public/cinematic/ — vacía a propósito
======================================

Aquí van los dos únicos vídeos del sitio. No están: son generación
Higgsfield pendiente, deliberadamente pospuesta hasta después de este porte.
No se ha falsificado su salida ni sustituido por otro generador.

  earth-limb.webm    + earth-limb.mp4     16:9   objetivo < 900 KB
  pacific-andes.webm + pacific-andes.mp4   1:1   objetivo < 600 KB

El código que los consume ya vive en src/lib/cinema.js, enganchado en
src/lib/cinematic.js (despegue) y src/lib/worldmap.js (globo, Santiago), y
está cubierto por tests/media.js. No hace falta tocar ni una línea para
activarlos: basta con copiar los archivos aquí con esos nombres.

Si un archivo no está, el códec no se soporta o el visitante prefiere menos
movimiento, la escena sigue siendo 100% procedural — igual que hoy — y no
queda ninguna referencia rota ni ninguna petición de red repetida.

Nunca crear aquí archivos vacíos o de relleno: un .webm de 0 bytes es peor
que la ausencia, porque el navegador sí lo descarga.
