
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
