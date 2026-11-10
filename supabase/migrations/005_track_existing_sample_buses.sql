-- Track the pre-existing six sample buses in the same demo simulator.
-- Imported/operator feed records remain separate from data_source='demo'.
insert into public.bus_locations
  (bus_id,latitude,longitude,simulated_speed,simulation_status,
   current_stop_sequence,previous_stop_sequence,occupancy,live_status,delay_minutes,last_updated)
select
  b.id,
  s.latitude,
  s.longitude,
  case when b.bus_type='AC' then 31 else 26 end,
  'paused',
  v.current_sequence,
  greatest(1,v.current_sequence-1),
  v.occupancy,
  v.live_status,
  v.delay_minutes,
  now()
from public.buses b
join lateral (
  select
    case b.id
      when 'bus-01' then 3
      when 'bus-02' then 6
      when 'bus-03' then 5
      when 'bus-04' then 2
      when 'bus-05' then 4
      when 'bus-06' then 3
      else 1
    end as current_sequence,
    case b.id
      when 'bus-01' then 34
      when 'bus-02' then 23
      when 'bus-03' then 18
      when 'bus-04' then 43
      when 'bus-05' then 27
      else 17
    end as occupancy,
    case b.id when 'bus-04' then 'Arriving' else 'On Time' end as live_status,
    case b.id when 'bus-02' then 4 else 0 end as delay_minutes
) v on true
join public.route_stops rs
  on rs.route_id=b.assigned_route_id
 and rs.sequence_number=v.current_sequence
join public.stops s on s.id=rs.stop_id
left join public.bus_locations bl on bl.bus_id=b.id
where b.data_source='demo'
  and bl.bus_id is null
on conflict (bus_id) do nothing;
