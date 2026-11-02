
/**
 * VIWUP | M00-C2-EF01
 * Edge Function: viwup-feedback
 *
 * ETAPA 1: Validación sin efectos externos.
 * No consulta PostgreSQL.
 * No envía solicitudes a Make.
 * No registra evaluaciones.
 */

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
  const forbidden = [
    "telefonoAdministrador",
    "webhook_url",
    "token_dashboard",
  ];

  if (forbidden.some((field) => field in data)) {
    return response(
      { error: "Campos no permitidos" },
      422,
      origin,
    );
  }

  // EF-01: solo prueba de validación.
  // NO registra, NO llama a Make, NO envía WhatsApp.
  return response(
    {
      status: "dry_run",
      valid: true,
      forwarded: false,
      saved: false,
      message: "Validación correcta. Envío deshabilitado.",
    },
    200,
    origin,
  );
});
