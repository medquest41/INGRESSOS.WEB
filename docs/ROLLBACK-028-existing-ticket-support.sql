-- Removes only the additions from 028; preserves all orders and original QR codes.
begin;
drop policy if exists confirmed_email_order_recovery_028 on public.orders;
drop function if exists public.create_admin_ticket_share(uuid);
commit;
-- Previously shared links retain their original 24-hour expiration and status checks.
-- No ticket/share data is deleted by rollback.
