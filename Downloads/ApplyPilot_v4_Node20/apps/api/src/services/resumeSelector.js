const norm = (v = "") => String(v).toLowerCase();
export function selectResume(job, resumes = []) {
  if (!resumes.length) return null;
  const text = norm(`${job.title} ${job.description}`);
  let best = null;
  let bestScore = -1;
  for (const resume of resumes) {
    let score = resume.isDefault ? 1 : 0;
    for (const role of resume.targetRoles || []) if (text.includes(norm(role))) score += 8;
    for (const skill of resume.targetSkills || []) if (text.includes(norm(skill))) score += 3;
    if (score > bestScore) { best = resume; bestScore = score; }
  }
  return best;
}
