
-- =====================================================
-- VIWUP | EF-03B.8
-- Recuperacion manual de solicitudes interrumpidas
-- BORRADOR - NO EJECUTAR
--
-- Dependencias:
-- EF03B-04: feedback_requests
-- EF03B-06: claimed_at
-- =====================================================

BEGIN;

CREATE FUNCTION public.viwup_review_stale_feedback(
    p_min_age_minutes integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Evitar revisiones demasiado tempranas.
    IF p_min_age_minutes IS NULL
       OR p_min_age_minutes < 30
       OR p_min_age_minutes > 10080
    THEN
        RAISE EXCEPTION
            'Intervalo de revision no permitido';
    END IF;

    UPDATE viwup_private.feedback_requests
    SET
        status = 'review_required',
        last_error_code = 'PROCESSING_TIMEOUT',
        updated_at = pg_catalog.now()
    WHERE status = 'processing'
      AND claimed_at IS NOT NULL
      AND claimed_at < (
          pg_catalog.now()
          - pg_catalog.make_interval(
              mins => p_min_age_minutes
          )
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;

-- Retirar acceso publico a la funcion.
REVOKE ALL ON FUNCTION
public.viwup_review_stale_feedback(integer)
FROM PUBLIC, anon, authenticated;

-- Permitir ejecucion solo al backend privilegiado.
GRANT EXECUTE ON FUNCTION
public.viwup_review_stale_feedback(integer)
TO service_role;

COMMIT;
