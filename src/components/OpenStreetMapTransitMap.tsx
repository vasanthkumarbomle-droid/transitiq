import {useEffect,useMemo,useState} from 'react';
import L from 'leaflet';
import {MapContainer,TileLayer,Polyline,CircleMarker,Marker,Popup,useMap} from 'react-leaflet';
import type {Stop,TransitRoute,TransitBus,RouteStop,BusLocation} from '../lib/transit';

type Props={stops:Stop[];routes:TransitRoute[];buses:TransitBus[];routeStops:RouteStop[];locations:BusLocation[];selectedRouteId?:string;sourceId?:string;destinationId?:string;compact?:boolean};
type AnimatedBus={id:string;registrationNumber:string;lat:number;lng:number;previous?:[number,number];nextName:string;routeName:string;status:string;delay:number;occupancy:number;capacity:number;type:string;source:string};

function routePoints(route:TransitRoute,routeStops:RouteStop[],stops:Stop[]){
 return routeStops.filter(x=>x.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number).map(x=>stops.find(s=>s.id===x.stop_id)).filter((s):s is Stop=>!!s);
}
function FitMap({points}:{points:Stop[]}){
 const map=useMap();
 useEffect(()=>{
  if(points.length>1)map.flyToBounds(L.latLngBounds(points.map(p=>[p.latitude,p.longitude])),{padding:[35,35],duration:.7,maxZoom:14});
  else if(points.length===1)map.flyTo([points[0].latitude,points[0].longitude],14,{duration:.7});
 },[map,points]);
 return null;
}
export default function OpenStreetMapTransitMap({stops,routes,buses,routeStops,locations,selectedRouteId,sourceId,destinationId,compact=false}:Props){
 const [frame,setFrame]=useState(Date.now());
 useEffect(()=>{
  const timer=window.setInterval(()=>setFrame(Date.now()),100);
  return()=>window.clearInterval(timer);
 },[]);
 const selectedRoute=routes.find(r=>r.id===selectedRouteId);
 const focusedPoints=useMemo(()=>{
  if(selectedRoute)return routePoints(selectedRoute,routeStops,stops);
  if(sourceId||destinationId)return stops.filter(s=>s.id===sourceId||s.id===destinationId);
  return [];
 },[selectedRoute,routeStops,stops,sourceId,destinationId]);
 const animated=useMemo<AnimatedBus[]>(()=>{
  return buses.filter(b=>b.status==='Active').flatMap(bus=>{
   const loc=locations.find(l=>l.bus_id===bus.id);
   if(!loc)return [];
   const route=routes.find(r=>r.id===bus.assigned_route_id);
   const ordered=route?routeStops.filter(s=>s.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number):[];
   const current=ordered.find(s=>s.sequence_number===loc.current_stop_sequence);
   const previous=ordered.find(s=>s.sequence_number===loc.previous_stop_sequence);
   const currentStop=current?stops.find(s=>s.id===current.stop_id):undefined;
   const previousStop=previous?stops.find(s=>s.id===previous.stop_id):undefined;
   const nextIndex=ordered.length?(ordered.findIndex(s=>s.sequence_number===loc.current_stop_sequence)+1)%ordered.length:-1;
   const nextStop=nextIndex>=0?stops.find(s=>s.id===ordered[nextIndex]?.stop_id):undefined;
   const updatedAt=new Date(loc.last_updated).getTime();
   const elapsed=Number.isFinite(updatedAt)?Math.max(0,frame-updatedAt):5000;
   const t=Math.min(1,elapsed/5000);
   const from=previousStop||currentStop;
   const hasRoutePosition=!!from&&!!currentStop;
   const lat=hasRoutePosition?from.latitude+(currentStop.latitude-from.latitude)*t:Number(loc.latitude);
   const lng=hasRoutePosition?from.longitude+(currentStop.longitude-from.longitude)*t:Number(loc.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lng))return [];
   return [{id:bus.id,registrationNumber:bus.registration_number,lat,lng,nextName:nextStop?.name||'Not available',routeName:route?.name||'Route not assigned',status:loc.live_status,delay:loc.delay_minutes,occupancy:loc.occupancy,capacity:bus.capacity,type:bus.bus_type,source:bus.data_source==='demo'?'Simulated demo':'Saved location'}];
  });
 },[buses,locations,routes,routeStops,stops,frame]);
 const mapHeight=compact?350:490;
 return <div className="transit-map-shell">
  <MapContainer center={[17.49,78.43]} zoom={11} scrollWheelZoom className="transit-map" style={{height:mapHeight}}>
   <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
   <FitMap points={focusedPoints}/>
   {routes.filter(r=>r.status==='Active').map(route=>{
    const pts=routePoints(route,routeStops,stops).map(s=>[s.latitude,s.longitude] as [number,number]);
    if(pts.length<2)return null;
    const chosen=route.id===selectedRouteId;
    return <Polyline key={route.id} positions={pts} pathOptions={{color:chosen?'#2563eb':'#0f766e',weight:chosen?8:4,opacity:chosen?1:.56,dashArray:chosen?undefined:'8 8'}}/>;
   })}
   {stops.map(stop=>{
    const isSource=stop.id===sourceId,isDestination=stop.id===destinationId;
    return <Marker key={stop.id} position={[stop.latitude,stop.longitude]} icon={L.divIcon({className:'transit-stop-marker',html:`<div style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:${isSource?'#2563eb':isDestination?'#16a34a':'#ffffff'};border:2px solid ${isSource?'#1d4ed8':isDestination?'#15803d':'#64748b'};box-shadow:0 2px 7px #0004;font-size:17px">🚏</div>`,iconSize:[30,30],iconAnchor:[15,15]})}>
     <Popup><strong>{stop.name}</strong><br/>{stop.area||'Bus stop'}{isSource?' · Boarding stop':''}{isDestination?' · Destination':''}{stop.landmark&&<><br/>Near: {stop.landmark}</>}{stop.shelter_available&&<><br/>Covered shelter</>}{stop.wheelchair_accessible&&<><br/>Wheelchair accessible</>}</Popup>
    </Marker>;
   })}
   {animated.map(bus=><Marker key={bus.id} position={[bus.lat,bus.lng]} icon={L.divIcon({className:'transit-bus-icon',html:`<div class="transit-bus-glyph">BUS</div>`,iconSize:[38,25],iconAnchor:[19,12]})}>
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
  <div className="map-attribution-note">Map data © OpenStreetMap contributors · Demo locations are simulated; real GPS requires an authorized operator feed.</div>
 </div>;
}
