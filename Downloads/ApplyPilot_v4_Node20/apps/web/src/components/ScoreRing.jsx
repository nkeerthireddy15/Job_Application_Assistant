export default function ScoreRing({ score }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="score-ring" style={{ "--score": `${clamped * 3.6}deg` }}>
      <div className="score-inner">
        <strong>{clamped}%</strong>
        <span>match</span>
      </div>
    </div>
  );
}
