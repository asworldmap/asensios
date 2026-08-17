Photographs and video referenced from frontmatter as /media/...
Keep one folder per story, e.g. media/004/.

# Drive es la bandeja de entrada, no el origen

El sitio publicado **nunca** depende de Google Drive. En producción cada
imagen se sirve desde `/media/...`, es decir desde este repositorio. Drive es
donde el material entra; Git es donde queda archivado.

```
Google Drive  →  selección editorial  →  content/media + Markdown  →  Git  →  build  →  producción
```

Si una foto solo existe en Drive, no existe para el sitio.

## Cómo subir material para el próximo relato

1. En Drive, dentro de `Relatos desde Santiago`, crea una carpeta con el
   número del relato: `#005`.
2. Suelta ahí lo que tengas: fotos, vídeos, notas de voz, un documento con
   apuntes. Tal cual salen de la cámara — **no hace falta renombrar nada ni
   escribir YAML en Drive**.
3. Comparte la carpeta directamente con la cuenta conectada (no basta con
   «cualquiera con el enlace»: eso no da acceso de API).
4. Di qué relato es y qué recuerdas de esa noche.
5. La selección, los nombres, los recortes, los `alt` y el orden se deciden
   en la fase editorial y se escriben aquí, en el repositorio.

## Convención de carpetas

```
Relatos desde Santiago/
├── #001/
├── #002/
├── #003/
├── #004/
└── #005/
```

## Nota sobre el entorno

Traer los binarios desde Drive requiere que el entorno de ejecución permita
salir hacia los hosts de Drive (`drive.google.com` y similares). La política
de red de este entorno los deniega, así que la sesión no puede descargarlos
por sí sola aunque la carpeta esté bien compartida.

Con el relato #004 se probó la salida práctica: exportar las fotos elegidas
desde otra máquina en un `.zip` con una nota editorial (`EDITORIAL-NOTES.txt`
— qué es cada foto y qué papel se propone para ella) y entregarlo directamente
a la sesión. Funcionó bien y es repetible para #005. La ingesta automática
sigue sin construirse: primero la evidencia, después la automatización.

## Importación de fotografías

Las de #001–#004 ya están en el repositorio. Al importarlas se aplica la
rotación EXIF de verdad (y se elimina la etiqueta, para que nadie tenga que
interpretarla después) y se limita el lado largo a 2400 px con calidad 82.
Los originales de cámara pesaban 33 MB en total; publicados pesan 6,7 MB.

Ese paso se hace una vez, al importar, y el resultado se versiona. El
generador sigue sin depender de ninguna librería de imagen.

## Copias responsive (`-640`, `-1000`)

Junto a cada fotografía se guardan dos versiones estrechas con el mismo
nombre y un sufijo de anchura:

```
content/media/002/bicicleta.jpg        ← original (el máster, no se toca)
content/media/002/bicicleta-640.jpg
content/media/002/bicicleta-1000.jpg
```

El generador las detecta solo: si existen, emite `srcset` y `sizes`; si no
existen, publica el original y no pasa nada. No hay que declararlas en el
frontmatter.

Sin esto un teléfono descargaba el fotograma completo de 1351 px para una
columna de 390 px: unos 2,4 MB por página. Con las copias, un escritorio baja
905 kB en vez de 2,5 MB.

Para regenerarlas después de añadir fotos nuevas (Pillow es una herramienta
de importación, **no** una dependencia del build):

```bash
python3 - <<'PY'
from PIL import Image, ImageOps
from pathlib import Path
for src in sorted(Path('content/media').glob('*/*.jpg')):
    if any(src.stem.endswith(f'-{w}') for w in (640, 1000)):
        continue
    im = ImageOps.exif_transpose(Image.open(src))
    for w in (640, 1000):
        if im.width <= w:
            continue
        out = src.with_name(f'{src.stem}-{w}.jpg')
        if out.exists():
            continue
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).convert('RGB')
        r.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
        print(out)
PY
```

`exif_transpose` importa: los originales vienen del teléfono con la
orientación en los metadatos, y al reescalar hay que fijarla en los píxeles.
