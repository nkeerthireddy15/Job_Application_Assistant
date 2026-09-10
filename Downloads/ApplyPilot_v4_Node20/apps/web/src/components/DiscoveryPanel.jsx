import {
  useState,
} from "react";

import {
  api,
} from "../lib/api.js";

export default function DiscoveryPanel({
  onDone,
}) {
  const [running, setRunning] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState("");

  const [useAI, setUseAI] =
    useState(false);

  const [minScore, setMinScore] =
    useState(55);

  async function run() {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      const response =
        await api(
          "/discovery/run",
          {
            method: "POST",

            body: JSON.stringify({
              useAI,
              minScore,
              maxJobs: 500,
            }),
          }
        );

      console.log(
        "Discovery response:",
        response
      );

      setResult(response);

      onDone?.();
    } catch (err) {
      console.error(
        "Discovery failed:",
        err
      );

      setError(
        err?.message ||
          "Discovery failed"
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel discovery-card">
      <div>
        <span className="eyebrow">
          Daily collector
        </span>

        <h2>
          Build today’s shortlist
        </h2>

        <p>
          Searches enabled ATS
          sources and public web
          results, then ranks jobs
          against your profile.
        </p>

        <p
          style={{
            marginTop: 10,
            opacity: 0.7,
            fontSize: 14,
          }}
        >
          Priority sources include direct company ATS, Cutshort, Instahyre, Hirist, Wellfound and YC startup jobs, with Naukri, Indeed and LinkedIn used for additional coverage.
        </p>
      </div>

      <div className="discovery-controls">
        <label>
          Minimum score{" "}
          <strong>
            {minScore}%
          </strong>

          <input
            type="range"
            min="30"
            max="90"
            step="5"
            value={minScore}
            onChange={(event) =>
              setMinScore(
                Number(
                  event.target.value
                )
              )
            }
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={useAI}
            onChange={(event) =>
              setUseAI(
                event.target.checked
              )
            }
          />

          Gemini semantic rescoring
        </label>

        <button
          className="primary-btn large"
          disabled={running}
          onClick={run}
        >
          {running
            ? "Collecting jobs..."
            : "Run discovery now"}
        </button>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              background:
                "rgba(255,80,80,0.08)",
              color: "#ff9d9d",
              fontSize: 14,
            }}
          >
            ❌ {error}
          </div>
        )}

        {result && (
          <div
            className="result-line"
            style={{
              marginTop: 12,
              lineHeight: 1.7,
            }}
          >
            <div>
              <strong>
                {result.saved ?? 0}
              </strong>{" "}
              saved
            </div>

            <div>
              {result.fetched ?? 0}{" "}
              unique jobs fetched
            </div>

            <div>
              {result.serperFetched ??
                0}{" "}
              from web discovery
            </div>

            <div>
              {result.atsFetched ??
                0}{" "}
              from ATS sources
            </div>

            <div>
              {result.ignored ??
                0}{" "}
              below minimum score
            </div>

            {!result.serperEnabled && (
              <div
                style={{
                  marginTop: 8,
                  color: "#ffc96b",
                }}
              >
                ⚠ SERPER_API_KEY is
                not configured.
              </div>
            )}

            {Array.isArray(
              result.errors
            ) &&
              result.errors.length >
                0 && (
                <div
                  style={{
                    marginTop: 10,
                    color:
                      "#ff9f9f",
                  }}
                >
                  {result.errors.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${item}-${index}`}
                      >
                        ⚠ {item}
                      </div>
                    )
                  )}
                </div>
              )}

            {result.fetched ===
              0 &&
              result.serperEnabled && (
                <div
                  style={{
                    marginTop: 10,
                    color:
                      "#ffc96b",
                  }}
                >
                  No jobs were returned.
                  Check the API terminal
                  logs for Serper search
                  results.
                </div>
              )}
          </div>
        )}
      </div>
    </section>
  );
}