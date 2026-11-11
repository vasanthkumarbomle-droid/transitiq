import {useEffect,useMemo,useState} from 'react';
import L from 'leaflet';
import {MapContainer,TileLayer,Polyline,Marker,Popup,useMap} from 'react-leaflet';
import {BusFront,MapPin,Navigation,Route as RouteIcon} from 'lucide-react';
import type {Stop,TransitRoute,TransitBus,RouteStop,BusLocation} from '../lib/transit';

type Props={stops:Stop[];routes:TransitRoute[];buses:TransitBus[];routeStops:RouteStop[];locations:BusLocation[];selectedRouteId?:string;sourceId?:string;destinationId?:string;compact?:boolean};
type AnimatedBus={id:string;registrationNumber:string;lat:number;lng:number;nextName:string;routeName:string;status:string;delay:number;occupancy:number;capacity:number;type:string;source:string};

function routePoints(route:TransitRoute,routeStops:RouteStop[],stops:Stop[]){
 return routeStops.filter(x=>x.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number).map(x=>stops.find(s=>s.id===x.stop_id)).filter((s):s is Stop=>!!s);
}
function routesAtStop(stopId:string,routes:TransitRoute[],routeStops:RouteStop[]){
 const routeIds=new Set(routeStops.filter(entry=>entry.stop_id===stopId).map(entry=>entry.route_id));
 return routes.filter(route=>routeIds.has(route.id)).sort((a,b)=>a.route_number.localeCompare(b.route_number,undefined,{numeric:true}));
}
function stopSourceLabel(stop:Stop){
 const source=(stop.data_source||'').toLowerCase();
 if(source.includes('openstreetmap')||source==='osm')return 'OpenStreetMap';
 if(source.includes('gtfs'))return 'GTFS import';
 if(source.includes('manual'))return 'Manually registered';
 return 'Project sample / saved stop';
}
function stopMapsUrl(stop:Stop){
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(stop.latitude+','+stop.longitude);
}
function openStreetMapUrl(stop:Stop){
 return 'https://www.openstreetmap.org/?mlat='+stop.latitude+'&mlon='+stop.longitude+'#map=18/'+stop.latitude+'/'+stop.longitude;
}
function stopIcon(kind:'default'|'source'|'destination'){
 const selected=kind!=='default';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="46" viewBox="0 0 40 46"><path d="M20 2C9.5 2 2 9.8 2 20c0 12.4 18 24 18 24s18-11.6 18-24C38 9.8 30.5 2 20 2Z" fill="'+(kind==='source'?'#2563eb':kind==='destination'?'#16a34a':'#0f766e')+'" stroke="#fff" stroke-width="2.2"/><circle cx="20" cy="19" r="11.5" fill="#fff"/><path d="M12.5 15.5c0-1.3 1-2.3 2.3-2.3h10.4c1.3 0 2.3 1 2.3 2.3v8.8c0 .9-.7 1.6-1.6 1.6h-.7v1.5h-2v-1.5h-6.4v1.5h-2v-1.5h-.7c-.9 0-1.6-.7-1.6-1.6v-8.8Zm2.2-.2v5h10.6v-5H14.7Zm1.2 7.1a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Zm8.2 0a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z" fill="#0f766e"/></svg>';
 return L.divIcon({className:'tiq-leaflet-stop-icon',html:'<div class="tiq-stop-marker '+(selected?'is-selected':'')+'">'+svg+'</div>',iconSize:[40,46],iconAnchor:[20,43],popupAnchor:[0,-39]});
}
function FitMap({points}:{points:Stop[]}){
 const map=useMap();
 useEffect(()=>{
  if(points.length>1)map.flyToBounds(L.latLngBounds(points.map(p=>[p.latitude,p.longitude])),{padding:[35,35],duration:.7,maxZoom:14});
  else if(points.length===1)map.flyTo([points[0].latitude,points[0].longitude],15,{duration:.7});
 },[map,points]);
 return null;
}
export default function OpenStreetMapTransitMap({stops,routes,buses,routeStops,locations,selectedRouteId,sourceId,destinationId,compact=false}:Props){
 const [frame,setFrame]=useState(Date.now());
 useEffect(()=>{
  const timer=window.setInterval(()=>setFrame(Date.now()),100);
  return()=>window.clearInterval(timer);
 },[]);
 const mapStops=useMemo(()=>stops.filter(stop=>Number.isFinite(Number(stop.latitude))&&Number.isFinite(Number(stop.longitude))&&Math.abs(stop.latitude)<=90&&Math.abs(stop.longitude)<=180),[stops]);
 const selectedRoute=routes.find(r=>r.id===selectedRouteId);
 const focusedPoints=useMemo(()=>{
  if(selectedRoute)return routePoints(selectedRoute,routeStops,mapStops);
  if(sourceId||destinationId)return mapStops.filter(s=>s.id===sourceId||s.id===destinationId);
  return [];
 },[selectedRoute,routeStops,mapStops,sourceId,destinationId]);
 const animated=useMemo<AnimatedBus[]>(()=>{
  return buses.filter(b=>b.status==='Active').flatMap(bus=>{
   const loc=locations.find(l=>l.bus_id===bus.id);
   if(!loc)return [];
   const route=routes.find(r=>r.id===bus.assigned_route_id);
   const ordered=route?routeStops.filter(s=>s.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number):[];
   const currentIndex=ordered.findIndex(s=>s.sequence_number===loc.current_stop_sequence);
   const current=currentIndex>=0?ordered[currentIndex]:undefined;
   const previous=ordered.find(s=>s.sequence_number===loc.previous_stop_sequence);
   const currentStop=current?mapStops.find(s=>s.id===current.stop_id):undefined;
   const previousStop=previous?mapStops.find(s=>s.id===previous.stop_id):undefined;
   const nextStop=currentIndex>=0&&ordered.length?mapStops.find(s=>s.id===ordered[(currentIndex+1)%ordered.length]?.stop_id):undefined;
   const simulated=bus.data_source==='demo'||loc.simulation_status==='running'||loc.simulation_status==='simulated';
   const updatedAt=new Date(loc.last_updated).getTime();
   const elapsed=Number.isFinite(updatedAt)?Math.max(0,frame-updatedAt):5000;
   const t=Math.min(1,elapsed/5000);
   const from=previousStop||currentStop;
   const hasRoutePosition=!!from&&!!currentStop;
   const lat=simulated&&hasRoutePosition?from.latitude+(currentStop.latitude-from.latitude)*t:Number(loc.latitude);
   const lng=simulated&&hasRoutePosition?from.longitude+(currentStop.longitude-from.longitude)*t:Number(loc.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return [];
   return [{id:bus.id,registrationNumber:bus.registration_number,lat,lng,nextName:nextStop?.name||'Not available',routeName:route?.name||'Route not assigned',status:loc.live_status,delay:loc.delay_minutes,occupancy:loc.occupancy,capacity:bus.capacity,type:bus.bus_type,source:simulated?'Simulated position':'Saved location record'}];
  });
 },[buses,locations,routes,routeStops,mapStops,frame]);
 const mapHeight=compact?350:490;
 return <div className="transit-map-shell">
  <MapContainer center={[17.49,78.43]} zoom={11} scrollWheelZoom className="transit-map" style={{height:mapHeight}}>
   <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
   <FitMap points={focusedPoints}/>
   {routes.filter(r=>r.status==='Active').map(route=>{
    const pts=routePoints(route,routeStops,mapStops).map(s=>[s.latitude,s.longitude] as [number,number]);
    if(pts.length<2)return null;
    const chosen=route.id===selectedRouteId;
    return <Polyline key={route.id} positions={pts} pathOptions={{color:chosen?'#0f766e':(route.color||'#0f766e'),weight:chosen?8:4,opacity:chosen?1:.56,dashArray:chosen?undefined:'8 8'}}/>;
   })}
   {mapStops.map(stop=>{
    const kind=stop.id===sourceId?'source':stop.id===destinationId?'destination':'default';
    const stopRoutes=routesAtStop(stop.id,routes,routeStops);
    return <Marker key={stop.id} position={[stop.latitude,stop.longitude]} title={stop.name} icon={stopIcon(kind)} riseOnHover>
     <Popup className="tiq-stop-leaflet-popup" minWidth={245} maxWidth={310}>
      <div className="tiq-stop-popup">
       <div className="tiq-stop-popup-head"><span className="tiq-stop-popup-symbol"><BusFront size={17}/></span><div><strong>{stop.name}</strong><small>{stop.area||'Mapped bus stop'}</small></div></div>
       <div className="tiq-stop-badges"><span>{kind==='source'?'BOARDING STOP':kind==='destination'?'DESTINATION':'BUS STOP'}</span><span>{stopSourceLabel(stop)}</span></div>
       {stop.landmark&&<div className="tiq-stop-landmark"><MapPin size={13}/><span>Near {stop.landmark}</span></div>}
       <div className="tiq-stop-coordinate"><MapPin size={14}/><div><b>Saved map coordinates</b><span>{stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</span></div></div>
       <div className="tiq-stop-routes"><b><RouteIcon size={13}/> Routes serving this stop</b>
        {stopRoutes.length?<div>{stopRoutes.map(route=><span key={route.id}>{route.route_number} · {route.name}</span>)}</div>:<small>No route sequence is linked to this stop yet.</small>}
       </div>
       <div className="tiq-stop-map-actions"><a href={stopMapsUrl(stop)} target="_blank" rel="noreferrer">Open in Google Maps <Navigation size={12}/></a><a href={openStreetMapUrl(stop)} target="_blank" rel="noreferrer">OpenStreetMap</a></div>
       {(stop.shelter_available||stop.wheelchair_accessible)&&<div className="tiq-stop-access">{stop.shelter_available&&<span>Covered shelter</span>}{stop.wheelchair_accessible&&<span>Wheelchair accessible</span>}</div>}
      </div>
     </Popup>
    </Marker>;
   })}
   {animated.map(bus=><Marker key={bus.id} position={[bus.lat,bus.lng]} title={bus.registrationNumber} icon={L.divIcon({className:'transit-bus-icon',html:'<div class="transit-bus-glyph">BUS</div>',iconSize:[38,25],iconAnchor:[19,12]})}>
    <Popup>
     <div className="bus-popup">
      <strong>{bus.registrationNumber}</strong>
      <span>{bus.type} · {bus.routeName}</span>
      <span>{bus.source}</span>
      <span>Next stop: {bus.nextName}</span>
      <span>Status: {bus.status}{bus.delay? ` · +${bus.delay} min`:''}</span>
      <span>Occupancy: {bus.occupancy}/{bus.capacity}</span>
     </div>
    </Popup>
   </Marker>)}
  </MapContainer>
  <div className="map-attribution-note">Tap any bus-stop symbol to view its mapped location, serving routes and map links. © OpenStreetMap contributors · Bus movement is simulated unless a verified live feed is connected.</div>
 </div>;
}
