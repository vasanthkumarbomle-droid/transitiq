-- Remove capitalized baseline ALL policies after replacing them with command-specific admin policies.
drop policy if exists "Admins manage stops" on public.stops;
drop policy if exists "Admins manage routes" on public.routes;
drop policy if exists "Admins manage buses" on public.buses;
drop policy if exists "Admins manage route stops" on public.route_stops;
drop policy if exists "Admins manage route buses" on public.route_buses;
drop policy if exists "Admins manage fare settings" on public.fare_settings;
drop policy if exists "Admins manage bus locations" on public.bus_locations;
