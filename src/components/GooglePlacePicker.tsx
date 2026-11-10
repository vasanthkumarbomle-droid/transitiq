import {useEffect,useRef,useState} from 'react';
import {MapPin} from 'lucide-react';
import {loadGoogleMaps,getGoogleMapsApiKey} from '../lib/googleMaps';

type SelectedPlace={name:string;area:string;latitude:number;longitude:number};
export default function GooglePlacePicker({onSelect}:{onSelect:(place:SelectedPlace)=>void}){
 const host=useRef<HTMLDivElement>(null);
 const [status,setStatus]=useState('');
 useEffect(()=>{
  let disposed=false,element:any=null,handler:any=null;
  async function setup(){
   if(!getGoogleMapsApiKey()){setStatus('Google Places will appear after a restricted Maps browser key is configured. You can still enter coordinates manually.');return}
   try{
    const maps=await loadGoogleMaps();
    const {PlaceAutocompleteElement}=await maps.importLibrary('places');
    if(disposed||!host.current)return;
    element=new PlaceAutocompleteElement({includedPrimaryTypes:['bus_station','transit_station']});
    element.placeholder='Search a bus stop, station or landmark in India';
    element.includedRegionCodes=['in'];
    element.className='google-place-picker-element';
    handler=async(event:any)=>{
     try{
      const place=event.placePrediction?.toPlace();
      if(!place)return;
      await place.fetchFields({fields:['displayName','formattedAddress','location']});
      if(!place.location)return;
      const address=String(place.formattedAddress||'');
      const parts=address.split(',').map(x=>x.trim()).filter(Boolean);
      onSelect({
       name:String(place.displayName||parts[0]||'Bus stop'),
       area:parts.slice(1,3).join(', ')||'India',
       latitude:place.location.lat(),
       longitude:place.location.lng()
      });
      setStatus('Place selected. Coordinates have been filled in below.');
     }catch(e:any){setStatus(e?.message||'Could not read that place.')}
    };
    element.addEventListener('gmp-select',handler);
    host.current.replaceChildren(element);
    setStatus('');
   }catch(e:any){setStatus(e?.message||'Google Places is unavailable.')}
  }
  void setup();
  return()=>{disposed=true;if(element&&handler)element.removeEventListener('gmp-select',handler);host.current?.replaceChildren()};
 },[onSelect]);
 return <div className="google-place-picker"><div ref={host}/>{status&&<small><MapPin size={13}/>{status}</small>}</div>;
}
