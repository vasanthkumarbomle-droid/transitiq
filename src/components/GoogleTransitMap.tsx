import {useEffect,useMemo,useRef,useState} from 'react';
import type {Stop,TransitRoute,TransitBus,RouteStop,BusLocation} from '../lib/transit';
import {getGoogleMapsApiKey,loadGoogleMaps} from '../lib/googleMaps';

type Props={
 stops:Stop[];routes:TransitRoute[];buses:TransitBus[];routeStops:RouteStop[];
 locations:BusLocation[];selectedRouteId?:string;sourceId?:string;
 destinationId?:string;compact?:boolean;onError?:(message:string)=>void;
};
type BusAnimation={bus:TransitBus;location:BusLocation;from:{lat:number;lng:number};to:{lat:number;lng:number};route:TransitRoute|null};

function stopPosition(stop:Stop){return {lat:Number(stop.latitude),lng:Number(stop.longitude)}}
function getRouteStops(route:TransitRoute,routeStops:RouteStop[],stops:Stop[]){
 return routeStops.filter(x=>x.route_id===route.id).sort((a,b)=>a.sequence_number-b.sequence_number)
  .map(x=>stops.find(s=>s.id===x.stop_id)).filter((s):s is Stop=>!!s);
}
function GoogleTransitMap({stops,routes,buses,routeStops,locations,selectedRouteId,sourceId,destinationId,compact=false,onError}:Props){
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

 const activeBuses=useMemo(()=>buses.filter(b=>b.status==='Active'&&b.data_source==='demo'),[buses]);
 const busAnimations=useMemo<BusAnimation[]>(()=>{
  return activeBuses.flatMap(bus=>{
   const location=locations.find(l=>l.bus_id===bus.id);
   if(!location)return [];
   const route=routes.find(r=>r.id===bus.assigned_route_id)||null;
   const ordered=route?getRouteStops(route,routeStops,stops):[];
   const current=ordered.find(s=>s.id===routeStops.find(x=>x.route_id===route?.id&&x.sequence_number===location.current_stop_sequence)?.stop_id);
   const previousEntry=routeStops.find(x=>x.route_id===route?.id&&x.sequence_number===location.previous_stop_sequence);
   const previous=previousEntry?stops.find(s=>s.id===previousEntry.stop_id):undefined;
   const currentStop=current||stops.reduce<Stop|undefined>((best,s)=>{
    if(best)return best;
    return undefined;
   },undefined);
   const end=currentStop?stopPosition(currentStop):{lat:location.latitude,lng:location.longitude};
   const start=previous?stopPosition(previous):end;
   return [{bus,location,from:start,to:end,route}];
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

  const bounds=new maps.LatLngBounds();
  const routeFocus=routes.find(r=>r.id===selectedRouteId);
  const routeList=routeFocus?[routeFocus]:routes.filter(r=>r.status==='Active');
  routeList.forEach(route=>{
   const path=getRouteStops(route,routeStops,stops).map(stopPosition);
   if(path.length<2)return;
   const selected=route.id===selectedRouteId;
   const line=new maps.Polyline({map,path,geodesic:true,strokeColor:route.color||'#0f766e',strokeOpacity:selected?1:.67,strokeWeight:selected?7:4,zIndex:selected?3:1});
   line.addListener('click',(event:any)=>{
    objects.info.setContent('<div class="google-map-info"><strong>Route '+String(route.route_number).replace(/[<>]/g,'')+'</strong><span>'+String(route.name).replace(/[<>]/g,'')+'</span><span>Average speed: '+Number(route.average_speed||0)+' km/h</span></div>');
    objects.info.setPosition(event.latLng);objects.info.open({map});
   });
   objects.polylines.push(line);path.forEach((p:any)=>bounds.extend(p));
  });

  stops.filter(s=>s.data_source!=='demo').forEach(stop=>{
   const position=stopPosition(stop),selected=stop.id===sourceId||stop.id===destinationId;
   const marker=new maps.Marker({
    map,position,title:stop.name,
    icon:{path:maps.SymbolPath.CIRCLE,scale:selected?8:5,fillColor:stop.id===sourceId?'#2563eb':stop.id===destinationId?'#16a34a':'#64748b',fillOpacity:1,strokeColor:'#ffffff',strokeWeight:2},
    zIndex:selected?20:2
   });
   marker.addListener('click',()=>{
    const info=document.createElement('div');info.className='google-map-info';
    const heading=document.createElement('strong');heading.textContent=stop.name;
    const area=document.createElement('span');area.textContent=stop.area||'Bus stop';
    const type=document.createElement('span');type.textContent=stop.id===sourceId?'Boarding stop':stop.id===destinationId?'Destination':'Mapped stop';
    info.append(heading,area,type);objects.info.setContent(info);objects.info.open({map,anchor:marker});
   });
   objects.markers.push(marker);bounds.extend(position);
  });

  busAnimations.forEach(({bus,location,from,to,route})=>{
   const running=location.simulation_status==='running';
   const elapsed=running?Math.max(0,Date.now()-new Date(location.last_updated).getTime()):5000;
   const fraction=Math.min(1,elapsed/5000);
   const position={lat:from.lat+(to.lat-from.lat)*fraction,lng:from.lng+(to.lng-from.lng)*fraction};
   const marker=new maps.Marker({map,position,title:bus.registration_number,label:{text:'🚌',fontSize:'21px'},zIndex:50});
   marker.addListener('click',()=>{
    const info=document.createElement('div');info.className='google-map-info';
    const heading=document.createElement('strong');heading.textContent=bus.registration_number+' · '+bus.name;
    const routeLine=document.createElement('span');routeLine.textContent=(route?.route_number||'Unassigned route')+' · '+bus.bus_type;
    const status=document.createElement('span');status.textContent=location.live_status+(location.delay_minutes?' · +'+location.delay_minutes+' min':'');
    const crowd=document.createElement('span');crowd.textContent='Occupancy '+location.occupancy+'/'+bus.capacity;
    info.append(heading,routeLine,status,crowd);objects.info.setContent(info);objects.info.open({map,anchor:marker});
   });
   objects.busMarkers.set(bus.id,marker);bounds.extend(position);
  });

  const focus=stops.filter(s=>s.id===sourceId||s.id===destinationId);
  if(focus.length){focus.forEach(s=>bounds.extend(stopPosition(s)));map.fitBounds(bounds,{padding:45,maxZoom:14});}
  else if(!bounds.isEmpty())map.fitBounds(bounds,{padding:35,maxZoom:13});
 },[ready,stops,routes,routeStops,busAnimations,sourceId,destinationId,selectedRouteId]);

 useEffect(()=>{
  if(!ready)return;
  const timer=window.setInterval(()=>{
   const maps=mapsRef.current,objects=objectsRef.current;
   if(!maps)return;
   busAnimations.forEach(({bus,location,from,to})=>{
    const marker=objects.busMarkers.get(bus.id);if(!marker)return;
    const elapsed=location.simulation_status==='running'?Math.max(0,Date.now()-new Date(location.last_updated).getTime()):5000;
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
    regionCode:'IN',
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
   <small>Google Maps · Demo bus locations</small>
  </div>
 </div>;
}
