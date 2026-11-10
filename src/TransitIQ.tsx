import {lazy,Suspense,useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {QRCodeSVG} from 'qrcode.react';
import {
 BusFront,Route as RouteIcon,MapPin,Search,Clock3,Wallet,LayoutDashboard,
 Calculator,Navigation,Plus,RefreshCw,LogIn,LogOut,ShieldCheck,ArrowRight,
 ArrowDownUp,Activity,Menu,X,Users,Pencil,Trash2,Radio,Sun,Moon,LocateFixed,
 Volume2,Ticket,TrendingUp,ChevronUp,ChevronDown,Download,Globe,SlidersHorizontal,
 AlertTriangle,CheckCircle2,IndianRupee,Settings2,MapPinned
} from 'lucide-react';
import {supabase,isSupabaseConfigured} from './lib/supabase';
const BusMap = lazy(() => import('./components/BusMap'));
const LegacyWorkspace = lazy(() => import('./LegacyWorkspace'));
const AnalyticsCharts = lazy(() => import('./components/AnalyticsCharts'));
import {
 type Stop,type TransitRoute,type TransitBus,type RouteStop,type Fare,type BusLocation,
 type Journey,findJourneys,sortJourneys,nearestStop,crowdLabel,concessionFare,formatEta,formatMinutes
} from './lib/transit';

type Tab='Overview'|'Route Search'|'Bus Tracking'|'Bus Registration'|'Route Management'|'Analytics'|'Fare Calculator'|'Data Import'|'Journey Estimation';
type BusForm={registration_number:string;name:string;bus_type:string;capacity:number;driver_name:string;assigned_route_id:string;status:string};
type StopForm={name:string;area:string;latitude:string;longitude:string};
type MappedStop={id:number;source_ref:string;name:string;latitude:number;longitude:number;operator?:string|null};
const NAV:Tab[]=['Overview','Route Search','Bus Tracking','Bus Registration','Route Management','Analytics','Fare Calculator','Data Import'];
const ICONS:Record<string,any>={'Overview':LayoutDashboard,'Route Search':Search,'Bus Tracking':Navigation,'Bus Registration':BusFront,'Route Management':RouteIcon,'Analytics':TrendingUp,'Fare Calculator':Calculator,'Data Import':MapPinned};
const BUS_TYPES=['Ordinary','Express','AC','Electric'];
const CATEGORIES=['General','Student 50%','Senior 50%','Child free'];
const DEFAULT_BUS:BusForm={registration_number:'',name:'',bus_type:'Ordinary',capacity:45,driver_name:'',assigned_route_id:'',status:'Active'};
const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v);
const n=(v:unknown,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const L={
 en:{plan:'Plan your journey',from:'FROM',to:'TO',source:'Choose your starting stop',destination:'Choose your destination',find:'Find buses',live:'Live demo mode',results:'Journey options',nearest:'Use my location',map:'Live bus map',search:'Search the network'},
 te:{plan:'ప్రయాణాన్ని ప్లాన్ చేయండి',from:'ఎక్కడి నుండి',to:'ఎక్కడికి',source:'ప్రారంభ స్టాప్ ఎంచుకోండి',destination:'గమ్యస్థానాన్ని ఎంచుకోండి',find:'బస్సులను కనుగొనండి',live:'లైవ్ డెమో మోడ్',results:'ప్రయాణ ఎంపికలు',nearest:'నా స్థానాన్ని ఉపయోగించండి',map:'లైవ్ బస్ మ్యాప్',search:'నెట్‌వర్క్‌లో వెతకండి'}
};

function StopPicker({label,placeholder,stops,value,onChange}:{label:string;placeholder:string;stops:Stop[];value:string;onChange:(id:string)=>void}){
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 useEffect(()=>{setQuery(stops.find(s=>s.id===value)?.name||'')},[value,stops]);
 const matches=stops.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())||(s.area||'').toLowerCase().includes(query.toLowerCase())).slice(0,8);
 return <div className="stop-picker">
  <label>{label}</label>
  <div className="stop-picker-input"><MapPin size={17}/><input aria-label={label} value={query} placeholder={placeholder} autoComplete="off" onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);onChange('');setOpen(true)}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='Enter'&&matches[0]){e.preventDefault();onChange(matches[0].id);setQuery(matches[0].name);setOpen(false)}}}/><ChevronDown size={16}/></div>
  {open&&<><button type="button" className="picker-dismiss" aria-label="Close suggestions" onClick={()=>setOpen(false)}/><div className="stop-picker-menu">{matches.length?matches.map(s=><button type="button" key={s.id} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(s.id);setQuery(s.name);setOpen(false)}}><MapPin size={15}/><span><b>{s.name}</b><small>{s.area||'Bus stop'}</small></span></button>):<p>No matching stops</p>}</div></>}
 </div>;
}

