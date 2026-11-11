import {useEffect,useMemo,useRef,useState} from 'react';
import type {Stop,TransitRoute,TransitBus,RouteStop,BusLocation} from '../lib/transit';
import {getGoogleMapsApiKey,loadGoogleMaps} from '../lib/googleMaps';

type Props={
 stops:Stop[];routes:TransitRoute[];buses:TransitBus[];routeStops:RouteStop[];
 locations:BusLocation[];selectedRouteId?:string;sourceId?:string;
 destinationId?:string;compact?:boolean;onError?:(message:string)=>void;
};
type BusAnimation={bus:TransitBus;location:BusLocation;from:{lat:number;lng:number};to:{lat:number;lng:number};route:TransitRoute|null;nextStop:Stop|null};

function stopPosition(stop:Stop){return {lat:Number(stop.latitude),lng:Number(stop.longitude)}}
function routesAtStop(stopId:string,routes:TransitRoute[],routeStops:RouteStop[]){
 const ids=new Set(routeStops.filter(entry=>entry.stop_id===stopId).map(entry=>entry.route_id));
 return routes.filter(route=>ids.has(route.id)).sort((a,b)=>a.route_number.localeCompare(b.route_number,undefined,{numeric:true}));
}
function stopSourceLabel(stop:Stop){
 const source=(stop.data_source||'').toLowerCase();
 if(source.includes('openstreetmap')||source==='osm')return 'OpenStreetMap';
 if(source.includes('gtfs'))return 'GTFS import';
 if(source.includes('manual'))return 'Manually registered';
 return 'Project sample / saved stop';
}
function stopMarkerIcon(maps:any,kind:'default'|'source'|'destination'){
 const color=kind==='source'?'#2563eb':kind==='destination'?'#16a34a':'#0f766e';
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="46" viewBox="0 0 40 46"><path d="M20 2C9.5 2 2 9.8 2 20c0 12.4 18 24 18 24s18-11.6 18-24C38 9.8 30.5 2 20 2Z" fill="'+color+'" stroke="#fff" stroke-width="2.2"/><circle cx="20" cy="19" r="11.5" fill="#fff"/><path d="M12.5 15.5c0-1.3 1-2.3 2.3-2.3h10.4c1.3 0 2.3 1 2.3 2.3v8.8c0 .9-.7 1.6-1.6 1.6h-.7v1.5h-2v-1.5h-6.4v1.5h-2v-1.5h-.7c-.9 0-1.6-.7-1.6-1.6v-8.8Zm2.2-.2v5h10.6v-5H14.7Zm1.2 7.1a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Zm8.2 0a1.35 1.35 0 1 0 0 2.7 1.35 1.35 0 0 0 0-2.7Z" fill="#0f766e"/></svg>';
 return {url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg),scaledSize:new maps.Size(40,46),anchor:new maps.Point(20,43)};
}
function stopInfoContent(stop:Stop,routes:TransitRoute[],routeStops:RouteStop[],sourceId?:string,destinationId?:string){
 const root=document.createElement('div');root.className='google-map-info tiq-google-stop-info';
 const head=document.createElement('div');head.className='tiq-google-stop-head';
 const icon=document.createElement('span');icon.className='tiq-google-stop-symbol';icon.textContent='BUS';
 const titleWrap=document.createElement('div');const title=document.createElement('strong');title.textContent=stop.name;
 const area=document.createElement('span');area.textContent=stop.area||'Mapped bus stop';titleWrap.append(title,area);head.append(icon,titleWrap);root.append(head);
 const badge=document.createElement('div');badge.className='tiq-google-stop-badges';
 const kind=document.createElement('span');kind.textContent=stop.id===sourceId?'BOARDING STOP':stop.id===destinationId?'DESTINATION':'BUS STOP';
 const source=document.createElement('span');source.textContent=stopSourceLabel(stop);badge.append(kind,source);root.append(badge);
 if(stop.landmark){const landmark=document.createElement('span');landmark.className='tiq-google-stop-landmark';landmark.textContent='Near '+stop.landmark;root.append(landmark);}
 const coords=document.createElement('div');coords.className='tiq-google-stop-coordinates';coords.textContent='Map coordinates · '+Number(stop.latitude).toFixed(5)+', '+Number(stop.longitude).toFixed(5);root.append(coords);
 const service=document.createElement('div');service.className='tiq-google-stop-services';
 const serviceTitle=document.createElement('b');serviceTitle.textContent='Routes serving this stop';service.append(serviceTitle);
 const found=routesAtStop(stop.id,routes,routeStops);
 if(found.length){const list=document.createElement('div');list.className='tiq-google-stop-route-list';found.forEach(route=>{const line=document.createElement('span');line.textContent=route.route_number+' · '+route.name;list.append(line)});service.append(list);}
 else{const empty=document.createElement('span');empty.textContent='No route sequence is linked to this stop yet.';service.append(empty);}
 root.append(service);
 if(stop.shelter_available||stop.wheelchair_accessible){const facilities=document.createElement('span');facilities.className='tiq-google-stop-facilities';facilities.textContent=[stop.shelter_available?'Covered shelter':'',stop.wheelchair_accessible?'Wheelchair accessible':''].filter(Boolean).join(' · ');root.append(facilities);}
 const actions=document.createElement('div');actions.className='tiq-google-stop-actions';
 const mapsLink=document.createElement('a');mapsLink.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(stop.latitude+','+stop.longitude);mapsLink.target='_blank';mapsLink.rel='noopener noreferrer';mapsLink.textContent='Open in Google Maps';
 const osmLink=document.createElement('a');osmLink.href='https://www.openstreetmap.org/?mlat='+stop.latitude+'&mlon='+stop.longitude+'#map=18/'+stop.latitude+'/'+stop.longitude;osmLink.target='_blank';osmLink.rel='noopener noreferrer';osmLink.textContent='OpenStreetMap';
 actions.append(mapsLink,osmLink);root.append(actions);return root;
}

