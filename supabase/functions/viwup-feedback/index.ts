
/**
 * VIWUP | M00-C2-EF01
 * Edge Function: viwup-feedback
 *
 * ETAPA 1: Validación sin efectos externos.
 * No consulta PostgreSQL.
 * No envía solicitudes a Make.
 * No registra evaluaciones.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://viwup.cl",
  "https://www.viwup.cl",
]);

function response(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      "content-type, apikey, authorization, x-client-info";
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(value);
}

// VIWUP | EF-04.2
// SHA-256 en hexadecimal.
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Comparar credenciales sin terminar en la primera diferencia.
async function matchesTestToken(
  provided: string,
  expected: string,
): Promise<boolean> {
  if (expected.length < 32 || provided.length > 4096) {
    return false;
  }

  const [a, b] = await Promise.all([
    sha256Hex(provided),
    sha256Hex(expected),
  ]);

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}




Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");

  if (origin && !allowedOrigins.has(origin)) {
    return response(
      { error: "Origen no permitido" },
      403,
      origin,
    );
  }

  if (req.method === "OPTIONS") {
    return response({ status: "preflight_ok" }, 200, origin);
  }

  if (req.method !== "POST") {
    return response(
      { error: "Método no permitido" },
      405,
      origin,
    );
  }

  const contentLength = Number(
    req.headers.get("content-length") ?? "0",
  );

  if (contentLength > 8192) {
    return response(
      { error: "Solicitud demasiado grande" },
      413,
      origin,
    );
  }

  let payload: unknown;

  try {
    const raw = await req.text();

    if (new TextEncoder().encode(raw).length > 8192) {
      return response(
        { error: "Solicitud demasiado grande" },
        413,
        origin,
      );
    }

    payload = JSON.parse(raw);
  } catch {
    return response(
      { error: "JSON inválido" },
      400,
      origin,
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return response(
      { error: "Formato inválido" },
      400,
      origin,
    );
  }

  const data = payload as Record<string, unknown>;

  const valid =
    isUuid(data.idLocal) &&
    Number.isInteger(data.rating) &&
    typeof data.rating === "number" &&
    data.rating >= 1 &&
    data.rating <= 5 &&
    (data.tipo === "SOS" || data.tipo === "SEO") &&  
    (data.requestId === undefined ||
      isUuid(data.requestId)) &&
    (data.garzon === undefined ||
      (typeof data.garzon === "string" &&
        data.garzon.length <= 100)) &&
    (data.motivos === undefined ||
      (typeof data.motivos === "string" &&
        data.motivos.length <= 500)) &&
    (data.comentario === undefined ||
      (typeof data.comentario === "string" &&
        data.comentario.length <= 2000));

  if (!valid) {
    return response(
      { error: "Datos de evaluación inválidos" },
      422,
      origin,
    );
  }

  // Protección inicial: rechazar campos administrativos.
  
  // VIWUP | EF-03A
  // Lista explícita de campos permitidos.

  const allowedFields = new Set([
    "idLocal",
    "requestId",
    "rating",
    "tipo",
    "garzon",
    "motivos",
    "comentario",
  ]);

  const unexpectedFields = Object.keys(data)
    .filter((field) => !allowedFields.has(field));

  if (unexpectedFields.length > 0) {
    return response(
      { error: "Campos no permitidos" },
      422,
      origin,
    );
  }
  
  // ================================================
  // VIWUP | EF-02
  // Validación privada de restaurante
  // MODO DRY_RUN - SIN ENVÍOS NI ESCRITURAS
  // ================================================

  // 1. Leer configuración interna de Supabase.
  // Nunca imprimir ni devolver las credenciales.
  let supabaseUrl: string;
  let secretKey: string;

  try {
    supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    ) as Record<string, string>;

    secretKey = secretKeys["default"] ?? "";

    if (!supabaseUrl || !secretKey) {
      throw new Error("Configuración incompleta");
    }
  } catch {
    console.error("EF-02: configuración interna inválida");

    return response(
      { error: "Servicio temporalmente no disponible" },
      503,
      origin,
    );
  }

  // 2. Crear cliente exclusivo del servidor.
  // La Secret Key nunca llega al navegador.
  const supabaseAdmin = createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // 3. Consultar solamente los campos necesarios.
  const { data: local, error: localError } =
    await supabaseAdmin
      .from("locales")
      .select("id, estado_activo")
      .eq("id", data.idLocal as string)
      .maybeSingle();

  // 4. No revelar detalles internos de PostgreSQL.
  if (localError) {
    console.error(
      "EF-02: error consultando restaurante",
      localError.code,
    );

    return response(
      { error: "No se pudo validar el restaurante" },
      503,
      origin,
    );
  }

  // 5. Restaurante inexistente.
  if (!local) {
    return response(
      { error: "Restaurante no encontrado" },
      404,
      origin,
    );
  }

  // 6. Solo aceptar restaurantes activos.
  if (local.estado_activo !== true) {
    return response(
      { error: "Servicio del restaurante inactivo" },
      403,
      origin,
    );
  }
  
  // ================================================
  // VIWUP | EF-04.1
  // Monitoreo privado mediante RPC
  // SOLO LECTURA - DRY_RUN
  // ================================================

  const { data: feedbackVolume, error: volumeError } =
    await supabaseAdmin.rpc("viwup_feedback_volume", {
      p_local_id: data.idLocal as string,
    });

  if (volumeError) {
    // Solo registrar el código técnico, nunca secretos.
    console.error(
      "EF-04.1: error en RPC de monitoreo",
      volumeError.code,
    );

    return response(
      { error: "Servicio temporalmente no disponible" },
      503,
      origin,
    );
  }

  if (
    typeof feedbackVolume !== "number" ||
    !Number.isSafeInteger(feedbackVolume) ||
    feedbackVolume < 0
  ) {
    console.error(
      "EF-04.1: resultado de volumen inesperado",
    );

    return response(
      { error: "Servicio temporalmente no disponible" },
      503,
      origin,
    );
  }

  // Diagnóstico interno: no devolver el conteo al cliente.
  console.info(
    "EF-04.1: consulta de volumen correcta",
    { feedback_volume: feedbackVolume },
  );
  
  // ================================================
  // VIWUP | EF-04.2
  // Reserva idempotente para pruebas autorizadas.
  // Make sigue desactivado.
  // ================================================

  const providedTestToken =
    req.headers.get("x-viwup-test-token");

  // Sin credencial: mantener el dry_run existente.
  if (providedTestToken !== null) {
    const expectedTestToken =
      Deno.env.get("VIWUP_WRITE_TEST_TOKEN") ?? "";

    // Sin configuración privada, fallar de forma segura.
    if (expectedTestToken.length < 32) {
      console.error("EF-04.2: prueba no configurada");

      return response(
        { error: "Servicio temporalmente no disponible" },
        503,
        origin,
      );
    }

    const authorized = await matchesTestToken(
      providedTestToken,
      expectedTestToken,
    );

    if (!authorized) {
      return response(
        { error: "Prueba no autorizada" },
        403,
        origin,
      );
    }

    // El identificador es obligatorio solo para reservar.
    if (!isUuid(data.requestId)) {
      return response(
        { error: "requestId inválido o ausente" },
        422,
        origin,
      );
    }

    // Normalización: orden fijo, campos validados
    // y ausencia representada de forma consistente.
    const canonicalPayload = JSON.stringify([
      (data.idLocal as string).toLowerCase(),
      data.rating,
      data.tipo,
      data.garzon ?? null,
      data.motivos ?? null,
      data.comentario ?? null,
    ]);

    const payloadHash = await sha256Hex(canonicalPayload);

    const { data: reservation, error: reservationError } =
      await supabaseAdmin.rpc("viwup_reserve_feedback", {
        p_local_id: (data.idLocal as string).toLowerCase(),
        p_request_id: (data.requestId as string).toLowerCase(),
        p_payload_hash: payloadHash,
      });

    if (reservationError) {
      console.error(
        "EF-04.2: error de reserva RPC",
        reservationError.code,
      );

      return response(
        { error: "Servicio temporalmente no disponible" },
        503,
        origin,
      );
    }

    if (reservation === "reserved") {
      return response(
        {
          status: "reservation_only",
          reservation: "reserved",
          reservation_created: true,
          saved: false,
          forwarded: false,
        },
        201,
        origin,
      );
    }

    if (reservation === "duplicate") {
      return response(
        {
          status: "reservation_only",
          reservation: "duplicate",
          reservation_created: false,
          saved: false,
          forwarded: false,
        },
        200,
        origin,
      );
    }

    if (reservation === "conflict") {
      return response(
        {
          error: "Identificador reutilizado con otro contenido",
          reservation: "conflict",
          forwarded: false,
        },
        409,
        origin,
      );
    }

    if (reservation === "retry") {
      return response(
        {
          error: "Reserva temporalmente no disponible",
          reservation: "retry",
          forwarded: false,
        },
        503,
        origin,
      );
    }

    if (reservation === "inactive_or_missing") {
      return response(
        { error: "Restaurante no disponible" },
        403,
        origin,
      );
    }

    console.error(
      "EF-04.2: respuesta de reserva inesperada",
    );

    return response(
      { error: "Servicio temporalmente no disponible" },
      503,
      origin,
    );
  }
  
  // 7. Prueba exitosa, sin efectos externos.
  return response(
    {
      status: "dry_run",
      valid: true,
      local_verified: true,
      forwarded: false,
      saved: false,
      message: "Restaurante validado. Envío deshabilitado.",
    },
    200,
    origin,
  );
});
