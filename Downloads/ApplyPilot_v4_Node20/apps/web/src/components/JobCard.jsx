import { useState } from "react";
import ScoreRing from "./ScoreRing.jsx";
import AnswerPanel from "./AnswerPanel.jsx";

export default function JobCard({ job, onStatus }) {
  const [answersOpen, setAnswersOpen] = useState(false);
  const resume = job.recommendedResumeId;
  const copyCmd = () => navigator.clipboard.writeText(`npm run autofill -- --job ${job._id}`);
  return <article className="job-card panel">
    <div className="job-main">
      <ScoreRing score={job.matchScore} />
      <div className="job-copy">
        <div className="job-topline"><span className="source-pill">{job.sourceType || job.source}</span><span className={`status-dot status-${job.status}`}>{job.status}</span></div>
        <h3>{job.title}</h3><p className="company-line">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
        {job.aiSummary && <p className="ai-summary">{job.aiSummary}</p>}
        <div className="reason-list">{(job.matchReasons || []).slice(0,4).map((r,i)=><span key={i}>✓ {r}</span>)}</div>
        {resume && <div className="resume-rec">Recommended resume: <strong>{resume.name}</strong></div>}
      </div>
    </div>
    <div className="job-actions">
      <a href={job.url} target="_blank" rel="noreferrer" className="primary-btn">Open job</a>
      <button onClick={copyCmd}>Copy autofill command</button>
      <button onClick={()=>setAnswersOpen(v=>!v)}>{answersOpen?"Hide answers":"Application answers"}</button>
      <select value={job.status} onChange={e=>onStatus(job._id,e.target.value)}><option value="new">New</option><option value="shortlisted">Shortlisted</option><option value="applied">Applied</option><option value="interview">Interview</option><option value="offer">Offer</option><option value="rejected">Rejected</option><option value="skipped">Skipped</option></select>
    </div>
    {answersOpen && <AnswerPanel job={job} />}
  </article>;
}
