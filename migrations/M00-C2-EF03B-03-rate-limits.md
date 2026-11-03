
# ViwUp — EF-03B.3
## Control de frecuencia y prevención de abuso

Estado: DISEÑO — NO IMPLEMENTADO
Rama: Desarrollo

### Objetivo
Reducir solicitudes automatizadas y evitar
evaluaciones duplicadas sin bloquear
innecesariamente a clientes legítimos.

### 1. Idempotencia
- Cada evaluación tendrá un request_id UUID.
- El mismo request_id no podrá reservarse dos veces.
- Si cambia el contenido, responder HTTP 409.
- Los reintentos conservarán el mismo request_id.

### 2. Límite individual provisional
- Referencia inicial: 3 solicitudes cada 10 minutos.
- No confiar solamente en un identificador
  generado por el navegador.
- Definir y verificar una señal confiable del
  origen antes de activar el límite.
- No almacenar IP completas si no es necesario.

### 3. Control por restaurante
- Umbral inicial de observación:
  30 solicitudes cada 10 minutos.
- No bloquear automáticamente todo el local
  al alcanzar este umbral.
- Revisar patrones de abuso y volumen real.

### 4. Concurrencia
- Comprobar límites y reservar solicitudes
  dentro de una operación atómica.
- Evitar condiciones de carrera.
- No confiar en variables de memoria de
  una instancia de Edge Function.

### 5. Manejo de errores
- HTTP 409: request_id con contenido diferente.
- HTTP 429: límite individual confirmado.
- HTTP 503: fallo temporal del servidor.
- No reenvío automático a Make inicialmente.
- Resultado ambiguo: review_required.

### 6. Privacidad y seguridad
- Tablas de control en viwup_private.
- Sin acceso directo de anon/authenticated.
- Funciones administrativas con EXECUTE
  restringido y search_path seguro.
- No registrar secretos ni payloads sensibles.
- Verificar la procedencia de cabeceras IP.
- Evaluar protección antibots adicional.

### 7. Pruebas antes de producción
- Reintento con mismo request_id.
- Mismo ID con contenido diferente.
- Solicitudes simultáneas.
- Exceso de frecuencia individual.
- Pico de tráfico legítimo en un restaurante.
- Fallo o timeout de Make.

### Pendiente
Diseñar la implementación SQL transaccional
y revisar su comportamiento antes de ejecutar.
