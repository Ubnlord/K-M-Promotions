import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import { Activity, MousePointerClick, Package, Megaphone, Mail, TrendingUp, CircleDollarSign, ShoppingCart } from 'lucide-react';

type Daily = { date:string; clicks:number };
type Recent = { id:string; productName:string; createdAt:string };
type Analytics = { totalClicks:number; clicks7:number; previous7:number; liveOffers:number; campaigns:number; enquiries:number; daily:Daily[]; recent:Recent[] };
const empty:Analytics={totalClicks:0,clicks7:0,previous7:0,liveOffers:0,campaigns:0,enquiries:0,daily:[],recent:[]};
export default function AdminAnalytics(){
 const [data,setData]=useState<Analytics>(empty),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const r=await api.get('/api/admin/analytics');setData({...empty,...r.data});}catch{setError('Performance data could not be loaded. Please refresh.');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const max=Math.max(1,...data.daily.map(d=>d.clicks));
 const change=data.previous7?((data.clicks7-data.previous7)/data.previous7)*100:null;
 return <div className="analytics-dashboard">
  <div className="analytics-head"><div><h3>Publisher performance</h3><p>Real outbound affiliate clicks recorded by K-M.</p></div><button className="button button-quiet" onClick={load}>↻ Refresh</button></div>
  {error&&<p className="error-text">{error}</p>}
  <div className="analytics-kpis">
   <article><span><MousePointerClick size={15}/> Total clicks</span><strong>{loading?'—':data.totalClicks.toLocaleString()}</strong><small>All recorded outbound visits</small></article>
   <article><span><TrendingUp size={15}/> Last 7 days</span><strong>{loading?'—':data.clicks7.toLocaleString()}</strong><small>{change===null?'Comparison unavailable':(change>=0?'+':'')+change.toFixed(1)+'% vs previous 7 days'}</small></article>
   <article><span><Package size={15}/> Live offers</span><strong>{loading?'—':data.liveOffers}</strong><small>Published product listings</small></article>
   <article><span><Megaphone size={15}/> Active campaigns</span><strong>{loading?'—':data.campaigns}</strong><small>Campaigns currently active</small></article>
   <article><span><Mail size={15}/> Enquiries</span><strong>{loading?'—':data.enquiries}</strong><small>Saved promotion enquiries</small></article>
  </div>
  <div className="analytics-chart-card"><div className="analytics-card-title"><div><h4>Click performance</h4><p>Daily outbound clicks · last 30 days</p></div><span>30 DAYS</span></div>
   {loading?<p className="empty-state">Loading performance…</p>:<div className="click-chart" role="img" aria-label="Bar chart showing daily affiliate clicks over the last 30 days">{data.daily.map(d=><div className="click-bar-wrap" key={d.date} title={d.date+': '+d.clicks+' clicks'}><div className="click-bar" style={{height:Math.max(3,d.clicks/max*100)+'%'}}/><small>{new Date(d.date+'T12:00:00').getDate()}</small></div>)}</div>}
   <div className="chart-legend"><span><i/> Outbound clicks</span><span>Dates shown by day of month</span></div>
  </div>
  <div className="analytics-lower">
   <div className="analytics-chart-card"><div className="analytics-card-title"><div><h4>Recent activity</h4><p>Latest tracked affiliate visits</p></div><Activity size={17}/></div>
    {loading?<p className="empty-state">Loading activity…</p>:data.recent.length===0?<p className="empty-state">No affiliate clicks recorded yet. Visit a published offer on your public website to start collecting activity.</p>:<div className="recent-clicks">{data.recent.map(item=><div className="recent-click" key={item.id}><span className="recent-click-icon"><MousePointerClick size={15}/></span><div><strong>{item.productName}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><span className="activity-tag">Click</span></div>)}</div>}
   </div>
   <div className="analytics-chart-card data-integrity"><div className="analytics-card-title"><div><h4>Sales & payouts</h4><p>Affiliate network reconciliation</p></div><CircleDollarSign size={18}/></div><div className="unavailable-metric"><ShoppingCart size={20}/><strong>Not connected</strong><span>Sales, conversion rate, revenue, EPC and payout amounts are not reported by click tracking alone.</span></div><p className="integration-hint">Connect an affiliate network API or conversion postback to display verified commissions and payout data here.</p></div>
  </div>
 </div>;
}