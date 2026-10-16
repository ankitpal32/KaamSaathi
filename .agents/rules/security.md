# KaamSaathi Security Rules

1. **Zero Secret Exposure**:
   - Never write database passwords, service-role keys, or Bolna/Gemini API keys into frontend code or client bundles.
   - All `.env` files must be excluded from version control via `.gitignore`.
2. **Identity Derivation**:
   - Never accept an `owner_id` or user ID passed in the request body. Derive identity exclusively from verified Supabase Bearer JWTs (`auth.uid()`).
3. **Database Row Level Security (RLS)**:
   - RLS must be enabled on every table containing user or business data.
   - Never use `USING (true)` policies for authenticated paths.
4. **Data Privacy**:
   - Avoid logging sensitive customer details (phone numbers, full addresses) in server console logs.
