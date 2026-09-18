import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Pause, Play, RotateCcw } from "lucide-react";
import DeltoidCanvas from "./DeltoidCanvas";
import { deltoidRegions, type DeltoidAsset } from "./deltoid";
import { deltaText, direction } from "./biomechanics";
import "./deltoid.css";

export default function DeltoidStudy({
  onExplorer,
  onAtlas,
}: {
  onExplorer: () => void;
  onAtlas: () => void;
}) {
  const [asset, setAsset] = useState<DeltoidAsset | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [frame, setFrame] = useState(0),
    [part, setPart] = useState("DeltoideusScapula_M"),
    [playing, setPlaying] = useState(false),
    [atlas, setAtlas] = useState(false),
    [paths, setPaths] = useState(true),
    [attachments, setAttachments] = useState(true);
  const playDirection = useRef(1);
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    fetch("/models/deltoid/demo.json", { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("The deltoid demonstration could not load.");
        const a = await r.json();
        if (a.schema !== 2 || !a.frames?.length)
          throw new Error("This demonstration needs to be rebuilt.");
        setAsset(a);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    if (!asset || !playing || atlas) return;
    const timer = setInterval(
      () =>
        setFrame((f) => {
          if (f >= asset.frames.length - 1) playDirection.current = -1;
          if (f <= 0) playDirection.current = 1;
          return f + playDirection.current;
        }),
      110,
    );
    return () => clearInterval(timer);
  }, [playing, atlas, asset]);
  const region = deltoidRegions.find((p) => p.id === part)!;
  const current = asset?.frames[frame];
  const reference = asset?.frames[0];
  const sample = current?.pose.muscles.find((m) => m.id === part),
    base = reference?.pose.muscles.find((m) => m.id === part),
    delta = sample && base ? sample.length - base.length : 0;
  return (
    <section className="deltoid-study" aria-label="Deltoid demonstration">
      <header className="deltoid-heading">
        <div>
          <span className="eyebrow">ONE MUSCLE · THREE REGIONS</span>
          <h2>Connect the muscle to its movement.</h2>
          <p>
            See the deltoid’s anatomy beside the path calculated as the arm
            moves.
          </p>
        </div>
        <button className="small-button" onClick={onExplorer}>
          Joint explorer <ArrowRight size={15} />
        </button>
      </header>
      {error ? (
        <div className="deltoid-loading" role="alert">
          {error}{" "}
          <button
            className="small-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : !asset || !current ? (
        <div className="deltoid-loading" role="status">
          Opening the deltoid demonstration…
        </div>
      ) : (
        <div className="deltoid-workspace">
          <div className="deltoid-interaction">
            <div className="deltoid-view-options">
              <div className="segmented">
                <button
                  className={!atlas ? "active" : ""}
                  aria-pressed={!atlas}
                  onClick={() => setAtlas(false)}
                >
                  Compare anatomy & motion
                </button>
                <button
                  className={atlas ? "active" : ""}
                  aria-pressed={atlas}
                  onClick={() => {
                    setPlaying(false);
                    setAtlas(true);
                  }}
                >
                  Resting atlas
                </button>
              </div>
              <span>
                {atlas
                  ? "Original atlas proportions"
                  : "Two datasets · linked by muscle region"}
              </span>
            </div>
            <div
              className={
                atlas ? "deltoid-comparison atlas-only" : "deltoid-comparison"
              }
            >
              <DeltoidCanvas
                asset={asset}
                frame={0}
                part={part}
                atlas={true}
                showPaths={false}
                showAttachments={false}
                onPart={setPart}
              />
              {!atlas && (
                <DeltoidCanvas
                  asset={asset}
                  frame={frame}
                  part={part}
                  atlas={false}
                  showPaths={paths}
                  showAttachments={attachments}
                  onPart={setPart}
                />
              )}
            </div>
            <div className="deltoid-display-controls">
              <label>
                <input
                  type="checkbox"
                  checked={attachments}
                  disabled={atlas}
                  onChange={(e) => setAttachments(e.target.checked)}
                />{" "}
                Show model path endpoints
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={paths}
                  disabled={atlas}
                  onChange={(e) => setPaths(e.target.checked)}
                />{" "}
                Show calculated path
              </label>
              <span>Drag to rotate · scroll to zoom</span>
            </div>
            <div className="deltoid-motion-controls">
              <button
                className="small-button"
                disabled={atlas}
                aria-label={
                  playing ? "Pause deltoid movement" : "Play deltoid movement"
                }
                onClick={() => {
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <label htmlFor="deltoid-elevation">
                <span>
                  Raise / lower the arm <output>{current.angle}°</output>
                </span>
                <input
                  id="deltoid-elevation"
                  aria-label="Deltoid shoulder elevation"
                  type="range"
                  min="0"
                  max={asset.frames.length - 1}
                  step="1"
                  value={frame}
                  disabled={atlas}
                  onChange={(e) => {
                    setPlaying(false);
                    setFrame(Number(e.target.value));
                  }}
                />
                <small>
                  {atlas
                    ? "The atlas is a resting reference. Switch to Compare anatomy & motion to move the research model."
                    : "20–70° glenohumeral elevation · shoulder blade and other angles held fixed"}
                </small>
              </label>
              <button
                className="small-button"
                aria-label="Reset deltoid pose"
                onClick={() => {
                  setPlaying(false);
                  setFrame(0);
                }}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
          <aside
            className="deltoid-details"
            aria-label="Deltoid anatomy and movement"
          >
            <span className="eyebrow">EXPLORE THE REGIONS</span>
            <div className="deltoid-region-tabs">
              {deltoidRegions.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={part === p.id}
                  className={part === p.id ? "active" : ""}
                  onClick={() => setPart(p.id)}
                >
                  <i style={{ background: p.color }} />
                  {p.name}
                </button>
              ))}
            </div>
            <h3>{region.name} deltoid</h3>
            <p className="deltoid-location">{region.position}</p>
            <div className="deltoid-attachment">
              <i className="origin-marker" />
              <div>
                <span>ORIGIN</span>
                <p>{region.origin}</p>
              </div>
            </div>
            <div className="deltoid-attachment">
              <i className="insertion-marker" />
              <div>
                <span>INSERTION</span>
                <p>Deltoid tuberosity of the humerus</p>
              </div>
            </div>
            <div className="deltoid-length">
              <span className="eyebrow">CALCULATED PATH LENGTH</span>
              {atlas && (
                <p>
                  Movement result held at {current.angle}° while viewing the
                  resting atlas.
                </p>
              )}
              <strong>{deltaText(delta)}</strong>
              <p>
                {direction(delta) === "Little change"
                  ? "Little change from"
                  : `${direction(delta)} than`}{" "}
                the {reference?.angle}° reference pose
              </p>
              <small>
                {((base?.length || 0) * 1000).toFixed(1)} →{" "}
                {((sample?.length || 0) * 1000).toFixed(1)} mm
              </small>
              <p className="deltoid-length-note">
                This number comes from OpenSim’s muscle–tendon path. Surface
                anatomy stays at rest; neither view measures tissue strain.
              </p>
            </div>
            <button className="deltoid-atlas-link" onClick={onAtlas}>
              <BookOpen size={15} /> Explore the full anatomy atlas
            </button>
          </aside>
        </div>
      )}
      <footer className="deltoid-study-footer">
        <p>
          <strong>Anatomy and mechanics, side by side.</strong> The left view
          keeps the atlas muscle’s original shape. The right view moves the
          research model’s bones and muscle–tendon path. These are different
          bodies, linked by region name; the muscle surface does not animate.
        </p>
        <details>
          <summary>Sources, fit checks & what comes next</summary>
          <p>
            The deltoid’s three regions arise from the clavicle, acromion and
            scapular spine and converge onto the humerus.{" "}
            <a
              href="https://www.ncbi.nlm.nih.gov/sites/books/NBK537056/"
              target="_blank"
              rel="noreferrer"
            >
              Anatomical reference ↗
            </a>
          </p>
          <p>
            Anatomy uses Z-Anatomy / BodyParts3D (CC BY-SA 4.0). Motion and path
            lengths use the Seth / Belli shoulder model. The attempted moving
            surface developed folds and distorted volume, so it was rejected for
            this learning view.{" "}
            <a
              href="/models/deltoid/ATTRIBUTION.md"
              target="_blank"
              rel="noreferrer"
            >
              Attribution and prototype findings ↗
            </a>
          </p>
          <p>
            <strong>Next joints: hip, knee and ankle.</strong> Hip and knee path
            exploration is already available. The visual approach must be
            checked separately for each region, including muscles crossing
            multiple joints, before adding muscle surfaces or ankle controls.
          </p>
          <button className="small-button" onClick={onExplorer}>
            Explore shoulder, hip & knee <ArrowRight size={14} />
          </button>
        </details>
      </footer>
    </section>
  );
}
