# Base de datos (Supabase, proyecto `PorraGP2027`)

Todo vive en el esquema privado `porra`, que la API no expone. La app solo puede
llamar a funciones de `public`; cada una comprueba el identificador del móvil
(`p_token`) antes de leer o escribir. Las tablas tienen RLS activado y ninguna
política, así que no hay acceso directo.

Las migraciones aplicadas están en el historial del propio proyecto de Supabase:
`001_esquema_porra`, `002_funciones_acceso_y_voto`, `003_carga_temporada_2026`,
`004_sincronizacion_motogp`, `005_cierres_y_puntos_desde_endpoint`,
`006_fotos_pilotos_y_panel_admin`, `007_parrillas_y_resultados`.

## Tablas (`porra.*`)

| Tabla | Para qué |
|---|---|
| `config` | Temporada activa, código de la porra y contraseña de administrador (cifrados), secreto de sincronización |
| `players` | Jugadores |
| `riders` | Pilotos por temporada: nombre, dorsal, equipo, colores, `votable` |
| `events` | Grandes premios: ronda, zona horaria del circuito, `sprint_at` (cierre del voto), `race_at`, `close_override` |
| `sessions` | Sesiones de cada GP (MotoGP, Moto2, Moto3) con su clasificación y los PDF |
| `grids` | Parrilla oficial de cada GP y categoría (posición y tiempo de clasificación) |
| `rider_points` | Posición y puntos de cada piloto en Sprint y carrera |
| `votes` | Un voto por jugador y GP; `changes_used` cuenta el cambio permitido |
| `scores` | Puntos de cada jugador por GP (`calc`, `hoja` o `manual`) |
| `devices`, `device_players` | Móviles dados de alta y los jugadores guardados en cada uno |
| `vote_log` | Historial de votos y cambios, incluidos los del administrador |
| `attempts` | Intentos de código y contraseña, para limitar los fallidos |

## Funciones (`public.*`)

Acceso: `porra_status`, `setup_porra` (solo la primera vez), `join_device`,
`set_device_player`, `admin_login`, `admin_logout`.

Lectura: `get_bootstrap`, `get_event`, `get_session_result` (clasificación de una
sesión), `get_grid` (parrilla de un GP y categoría), `get_standings`.

Voto: `cast_vote(p_token, p_player, p_event, p_rider)`.

Administrador: `admin_set_vote`, `admin_set_points`, `admin_recalc`,
`admin_set_close`, `admin_save_player`, `admin_log`, `admin_change_secrets`,
`admin_status`, `admin_sync_now` (vuelve a pedir a MotoGP las sesiones de un GP),
`admin_auto_points` (descarta los puntos metidos a mano), `admin_set_finished`
y `admin_save_rider` (nombre corto y si se le puede votar).

## Reglas del voto (dentro de `cast_vote`)

1. Solo se vota el próximo GP con la votación abierta.
2. El voto se cierra a la hora de la Sprint (`sprint_at`, o `close_override` si el administrador la cambia). Manda el reloj del servidor.
3. Un solo cambio por GP. Repetir el mismo piloto no gasta el cambio.
4. Cada piloto, como máximo 3 veces por temporada. Cuenta el piloto con el que te quedas.
5. El jugador tiene que estar guardado en ese móvil.

Respuestas de error: `VOTO_CERRADO`, `PILOTO_AGOTADO`, `CAMBIO_AGOTADO`,
`AUN_NO_SE_VOTA_ESTE_GP`, `GP_SIN_HORARIO`, `JUGADOR_NO_EN_ESTE_MOVIL`,
`PILOTO_NO_VALIDO`, `JUGADOR_NO_VALIDO`, `GP_NO_VALIDO`.

## Sincronización con MotoGP

Cada 5 minutos, `pg_cron` llama a la función `sync-motogp`
(`supabase/functions/sync-motogp/index.ts`). La base de datos decide qué pedir
(`sync_plan`) y guarda lo que llega (`sync_ingest`):

1. Calendario: los GP de la temporada, con sus fechas.
2. Sesiones de MotoGP, Moto2 y Moto3, con hora y PDF. El endpoint da la hora local
   del circuito; se convierte con la zona horaria de cada GP (`events.time_zone`).
3. Clasificación de cada sesión terminada. Se vuelve a pedir a las 6 y a las 36 horas,
   por si hay sanciones.
4. De la Sprint y la carrera de MotoGP salen `rider_points`, y de ahí los puntos de
   cada jugador (`scores`, `source = 'calc'`).

5. Fotos de los pilotos: una vez al día se pide la lista de equipos de MotoGP y se
   guarda la foto de cada piloto (`riders.photo_url`). La app no carga la foto original
   (cuerpo entero, varios megas): la pide recortada y reducida a través de `wsrv.nl`.

6. Parrillas: 20 minutos después de cada Q2 se pide la parrilla oficial y se refresca
   cada media hora hasta la carrera, por si hay sanciones.

Los puntos metidos a mano por el administrador (`rider_points.manual`) no los pisa la
sincronización.

El cierre del voto es la hora de la Sprint. Si el endpoint aún da un horario fuera
de las fechas del GP, no se usa: el cierre queda provisional, el sábado a las 00:00
del circuito, hasta que publique el bueno.

## Datos de partida (temporada 2026)

- 13 jugadores, 22 pilotos y 22 grandes premios.
- 180 votos de las rondas 1 a 16, tomados de la hoja. El cuarto voto de Anita a
  Bezzecchi (ronda 12) figura como no votado.
- Los puntos ya no vienen de la hoja: se calculan con los resultados del endpoint.
  El valor de la hoja se conserva en `scores.sheet_total` solo como referencia.
- Indonesia (ronda 17) se vota todavía con el formulario; sus votos hay que
  traerlos una vez, después de la carrera.
