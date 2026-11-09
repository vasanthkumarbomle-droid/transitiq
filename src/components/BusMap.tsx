import {useEffect,useMemo,useState} from 'react';
import L from 'leaflet';
import {MapContainer,TileLayer,Polyline,CircleMarker,Marker,Popup,useMap} from 'react-leaflet';
import type {Stop,TransitRoute,TransitBus,RouteStop,BusLocation} from '../lib/transit';

type Props={stops:Stop[];routes:TransitRoute[];buses:TransitBus[];routeStops:RouteStop[];locations:BusLocation[];selectedRouteId?:string;sourceId?:string;destinationId?:string;compact?:boolean};
type AnimatedBus={id:string;lat:number;lng:number;bearing:number;previous?:[number,number];nextName:string;routeName:string;status:string;delay:number;occupancy:number;capacity:number;type:string};

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
export default function BusMap({stops,routes,buses,routeStops,locations,selectedRouteId,sourceId,destinationId,compact=false}:Props){
 const [frame,setFrame]=useState(0);
 useEffect(()=>{
  let raf=0;
  const tick=()=>{setFrame(Date.now());raf=requestAnimationFrame(tick)};
  raf=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(raf);
 },[]);
 const selectedRoute=routes.find(r=>r.id===selectedRouteId);
 const focusedPoints=useMemo(()=>{
  if(selectedRoute)return routePoints(selectedRoute,routeStops,stops);
  if(sourceId||destinationId)return stops.filter(s=>s.id===sourceId||s.id===destinationId);
  return [];
 },[selectedRoute,routeStops,stops,sourceId,destinationId]);
 const animated=useMemo<AnimatedBus[]>(()=>{
  return buses.filter(b=>b.status==='Active'&&b.data_source==='demo').flatMap(bus=>{
   const loc=locations.find(l=>l.bus_id===bus.id);
   if(!loc)return [];
   const route=routes.find(r=>r.id===bus.assigned_route_id);
   if(!route)return [];
   const ordered=routeStops.filter(s=>s.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number);
   const current=ordered.find(s=>s.sequence_number===loc.current_stop_sequence);
   const previous=ordered.find(s=>s.sequence_number===loc.previous_stop_sequence);
   if(!current)return [];
   const currentStop=stops.find(s=>s.id===current.stop_id);
   const previousStop=stops.find(s=>s.id===previous?.stop_id);
   if(!currentStop)return [];
   const nextIndex=(ordered.findIndex(s=>s.sequence_number===loc.current_stop_sequence)+1)%ordered.length;
   const nextStop=stops.find(s=>s.id===ordered[nextIndex]?.stop_id);
   const elapsed=Math.max(0,frame-new Date(loc.last_updated).getTime());
   const t=Math.min(1,elapsed/5000);
   const from=previousStop||currentStop;
   const lat=from.latitude+(currentStop.latitude-from.latitude)*t;
   const lng=from.longitude+(currentStop.longitude-from.longitude)*t;
   const bearing=Math.atan2(currentStop.longitude-from.longitude,currentStop.latitude-from.latitude)*180/Math.PI;
   return [{id:bus.id,lat,lng,bearing,previous:previousStop?[previousStop.latitude,previousStop.longitude]:undefined,nextName:nextStop?.name||'Route complete',routeName:route.name,status:loc.live_status,delay:loc.delay_minutes,occupancy:loc.occupancy,capacity:bus.capacity,type:bus.bus_type}];
  });
 },[buses,locations,routes,routeStops,stops,frame]);
 const mapHeight=compact?350:490;
 return <div className="transit-map-shell">
  <MapContainer center={[17.49,78.43]} zoom={11} scrollWheelZoom className="transit-map" style={{height:mapHeight}}>
   <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
   <FitMap points={focusedPoints}/>
   {routes.filter(r=>r.status==='Active'&&r.data_source!=='demo').map(route=>{
    const pts=routePoints(route,routeStops,stops).map(s=>[s.latitude,s.longitude] as [number,number]);
    if(pts.length<2)return null;
    const chosen=route.id===selectedRouteId;
    return <Polyline key={route.id} positions={pts} pathOptions={{color:route.color||'#0f766e',weight:chosen?7:4,opacity:chosen?1:.56,dashArray:chosen?'10 9':undefined}}/>;
   })}
   {stops.filter(s=>s.data_source!=='demo').map(stop=>{
    const isSource=stop.id===sourceId,isDestination=stop.id===destinationId;
    return <CircleMarker key={stop.id} center={[stop.latitude,stop.longitude]} radius={isSource||isDestination?10:5} pathOptions={{color:'#fff',weight:2,fillColor:isSource?'#2563eb':isDestination?'#16a34a':'#64748b',fillOpacity:1}}>
     <Popup><strong>{stop.name}</strong><br/>{stop.area||'Bus stop'}{isSource?' · Boarding stop':''}{isDestination?' · Destination':''}</Popup>
    </CircleMarker>;
   })}
   {animated.map(bus=><Marker key={bus.id} position={[bus.lat,bus.lng]} icon={L.divIcon({className:'transit-bus-icon',html:`<div class="transit-bus-glyph" style="transform:rotate(${bus.bearing}deg)">🚌</div>`,iconSize:[34,34],iconAnchor:[17,17]})}>
    <Popup>
     <div className="bus-popup">
      <strong>{bus.id.replace('demo-bus-','Bus ')}</strong>
      <span>{bus.type} · {bus.routeName}</span>
      <span>Next stop: {bus.nextName}</span>
      <span>Status: {bus.status}{bus.delay? ` · +${bus.delay} min`:''}</span>
      <span>Occupancy: {bus.occupancy}/{bus.capacity}</span>
     </div>
    </Popup>
   </Marker>)}
  </MapContainer>
  <div className="map-attribution-note">Map data © OpenStreetMap contributors · Bus movements are simulated demo positions.</div>
 </div>;
}
