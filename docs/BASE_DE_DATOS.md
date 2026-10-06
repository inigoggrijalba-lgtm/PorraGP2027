# Base de datos (Supabase, proyecto `PorraGP2027`)

Todo vive en el esquema privado `porra`, que la API no expone. La app solo puede
llamar a funciones de `public`; cada una comprueba el identificador del móvil
(`p_token`) antes de leer o escribir. Las tablas tienen RLS activado y ninguna
política, así que no hay acceso directo.

Las migraciones aplicadas están en el historial del propio proyecto de Supabase:
`001_esquema_porra`, `002_funciones_acceso_y_voto`, `003_carga_temporada_2026`.

## Tablas (`porra.*`)

| Tabla | Para qué |
|---|---|
| `config` | Temporada activa, código de la porra y contraseña de administrador (cifrados), secreto de sincronización |
| `players` | Jugadores |
| `riders` | Pilotos por temporada: nombre, dorsal, equipo, colores, `votable` |
| `events` | Grandes premios: ronda, zona horaria del circuito, `sprint_at` (cierre del voto), `race_at`, `close_override` |
| `sessions` | Sesiones de cada GP (MotoGP, Moto2, Moto3) con su clasificación y los PDF |
| `rider_points` | Posición y puntos de cada piloto en Sprint y carrera |
| `votes` | Un voto por jugador y GP; `changes_used` cuenta el cambio permitido |
| `scores` | Puntos de cada jugador por GP (`calc`, `hoja` o `manual`) |
| `devices`, `device_players` | Móviles dados de alta y los jugadores guardados en cada uno |
| `vote_log` | Historial de votos y cambios, incluidos los del administrador |
| `attempts` | Intentos de código y contraseña, para limitar los fallidos |

## Funciones (`public.*`)

Acceso: `porra_status`, `setup_porra` (solo la primera vez), `join_device`,
`set_device_player`, `admin_login`, `admin_logout`.

Lectura: `get_bootstrap`, `get_event`, `get_session_result`, `get_standings`.

Voto: `cast_vote(p_token, p_player, p_event, p_rider)`.

Administrador: `admin_set_vote`, `admin_set_points`, `admin_recalc`,
`admin_set_close`, `admin_save_player`, `admin_log`, `admin_change_secrets`.

## Reglas del voto (dentro de `cast_vote`)

1. Solo se vota el próximo GP con la votación abierta.
2. El voto se cierra a la hora de la Sprint (`sprint_at`, o `close_override` si el administrador la cambia). Manda el reloj del servidor.
3. Un solo cambio por GP. Repetir el mismo piloto no gasta el cambio.
4. Cada piloto, como máximo 3 veces por temporada. Cuenta el piloto con el que te quedas.
5. El jugador tiene que estar guardado en ese móvil.

Respuestas de error: `VOTO_CERRADO`, `PILOTO_AGOTADO`, `CAMBIO_AGOTADO`,
`AUN_NO_SE_VOTA_ESTE_GP`, `GP_SIN_HORARIO`, `JUGADOR_NO_EN_ESTE_MOVIL`,
`PILOTO_NO_VALIDO`, `JUGADOR_NO_VALIDO`, `GP_NO_VALIDO`.

## Datos cargados de la hoja de 2026

- 13 jugadores, 22 pilotos y 22 grandes premios.
- 180 votos de las rondas 1 a 16. El cuarto voto de Anita a Bezzecchi (ronda 12) figura como no votado.
- Puntos por GP tal como están en la hoja (`source = 'hoja'`).
- Indonesia (ronda 17) se juega todavía con el formulario; sus votos y puntos se cargarán después de la carrera.
