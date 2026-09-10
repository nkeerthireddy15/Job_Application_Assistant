import { useState } from "react";
import { api } from "../lib/api.js";
export default function AnswerPanel({ job }) {
  const [question,setQuestion]=useState(""); const [answer,setAnswer]=useState(""); const [busy,setBusy]=useState(false);
  async function generate(){if(!question.trim())return;setBusy(true);try{const r=await api(`/answers/${job._id}/generate`,{method:"POST",body:JSON.stringify({question})});setAnswer(r.data.answer);}finally{setBusy(false);}}
  return <div className="answer-box"><strong>Application answer assistant</strong><textarea placeholder="Paste an application question…" value={question} onChange={e=>setQuestion(e.target.value)}/><button onClick={generate} disabled={busy}>{busy?"Generating…":"Generate truthful answer"}</button>{answer&&<><textarea className="answer-output" value={answer} onChange={e=>setAnswer(e.target.value)}/><button onClick={()=>navigator.clipboard.writeText(answer)}>Copy answer</button></>}</div>;
}
