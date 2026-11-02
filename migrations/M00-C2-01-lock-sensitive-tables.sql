
-- ==================================================
-- VIWUP | M00-C2-01
-- PROTECCIÓN INICIAL DE TABLAS SENSIBLES
-- ESTADO: BORRADOR PARA APROBACIÓN
-- ==================================================
--
-- Tablas:
--   public.ambassadors
--   public.pagos_ambassadors
--   public.logs_locales
--
-- Objetivo:
-- Bloquear acceso directo de clientes anon
-- y authenticated durante la reconstrucción.
--
-- No elimina registros ni tablas.
-- Ejecutar solo tras aprobar la migración.
-- ==================================================

BEGIN;

-- 1. Mantener RLS habilitado

ALTER TABLE public.ambassadors
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pagos_ambassadors
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logs_locales
ENABLE ROW LEVEL SECURITY;


-- 2. Revocar permisos directos de clientes

REVOKE ALL PRIVILEGES
ON TABLE public.ambassadors
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.pagos_ambassadors
FROM anon, authenticated;

REVOKE ALL PRIVILEGES
ON TABLE public.logs_locales
FROM anon, authenticated;


-- 3. Mantener el acceso privilegiado
-- del backend mediante service_role.
-- No introducir su clave en el frontend.
--
-- No se modifican sus GRANT existentes.


COMMIT;
