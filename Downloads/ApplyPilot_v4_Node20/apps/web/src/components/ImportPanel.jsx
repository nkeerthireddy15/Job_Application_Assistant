import { useState } from "react";
import { api } from "../lib/api.js";

export default function ImportPanel({ onImported }) {
  const [greenhouse, setGreenhouse] = useState("");
  const [lever, setLever] = useState("");
  const [message, setMessage] = useState("");

  async function run(path, body) {
    setMessage("Importing…");
    try {
      const result = await api(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(`Imported ${result.saved} jobs (${result.fetched} fetched).`);
      onImported?.();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="panel">
      <div className="eyebrow">Job sources</div>
      <h2>Import public career boards</h2>
      <p className="muted">Use a Greenhouse board token or Lever site slug from a company careers page. Imports are deduplicated and rescored automatically.</p>
      <div className="import-row">
        <input placeholder="Greenhouse board token, e.g. company" value={greenhouse} onChange={(e) => setGreenhouse(e.target.value)} />
        <button className="secondary-btn" onClick={() => run("/jobs/import/greenhouse", { boardToken: greenhouse })}>Import Greenhouse</button>
      </div>
      <div className="import-row">
        <input placeholder="Lever site slug, e.g. company" value={lever} onChange={(e) => setLever(e.target.value)} />
        <button className="secondary-btn" onClick={() => run("/jobs/import/lever", { site: lever })}>Import Lever</button>
      </div>
      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}
