-- ==============================================================================
-- Migration 003: Create Payment Events Table with Reconciliation Trigger
-- Location: supabase/migrations/003_create_payment_events_table.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer')),
    notes TEXT DEFAULT '',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON public.payment_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON public.payment_events(job_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_at ON public.payment_events(recorded_at DESC);

-- Automatic job balance update trigger upon payment insertion
CREATE OR REPLACE FUNCTION public.handle_payment_event_inserted()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC(12, 2);
    v_agreed NUMERIC(12, 2);
BEGIN
    -- Sum all payments for this job
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
    FROM public.payment_events
    WHERE job_id = NEW.job_id;

    -- Get agreed amount
    SELECT agreed_amount INTO v_agreed
    FROM public.jobs
    WHERE id = NEW.job_id;

    -- Update job paid amount and status deterministically
    UPDATE public.jobs
    SET 
        amount_paid = v_total_paid,
        status = CASE 
            WHEN v_total_paid >= v_agreed THEN 'completed'
            WHEN v_total_paid > 0 THEN 'partially_paid'
            ELSE 'pending'
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.job_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_payment_event_insert ON public.payment_events;
CREATE TRIGGER after_payment_event_insert
AFTER INSERT ON public.payment_events
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_event_inserted();

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own payments" ON public.payment_events;
CREATE POLICY "Users can read own payments"
ON public.payment_events FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payment_events;
CREATE POLICY "Users can insert own payments"
ON public.payment_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own payments" ON public.payment_events;
CREATE POLICY "Users can delete own payments"
ON public.payment_events FOR DELETE TO authenticated
USING (auth.uid() = owner_id);
