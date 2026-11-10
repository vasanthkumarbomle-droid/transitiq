-- Passenger-facing stop facilities and accessibility information.
alter table public.stops
  add column if not exists landmark text,
  add column if not exists shelter_available boolean not null default false,
  add column if not exists wheelchair_accessible boolean not null default false;
