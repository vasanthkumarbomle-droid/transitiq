// TRANSITIQ route and journey algorithms.
// All fare/distance rates are illustrative simulator values, not official tariffs.
export type Stop = { id:string; name:string; area?:string; latitude:number; longitude:number };
export type TransitRoute = { id:string; route_number:string; name:string; average_speed:number; status:string; color?:string };
export type TransitBus = { id:string; registration_number:string; name:string; bus_type:string; capacity:number; assigned_route_id:string|null; status:string };
export type RouteStop = { id:number; route_id:string; stop_id:string; sequence_number:number; distance_from_previous_km:number };
export type Fare = { bus_type:string; rate_per_km:number; minimum_fare:number };
export type BusLocation = { bus_id:string; latitude:number; longitude:number; current_stop_sequence:number; previous_stop_sequence:number; occupancy:number; delay_minutes:number; live_status:'On Time'|'Delayed'|'Arriving'; last_updated:string; simulation_status:string };
export type JourneyLeg = { route:TransitRoute; bus:TransitBus; from:string; to:string; sourceSequence:number; destinationSequence:number; distance:number; travelMinutes:number; fare:number; etaSeconds:number; availableSeats:number; occupancyPercent:number };
export type Journey = { id:string; legs:JourneyLeg[]; distance:number; duration:number; fare:number; transfers:number; transferStop?:string; badges:string[] };

