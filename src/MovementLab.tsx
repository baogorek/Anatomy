import { assetUrl } from "./urls";
import WholeBodyLab from "./WholeBodyLab";
import WholeBodyLayers from "./WholeBodyLayers";
import {
  bodyLayers,
  defaultSpineAppearance,
  visibleBodyPaths,
  wholeBodyMuscles,
  type PathAppearance,
} from "./wholeBodyDisplay";
import SpineGroupControls from "./SpineGroupControls";
import {
  controlsForSpine,
  spineScopes,
  type SpineScope,
} from "./spineControls";
import AnatomyCatalog, { type MovementTarget } from "./AnatomyCatalog";
import LongestPathSearch from "./LongestPathSearch";
import spineAtlasExtras from "./spineAtlasExtras.json";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  RotateCcw,
  Save,
  Play,
  Pause,
  ExternalLink,
} from "lucide-react";
import BiomechanicsViewer from "./BiomechanicsViewer";
import DeltoidStudy from "./DeltoidStudy";
import MuscleReference from "./MuscleReference";
import TibialisAnteriorEvidence from "./TibialisAnteriorEvidence";
import {
  getConfig,
  evaluate,
  direction,
  deltaText,
  pathColor,
  type ModelConfig,
  type ModelPose,
  type PoseRequest,
  type Region,
} from "./biomechanics";
import "./movement.css";
import {
  joints,
  jointRegion,
  type Joint,
  type Exploration,
} from "./jointLearning";

type Reference = { request: PoseRequest; pose: ModelPose; label: string };
const key = "kinetic-movement-v1";
const attachmentName = (frame?: string) =>
  ({
    thorax: "rib cage",
    sacrum: "sacrum",
    Abdomen: "abdominal routing body",
    ...Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [`thoracic${i + 1}`, `T${i + 1}`]),
    ),
    ...Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`lumbar${i + 1}`, `L${i + 1}`]),
    ),
    clavicle: "clavicle",
    scapula: "scapula",
    humerus: "humerus",
    pelvis: "pelvis",
    femur_r: "right femur",
    tibia_r: "right tibia",
    patella_r: "right patella",
    talus_r: "right talus",
    calcn_r: "right heel / foot segment",
    toes_r: "right toes",
    ulna: "ulna",
    radius: "radius",
    skull: "skull",
    ribcage: "rib cage",
    spine: "thoracic / lumbar spine",
    rclavicle: "right clavicle",
    lclavicle: "left clavicle",
    rscapula: "right scapula",
    lscapula: "left scapula",
    cerv1: "atlas (C1)",
    cerv2: "axis (C2)",
    cerv3: "C3",
    cerv4: "C4",
    cerv5: "C5",
    cerv6: "C6",
    cerv7: "C7",
    hand: "hand",
    proximal_row: "proximal carpal row",
  })[frame || ""] || frame;
