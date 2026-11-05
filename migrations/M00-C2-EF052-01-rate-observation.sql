
-- VIWUP | EF-05.2
-- MIGRACION PROPUESTA: OBSERVACION DE FRECUENCIA
-- NO EJECUTAR TODAVIA
-- No activa bloqueos ni modifica Make.

BEGIN;

-- 1. REGISTRO IDEMPOTENTE DE DECISIONES

CREATE TABLE viwup_private.feedback_rate_decisions (
    local_id uuid NOT NULL
        REFERENCES public.locales(id),
    request_id uuid NOT NULL,
    payload_hash text NOT NULL
        CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
    device_hash text
        CHECK (
            device_hash IS NULL OR
            device_hash ~ '^[a-f0-9]{64}$'
        ),
    ip_hash text
        CHECK (
            ip_hash IS NULL OR
            ip_hash ~ '^[a-f0-9]{64}$'
        ),
    verdict text NOT NULL DEFAULT 'observed'
        CHECK (verdict = 'observed'),
    created_at timestamptz NOT NULL
        DEFAULT pg_catalog.now(),
    PRIMARY KEY (local_id, request_id)
);

CREATE INDEX feedback_rate_decisions_created_idx
ON viwup_private.feedback_rate_decisions
(created_at);

-- 2. CONTADORES POR ORIGEN Y VENTANA

CREATE TABLE viwup_private.feedback_rate_buckets (
    local_id uuid NOT NULL
        REFERENCES public.locales(id),
    signal_type text NOT NULL
        CHECK (signal_type IN ('device', 'ip')),
    signal_hash text NOT NULL
        CHECK (signal_hash ~ '^[a-f0-9]{64}$'),
    window_start timestamptz NOT NULL,
    request_count integer NOT NULL DEFAULT 0
        CHECK (request_count >= 0),
    PRIMARY KEY (
        local_id,
        signal_type,
        signal_hash,
        window_start
    )
);

CREATE INDEX feedback_rate_buckets_window_idx
ON viwup_private.feedback_rate_buckets
(window_start);

-- 3. SEGURIDAD DE TABLAS

ALTER TABLE viwup_private.feedback_rate_decisions
ENABLE ROW LEVEL SECURITY;

ALTER TABLE viwup_private.feedback_rate_buckets
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
    viwup_private.feedback_rate_decisions,
    viwup_private.feedback_rate_buckets
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA viwup_private
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    viwup_private.feedback_rate_decisions,
    viwup_private.feedback_rate_buckets
TO service_role;

-- 4. FUNCION ATOMICA DE OBSERVACION

