-- ==============================================================================
-- Migration 005: Create Audit Events Table
-- Location: supabase/migrations/005_create_audit_events_table.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_owner_id ON public.audit_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_events(created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit events" ON public.audit_events;
CREATE POLICY "Users can read own audit events"
ON public.audit_events FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own audit events" ON public.audit_events;
CREATE POLICY "Users can insert own audit events"
ON public.audit_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);
