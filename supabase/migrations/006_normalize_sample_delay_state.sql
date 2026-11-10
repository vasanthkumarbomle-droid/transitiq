-- Normalize the sample delay label and minutes.
update public.bus_locations
set live_status = 'Delayed', delay_minutes = 4
where bus_id = 'bus-02';

update public.bus_locations
set delay_minutes = 0
where live_status <> 'Delayed' and delay_minutes <> 0;
