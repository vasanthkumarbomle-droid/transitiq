-- TRANSITIQ sample electric fare and route colors.
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
