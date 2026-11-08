-- TRANSITIQ | Project No. 13 | Student Roll No. 513
-- Passenger roles may read network data; only authenticated admin allowlist users write.
alter table public.stops enable row level security;
alter table public.routes enable row level security;
alter table public.buses enable row level security;
alter table public.route_stops enable row level security;
alter table public.route_buses enable row level security;
alter table public.fare_settings enable row level security;
alter table public.bus_locations enable row level security;
alter table public.journey_searches enable row level security;
alter table public.admin_users enable row level security;
drop policy if exists "public demo manage stops" on public.stops;
drop policy if exists "public demo manage routes" on public.routes;
drop policy if exists "public demo manage buses" on public.buses;
drop policy if exists "public demo manage route_stops" on public.route_stops;
drop policy if exists "public demo manage route_buses" on public.route_buses;
drop policy if exists "public demo manage fare_settings" on public.fare_settings;
drop policy if exists "public demo manage bus_locations" on public.bus_locations;
create index if not exists idx_route_stops_route_sequence on public.route_stops(route_id,sequence_number);
create index if not exists idx_route_stops_stop on public.route_stops(stop_id);
create index if not exists idx_buses_assigned_route on public.buses(assigned_route_id);
create index if not exists idx_buses_status on public.buses(status);
create index if not exists idx_journey_searches_searched_at on public.journey_searches(searched_at desc);
