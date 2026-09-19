import { assetUrl } from "./urls";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MovementTarget } from "./AnatomyCatalog";
import BiomechanicsViewer from "./BiomechanicsViewer";
import MuscleReference from "./MuscleReference";
import WholeBodyLayers from "./WholeBodyLayers";
import LongestPathSearch from "./LongestPathSearch";
import SpineGroupControls from "./SpineGroupControls";
import {
  defaultAppearance,
  visibleBodyPaths,
  wholeBodyMuscles,
  type PathAppearance,
} from "./wholeBodyDisplay";
import {
  deltaText,
  direction,
  evaluate,
  getConfig,
  pathColor,
  type ModelConfig,
  type ModelPose,
  type PoseRequest,
} from "./biomechanics";
import "./wholebody.css";
import { muscleAtlas } from "./muscleAtlas";

const groupOrder = [
  "hip_r",
  "knee_r",
  "ankle_r",
  "hip_l",
  "knee_l",
  "ankle_l",
  "lumbar",
  "thoracic",
  "head",
  "shoulder_r",
  "elbow_r",
  "shoulder_l",
  "elbow_l",
];
const storageKey = "kinetic-wholebody-v1-reference";
type Reference = { pose: ModelPose; request: PoseRequest; saved: boolean };

export default function WholeBodyLab({
  active,
  target,
}: {
  active: boolean;
  target?: MovementTarget | null;
}) {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [pose, setPose] = useState<ModelPose | null>(null);
  const [reference, setReference] = useState<Reference | null>(null);
  const [request, setRequest] = useState<PoseRequest>({});
  const [selected, setSelected] = useState("wholebody__bifemlh_r");
  const [focus, setFocus] = useState("hip_r");
  const [filter, setFilter] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const [showAnatomy, setShowAnatomy] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [appearance, setAppearance] =
    useState<PathAppearance>(defaultAppearance);
  const [bonesOnly, setBonesOnly] = useState(false);
  const appliedTarget = useRef<number | null>(null);
  useEffect(() => {
    if (!target || !config || appliedTarget.current === target.visit) return;
    appliedTarget.current = target.visit;
    if (!config.muscles.some((m) => m.id === target.id)) {
      setNotice(
        "This catalog path is not available in the loaded model. Choose another path or refresh the catalog.",
      );
      return;
    }
    setSelected(target.id);
    setFilter("");
    setChangedOnly(false);
    setBonesOnly(false);
    setShowAnatomy(false);
  }, [target, config]);
  const displayMuscles = useMemo(
    () => wholeBodyMuscles(config?.muscles || []),
    [config],
  );
  const visiblePaths = useMemo(
    () => visibleBodyPaths(displayMuscles, selected, appearance),
    [displayMuscles, selected, appearance],
  );
  const selectedMuscle = displayMuscles.find((m) => m.id === selected);
  const familyPaths = useMemo(
    () =>
      new Set(
        displayMuscles
          .filter((m) => m.family === selectedMuscle?.family)
          .map((m) => m.id),
      ),
    [displayMuscles, selectedMuscle?.family],
  );
  const familyCount = displayMuscles.filter(
    (m) =>
      m.family === selectedMuscle?.family && m.side === selectedMuscle?.side,
  ).length;

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    getConfig("wholebody", controller.signal)
      .then(async (c) => {
        let restored: Reference = {
          pose: c.baseline,
          request: {},
          saved: false,
        };
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const saved = JSON.parse(raw);
            if (
              saved.version !== c.version ||
              !saved.request ||
              typeof saved.request !== "object"
            )
              throw Error("Reference needs updating");
            const calculated = await evaluate(
              "wholebody",
              saved.request,
              controller.signal,
            );
            if (
              calculated.version !== c.version ||
              calculated.region !== "wholebody"
            )
              throw Error("Reference model changed");
            restored = {
              pose: calculated,
              request: saved.request,
              saved: true,
            };
          }
        } catch {
          if (controller.signal.aborted) return;
          setNotice(
            "The saved reference could not be restored. Comparing with the starting pose.",
          );
        }
        if (controller.signal.aborted) return;
        setConfig(c);
        setPose(c.baseline);
        setReference(restored);
        setRequest({});
        setBusy(false);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!config) return;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    const timer = window.setTimeout(() => {
      evaluate("wholebody", request, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          if (next.version !== config.version || next.region !== "wholebody")
            throw Error(
              "The movement model changed. Reload the model before comparing poses.",
            );
          setPose(next);
          setBusy(false);
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) {
            setError(e.message);
            setBusy(false);
          }
        });
    }, 45);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [config, request]);

  function change(coordinates: Record<string, number>) {
    setBusy(true);
    setError("");
    setRequest({ coordinates });
  }
  function saveReference() {
    if (!pose || !config || busy || error) return;
    setReference({ pose, request, saved: true });
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: config.version, request }),
      );
      setNotice("Reference saved on this device.");
    } catch {
      setNotice(
        "Reference kept for this session. Browser storage is unavailable.",
      );
    }
  }
  function startReference() {
    if (!config) return;
    setReference({ pose: config.baseline, request: {}, saved: false });
    try {
      localStorage.removeItem(storageKey);
      setNotice("");
    } catch {
      setNotice(
        "Browser storage is unavailable; the reference changed for this session.",
      );
    }
  }

  const samples = useMemo(
    () => new Map(pose?.muscles.map((m) => [m.id, m])),
    [pose],
  );
  const bases = useMemo(
    () => new Map(reference?.pose.muscles.map((m) => [m.id, m])),
    [reference],
  );
  const muscles = useMemo(
    () =>
      (config?.muscles || [])
        .filter((m) => {
          const sample = samples.get(m.id),
            base = bases.get(m.id);
          return (
            m.name.toLowerCase().includes(filter.toLowerCase()) &&
            (!changedOnly ||
              (sample?.available &&
                base?.available &&
                Math.abs(sample.length - base.length) > 0.001))
          );
        })
        .sort((a, b) => {
          const delta = (id: string) => {
            const m = samples.get(id),
              base = bases.get(id);
            return m?.available && base?.available
              ? Math.abs(m.length - base.length)
              : -1;
          };
          return delta(b.id) - delta(a.id) || a.name.localeCompare(b.name);
        }),
    [config, samples, bases, filter, changedOnly],
  );
  const sample = samples.get(selected),
    base = bases.get(selected);
  const comparable = !busy && !error && sample?.available && base?.available;
  const delta = sample && base ? sample.length - base.length : 0;
  const name = config?.muscles.find((m) => m.id === selected)?.name || selected;
  // Reuse only an exact, sided correspondence already present in the spine atlas.
  const atlasId = selected.replace("wholebody__", "spine__");
  const familyName = selectedMuscle
    ? `${selectedMuscle.side} ${selectedMuscle.family}`
    : name;
  const strand = name.split(" · ").slice(1).join(" · ");
  const visibleCount =
    pose?.muscles.filter(
      (m) =>
        visiblePaths.has(m.id) &&
        m.available &&
        m.path.length > 1 &&
        bases.get(m.id)?.available,
    ).length || 0;

  return (
    <section
      className="movement-lab wholebody-lab"
      aria-label="Whole-body movement lab"
    >
      <header className="bio-toolbar">
        <div>
          <span className="eyebrow">ONE BODY · ONE SHARED POSE</span>
          <h2>Move the connections.</h2>
          <p>
            Combine joint angles and watch muscle–tendon paths lengthen or
            shorten.
          </p>
        </div>
        <button
          className="small-button"
          disabled={!config}
          onClick={() => change({})}
        >
          Reset whole pose
        </button>
      </header>
      {error && (
        <div className="wholebody-error" role="alert">
          {error}{" "}
          <button
            className="small-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Reload model
          </button>
        </div>
      )}
      {!config || !pose || !reference ? (
        <p className="bio-status" role="status">
          {error
            ? "Whole-body model unavailable."
            : "Loading the connected body…"}
        </p>
      ) : (
        <>
          <div className="wholebody-workspace">
            <div className="bio-interaction wholebody-body">
              <div className="bio-status" role="status">
                {error
                  ? "Last calculated pose shown. Comparisons unavailable."
                  : busy
                    ? "Updating the shared pose…"
                    : "Shared pose ready · both sides · 598 modeled muscle paths"}
              </div>
              <WholeBodyLayers
                appearance={appearance}
                onChange={setAppearance}
                selected={selectedMuscle}
                count={bonesOnly ? 0 : visibleCount}
                bonesOnly={bonesOnly}
              />
              <BiomechanicsViewer
                config={config}
                joint="wholebody"
                pose={pose}
                reference={reference.pose}
                selected={selected}
                onSelect={(id) => {
                  setSelected(id);
                  setShowAnatomy(true);
                }}
                hideResults={busy || !!error}
                visiblePaths={visiblePaths}
                familyPaths={familyPaths}
                boneOpacity={appearance.boneOpacity}
                showPathMarkers={appearance.markers}
                onBonesOnlyChange={setBonesOnly}
                focusFrame={
                  config.controlGroups.find((g) => g.id === focus)?.frame
                }
              />
              <div
                className="wholebody-comparison"
                aria-label="Selected whole-body muscle"
              >
                <div>
                  <span className="eyebrow">
                    {familyCount > 1
                      ? "SELECTED MUSCLE · ONE STRAND HIGHLIGHTED"
                      : "SELECTED MUSCLE"}
                  </span>
                  <h3>{familyName}</h3>
                  {familyCount > 1 && (
                    <p className="wholebody-strand-note">
                      Highlighted strand: {strand || name}. This muscle has{" "}
                      {familyCount} modeled paths on the{" "}
                      {selectedMuscle?.side.toLowerCase()}; the length below is
                      for this strand.
                    </p>
                  )}
                </div>
                <strong
                  className="wholebody-delta"
                  style={{ color: comparable ? pathColor(delta) : undefined }}
                >
                  {comparable
                    ? `${direction(delta)} · ${deltaText(delta)}`
                    : busy
                      ? "Calculating…"
                      : "Comparison unavailable"}
                </strong>
                <p>
                  {comparable
                    ? `${(sample.length * 1000).toFixed(1)} mm now · ${(base.length * 1000).toFixed(1)} mm at reference`
                    : sample?.unavailableReason ||
                      base?.unavailableReason ||
                      "Wait for a valid pose to compare lengths."}
                </p>
                <div className="wholebody-reference-actions">
                  <button
                    className="small-button"
                    onClick={saveReference}
                    disabled={busy || !!error}
                  >
                    Save pose as reference
                  </button>
                  <button className="small-button" onClick={startReference}>
                    Use starting reference
                  </button>
                  {reference.saved && (
                    <button
                      className="small-button"
                      onClick={() =>
                        change(reference.request.coordinates || {})
                      }
                    >
                      Return to reference pose
                    </button>
                  )}
                  <button
                    className="small-button"
                    aria-pressed={showAnatomy}
                    onClick={() => setShowAnatomy(!showAnatomy)}
                  >
                    Muscle anatomy
                  </button>
                </div>
                <LongestPathSearch
                  key={`${selected}:${config.version}`}
                  config={config}
                  pose={pose}
                  request={request}
                  selected={selected}
                  disabled={busy || !!error}
                  active={active}
                  onApply={(next) => change(next.coordinates || {})}
                />
                <p className="wholebody-reference-label">
                  Comparing with{" "}
                  {reference.saved ? "your saved pose" : "the starting pose"} ·
                  muscle–tendon path length, not tension or activation.
                </p>
                {notice && <p role="status">{notice}</p>}
              </div>
              {showAnatomy &&
                (muscleAtlas[atlasId] ? (
                  <MuscleReference
                    id={atlasId}
                    pathName={name}
                    comparisonNote={
                      familyCount > 1
                        ? `The moving view highlights one of ${familyCount} modeled paths for ${familyName}. This resting atlas shows the broader muscle, not that individual strand.`
                        : "This resting atlas shows the muscle’s shape. The moving view shows its modeled muscle–tendon path."
                    }
                    onClose={() => setShowAnatomy(false)}
                  />
                ) : (
                  <div className="wholebody-anatomy">
                    <h3>{name}</h3>
                    <p>
                      Native path: {sample?.originFrame.replaceAll("_", " ")} →{" "}
                      {sample?.insertionFrame.replaceAll("_", " ")}.
                    </p>
                    <p>
                      A matched resting muscle surface is not available here.
                      The highlighted line in the moving figure shows this
                      muscle’s route. Use Focus selected path for a close-up.
                    </p>
                    <button
                      className="small-button"
                      onClick={() => setShowAnatomy(false)}
                    >
                      Close muscle anatomy
                    </button>
                  </div>
                ))}
            </div>
            <div
              className="wholebody-controls"
              aria-label="Whole-body joint controls"
            >
              <div className="wholebody-controls-heading">
                <div
                  className="wholebody-control-result"
                  aria-label="Muscle change beside controls"
                >
                  <span>{name}</span>
                  <strong
                    style={{ color: comparable ? pathColor(delta) : undefined }}
                  >
                    {comparable
                      ? `${direction(delta)} · ${deltaText(delta)}`
                      : busy
                        ? "Calculating…"
                        : "Comparison unavailable"}
                  </strong>
                </div>
                <h3>Joint controls</h3>
                <label>
                  Camera focus{" "}
                  <select
                    aria-label="Whole-body camera focus"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                  >
                    {config.controlGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Choose a region, then use Focus joint in the viewer. Every
                  slider keeps the rest of your pose.
                </p>
              </div>
              <div className="wholebody-control-scroll">
                {[...config.controlGroups]
                  .sort(
                    (a, b) =>
                      groupOrder.indexOf(a.id) - groupOrder.indexOf(b.id),
                  )
                  .map((g) => {
                    const controls = config.controls.filter(
                      (c) => c.group === g.id,
                    );
                    const changed = controls.filter(
                      (c) =>
                        Math.abs(
                          (request.coordinates?.[c.id] ?? c.default) -
                            c.default,
                        ) > 0.001,
                    ).length;
                    const spinal = g.id === "lumbar" || g.id === "thoracic";
                    const sliders = controls.map((c) => {
                      const value = request.coordinates?.[c.id] ?? c.default;
                      const label = `${g.label} ${c.level ? c.level.replace("_", "–") + " " : ""}${c.label}`;
                      return (
                        <div className="bio-slider" key={c.id}>
                          <label htmlFor={`wholebody-${c.id}`}>
                            {c.level && <b>{c.level.replace("_", "–")}</b>}
                            {c.label}
                            <output>{value.toFixed(c.level ? 1 : 0)}°</output>
                          </label>
                          <input
                            id={`wholebody-${c.id}`}
                            aria-label={label}
                            type="range"
                            min={c.min}
                            max={c.max}
                            step={c.level ? 0.1 : 1}
                            value={value}
                            onChange={(e) =>
                              change({
                                ...request.coordinates,
                                [c.id]: Number(e.target.value),
                              })
                            }
                          />
                          <small>{c.detail}</small>
                        </div>
                      );
                    });
                    return (
                      <details
                        className="wholebody-group"
                        key={g.id}
                        open={
                          g.id.endsWith("_r") && /^(hip|knee|ankle)/.test(g.id)
                        }
                      >
                        <summary>
                          {g.label}
                          <span>
                            {changed
                              ? `${changed} changed`
                              : spinal
                                ? "3 group controls"
                                : `${controls.length} ${controls.length === 1 ? "control" : "controls"}`}
                          </span>
                        </summary>
                        <button
                          className="small-button"
                          aria-label={`Reset ${g.label.toLowerCase()}`}
                          onClick={() => {
                            const next = { ...request.coordinates };
                            controls.forEach((c) => delete next[c.id]);
                            change(next);
                          }}
                        >
                          Reset {g.label.toLowerCase()}
                        </button>
                        {spinal ? (
                          <>
                            <SpineGroupControls
                              controls={controls}
                              coordinates={request.coordinates || {}}
                              label={g.label}
                              onChange={change}
                              showReset={false}
                            />
                            <details className="bio-spine-individual">
                              <summary>Fine-tune individual joints</summary>
                              {sliders}
                            </details>
                          </>
                        ) : (
                          sliders
                        )}
                      </details>
                    );
                  })}
              </div>
              <p className="wholebody-coverage">
                Head and neck move as one segment. Shoulder blades, wrists and
                forearms stay fixed relative to their parent segments. Elbows
                move, but this source has no elbow or forearm muscle paths. Use
                Regional for those detailed muscle models.
              </p>
            </div>
          </div>
          <section
            className="wholebody-muscles"
            aria-label="Whole-body muscle comparisons"
          >
            <div className="wholebody-muscle-heading">
              <h3>
                Muscle paths <span>{muscles.length}</span>
              </h3>
              <input
                aria-label="Search whole-body muscles"
                type="search"
                placeholder="Search muscle or side…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={changedOnly}
                  onChange={(e) => setChangedOnly(e.target.checked)}
                />{" "}
                Changed paths only
              </label>
            </div>
            <p>
              Largest changes first. Select a path to follow it in the body.
              “Little change” means within 1 mm of the reference.
            </p>
            <div className="wholebody-muscle-list">
              {muscles.map((m) => {
                const p = samples.get(m.id),
                  b = bases.get(m.id);
                const available =
                  !busy && !error && p?.available && b?.available;
                return (
                  <button
                    key={m.id}
                    aria-pressed={selected === m.id}
                    onClick={() => {
                      setSelected(m.id);
                    }}
                  >
                    <span>{m.name}</span>
                    <strong
                      style={{
                        color: available
                          ? pathColor(p.length - b.length)
                          : undefined,
                      }}
                    >
                      {available ? deltaText(p.length - b.length) : "—"}
                    </strong>
                  </button>
                );
              })}
              {!muscles.length && <p>No muscle paths match this view.</p>}
            </div>
          </section>
          <details className="wholebody-source">
            <summary>Model coverage & sources</summary>
            <p>
              This connected skeleton uses the pinned Bruno / Bern full-body
              spine template: 78 bodies, 598 muscle paths and 72 exposed joint
              coordinates. Muscle coverage is concentrated in the torso, with a
              subset of leg and shoulder muscles. It does not include every
              human muscle. Regional workspaces use different models and
              references.
            </p>
            <p>
              Lengths describe the modeled muscle–tendon route. They do not
              measure muscle-fiber contraction, activation, passive tension,
              nerve strain or fascial force transfer. Ankle dorsiflexion changes
              calf paths here; it does not directly lengthen the hamstrings.
              Neural effects are outside this model.
            </p>
            <p>
              Slider limits are exploration limits. Arbitrary combinations are
              not validated human stretches; the model does not check contact,
              balance or joint loading. A path is withheld if its exported
              drawing differs from native OpenSim length by more than 1 mm.
            </p>
            <p>
              <a href={config.paper} target="_blank" rel="noreferrer">
                Model publication
              </a>{" "}
              ·{" "}
              <a href={config.source} target="_blank" rel="noreferrer">
                Pinned source
              </a>{" "}
              ·{" "}
              <a
                href={assetUrl("/models/spine/LICENSE.txt")}
                target="_blank"
                rel="noreferrer"
              >
                License & credits
              </a>
              {" · "}
              <a
                href={assetUrl("/credits/index.html#wholebody")}
                target="_blank"
                rel="noreferrer"
              >
                Full citations, licenses & changes
              </a>
            </p>
            <p className="bio-version">
              Model {config.modelVersion.slice(0, 12)} · Calculation{" "}
              {config.version.slice(0, 12)} · {config.engine}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
