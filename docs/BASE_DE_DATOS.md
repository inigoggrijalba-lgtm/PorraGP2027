# Base de datos (Supabase, proyecto `PorraGP2027`)

Todo vive en el esquema privado `porra`, que la API no expone. La app solo puede
llamar a funciones de `public`; cada una comprueba el identificador del móvil
(`p_token`) antes de leer o escribir. Las tablas tienen RLS activado y ninguna
política, así que no hay acceso directo.

Las migraciones aplicadas están en el historial del propio proyecto de Supabase:
`001_esquema_porra`, `002_funciones_acceso_y_voto`, `003_carga_temporada_2026`,
`004_sincronizacion_motogp`, `005_cierres_y_puntos_desde_endpoint`,
`006_fotos_pilotos_y_panel_admin`, `007_parrillas_y_resultados`, `008_pilotos_y_avisos`,
`009_historico`, `010_historico_adelanta_carrera`, `011_noticias` a `015_noticias_…`.

## Tablas (`porra.*`)

| Tabla | Para qué |
|---|---|
| `config` | Temporada activa, código de la porra y contraseña de administrador (cifrados), secreto de sincronización |
| `players` | Jugadores |
| `riders` | Pilotos por temporada: nombre, dorsal, equipo, colores, `votable` |
| `events` | Grandes premios: ronda, zona horaria del circuito, `sprint_at` (cierre del voto), `race_at`, `close_override` |
| `sessions` | Sesiones de cada GP (MotoGP, Moto2, Moto3) con su clasificación y los PDF |
| `grids` | Parrilla oficial de cada GP y categoría (posición y tiempo de clasificación) |
| `gp_riders` | Pilotos de MotoGP, Moto2 y Moto3: equipo, dorsal, foto, puesto en el Mundial y palmarés |
| `push_subs`, `push_queue` | Móviles con los avisos activados y avisos pendientes o enviados |
| `rider_points` | Posición y puntos de cada piloto en Sprint y carrera |
| `votes` | Un voto por jugador y GP; `changes_used` cuenta el cambio permitido |
| `scores` | Puntos de cada jugador por GP (`calc`, `hoja` o `manual`) |
| `devices`, `device_players` | Móviles dados de alta y los jugadores guardados en cada uno |
| `vote_log` | Historial de votos y cambios, incluidos los del administrador |
| `attempts` | Intentos de código y contraseña, para limitar los fallidos |
| `api_cache` | Lo ya consultado del histórico de MotoGP (temporadas, grandes premios, sesiones y clasificaciones) |
| `news` | Titulares de los medios: titular, entradilla corta, imagen, enlace y su traducción |

## Funciones (`public.*`)

Acceso: `porra_status`, `setup_porra` (solo la primera vez), `join_device`,
`set_device_player`, `admin_login`, `admin_logout`.

Lectura: `get_bootstrap`, `get_event`, `get_session_result` (clasificación de una
sesión), `get_grid` (parrilla de un GP y categoría), `get_standings`, `get_gp_riders` y
`get_gp_rider` (pilotos y ficha), `history` (histórico de resultados), `get_news` (noticias).

Avisos: `push_public_key`, `push_subscribe`, `push_state`, `push_unsubscribe`, `push_test`.

Voto: `cast_vote(p_token, p_player, p_event, p_rider)`.

Administrador: `admin_set_vote`, `admin_set_points`, `admin_recalc`,
`admin_set_close`, `admin_save_player`, `admin_log`, `admin_change_secrets`,
`admin_status`, `admin_sync_now` (vuelve a pedir a MotoGP las sesiones de un GP),
`admin_auto_points` (descarta los puntos metidos a mano), `admin_set_finished`
y `admin_save_rider` (nombre corto y si se le puede votar).

## Reglas del voto (dentro de `cast_vote`)

1. Solo se vota el próximo GP con la votación abierta. Se abre el lunes a las 00:00 (hora peninsular) siguiente a la carrera del GP anterior (`porra.open_at`); el primero de la temporada está abierto desde el principio. Así no se solapa con el fin de semana en curso.
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

7. Pilotos y Mundial: una vez al día y después de cada carrera se guardan los pilotos de
   las tres categorías y la clasificación del Mundial. El palmarés de cada piloto se
   pide poco a poco (12 por pasada) y se refresca tras cada carrera.

## Avisos al móvil

Cada 5 minutos `pg_cron` llama a la función `send-push`
(`supabase/functions/send-push/`). La base de datos decide qué avisos tocan
(`push_plan`) y la función los cifra y los manda al servicio de avisos de cada móvil.

| Aviso | Cuándo | A quién |
|---|---|---|
| Recordatorio de voto | 24 h antes del cierre | Móviles donde falta alguien por votar |
| Último aviso | 2 h antes del cierre | Móviles donde sigue faltando alguien |
| Puntos del GP | Al llegar el resultado de la carrera | Todos |
| Resultado de cada sesión | Al llegar cada clasificación de MotoGP | Quien lo active |
| Horario listo | Martes de la semana de carrera, 10:00 | Administrador |

