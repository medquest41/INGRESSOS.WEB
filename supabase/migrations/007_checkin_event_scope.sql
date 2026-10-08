-- Check-in separado por evento; mantem a validacao atomica existente.
begin;
create or replace function public.check_in_event(ticket_code uuid,expected_event uuid) returns text
language plpgsql security definer set search_path='' as $$
declare actual_event uuid;begin
 if expected_event is null or not public.can_access_event(expected_event,array['admin','organizador','checkin']) then return 'forbidden';end if;
 select o.event_id into actual_event from public.tickets t join public.orders o on o.id=t.order_id where t.code=ticket_code;
 if actual_event is null then return 'invalid';end if;
 if actual_event<>expected_event then return 'wrong_event';end if;
 return public.check_in(ticket_code);
end$$;
revoke all on function public.check_in_event(uuid,uuid) from public,anon;
grant execute on function public.check_in_event(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
