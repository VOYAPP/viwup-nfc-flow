
-- =====================================================
-- VIWUP | EF-03B
-- Control privado de solicitudes de evaluaciones
-- ESTADO: BORRADOR - NO EJECUTAR
-- =====================================================

BEGIN;

-- 1. Esquema privado, separado de public.
CREATE SCHEMA IF NOT EXISTS viwup_private;

REVOKE ALL ON SCHEMA viwup_private
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA viwup_private
TO service_role;

-- 2. Tabla de control de solicitudes.
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

    UNIQUE (local_id, request_id)
);

-- 3. Índices para consultas futuras.
CREATE INDEX feedback_requests_local_created_idx
ON viwup_private.feedback_requests (
    local_id,
    created_at DESC
);

CREATE INDEX feedback_requests_status_idx
ON viwup_private.feedback_requests (status);

-- 4. Mantener RLS habilitado.
ALTER TABLE viwup_private.feedback_requests
ENABLE ROW LEVEL SECURITY;

-- 5. Prohibir acceso directo de clientes.
REVOKE ALL ON TABLE
viwup_private.feedback_requests
FROM PUBLIC, anon, authenticated;

-- 6. Autorizar únicamente operaciones del backend.
GRANT SELECT, INSERT, UPDATE
ON viwup_private.feedback_requests
TO service_role;

COMMIT;
