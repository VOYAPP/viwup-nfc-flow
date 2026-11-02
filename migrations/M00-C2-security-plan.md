
# ViwUp — M00-C.2
## Plan de seguridad y reconstrucción

Estado: EN PREPARACIÓN
Rama: Desarrollo
Producción: En mantenimiento

### Objetivo
Reforzar los permisos de Supabase y reconstruir
las conexiones de ViwUp sin exponer credenciales
privilegiadas en el frontend.

### Tablas existentes
- ambassadors
- locales
- garzones
- evaluaciones
- logs_locales
- pagos_ambassadors
- reportes_predictivos

### Decisiones aprobadas
- Suscripción: $29.900 CLP mensuales.
- Varios dueños y administradores por restaurante.
- Ambassador: PIN de 6 dígitos con identidad verificada.
- Ambassador puede crear demos y solicitar cambios.
- Transferencias requieren aprobación del Superadmin.
- Mercado Pago: suscripciones mensuales automáticas.
- Sin contratar servicios adicionales sin autorización.

### Seguridad
- Legacy API Keys: deshabilitadas.
- Legacy JWT Secret: revocado.
- Nueva JWT Signing Key: activa.
- No incluir Secret Keys ni webhooks privados
  en archivos públicos.
- Autorización por usuario y restaurante.
- Mantener RLS habilitado.

### Migraciones pendientes
1. Restringir acceso público a tablas sensibles.
2. Crear relaciones de usuarios y restaurantes.
3. Preparar funciones de autorización.
4. Reconstruir la autenticación de Ambassadors.
5. Proteger la experiencia NFC y el dashboard.
6. Implementar endpoints seguros.
7. Probar permisos y flujos funcionales.

### Reglas de implementación
- Revisar antes de ejecutar SQL.
- No realizar operaciones destructivas sin aprobación.
- Mantener viwup.cl en mantenimiento.
- No hacer merge antes de completar las pruebas.
- No generar costos adicionales sin autorización.