function CrowdBar({occupancy,capacity}:{occupancy:number;capacity:number}){
 const crowd=crowdLabel(occupancy,capacity);
 return <div className="crowd-wrap"><div className="crowd-copy"><span>CROWD LEVEL</span><strong className={'crowd-label '+crowd.tone}>{crowd.label} · {Math.round(crowd.percent)}%</strong></div><div className="crowd-track"><motion.div className={'crowd-fill '+crowd.tone} initial={{width:0}} animate={{width:crowd.percent+'%'}} transition={{duration:.5}}/></div></div>;
}
function Toast({message,onClose}:{message:string;onClose:()=>void}){
 useEffect(()=>{if(!message)return;const id=window.setTimeout(onClose,3400);return()=>window.clearTimeout(id)},[message,onClose]);
 if(!message)return null;
 return <motion.div className="transit-toast" initial={{opacity:0,y:-14}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}><CheckCircle2 size={17}/><span>{message}</span><button onClick={onClose} aria-label="Dismiss"><X size={15}/></button><i/></motion.div>;
}
function StatCard({label,value,icon,detail}:{label:string;value:any;icon:any;detail:string}){
 return <div className="premium-stat"><span>{icon}</span><small>{label}</small><strong>{value}</strong><i>{detail}</i></div>;
}
function PageIntro({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){
 return <div className="premium-page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}
function Field({label,children}:{label:string;children:any}){
 return <label className="premium-field"><span>{label}</span>{children}</label>;
}
function SectionTitle({title,detail}:{title:string;detail:string}){
 return <div className="premium-section-title"><div><h2>{title}</h2><p>{detail}</p></div></div>;
}
function JourneyCard({journey,locations,category,onChoose,now}:{journey:Journey;locations:BusLocation[];category:string;onChoose:(j:Journey)=>void;now:number}){
 const first=journey.legs[0];
 const location=locations.find(l=>l.bus_id===first.bus.id);
 const eta=Math.max(0,first.etaSeconds);
 const status=location?.live_status||'On Time';
 const delay=n(location?.delay_minutes);
 const crowd=crowdLabel(n(location?.occupancy),first.bus.capacity);
 const statusTone=status==='Delayed'?'red':status==='Arriving'?'amber':'green';
 function speak(){
  if(!('speechSynthesis'in window))return;
  const utterance=new SpeechSynthesisUtterance('Bus '+first.bus.registration_number+' is '+status.toLowerCase()+' and reaches '+first.from+' in '+formatEta(eta)+'.');
  window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
 }
 return <motion.article layout className="premium-journey-card" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} whileHover={{y:-4}} transition={{duration:.22}}>
  <div className="premium-journey-top"><div><span className="eyebrow">{journey.transfers?'ONE TRANSFER':'DIRECT JOURNEY'}</span><h3>{journey.legs.map(l=>l.route.route_number).join(' + ')} <small>{journey.transfers?'· Change at '+journey.transferStop:'· Direct'}</small></h3></div><span className={'premium-status '+statusTone}><i/>{status}{delay?' +'+delay+'m':''}</span></div>
  <div className="recommendation-row">{journey.badges.map(b=><span key={b} className={'recommendation '+(b==='Fastest'?'blue':b==='Cheapest'?'green':'amber')}>{b==='Fastest'?'⚡ ':b==='Cheapest'?'₹ ':'◉ '}{b}</span>)}</div>
  <div className="premium-bus-info"><span className="premium-bus-icon"><BusFront size={22}/></span><div><b>{first.bus.registration_number}</b><small>{first.bus.name} · {first.bus.bus_type}</small></div><button className="voice-button" onClick={speak} title="Announce arrival" aria-label="Voice announcement"><Volume2 size={17}/></button><div className="available-seats"><Users size={16}/><b>{first.availableSeats}</b><small>seats left</small></div></div>
  <div className="journey-points">
   {journey.legs.map((leg,i)=><div className="journey-points-leg" key={i}><div className="journey-point-line"><i className="board"/><span><small>BOARD AT</small><b>{leg.from}</b></span></div><div className="journey-connector"><span>{journey.transfers&&i===0?'Transfer at '+journey.transferStop:'Intermediate stops'}</span></div><div className="journey-point-line"><i className="destination"/><span><small>{journey.transfers&&i===0?'CHANGE BUS':'GET OFF AT'}</small><b>{leg.to}</b></span></div></div>)}
  </div>
  <CrowdBar occupancy={n(location?.occupancy)} capacity={first.bus.capacity}/>
  <div className="premium-metrics"><div><IndianRupee size={16}/><b>{money(concessionFare(journey.fare,category))}</b><small>Estimated fare</small></div><div><Clock3 size={16}/><b>{formatMinutes(journey.duration)}</b><small>Journey time</small></div><div><MapPin size={16}/><b>{journey.distance.toFixed(1)} km</b><small>Distance</small></div></div>
  <div className={'premium-eta '+(eta<=120?'soon':'')}><div><span className="live-pulse"/><b>LIVE ETA TO BOARDING STOP</b></div><strong>{eta===0?'At your stop':formatEta(eta)}</strong><small>{eta<=120?'Bus arriving soon':'Estimated time until pickup'}</small><button onClick={()=>onChoose(journey)}>Journey details <ArrowRight size={15}/></button></div>
 </motion.article>;
}
function RouteTimeline({journey,routeStops,stops,locations}:{journey:Journey;routeStops:RouteStop[];stops:Stop[];locations:BusLocation[]}){
 const leg=journey.legs[0],loc=locations.find(l=>l.bus_id===leg.bus.id);
 const entries=routeStops.filter(s=>s.route_id===leg.route.id&&s.sequence_number>=leg.sourceSequence&&s.sequence_number<=leg.destinationSequence).sort((a,b)=>a.sequence_number-b.sequence_number);
 const current=n(loc?.current_stop_sequence,1);
 return <section className="premium-admin-card"><div className="premium-section-title"><div><span className="eyebrow">ROUTE TIMELINE</span><h2>{leg.route.name}</h2></div><span className="premium-status green">LIVE</span></div><div className="premium-timeline">{entries.map((entry,i)=><div className={'premium-timeline-stop '+(current>=entry.sequence_number?'passed':'')+(entry.sequence_number===current+1?' next':'')} key={entry.id}><span>{entry.sequence_number===current+1?<BusFront size={15}/>:<i/>}</span><div><b>{stops.find(s=>s.id===entry.stop_id)?.name||'Bus stop'}</b><small>{i===0?'Boarding stop':i===entries.length-1?'Destination':n(entry.distance_from_previous_km).toFixed(1)+' km segment'}</small></div></div>)}</div></section>;
}
function JourneyTicket({journey,category,onClose}:{journey:Journey;category:string;onClose:()=>void}){
 const fare=concessionFare(journey.fare,category),ticketId='TIQ-'+journey.id.slice(0,10).toUpperCase();
 const ticket={ticketId,route:journey.legs.map(l=>l.route.route_number),from:journey.legs[0].from,to:journey.legs[journey.legs.length-1].to,fare,kind:'SIMULATED DEMO TICKET'};
 return <div className="premium-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><motion.section className="premium-ticket" initial={{opacity:0,scale:.97,y:12}} animate={{opacity:1,scale:1}}><div className="premium-modal-heading"><div><span className="eyebrow">TRANSITIQ · DIGITAL JOURNEY PASS</span><h2>Journey ticket</h2></div><button className="premium-icon-button" onClick={onClose}><X/></button></div><div className="ticket-route"><div><small>FROM</small><b>{ticket.from}</b></div><ArrowRight/><div><small>TO</small><b>{ticket.to}</b></div></div>{journey.legs.map((leg,i)=><div className="ticket-bus" key={i}><BusFront size={17}/><span><b>{leg.bus.registration_number}</b><small>{leg.route.name} · {leg.bus.bus_type}</small></span><strong>{i===0?'BOARD':'TRANSFER'}</strong></div>)}<div className="ticket-stats"><div><small>DISTANCE</small><b>{journey.distance.toFixed(1)} km</b></div><div><small>TIME</small><b>{formatMinutes(journey.duration)}</b></div><div><small>PASSENGER</small><b>{category}</b></div></div><div className="ticket-price"><span>Estimated fare</span><b>{money(fare)}</b></div><div className="ticket-qr"><QRCodeSVG value={JSON.stringify(ticket)} size={112}/><div><b>{ticketId}</b><p>This is a simulator journey pass, not a valid TSRTC ticket.</p></div></div><div className="premium-modal-actions"><button className="secondary-btn" onClick={onClose}>Close</button><button className="primary-btn" onClick={()=>window.print()}><Download size={16}/> Print ticket</button></div></motion.section></div>;
}
function ToastArea({message,onClose}:{message:string;onClose:()=>void}){return <AnimatePresence>{message?<Toast message={message} onClose={onClose}/>:null}</AnimatePresence>}

export default function TransitIQ(){
 const [tab,setTab]=useState<Tab>('Overview');
 const [mobileOpen,setMobileOpen]=useState(false);
 const [buses,setBuses]=useState<TransitBus[]>([]);
 const [routes,setRoutes]=useState<TransitRoute[]>([]);
 const [stops,setStops]=useState<Stop[]>([]);
 const [routeStops,setRouteStops]=useState<RouteStop[]>([]);
 const [fares,setFares]=useState<Fare[]>([]);
 const [locations,setLocations]=useState<BusLocation[]>([]);
 const [searchHistory,setSearchHistory]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [user,setUser]=useState<string|null>(null);
 const [admin,setAdmin]=useState(false);
 const [authOpen,setAuthOpen]=useState(false);
 const [authMode,setAuthMode]=useState<'in'|'up'>('in');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [toast,setToast]=useState('');
 const [notice,setNotice]=useState('');
 const [from,setFrom]=useState('st-mlrit');
 const [to,setTo]=useState('st-gachibowli');
 const [busType,setBusType]=useState('All');
 const [includeTransfers,setIncludeTransfers]=useState(true);
 const [searched,setSearched]=useState(true);
 const [sortBy,setSortBy]=useState('recommended');
 const [selectedJourney,setSelectedJourney]=useState<Journey|null>(null);
 const [selectedRouteId,setSelectedRouteId]=useState('');
 const [ticketOpen,setTicketOpen]=useState(false);
 const [category,setCategory]=useState('General');
 const [liveDemo,setLiveDemo]=useState(false);
 const [now,setNow]=useState(Date.now());
 const [dark,setDark]=useState(false);
 const [language,setLanguage]=useState<'en'|'te'>('en');
 const [fareType,setFareType]=useState('Ordinary');
 const [fareDistance,setFareDistance]=useState('12');
 const [passengers,setPassengers]=useState('1');
 const [nearestMessage,setNearestMessage]=useState('');
 const [busModal,setBusModal]=useState(false);
 const [editingBus,setEditingBus]=useState<string|null>(null);
 const [busForm,setBusForm]=useState<BusForm>(DEFAULT_BUS);
 const [routeForm,setRouteForm]=useState({route_number:'',name:'',average_speed:'28',color:'#2563eb'});
 const [stopForm,setStopForm]=useState<StopForm>({name:'',area:'',latitude:'',longitude:''});
 const [activeRouteId,setActiveRouteId]=useState('');
 const [addStopId,setAddStopId]=useState('');
 const [segmentDistance,setSegmentDistance]=useState('2');
 const [exploreQuery,setExploreQuery]=useState('Hyderabad, Telangana');
 const [exploreRadius,setExploreRadius]=useState('5000');
 const [explorePlace,setExplorePlace]=useState<any>(null);
 const [exploreResults,setExploreResults]=useState<MappedStop[]>([]);
 const [exploreBusy,setExploreBusy]=useState(false);

 const label=L[language];
 const realStops=useMemo(()=>stops.filter(s=>s.data_source!=='demo'),[stops]);
 const orderedStops=useMemo(()=>routeStops.filter(s=>s.route_id===activeRouteId).sort((a,b)=>a.sequence_number-b.sequence_number),[routeStops,activeRouteId]);
 const refreshLive=useCallback(async()=>{
  if(!supabase)return;
  const [b,l]=await Promise.all([supabase.from('buses').select('*').order('registration_number'),supabase.from('bus_locations').select('*')]);
  if(!b.error)setBuses((b.data||[]) as TransitBus[]);
  if(!l.error)setLocations((l.data||[]) as BusLocation[]);
 },[]);
 const loadData=useCallback(async(showLoading=true)=>{
  if(!supabase){setLoading(false);return}
  if(showLoading)setLoading(true);
  const [b,r,s,rs,f,l,h]=await Promise.all([
   supabase.from('buses').select('*').order('registration_number'),
   supabase.from('routes').select('*').order('route_number'),
   supabase.from('stops').select('*').order('name'),
   supabase.from('route_stops').select('*').order('sequence_number'),
   supabase.from('fare_settings').select('*'),
   supabase.from('bus_locations').select('*'),
   supabase.from('journey_searches').select('source_stop_id,destination_stop_id,searched_at').order('searched_at',{ascending:false}).limit(1000)
  ]);
  const firstError=[b.error,r.error,s.error,rs.error,f.error,l.error].find(Boolean);
  if(firstError)setNotice(firstError.message);
  setBuses((b.data||[]) as TransitBus[]);setRoutes((r.data||[]) as TransitRoute[]);
  setStops((s.data||[]) as Stop[]);setRouteStops((rs.data||[]) as RouteStop[]);
  setFares((f.data||[]) as Fare[]);setLocations((l.data||[]) as BusLocation[]);
  setSearchHistory(h.error?[]:h.data||[]);setLoading(false);
 },[]);
 const checkAuth=useCallback(async()=>{
  if(!supabase)return;
  const {data:{user:u}}=await supabase.auth.getUser();
  setUser(u?.email||null);
  if(!u){setAdmin(false);return}
  const {data}=await supabase.from('admin_users').select('user_id').eq('user_id',u.id).maybeSingle();
  setAdmin(!!data);
 },[]);
 useEffect(()=>{
  void loadData();void checkAuth();
  if(!supabase)return;
  const client=supabase;
  const {data:{subscription}}=client.auth.onAuthStateChange(()=>{void checkAuth()});
  const channel=client.channel('transitiq-live-network')
   .on('postgres_changes',{event:'*',schema:'public',table:'bus_locations'},()=>void refreshLive())
   .on('postgres_changes',{event:'*',schema:'public',table:'buses'},()=>void refreshLive())
   .subscribe();
  const polling=window.setInterval(()=>void refreshLive(),5000);
  const clock=window.setInterval(()=>setNow(Date.now()),1000);
  return()=>{subscription.unsubscribe();client.removeChannel(channel);clearInterval(polling);clearInterval(clock)};
 },[loadData,checkAuth,refreshLive]);
 useEffect(()=>{const theme=localStorage.getItem('transitiq-theme');if(theme==='dark')setDark(true);if(localStorage.getItem('transitiq-lang')==='te')setLanguage('te')},[]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('transitiq-theme',dark?'dark':'light')},[dark]);
 useEffect(()=>{localStorage.setItem('transitiq-lang',language)},[language]);
 useEffect(()=>{
  if(!liveDemo||!supabase)return;
  const client=supabase;
  const timer=window.setInterval(async()=>{
   const {error}=await client.rpc('advance_demo_buses');
   if(error)setNotice(error.message);
  },5000);
  return()=>clearInterval(timer);
 },[liveDemo]);
 const journeys=useMemo(()=>findJourneys({from,to,routes,buses,stops:realStops,routeStops,fares,locations,busType,includeTransfers}),[from,to,routes,buses,realStops,routeStops,fares,locations,busType,includeTransfers,now]);
 const sortedJourneys=useMemo(()=>sortJourneys(journeys,sortBy),[journeys,sortBy]);
 const delayedBuses=locations.filter(l=>l.live_status==='Delayed'&&l.delay_minutes>0);
 const runningCount=locations.filter(l=>l.simulation_status==='running').length;
 const popularPairs=useMemo(()=>{
  const map=new Map<string,{name:string;searches:number}>();
  for(const item of searchHistory){const name=(realStops.find(s=>s.id===item.source_stop_id)?.name||'?')+' → '+(realStops.find(s=>s.id===item.destination_stop_id)?.name||'?');const old=map.get(name);map.set(name,{name,searches:(old?.searches||0)+1})}
  return [...map.values()].sort((a,b)=>b.searches-a.searches).slice(0,7);
 },[searchHistory,realStops]);
 const busiestStops=useMemo(()=>{
  const map=new Map<string,number>();
  for(const item of searchHistory){map.set(item.source_stop_id,(map.get(item.source_stop_id)||0)+1);map.set(item.destination_stop_id,(map.get(item.destination_stop_id)||0)+1)}
  return [...map.entries()].map(([id,count])=>({name:realStops.find(s=>s.id===id)?.name||id,count})).sort((a,b)=>b.count-a.count).slice(0,6);
 },[searchHistory,realStops]);
 const occupancyByRoute=useMemo(()=>routes.filter(r=>r.data_source!=='demo').map(route=>{
  const fleet=buses.filter(b=>b.assigned_route_id===route.id);
  const avg=fleet.length?fleet.reduce((sum,b)=>sum+n(locations.find(l=>l.bus_id===b.id)?.occupancy)/Math.max(1,b.capacity)*100,0)/fleet.length:0;
  return {route:route.route_number,occupancy:Math.round(avg)};
 }),[routes,buses,locations]);
 const statusData=[{name:'On Time',value:locations.filter(l=>l.live_status==='On Time').length,color:'#16a34a'},{name:'Arriving',value:locations.filter(l=>l.live_status==='Arriving').length,color:'#d97706'},{name:'Delayed',value:locations.filter(l=>l.live_status==='Delayed').length,color:'#dc2626'}];
 const currentFare=fares.find(f=>f.bus_type===fareType);
 const fareTotal=concessionFare(Math.max(n(currentFare?.minimum_fare,10),n(fareDistance)*n(currentFare?.rate_per_km,1.5))*Math.max(1,n(passengers,1)),category);

 async function setSimulator(enabled:boolean){
  if(!supabase)return;
  const {error}=await supabase.rpc('set_demo_simulation',{p_enabled:enabled});
  if(error){setNotice(error.message);return}
  setLiveDemo(enabled);setToast(enabled?'Live demo started.':'Live demo paused.');void refreshLive();
 }
 async function searchBuses(e?:FormEvent){
  e?.preventDefault();
  if(!from||!to){setNotice('Select both source and destination stops.');return}
  if(from===to){setNotice('Source and destination must be different.');return}
  setSearched(true);setSortBy('recommended');
  const found=findJourneys({from,to,routes,buses,stops:realStops,routeStops,fares,locations,busType,includeTransfers});
  if(supabase&&found.length){const first=found[0];const {error}=await supabase.from('journey_searches').insert({source_stop_id:from,destination_stop_id:to,distance_km:first.distance,estimated_duration_minutes:first.duration,estimated_fare:concessionFare(first.fare,category)});if(error)setNotice(error.message);else{const {data}=await supabase.from('journey_searches').select('source_stop_id,destination_stop_id,searched_at').order('searched_at',{ascending:false}).limit(1000);setSearchHistory(data||[])}}
  setToast(found.length?found.length+' journey option(s) found.':'No direct or one-transfer journey found.');
 }
 function chooseJourney(j:Journey){setSelectedJourney(j);setSelectedRouteId(j.legs[0].route.id);setTab('Journey Estimation' as Tab)}
 function announce(leg:Journey['legs'][number]){
  if(!('speechSynthesis'in window))return;
  window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance('Bus '+leg.bus.registration_number+' is arriving at '+leg.from+' in '+formatEta(leg.etaSeconds)+'.'));
 }
 async function useMyLocation(){
  if(!navigator.geolocation){setNearestMessage('Geolocation is not available in this browser.');return}
  setNearestMessage('Finding the nearest stop…');
  navigator.geolocation.getCurrentPosition(position=>{
   const result=nearestStop(position.coords.latitude,position.coords.longitude,realStops);
   if(result.stop){setFrom(result.stop.id);setNearestMessage(result.stop.name+' · '+result.distanceKm.toFixed(2)+' km away');setToast('Nearest stop selected as source.')}
   else setNearestMessage('No stops are available to compare.');
  },err=>setNearestMessage(err.code===1?'Location permission denied.':'Could not determine your location.'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000});
 }
 async function authSubmit(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  const result=authMode==='in'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password});
  if(result.error){setNotice(result.error.message);return}
  if(authMode==='up'&&!result.data.session){setNotice('Account created. Confirm your email before signing in. Admin access must be approved by the project owner.');return}
  await checkAuth();setAuthOpen(false);setPassword('');setToast('Signed in.');
 }
 async function logout(){await supabase?.auth.signOut();setUser(null);setAdmin(false);setToast('Signed out.')}
 async function saveBus(e:FormEvent){
  e.preventDefault();if(!admin||!supabase){setAuthOpen(true);return}
  if(!busForm.registration_number.trim()||!busForm.name.trim()||busForm.capacity<1){setNotice('Enter a registration number, bus name and valid capacity.');return}
  const payload={registration_number:busForm.registration_number.trim().toUpperCase(),name:busForm.name.trim(),bus_type:busForm.bus_type,capacity:Number(busForm.capacity),driver_name:busForm.driver_name.trim(),assigned_route_id:busForm.assigned_route_id||null,status:busForm.status};
  const result=editingBus?await supabase.from('buses').update(payload).eq('id',editingBus):await supabase.from('buses').insert({...payload,id:'bus-'+crypto.randomUUID(),data_source:'manual'});
  if(result.error){setNotice(result.error.message);return}
  setBusModal(false);setEditingBus(null);setBusForm(DEFAULT_BUS);setToast(editingBus?'Bus details updated.':'Bus registered.');void loadData(false);
 }
 function editBus(bus:TransitBus){setEditingBus(bus.id);setBusForm({registration_number:bus.registration_number,name:bus.name,bus_type:bus.bus_type,capacity:bus.capacity,driver_name:bus.driver_name||'',assigned_route_id:bus.assigned_route_id||'',status:bus.status});setBusModal(true)}
 async function deleteBus(bus:TransitBus){if(!confirm('Delete '+bus.registration_number+'?'))return;const {error}=await supabase!.from('buses').delete().eq('id',bus.id);if(error)setNotice(error.message);else{setToast('Bus deleted.');void loadData(false)}}
 async function createRoute(e:FormEvent){
  e.preventDefault();if(!admin||!supabase){setAuthOpen(true);return}
  if(!routeForm.route_number.trim()||!routeForm.name.trim()){setNotice('Enter a route number and name.');return}
  const {data,error}=await supabase.from('routes').insert({id:'rt-'+crypto.randomUUID(),route_number:routeForm.route_number.trim().toUpperCase(),name:routeForm.name.trim(),average_speed:Number(routeForm.average_speed),color:routeForm.color,status:'Active',data_source:'manual'}).select().single();
  if(error){setNotice(error.message);return}
  setActiveRouteId(data.id);setRouteForm({route_number:'',name:'',average_speed:'28',color:'#2563eb'});setToast('Route created. Add its stops below.');void loadData(false);
 }
 async function createStop(e:FormEvent){
  e.preventDefault();if(!admin||!supabase){setAuthOpen(true);return}
  const lat=Number(stopForm.latitude),lng=Number(stopForm.longitude);
  if(!stopForm.name.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){setNotice('Enter a valid stop name and coordinates.');return}
  const {error}=await supabase.from('stops').insert({id:'st-'+crypto.randomUUID(),name:stopForm.name.trim(),area:stopForm.area.trim()||'India',latitude:lat,longitude:lng,data_source:'manual'});
  if(error)setNotice(error.message);else{setStopForm({name:'',area:'',latitude:'',longitude:''});setToast('Stop added.');void loadData(false)}
 }
 async function addRouteStop(e:FormEvent){
  e.preventDefault();if(!admin||!supabase){setAuthOpen(true);return}
  if(!activeRouteId||!addStopId){setNotice('Select a route and stop.');return}
  if(orderedStops.some(s=>s.stop_id===addStopId)){setNotice('That stop is already in this route.');return}
  const distance=Number(segmentDistance);if(!Number.isFinite(distance)||distance<0){setNotice('Enter a valid segment distance.');return}
  const next=Math.max(0,...orderedStops.map(s=>s.sequence_number))+1;
  const {error}=await supabase.from('route_stops').insert({route_id:activeRouteId,stop_id:addStopId,sequence_number:next,distance_from_previous_km:distance});
  if(error)setNotice(error.message);else{setAddStopId('');setToast('Stop added to route.');void loadData(false)}
 }
 async function reorderStop(index:number,direction:-1|1){
  if(!admin||!supabase)return;
  const target=index+direction;if(target<0||target>=orderedStops.length)return;
  const rows=[...orderedStops];[rows[index],rows[target]]=[rows[target],rows[index]];
  for(let i=0;i<rows.length;i++){const {error}=await supabase.from('route_stops').update({sequence_number:10000+i}).eq('id',rows[i].id);if(error){setNotice(error.message);return}}
  for(let i=0;i<rows.length;i++){const {error}=await supabase.from('route_stops').update({sequence_number:i+1}).eq('id',rows[i].id);if(error){setNotice(error.message);return}}
  setToast('Stop order updated.');void loadData(false);
 }
 async function deleteRouteStop(id:number){if(!confirm('Remove this stop from the route?'))return;const {error}=await supabase!.from('route_stops').delete().eq('id',id);if(error)setNotice(error.message);else void loadData(false)}
 async function deleteRoute(route:TransitRoute){if(!confirm('Delete route '+route.route_number+'?'))return;const {error}=await supabase!.from('routes').delete().eq('id',route.id);if(error)setNotice(error.message);else{setToast('Route deleted.');void loadData(false)}}
 async function exploreIndia(e:FormEvent){
  e.preventDefault();setExploreBusy(true);setExploreResults([]);setExplorePlace(null);
  try{const response=await fetch('/api/india-stops?q='+encodeURIComponent(exploreQuery)+'&radius='+exploreRadius);const data=await response.json();if(!response.ok)throw new Error(data.error||'Stop search unavailable.');setExplorePlace(data.place);setExploreResults(data.stops||[]);setToast(data.count+' mapped stops found.')}
  catch(error:any){setNotice(error.message||'Stop search failed.')}finally{setExploreBusy(false)}
 }
 async function importMappedStops(){
  if(!admin||!supabase){setAuthOpen(true);return}
  const rows=exploreResults.map(s=>({id:'osm-'+s.id,name:s.name,area:explorePlace?.name||'India',latitude:s.latitude,longitude:s.longitude,data_source:'openstreetmap',source_ref:s.source_ref,source_license:'ODbL-1.0',last_verified_at:new Date().toISOString()}));
  const {error}=await supabase.from('stops').upsert(rows,{onConflict:'data_source,source_ref',ignoreDuplicates:true});
  if(error)setNotice(error.message);else{setToast('Mapped stops imported.');void loadData(false)}
 }
 const home=tab==='Overview'||tab==='Route Search';
 const navItems=NAV.filter(item=>(!['Analytics','Bus Registration','Route Management','Data Import'].includes(item)||admin));
 const statusChart=[{name:'On Time',value:locations.filter(l=>l.live_status==='On Time').length,color:'#16a34a'},{name:'Arriving',value:locations.filter(l=>l.live_status==='Arriving').length,color:'#d97706'},{name:'Delayed',value:delayedBuses.length,color:'#dc2626'}];

 return <div className="transitiq-app" data-theme={dark?'dark':'light'}>
  <header className="premium-topbar">
   <button className="mobile-nav-toggle" onClick={()=>setMobileOpen(v=>!v)} aria-label="Toggle navigation">{mobileOpen?<X/>:<Menu/>}</button>
   <button className="premium-brand" onClick={()=>setTab('Overview')}><span><BusFront size={21}/></span><div><b>TRANSITIQ</b><small>SMART MOBILITY NETWORK</small></div></button>
   <nav className={'premium-nav '+(mobileOpen?'mobile-open':'')}>{navItems.map(item=>{const Icon=ICONS[item];return <button key={item} className={tab===item?'active':''} onClick={()=>{setTab(item);setMobileOpen(false)}}><Icon size={15}/>{item}</button>})}</nav>
   <div className="premium-top-actions"><button className="top-icon-btn" onClick={()=>setDark(v=>!v)} aria-label="Toggle dark mode">{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="top-icon-btn language-toggle" onClick={()=>setLanguage(v=>v==='en'?'te':'en')} aria-label="Switch language"><Globe size={16}/><small>{language==='en'?'EN':'తె'}</small></button>{user?<div className="premium-user"><span>{admin?'ADMIN':'PASSENGER'}</span><b>{user}</b><button onClick={logout} aria-label="Logout"><LogOut size={15}/></button></div>:<button className="premium-login" onClick={()=>{setAuthMode('in');setAuthOpen(true)}}><LogIn size={15}/> Login</button>}</div>
  </header>

  {home&&<main className="premium-page">
   {tab==='Overview'&&<section className="premium-hero">
    <div className="premium-hero-copy"><span className="hero-kicker"><i/> SMART TRANSPORTATION · HYDERABAD</span><h1>Move smarter.<br/><em>Arrive with confidence.</em></h1><p>Find your route, compare fares and follow simulated buses across the city — all in one place.</p><button onClick={()=>setTab('Route Search')}>{label.plan} <ArrowRight size={17}/></button><div className="hero-trust"><span><CheckCircle2 size={14}/> Route-aware search</span><span><Radio size={14}/> Realtime simulator</span></div></div>
    <div className="premium-hero-art"><div className="hero-orbit one"/><div className="hero-orbit two"/><div className="hero-bus-emoji">🚌</div><div className="hero-route-line"><i/><i/><i/><i/><i/></div><div className="hero-art-caption"><span className="live-pulse"/> NETWORK ONLINE</div></div>
    <div className="premium-hero-footer"><span>PROJECT 13 · ROLL NO. 513</span><span>Academic simulator · Illustrative route and fare data</span></div>
   </section>}
   <section className="premium-search-panel">
    <div className="premium-search-heading"><div><span className="eyebrow">PASSENGER JOURNEY PLANNER</span><h2>{label.plan}</h2><p>Compare direct buses and one-transfer connections.</p></div><span className="search-panel-icon"><Search size={22}/></span></div>
    <form className="premium-search-form" onSubmit={searchBuses}>
     <StopPicker label={label.from} placeholder={label.source} stops={realStops} value={from} onChange={setFrom}/>
     <button type="button" className="premium-swap" onClick={()=>{setFrom(to);setTo(from)}} aria-label="Swap source and destination"><ArrowDownUp size={19}/></button>
     <StopPicker label={label.to} placeholder={label.destination} stops={realStops} value={to} onChange={setTo}/>
     <button className="primary-btn premium-find" type="submit"><Search size={17}/>{label.find}<ArrowRight size={17}/></button>
    </form>
    <div className="premium-search-tools"><button onClick={useMyLocation}><LocateFixed size={15}/>{label.nearest}</button><label><input type="checkbox" checked={includeTransfers} onChange={e=>setIncludeTransfers(e.target.checked)}/> Include one transfer</label><div><span>BUS TYPE</span><select value={busType} onChange={e=>setBusType(e.target.value)}><option>All</option>{BUS_TYPES.map(t=><option key={t}>{t}</option>)}</select></div><div><span>PASSENGER CATEGORY</span><select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></div></div>
    {nearestMessage&&<p className="nearest-message"><MapPin size={14}/>{nearestMessage}</p>}
   </section>

   {delayedBuses.length>0&&<motion.div className="premium-delay-banner" initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}><AlertTriangle size={18}/><span><b>Service delay alert</b> · {delayedBuses.length} simulated bus(es) delayed. Check the map for details.</span></motion.div>}

   <section className="premium-demo-strip"><div className="premium-demo-copy"><span><Radio size={19}/></span><div><b>{label.live}</b><small>Demo buses advance along their routes every five seconds.</small></div></div><button className={'premium-toggle '+(liveDemo?'on':'')} onClick={()=>void setSimulator(!liveDemo)} aria-pressed={liveDemo}><i/></button><strong>{liveDemo?'RUNNING':'PAUSED'}</strong></section>

   <section className="premium-stat-grid">
    <StatCard label="REGISTERED BUSES" value={buses.filter(b=>b.data_source!=='demo').length} icon={<BusFront/>} detail="Operator / sample fleet"/>
    <StatCard label="ACTIVE ROUTES" value={routes.filter(r=>r.data_source!=='demo').length} icon={<RouteIcon/>} detail="Published route patterns"/>
    <StatCard label="PASSENGER STOPS" value={realStops.length} icon={<MapPin/>} detail="Mapped network locations"/>
    <StatCard label="SIMULATED VEHICLES" value={locations.length} icon={<Activity/>} detail={runningCount+' currently moving'}/>
   </section>

   <section className="premium-results-layout">
    <div className="premium-results-column"><div className="premium-results-heading"><div><span className="eyebrow">{label.results}</span><h2>{sortedJourneys.length} options found</h2><p>{realStops.find(s=>s.id===from)?.name||'Choose source'} <ArrowRight size={14}/> {realStops.find(s=>s.id===to)?.name||'Choose destination'}</p></div><div className="premium-sort"><SlidersHorizontal size={15}/><select value={sortBy} onChange={e=>setSortBy(e.target.value)} aria-label="Sort journey results"><option value="recommended">Recommended</option><option value="fastest">Fastest</option><option value="cheapest">Cheapest</option><option value="crowded">Least crowded</option><option value="earliest">Bus arriving first</option></select></div></div>
     <AnimatePresence mode="popLayout">{loading?<div className="premium-skeletons"><div/><div/></div>:sortedJourneys.length?sortedJourneys.map(j=><JourneyCard key={j.id} journey={j} locations={locations} category={category} now={now} onChoose={chooseJourney}/>):<motion.div className="premium-empty" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}><div>🚌</div><h3>{searched?'No matching journey found':'Ready to plan your trip?'}</h3><p>{searched?'No direct or one-transfer journey matched this stop pair. Try another route.':'Select a source and destination to see buses, estimated fares and arrival times.'}</p><button className="secondary-btn" onClick={()=>{setFrom('st-mlrit');setTo('st-gachibowli');setSearched(true)}}>Try sample journey <ArrowRight size={15}/></button></motion.div>}</AnimatePresence>
    </div>
    <aside className="premium-map-column"><div className="premium-map-heading"><div><span className="eyebrow">{label.map}</span><h2>Explore the network</h2></div><span className="map-live-badge"><i/> LIVE</span></div><Suspense fallback={<div className="premium-map-loading">Loading live map…</div>}><BusMap stops={realStops} routes={routes} buses={buses} routeStops={routeStops} locations={locations} selectedRouteId={selectedRouteId} sourceId={from} destinationId={to} compact/></Suspense><div className="map-legend"><span><i className="blue-dot"/> Boarding stop</span><span><i className="green-dot"/> Destination</span><span><i className="bus-dot"/> Simulated bus</span></div><button className="map-open-btn" onClick={()=>setTab('Bus Tracking')}>Open full map <ArrowRight size={14}/></button></aside>
   </section>
   <p className="premium-disclaimer">TransitIQ is an academic simulator. Route and fare values are illustrative. Simulated vehicles are not live TSRTC GPS. Real vehicle tracking requires an authorized operator feed.</p>
  </main>}

  {tab==='Bus Tracking'&&<main className="premium-page"><PageIntro eyebrow="NETWORK OPERATIONS" title="Live bus tracking" description="Explore stop locations, route paths and moving demo vehicles on OpenStreetMap."/><section className="premium-admin-card"><div className="premium-section-title"><div><span className="eyebrow">OPENSTREETMAP · REALTIME DEMO</span><h2>Hyderabad bus network</h2></div><button className="primary-btn" onClick={()=>void setSimulator(!liveDemo)}>{liveDemo?<X size={16}/>:<Radio size={16}/>} {liveDemo?'Pause simulation':'Start simulation'}</button></div><Suspense fallback={<div className="premium-map-loading">Loading live map…</div>}><BusMap stops={realStops} routes={routes} buses={buses} routeStops={routeStops} locations={locations} selectedRouteId={selectedRouteId}/></Suspense><div className="tracking-meta"><span><i className="live-pulse"/> Realtime bus locations</span><span>Five-second database updates · interpolated animation</span></div></section><div className="tracking-fleet-grid">{buses.filter(b=>b.data_source==='demo').map(bus=>{const loc=locations.find(l=>l.bus_id===bus.id);return <article className="premium-admin-card" key={bus.id}><div className="fleet-row"><BusFront/><b>{bus.registration_number}</b><span className={'premium-status '+(loc?.live_status==='Delayed'?'red':loc?.live_status==='Arriving'?'amber':'green')}>{loc?.live_status||'On Time'}</span></div><p>{bus.name} · {bus.bus_type}</p><CrowdBar occupancy={n(loc?.occupancy)} capacity={bus.capacity}/><small>Stop sequence {loc?.current_stop_sequence||'—'} · +{loc?.delay_minutes||0} min delay</small></article>})}</div></main>}

  {tab==='Bus Registration'&&<main className="premium-page"><PageIntro eyebrow="FLEET MANAGEMENT" title="Bus registration" description="Register vehicles, assign them to routes, update details and maintain availability."/><div className="premium-admin-toolbar"><div><b>{buses.filter(b=>b.data_source!=='demo').length} registered vehicles</b><small>Simulated demo vehicles are kept separate from operator records.</small></div><button className="primary-btn" onClick={()=>{setEditingBus(null);setBusForm(DEFAULT_BUS);setBusModal(true)}}><Plus size={17}/> Register bus</button></div><section className="premium-admin-card"><div className="premium-table-scroll"><table className="premium-table"><thead><tr><th>REGISTRATION</th><th>NAME / TYPE</th><th>ROUTE</th><th>CAPACITY</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{buses.filter(b=>b.data_source!=='demo').map(bus=><tr key={bus.id}><td><b>{bus.registration_number}</b></td><td>{bus.name}<small>{bus.bus_type}</small></td><td>{routes.find(r=>r.id===bus.assigned_route_id)?.route_number||'Unassigned'}</td><td>{n(locations.find(l=>l.bus_id===bus.id)?.occupancy)}/{bus.capacity}</td><td><span className={'premium-status '+(bus.status==='Active'?'green':'amber')}>{bus.status}</span></td><td><div className="premium-table-actions"><button onClick={()=>editBus(bus)} aria-label="Edit bus"><Pencil size={15}/></button><button className="danger" onClick={()=>void deleteBus(bus)} aria-label="Delete bus"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div></section></main>}

  {tab==='Route Management'&&<main className="premium-page"><PageIntro eyebrow="NETWORK DESIGN" title="Route management" description="Create routes, manage stop sequences and edit segment distances."/><div className="premium-admin-two-col"><section className="premium-admin-card"><SectionTitle title="Create a route" detail="Define a route number, route name and average speed."/><form className="premium-form" onSubmit={createRoute}><Field label="ROUTE NUMBER"><input required value={routeForm.route_number} onChange={e=>setRouteForm({...routeForm,route_number:e.target.value})} placeholder="513A"/></Field><Field label="ROUTE NAME"><input required value={routeForm.name} onChange={e=>setRouteForm({...routeForm,name:e.target.value})} placeholder="MLRIT to Gachibowli"/></Field><Field label="AVERAGE SPEED (KM/H)"><input type="number" min="5" max="100" value={routeForm.average_speed} onChange={e=>setRouteForm({...routeForm,average_speed:e.target.value})}/></Field><Field label="ROUTE COLOUR"><input type="color" value={routeForm.color} onChange={e=>setRouteForm({...routeForm,color:e.target.value})}/></Field><button className="primary-btn" type="submit"><Plus size={16}/> Create route</button></form></section><section className="premium-admin-card"><SectionTitle title="Add a stop" detail="Register a stop with its map coordinates."/><form className="premium-form" onSubmit={createStop}><Field label="STOP NAME"><input required value={stopForm.name} onChange={e=>setStopForm({...stopForm,name:e.target.value})}/></Field><Field label="AREA"><input value={stopForm.area} onChange={e=>setStopForm({...stopForm,area:e.target.value})}/></Field><Field label="LATITUDE"><input type="number" step="any" required value={stopForm.latitude} onChange={e=>setStopForm({...stopForm,latitude:e.target.value})}/></Field><Field label="LONGITUDE"><input type="number" step="any" required value={stopForm.longitude} onChange={e=>setStopForm({...stopForm,longitude:e.target.value})}/></Field><button className="secondary-btn" type="submit"><Plus size={16}/> Add stop</button></form></section></div>
   <section className="premium-admin-card"><div className="premium-section-title"><div><span className="eyebrow">ROUTE EDITOR</span><h2>Configure stop sequence</h2></div><select className="premium-select" value={activeRouteId} onChange={e=>setActiveRouteId(e.target.value)}><option value="">Choose route</option>{routes.map(r=><option key={r.id} value={r.id}>{r.route_number} · {r.name}</option>)}</select></div>{activeRouteId&&<form className="premium-add-stop" onSubmit={addRouteStop}><select value={addStopId} onChange={e=>setAddStopId(e.target.value)}><option value="">Choose stop to add</option>{realStops.filter(s=>!orderedStops.some(o=>o.stop_id===s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><label>Segment km<input type="number" min="0" step=".1" value={segmentDistance} onChange={e=>setSegmentDistance(e.target.value)}/></label><button className="primary-btn"><Plus size={15}/> Add stop</button></form>}{activeRouteId?orderedStops.map((entry,index)=><div className="premium-route-stop" key={entry.id}><span>{index+1}</span><div><b>{realStops.find(s=>s.id===entry.stop_id)?.name||entry.stop_id}</b><small>{n(entry.distance_from_previous_km).toFixed(1)} km from previous stop</small></div><div className="premium-sequence-actions"><button disabled={index===0} onClick={()=>void reorderStop(index,-1)} aria-label="Move stop up"><ChevronUp size={16}/></button><button disabled={index===orderedStops.length-1} onClick={()=>void reorderStop(index,1)} aria-label="Move stop down"><ChevronDown size={16}/></button><button className="danger" onClick={()=>void deleteRouteStop(entry.id)} aria-label="Remove stop"><Trash2 size={15}/></button></div></div>):<div className="premium-empty-inline">Choose a route to edit its stops.</div>}</section>
   <section className="premium-admin-card"><SectionTitle title="Route directory" detail="Existing active and inactive network routes."/><div className="premium-route-directory">{routes.filter(r=>r.data_source!=='demo').map(r=><div key={r.id}><i style={{background:r.color||'#2563eb'}}/><span><b>{r.route_number} · {r.name}</b><small>{routeStops.filter(s=>s.route_id===r.id).length} stops · {r.average_speed} km/h</small></span><strong className={'premium-status '+(r.status==='Active'?'green':'amber')}>{r.status}</strong><button className="danger-icon" onClick={()=>void deleteRoute(r)} aria-label="Delete route"><Trash2 size={16}/></button></div>)}</div></section>
  </main>}

  {tab==='Analytics'&&<main className="premium-page"><PageIntro eyebrow="NETWORK INTELLIGENCE" title="Analytics dashboard" description="Passenger demand, fleet status, occupancy and busiest stops from Supabase records."/><div className="premium-stat-grid four"><StatCard label="TOTAL SEARCHES" value={searchHistory.length} icon={<Search/>} detail="Recorded journey searches"/><StatCard label="TRACKED VEHICLES" value={locations.length} icon={<BusFront/>} detail="Bus location records"/><StatCard label="DELAYED BUSES" value={delayedBuses.length} icon={<AlertTriangle/>} detail="Current simulated delays"/><StatCard label="AVG OCCUPANCY" value={(locations.length?Math.round(locations.reduce((sum,l)=>{const bus=buses.find(b=>b.id===l.bus_id);return sum+(bus?l.occupancy/Math.max(1,bus.capacity)*100:0)},0)/locations.length):0)+'%'} icon={<Users/>} detail="Across tracked buses"/></div><Suspense fallback={<div className="premium-admin-card">Loading analytics charts…</div>}><AnalyticsCharts popularPairs={popularPairs} statusChart={statusChart} occupancyByRoute={occupancyByRoute} busiestStops={busiestStops}/></Suspense></main>}{tab==='Fare Calculator'&&<main className="premium-page"><PageIntro eyebrow="FARE ESTIMATION" title="Fare calculator" description="Calculate an illustrative fare using bus type, distance and passenger category."/><div className="premium-fare-layout"><section className="premium-admin-card"><SectionTitle title="Trip details" detail="Change the values to calculate your estimated total."/><div className="premium-form"><Field label="BUS CATEGORY"><select value={fareType} onChange={e=>setFareType(e.target.value)}>{BUS_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field><Field label="DISTANCE (KM)"><input type="number" min="0" step=".1" value={fareDistance} onChange={e=>setFareDistance(e.target.value)}/></Field><Field label="PASSENGERS"><input type="number" min="1" max="20" value={passengers} onChange={e=>setPassengers(e.target.value)}/></Field><Field label="PASSENGER CATEGORY"><select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field></div></section><section className="premium-fare-result"><span>ESTIMATED TOTAL</span><strong>{money(fareTotal)}</strong><p>{fareType} · {fareDistance} km · {passengers} passenger(s)</p><div><span>Rate per km</span><b>{money(n(currentFare?.rate_per_km,1.5))}</b></div><div><span>Minimum fare</span><b>{money(n(currentFare?.minimum_fare,10))}</b></div><div><span>Passenger category</span><b>{category}</b></div><small>Rates are illustrative and are not official transport tariffs.</small></section></div></main>}

  {tab==='Journey Estimation'&&<main className="premium-page"><PageIntro eyebrow="YOUR JOURNEY" title="Journey estimation" description="Review your selected route, estimate and digital demo ticket." />{selectedJourney?<div className="premium-estimate-grid"><section className="premium-admin-card"><div className="premium-total-fare"><div><span className="eyebrow">ESTIMATED JOURNEY FARE</span><strong>{money(concessionFare(selectedJourney.fare,category))}</strong><small>{category} category · illustrative fare</small></div><button className="primary-btn" onClick={()=>setTicketOpen(true)}><Ticket size={16}/> Generate ticket</button></div><div className="premium-estimate-stats"><StatCard label="DISTANCE" value={selectedJourney.distance.toFixed(1)+' km'} icon={<Navigation/>} detail="Total journey distance"/><StatCard label="DURATION" value={formatMinutes(selectedJourney.duration)} icon={<Clock3/>} detail="Includes transfer wait"/><StatCard label="TRANSFERS" value={selectedJourney.transfers} icon={<RouteIcon/>} detail={selectedJourney.transfers?'One connection':'Direct journey'}/></div>{selectedJourney.legs.map((leg,i)=><div className="premium-leg-summary" key={i}><BusFront/><span><b>{leg.bus.registration_number} · {leg.route.name}</b><small>{leg.from} → {leg.to} · {leg.bus.bus_type}</small></span><strong>{money(concessionFare(leg.fare,category))}</strong></div>)}{selectedJourney.transferStop&&<p className="premium-transfer-note">Change buses at {selectedJourney.transferStop}. A five-minute connection wait is included.</p>}</section><RouteTimeline journey={selectedJourney} routeStops={routeStops} stops={realStops} locations={locations}/></div>:<div className="premium-empty-inline">Search for a route and choose a result card to see its journey estimate.</div>}</main>}

  {tab==='Data Import'&&<main className="premium-page"><PageIntro eyebrow="OPEN DATA" title="Explore bus stops across India" description="Discover mapped stops by city, town, locality or PIN code. This is geographic discovery, not a complete national register."/><section className="premium-admin-card"><form className="premium-explore-form" onSubmit={exploreIndia}><Field label="CITY / PLACE / PIN CODE"><input required value={exploreQuery} onChange={e=>setExploreQuery(e.target.value)} placeholder="e.g. Vijayawada, Andhra Pradesh"/></Field><Field label="SEARCH RADIUS"><select value={exploreRadius} onChange={e=>setExploreRadius(e.target.value)}><option value="2000">2 km</option><option value="5000">5 km</option><option value="10000">10 km</option></select></Field><button className="primary-btn" disabled={exploreBusy}>{exploreBusy?<RefreshCw className="spin"/>:<Search/>}{exploreBusy?'Searching…':'Find mapped stops'}</button></form>{explorePlace&&<><div className="explore-result-head"><b>{explorePlace.name}</b><span>{exploreResults.length} mapped stops</span></div><div className="explore-stop-list">{exploreResults.slice(0,150).map(s=><div key={s.source_ref}><MapPin size={15}/><span><b>{s.name}</b><small>{s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}{s.operator?' · '+s.operator:''}</small></span><small>OSM</small></div>)}</div>{exploreResults.length>150&&<p>Showing the first 150 mapped results.</p>}<button className="primary-btn" disabled={!admin||!exploreResults.length} onClick={()=>void importMappedStops()}>Import {exploreResults.length} mapped stops to Supabase</button>{!admin&&<small>Administrator access is required to import stops.</small>}</>}</section><section className="premium-admin-card"><SectionTitle title="Official agency GTFS data" detail="The original GTFS ZIP importer and full India stop workbench are preserved in the data workbench below."/><Suspense fallback={<div className="premium-map-loading">Loading India and GTFS data tools…</div>}><LegacyWorkspace/></Suspense></section><p className="premium-disclaimer">OpenStreetMap © contributors · Open Database License (ODbL). Import only transport feeds whose licence permits your intended use.</p></main>}

  <footer className="premium-footer"><div><BusFront size={18}/><b>TRANSITIQ</b></div><span>SMART BUS TRACKING & PASSENGER INFORMATION SIMULATOR</span><small>PROJECT 13 · ROLL 513</small></footer>

  {busModal&&<div className="premium-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setBusModal(false)}}><motion.section className="premium-admin-modal" initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}}><div className="premium-modal-heading"><div><span className="eyebrow">FLEET OPERATIONS</span><h2>{editingBus?'Edit bus':'Register a bus'}</h2></div><button className="premium-icon-button" onClick={()=>setBusModal(false)} aria-label="Close"><X/></button></div><form className="premium-form" onSubmit={saveBus}><Field label="REGISTRATION NUMBER"><input required value={busForm.registration_number} onChange={e=>setBusForm({...busForm,registration_number:e.target.value.toUpperCase()})} placeholder="TS09UA1234"/></Field><Field label="BUS NAME"><input required value={busForm.name} onChange={e=>setBusForm({...busForm,name:e.target.value})}/></Field><Field label="BUS TYPE"><select value={busForm.bus_type} onChange={e=>setBusForm({...busForm,bus_type:e.target.value})}>{BUS_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field><Field label="CAPACITY"><input type="number" min="1" max="100" value={busForm.capacity} onChange={e=>setBusForm({...busForm,capacity:n(e.target.value)})}/></Field><Field label="DRIVER NAME"><input value={busForm.driver_name} onChange={e=>setBusForm({...busForm,driver_name:e.target.value})}/></Field><Field label="ASSIGNED ROUTE"><select value={busForm.assigned_route_id} onChange={e=>setBusForm({...busForm,assigned_route_id:e.target.value})}><option value="">Unassigned</option>{routes.map(r=><option key={r.id} value={r.id}>{r.route_number} · {r.name}</option>)}</select></Field><Field label="SERVICE STATUS"><select value={busForm.status} onChange={e=>setBusForm({...busForm,status:e.target.value})}><option>Active</option><option>Inactive</option><option>Maintenance</option></select></Field><div className="premium-modal-actions"><button type="button" className="secondary-btn" onClick={()=>setBusModal(false)}>Cancel</button><button className="primary-btn">{editingBus?'Save changes':'Register bus'}</button></div></form></motion.section></div>}

  {authOpen&&<div className="premium-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAuthOpen(false)}}><motion.section className="premium-auth-modal" initial={{opacity:0,y:14,scale:.98}} animate={{opacity:1,y:0,scale:1}}><button className="premium-icon-button auth-close" onClick={()=>setAuthOpen(false)} aria-label="Close login"><X/></button><div className="premium-auth-logo"><BusFront size={28}/></div><span className="eyebrow">SECURE NETWORK ACCESS</span><h2>{authMode==='in'?'Welcome back':'Create an account'}</h2><p>Sign in as a passenger or approved administrator.</p><form className="premium-form" onSubmit={authSubmit}><Field label="EMAIL ADDRESS"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></Field><Field label="PASSWORD"><input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></Field><button className="primary-btn"><LogIn size={16}/>{authMode==='in'?'Sign in':'Create account'}</button></form><button className="premium-auth-switch" onClick={()=>setAuthMode(v=>v==='in'?'up':'in')}>{authMode==='in'?'New passenger? Create an account':'Already registered? Sign in'}</button><small className="premium-auth-note">New accounts do not receive admin permission automatically. The project owner controls the Supabase admin allowlist.</small></motion.section></div>}

  {ticketOpen&&selectedJourney&&<JourneyTicket journey={selectedJourney} category={category} onClose={()=>setTicketOpen(false)}/>}
  <ToastArea message={toast} onClose={()=>setToast('')}/>
  {notice&&<div className="premium-notice" role="alert"><AlertTriangle size={16}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
 </div>;
}
