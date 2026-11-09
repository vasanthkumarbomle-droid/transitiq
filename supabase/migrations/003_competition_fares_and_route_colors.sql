-- TRANSITIQ sample electric fare and route colors.
alter table public.fare_settings
  drop constraint if exists fare_settings_bus_type_check;

alter table public.fare_settings
  add constraint fare_settings_bus_type_check
  check (bus_type in ('Ordinary', 'Express', 'AC', 'Electric'));

insert into public.fare_settings(bus_type,rate_per_km,minimum_fare)
values ('Electric',1.75,12)
on conflict (bus_type) do nothing;

update public.routes set color = case route_number
 when '101' then '#2563eb'
 when '208' then '#0f766e'
 when '315' then '#7c3aed'
 when '412' then '#ea580c'
 else color
end
where color is null or color = '#0f766e';
