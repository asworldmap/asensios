# Jugar a Pedal the World

Ejecuta estos comandos desde la raíz de la rama local `codex/pedal-world-directors-cut`.

```powershell
npm ci
npm run dev
```

Abre [http://localhost:5173/world/](http://localhost:5173/world/). **Historia** avanza de forma automática y dura unos 3–4 minutos. Puedes usar ↓ o desplazarte para avanzar a tu ritmo. El menú del mapa pausa el viaje. Con movimiento reducido, Historia se controla manualmente. Puedes saltar los planos de transición. La preferencia de movimiento reducido usa fundidos sin desplazamiento de cámara. En **Explorar**, usa WASD o las flechas y sigue los controles de cada vehículo. En móvil, usa el mando y los botones en pantalla. **Mapa** (M) permite elegir cualquier etapa y sus paradas.

El recorrido es Murcia → tren → autobús → barco en Japón → vuelo a Chile → mirador. Las rutas son escenarios estilizados y las fichas enlazan a la trayectoria real. En el avión, Espacio alterna vuelo libre una vez en el aire. El vuelo guiado desciende hasta la pista de llegada. En el barco, Espacio alterna entre timón y cubierta principal. Usa **Mapa → Sonido** para silenciar el ambiente y los efectos.

## Pruebas

`npm test` verifica los medios y el contrato de los 107 activos. Para probar el juego en Chrome instalado, ejecuta `npm run build` y deja `npm run preview` en marcha. En otra terminal PowerShell, instala Playwright y ejecuta la prueba.

```powershell
npm install --no-save --package-lock=false playwright
$env:PLAYWRIGHT_CHROMIUM_CHANNEL = 'chrome'
node tests/world/journey.mjs
node tests/world/handoffs.mjs
node tests/world/directors-cut.mjs
```

La prueba recorre los enlaces automáticos, comprueba el aterrizaje, el fundido sonoro y el silencio. Con el mismo servidor también se pueden ejecutar `assets.mjs`, `desktop.mjs` y `mobile-and-fallbacks.mjs` en `tests/world/`.

Los marcadores `ANCHOR_next` de los módulos centrados se exportan en la costura delantera. El motor usa esa distancia más la mitad del módulo siguiente, así que los tramos se unen sin editar los originales de Blender.