function getRouteStops(route:TransitRoute,routeStops:RouteStop[],stops:Stop[]){
 return routeStops.filter(x=>x.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number)
  .map(x=>stops.find(s=>s.id===x.stop_id)).filter((s):s is Stop=>!!s);
}
export default function GoogleTransitMap({stops,routes,buses,routeStops,locations,selectedRouteId,sourceId,destinationId,compact=false,onError}:Props){
 const container=useRef<HTMLDivElement>(null);
 const mapRef=useRef<any>(null);
 const mapsRef=useRef<any>(null);
 const objectsRef=useRef<{markers:any[];polylines:any[];info:any;busMarkers:Map<string,any>;searchMarker:any;traffic:any;roadPolylines:any[]}>({
  markers:[],polylines:[],info:null,busMarkers:new Map(),searchMarker:null,traffic:null,roadPolylines:[]
 });
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 const [traffic,setTraffic]=useState(false);
 const [lastPlace,setLastPlace]=useState('');
 const [roadStatus,setRoadStatus]=useState('');
 const [roadBusy,setRoadBusy]=useState(false);
 const height=compact?350:490;

 const activeBuses=useMemo(()=>buses.filter(b=>b.status==='Active'),[buses]);
 const busAnimations=useMemo<BusAnimation[]>(()=>{
  return activeBuses.flatMap(bus=>{
   const location=locations.find(l=>l.bus_id===bus.id);
   if(!location)return [];
   const route=routes.find(r=>r.id===bus.assigned_route_id)||null;
   const ordered=route?getRouteStops(route,routeStops,stops):[];
   const currentIndex=ordered.findIndex(s=>routeStops.find(x=>x.route_id===route?.id&&x.sequence_number===location.current_stop_sequence)?.stop_id===s.id);
   const current=ordered[currentIndex];
   const nextStop=ordered.length>1?ordered[(Math.max(0,currentIndex)+1)%ordered.length]:null;
   const previousEntry=routeStops.find(x=>x.route_id===route?.id&&x.sequence_number===location.previous_stop_sequence);
   const previous=previousEntry?stops.find(s=>s.id===previousEntry.stop_id):undefined;
   const currentStop=current||stops.reduce<Stop|undefined>((best,s)=>{
    if(best)return best;
    return undefined;
   },undefined);
   const end=currentStop?stopPosition(currentStop):{lat:location.latitude,lng:location.longitude};
   const start=previous?stopPosition(previous):end;
   return [{bus,location,from:start,to:end,route,nextStop}];
  });
 },[activeBuses,locations,routes,routeStops,stops]);

 useEffect(()=>{
  let disposed=false;
  let searchElement:any=null;
  let searchHandler:any=null;
  async function initialize(){
   if(!container.current)return;
   try{
    const maps=await loadGoogleMaps();
    if(disposed)return;
    const {Map,InfoWindow}=await maps.importLibrary('maps');
    await maps.importLibrary('marker');
    const center=stops.length?stopPosition(stops.find(s=>s.id===sourceId)||stops[0]):{lat:17.49,lng:78.43};
    const map=new Map(container.current,{
     center,zoom:11,streetViewControl:true,fullscreenControl:true,mapTypeControl:true,
     mapTypeControlOptions:{style:maps.MapTypeControlStyle?.DROPDOWN_MENU},
     scaleControl:true,zoomControl:true,gestureHandling:'greedy',
     mapTypeId:maps.MapTypeId?.ROADMAP,
     clickableIcons:true,
     restriction:{latLngBounds:{north:37.5,south:6.0,west:68.0,east:98.0},strictBounds:false}
    });
    mapRef.current=map;mapsRef.current=maps;
    objectsRef.current.info=new InfoWindow();
    const {PlaceAutocompleteElement}=await maps.importLibrary('places');
    if(disposed)return;
    searchElement=new PlaceAutocompleteElement();
    searchElement.placeholder='Search Indian places, stations or landmarks';
    searchElement.includedRegionCodes=['in'];
    const searchCard=document.createElement('div');
    searchCard.className='google-map-search-control';
    searchCard.appendChild(searchElement);
    map.controls[maps.ControlPosition.TOP_LEFT].push(searchCard);
    searchHandler=async(event:any)=>{
     try{
      const place=event.placePrediction?.toPlace();
      if(!place)return;
      await place.fetchFields({fields:['displayName','formattedAddress','location','viewport']});
      if(!place.location)return;
      const position={lat:place.location.lat(),lng:place.location.lng()};
      map.panTo(position);map.setZoom(16);
      if(objectsRef.current.searchMarker)objectsRef.current.searchMarker.setMap(null);
      const marker=new maps.Marker({map,position,title:place.displayName||'Selected place',animation:maps.Animation?.DROP});
      objectsRef.current.searchMarker=marker;
      objectsRef.current.info.setContent('<div class="google-map-info"><strong>'+String(place.displayName||'Selected place').replace(/[<>]/g,'')+'</strong><span>'+String(place.formattedAddress||'').replace(/[<>]/g,'')+'</span></div>');
      objectsRef.current.info.open({map,anchor:marker});
      setLastPlace(place.displayName||place.formattedAddress||'Place selected');
     }catch(e:any){const message=e?.message||'Place search failed.';setError(message);onError?.(message)}
    };
    searchElement.addEventListener('gmp-select',searchHandler);
    setReady(true);setError('');
   }catch(e:any){if(!disposed){const message=e?.message||'Google Maps could not be initialized.';setError(message);onError?.(message)}}
  }
  void initialize();
  return()=>{
   disposed=true;
   if(searchElement&&searchHandler)searchElement.removeEventListener('gmp-select',searchHandler);
   const objects=objectsRef.current;
   [...objects.markers,...objects.busMarkers.values()].forEach((marker:any)=>marker.setMap(null));
   objects.polylines.forEach((line:any)=>line.setMap(null));
   objects.searchMarker?.setMap(null);
   objects.traffic?.setMap(null);
   mapRef.current=null;mapsRef.current=null;
  };
 },[]);

 useEffect(()=>{
  const map=mapRef.current,maps=mapsRef.current;
  if(!ready||!map||!maps)return;
  const objects=objectsRef.current;
  objects.markers.forEach((marker:any)=>marker.setMap(null));
  objects.polylines.forEach((line:any)=>line.setMap(null));
  objects.roadPolylines.forEach((line:any)=>line.setMap(null));objects.roadPolylines=[];
  objects.busMarkers.forEach((marker:any)=>marker.setMap(null));
  objects.markers=[];objects.polylines=[];objects.busMarkers.clear();

  const routeList=selectedRouteId?routes.filter(r=>r.id===selectedRouteId):routes.filter(r=>r.status==='Active');
  routeList.forEach(route=>{
   const path=getRouteStops(route,routeStops,stops).map(stopPosition);
   if(path.length<2)return;
   const selected=route.id===selectedRouteId;
   const line=new maps.Polyline({map,path,geodesic:true,strokeColor:selected?'#2563eb':(route.color||'#0f766e'),strokeOpacity:selected?1:.67,strokeWeight:selected?8:4,zIndex:selected?3:1});
   line.addListener('click',(event:any)=>{
    objects.info.setContent('<div class="google-map-info"><strong>Route '+String(route.route_number).replace(/[<>]/g,'')+'</strong><span>'+String(route.name).replace(/[<>]/g,'')+'</span><span>Average speed: '+Number(route.average_speed||0)+' km/h</span></div>');
    objects.info.setPosition(event.latLng);objects.info.open({map});
   });
   objects.polylines.push(line);
  });

  stops.filter(stop=>Number.isFinite(Number(stop.latitude))&&Number.isFinite(Number(stop.longitude))&&Math.abs(stop.latitude)<=90&&Math.abs(stop.longitude)<=180).forEach(stop=>{
   const position=stopPosition(stop),kind=stop.id===sourceId?'source':stop.id===destinationId?'destination':'default';
   const marker=new maps.Marker({map,position,title:stop.name,icon:stopMarkerIcon(maps,kind),zIndex:kind==='default'?4:24});
   marker.addListener('click',()=>{
    objects.info.setContent(stopInfoContent(stop,routes,routeStops,sourceId,destinationId));
    objects.info.open({map,anchor:marker});
   });
   objects.markers.push(marker);
  });

  busAnimations.forEach(({bus,location,from,to,route,nextStop})=>{
   const running=location.simulation_status==='running';
   const elapsed=running?Math.max(0,Date.now()-new Date(location.last_updated).getTime()):5000;
   const fraction=Math.min(1,elapsed/5000);
   const isSimulated=bus.data_source==='demo'||location.simulation_status==='running'||location.simulation_status==='simulated';
   const position=isSimulated?{lat:from.lat+(to.lat-from.lat)*fraction,lng:from.lng+(to.lng-from.lng)*fraction}:{lat:Number(location.latitude),lng:Number(location.longitude)};
   if(!Number.isFinite(position.lat)||!Number.isFinite(position.lng)||Math.abs(position.lat)>90||Math.abs(position.lng)>180)return;
   const marker=new maps.Marker({map,position,title:bus.registration_number+(nextStop?' · Next stop: '+nextStop.name:''),icon:{path:maps.SymbolPath.CIRCLE,scale:17,fillColor:'#0f766e',fillOpacity:1,strokeColor:'#ffffff',strokeWeight:3},label:{text:'BUS',fontSize:'9px',fontWeight:'700',color:'#ffffff'},zIndex:50});
   marker.addListener('click',()=>{
    const info=document.createElement('div');info.className='google-map-info';
    const heading=document.createElement('strong');heading.textContent=bus.registration_number+' · '+bus.name;
    const routeLine=document.createElement('span');routeLine.textContent=(route?.route_number||'Unassigned route')+' · '+bus.bus_type;
    const status=document.createElement('span');status.textContent=location.live_status+(location.delay_minutes?' · +'+location.delay_minutes+' min':'');
    const crowd=document.createElement('span');crowd.textContent='Occupancy '+location.occupancy+'/'+bus.capacity;
    const next=document.createElement('span');next.textContent='Next stop: '+(nextStop?.name||'Route complete');
    const source=document.createElement('span');source.textContent=bus.data_source==='demo'||location.simulation_status==='running'||location.simulation_status==='simulated'?'Simulated position':'Saved location record · live feed not verified';
    info.append(heading,routeLine,next,source,status,crowd);objects.info.setContent(info);objects.info.open({map,anchor:marker});
   });
   objects.busMarkers.set(bus.id,marker);
  });

  const routeFocus=routes.find(route=>route.id===selectedRouteId);
  const focus=routeFocus?getRouteStops(routeFocus,routeStops,stops):stops.filter(s=>s.id===sourceId||s.id===destinationId);
  if(focus.length){
   const focusBounds=new maps.LatLngBounds();
   focus.forEach(stop=>focusBounds.extend(stopPosition(stop)));
   map.fitBounds(focusBounds,{padding:45,maxZoom:15});
  }
 },[ready,stops,routes,routeStops,busAnimations,sourceId,destinationId,selectedRouteId]);

 useEffect(()=>{
  if(!ready)return;
  const timer=window.setInterval(()=>{
   const maps=mapsRef.current,objects=objectsRef.current;
   if(!maps)return;
   busAnimations.forEach(({bus,location,from,to})=>{
    const marker=objects.busMarkers.get(bus.id);if(!marker)return;
    const isSimulated=bus.data_source==='demo'||location.simulation_status==='running'||location.simulation_status==='simulated';
    if(!isSimulated){marker.setPosition({lat:Number(location.latitude),lng:Number(location.longitude)});return;}
    const elapsed=Math.max(0,Date.now()-new Date(location.last_updated).getTime());
    const t=Math.min(1,elapsed/5000);
    marker.setPosition({lat:from.lat+(to.lat-from.lat)*t,lng:from.lng+(to.lng-from.lng)*t});
   });
  },250);
  return()=>clearInterval(timer);
 },[ready,busAnimations]);

 useEffect(()=>{
  if(!ready||!mapsRef.current)return;
  const objects=objectsRef.current;
  if(traffic){
   if(!objects.traffic)objects.traffic=new mapsRef.current.TrafficLayer();
   objects.traffic.setMap(mapRef.current);
  }else objects.traffic?.setMap(null);
 },[ready,traffic]);

 async function roadAlignSelectedRoute(){
  const map=mapRef.current,maps=mapsRef.current,route=routes.find(r=>r.id===selectedRouteId);
  if(!map||!maps||!route){setRoadStatus('Select a route first.');return}
  const points=getRouteStops(route,routeStops,stops);
  if(points.length<2){setRoadStatus('Add at least two ordered stops to this route.');return}
  setRoadBusy(true);setRoadStatus('Calculating road-aligned path…');
  try{
   const {Route}=await maps.importLibrary('routes');
   const request={
    origin:stopPosition(points[0]),
    destination:stopPosition(points[points.length-1]),
    intermediates:points.slice(1,-1).map(point=>({location:stopPosition(point)})),
    travelMode:'DRIVING',
    region:'IN',
    fields:['path','distanceMeters','durationMillis']
   };
   const result=await Route.computeRoutes(request);
   const best=result.routes?.[0];
   if(!best)throw new Error('Google Routes did not return a path for this stop sequence.');
   objectsRef.current.roadPolylines.forEach((line:any)=>line.setMap(null));
   objectsRef.current.roadPolylines=best.createPolylines();
   objectsRef.current.roadPolylines.forEach((line:any)=>{line.setMap(map);line.setOptions({strokeColor:'#f97316',strokeWeight:6,strokeOpacity:.92,zIndex:12})});
   const km=Number(best.distanceMeters||0)/1000;
   const minutes=Math.round(Number(best.durationMillis||0)/60000);
   setRoadStatus('Road-aligned path: '+km.toFixed(1)+' km · '+minutes+' min driving estimate');
  }catch(e:any){setRoadStatus(e?.message||'Road routing could not be calculated. Check Routes API access.')}
  finally{setRoadBusy(false)}
 }

 return <div className="transit-map-shell google-transit-map-shell">
  <div ref={container} className="transit-map google-transit-map" style={{height}}/>
  {!ready&&!error&&<div className="google-map-overlay">Loading Google Maps…</div>}
  {error&&<div className="google-map-overlay error"><strong>Google Maps not connected</strong><span>{error}</span><small>Switching to the OpenStreetMap fallback.</small></div>}
  <div className="google-map-toolbar">
   <button type="button" onClick={()=>setTraffic(v=>!v)} className={traffic?'active':''}> {traffic?'Hide':'Show'} traffic</button>
   <button type="button" onClick={()=>void roadAlignSelectedRoute()} disabled={!selectedRouteId||roadBusy}>{roadBusy?'Routing…':'Road-align selected route'}</button>
   {lastPlace&&<span>{lastPlace}</span>}
   {roadStatus&&<span>{roadStatus}</span>}
   <small>Google Maps · Simulated demo locations; real GPS requires an authorized operator feed.</small>
  </div>
 </div>;
}
