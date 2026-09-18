import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Search } from "lucide-react";
import catalog from "./anatomyCatalog.json";
import AtlasViewer from "./AtlasViewer";
import { muscles, sources } from "./data";
import type { Region } from "./biomechanics";
import "./atlas.css";

export type MovementTarget = { region: Region; id: string; visit: number };
export const workspaceNames: Record<Region, string> = {
  shoulder: "Shoulder",
  arm: "Elbow & wrist",
  hip: "Hip, knee & ankle",
  neck: "Neck",
  spine: "Spine",
  wholebody: "Whole body",
};
const entries = catalog.entries;
export default function AnatomyCatalog({
  onClose,
  onOpenPath,
}: {
  onClose: () => void;
  onOpenPath: (region: Region, id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [coverage, setCoverage] = useState("all");
  const [selected, setSelected] = useState("Acromial Part Of Deltoid Muscle");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const entry = entries.find((e) => e.name === selected)!;
  const shown = entries.filter(
    (e) =>
      (coverage === "all" ||
        (coverage === "modeled" ? e.paths.length > 0 : !e.paths.length)) &&
      [e.name, ...e.paths.map((p) => p.name)]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  return (
    <section className="atlas-catalog" aria-label="Anatomy reference">
      <div className="atlas-heading">
        <div>
          <span className="eyebrow">MOVEMENT LAB · ANATOMY REFERENCE</span>
          <h2 tabIndex={-1} ref={heading}>
            Find the anatomy behind the movement.
          </h2>
          <p>
            Browse resting anatomy, then follow a linked path into a movement
            model.
          </p>
        </div>
        <button className="small-button" onClick={onClose}>
          <ArrowLeft size={16} /> Back to movement
        </button>
      </div>
      <div className="atlas-coverage-key">
        <span>
          <b className="coverage-badge modeled">Modeled</b> Linked movement
          paths available
        </span>
        <span>
          <b className="coverage-badge">Anatomy only</b> Resting shape; no
          linked movement calculation
        </span>
      </div>
      <div className="atlas-layout">
        <aside className="atlas-list-panel" aria-label="Anatomy catalog">
          <label className="atlas-search">
            <Search size={16} />
            <input
              aria-label="Search anatomy"
              placeholder="Search anatomy…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="atlas-filter">
            Coverage
            <select
              aria-label="Filter anatomy coverage"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
            >
              <option value="all">All anatomy</option>
              <option value="modeled">Modeled</option>
              <option value="anatomy">Anatomy only</option>
            </select>
          </label>
          <p className="atlas-count" role="status">
            {shown.length} of {entries.length} named structures
          </p>
          <div className="atlas-list" aria-label="Anatomy structures">
            {shown.map((e) => (
              <button
                key={e.name}
                aria-pressed={e.name === selected}
                className="atlas-entry"
                onClick={() => setSelected(e.name)}
              >
                <span>{e.name}</span>
                <span
                  className={`coverage-badge ${e.paths.length ? "modeled" : ""}`}
                >
                  {e.paths.length ? "Modeled" : "Anatomy only"}
                </span>
              </button>
            ))}
            {!shown.length && (
              <div className="atlas-empty">
                <p>No structures match.</p>
                <button
                  className="small-button"
                  onClick={() => {
                    setQuery("");
                    setCoverage("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <p className="atlas-footnote">
            Names follow the source atlas and include muscle heads, parts and
            some tendons. This is not a count of distinct muscles.
          </p>
        </aside>
        <div className="atlas-selected">
          <div className="atlas-selected-heading">
            <span
              className={`coverage-badge ${entry.paths.length ? "modeled" : ""}`}
            >
              {entry.paths.length ? "Modeled" : "Anatomy only"}
            </span>
            <h3>{entry.name}</h3>
          </div>
          <div className="atlas-selection-layout">
            <AtlasViewer name={entry.name} onPick={setSelected} />
            <AtlasDetails
              key={entry.name}
              entry={entry}
              onOpenPath={onOpenPath}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function AtlasDetails({
  entry,
  onOpenPath,
}: {
  entry: (typeof entries)[number];
  onOpenPath: (region: Region, id: string) => void;
}) {
  const [pathKey, setPathKey] = useState("0");
  const path = entry.paths[Number(pathKey)];
  const guided = muscles.find((m) =>
    entry.name.toLowerCase().includes(m.match),
  );
  return (
    <div className="atlas-details">
      <h4>{path ? "Follow a movement path" : "Resting anatomy"}</h4>
      {path ? (
        <>
          <p>
            This anatomy has linked paths in{" "}
            {Array.from(
              new Set(
                entry.paths.map((p) => workspaceNames[p.region as Region]),
              ),
            ).join(", ")}
            .
          </p>
          <label>
            Movement path
            <select
              aria-label="Linked movement path"
              value={pathKey}
              onChange={(e) => setPathKey(e.target.value)}
            >
              {Object.entries(workspaceNames)
                .filter(([region]) =>
                  entry.paths.some((p) => p.region === region),
                )
                .map(([region, label]) => (
                  <optgroup key={region} label={label}>
                    {entry.paths.map((p, i) =>
                      p.region === region ? (
                        <option key={`${region}:${p.id}`} value={i}>
                          {p.name}
                        </option>
                      ) : null,
                    )}
                  </optgroup>
                ))}
            </select>
          </label>
          <button
            className="primary-button"
            onClick={() => onOpenPath(path.region as Region, path.id)}
          >
            Open in {workspaceNames[path.region as Region]}{" "}
            <ArrowUpRight size={15} />
          </button>
          <p className="atlas-footnote">
            Each path models a muscle or compartment, sometimes within a broader
            atlas shape. Sides and coverage vary by workspace. A link does not
            align the two models or make this resting shape move.
          </p>
        </>
      ) : (
        <p>
          This structure is available as a static reference. There is no
          verified link to an exposed movement path here, so length comparisons
          and longest-path search are unavailable for it.
        </p>
      )}
      {guided && (
        <details className="atlas-guided">
          <summary>Attachments & actions</summary>
          <p>{guided.description}</p>
          <h4>Origin</h4>
          <p>{guided.origin}</p>
          <h4>Insertion</h4>
          <p>{guided.insertion}</p>
          <h4>Actions</h4>
          <ul>
            {guided.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <a href={sources[guided.source].url} target="_blank" rel="noreferrer">
            Anatomy source ↗
          </a>
        </details>
      )}
      <p className="atlas-footnote">
        Z-Anatomy / BodyParts3D · original resting geometry.{" "}
        <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
          Source & credits ↗
        </a>
      </p>
    </div>
  );
}
