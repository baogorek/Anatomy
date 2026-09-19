import { useEffect, useRef, useState } from "react";
import {
  deltaText,
  type ModelConfig,
  type ModelPose,
  type PoseRequest,
} from "./biomechanics";

type Result = {
  region: string;
  version: string;
  muscle: string;
  coordinates: Record<string, number>;
  startLength: number;
  length: number;
  gain: number;
  evaluations: number;
  budgetLimited: boolean;
  atLimits: string[];
  pose: ModelPose;
};
type Props = {
  config: ModelConfig;
  pose: ModelPose;
  request: PoseRequest;
  selected: string;
  disabled: boolean;
  active: boolean;
  onApply: (request: PoseRequest) => void;
};
const endpoint = "/api/biomechanics/longest-path";
// An opaque per-tab owner keeps one visitor from polling/cancelling another's job.
const searchSession = crypto.randomUUID();
const searchHeaders = { "X-Movement-Session": searchSession };
async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(body.error || "The path search is unavailable. Try again.");
  return body;
}
function cancelJob(id?: string) {
  if (id)
    void fetch(`${endpoint}/${id}`, {
      method: "DELETE",
      headers: searchHeaders,
      keepalive: true,
    }).catch(() => {});
}

export default function LongestPathSearch(props: Props) {
  const { config, pose, request, selected, disabled, active, onApply } = props;
  const [running, setRunning] = useState(false);
  const [evaluations, setEvaluations] = useState(0);
  const [error, setError] = useState("");
  const [controls, setControls] = useState(() =>
    config.controls.map((c) => c.id),
  );
  const [result, setResult] = useState<{
    value: Result;
    before: PoseRequest;
    appliedKey: string;
  } | null>(null);
  const job = useRef<{ controller: AbortController; id?: string } | null>(null);
  const context = JSON.stringify({
    region: config.region,
    version: config.version,
    selected,
    request,
    active,
  });
  const latest = useRef({ context, onApply });
  latest.current = { context, onApply };
  const sample = pose.muscles.find((m) => m.id === selected);
  const manual = !request.track || request.track === "manual";
  const inBounds = config.controls.every((c) => {
    const value = manual
      ? (request.coordinates?.[c.id] ?? c.default)
      : pose.coordinates[c.id];
    return (
      Number.isFinite(value) && value >= c.min - 1e-6 && value <= c.max + 1e-6
    );
  });

  function cancel() {
    const current = job.current;
    job.current = null;
    current?.controller.abort();
    cancelJob(current?.id);
    setRunning(false);
  }
  useEffect(() => {
    setError("");
    setResult((previous) =>
      previous?.appliedKey === context ? previous : null,
    );
    return () => {
      const current = job.current;
      job.current = null;
      current?.controller.abort();
      cancelJob(current?.id);
    };
  }, [context]);
  useEffect(() => {
    setRunning(false);
  }, [context]);

  async function search() {
    if (
      disabled ||
      !active ||
      !sample?.available ||
      !manual ||
      !inBounds ||
      !controls.length ||
      job.current
    )
      return;
    const current = {
      controller: new AbortController(),
      id: undefined as string | undefined,
    };
    job.current = current;
    setRunning(true);
    setEvaluations(0);
    setError("");
    setResult(null);
    const stale = () =>
      current.controller.signal.aborted ||
      latest.current.context !== context ||
      job.current !== current;
    try {
      // Let job creation finish even after navigation so its returned id can
      // always be cancelled; subsequent polling is abortable.
      const created = await responseJson(
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...searchHeaders },
          body: JSON.stringify({
            region: config.region,
            version: config.version,
            muscle: selected,
            coordinates: Object.fromEntries(
              config.controls.map((c) => [
                c.id,
                request.coordinates?.[c.id] ?? c.default,
              ]),
            ),
            controls,
          }),
        }),
      );
      current.id = created.id;
      if (stale()) {
        cancelJob(current.id);
        return;
      }
      while (!stale()) {
        const status = await responseJson(
          await fetch(`${endpoint}/${current.id}`, {
            headers: searchHeaders,
            signal: current.controller.signal,
          }),
        );
        if (stale()) return;
        setEvaluations(status.evaluations || 0);
        if (status.status === "error") throw Error(status.error);
        if (status.status === "cancelled") return;
        if (status.status === "complete") {
          const value: Result = status.result;
          if (
            value.region !== config.region ||
            value.version !== config.version ||
            value.muscle !== selected ||
            value.pose?.version !== config.version ||
            !value.pose.muscles.find((m) => m.id === selected)?.available ||
            !Number.isFinite(value.length) ||
            value.length < value.startLength - 1e-9
          )
            throw Error(
              "The search returned an incompatible result. Your pose is unchanged.",
            );
          const next: PoseRequest = {
            coordinates: value.coordinates,
            ...(config.region === "spine"
              ? { spineLevel: request.spineLevel || "L3_L4" }
              : {}),
          };
          const appliedKey = JSON.stringify({
            region: config.region,
            version: config.version,
            selected,
            request: next,
            active,
          });
          job.current = null;
          setRunning(false);
          setResult({ value, before: request, appliedKey });
          latest.current.onApply(next);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (e) {
      if (!stale())
        setError(
          e instanceof Error
            ? e.message
            : "The search failed. Your pose is unchanged.",
        );
    } finally {
      if (job.current === current) {
        job.current = null;
        setRunning(false);
        cancelJob(current.id);
      }
    }
  }
  const shown = result?.appliedKey === context ? result : null;
  function label(c: ModelConfig["controls"][number]) {
    const group = config.controlGroups.find((g) => g.id === c.group)?.label;
    return [group, c.level?.replace("_", "–"), c.label]
      .filter(Boolean)
      .join(" · ");
  }
  return (
    <section className="bio-longest-path" aria-label="Find longest muscle path">
      <div className="bio-search-actions">
        <button
          className="small-button"
          onClick={search}
          disabled={
            running ||
            disabled ||
            !active ||
            !sample?.available ||
            !manual ||
            !inBounds ||
            !controls.length
          }
        >
          {running ? "Searching…" : "Find longest path"}
        </button>
        {running && (
          <button className="small-button" onClick={cancel}>
            Cancel search
          </button>
        )}
        {shown && (
          <button
            className="small-button"
            onClick={() => {
              setResult(null);
              onApply(shown.before);
            }}
          >
            Undo search
          </button>
        )}
      </div>
      <p className="bio-search-scope">
        Searches this selected path within the slider limits. Applies the
        longest pose found.
      </p>
      <details className="bio-search-settings">
        <summary>
          Joints to search · {controls.length} of {config.controls.length}
        </summary>
        <p>Uncheck a control to hold its current angle.</p>
        <fieldset disabled={running}>
          <legend>Joint controls included in the search</legend>
          <div className="bio-search-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setControls(config.controls.map((c) => c.id));
                setResult(null);
              }}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setControls([]);
                setResult(null);
              }}
            >
              Clear all
            </button>
          </div>
          <div className="bio-search-joints">
            {config.controls.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={controls.includes(c.id)}
                  onChange={(e) => {
                    setControls((previous) =>
                      e.target.checked
                        ? [...previous, c.id]
                        : previous.filter((id) => id !== c.id),
                    );
                    setResult(null);
                  }}
                />
                <span>
                  {label(c)}{" "}
                  <small>
                    {c.min}° to {c.max}°
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </details>
      {!inBounds && !disabled && (
        <p>Bring the pose within the slider limits before searching.</p>
      )}
      {!manual && <p>Choose Manual joint controls before searching.</p>}
      {running && (
        <p role="status">
          Searching joint combinations
          {evaluations > 0 ? ` · ${evaluations} evaluated` : ""}. You can cancel
          or change the pose.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {shown && (
        <div className="bio-search-result" role="status">
          <strong>
            {shown.value.gain > 0.00005
              ? "Longest found within these limits"
              : "No longer path found"}
          </strong>
          <p>
            {(shown.value.startLength * 1000).toFixed(1)} →{" "}
            {(shown.value.length * 1000).toFixed(1)} mm ·{" "}
            {deltaText(shown.value.gain)} from before search
          </p>
          <p>
            {shown.value.evaluations} candidates evaluated
            {shown.value.budgetLimited ? " · Search limit reached" : ""}. A
            longer pose may exist.
          </p>
          {shown.value.atLimits.length > 0 && (
            <p>
              {shown.value.atLimits.length} searched control
              {shown.value.atLimits.length === 1 ? " is" : "s are"} at a slider
              limit.
            </p>
          )}
        </div>
      )}
      <p className="bio-search-note">
        Model path length only. These limits do not establish a safe stretch.
      </p>
    </section>
  );
}
