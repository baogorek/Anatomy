import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { X } from "lucide-react";
import {
  muscleAtlas,
  atlasUnavailable,
  type MuscleAtlasAsset,
} from "./muscleAtlas";
const cached = new Map<string, Promise<MuscleAtlasAsset>>();
function load(dataset = "atlas") {
  if (!cached.has(dataset))
    cached.set(
      dataset,
      fetch(`/models/muscle-reference/${dataset}.json`)
        .then(async (r) => {
          if (!r.ok) throw Error("The anatomy reference could not load.");
          const a = await r.json();
          if (a.schema !== 1)
            throw Error("The anatomy reference needs updating.");
          return a;
        })
        .catch((e) => {
          cached.delete(dataset);
          throw e;
        }),
    );
  return cached.get(dataset)!;
}
export default function MuscleReference({
  id,
  pathName,
  onClose,
  anatomyOnly = false,
  comparisonNote,
}: {
  anatomyOnly?: boolean;
  comparisonNote?: string;
  id: string;
  pathName: string;
  onClose: () => void;
}) {
  const match = muscleAtlas[id];
  const mount = useRef<HTMLDivElement>(null);
  const orient = useRef<((view: string) => void) | null>(null);
  const visibility = useRef<
    ((muscle: boolean, fascia: boolean) => void) | null
  >(null);
  const [showMuscle, setShowMuscle] = useState(true);
  const [showFascia, setShowFascia] = useState(true);
  const [asset, setAsset] = useState<MuscleAtlasAsset | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setError("");
    setAsset(null);
    if (match)
      load(match.dataset)
        .then((a) => {
          if (alive) setAsset(a);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    return () => {
      alive = false;
    };
  }, [!!match, match?.dataset, retry]);
  useEffect(() => {
    setShowMuscle(true);
    setShowFascia(true);
  }, [id]);
  useEffect(() => {
    visibility.current?.(showMuscle, showFascia);
  }, [showMuscle, showFascia]);
  useEffect(() => {
    if (!asset || !match || asset.dataset !== match.dataset || !mount.current)
      return;
    const host = mount.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#edf0e5");
    const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 10);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setError(
        "3D is unavailable; the named muscle correspondence is shown below.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      `Resting atlas anatomy: ${match.label}`,
    );
    scene.add(new THREE.HemisphereLight("#ffffff", "#87947a", 2.5));
    const light = new THREE.DirectionalLight("#fff4e4", 2.5);
    light.position.set(-2, 3, 4);
    scene.add(light);
    const muscleGroup = new THREE.Group(),
      fascia = new THREE.Group(),
      bones = new THREE.Group();
    scene.add(bones, muscleGroup, fascia);
    const material = new THREE.MeshStandardMaterial({
      color: "#d4824b",
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const boneMaterial = new THREE.MeshStandardMaterial({
      color: "#d2c9b2",
      roughness: 1,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const fasciaMaterial = new THREE.MeshStandardMaterial({
      color: "#b6cbd1",
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    for (const data of asset.meshes) {
      if (
        data.bone
          ? data.region !== match.region && data.region !== "both"
          : !match.names.includes(data.name) &&
            !match.fasciaNames?.includes(data.name)
      )
        continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.positions, 3),
      );
      g.setIndex(data.indices);
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(
        g,
        data.bone ? boneMaterial : data.fascia ? fasciaMaterial : material,
      );
      (data.bone ? bones : data.fascia ? fascia : muscleGroup).add(mesh);
    }
    const box = new THREE.Box3().setFromObject(muscleGroup);
    if (match.fasciaNames) box.union(new THREE.Box3().setFromObject(fascia));
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(center);
    controls.minDistance = 0.08;
    controls.maxDistance = 3;
    let dirty = true,
      frame = 0,
      distance = 0.7;
    visibility.current = (muscleVisible, fasciaVisible) => {
      muscleGroup.visible = muscleVisible;
      fascia.visible = fasciaVisible;
      dirty = true;
    };
    visibility.current(showMuscle, showFascia);
    orient.current = (view) => {
      controls.target.copy(center);
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(
            view === "oblique"
              ? -distance * 0.707
              : view === "side"
                ? -distance
                : 0,
            0.025,
            view === "oblique"
              ? distance * 0.707
              : view === "back"
                ? -distance
                : view === "side"
                  ? 0.001
                  : distance,
          ),
        );
      controls.update();
      dirty = true;
    };
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
      distance = Math.max(0.14, size.y, size.x / camera.aspect) * 2.1;
      dirty = true;
    };
    resize();
    orient.current(
      match.fasciaNames
        ? "oblique"
        : /rotatores|interspinal|intertransvers|multifidus|spinalis|longissimus|iliocostalis|femoris.*long|femoris.*short|semi|glute|latiss|rhombo|trapez|infraspin|teres|posterior|supraspin/i.test(
              match.label,
            )
          ? "back"
          : "front",
    );
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener("change", () => {
      dirty = true;
    });
    function draw() {
      frame = requestAnimationFrame(draw);
      controls.update();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    }
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      material.dispose();
      fasciaMaterial.dispose();
      boneMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      orient.current = null;
      visibility.current = null;
    };
  }, [asset, id, retry]);
  return (
    <section
      className="bio-anatomy-reference"
      aria-label="Selected muscle anatomy"
    >
      <div className="bio-anatomy-heading">
        <div>
          <span className="eyebrow">MUSCLE ANATOMY · RESTING POSE</span>
          <h3>{match?.label || pathName}</h3>
        </div>
        <button
          className="icon-button"
          aria-label="Close muscle anatomy"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      {comparisonNote && (
        <p className="bio-atlas-comparison">{comparisonNote}</p>
      )}
      {!match ? (
        <p>
          {atlasUnavailable[id] ||
            `No matching muscle surface is available in this atlas. The selected line identifies ${pathName}; its model path and calculations are handled by the movement view.`}
        </p>
      ) : (
        <>
          {error ? (
            <p role="alert">
              {error}{" "}
              <button onClick={() => setRetry((n) => n + 1)}>
                Retry anatomy reference
              </button>
            </p>
          ) : !asset ? (
            <p role="status">Loading muscle anatomy…</p>
          ) : null}
          <div ref={mount} className="bio-anatomy-canvas" />
          {match.fasciaNames && (
            <div className="bio-tissue-controls" aria-label="Anatomy layers">
              <label>
                <input
                  type="checkbox"
                  checked={showMuscle}
                  onChange={(e) => setShowMuscle(e.target.checked)}
                />
                <i className="tissue-muscle" />
                TFL muscle
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showFascia}
                  onChange={(e) => setShowFascia(e.target.checked)}
                />
                <i className="tissue-fascia" />
                IT band · fascia
              </label>
            </div>
          )}
          <div className="bio-anatomy-views">
            {["Front", "Back", "Side"].map((v) => (
              <button key={v} onClick={() => orient.current?.(v.toLowerCase())}>
                {v}
              </button>
            ))}
            <span>Drag to rotate · scroll to zoom</span>
          </div>
          {match.fasciaNames && (
            <p className="bio-tfl-connection">
              The orange TFL muscle joins the pale blue iliotibial tract (IT
              band), which continues down the outer thigh to the tibia. Toggle
              either tissue to see their relationship.{" "}
              <a
                href="https://www.ncbi.nlm.nih.gov/books/NBK499870/"
                target="_blank"
                rel="noreferrer"
              >
                Anatomy ↗
              </a>
            </p>
          )}
          <p>
            <strong>{anatomyOnly ? "Atlas anatomy:" : "Selected line:"}</strong>{" "}
            {pathName}.{" "}
            {anatomyOnly
              ? "No separate force path for this muscle is present in this model. The orange atlas anatomy is held at rest; no movement calculation is assigned to it."
              : match.compartment
                ? "The atlas shows the broader muscle or head; this model compartment is not separately segmented."
                : match.fasciaNames
                  ? "OpenSim represents this muscle–fascia route as one path; its length change does not separate muscle stretch from fascia stretch."
                  : "The named muscle or region is highlighted in orange."}
          </p>
          <p className="bio-anatomy-note">
            Separate atlas body, held at rest. Its shape and attachment areas
            are not aligned to the moving model’s endpoints. This shape does not
            follow the moving bones.{" "}
            <a
              href="/models/muscle-reference/ATTRIBUTION.md"
              target="_blank"
              rel="noreferrer"
            >
              Source ↗
            </a>
          </p>
        </>
      )}
    </section>
  );
}
