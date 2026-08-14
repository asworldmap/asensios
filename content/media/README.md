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
salir hacia los hosts de Drive. La política de red por defecto los deniega,
así que la copia puede tener que hacerla una persona. La ingesta automática
no se construye hasta que este flujo manual se haya probado un par de veces
más: primero la evidencia, después la automatización.
