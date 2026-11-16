# Jugar a Pedal the World

Ejecuta estos comandos desde la raíz de la rama local `codex/pedal-world-web-integration`.

```powershell
npm ci
npm run dev
```

Abre [http://localhost:5173/world/](http://localhost:5173/world/). En **Historia**, desplázate por la escena o usa el botón ↓ para avanzar y **Continuar** al llegar. En **Explorar**, usa WASD o las flechas y sigue los controles de cada vehículo. En móvil, usa el mando y los botones en pantalla. **Mapa** (M) permite elegir cualquier etapa y sus paradas.

Las rutas son escenarios estilizados. Las fichas enlazan a las secciones correspondientes de la trayectoria. En el avión, Espacio alterna vuelo libre una vez en el aire. En el barco, Espacio alterna entre timón y cubierta principal.

## Pruebas

`npm test` verifica los medios y el contrato de los 44 activos. Para probar el juego en Chrome instalado, ejecuta `npm run build` y deja `npm run preview` en marcha. En otra terminal PowerShell, instala Playwright y ejecuta la prueba.

```powershell
npm install --no-save --package-lock=false playwright
$env:PLAYWRIGHT_CHROMIUM_CHANNEL = 'chrome'
node tests/world/journey.mjs
```

Con el mismo servidor también se pueden ejecutar `assets.mjs`, `desktop.mjs` y `mobile-and-fallbacks.mjs` en `tests/world/`.

Los marcadores `ANCHOR_next` de los módulos centrados se exportan en la costura delantera. El motor usa esa distancia más la mitad del módulo siguiente, así que los tramos se unen sin editar los originales de Blender.
