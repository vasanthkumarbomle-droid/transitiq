import {useState} from 'react';
import type {Stop,TransitRoute,TransitBus,RouteStop,BusLocation} from '../lib/transit';
import {getGoogleMapsApiKey} from '../lib/googleMaps';
import OpenStreetMapTransitMap from './OpenStreetMapTransitMap';
import GoogleTransitMap from './GoogleTransitMap';

type Props={stops:Stop[];routes:TransitRoute[];buses:TransitBus[];routeStops:RouteStop[];locations:BusLocation[];selectedRouteId?:string;sourceId?:string;destinationId?:string;compact?:boolean};

export default function BusMap(props:Props){
 const hasGoogleKey=Boolean(getGoogleMapsApiKey());
 const [googleFailed,setGoogleFailed]=useState(false);
 if(hasGoogleKey&&!googleFailed){
  return <GoogleTransitMap {...props} onError={()=>setGoogleFailed(true)}/>;
 }
 return <div className="transit-map-provider">
  {hasGoogleKey&&googleFailed&&<div className="map-provider-note">Google Maps could not load. Showing the OpenStreetMap fallback.</div>}
  {!hasGoogleKey&&<div className="map-provider-note">Google Maps is ready to connect. Add a restricted browser key to enable Google Maps and Places search.</div>}
  <OpenStreetMapTransitMap {...props}/>
 </div>;
}
