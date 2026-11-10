-- TRANSITIQ: consistent randomized delay status and minutes.
create or replace function public.advance_demo_buses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bus record;
  v_max_sequence integer;
  v_next_sequence integer;
  v_stop record;
  v_roll double precision;
  v_changed integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('transitiq_demo_simulator'));

  for v_bus in
    select b.id as bus_id, b.assigned_route_id, b.capacity,
           bl.current_stop_sequence, bl.occupancy
    from public.buses b
    join public.bus_locations bl on bl.bus_id = b.id
    where b.data_source = 'demo'
      and b.status = 'Active'
      and bl.simulation_status = 'running'
      and bl.last_updated < now() - interval '4 seconds'
  loop
    select max(sequence_number) into v_max_sequence
    from public.route_stops where route_id = v_bus.assigned_route_id;

    if coalesce(v_max_sequence, 0) < 1 then continue; end if;

    v_next_sequence := case
      when v_bus.current_stop_sequence >= v_max_sequence then 1
      else v_bus.current_stop_sequence + 1
    end;

    select s.latitude, s.longitude, s.name into v_stop
    from public.route_stops rs
    join public.stops s on s.id = rs.stop_id
    where rs.route_id = v_bus.assigned_route_id
      and rs.sequence_number = v_next_sequence
    limit 1;

    if not found then continue; end if;

    v_roll := random();

    update public.bus_locations
    set
      previous_stop_sequence = v_bus.current_stop_sequence,
      current_stop_sequence = v_next_sequence,
      latitude = v_stop.latitude,
      longitude = v_stop.longitude,
      occupancy = case
        when lower(v_stop.name) similar to '%(jntu|hitech|gachibowli|miyapur|secunderabad)%'
          then least(v_bus.capacity, v_bus.occupancy + 2 + floor(random() * 6)::integer)
        else greatest(0, v_bus.occupancy - floor(random() * 5)::integer)
      end,
      live_status = case
        when v_roll < 0.12 then 'Delayed'
        when v_roll < 0.35 then 'Arriving'
        else 'On Time'
      end,
      delay_minutes = case
        when v_roll < 0.12 then 2 + floor(random() * 7)::integer
        else 0
      end,
      last_updated = now()
    where bus_id = v_bus.bus_id;

    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke all on function public.advance_demo_buses() from public;
grant execute on function public.advance_demo_buses() to anon, authenticated;
