
-- =====================================================
-- VIWUP | M00-C2-EF03B-04
-- Migracion consolidada: tabla y reserva atomica
-- ESTADO: BORRADOR - NO EJECUTAR
-- =====================================================

BEGIN;

-- 1. Crear esquema interno.
CREATE SCHEMA viwup_private;

REVOKE ALL ON SCHEMA viwup_private
FROM PUBLIC, anon, authenticated;

-- 2. Tabla privada.
CREATE TABLE viwup_private.feedback_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    local_id uuid NOT NULL
        REFERENCES public.locales(id),

    request_id uuid NOT NULL,

    payload_hash text NOT NULL,

    status text NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'sent',
                'failed',
                'review_required'
            )
        ),

    attempts integer NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    last_error_code text,

    created_at timestamptz NOT NULL
        DEFAULT now(),

    updated_at timestamptz NOT NULL
        DEFAULT now(),

    CONSTRAINT feedback_requests_unique
        UNIQUE (local_id, request_id)
);

-- 3. Indices.
CREATE INDEX feedback_requests_local_created_idx
ON viwup_private.feedback_requests (
    local_id,
    created_at DESC
);

CREATE INDEX feedback_requests_status_idx
ON viwup_private.feedback_requests (status);

-- 4. Seguridad de tabla.
ALTER TABLE viwup_private.feedback_requests
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON viwup_private.feedback_requests
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA viwup_private
TO service_role;

GRANT SELECT, INSERT, UPDATE
ON viwup_private.feedback_requests
TO service_role;

-- 5. Reserva atomica.
CREATE FUNCTION public.viwup_reserve_feedback(
    p_local_id uuid,
    p_request_id uuid,
    p_payload_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_inserted_id uuid;
    v_existing_hash text;
BEGIN
    -- Validar parametros.
    IF p_local_id IS NULL
       OR p_request_id IS NULL
       OR p_payload_hash IS NULL
       OR p_payload_hash !~ '^[a-f0-9]{64}$'
    THEN
        RETURN 'invalid';
    END IF;

    -- Validar restaurante activo.
    IF NOT EXISTS (
        SELECT 1
        FROM public.locales
        WHERE id = p_local_id
          AND estado_activo IS TRUE
    ) THEN
        RETURN 'inactive_or_missing';
    END IF;

    -- Primera solicitud obtiene la reserva.
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

    -- Solicitud existente.
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

-- 6. Permisos de la funcion.
REVOKE ALL ON FUNCTION
public.viwup_reserve_feedback(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.viwup_reserve_feedback(uuid, uuid, text)
TO service_role;

COMMIT;
