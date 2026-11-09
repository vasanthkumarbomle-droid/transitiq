-- TRANSITIQ competition build: persistent bus simulation + Realtime
-- Safe additive migration. Does not replace existing production records.

alter table public.routes
  add column if not exists color text not null default '#0f766e';

alter table public.buses
  drop constraint if exists buses_bus_type_check;

alter table public.buses
  add constraint buses_bus_type_check
  check (bus_type in ('Ordinary', 'Express', 'AC', 'Electric'));

alter table public.bus_locations
  add column if not exists current_stop_sequence integer not null default 1,
  add column if not exists previous_stop_sequence integer not null default 1,
  add column if not exists occupancy integer not null default 0,
  add column if not exists delay_minutes integer not null default 0,
  add column if not exists live_status text not null default 'On Time';

alter table public.bus_locations
  drop constraint if exists bus_locations_live_status_check;

alter table public.bus_locations
  add constraint bus_locations_live_status_check
  check (live_status in ('On Time', 'Delayed', 'Arriving'));

alter table public.bus_locations
  drop constraint if exists bus_locations_occupancy_check;

alter table public.bus_locations
  add constraint bus_locations_occupancy_check
  check (occupancy >= 0);

create index if not exists bus_locations_updated_idx
  on public.bus_locations(last_updated desc);

-- Demo records stay separate from operator/real data.
insert into public.buses
  (id, registration_number, name, bus_type, capacity, driver_name,
   assigned_route_id, status, data_source, source_ref)
values
  ('demo-bus-101', 'TS09 DEMO 101', 'City Loop 101', 'Ordinary', 52,
   'DEMO FLEET', 'rt-101', 'Active', 'demo', 'transitiq/demo/101'),
  ('demo-bus-208', 'TS09 DEMO 208', 'North-West Express', 'AC', 42,
   'DEMO FLEET', 'rt-208', 'Active', 'demo', 'transitiq/demo/208'),
  ('demo-bus-315', 'TS09 DEMO 315', 'Campus Connector', 'Electric', 40,
   'DEMO FLEET', 'rt-315', 'Active', 'demo', 'transitiq/demo/315'),
  ('demo-bus-412', 'TS09 DEMO 412', 'Tech Park Link', 'Express', 48,
   'DEMO FLEET', 'rt-412', 'Active', 'demo', 'transitiq/demo/412')
on conflict (id) do update set
  registration_number = excluded.registration_number,
  name = excluded.name,
  bus_type = excluded.bus_type,
  capacity = excluded.capacity,
  assigned_route_id = excluded.assigned_route_id,
  status = excluded.status,
  data_source = excluded.data_source,
  source_ref = excluded.source_ref;

insert into public.bus_locations
  (bus_id, latitude, longitude, simulated_speed, simulation_status,
   current_stop_sequence, previous_stop_sequence, occupancy,
   live_status, delay_minutes, last_updated)
values
  ('demo-bus-101', 17.5927, 78.4314, 27, 'paused', 2, 1, 23, 'On Time', 0, now()),
  ('demo-bus-208', 17.4933, 78.3912, 32, 'paused', 4, 3, 31, 'Arriving', 0, now()),
  ('demo-bus-315', 17.5044, 78.4893, 25, 'paused', 3, 2, 18, 'On Time', 0, now()),
  ('demo-bus-412', 17.4494, 78.3808, 29, 'paused', 4, 3, 38, 'Delayed', 4, now())
on conflict (bus_id) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  simulated_speed = excluded.simulated_speed,
  current_stop_sequence = excluded.current_stop_sequence,
  previous_stop_sequence = excluded.previous_stop_sequence,
  occupancy = excluded.occupancy,
  live_status = excluded.live_status,
  delay_minutes = excluded.delay_minutes;

-- Public callers can only advance/pause the isolated demo fleet.
create or replace function public.set_demo_simulation(p_enabled boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  update public.bus_locations bl
  set
    simulation_status = case when p_enabled then 'running' else 'paused' end,
    last_updated = case when p_enabled then now() else bl.last_updated end
  from public.buses b
  where b.id = bl.bus_id
    and b.data_source = 'demo';

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

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
  v_changed integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('transitiq_demo_simulator'));

  for v_bus in
    select
      b.id as bus_id,
      b.assigned_route_id,
      b.capacity,
      bl.current_stop_sequence,
      bl.occupancy
    from public.buses b
    join public.bus_locations bl on bl.bus_id = b.id
    where b.data_source = 'demo'
      and b.status = 'Active'
      and bl.simulation_status = 'running'
      and bl.last_updated < now() - interval '4 seconds'
  loop
    select max(sequence_number)
      into v_max_sequence
      from public.route_stops
      where route_id = v_bus.assigned_route_id;

    if coalesce(v_max_sequence, 0) < 1 then
      continue;
    end if;

    v_next_sequence := case
      when v_bus.current_stop_sequence >= v_max_sequence then 1
      else v_bus.current_stop_sequence + 1
    end;

    select s.latitude, s.longitude, s.name
      into v_stop
      from public.route_stops rs
      join public.stops s on s.id = rs.stop_id
      where rs.route_id = v_bus.assigned_route_id
        and rs.sequence_number = v_next_sequence
      limit 1;

    if not found then
      continue;
    end if;

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
        when random() < 0.12 then 'Delayed'
        when random() < 0.35 then 'Arriving'
        else 'On Time'
      end,
      delay_minutes = case
        when random() < 0.12 then 2 + floor(random() * 7)::integer
        else 0
      end,
      last_updated = now()
    where bus_id = v_bus.bus_id;

    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;

revoke all on function public.set_demo_simulation(boolean) from public;
revoke all on function public.advance_demo_buses() from public;
grant execute on function public.set_demo_simulation(boolean) to anon, authenticated;
grant execute on function public.advance_demo_buses() to anon, authenticated;

-- Realtime feeds the map and passenger cards. Keep public writes restricted by RLS.
alter table public.bus_locations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bus_locations'
  ) then
    alter publication supabase_realtime add table public.bus_locations;
  end if;
end;
$$;
