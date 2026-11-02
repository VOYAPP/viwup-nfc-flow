# ViwUp — EF-03B: Control de frecuencia e idempotencia

**Estado:** Diseño aprobado, implementación pendiente  
**Rama:** Desarrollo  
**Entorno:** Supabase Edge Functions + PostgreSQL + Make

## Objetivo

Proteger las evaluaciones anónimas de ViwUp frente a solicitudes duplicadas, errores de entrega y abuso automatizado.

Mantener el escenario existente de Make como responsable de registrar evaluaciones y procesar alertas WhatsApp.

## Decisiones aprobadas

- Límites de frecuencia provisionales y ajustables.
- Sin reenvíos automáticos a Make durante la primera implementación.
- Los resultados ambiguos requieren revisión manual.
- No contratar servicios adicionales sin autorización.
- No incorporar secretos en GitHub o JavaScript público.
- Mantener `viwup-feedback` sin efectos externos hasta superar las pruebas.

## Modelo propuesto

Crear una tabla privada de control de solicitudes con:

- `id`: identificador interno UUID.
- `local_id`: referencia al restaurante.
- `request_id`: UUID de idempotencia.
- `payload_hash`: resumen criptográfico del contenido normalizado.
- `status`: estado de procesamiento.
- `attempts`: número de intentos.
- `created_at`: fecha de creación.
- `updated_at`: última modificación.
- `last_error_code`: código interno de error, sin secretos.

Restricción única: `(local_id, request_id)`.

No almacenar comentarios, teléfonos, tokens o direcciones IP completas en esta tabla salvo que exista una necesidad justificada y controles de privacidad definidos.

## Estados

- `pending`: solicitud reservada, aún sin enviar.
- `processing`: envío reservado por una única ejecución.
- `sent`: Make confirmó recepción HTTP.
- `failed`: fallo confirmado antes de completar el envío.
- `review_required`: resultado ambiguo; no reenviar automáticamente.

La respuesta HTTP de Make no demuestra la entrega final del WhatsApp.

## Control de concurrencia

La reserva de una solicitud y la comprobación de límites deben implementarse mediante una operación atómica en PostgreSQL.

No utilizar consultas independientes de lectura y posterior inserción como única protección frente a ejecuciones simultáneas.

La operación de reserva será exclusivamente del backend. Las funciones SQL privilegiadas deberán tener permisos EXECUTE restringidos y una configuración segura de `search_path`.

## Límites provisionales

Evaluar inicialmente:

- Hasta 3 solicitudes por identificador de cliente en 10 minutos.
- Hasta 30 solicitudes por restaurante en 10 minutos.
- HTTP 429 cuando se supere un límite aplicable.

Estos valores no están autorizados para producción hasta disponer de pruebas de carga y una estrategia contra el uso de identificadores falsificados.

Evitar que un atacante pueda bloquear la recepción de evaluaciones legítimas agotando artificialmente el límite global del restaurante.

## Integración con Make

- Conservar el escenario y la plantilla WhatsApp existentes.
- Proteger el webhook mediante Supabase Edge Function Secrets.
- Sustituir la URL anteriormente expuesta.
- No registrar la misma evaluación tanto en la Edge Function como en Make.
- Mantener compatibilidad con el formato de datos que utiliza el escenario actual.
- Diseñar una comprobación de duplicados en el destino antes de habilitar reintentos automáticos.

## Seguridad

- `Verify JWT = OFF` únicamente para el endpoint NFC público.
- El cliente administrativo utilizará `SUPABASE_SECRET_KEYS` exclusivamente en el servidor.
- Validar datos y estado del restaurante antes de ejecutar acciones.
- No considerar CORS como mecanismo de autenticación.
- Rechazar campos administrativos enviados desde el navegador.
- No devolver información privada en las respuestas.
- Incorporar una estrategia de protección contra bots y abuso antes de producción.

## Pruebas obligatorias

1. Restaurante inexistente: HTTP 404.
2. Restaurante inactivo: HTTP 403.
3. Campo no autorizado: HTTP 422.
4. Evaluación válida en modo `dry_run`: HTTP 200.
5. Solicitud repetida: ningún envío adicional.
6. Solicitud con mismo UUID y distinto contenido: HTTP 409.
7. Límite superado: HTTP 429.
8. Fallo ambiguo de Make: estado `review_required`.
9. Solicitudes concurrentes: una sola reserva de procesamiento.

## Pendientes

- Diagnosticar regresión EF-03A.
- Aprobar migración SQL de control.
- Implementar reserva atómica.
- Aprobar y probar integración con Make.
- Actualizar `app.js`.
- Proteger la tabla `locales`.
- Realizar pruebas completas antes del merge.

**No ejecutar SQL ni desplegar nuevas versiones sin aprobación explícita.**
