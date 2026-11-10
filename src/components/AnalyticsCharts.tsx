import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,PieChart,Pie,Cell} from 'recharts';

type Props={
 popularPairs:{name:string;searches:number}[];
 statusChart:{name:string;value:number;color:string}[];
 occupancyByRoute:{route:string;occupancy:number}[];
 busiestStops:{name:string;count:number}[];
};
export default function AnalyticsCharts({popularPairs,statusChart,occupancyByRoute,busiestStops}:Props){
 return <div className="premium-analytics-grid">
  <section className="premium-chart-card"><h3>Most searched journeys</h3><p>Top source and destination pairs</p><ResponsiveContainer width="100%" height={265}><BarChart data={popularPairs}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{fontSize:9}} angle={-12} textAnchor="end" height={65}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="searches" name="Searches" fill="#2563eb" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></section>
  <section className="premium-chart-card"><h3>Bus service status</h3><p>Live simulated vehicle states</p><ResponsiveContainer width="100%" height={245}><PieChart><Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={57} outerRadius={91} paddingAngle={4}>{statusChart.map(s=><Cell key={s.name} fill={s.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="premium-chart-legend">{statusChart.map(s=><span key={s.name}><i style={{background:s.color}}/>{s.name} · {s.value}</span>)}</div></section>
  <section className="premium-chart-card"><h3>Average occupancy by route</h3><p>Percentage of registered capacity</p><ResponsiveContainer width="100%" height={265}><BarChart data={occupancyByRoute}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="route" tick={{fontSize:10}}/><YAxis domain={[0,100]} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="occupancy" name="Occupancy %" fill="#0f766e" radius={[7,7,0,0]}/></BarChart></ResponsiveContainer></section>
  <section className="premium-chart-card"><h3>Busiest passenger stops</h3><p>Appearances in recorded searches</p><ResponsiveContainer width="100%" height={265}><BarChart data={busiestStops} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fontSize:10}}/><YAxis type="category" dataKey="name" width={105} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="count" name="Search appearances" fill="#7c3aed" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer></section>
 </div>;
}
