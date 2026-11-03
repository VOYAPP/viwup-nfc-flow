
# ViwUp — EF-03B.5
## Control de envío único a Make

Estado: DISEÑO - NO IMPLEMENTADO
Rama: Desarrollo

### Objetivo
Impedir envíos concurrentes de la misma evaluación
y gestionar las entregas ambiguas a Make.

### 1. Reserva
- Identificar la evaluación mediante local_id
  y request_id.
- Comprobar el hash del contenido.
- Rechazar contenido diferente con HTTP 409.
- No reenviar solicitudes ya existentes.

### 2. Reclamación del envío
- Solo pasar de pending a processing.
- La transición será atómica en PostgreSQL.
- Una única ejecución obtiene autorización.
- Las restantes no enviarán a Make.
- Registrar el momento de la reclamación.

### 3. Comunicación con Make
- Conservar el escenario existente.
- Utilizar una URL nueva guardada como secreto.
- Enviar exclusivamente datos validados.
- Obtener el teléfono administrativo en servidor.
- Mantener Make como responsable del registro.
- No insertar evaluaciones por duplicado.

### 4. Confirmación
- HTTP exitoso de Make: sent.
- Error antes de iniciar el envío: failed.
- Timeout o resultado incierto: review_required.
- Una confirmación HTTP no demuestra
  entrega final del WhatsApp.

### 5. Recuperación
- No realizar reenvíos automáticos inicialmente.
- No liberar automáticamente processing
  después de un timeout.
- Detectar solicitudes detenidas.
- Revisar estado de Make antes de reintentar.
- Registrar acciones de recuperación.

### 6. Seguridad
- Funciones SQL con SECURITY INVOKER.
- Ejecutables solamente por service_role.
- Tablas de control en esquema privado.
- Ninguna clave privada en app.js o GitHub.
- Mantener Verify JWT OFF solo para el
  endpoint NFC público con controles propios.

### 7. Pruebas necesarias
- Primera solicitud obtiene la reserva.
- Segunda solicitud idéntica no se reenvía.
- Solicitudes simultáneas: una sola reclamación.
- Mismo request_id y distinto contenido: conflicto.
- Timeout de Make: revisión manual.
- Respuesta HTTP válida: estado sent.
- Fallo de PostgreSQL: no realizar envío.
- No registrar información sensible en logs.

### Pendiente de implementación
- Función SQL de reclamación exclusiva.
- Función SQL de actualización de estado.
- Integración de frecuencia y reserva.
- Modificación de Edge Function.
- Rotación del webhook antiguo.
- Pruebas de extremo a extremo.

NO EJECUTAR MIGRACIONES NI DESPLEGAR CAMBIOS.
