ALTER TABLE public.produtos_cache ENABLE ROW LEVEL SECURITY; 
DROP POLICY IF EXISTS "permitir_update_anon" ON public.produtos_cache; 
CREATE POLICY "permitir_update_anon" ON public.produtos_cache FOR UPDATE TO anon USING (true) WITH CHECK (true);