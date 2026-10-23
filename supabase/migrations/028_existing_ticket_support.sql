-- Incremental: no tickets, orders, QR codes or payments are created or altered.
-- Requires audited 027. Apply once after explicit approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$begin
 if to_regprocedure('public.verified_customer_email()') is null or to_regclass('public.ticket_shares') is null then raise exception 'Pré-requisito de compartilhamento seguro ausente';end if;
end$$;
create function public.create_admin_ticket_share(ticket_code uuid) returns text
language plpgsql security definer set search_path='' as $$
declare t public.tickets;o public.orders;token text;
begin
 select * into t from public.tickets where code=ticket_code;
 select * into o from public.orders where id=t.order_id;
 if auth.uid() is null or o.id is null or not coalesce(public.can_access_event(o.event_id,array['admin','organizador']),false)
 or o.status<>'approved' or o.payment_review or t.cancelled or t.used_at is not null then
  raise exception 'Ingresso indisponível para reenvio';
 end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.ticket_shares(secret,ticket_id,expires_at,created_by) values(token,t.id,now()+interval '24 hours',auth.uid());
 return token;
end$$;
revoke all on function public.create_admin_ticket_share(uuid) from public,anon,authenticated;
grant execute on function public.create_admin_ticket_share(uuid) to authenticated;
-- Only a verified, non-anonymous account matching the purchase email can recover it.
-- The verified_customer_email helper also checks that the profile is active.
create policy confirmed_email_order_recovery_028 on public.orders for select to authenticated
using(status='approved' and not payment_review and lower(buyer->>'email')=public.verified_customer_email());
commit;
