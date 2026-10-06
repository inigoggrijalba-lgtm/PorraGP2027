# PorraGP

App de la porra de MotoGP: voto por Gran Premio, clasificación, horarios y calendario.

- Web instalable (PWA) publicada con GitHub Pages: https://inigoggrijalba-lgtm.github.io/PorraGP2027/
- Datos y reglas del juego en Supabase (ver `docs/BASE_DE_DATOS.md`).
- Resultados y horarios cargados automáticamente del endpoint de MotoGP.

## Cómo está montada

| Carpeta | Qué hay |
|---|---|
| `src/` | La app (React). `screens/` tiene una pantalla por archivo; `store.js` guarda el estado y habla con la base de datos |
| `public/` | Icono, manifiesto y el guardado sin conexión (`sw.js`) |
| `scripts/build.mjs` | Compila todo en `dist/` |
| `supabase/functions/` | La función que sincroniza con MotoGP |
| `.github/workflows/deploy.yml` | Publica en GitHub Pages cada vez que cambia `main` |

## Compilar

```
npm install
npm run build
```

El resultado queda en `dist/`.

## Qué funciona ya

Primera configuración, entrada con el código de la porra, jugadores de cada móvil, inicio con cuenta atrás
y horario, votar y cambiar el voto, clasificación, votos y puntos por GP, calendario, horario completo,
reglas, instalación, fotos de los pilotos y panel de administrador.

Pendiente: estadísticas, resultados de MotoGP con PDF oficiales, imágenes para compartir, histórico,
noticias y avisos.