De noche (22:00 a 09:00, hora peninsular) no se manda nada: el recordatorio pasa a las
09:00 y el último aviso a las 21:30 de la víspera (`porra.remind_at`). Las claves del
servidor se crean solas la primera vez y se guardan en `config`.

Los puntos metidos a mano por el administrador (`rider_points.manual`) no los pisa la
sincronización.

El cierre del voto es la hora de la Sprint. Si el endpoint aún da un horario fuera
de las fechas del GP, no se usa: el cierre queda provisional, el sábado a las 00:00
del circuito, hasta que publique el bueno.

## Histórico de resultados

`history(p_token, p_season, p_event, p_category, p_session)` baja un escalón por cada
dato que se le pasa: sin nada devuelve las temporadas (desde 1949); con la temporada, sus
grandes premios y categorías; con GP y categoría, las sesiones; con la sesión, la
clasificación.

Los datos no se copian de antemano: la primera vez que alguien pide algo, la base de
datos lanza la petición a MotoGP en segundo plano (`pg_net`) y contesta
`{"state":"pending"}`; la app vuelve a preguntar cada medio segundo hasta recibir
`{"state":"hit", ...}`. Lo recibido se guarda recortado en `porra.api_cache` y la
siguiente consulta sale al momento. Las temporadas pasadas se guardan 180 días; la
temporada en curso, entre 10 minutos y 1 hora, y mientras se refresca se sigue
enseñando lo anterior. Solo se aceptan identificadores que MotoGP haya dado antes
(la temporada tiene que estar en la lista de temporadas, el GP en la de esa temporada…),
así que la caché no puede llenarse con peticiones inventadas. Al pedir las sesiones de
un GP se adelanta ya la petición de la clasificación de la carrera, que es la que la app
enseña primero.

## Noticias

Cada 20 minutos `pg_cron` llama a la función `sync-news` (`supabase/functions/sync-news/`),
que lee el RSS de cada medio:

| Medio | Idioma | Se queda con |
|---|---|---|
| Motorsport.com (edición española) | castellano | todo (el RSS ya es de MotoGP) |
| Motosan | castellano | lo de MotoGP, Moto2 y Moto3 |
| Crash.net | inglés | lo de MotoGP, Moto2 y Moto3 (el RSS mezcla Superbikes) |
| GPOne | inglés | lo de MotoGP, Moto2 y Moto3 |
| The Race | inglés | todo (el RSS ya es de MotoGP) |
| Motociclismo | castellano | categoría MotoGP (su RSS es general, de 15 noticias) |

De cada noticia se guarda solo el titular, una entradilla de unas 200 letras, la imagen y
el enlace; el texto se lee en la web del medio. Si el RSS no trae imagen (Motosan, GPOne),
se toma la portada que declara la propia noticia (`og:image`).

Los titulares en inglés se traducen con un servicio gratuito (MyMemory; antes se intenta
el de Google, que hoy rechaza las peticiones desde servidores). MyMemory da más cupo
diario si se le indica un correo de contacto: está en `config.news_contact`, no en el
código. Aun así el cupo es limitado, así que primero van los titulares y después, si queda, la entradilla de la
noticia más reciente de cada medio. Lo que no se llega a traducir se guarda en inglés y se
reintenta en las siguientes pasadas (`news_plan` dice qué falta). El resultado de la
última pasada queda en `config.news_status`.

La app pide `get_news`: hasta 30 noticias por medio de las tres últimas semanas. Las
fotos se enseñan recortadas a través de `images.weserv.nl`, y las noticias en inglés
pueden abrirse traducidas con el traductor web de Google (interruptor en la pantalla,
apagado de fábrica porque algunas redes de empresa bloquean ese traductor).

### Modo lectura

Al tocar una noticia, la app llama a la función `read-article` (`supabase/functions/read-article/`)
con el token del móvil y el `id` de la noticia. La función pide la dirección a `news_item`
(que comprueba el móvil y solo acepta noticias de `porra.news`, así que no sirve para descargar
otras páginas), descarga la página, se queda con el texto, los ladillos y las fotos (Readability)
y lo devuelve como bloques `{t: p|h|q|li|img}`. **No se guarda en la base de datos**: solo se
recuerda unos minutos en memoria. Si no se puede extraer (`ok: false`), la app ofrece abrirla en
la web del medio.

## Datos de partida (temporada 2026)

- 13 jugadores, 22 pilotos y 22 grandes premios.
- 180 votos de las rondas 1 a 16, tomados de la hoja. El cuarto voto de Anita a
  Bezzecchi (ronda 12) figura como no votado.
- Los puntos ya no vienen de la hoja: se calculan con los resultados del endpoint.
  El valor de la hoja se conserva en `scores.sheet_total` solo como referencia.
- Indonesia (ronda 17) se vota todavía con el formulario; sus votos hay que
  traerlos una vez, después de la carrera.
