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

## Pendiente: fotografías de #001, #002 y #003

Están en Drive y no en el repositorio. La sesión que hizo esta pasada
visual pudo enumerarlas (nombres, tamaños y fechas están anotados en el
README de cada carpeta) pero no descargarlas: la política de red del entorno
deniega `drive.google.com`, `drive.usercontent.google.com` y
`lh3.googleusercontent.com`, y el conector solo devuelve los binarios en
base64, que a 2–4 MB por archivo no cabe por esa vía.

La ruta que ya funcionó con #004: exportar las fotos elegidas desde otra
máquina en un `.zip` junto a una nota editorial breve y entregarlo a la
sesión. Mientras tanto, los tres relatos se publican como piezas de texto con
su cita destacada, no como galerías vacías.
