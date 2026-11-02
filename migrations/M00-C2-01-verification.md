
# ViwUp — Verificación M00-C2-01

Estado: APLICADA Y VERIFICADA
Plataforma: Supabase SQL Editor

## Tablas protegidas
- public.ambassadors
- public.logs_locales
- public.pagos_ambassadors

## Resultado
- RLS habilitado en las tres tablas.
- anon: SELECT, INSERT, UPDATE, DELETE = false.
- authenticated: SELECT, INSERT, UPDATE, DELETE = false.
- service_role: SELECT, INSERT, UPDATE, DELETE = true.

## Pendiente
- Sustituir políticas RLS antiguas.
- Revisar otros objetos y servicios externos.
- Reconstruir panel Admin y Ambassador.
- Comprobar funcionalidad con usuarios reales de prueba.

## Restricciones
- No restaurar permisos públicos inseguros.
- No fusionar con principal todavía.
- Mantener viwup.cl en mantenimiento.
