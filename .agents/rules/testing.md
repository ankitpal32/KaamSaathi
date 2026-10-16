# KaamSaathi Testing Rules

1. **Mandatory Verification**:
   - Run `npm run lint` (`tsc --noEmit`) and `pytest backend/tests/ -v` after every code modification.
2. **Never Fake Test Results**:
   - Do not claim a test passed without running it.
   - Do not claim cloud persistence works unless tested against an active Supabase instance.
3. **Endpoint Test Coverage**:
   - Every new route must have unit test coverage verifying unauthenticated rejection, invalid payload rejection, and expected success responses.
