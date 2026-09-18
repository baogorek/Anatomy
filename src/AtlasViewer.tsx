import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

type Side = "right" | "left" | "both";
type View = "front" | "back" | "side";
type Engine = {
  apply: () => void;
  focus: (view?: View) => void;
  zoom: (scale: number) => void;
};
const nameOf = (mesh: THREE.Object3D) =>
  String(mesh.userData.nameDetail || mesh.name).replaceAll("_", " ");

export default function AtlasViewer({
  name,
  onPick,
}: {
  name: string;
  onPick: (name: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [side, setSide] = useState<Side>("right");
  const [context, setContext] = useState(false);
  const [status, setStatus] = useState("loading");
  const [expanded, setExpanded] = useState(false);
  const current = useRef({ name, onPick, side, context });
  current.current = { name, onPick, side, context };
  useEffect(() => {
    const mount = host.current!;
    let alive = true,
      frame = 0,
      dirty = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.002, 20);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus("error");
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Resting anatomy. Drag to rotate, scroll or pinch to zoom. Choose structures from the searchable list.",
    );
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.04;
    controls.maxDistance = 5;
    const invalidate = () => {
      dirty = true;
    };
    controls.addEventListener("change", invalidate);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9d9b82, 2));
    const light = new THREE.DirectionalLight(0xfff9e8, 3);
    light.position.set(-3, 5, 5);
    scene.add(light);
    const muscle = new THREE.MeshStandardMaterial({
      color: 0xb66035,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const surrounding = new THREE.MeshStandardMaterial({
      color: 0xb4b6a7,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bone = new THREE.MeshStandardMaterial({
      color: 0xe3dec3,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const meshes: THREE.Mesh[] = [],
      boxes = new Map<THREE.Mesh, THREE.Box3>();
    let selectedBox = new THREE.Box3();
    function apply() {
      const state = current.current;
      const candidates = meshes.filter(
        (m) => nameOf(m) === state.name && m.userData.type === "muscle",
      );
      const selected = candidates.filter((m) => {
        const x = boxes.get(m)!.getCenter(new THREE.Vector3()).x;
        return (
          state.side === "both" ||
          Math.abs(x) < 0.006 ||
          (state.side === "right" ? x < 0 : x > 0)
        );
      });
      // Midline or unpaired source geometry still remains inspectable.
      const shown = new Set(selected.length ? selected : candidates);
      selectedBox = new THREE.Box3();
      for (const m of shown) selectedBox.union(boxes.get(m)!);
      const nearby = selectedBox.clone().expandByScalar(0.1);
      for (const m of meshes) {
        const isSelected = shown.has(m),
          isBone = m.userData.type === "bone";
        m.visible =
          isSelected ||
          ((isBone || state.context) && nearby.intersectsBox(boxes.get(m)!));
        m.material = isSelected ? muscle : isBone ? bone : surrounding;
        m.renderOrder = isSelected ? 2 : 0;
      }
      renderer.domElement.dataset.selected = state.name;
      renderer.domElement.dataset.highlightedMeshes = String(shown.size);
      dirty = true;
    }
    function focus(view: View = "front") {
      if (selectedBox.isEmpty()) return;
      const center = selectedBox.getCenter(new THREE.Vector3());
      const size = selectedBox.getSize(new THREE.Vector3());
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const width = view === "side" ? size.z : size.x;
      const distance = Math.max(
        0.14,
        (Math.max(size.y, width / camera.aspect) / (2 * Math.tan(halfFov))) *
          1.5 +
          size.z,
      );
      controls.target.copy(center);
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(
            view === "side" ? distance : 0,
            0,
            view === "back" ? -distance : view === "side" ? 0 : distance,
          ),
        );
      controls.update();
      dirty = true;
    }
    engine.current = {
      apply,
      focus,
      zoom(scale) {
        const offset = camera.position
          .clone()
          .sub(controls.target)
          .multiplyScalar(scale)
          .clampLength(0.04, 5);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      },
    };
    const decoder = new DRACOLoader()
      .setDecoderPath("/draco/")
      .setWorkerLimit(2);
    const originalMaterials = new Set<THREE.Material>();
    new GLTFLoader().setDRACOLoader(decoder).load(
      "/models/body.glb",
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          for (const m of Array.isArray(obj.material)
            ? obj.material
            : [obj.material])
            originalMaterials.add(m);
          if (!alive) {
            obj.geometry.dispose();
            return;
          }
          obj.visible =
            obj.userData.type === "muscle" || obj.userData.type === "bone";
          if (!obj.visible) return;
          meshes.push(obj);
          boxes.set(obj, new THREE.Box3().setFromObject(obj));
        });
        originalMaterials.forEach((m) => m.dispose());
        if (!alive) return;
        scene.add(gltf.scene);
        apply();
        focus();
        setStatus("ready");
      },
      undefined,
      () => {
        if (alive) setStatus("error");
      },
    );
    function resize() {
      if (!mount.clientWidth || !mount.clientHeight) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    const down = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(
        meshes.filter((m) => m.visible && m.userData.type === "muscle"),
        false,
      )[0];
      if (hit) current.current.onPick(nameOf(hit.object));
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    function render() {
      if (!alive) return;
      frame = requestAnimationFrame(render);
      controls.update();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    }
    render();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      decoder.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      [muscle, surrounding, bone].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.apply();
    engine.current?.focus();
  }, [name, side]);
  useEffect(() => {
    engine.current?.apply();
  }, [context]);
  useEffect(() => {
    const changed = () =>
      setExpanded(document.fullscreenElement === shell.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement)
        setExpanded(false);
    };
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function fullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (expanded) setExpanded(false);
    else {
      try {
        await shell.current?.requestFullscreen();
      } catch {
        setExpanded(true);
      }
    }
  }
  return (
    <div className={`atlas-viewer ${expanded ? "expanded" : ""}`} ref={shell}>
      <div className="atlas-viewer-toolbar">
        <label>
          View{" "}
          <select
            aria-label="Anatomy side"
            value={side}
            onChange={(e) => setSide(e.target.value as Side)}
          >
            <option value="right">Right / midline</option>
            <option value="left">Left / midline</option>
            <option value="both">Both sides</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={context}
            onChange={(e) => setContext(e.target.checked)}
          />{" "}
          Surrounding muscles
        </label>
        <button
          className="icon-button"
          aria-label={
            expanded ? "Exit fullscreen anatomy" : "Fullscreen anatomy"
          }
          onClick={fullscreen}
        >
          <Maximize2 size={17} />
        </button>
      </div>
      <div className="atlas-canvas" ref={host}>
        {status !== "ready" && (
          <div className="atlas-loading" role="status">
            {status === "error"
              ? "The 3D model couldn’t load. The catalog and movement links are still available."
              : "Loading resting anatomy…"}
          </div>
        )}
      </div>
      <div className="atlas-viewer-toolbar">
        <div className="segmented">
          {(["front", "back", "side"] as View[]).map((v) => (
            <button key={v} onClick={() => engine.current?.focus(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <span className="atlas-camera-tools">
          <button
            className="icon-button"
            aria-label="Zoom in anatomy"
            onClick={() => engine.current?.zoom(0.8)}
          >
            <Plus size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out anatomy"
            onClick={() => engine.current?.zoom(1.25)}
          >
            <Minus size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Reset anatomy view"
            onClick={() => engine.current?.focus()}
          >
            <RotateCcw size={17} />
          </button>
        </span>
      </div>
      <p className="atlas-viewer-hint">
        Resting anatomy · drag to rotate · scroll or pinch to zoom
      </p>
    </div>
  );
}
