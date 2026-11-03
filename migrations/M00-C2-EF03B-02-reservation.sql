
-- =====================================================
-- VIWUP | EF-03B.2
-- Reserva atomica de solicitudes
-- BORRADOR - NO EJECUTAR
-- =====================================================
--
-- Dependencia:
-- viwup_private.feedback_requests
--
-- Objetivo:
-- Reservar una solicitud una sola vez por restaurante
-- e identificador de evaluacion.
--
-- Esta version NO procesa Make.
-- NO registra evaluaciones.
-- NO modifica solicitudes ya existentes.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.viwup_reserve_feedback(
    p_local_id uuid,
    p_request_id uuid,
    p_payload_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inserted_id uuid;
    v_existing_hash text;
BEGIN
    -- Validaciones de entrada.
    IF p_local_id IS NULL
       OR p_request_id IS NULL
       OR p_payload_hash IS NULL
       OR p_payload_hash !~ '^[a-f0-9]{64}$'
    THEN
        RETURN 'invalid';
    END IF;

    -- Reservar una solicitud.
    INSERT INTO viwup_private.feedback_requests (
        local_id,
        request_id,
        payload_hash,
        status
    )
    VALUES (
        p_local_id,
        p_request_id,
        p_payload_hash,
        'pending'
    )
    ON CONFLICT (local_id, request_id)
    DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
        RETURN 'reserved';
    END IF;

    -- Si ya existia, comprobar su contenido.
    SELECT payload_hash
    INTO v_existing_hash
    FROM viwup_private.feedback_requests
    WHERE local_id = p_local_id
      AND request_id = p_request_id;

    IF v_existing_hash IS NULL THEN
        RETURN 'retry';
    END IF;

    IF v_existing_hash = p_payload_hash THEN
        RETURN 'duplicate';
    END IF;

    RETURN 'conflict';
END;
$$;

-- Restringir ejecucion de la funcion.
REVOKE ALL ON FUNCTION public.viwup_reserve_feedback(
    uuid, uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.viwup_reserve_feedback(
    uuid, uuid, text
) TO service_role;

COMMIT;
