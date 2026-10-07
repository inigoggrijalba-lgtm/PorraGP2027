# PorraGP

App de la porra de MotoGP: voto por Gran Premio, clasificación, horarios y calendario.

- Web instalable (PWA) publicada con Vercel: https://porragp27.vercel.app/ (cada cambio en `main` se publica solo). La dirección antigua de GitHub Pages solo redirige a esta: comparte dirección con la app de 2026 y Chrome en Android no dejaba instalar las dos.
- Datos y reglas del juego en Supabase (ver `docs/BASE_DE_DATOS.md`).
- Resultados y horarios cargados automáticamente del endpoint de MotoGP.

## Cómo está montada

| Carpeta | Qué hay |
|---|---|
| `src/` | La app (React). `screens/` tiene una pantalla por archivo; `store.js` guarda el estado y habla con la base de datos; `share.js` pinta las imágenes para compartir |
| `public/` | Icono, manifiesto y el guardado sin conexión (`sw.js`) |
| `scripts/build.mjs` | Compila todo en `dist/` |
| `supabase/functions/` | `sync-motogp` sincroniza con MotoGP; `send-push` envía los avisos al móvil; `sync-news` lee las noticias |
| `vercel.json` | Cómo compila y sirve Vercel la app |
| `public/fonts/` | Tipografías de la app, servidas desde aquí: Saira Stencil en titulares y Saira en el resto (libres, licencia SIL OFL) |
| `redirect/` y `.github/workflows/deploy.yml` | Página que GitHub Pages publica en la dirección antigua para llevar a la nueva |

## Compilar

```
npm install
npm run build
```

El resultado queda en `dist/`.

## Qué funciona ya

Primera configuración, entrada con el código de la porra, jugadores de cada móvil, inicio con cuenta atrás
y horario, votar y cambiar el voto, clasificación, votos y puntos por GP, calendario, horario completo,
reglas, instalación, fotos de los pilotos, panel de administrador, resultados de todas las sesiones
(MotoGP, Moto2 y Moto3) con sus PDF oficiales, parrilla e imágenes para compartir (clasificación,
parrilla y horario), pilotos de las tres categorías con su ficha, avisos al móvil, estadísticas de la
porra (evolución, puntos por GP y pilotos más votados), histórico de resultados desde 1949 y noticias
de cinco medios (Motorsport.com, Motosan, Crash.net, GPOne y The Race) con los titulares traducidos.
