-- Illustrative Hyderabad network; safe to re-run by stable IDs.
insert into public.stops(id,name,area,latitude,longitude) values
('st-mlrit','MLR Institute of Technology','Dundigal',17.5927,78.4314),('st-dundigal','Dundigal','Medchal',17.5982,78.4525),('st-bowrampet','Bowrampet','Dundigal',17.5689,78.4241),('st-bachupally','Bachupally','Quthbullapur',17.5484,78.3762),('st-miyapur','Miyapur','Serilingampally',17.4967,78.3631),('st-jntu','JNTU','Kukatpally',17.4933,78.3912),('st-suchitra','Suchitra Junction','Suchitra',17.5044,78.4893),('st-kompally','Kompally','Quthbullapur',17.5401,78.4867),('st-secunderabad','Secunderabad','Secunderabad',17.4399,78.4983),('st-kukatpally','Kukatpally','Kukatpally',17.4849,78.4138),('st-hitech','Hitech City','Madhapur',17.4494,78.3808),('st-gachibowli','Gachibowli','Serilingampally',17.4401,78.3489),('st-kphb','KPHB Colony','Kukatpally',17.4931,78.4011),('st-begumpet','Begumpet','Begumpet',17.4448,78.4662)
on conflict(id) do nothing;
insert into public.routes(id,route_number,name,average_speed,status) values
('rt-101','101','Dundigal – JNTU Connector',27,'Active'),('rt-208','208','Suchitra – Gachibowli Express',32,'Active'),('rt-315','315','MLRIT – Hitech City via Suchitra',25,'Active'),('rt-412','412','KPHB – Gachibowli City Link',29,'Active')
on conflict(id) do nothing;
insert into public.buses(id,registration_number,name,bus_type,capacity,driver_name,assigned_route_id,status) values
('bus-01','TS 09 TX 5101','Dundigal Express','Ordinary',52,'R. Prakash','rt-101','Active'),('bus-02','TS 09 TX 5102','Campus Link','Express',42,'S. Ramesh','rt-101','Active'),('bus-03','TS 09 TX 5208','City Connect','AC',36,'M. Naveen','rt-208','Active'),('bus-04','TS 09 TX 5209','North-West Link','Ordinary',55,'K. Arjun','rt-208','Active'),('bus-05','TS 09 TX 5315','MLR City Rider','Express',44,'P. Kiran','rt-315','Active'),('bus-06','TS 09 TX 5412','Tech Park Shuttle','AC',32,'A. Teja','rt-412','Maintenance')
on conflict(id) do nothing;
insert into public.route_stops(route_id,stop_id,sequence_number,distance_from_previous_km) values
('rt-101','st-dundigal',1,0),('rt-101','st-mlrit',2,3.2),('rt-101','st-bowrampet',3,4.1),('rt-101','st-bachupally',4,3.8),('rt-101','st-miyapur',5,3.6),('rt-101','st-jntu',6,4.4),
('rt-208','st-suchitra',1,0),('rt-208','st-kompally',2,4.3),('rt-208','st-secunderabad',3,8.4),('rt-208','st-jntu',4,7.2),('rt-208','st-kukatpally',5,3.1),('rt-208','st-hitech',6,6.5),('rt-208','st-gachibowli',7,5.2),
('rt-315','st-mlrit',1,0),('rt-315','st-dundigal',2,3.2),('rt-315','st-suchitra',3,8.9),('rt-315','st-begumpet',4,8.6),('rt-315','st-jntu',5,7.4),('rt-315','st-hitech',6,6.5),
('rt-412','st-kphb',1,0),('rt-412','st-jntu',2,1.7),('rt-412','st-kukatpally',3,2.9),('rt-412','st-hitech',4,6.5),('rt-412','st-gachibowli',5,5.2)
on conflict(route_id,sequence_number) do nothing;
insert into public.fare_settings(bus_type,rate_per_km,minimum_fare) values('Ordinary',1.5,10),('Express',2,15),('AC',3,20) on conflict(bus_type) do nothing;
