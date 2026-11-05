
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

//
// VIWUP | EF-05.7A
// Observacion preparada, escrituras desactivadas.
//
const OBSERVATION_WRITES_ENABLED = false;

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

//
// VIWUP | EF-05.7C.1
// Canonicalizacion compartida con EF-04.2.
// Mantener este orden para preservar idempotencia.
//
async function feedbackPayloadHash(
  data: Record<string, unknown>,
): Promise<string> {
  const canonicalPayload = JSON.stringify([
    (data.idLocal as string).toLowerCase(),
    data.rating,
    data.tipo,
    data.garzon ?? null,
    data.motivos ?? null,
    data.comentario ?? null,
  ]);

  return await sha256Hex(canonicalPayload);
}

// VIWUP | EF-05.7A
// HMAC-SHA256 para futuras senales seudonimizadas.
// No se invoca en esta etapa.
async function hmacSha256Hex(
  secret: string,
  scope: "device" | "ip",
  localId: string,
  identifier: string,
): Promise<string> {
  if (new TextEncoder().encode(secret).length < 32) {
    throw new Error("Configuracion HMAC invalida");
  }

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const message = [
    "viwup-rate-v1",
    scope,
    localId.toLowerCase(),
    identifier.toLowerCase(),
  ].join(":");

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return Array.from(new Uint8Array(signature))
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
    
    // EF-04.5: acción opcional de prueba.
    // Solo se procesa tras validar el token privado.
    const testAction =
      req.headers.get("x-viwup-test-action");
    
    if (
      testAction !== null &&
      testAction !== "simulate-review" &&
      testAction !== "observe-only"
    ) {

      return response(
        { error: "Acción de prueba no permitida" },
        422,
        origin,
      );
    }
    
    // ================================================
    // VIWUP | EF-05.7A
    // Preparacion de observacion privada.
    // SIN RPC, SIN RESERVAS, SIN MAKE.
    // ================================================
    
    if (testAction === "observe-only") {
      const deviceId = req.headers.get(
        "x-viwup-test-device-id",
      );
    
      // La observacion requiere una señal de dispositivo
      // valida. No se registra ni almacena todavia.
      if (!isUuid(deviceId)) {
        return response(
          {
            error: "Identificador de dispositivo invalido",
            forwarded: false,
          },
          422,
          origin,
        );
      }
    
      if (!OBSERVATION_WRITES_ENABLED) {
        return response(
          {
            status: "observation_prepared",
            observation_enabled: false,
            reservation_created: false,
            saved: false,
            forwarded: false,
          },
          200,
          origin,
        );
      }
      
      // ================================================
      // VIWUP | EF-05.7C.1
      // Observacion persistente preparada.
      // Solo accesible con token privado y flag activo.
      // EF-05.7C.1: el flag permanece en false.
      // ================================================
      
      const hmacSecret =
        Deno.env.get("VIWUP_RATE_HMAC_KEY") ?? "";
      
      // Fallar cerrado si no existe una clave valida.
      // No registrar ni devolver la clave.
      if (new TextEncoder().encode(hmacSecret).length < 32) {
        console.error(
          "EF-05.7C: configuracion HMAC no disponible",
        );
      
        return response(
          {
            error: "Observacion temporalmente no disponible",
            forwarded: false,
          },
          503,
          origin,
        );
      }
      
      try {
        const localId = (data.idLocal as string).toLowerCase();
        const requestId = (data.requestId as string).toLowerCase();
      
        // HMAC del dispositivo, separado por restaurante.
        const deviceHash = await hmacSha256Hex(
          hmacSecret,
          "device",
          localId,
          deviceId,
        );
      
        // Exactamente el mismo hash utilizado en EF-04.2.
        const payloadHash = await feedbackPayloadHash(data);
      
        // IP desactivada hasta verificar cabecera confiable.
        const { data: observation, error: observationError } =
          await supabaseAdmin.rpc(
            "viwup_observe_feedback_rate",
            {
              p_local_id: localId,
              p_request_id: requestId,
              p_payload_hash: payloadHash,
              p_device_hash: deviceHash,
              p_ip_hash: null,
            },
          );
      
        if (observationError) {
          console.error(
            "EF-05.7C: error RPC",
            observationError.code,
          );
      
          return response(
            {
              error: "Observacion temporalmente no disponible",
              forwarded: false,
            },
            503,
            origin,
          );
        }
      
        if (
          !observation ||
          typeof observation !== "object" ||
          Array.isArray(observation)
        ) {
          console.error(
            "EF-05.7C: respuesta RPC invalida",
          );
      
          return response(
            {
              error: "Respuesta de observacion invalida",
              forwarded: false,
            },
            503,
            origin,
          );
        }
      
        const result = observation as Record<string, unknown>;
        const decision = result.decision;
      
        if (decision === "observed") {
          const deviceCount = result.device_count;
          const deviceOverLimit = result.device_over_limit;
      
          if (
            !Number.isSafeInteger(deviceCount) ||
            typeof deviceCount !== "number" ||
            deviceCount < 1 ||
            typeof deviceOverLimit !== "boolean" ||
            result.ip_count !== null ||
            result.ip_over_limit !== false ||
            typeof result.window_start !== "string"
          ) {
            console.error(
              "EF-05.7C: contadores inesperados",
            );
      
            return response(
              {
                error: "Resultado de observacion invalido",
                forwarded: false,
              },
              503,
              origin,
            );
          }
      
          return response(
            {
              status: "observation_recorded",
              decision: "observed",
              device_count: deviceCount,
              device_over_limit: deviceOverLimit,
              ip_observed: false,
              reservation_created: false,
              saved: false,
              forwarded: false,
            },
            200,
            origin,
          );
        }
      
        if (decision === "duplicate") {
          return response(
            {
              status: "observation_duplicate",
              decision: "duplicate",
              reservation_created: false,
              saved: false,
              forwarded: false,
            },
            200,
            origin,
          );
        }
      
        if (decision === "conflict") {
          return response(
            {
              error: "Identificador reutilizado con otro contenido",
              decision: "conflict",
              reservation_created: false,
              forwarded: false,
            },
            409,
            origin,
          );
        }
      
        if (decision === "invalid") {
          return response(
            {
              error: "Observacion invalida",
              forwarded: false,
            },
            422,
            origin,
          );
        }
      
        if (decision === "inactive_or_missing") {
          return response(
            {
              error: "Restaurante no disponible",
              forwarded: false,
            },
            403,
            origin,
          );
        }
      
        console.error(
          "EF-05.7C: decision RPC inesperada",
        );
      
        return response(
          {
            error: "Resultado de observacion inesperado",
            forwarded: false,
          },
          503,
          origin,
        );
      } catch {
        console.error(
          "EF-05.7C: fallo interno de observacion",
        );
      
        return response(
          {
            error: "Observacion temporalmente no disponible",
            forwarded: false,
          },
          503,
          origin,
        );
      }

    }
    
    // VIWUP | EF-05.7C.1
    // Hash compartido entre reserva y observacion.
    const payloadHash = await feedbackPayloadHash(data);

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
      // Conservar la reserva normal de EF-04.2.
      if (testAction !== "simulate-review") {
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

      // EF-04.5: reclamar sin contactar Make.
      const { data: claimToken, error: claimError } =
        await supabaseAdmin.rpc("viwup_claim_feedback", {
          p_local_id: (data.idLocal as string).toLowerCase(),
          p_request_id: (data.requestId as string).toLowerCase(),
          p_payload_hash: payloadHash,
        });

      if (claimError || !isUuid(claimToken)) {
        console.error(
          "EF-04.5: fallo de reclamación",
          claimError?.code ?? "INVALID_CLAIM",
        );

        return response(
          {
            error: "No se pudo reclamar la solicitud",
            forwarded: false,
          },
          503,
          origin,
        );
      }

      // Cierre simulado: jamás marcar como enviado.
      const { data: finished, error: finishError } =
        await supabaseAdmin.rpc("viwup_finish_feedback", {
          p_local_id: (data.idLocal as string).toLowerCase(),
          p_request_id: (data.requestId as string).toLowerCase(),
          p_claim_token: claimToken,
          p_status: "review_required",
          p_error_code: "SIMULATED_NO_DELIVERY",
        });

      if (finishError || finished !== true) {
        console.error(
          "EF-04.5: fallo de cierre simulado",
          finishError?.code ?? "FINISH_REJECTED",
        );

        return response(
          {
            error: "Cierre simulado no confirmado",
            forwarded: false,
          },
          503,
          origin,
        );
      }

      return response(
        {
          status: "simulated_review",
          reservation: "reserved",
          reservation_created: true,
          claim_completed: true,
          saved: false,
          forwarded: false,
        },
        200,
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