export function number(value:unknown,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
export function haversineKm(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
 const rad=(v:number)=>v*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
 const x=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
export function nearestStop(lat:number,lng:number,stops:Stop[]){
 return stops.reduce<{stop:Stop|null;distanceKm:number}>((best,stop)=>{
  const d=haversineKm({latitude:lat,longitude:lng},stop);
  return d<best.distanceKm?{stop,distanceKm:d}:best;
 },{stop:null,distanceKm:Infinity});
}
export function crowdLabel(occupancy:number,capacity:number){
 const percent=capacity>0?Math.min(100,Math.max(0,occupancy/capacity*100)):0;
 return {percent,label:percent>=85?'Full':percent>=55?'Medium':'Low',tone:percent>=85?'high':percent>=55?'medium':'low'};
}
export function calculateFare(distanceKm:number,busType:string,fares:Fare[]){
 const row=fares.find(f=>f.bus_type===busType);
 return Math.max(number(row?.minimum_fare,10),Math.max(0,distanceKm)*number(row?.rate_per_km,1.5));
}
export function concessionFare(fare:number,category:string){
 const multiplier=category==='Student 50%'||category==='Senior 50%'?0.5:category==='Child free'?0:1;
 return Math.round(fare*multiplier*100)/100;
}
function sortedStops(routeId:string,routeStops:RouteStop[]){
 return routeStops.filter(s=>s.route_id===routeId).sort((a,b)=>a.sequence_number-b.sequence_number);
}
function etaToStop(bus:TransitBus,route:TransitRoute,ordered:RouteStop[],targetSequence:number,location:BusLocation|null){
 if(!ordered.length)return 0;
 const currentSequence=number(location?.current_stop_sequence,1);
 const currentIndex=Math.max(0,ordered.findIndex(x=>x.sequence_number===currentSequence));
 const targetIndex=ordered.findIndex(x=>x.sequence_number===targetSequence);
 if(targetIndex<0)return 0;
 if(currentIndex===targetIndex)return Math.max(0,number(location?.delay_minutes))*60;
 let km=0,intermediate=0;
 let index=currentIndex;
 while(index!==targetIndex && intermediate<ordered.length){
  const next=(index+1)%ordered.length;
  km+=number(ordered[next].distance_from_previous_km);
  index=next;
  if(index!==targetIndex)intermediate++;
 }
 const speed=Math.max(8,number(route.average_speed,25));
 const base=Math.ceil((km/speed*60+intermediate+number(location?.delay_minutes))*60);
 const elapsed=location?.last_updated?Math.max(0,(Date.now()-new Date(location.last_updated).getTime())/1000):0;
 return Math.max(0,base-elapsed);
}
function buildLeg(route:TransitRoute,bus:TransitBus,fromId:string,toId:string,stops:Stop[],routeStops:RouteStop[],fares:Fare[],locations:BusLocation[]):JourneyLeg|null{
 const ordered=sortedStops(route.id,routeStops),i=ordered.findIndex(s=>s.stop_id===fromId),j=ordered.findIndex(s=>s.stop_id===toId);
 if(i<0||j<0||i>=j)return null;
 const distance=ordered.slice(i+1,j+1).reduce((sum,s)=>sum+number(s.distance_from_previous_km),0);
 const intermediate=Math.max(0,j-i-1);
 const travelMinutes=distance/Math.max(8,number(route.average_speed,25))*60+intermediate;
 const location=locations.find(l=>l.bus_id===bus.id)||null;
 const crowd=crowdLabel(number(location?.occupancy),bus.capacity);
 return {route,bus,from:stops.find(s=>s.id===fromId)?.name||fromId,to:stops.find(s=>s.id===toId)?.name||toId,sourceSequence:ordered[i].sequence_number,destinationSequence:ordered[j].sequence_number,distance,travelMinutes,fare:calculateFare(distance,bus.bus_type,fares),etaSeconds:etaToStop(bus,route,ordered,ordered[i].sequence_number,location),availableSeats:Math.max(0,bus.capacity-number(location?.occupancy)),occupancyPercent:crowd.percent};
}
export function findJourneys(args:{from:string;to:string;routes:TransitRoute[];buses:TransitBus[];stops:Stop[];routeStops:RouteStop[];fares:Fare[];locations:BusLocation[];busType?:string;includeTransfers?:boolean}):Journey[]{
 const {from,to,routes,buses,stops,routeStops,fares,locations}=args;
 if(!from||!to||from===to)return [];
 const activeRoutes=routes.filter(r=>r.status==='Active'&&r.data_source!=='demo');
 const activeBuses=buses.filter(b=>b.status==='Active'&&b.data_source!=='demo');
 const busMatches=(r:TransitRoute)=>activeBuses.filter(b=>b.assigned_route_id===r.id&&(args.busType==='All'||!args.busType||b.bus_type===args.busType));
 const legs:Journey[]=[];
 for(const route of activeRoutes){
  for(const bus of busMatches(route)){
   const leg=buildLeg(route,bus,from,to,stops,routeStops,fares,locations);
   if(leg)legs.push({id:route.id+'-'+bus.id,legs:[leg],distance:leg.distance,duration:Math.ceil(leg.travelMinutes),fare:leg.fare,transfers:0,badges:[]});
  }
 }
 if(args.includeTransfers!==false){
  for(const first of activeRoutes)for(const second of activeRoutes){
   if(first.id===second.id)continue;
   const firstStops=sortedStops(first.id,routeStops);
   const fromIndex=firstStops.findIndex(s=>s.stop_id===from);
   if(fromIndex<0)continue;
   for(const shared of firstStops.slice(fromIndex+1)){
    const secondStops=sortedStops(second.id,routeStops);
    const sharedIndex=secondStops.findIndex(s=>s.stop_id===shared.stop_id);
    const toIndex=secondStops.findIndex(s=>s.stop_id===to);
    if(sharedIndex<0||toIndex<=sharedIndex)continue;
    for(const busA of busMatches(first))for(const busB of busMatches(second)){
     const a=buildLeg(first,busA,from,shared.stop_id,stops,routeStops,fares,locations);
     const b=buildLeg(second,busB,shared.stop_id,to,stops,routeStops,fares,locations);
     if(!a||!b)continue;
     legs.push({id:first.id+'-'+second.id+'-'+shared.stop_id+'-'+busA.id+'-'+busB.id,legs:[a,b],distance:a.distance+b.distance,duration:Math.ceil(a.travelMinutes+b.travelMinutes+5),fare:a.fare+b.fare,transfers:1,transferStop:stops.find(s=>s.id===shared.stop_id)?.name||shared.stop_id,badges:[]});
    }
   }
  }
 }
 // De-duplicate identical route/bus combinations and rank recommendations.
 const unique=Array.from(new Map(legs.map(j=>[j.id,j])).values()).sort((a,b)=>a.duration-b.duration||a.fare-b.fare);
 if(!unique.length)return [];
 const fastest=unique.reduce((a,b)=>a.duration<=b.duration?a:b);
 const cheapest=unique.reduce((a,b)=>a.fare<=b.fare?a:b);
 const leastCrowded=unique.reduce((a,b)=>{
  const ac=a.legs.reduce((n,l)=>n+l.occupancyPercent,0)/a.legs.length;
  const bc=b.legs.reduce((n,l)=>n+l.occupancyPercent,0)/b.legs.length;
  return ac<=bc?a:b;
 });
 return unique.map(j=>({...j,badges:[...(j.id===fastest.id?['Fastest']:[]),...(j.id===cheapest.id?['Cheapest']:[]),...(j.id===leastCrowded.id?['Least Crowded']:[])]}));
}
export function sortJourneys(journeys:Journey[],sort:string){
 const copy=[...journeys];
 if(sort==='cheapest')return copy.sort((a,b)=>a.fare-b.fare);
 if(sort==='crowded')return copy.sort((a,b)=>a.legs.reduce((v,l)=>v+l.occupancyPercent,0)-b.legs.reduce((v,l)=>v+l.occupancyPercent,0));
 if(sort==='earliest')return copy.sort((a,b)=>Math.min(...a.legs.map(l=>l.etaSeconds))-Math.min(...b.legs.map(l=>l.etaSeconds)));
 return copy.sort((a,b)=>a.duration-b.duration);
}
export function formatMinutes(value:number){
 const mins=Math.max(0,Math.ceil(value));
 return mins<60?mins+' min':Math.floor(mins/60)+' hr '+(mins%60)+' min';
}
export function formatEta(seconds:number){
 const s=Math.max(0,Math.floor(seconds));
 return s<60?s+' sec':Math.floor(s/60)+' min';
}
