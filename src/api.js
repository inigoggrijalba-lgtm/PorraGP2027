import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

export class ApiError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Llama a una función de la base de datos. Si falla, lanza ApiError con el código del fallo.
export async function rpc(name, args = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError('SIN_CONEXION');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new ApiError((data && data.message) || `HTTP_${res.status}`);
  return data;
}

// Llama a una función del servidor (Supabase Edge Functions). Mismo manejo de errores que rpc().
export async function fn(name, body = {}, ms = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError('SIN_CONEXION');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && data.error) || `HTTP_${res.status}`);
  return data;
}

const MESSAGES = {
  SIN_CONEXION: 'No hay conexión. Comprueba la cobertura y vuelve a intentarlo.',
  CODIGO_INCORRECTO: 'Ese no es el código de la porra.',
  DEMASIADOS_INTENTOS: 'Demasiados intentos. Espera unos minutos y prueba otra vez.',
  SIN_CONFIGURAR: 'La porra todavía no está configurada.',
  YA_CONFIGURADA: 'La porra ya está configurada. Entra con el código.',
  CODIGO_CORTO: 'El código necesita al menos 4 caracteres.',
  CONTRASENA_CORTA: 'La contraseña necesita al menos 6 caracteres.',
  VOTO_CERRADO: 'La votación de este Gran Premio ya está cerrada.',
  PILOTO_AGOTADO: 'Ya has votado 3 veces a este piloto esta temporada.',
  CAMBIO_AGOTADO: 'Ya has usado tu cambio en este Gran Premio.',
  AUN_NO_SE_VOTA_ESTE_GP: 'Todavía no se puede votar este Gran Premio.',
  GP_SIN_HORARIO: 'Este Gran Premio aún no tiene horario.',
  JUGADOR_NO_EN_ESTE_MOVIL: 'Ese jugador no está guardado en este móvil.',
  JUGADOR_NO_VALIDO: 'Ese jugador no está disponible.',
  PILOTO_NO_VALIDO: 'Ese piloto no se puede votar.',
  GP_NO_VALIDO: 'Ese Gran Premio no existe.',
  CONTRASENA_INCORRECTA: 'Contraseña incorrecta.',
  NO_ADMIN: 'La sesión de administrador ha caducado. Vuelve a entrar.',
  NOMBRE_VACIO: 'Escribe un nombre.',
  AVISOS_NO_COMPATIBLES: 'Este navegador no permite recibir avisos de la porra.',
  AVISOS_SIN_ACTIVAR: 'Los avisos no están activados en este móvil.',
  AVISOS_DENEGADOS: 'Has bloqueado los avisos de la porra. Actívalos en los ajustes del navegador y vuelve a intentarlo.',
  AVISOS_NO_LISTOS: 'Los avisos aún no están listos. Prueba otra vez en un minuto.',
  NOMBRE_REPETIDO: 'Ya hay un jugador con ese nombre.',
};

export function messageFor(code) {
  return MESSAGES[code] || 'Algo ha fallado. Vuelve a intentarlo.';
}