CREATE FUNCTION public.viwup_observe_feedback_rate(
    p_local_id uuid,
    p_request_id uuid,
    p_payload_hash text,
    p_device_hash text,
    p_ip_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_existing_hash text;
    v_window timestamptz;
    v_device_count integer;
    v_ip_count integer;
BEGIN
    -- Validaciones sin efectos secundarios.
    IF p_local_id IS NULL
       OR p_request_id IS NULL
       OR p_payload_hash IS NULL
       OR p_payload_hash !~ '^[a-f0-9]{64}$'
       OR (
           p_device_hash IS NOT NULL
           AND p_device_hash !~ '^[a-f0-9]{64}$'
       )
       OR (
           p_ip_hash IS NOT NULL
           AND p_ip_hash !~ '^[a-f0-9]{64}$'
       )
    THEN
        RETURN pg_catalog.jsonb_build_object(
            'decision', 'invalid'
        );
    END IF;

    -- Serializar las observaciones del restaurante.
    -- El hash puede colisionar: eso solo provoca
    -- serializacion adicional, no mezcla de datos.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        55102,
        pg_catalog.hashtext(p_local_id::text)
    );

    -- Verificar restaurante activo.
    IF NOT EXISTS (
        SELECT 1
        FROM public.locales
        WHERE id = p_local_id
          AND estado_activo IS TRUE
    ) THEN
        RETURN pg_catalog.jsonb_build_object(
            'decision', 'inactive_or_missing'
        );
    END IF;

    -- Idempotencia: un requestId por restaurante.
    SELECT payload_hash
    INTO v_existing_hash
    FROM viwup_private.feedback_rate_decisions
    WHERE local_id = p_local_id
      AND request_id = p_request_id;

    IF FOUND THEN
        IF v_existing_hash = p_payload_hash THEN
            RETURN pg_catalog.jsonb_build_object(
                'decision', 'duplicate'
            );
        END IF;

        RETURN pg_catalog.jsonb_build_object(
            'decision', 'conflict'
        );
    END IF;

    -- Intervalo fijo UTC de 600 segundos.
    v_window := pg_catalog.to_timestamp(
        pg_catalog.floor(
            EXTRACT(
                EPOCH FROM pg_catalog.clock_timestamp()
            ) / 600
        ) * 600
    );

    -- Registrar una sola decision por solicitud.
    INSERT INTO viwup_private.feedback_rate_decisions (
        local_id,
        request_id,
        payload_hash,
        device_hash,
        ip_hash,
        verdict
    )
    VALUES (
        p_local_id,
        p_request_id,
        p_payload_hash,
        p_device_hash,
        p_ip_hash,
        'observed'
    );

    -- Contador del dispositivo, si existe la señal.
    IF p_device_hash IS NOT NULL THEN
        INSERT INTO viwup_private.feedback_rate_buckets AS b (
            local_id,
            signal_type,
            signal_hash,
            window_start,
            request_count
        )
        VALUES (
            p_local_id,
            'device',
            p_device_hash,
            v_window,
            1
        )
        ON CONFLICT (
            local_id,
            signal_type,
            signal_hash,
            window_start
        )        
        DO UPDATE SET
            request_count = b.request_count + 1
        RETURNING request_count
        INTO v_device_count;
    END IF;

    -- Contador IP seudonimizada, si es confiable.
    IF p_ip_hash IS NOT NULL THEN
        INSERT INTO viwup_private.feedback_rate_buckets AS b (
            local_id,
            signal_type,
            signal_hash,
            window_start,
            request_count
        )
        VALUES (
            p_local_id,
            'ip',
            p_ip_hash,
            v_window,
            1
        )
        ON CONFLICT (
            local_id,
            signal_type,
            signal_hash,
            window_start
        ) 
        DO UPDATE SET
            request_count = b.request_count + 1
        RETURNING request_count
        INTO v_ip_count;
    END IF;

    -- SOLO OBSERVACION.
    -- Ningun umbral bloquea la solicitud.
    RETURN pg_catalog.jsonb_build_object(
        'decision', 'observed',
        'window_start', v_window,
        'device_count', v_device_count,
        'ip_count', v_ip_count,
        'device_over_limit',
            COALESCE(v_device_count > 3, false),
        'ip_over_limit',
            COALESCE(v_ip_count > 20, false)
    );
END;
$$;

REVOKE ALL ON FUNCTION
public.viwup_observe_feedback_rate(
    uuid, uuid, text, text, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.viwup_observe_feedback_rate(
    uuid, uuid, text, text, text
)
TO service_role;

-- 5. LIMPIEZA MANUAL DE CONTADORES VENCIDOS
-- Sin cron ni ejecucion automatica.

CREATE FUNCTION public.viwup_cleanup_rate_buckets(
    p_batch_size integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_deleted integer;
BEGIN
    IF p_batch_size IS NULL
       OR p_batch_size < 1
       OR p_batch_size > 1000
    THEN
        RAISE EXCEPTION 'Batch size invalido';
    END IF;

    WITH expired AS (
        SELECT ctid
        FROM viwup_private.feedback_rate_buckets
        WHERE window_start <
            pg_catalog.now() - INTERVAL '24 hours'
        ORDER BY window_start
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    DELETE FROM viwup_private.feedback_rate_buckets b
    USING expired e
    WHERE b.ctid = e.ctid;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION
public.viwup_cleanup_rate_buckets(integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.viwup_cleanup_rate_buckets(integer)
TO service_role;

COMMIT;