export default function MovementLab({
  onAtlas,
  referenceOpen,
  onCloseAtlas,
}: {
  onAtlas: () => void;
  referenceOpen: boolean;
  onCloseAtlas: () => void;
}) {
  const [detail, setDetail] = useState(false);
  const [mode, setMode] = useState("regional");
  const [wholeBodyVisited, setWholeBodyVisited] = useState(false);
  const [target, setTarget] = useState<MovementTarget | null>(null);
  return (
    <>
      {referenceOpen && (
        <AnatomyCatalog
          onClose={onCloseAtlas}
          onOpenPath={(region, id) => {
            setTarget((previous) => ({
              region,
              id,
              visit: (previous?.visit || 0) + 1,
            }));
            setDetail(false);
            if (region === "wholebody") setWholeBodyVisited(true);
            setMode(region === "wholebody" ? "wholebody" : "regional");
            onCloseAtlas();
          }}
        />
      )}
      <div hidden={referenceOpen}>
        <div className="bio-lab-options" aria-label="Movement lab view">
          <span>Movement Lab</span>
          <div className="segmented">
            <button
              aria-pressed={mode === "regional"}
              onClick={() => setMode("regional")}
            >
              Regional
            </button>
            <button
              aria-pressed={mode === "wholebody"}
              onClick={() => {
                setWholeBodyVisited(true);
                setMode("wholebody");
              }}
            >
              Whole body
            </button>
          </div>
        </div>
        {wholeBodyVisited && (
          <div hidden={mode !== "wholebody"}>
            <WholeBodyLab
              active={!referenceOpen && mode === "wholebody"}
              target={target?.region === "wholebody" ? target : null}
            />
          </div>
        )}
        {detail && mode === "regional" && (
          <DeltoidStudy onAtlas={onAtlas} onExplorer={() => setDetail(false)} />
        )}
        <div hidden={detail || mode !== "regional"}>
          <JointExplorer
            active={!referenceOpen && !detail && mode === "regional"}
            target={target?.region !== "wholebody" ? target : null}
            onAtlas={onAtlas}
            onDeltoid={() => setDetail(true)}
          />
        </div>
      </div>
    </>
  );
}
function JointExplorer({
  active,
  target,
  onAtlas,
  onDeltoid,
}: {
  active: boolean;
  target: MovementTarget | null;
  onAtlas: () => void;
  onDeltoid: () => void;
}) {
  const [joint, setJoint] = useState<Joint>("shoulder");
  const region: Region = jointRegion(joint);
  const info = joints[joint];
  const [exploration, setExploration] = useState<Exploration | null>(null);
  const [listMode, setListMode] = useState("all");
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [pose, setPose] = useState<ModelPose | null>(null),
    [reference, setReference] = useState<Reference | null>(null),
    [request, setRequest] = useState<PoseRequest>({});
  const [atlasOnly, setAtlasOnly] = useState<string | null>(null);
  const [spineScope, setSpineScope] = useState<SpineScope>("all");
  const [spineIndividual, setSpineIndividual] = useState(false);
  const [spineAppearance, setSpineAppearance] = useState<PathAppearance>(
    defaultSpineAppearance,
  );
  const [spineIsolated, setSpineIsolated] = useState(false);
  const [spineBonesOnly, setSpineBonesOnly] = useState(false);
  useEffect(() => {
    setSpineIsolated(false);
    setSpineBonesOnly(false);
  }, [config]);
  const spineLevel = request.spineLevel || "L3_L4";
  const [showAnatomy, setShowAnatomy] = useState(false);
  function inspectMuscle(id: string) {
    setAtlasOnly(null);
    setSelected(id);
    setShowAnatomy(true);
  }
  const [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [retry, setRetry] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    setAtlasOnly(null);
  }, [selected]);
  const [filter, setFilter] = useState("");
  const [storageOk, setStorageOk] = useState(true);
  const appliedTarget = useRef<number | null>(null);
  useEffect(() => {
    if (!target || appliedTarget.current === target.visit) return;
    const targetJoint: Joint =
      target.region === "arm"
        ? /^(ECRL|ECRB|ECU|FCR|FCU|PL)$/.test(target.id)
          ? "wrist"
          : "elbow"
        : target.region === "hip"
          ? /^(gasmed|gaslat|soleus|tibant|tibpost|perlong|perbrev|edl|ehl|fdl|fhl)_r$/.test(
              target.id,
            )
            ? "ankle"
            : "hip"
          : (target.region as Joint);
    if (jointRegion(joint) !== target.region) {
      setJoint(targetJoint);
      setPlaying(false);
      return;
    }
    if (!config || config.region !== target.region) return;
    appliedTarget.current = target.visit;
    if (!config.muscles.some((m) => m.id === target.id)) {
      setError(
        "This catalog path is not available in the loaded model. Choose another path or refresh the catalog.",
      );
      return;
    }
    setJoint(targetJoint);
    setSelected(target.id);
    setAtlasOnly(null);
    setShowAnatomy(false);
    setFilter("");
    setListMode("all");
    setPlaying(false);
    setExploration(null);
  }, [target, config, joint]);
  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);
  const sequence = useRef(0);
  const referenceStart = (c: ModelConfig) => ({
    request: {},
    pose: c.baseline,
    label: "Model starting pose",
  });
  useEffect(() => {
    const abort = new AbortController();
    sequence.current++;
    setConfig(null);
    setPose(null);
    setReference(null);
    setBusy(true);
    setError("");
    setPlaying(false);
    setFilter("");
    getConfig(region, abort.signal)
      .then(async (c) => {
        let saved: Reference | null = null;
        try {
          const v = JSON.parse(
            localStorage.getItem(`${key}-reference-${region}`) || "null",
          );
          if (
            // Older records used the model hash as their only version. Only
            // migrate the request; all lengths are recalculated below.
            (v?.pose?.modelVersion === c.modelVersion ||
              (!v?.pose?.modelVersion &&
                v?.pose?.version === c.modelVersion)) &&
            v?.pose?.region === region &&
            Array.isArray(v.pose.muscles) &&
            v.pose.muscles.length > 0 &&
            v.pose.muscles.every(
              (s: { id: string; length: number }) =>
                Number.isFinite(s.length) &&
                s.length > 0 &&
                c.baseline.muscles.some((m) => s.id === m.id),
            )
          )
            saved = v;
        } catch {
          /* Start with native baseline if saved data is invalid. */
        }
        if (saved) {
          try {
            saved = {
              ...saved,
              pose: await evaluate(region, saved.request, abort.signal),
            };
            if (saved.pose.version !== c.version) saved = null;
          } catch {
            saved = null;
          }
        }
        if (abort.signal.aborted) return;
        if (saved) {
          try {
            localStorage.setItem(
              `${key}-reference-${region}`,
              JSON.stringify(saved),
            );
          } catch {
            setStorageOk(false);
          }
        }
        setConfig(c);
        setPose(c.baseline);
        setSelected(
          region === "spine"
            ? "spine__MF_m1s_r"
            : region === "neck"
              ? "stern_mast"
              : region === "shoulder"
                ? "DeltoideusScapula_M"
                : region === "arm"
                  ? joint === "wrist"
                    ? "FCR"
                    : "BIClong"
                  : joint === "knee"
                    ? "recfem_r"
                    : joint === "ankle"
                      ? "soleus_r"
                      : "bflh_r",
        );
        setRequest({});
        setReference(saved || referenceStart(c));
        setBusy(false);
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load the movement model.",
          );
          setBusy(false);
        }
      });
    return () => abort.abort();
  }, [region, retry]);
  useEffect(() => {
    if (!config) return;
    const seq = ++sequence.current,
      abort = new AbortController();
    setBusy(true);
    setError("");
    const timer = setTimeout(
      () =>
        evaluate(region, request, abort.signal)
          .then((next) => {
            if (seq === sequence.current) {
              if (
                next.version !== config.version ||
                next.region !== config.region
              )
                throw new Error(
                  "The movement calculation changed. Reload the page to refresh the model and reference together.",
                );
              setPose(next);
              setBusy(false);
            }
          })
          .catch((e) => {
            if (!abort.signal.aborted && seq === sequence.current) {
              setError(e.message || "No result is available.");
              setBusy(false);
              setPlaying(false);
            }
          }),
      45,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [config, region, request]);
  useEffect(() => {
    if (!playing) return;
    // Advance only after a returned pose: playback cannot outrun the native solver.
    if (busy) return;
    const timer = setTimeout(
      () =>
        setRequest((r) => ({
          ...r,
          progress: (r.progress || 0) >= 100 ? 0 : (r.progress || 0) + 1,
        })),
      65,
    );
    return () => clearTimeout(timer);
  }, [playing, busy]);
  function focusJoint(next: Joint) {
    if (next === joint) return;
    setJoint(next);
    setAtlasOnly(null);
    if (jointRegion(next) !== region) setShowAnatomy(false);
    setPlaying(false);
    setFilter("");
    setListMode("all");
    setExploration(null);
    if (jointRegion(next) === region)
      // Keep an explicitly inspected muscle when following it across the lower limb.
      if (!showAnatomy)
        setSelected(
          next === "elbow"
            ? "BIClong"
            : next === "shoulder"
              ? "DeltoideusScapula_M"
              : next === "wrist"
                ? "FCR"
                : next === "knee"
                  ? "recfem_r"
                  : next === "ankle"
                    ? "soleus_r"
                    : "bflh_r",
        );
  }
  function explore(e: Exploration) {
    if (region === "spine") setSpineIndividual(true);
    change(e.request);
    setExploration(e);
    setSelected(e.muscles[0]);
    setFilter("");
    setListMode("all");
    if (config) setReference(referenceStart(config));
  }
  function change(next: PoseRequest) {
    setPlaying(false);
    setExploration(null);
    setRequest(
      region === "spine"
        ? { ...next, spineLevel: next.spineLevel || spineLevel }
        : next,
    );
  }
  function saveReference() {
    if (!pose || busy || error) return;
    const saved = { pose, request, label: "Your saved pose" };
    setReference(saved);
    try {
      localStorage.setItem(`${key}-reference-${region}`, JSON.stringify(saved));
    } catch {
      setStorageOk(false);
    }
  }
  function resetReference() {
    if (!config) return;
    setReference(referenceStart(config));
    try {
      localStorage.removeItem(`${key}-reference-${region}`);
    } catch {
      setStorageOk(false);
    }
  }
  const sample = pose?.muscles.find((m) => m.id === selected),
    base = reference?.pose.muscles.find((m) => m.id === selected),
    delta = sample && base ? sample.length - base.length : 0;
  const track =
    request.track && request.track !== "manual" ? request.track : "";
  const canUse = !!pose && !busy && !error;
  const sampleAvailable = !!sample?.available && !!base?.available;
  const spineMuscles = useMemo(
    () => (region === "spine" ? wholeBodyMuscles(config?.muscles || []) : []),
    [region, config],
  );
  const selectedSpineMuscle = spineMuscles.find((m) => m.id === selected);
  const spinePaths = useMemo(
    () => visibleBodyPaths(spineMuscles, selected, spineAppearance),
    [spineMuscles, selected, spineAppearance],
  );
  const spineFamily = useMemo(
    () =>
      new Set(
        spineMuscles
          .filter((m) => m.family === selectedSpineMuscle?.family)
          .map((m) => m.id),
      ),
    [spineMuscles, selectedSpineMuscle?.family],
  );
  const referenceSamples = new Map(
    reference?.pose.muscles.map((m) => [m.id, m]),
  );
  const spinePathCount = spineBonesOnly
    ? 0
    : pose?.muscles.filter(
        (m) =>
          spinePaths.has(m.id) &&
          (!spineIsolated || m.id === selected) &&
          m.available &&
          m.path.length > 1 &&
          referenceSamples.get(m.id)?.available,
      ).length || 0;
  return (
    <section className="movement-lab" aria-label="Movement lab">
      <div className="bio-toolbar">
        <div>
          <span className="eyebrow">MOVE · COMPARE · UNDERSTAND</span>
          <h2>
            {joint === "spine"
              ? "Explore the spine."
              : joint === "neck"
                ? "Explore the neck."
                : `Explore the ${info.name.toLowerCase()} joint.`}
          </h2>
        </div>
        <div className="bio-toolbar-actions">
          <div className="segmented" aria-label="Movement region">
            {(
              [
                "neck",
                "spine",
                "shoulder",
                "elbow",
                "wrist",
                "hip",
                "knee",
                "ankle",
              ] as Joint[]
            ).map((r) => (
              <button
                key={r}
                aria-pressed={joint === r}
                className={joint === r ? "active" : ""}
                onClick={() => focusJoint(r)}
              >
                {joints[r].name}
              </button>
            ))}
          </div>
          <button className="small-button" onClick={onAtlas}>
            <BookOpen size={15} /> Browse anatomy
          </button>
        </div>
      </div>
      <details className="bio-joint-intro bio-presets">
        <summary>Example poses & joint anatomy</summary>
        <p>
          {info.anatomy}{" "}
          <a href={info.source} target="_blank" rel="noreferrer">
            Joint anatomy ↗
          </a>
        </p>
        <div
          className="bio-explorations"
          aria-label={`${info.name} explorations`}
        >
          {info.explorations.map((e) => (
            <button
              key={e.id}
              className="small-button"
              disabled={!config || busy || config.region !== region}
              aria-pressed={exploration?.id === e.id}
              onClick={() => explore(e)}
            >
              {e.label} <ArrowRight size={13} />
            </button>
          ))}
        </div>
      </details>
      {error && (
        <div className="bio-error" role="alert">
          {error}{" "}
          <button
            className="small-button"
            onClick={() => (config ? change({}) : setRetry((x) => x + 1))}
          >
            Retry / reset
          </button>
        </div>
      )}
      {!config ||
      !pose ||
      !reference ||
      config.region !== region ||
      pose.region !== region ||
      reference.pose.region !== region ? (
        <div className="bio-loading" role="status">
          {error
            ? "Movement data unavailable. The anatomy atlas is still available."
            : "Opening the musculoskeletal model…"}
        </div>
      ) : (
        <>
          <div className="bio-workspace">
            <div className="bio-interaction">
              <div className="bio-status" role="status">
                {busy
                  ? "Calculating this pose…"
                  : error
                    ? "Last successful pose · new result unavailable"
                    : `${config.name} · ${config.muscles.length} muscle compartments`}
              </div>
              {region === "spine" && (
                <WholeBodyLayers
                  appearance={spineAppearance}
                  onChange={(next) => {
                    setSpineAppearance(next);
                    setSpineIsolated(false);
                  }}
                  selected={selectedSpineMuscle}
                  count={spinePathCount}
                  bonesOnly={spineBonesOnly}
                  layers={bodyLayers.filter((layer) =>
                    spineMuscles.some((m) => m.layer === layer.id),
                  )}
                />
              )}
              <div
                className={`bio-model-pair${showAnatomy ? " has-reference" : ""}`}
              >
                <BiomechanicsViewer
                  config={config}
                  joint={joint}
                  spineLevel={spineLevel}
                  pose={pose}
                  reference={reference.pose}
                  selected={selected}
                  onSelect={(id) => {
                    inspectMuscle(id);
                  }}
                  hideResults={busy || !!error}
                  visiblePaths={region === "spine" ? spinePaths : undefined}
                  familyPaths={region === "spine" ? spineFamily : undefined}
                  boneOpacity={
                    region === "spine" ? spineAppearance.boneOpacity : undefined
                  }
                  showPathMarkers={
                    region === "spine" ? spineAppearance.markers : undefined
                  }
                  isolated={region === "spine" ? spineIsolated : undefined}
                  onIsolationChange={
                    region === "spine" ? setSpineIsolated : undefined
                  }
                  onBonesOnlyChange={
                    region === "spine" ? setSpineBonesOnly : undefined
                  }
                />
                {showAnatomy && (
                  <MuscleReference
                    id={atlasOnly || selected}
                    anatomyOnly={!!atlasOnly}
                    pathName={
                      spineAtlasExtras.find((m) => m.id === atlasOnly)?.label ||
                      config.muscles.find((m) => m.id === selected)?.name ||
                      selected
                    }
                    onClose={() => setShowAnatomy(false)}
                  />
                )}
              </div>
              {region === "spine" && (
                <details className="bio-spine-atlas">
                  <summary>Deep muscles · rotatores and more</summary>
                  <p>
                    These atlas structures have no separate muscle paths in this
                    OpenSim model. Inspect their resting anatomy here; length
                    changes and moment arms are unavailable for them.
                  </p>
                  <div>
                    {spineAtlasExtras.map((m) => (
                      <button
                        key={m.id}
                        aria-pressed={atlasOnly === m.id && showAnatomy}
                        onClick={() => {
                          setAtlasOnly(m.id);
                          setShowAnatomy(true);
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <div
                className="bio-controls"
                aria-label="Joint movement controls"
              >
                <div className="bio-control-heading">
                  <label>
                    Movement{" "}
                    <select
                      aria-label="Movement source"
                      value={track || "manual"}
                      onChange={(e) =>
                        change(
                          e.target.value === "manual"
                            ? {}
                            : { track: e.target.value, progress: 0 },
                        )
                      }
                    >
                      <option value="manual">Manual joint controls</option>
                      {config.tracks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="small-button" onClick={() => change({})}>
                    <RotateCcw size={14} /> Start pose
                  </button>
                </div>
                <div
                  className="bio-inline-result"
                  aria-label="Selected muscle length change"
                >
                  <strong>
                    {config.muscles.find((m) => m.id === selected)?.name}
                  </strong>
                  <output
                    style={{
                      color:
                        canUse && sampleAvailable
                          ? pathColor(delta)
                          : undefined,
                    }}
                  >
                    {!canUse
                      ? busy
                        ? "Calculating…"
                        : "Result unavailable"
                      : !sampleAvailable
                        ? "Comparison unavailable"
                        : `${deltaText(delta)} · ${direction(delta)} ${direction(delta) === "Little change" ? "from" : "than"} reference`}
                  </output>
                </div>
                {track && (
                  <div className="bio-playback">
                    <button
                      className="small-button"
                      aria-label={playing ? "Pause movement" : "Play movement"}
                      onClick={() => setPlaying(!playing)}
                      disabled={!!error}
                    >
                      {playing ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <label>
                      Movement progress
                      <input
                        aria-label="Movement progress"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={request.progress || 0}
                        onChange={(e) =>
                          change({ track, progress: Number(e.target.value) })
                        }
                      />
                    </label>
                    <output>{Math.round(request.progress || 0)}%</output>
                  </div>
                )}
                {region === "spine" && (
                  <>
                    <div className="bio-spine-scope">
                      <label>
                        Move together
                        <select
                          aria-label="Spine control group"
                          value={spineScope}
                          onChange={(e) =>
                            setSpineScope(e.target.value as SpineScope)
                          }
                        >
                          {Object.entries(spineScopes).map(([id, group]) => (
                            <option key={id} value={id}>
                              {group.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span>{spineScopes[spineScope].extent}</span>
                    </div>
                    <SpineGroupControls
                      controls={controlsForSpine(config.controls, spineScope)}
                      coordinates={request.coordinates || {}}
                      label={spineScopes[spineScope].label}
                      onChange={(coordinates) =>
                        change({ ...request, coordinates })
                      }
                    />
                    <button
                      className="small-button bio-spine-fine-toggle"
                      aria-expanded={spineIndividual}
                      aria-controls="regional-spine-individual"
                      onClick={() => setSpineIndividual((v) => !v)}
                    >
                      {spineIndividual
                        ? "Hide individual joints"
                        : "Fine-tune individual joints"}
                    </button>
                  </>
                )}
                <div
                  id={
                    region === "spine" ? "regional-spine-individual" : undefined
                  }
                  hidden={region === "spine" && !spineIndividual}
                >
                  {region === "spine" && (
                    <label className="bio-spine-level">
                      Spinal joint
                      <select
                        aria-label="Spinal joint"
                        value={spineLevel}
                        onChange={(e) =>
                          change({ ...request, spineLevel: e.target.value })
                        }
                      >
                        {config.controls
                          .filter((c) => c.id.endsWith("_FE"))
                          .map((c) => (
                            <option key={c.level} value={c.level}>
                              {c.level!.replace("_", "–")}
                            </option>
                          ))}
                      </select>
                      <span>
                        Three angles at this joint. Changing levels preserves
                        the other joint angles.
                      </span>
                    </label>
                  )}
                  <div className="bio-sliders">
                    {[...config.controls]
                      .filter(
                        (c) => region !== "spine" || c.level === spineLevel,
                      )
                      .sort((a, b) => {
                        const priority =
                          joint === "wrist"
                            ? [
                                "flexion",
                                "deviation",
                                "pro_sup",
                                "elbow_flexion",
                              ]
                            : joint === "ankle"
                              ? [
                                  "ankle_angle_r",
                                  "subtalar_angle_r",
                                  "knee_angle_r",
                                ]
                              : joint === "knee"
                                ? ["knee_angle_r"]
                                : [];
                        const rank = (id: string) =>
                          priority.includes(id)
                            ? priority.indexOf(id)
                            : priority.length;
                        return rank(a.id) - rank(b.id);
                      })
                      .map((c) => (
                        <div className="bio-slider" key={c.id}>
                          <label htmlFor={c.id}>
                            {c.axis && <b>{c.axis}</b>}
                            <span>{c.label}</span>
                            <output>
                              {c.group === "girdle"
                                ? busy || error
                                  ? "…"
                                  : `${pose.coordinates[c.id].toFixed(1)}°`
                                : `${(track ? pose.coordinates[c.id] : (request.coordinates?.[c.id] ?? c.default)).toFixed(1)}°`}
                            </output>
                          </label>
                          <input
                            id={c.id}
                            aria-label={[c.axis, c.label]
                              .filter(Boolean)
                              .join(" ")}
                            type="range"
                            min={c.min}
                            max={c.max}
                            step={region === "spine" ? "0.1" : "0.5"}
                            disabled={!!track}
                            value={
                              track
                                ? Math.max(
                                    c.min,
                                    Math.min(c.max, pose.coordinates[c.id]),
                                  )
                                : (request.coordinates?.[c.id] ?? c.default)
                            }
                            onChange={(e) =>
                              change({
                                coordinates: {
                                  ...request.coordinates,
                                  [c.id]: Number(e.target.value),
                                },
                              })
                            }
                          />
                          <small>{c.detail}</small>
                        </div>
                      ))}
                  </div>
                </div>
                {region === "spine" && (
                  <details className="bio-spine-angles">
                    <summary>Angles across the spine</summary>
                    <p>
                      Native joint angles relative to this model’s starting
                      pose. These are not whole-trunk angles.
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th>Joint</th>
                          <th>Flexion / extension</th>
                          <th>Lateral flexion</th>
                          <th>Axial rotation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {config.controls
                          .filter((c) => c.id.endsWith("_FE"))
                          .map((c) => (
                            <tr key={c.level}>
                              <td>{c.level!.replace("_", "–")}</td>
                              {["FE", "LB", "AR"].map((axis) => (
                                <td key={axis}>
                                  {busy || error
                                    ? "…"
                                    : `${pose.coordinates[`${c.level}_${axis}`].toFixed(1)}°`}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </details>
                )}
                {joint === "shoulder" && (
                  <div
                    className="bio-girdle-angles"
                    aria-label="Shoulder girdle model angles"
                  >
                    <p>
                      Angles in this pose <span>Change from reference</span>
                    </p>
                    {[
                      ["scapula_abduction", "Scapular abduction"],
                      ["scapula_elevation", "Scapular elevation"],
                      ["scapula_upward_rot", "Scapular upward rotation"],
                      ["scapula_winging", "Scapular winging"],
                      ["clav_prot", "Clavicular protraction"],
                      ["clav_elev", "Clavicular elevation"],
                      ["shoulder_elv", "Humerus elevation relative to scapula"],
                    ].map(([id, label]) => (
                      <div key={id}>
                        <span>{label}</span>
                        <output aria-label={label}>
                          {busy || error
                            ? "…"
                            : `${pose.coordinates[id].toFixed(1)}°`}
                        </output>
                        <output aria-label={`${label} change from reference`}>
                          {busy || error
                            ? "…"
                            : `${pose.coordinates[id] - reference.pose.coordinates[id] >= 0 ? "+" : ""}${(pose.coordinates[id] - reference.pose.coordinates[id]).toFixed(1)}°`}
                        </output>
                      </div>
                    ))}
                  </div>
                )}
                <p className="bio-assumption">
                  {joint === "shoulder"
                    ? "The plane of elevation selects the movement: 0° is sideways abduction/adduction; 90° is forward flexion/extension. Shoulder elevation moves the humerus relative to the scapula. The scapular sliders move the shoulder blade while the clavicle follows. The elbow stays straight."
                    : region === "spine"
                      ? "Group controls move several spinal joints together; individual controls adjust one joint. Pelvis and the abdominal routing body stay at their starting pose; ribs follow their vertebrae without a breathing or cartilage-deformation simulation."
                      : region === "neck"
                        ? "Upper and lower neck motion follow the source model’s vertebral coupling. The thorax, ribs, shoulder girdle and jaw stay fixed relative to their parent segments."
                        : region === "arm"
                          ? "The shoulder stays at the model’s starting pose. Elbow, forearm and wrist controls share one arm pose; the fingers remain in a fixed grip."
                          : "The pelvis and trunk stay fixed. Hip, knee, ankle and subtalar controls share one leg pose. The toe joint stays at its starting angle; the foot segments are rigid."}{" "}
                  These controls use model angles and exploration limits, not a
                  person’s measured or safe range.
                </p>
              </div>
            </div>
            <aside
              className="bio-results"
              aria-label="Muscle length comparison"
            >
              <div className="bio-reference">
                <span className="eyebrow">COMPARE WITH</span>
                <strong>{reference.label}</strong>
                <div>
                  <button
                    className="small-button"
                    disabled={!canUse}
                    onClick={saveReference}
                  >
                    <Save size={13} /> Save current as reference
                  </button>
                  <button className="text-button" onClick={resetReference}>
                    Use starting pose
                  </button>
                </div>
              </div>
              <div className="bio-selected">
                <span className="eyebrow">MUSCLE–TENDON PATH</span>
                <h3>{config.muscles.find((m) => m.id === selected)?.name}</h3>
                <button
                  className="small-button"
                  onClick={() => setShowAnatomy(!showAnatomy)}
                >
                  {showAnatomy ? "Hide muscle anatomy" : "Show muscle anatomy"}
                </button>
                {canUse && sampleAvailable ? (
                  <>
                    <div
                      className="bio-delta"
                      style={{ color: pathColor(delta) }}
                    >
                      {deltaText(delta)}
                      <span>
                        {direction(delta) === "Little change"
                          ? "Little change from reference"
                          : `${direction(delta)} than reference`}
                      </span>
                    </div>
                    <p>
                      {((base?.length || 0) * 1000).toFixed(1)} →{" "}
                      {((sample?.length || 0) * 1000).toFixed(1)} mm
                    </p>
                  </>
                ) : (
                  <p>
                    {!sampleAvailable
                      ? `${sample?.unavailableReason || base?.unavailableReason || "This compartment’s path did not pass the geometry check at one of these poses."} Its drawing and comparison are unavailable.`
                      : "Length comparison appears when the current pose is ready."}
                  </p>
                )}
                <p className="bio-attachment">
                  Model endpoint segments:{" "}
                  <b>{attachmentName(sample?.originFrame)}</b> →{" "}
                  <b>{attachmentName(sample?.insertionFrame)}</b>
                </p>
                <LongestPathSearch
                  key={`${region}:${joint}:${selected}:${config.version}`}
                  config={config}
                  pose={pose}
                  request={request}
                  selected={selected}
                  disabled={busy || !!error || playing || !!atlasOnly}
                  active={active}
                  onApply={change}
                />
                <p className="bio-path-explanation">
                  The line is a modeled muscle–tendon force path. Dots mark its
                  endpoints, not the full anatomical attachment areas.
                </p>
                {selected === "tibant_r" && <TibialisAnteriorEvidence />}
                {canUse && sampleAvailable && sample && (
                  <details className="bio-actions">
                    <summary>What action could this path produce?</summary>
                    <p>
                      A pull along this path has the following modeled moment
                      arms at this pose. Positive favors increasing the named
                      coordinate; negative favors decreasing it. This describes
                      mechanical action, not whether the muscle is active.
                    </p>
                    {(region === "arm" ||
                      region === "neck" ||
                      region === "spine") && (
                      <p>
                        Where the native moment arm disagrees with the local
                        length-change check, the action is marked unavailable.
                      </p>
                    )}
                    {region === "spine" && (
                      <p>
                        These moment arms are for {spineLevel.replace("_", "–")}
                        . Choose another joint under Fine-tune individual
                        joints.
                      </p>
                    )}
                    {selected === "tibant_r" && (
                      <p>
                        Subtalar limitation: this model retains an inversion
                        pull across the control range. Human measurements show
                        that the action can change with foot position; see the
                        evidence above.
                      </p>
                    )}
                    {config.controls
                      .filter(
                        (c) =>
                          c.group !== "girdle" &&
                          (region !== "spine" || c.level === spineLevel),
                      )
                      .map((c) => (
                        <div key={c.id}>
                          <span>{c.label}</span>
                          <b>
                            {sample.momentArms[c.id] === undefined
                              ? "Select this joint to calculate"
                              : sample.momentArmAvailable?.[c.id] === false
                                ? "Unavailable · consistency check"
                                : `${(sample.momentArms[c.id] * 1000).toFixed(1)} mm`}
                          </b>
                        </div>
                      ))}
                  </details>
                )}
                {joint === "shoulder" && (
                  <p className="bio-path-explanation">
                    These comparisons describe muscle–tendon path-length
                    changes, not activation. Move one slider at a time to
                    explore its effect while the other controlled angles stay
                    fixed.
                  </p>
                )}
              </div>
              <label className="bio-search">
                Find a muscle path
                <input
                  type="search"
                  placeholder="Search compartments…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <label className="bio-list-mode">
                Compare muscle paths
                <select
                  aria-label="Compare muscle paths"
                  value={listMode}
                  onChange={(e) => setListMode(e.target.value)}
                >
                  <option value="all">All paths · largest changes first</option>
                  <option value="Longer">Lengthening paths</option>
                  <option value="Shorter">Shortening paths</option>
                </select>
              </label>
              <div className="bio-muscle-list">
                {config.muscles
                  .filter((m) =>
                    `${m.name}${m.name.includes("SCM") ? " sternocleidomastoid" : ""}`
                      .toLowerCase()
                      .includes(filter.toLowerCase()),
                  )
                  .filter((m) => {
                    if (listMode === "all") return true;
                    const a = pose.muscles.find((s) => s.id === m.id)!,
                      b = reference.pose.muscles.find((s) => s.id === m.id)!;
                    return (
                      canUse &&
                      a.available &&
                      b.available &&
                      direction(a.length - b.length) === listMode
                    );
                  })
                  .sort((a, b) => {
                    const changeFor = (id: string) => {
                      const p = pose.muscles.find((m) => m.id === id)!,
                        r = reference.pose.muscles.find((m) => m.id === id)!;
                      return canUse && p.available && r.available
                        ? Math.abs(p.length - r.length)
                        : -1;
                    };
                    return changeFor(b.id) - changeFor(a.id);
                  })
                  .map((m) => {
                    const a = pose.muscles.find((s) => s.id === m.id)!,
                      b = reference.pose.muscles.find((s) => s.id === m.id)!;
                    return (
                      <button
                        key={m.id}
                        className={selected === m.id ? "active" : ""}
                        aria-pressed={selected === m.id}
                        onClick={() => inspectMuscle(m.id)}
                      >
                        <span>{m.name}</span>
                        <span
                          style={{
                            color:
                              canUse && a.available && b.available
                                ? pathColor(a.length - b.length)
                                : undefined,
                          }}
                        >
                          {!a.available || !b.available
                            ? "Unavailable"
                            : canUse
                              ? deltaText(a.length - b.length)
                              : "…"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </aside>
          </div>
          <div className="bio-explanation">
            <div className="bio-next-tools">
              {joint === "shoulder" && (
                <button className="small-button" onClick={onDeltoid}>
                  Deltoid close-up <ArrowRight size={14} />
                </button>
              )}
              <span>
                {region === "spine"
                  ? "Spine has its own model, pose and reference. The neck workspace uses a separate model."
                  : region === "neck"
                    ? "Both sides share this cervical-spine pose. Upper and lower controls are separate; they are not six free rotations of one joint."
                    : region === "arm"
                      ? "Elbow and wrist share this arm pose and reference. The shoulder workspace uses a separate model."
                      : region === "shoulder"
                        ? "Arm and scapular controls share this right-sided shoulder model, pose and reference."
                        : "Hip, knee and ankle share a model so their combined effects stay visible."}
              </span>
            </div>
            <p>
              <strong>What the colors mean.</strong> Longer or shorter
              muscle–tendon paths relative to your reference, calculated from
              model attachments and wrapping surfaces. Thin paths represent
              muscle compartments; they are not the outer shape of a muscle.
              “Little change” means within 1 mm for this display. These
              estimates do not tell you fiber strain, activation, tension, felt
              stretch, or a safe end range.
            </p>
            <details>
              <summary>Model assumptions, coordinates & evidence</summary>
              <p>
                {region === "spine"
                  ? "The preserved Bruno/Bern Movement Lab template contains 552 upper-body fascicles, including 74 thoracic/lumbar multifidus paths and 152 intercostal paths. Its 17 intervertebral joints retain independent native angles. Group controls distribute a change across the selected joints; their totals are sums of joint angles. The remaining joints and abdominal routing body retain their source defaults. This is a kinematic exploration, with no cartilage deformation, breathing, passive stiffness or muscle activation calculation. Rotatores and several other small muscles are available as static atlas anatomy only. Limits are exploration limits, not a person’s measured or safe range."
                  : region === "neck"
                    ? "This is the preserved Vasavada / Mortensen neck model from a pinned researcher repository. It displays 52 bilateral neck-muscle paths from the source’s 72 actuators; hyoid muscles are outside this workspace. Six existing coordinates distribute movement through the upper (C2–skull) and lower (T1–C2) neck. These prescribed joint relationships are model assumptions, not a measured movement pattern for every person. The torso and shoulder girdle stay fixed, so rib elevation during breathing is not modeled. The separate shoulder workspace uses another model. Four semispinalis-capitis compartments have no matching atlas surface; their native paths remain inspectable."
                    : region === "shoulder"
                      ? "This is the subject-scaled Seth thoracoscapular model distributed with Belli et al. (2023), with 33 compartments. Supplied reference movements come from that study’s inverse-kinematics results, assembled to satisfy the AC joint constraint. They are examples from a study participant, not a universal scapular rhythm. Manual mode independently controls three scapular angles and three arm angles. OpenSim solves clavicular position and scapular winging while keeping the AC connection closed. These independent controls do not impose a natural whole-arm coordination pattern. The study model locks the elbow straight; we preserve that constraint because its paths did not pass our elbow-motion checks."
                      : region === "arm"
                        ? "This is an adapted MoBL-ARMS model, with 17 elbow, forearm and wrist muscle paths selected from its 50 compartments. Finger and thumb muscles are outside this workspace. Shoulder position and finger grip stay fixed. The wrist uses coupled motion across two carpal joints. We restricted ECRL wrapping to the intended path segments after finding a routing jump; supinator comparisons are withheld in pronated poses because that route remains unreliable. These engineering checks do not establish accuracy for every individual. The separate shoulder workspace uses a different model and reference."
                        : "This is the Lai–Uhlrich 2022 model distributed by OpenCap, derived from the Rajagopal and Lai lower-limb models. This view includes all 40 right-sided lower-limb compartments. The pelvis stays fixed. Other unexposed coordinates start at their default values; dependent knee coordinates follow the model’s coupling constraints."}
              </p>
              <p>
                Published models support studying actions and geometric length
                changes, with task-specific evidence. Arbitrary slider
                combinations have not been validated as stretches. Joint
                wrapping approximations can change abruptly; return toward the
                starting pose if a route looks implausible. We withhold a
                compartment’s drawing and comparison when its exported path
                length differs from its native length by more than 1 mm. This is
                an engineering check, not biological validation.
              </p>
              <p>
                <a href={config.paper} target="_blank" rel="noreferrer">
                  Model publication <ExternalLink size={12} />
                </a>{" "}
                ·{" "}
                <a href={config.source} target="_blank" rel="noreferrer">
                  {region === "arm" || region === "neck"
                    ? "Pinned upstream source"
                    : "Exact source package"}{" "}
                  <ExternalLink size={12} />
                </a>
                {" · "}
                <a
                  href={assetUrl(`/credits/index.html#${region}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Full citations, licenses & changes <ExternalLink size={12} />
                </a>
              </p>
              {region === "arm" && (
                <p>
                  MoBL-ARMS by Saul and colleagues (2015), updated by{" "}
                  <a
                    href="https://doi.org/10.1115/1.4043035"
                    target="_blank"
                    rel="noreferrer"
                  >
                    McFarland and colleagues (2019)
                  </a>
                  ; ECRL routing adapted here.{" "}
                  <a
                    href={assetUrl("/models/arm/LICENSE.txt")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Model license and credits
                  </a>
                  .
                </p>
              )}
              {region === "spine" && (
                <p>
                  <a
                    href={assetUrl("/models/spine/LICENSE.txt")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Spine model source and license ↗
                  </a>
                </p>
              )}
              {region === "neck" && (
                <p>
                  Model by Vasavada, Li and Delp (1998), with the hyoid
                  additions of Mortensen, Vasavada and Merryweather (2018).{" "}
                  <a
                    href={assetUrl("/models/neck/LICENSE.txt")}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source credits and license
                  </a>
                  .
                </p>
              )}
              <dl className="bio-coordinate-table">
                {Object.entries(pose.coordinates).map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>
                      {value.toFixed(3)} {config.coordinateUnits[name]}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="bio-version">
                Model {config.modelVersion.slice(0, 12)} · Calculation{" "}
                {config.version.slice(0, 12)} · {config.engine}
              </p>
            </details>
          </div>
          {!storageOk && (
            <p role="status">
              Browser storage is unavailable. You can keep exploring; new
              references will last only for this session.
            </p>
          )}
        </>
      )}
    </section>
  );
}
