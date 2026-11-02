
-- VIWUP | M00-C2-01
-- Protección de tablas sensibles
-- REVISADO - Pendiente de ejecución

BEGIN;

-- Mantener RLS activo
ALTER TABLE public.ambassadors
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pagos_ambassadors
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logs_locales
ENABLE ROW LEVEL SECURITY;

-- Bloquear acceso directo de clientes
REVOKE ALL PRIVILEGES
ON TABLE
    public.ambassadors,
    public.pagos_ambassadors,
    public.logs_locales
FROM anon, authenticated;

-- Comprobación de privilegios efectivos.
-- Si queda algún permiso, abortar la transacción.
DO $$
DECLARE
    t text;
    r text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'ambassadors',
        'pagos_ambassadors',
        'logs_locales'
    ]
    LOOP
        FOREACH r IN ARRAY ARRAY[
            'anon',
            'authenticated'
        ]
        LOOP
            IF has_table_privilege(
                r, 'public.' || t, 'SELECT'
            )
            OR has_table_privilege(
                r, 'public.' || t, 'INSERT'
            )
            OR has_table_privilege(
                r, 'public.' || t, 'UPDATE'
            )
            OR has_table_privilege(
                r, 'public.' || t, 'DELETE'
            )
            THEN
                RAISE EXCEPTION
                    'Permisos restantes: tabla %, rol %',
                    t, r;
            END IF;
        END LOOP;
    END LOOP;
END $$;

COMMIT;
