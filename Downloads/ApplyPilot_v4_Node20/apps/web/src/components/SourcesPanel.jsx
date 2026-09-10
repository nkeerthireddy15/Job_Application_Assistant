import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
export default function SourcesPanel({ onChange }) {
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState({ name:"", type:"greenhouse", value:"", company:"" });
  const [msg, setMsg] = useState("");
  const load = async () => setSources((await api("/sources")).data);
  useEffect(()=>{load();},[]);
  async function add(e){e.preventDefault();await api("/sources",{method:"POST",body:JSON.stringify(form)});setForm({name:"",type:"greenhouse",value:"",company:""});load();}
  async function run(id){setMsg("Running source…");const r=await api(`/sources/${id}/run`,{method:"POST",body:JSON.stringify({minScore:45})});setMsg(`Fetched ${r.fetched}, saved ${r.saved}.`);load();onChange?.();}
  return <section className="panel stack"><div className="section-head"><div><span className="eyebrow">Reliable ATS feeds</span><h2>Career sources</h2></div></div>
    <form className="source-form" onSubmit={add}><input required placeholder="Name e.g. Razorpay" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>greenhouse</option><option>lever</option><option>ashby</option><option>workable</option></select><input required placeholder="Board token / site / subdomain" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/><input placeholder="Company display name" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/><button className="primary-btn">Add source</button></form>
    {msg && <div className="notice">{msg}</div>}
    <div className="list-table">{sources.map(s=><div className="list-row" key={s._id}><div><strong>{s.name}</strong><span>{s.type}:{s.value}</span></div><div><span className={`chip ${s.lastError?"bad":"good"}`}>{s.lastError?"Error":s.enabled?"Enabled":"Paused"}</span><span className="muted small">Last: {s.lastFetched || 0} fetched</span></div><div className="row-actions"><button onClick={()=>run(s._id)}>Run</button><button onClick={async()=>{await api(`/sources/${s._id}`,{method:"PATCH",body:JSON.stringify({enabled:!s.enabled})});load();}}>{s.enabled?"Pause":"Enable"}</button><button onClick={async()=>{await api(`/sources/${s._id}`,{method:"DELETE"});load();}}>Delete</button></div></div>)}</div>
  </section>;
}
