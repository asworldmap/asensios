# content/media/004 — «La diplomacia también se come»

## Estado

Las fotografías **están en Drive y todavía no en el repositorio**. No se
pudieron traer desde la sesión que preparó el relato: la política de red del
entorno deniega `drive.google.com`, `docs.google.com`,
`drive.usercontent.google.com` y `lh3.googleusercontent.com`, y el conector
de Drive solo devuelve los binarios en base64, que no caben por esa vía.

El relato está escrito y se publica como texto. Los anclajes están puestos y
no imprimen nada mientras la imagen no exista, así que la página nunca sale
rota.

## Los cuatro originales

Carpeta: `Relatos desde Santiago/#004`
<https://drive.google.com/drive/folders/1cz9HhUnv93mFJWPbDTGjVAg1ZOSoc9i0>

| Original | Tomada | Peso | Ranura prevista |
|---|---|---|---|
| `Portada_relatos_Santiago` | — | 2,2 MB | `cover` → `portada.jpg` |
| `20260811_190047.jpg` | 11 ago, 19:00 | 3,1 MB | por decidir |
| `20260811_192307.jpg` | 11 ago, 19:23 | 3,1 MB | por decidir |
| `20260811_202333.jpg` | 11 ago, 20:23 | 1,9 MB | por decidir |

El nombre de la primera es una decisión editorial ya tomada por el autor, así
que va de portada. Las otras tres están en orden cronológico de la propia
velada, pero **cuál es la sala, cuál el plato y cuál el cierre no se ha
podido comprobar mirándolas**, y no se asigna a ciegas.

## Las tres ranuras del cuerpo

| Anclaje | Momento del relato | Ancho | Qué pide |
|---|---|---|---|
| `[[sala]]` | Tras «Fui solo…», antes de los discursos | `wide` | La noche mientras ocurre: la sala, la gente, la luz. |
| `[[plato]]` | Justo después de la descripción del conejo | `full` | **El plato.** Es el clímax visual: rompe la columna de texto y va a sangre. Solo merece ese tamaño si la foto aguanta el detalle. |
| `[[final]]` | Antes de las dos últimas líneas | `inset` | El después: el plato terminado, la mesa vaciándose. Pequeña y callada. |

Si una de las tres no aporta o repite a otra, **es mejor dejarla fuera**. Tres
imágenes buenas valen más que cuatro forzadas; el anclaje sin foto no imprime
nada.

## Para terminarlo

1. Copiar los archivos aquí como `portada.jpg`, `sala.jpg`, `plato.jpg` y
   `final.jpg`, según lo que muestre cada uno.
2. En `content/relatos/004-la-diplomacia-tambien-se-come.md`, descomentar el
   bloque `cover:` / `media:` y **escribir los `alt`** (una frase por imagen,
   describiendo lo que se ve).
3. `git push`. El resto es automático.

## Notas técnicas

- JPEG, WebP, AVIF, PNG y GIF valen. Si dejas `plato.avif` o `plato.webp`
  junto al `.jpg`, el generador emite un `<picture>` y sirve el formato
  ligero a quien pueda leerlo. No es requisito para publicar.
- Las dimensiones se leen de la propia imagen, así que la página no da saltos
  mientras carga. No hace falta declararlas.
- El lado largo de `plato` conviene que ronde los 2400 px; el resto, 1800 px
  basta. Los originales de 3 MB pueden ir tal cual si no hay a mano una
  reducción sencilla.
- Si una imagen declarada no existe, **la compilación falla a propósito** en
  lugar de publicar una foto rota.
- Este README no se publica: el generador no copia `README.md` al sitio.
