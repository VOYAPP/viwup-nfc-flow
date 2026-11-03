
-- =====================================================
-- VIWUP | EF-03B.6
-- Reclamacion exclusiva y cierre de envio
-- BORRADOR - NO EJECUTAR
-- =====================================================
--
-- Requiere ejecutar primero EF03B-04 consolidado.
-- No contacta Make.
-- No inserta evaluaciones.
-- No crea clientes ni modifica locales.
-- =====================================================

BEGIN;

-- 1. Agregar identificador de reclamacion.
ALTER TABLE viwup_private.feedback_requests
ADD COLUMN claim_token uuid,
ADD COLUMN claimed_at timestamptz,
ADD COLUMN completed_at timestamptz;

-- 2. Reclamar exclusivamente una solicitud pendiente.
CREATE FUNCTION public.viwup_claim_feedback(
    p_local_id uuid,
    p_request_id uuid,
    p_payload_hash text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_token uuid;
BEGIN
    IF p_local_id IS NULL
       OR p_request_id IS NULL
       OR p_payload_hash IS NULL
       OR p_payload_hash !~ '^[a-f0-9]{64}$'
    THEN
        RETURN NULL;
    END IF;

    UPDATE viwup_private.feedback_requests
    SET
        status = 'processing',
        claim_token = pg_catalog.gen_random_uuid(),
        claimed_at = now(),
        updated_at = now(),
        attempts = attempts + 1
    WHERE local_id = p_local_id
      AND request_id = p_request_id
      AND payload_hash = p_payload_hash
      AND status = 'pending'
    RETURNING claim_token INTO v_token;

    RETURN v_token;
END;
$$;

-- Restringir ejecucion.
REVOKE ALL ON FUNCTION
public.viwup_claim_feedback(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.viwup_claim_feedback(uuid, uuid, text)
TO service_role;


-- 3. Finalizar el resultado del envio.
CREATE FUNCTION public.viwup_finish_feedback(
    p_local_id uuid,
    p_request_id uuid,
    p_claim_token uuid,
    p_status text,
    p_error_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_updated_id uuid;
BEGIN
    -- Solo permitir los dos resultados
    -- posteriores al inicio del envio.
    IF p_local_id IS NULL
       OR p_request_id IS NULL
       OR p_claim_token IS NULL
       OR p_status IS NULL
       OR p_status NOT IN (
           'sent',
           'review_required'
       )
       OR (
           p_error_code IS NOT NULL
           AND length(p_error_code) > 100
       )
    THEN
        RETURN FALSE;
    END IF;
    
    UPDATE viwup_private.feedback_requests
    SET
        status = p_status,
        last_error_code = CASE
            WHEN p_status = 'sent' THEN NULL
            ELSE p_error_code
        END,
        completed_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE local_id = p_local_id
      AND request_id = p_request_id
      AND claim_token = p_claim_token
      AND (
          status = 'processing'
          OR (
              status = 'review_required'
              AND last_error_code = 'PROCESSING_TIMEOUT'
              AND p_status = 'sent'
          )
      )
    RETURNING id INTO v_updated_id;

    RETURN v_updated_id IS NOT NULL;
END;
$$;

-- Restringir ejecucion.
REVOKE ALL ON FUNCTION
public.viwup_finish_feedback(
    uuid, uuid, uuid, text, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.viwup_finish_feedback(
    uuid, uuid, uuid, text, text
)
TO service_role;

COMMIT;
