import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function ResumeManager() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", targetRoles: "", targetSkills: "", isDefault: true });
  const [file, setFile] = useState(null);
  const load = async () => setItems((await api("/resumes")).data);
  useEffect(() => { load(); }, []);
  async function submit(e) {
    e.preventDefault();
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
    body.append("resume", file);
    await api("/resumes", { method: "POST", body });
    setFile(null); setForm({ name: "", targetRoles: "", targetSkills: "", isDefault: false }); load();
  }
  return <section className="panel stack">
    <div className="section-head"><div><span className="eyebrow">Resume routing</span><h2>Multiple resumes</h2></div><span className="muted">ApplyPilot recommends the best resume per role.</span></div>
    <form className="form-grid" onSubmit={submit}>
      <input required placeholder="Resume name e.g. MERN / React Native" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Target roles, comma separated" value={form.targetRoles} onChange={e => setForm({ ...form, targetRoles: e.target.value })} />
      <input placeholder="Target skills, comma separated" value={form.targetSkills} onChange={e => setForm({ ...form, targetSkills: e.target.value })} />
      <input required type="file" accept=".pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0])} />
      <label className="check"><input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /> Default resume</label>
      <button className="primary-btn">Upload resume</button>
    </form>
    <div className="list-table">{items.map(r => <div className="list-row" key={r._id}><div><strong>{r.name}</strong><span>{r.originalName}</span></div><div className="chips">{r.isDefault && <span className="chip good">Default</span>}{(r.targetSkills || []).slice(0,3).map(x => <span className="chip" key={x}>{x}</span>)}</div><div className="row-actions">{!r.isDefault && <button onClick={async()=>{await api(`/resumes/${r._id}/default`,{method:"PATCH"});load();}}>Make default</button>}<button onClick={async()=>{await api(`/resumes/${r._id}`,{method:"DELETE"});load();}}>Delete</button></div></div>)}</div>
  </section>;
}
