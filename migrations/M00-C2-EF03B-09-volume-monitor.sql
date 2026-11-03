
-- =====================================================
-- VIWUP | EF-03B.9
-- Monitoreo de frecuencia por restaurante
-- BORRADOR - NO EJECUTAR
--
-- Requiere:
-- EF03B-04: tabla feedback_requests
-- =====================================================

BEGIN;

CREATE FUNCTION public.viwup_feedback_volume(
    p_local_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT COUNT(*)
    FROM viwup_private.feedback_requests
    WHERE local_id = p_local_id
      AND created_at >= (
          pg_catalog.now()
          - INTERVAL '10 minutes'
      );
$$;

-- Evitar ejecución pública.
REVOKE ALL ON FUNCTION
public.viwup_feedback_volume(uuid)
FROM PUBLIC, anon, authenticated;

-- Autorizar solamente al backend.
GRANT EXECUTE ON FUNCTION
public.viwup_feedback_volume(uuid)
TO service_role;

COMMIT;
