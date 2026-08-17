# Supabase migrations

This app did not previously contain a database migration directory. New browser-facing
database contracts live in `supabase/migrations` and must be applied through the normal
Supabase migration workflow before deploying the matching frontend.

The canonical platform schema currently lives in the adjacent `hub-service` repository.
Keep the applied copy there and this contract migration in sync until schema ownership is
consolidated.

`supabase/tests/manual_lead_rls.sql` is a rollback-only integration test for an
ephemeral database loaded with that canonical schema. It exercises manager,
client-admin, rep, non-member, and cross-tenant requests and proves failed lead
creation leaves no contact behind.
