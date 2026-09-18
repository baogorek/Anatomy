import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Focus,
  MousePointer2,
  Move,
  Layers3,
  LoaderCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { muscles, type Muscle } from "./data";
export type Layer = "muscles" | "deep" | "bones";
interface Props {
  selected: Muscle;
  onSelect: (id: string) => void;
  layer: Layer;
  setLayer: (layer: Layer) => void;
  maskNames?: boolean;
  highlight?: boolean;
  viewKey?: string;
  onPick?: (id: string | null, name: string) => void;
  onUnavailable?: () => void;
  onMotionHelp?: () => void;
  onMovement?: () => void;
}
interface Engine {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  meshes: THREE.Mesh[];
  render: () => void;
  apply: () => void;
}
const surface =
  /deltoid muscle|trapezius muscle|pectoralis major muscle|latissimus dorsi muscle/;
export default function AnatomyViewer({
  selected,
  onSelect,
  layer,
  setLayer,
  maskNames = false,
  highlight = true,
  viewKey,
  onPick,
  onUnavailable,
  onMotionHelp,
  onMovement,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    callout = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null),
    current = useRef({
      selected,
      onSelect,
      layer,
      isolated: false,
      labels: true,
      maskNames,
      highlight,
      onPick,
      onUnavailable,
    });
  const [status, setStatus] = useState("loading"),
    [view, setView] = useState("front"),
    [isolated, setIsolated] = useState(false),
    [labels, setLabels] = useState(true),
    [expanded, setExpanded] = useState(false),
    [hover, setHover] = useState(""),
    [inspected, setInspected] = useState(""),
    [occluded, setOccluded] = useState(false);
  current.current = {
    selected,
    onSelect,
    layer,
    isolated,
    labels,
    maskNames,
    highlight,
    onPick,
    onUnavailable,
  };
  useEffect(() => {
    if (!host.current) return;
    let alive = true,
      frame = 0;
    let renderDirty = true;
    const mount = host.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
    camera.position.set(0, 1.32, 1.65);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus("error");
      current.current.onUnavailable?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D upper-body anatomy. Drag to rotate and scroll to zoom. Muscles can also be selected from the list.",
    );
    renderer.domElement.setAttribute("role", "img");
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 0.45;
    controls.maxDistance = 3;
    controls.enablePan = true;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI - 0.3;
    function syncView() {
      const azimuth = Math.abs(controls.getAzimuthalAngle());
      const level = Math.abs(controls.getPolarAngle() - Math.PI / 2) < 0.15;
      setView(
        !level
          ? "free"
          : azimuth < 0.12
            ? "front"
            : Math.abs(azimuth - Math.PI) < 0.12
              ? "back"
              : Math.abs(azimuth - Math.PI / 2) < 0.12
                ? "side"
                : "free",
      );
    }
    controls.addEventListener("end", syncView);
    function invalidate() {
      renderDirty = true;
    }
    controls.addEventListener("change", invalidate);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb4a79b, 1.6));
    const key = new THREE.DirectionalLight(0xfff4e8, 2.5);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe4eeef, 1.2);
    fill.position.set(4, 2, -3);
    scene.add(fill);
    const meshes: THREE.Mesh[] = [];
    const cut = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.88);
    const base = new THREE.MeshStandardMaterial({
      color: 0xad7668,
      roughness: 0.72,
      metalness: 0,
      clippingPlanes: [cut],
      side: THREE.DoubleSide,
    });
    const bone = new THREE.MeshStandardMaterial({
      color: 0xe5dac4,
      roughness: 0.85,
      clippingPlanes: [cut],
      side: THREE.DoubleSide,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0xd9693f,
      roughness: 0.57,
      emissive: 0x77301a,
      emissiveIntensity: 0.13,
      clippingPlanes: [cut],
      side: THREE.DoubleSide,
    });
    const ghost = new THREE.MeshStandardMaterial({
      color: 0xd5d6cf,
      roughness: 0.9,
      clippingPlanes: [cut],
      side: THREE.DoubleSide,
    });
    let anchor: THREE.Vector3 | null = null;
    let anchorCandidates: THREE.Vector3[] = [];
    let labelVisible = true,
      labelDirty = true,
      lastLabelCheck = 0;
    const labelRay = new THREE.Raycaster(),
      labelDirection = new THREE.Vector3(),
      lastLabelCamera = new THREE.Vector3();
    function apply() {
      const state = current.current;
      renderDirty = true;
      labelDirty = true;
      anchor = null;
      anchorCandidates = [];
      const matches: THREE.Mesh[] = [];
      meshes.forEach((mesh) => {
        const name = String(mesh.userData.nameDetail || mesh.name)
          .replaceAll("_", " ")
          .toLowerCase();
        const isBone = mesh.userData.type === "bone";
        const match = name.includes(state.selected.match);
        mesh.visible =
          mesh.userData.upper &&
          (state.isolated
            ? match || (isBone && /scapula|clavicle|humerus/.test(name))
            : state.layer === "bones"
              ? isBone
              : state.layer === "deep"
                ? isBone || !surface.test(name) || match
                : true);
        mesh.material =
          match && state.highlight && state.layer !== "bones"
            ? accent
            : isBone
              ? bone
              : state.layer === "deep"
                ? ghost
                : base;
        if (match && state.highlight && mesh.visible && state.layer !== "bones")
          matches.push(mesh);
      });
      if (matches.length) {
        // Use one anatomical side so the callout does not sit between the shoulders.
        const side = matches.filter(
          (m) =>
            new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).x >
            0,
        );
        anchorCandidates = (side.length ? side : matches).map((m) =>
          new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()),
        );
        anchor = anchorCandidates[0].clone();
      }
    }
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    draco.setWorkerLimit(2);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      "/models/body.glb",
      (gltf) => {
        if (!alive) {
          gltf.scene.traverse((obj) => {
            if (obj instanceof THREE.Mesh) obj.geometry.dispose();
          });
          return;
        }
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const isSupported =
              obj.userData.type === "muscle" || obj.userData.type === "bone";
            if (!isSupported) {
              obj.visible = false;
              return;
            }
            const box = new THREE.Box3().setFromObject(obj);
            obj.userData.upper = box.max.y > 0.89;
            // Material classification also handles metadata omissions in the source.
            meshes.push(obj);
          }
        });
        scene.add(gltf.scene);
        apply();
        setStatus("ready");
      },
      undefined,
      () => {
        if (alive) {
          setStatus("error");
          current.current.onUnavailable?.();
        }
      },
    );
    function resize() {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderDirty = true;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    function hit(event: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      return ray
        .intersectObjects(
          meshes.filter((m) => m.visible),
          false,
        )
        .find((h) => h.point.y >= 0.88);
    }
    function down(e: PointerEvent) {
      downX = e.clientX;
      downY = e.clientY;
    }
    function up(e: PointerEvent) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const found = hit(e);
      if (!found) return;
      const m = muscles.find((m) =>
        String(found.object.userData.nameDetail || found.object.name)
          .replaceAll("_", " ")
          .toLowerCase()
          .includes(m.match),
      );
      if (current.current.onPick) {
        current.current.onPick(
          m?.id || null,
          String(
            m?.name ||
              found.object.userData.nameDetail ||
              found.object.userData.name ||
              found.object.name,
          ),
        );
        setInspected("");
        return;
      }
      if (m) {
        current.current.onSelect(m.id);
        setInspected("");
      } else {
        setInspected(
          found.object.userData.nameDetail ||
            found.object.userData.name ||
            found.object.name,
        );
      }
    }
    function move(e: PointerEvent) {
      if (e.buttons) return;
      const found = hit(e);
      const name = found?.object.userData.name || "";
      setHover(current.current.maskNames ? "" : name);
      renderer.domElement.style.cursor = found ? "pointer" : "grab";
    }
    function leave() {
      setHover("");
    }
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerleave", leave);
    const projected = new THREE.Vector3();
    function render() {
      if (!alive) return;
      frame = requestAnimationFrame(render);
      controls.update();
      // Render only when the camera, pose, or display changes.
      if (renderDirty) {
        renderer.render(scene, camera);
        renderDirty = false;
      }
      if (callout.current) {
        const now = performance.now();
        if (
          anchor &&
          (labelDirty ||
            (now - lastLabelCheck > 180 &&
              camera.position.distanceToSquared(lastLabelCamera) > 0.000001))
        ) {
          const visibleMeshes = meshes.filter((m) => m.visible);
          labelVisible = false;
          // Separate muscle heads can surround empty space. Check each head
          // and anchor the label to a surface that is actually visible.
          for (const candidate of anchorCandidates) {
            labelDirection.copy(candidate).sub(camera.position).normalize();
            labelRay.set(camera.position, labelDirection);
            const first = labelRay
              .intersectObjects(visibleMeshes, false)
              .find((hit) => hit.point.y >= 0.88);
            if (
              first &&
              String(first.object.userData.nameDetail || first.object.name)
                .replaceAll("_", " ")
                .toLowerCase()
                .includes(current.current.selected.match)
            ) {
              labelVisible = true;
              anchor.copy(first.point);
              break;
            }
          }
          lastLabelCamera.copy(camera.position);
          lastLabelCheck = now;
          labelDirty = false;
          setOccluded(!labelVisible);
        }
        const show =
          anchor &&
          labelVisible &&
          current.current.labels &&
          !current.current.maskNames &&
          current.current.layer !== "bones";
        callout.current.style.display = show ? "flex" : "none";
        if (show && anchor) {
          projected.copy(anchor).project(camera);
          const x = (projected.x * 0.5 + 0.5) * mount.clientWidth;
          const y = (-projected.y * 0.5 + 0.5) * mount.clientHeight;
          callout.current.style.left = `${Math.max(12, Math.min(mount.clientWidth - 165, x + 18))}px`;
          callout.current.style.top = `${Math.max(80, Math.min(mount.clientHeight - 100, y))}px`;
        }
      }
    }
    engine.current = {
      camera,
      controls,
      meshes,
      render,
      apply,
    };
    render();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.removeEventListener("end", syncView);
      controls.removeEventListener("change", invalidate);
      controls.dispose();
      draco.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerleave", leave);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      [base, bone, accent, ghost].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.apply();
    setInspected("");
  }, [selected, layer, isolated, status, highlight, maskNames]);
  useEffect(() => {
    if (status === "ready") orient(selected.view);
  }, [viewKey ?? selected.id, status]);
  useEffect(() => {
    setIsolated(false);
    setInspected("");
    setHover("");
  }, [viewKey]);
  useEffect(() => {
    if (layer === "bones") setIsolated(false);
  }, [layer]);
  useEffect(() => {
    const listener = () =>
      setExpanded(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);
  function orient(next: string) {
    const e = engine.current;
    if (!e) return;
    const distance = e.camera.position.distanceTo(e.controls.target);
    e.controls.target.set(0, 1.3, 0);
    e.camera.position.set(
      0 + (next === "side" ? distance : 0),
      1.32,
      next === "back" ? -distance : next === "side" ? 0.001 : distance,
    );
    e.controls.update();
    setView(next);
  }
  function zoom(factor: number) {
    const e = engine.current;
    if (!e) return;
    const offset = e.camera.position
      .clone()
      .sub(e.controls.target)
      .multiplyScalar(factor);
    offset.clampLength(0.45, 3);
    e.camera.position.copy(e.controls.target).add(offset);
    e.controls.update();
  }
  function reset() {
    const e = engine.current;
    if (!e) return;
    e.controls.target.set(0, 1.3, 0);
    e.camera.position.set(0, 1.32, 1.65);
    e.controls.update();
    setIsolated(false);
    setLayer(selected.deep ? "deep" : "muscles");
    orient(selected.view);
    setInspected("");
  }
  async function fullscreen() {
    if (expanded && !document.fullscreenElement) {
      setExpanded(false);
      return;
    }
    if (!document.fullscreenElement) {
      try {
        await shell.current?.requestFullscreen();
      } catch {
        setExpanded((v) => !v);
      }
    } else await document.exitFullscreen();
  }
  return (
    <div className={`anatomy-viewer ${expanded ? "expanded" : ""}`} ref={shell}>
      <div className="viewer-shell">
        <div className="viewer-grid" />
        <div className="viewer-top">
          <span className="live-label">
            <i /> INTERACTIVE 3D
          </span>
          <button
            className="motion-toggle small-button"
            onClick={() => {
              onMotionHelp?.();
              onMovement?.();
            }}
          >
            Open movement lab
          </button>
          <button
            className="icon-button"
            title={expanded ? "Exit fullscreen" : "Fullscreen"}
            aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
            onClick={fullscreen}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
        <div ref={host} className="canvas-host" />
        {status === "loading" && (
          <div className="viewer-loading">
            <LoaderCircle className="spin" size={27} />
            <strong>Bringing anatomy to life</strong>
            <span>Loading your 3D shoulder atlas…</span>
          </div>
        )}
        {status === "error" && (
          <div className="viewer-loading">
            <strong>The 3D model couldn’t load</strong>
            <span>
              Use the written alternative or muscle list to keep exploring.
            </span>
            <button
              className="small-button"
              onClick={() => window.location.reload()}
            >
              Retry viewer
            </button>
          </div>
        )}
        <div className="anatomy-callout" ref={callout}>
          <span className="callout-line" />
          <span>
            <i />
            {maskNames ? "" : selected.name}
          </span>
        </div>
        <div className="orientation-label">
          {view === "front"
            ? "ANTERIOR"
            : view === "back"
              ? "POSTERIOR"
              : view === "side"
                ? "LATERAL"
                : "FREE"}{" "}
          VIEW
          <span>
            {isolated
              ? "Selected anatomy isolated"
              : layer === "deep"
                ? "Superficial muscles removed"
                : layer === "bones"
                  ? "Skeletal structures"
                  : "Upper-body musculature"}
          </span>
        </div>
        <div className="viewer-tools">
          <button
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => zoom(0.85)}
          >
            <Plus size={19} />
          </button>
          <button
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => zoom(1.15)}
          >
            <Minus size={19} />
          </button>
          <span />
          <button aria-label="Reset view" title="Reset view" onClick={reset}>
            <RotateCcw size={17} />
          </button>
          <button
            disabled={maskNames}
            aria-label="Toggle labels"
            title="Toggle labels"
            className={!labels ? "active" : ""}
            onClick={() => setLabels((v) => !v)}
          >
            {labels ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
        </div>
        {inspected && !maskNames && (
          <button className="structure-chip" onClick={() => setInspected("")}>
            {inspected}
            <span>×</span>
          </button>
        )}
        {highlight &&
          !maskNames &&
          occluded &&
          status === "ready" &&
          layer !== "bones" &&
          !isolated && (
            <button
              className="occlusion-hint"
              onClick={() => {
                setIsolated(true);
                orient(selected.view);
              }}
            >
              <Focus size={13} /> Selected muscle is hidden · Isolate to reveal
            </button>
          )}
        <div className="viewer-bottom">
          <div className="view-switch" aria-label="Camera views">
            {["front", "back", "side"].map((v) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => orient(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button
            className={`isolate-button ${isolated ? "active" : ""}`}
            disabled={layer === "bones" || !highlight}
            onClick={() => {
              if (!isolated && occluded) orient(selected.view);
              setIsolated((v) => !v);
            }}
            aria-pressed={isolated}
          >
            <Focus size={15} />
            {isolated ? "Show all" : "Isolate"}
          </button>
        </div>
        <div className="viewer-instructions">
          <span>
            {hover && !maskNames ? (
              <>
                <MousePointer2 size={12} />
                {hover}
              </>
            ) : (
              <>
                <Move size={12} /> Drag to rotate <b>·</b> Scroll to zoom
              </>
            )}
          </span>
          <span>
            <Layers3 size={12} /> Z-Anatomy
          </span>
        </div>
      </div>
    </div>
  );
}
