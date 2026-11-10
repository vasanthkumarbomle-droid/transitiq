-- TransitIQ: route operating hours and frequency-based service timetable.
alter table public.routes
  add column if not exists service_start_time time not null default '06:00',
  add column if not exists service_end_time time not null default '22:00',
  add column if not exists headway_minutes integer not null default 30,
  add column if not exists operating_days text[] not null
    default array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[];

alter table public.routes
  drop constraint if exists routes_headway_minutes_check;

alter table public.routes
  add constraint routes_headway_minutes_check
  check (headway_minutes between 5 and 240);

alter table public.routes
  drop constraint if exists routes_service_window_check;

alter table public.routes
  add constraint routes_service_window_check
  check (service_end_time > service_start_time);

alter table public.routes
  drop constraint if exists routes_operating_days_check;

alter table public.routes
  add constraint routes_operating_days_check
  check (
    cardinality(operating_days) between 1 and 7
    and operating_days <@ array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
  );

update public.routes
set
  service_start_time = case route_number
    when '101' then '05:30'::time
    when '208' then '06:00'::time
    when '315' then '06:30'::time
    when '412' then '07:00'::time
    else service_start_time
  end,
  service_end_time = case route_number
    when '101' then '22:30'::time
    when '208' then '22:00'::time
    when '315' then '21:30'::time
    when '412' then '22:00'::time
    else service_end_time
  end,
  headway_minutes = case route_number
    when '101' then 20
    when '208' then 25
    when '315' then 30
    when '412' then 30
    else headway_minutes
  end,
  operating_days = array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[]
where data_source = 'demo';
