# content/media/004 — «La diplomacia también se come»

## Estado: publicadas

Tres fotografías reales, entregadas por el autor. Inspeccionadas una a una
antes de asignarlas — no por nombre de archivo.

| Archivo | Rol | Anclaje | Notas |
|---|---|---|---|
| `portada-servicio.jpg` | Portada | `cover` | Dos camareros emplatando en la terraza de la residencia, de noche. Resume la crónica sin mostrar el plato todavía. |
| `sala.jpg` | Ambiente | `[[sala]]` | La mesa de servicio junto a una ventana, con el jardín y la piscina iluminados al fondo. |
| `plato.jpg` | Clímax gastronómico | `[[plato]]` | El plato de la noche, a máxima anchura (`size: full`). |

## Lo que se dejó fuera

`autor-contexto.jpg` (selfie del autor con banderas de la UE) **no se ha
usado**. Las banderas son de la Unión Europea, no de Argentina ni de Chile,
y la foto no se tomó en la residencia del relato — usarla habría sugerido
al lector que pertenece a esa noche cuando no es así. Sigue disponible por
si sirve para otro relato con ese contexto real (una crónica sobre Erasmus+
o instituciones europeas, por ejemplo), pero no aquí.

`Portada_relatos_Santiago.jpg`, del envío original a Drive, tampoco se ha
usado — así se pidió explícitamente.

## Sobre `plato.jpg`

Es un objeto oscuro, calado, con un dibujo de flores caladas, sostenido en
la mano sobre el suelo de ajedrez. No se ven con certeza el conejo, el
pistacho ni el queso crema por separado: la lectura más plausible es que la
lámina negra calada **es** la "lámina de patata negra" del texto, con el
ragú asomando en tono cobrizo por los huecos — pero es una lectura, no una
certeza visual. Por eso el `alt` y no lleva `caption`: describe lo que se
ve (un plato calado, servido esa noche) sin afirmar ingredientes que la
fotografía, por sí sola, no confirma. El texto ya lleva el peso descriptivo
del plato; la imagen no necesita repetirlo.

## Orientación EXIF

`portada-servicio.jpg` y `sala.jpg` se grabaron en vertical pero el sensor
las guardó con dimensiones de fichero en horizontal + una etiqueta EXIF
`Orientation: 6` (rotar 90° para verlas bien). El generador ya lo tiene en
cuenta — `tools/blog/build.mjs`, función `imageSize()` — así que el
`width`/`height` que se escribe en el HTML coincide con lo que el
navegador pinta de verdad, y no hay salto de maquetación al cargar.

## Para el próximo relato

Ver `content/media/README.md` para el flujo Drive → editorial → Git.
