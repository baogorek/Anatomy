import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Focus, Maximize2, RotateCcw } from "lucide-react";
import { deltoidRegions, type DeltoidAsset } from "./deltoid";

type Props = {
  asset: DeltoidAsset;
  frame: number;
  part: string;
  atlas: boolean;
  showPaths: boolean;
  showAttachments: boolean;
  onPart: (id: string) => void;
};
export default function DeltoidCanvas(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const engine = useRef<{
    update: () => void;
    orient: (view: string) => void;
  } | null>(null);
  const [isolated, setIsolated] = useState(false),
    [failed, setFailed] = useState(false);
  const isolate = useRef(false);
  isolate.current = isolated;
  useEffect(() => {
    const mount = host.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef0e7");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 20);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      props.atlas
        ? "Unchanged resting deltoid anatomy"
        : "OpenSim shoulder bones and selected muscle path",
    );
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.18;
    controls.maxDistance = 1.5;
    scene.add(new THREE.HemisphereLight("#fffdfa", "#a5ad96", 2.2));
    const light = new THREE.DirectionalLight("#fff4e6", 2.1);
    light.position.set(-2, 3, 4);
    scene.add(light);
    const fill = new THREE.DirectionalLight("#dde7ec", 0.8);
    fill.position.set(2, 0, -2);
    scene.add(fill);
    const root = new THREE.Group();
    root.rotation.y = -Math.PI / 2;
    scene.add(root);
    const atlasGroup = new THREE.Group();
    scene.add(atlasGroup);
    atlasGroup.visible = false;
    const boneGroup = new THREE.Group(),
      overlays = new THREE.Group();
    root.add(boneGroup, overlays);
    const boneMaterial = new THREE.MeshStandardMaterial({
      color: "#d8d0bc",
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const contextMaterial = new THREE.MeshStandardMaterial({
      color: "#d8dfcd",
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      roughness: 1,
      side: THREE.DoubleSide,
    });
    const makeGeometry = (vertices: number[][], indices: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices.flat(), 3),
      );
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    };
    const bones = props.asset.config.meshes
      .filter((m) =>
        ["clavicle.vtp", "scapula.vtp", "humerus.vtp", "thorax.vtp"].includes(
          m.name,
        ),
      )
      .map((data) => {
        const mesh = new THREE.Mesh(
          makeGeometry(data.vertices, data.indices),
          data.name === "thorax.vtp" ? contextMaterial : boneMaterial,
        );
        mesh.matrixAutoUpdate = false;
        boneGroup.add(mesh);
        return { mesh, data };
      });
    // Raw atlas vertices retain their mutual positions and proportions.
    // This reference is displayed separately from the research-model body.
    const atlasMuscles = props.asset.parts.map((part, i) => {
      const mesh = new THREE.Mesh(
        makeGeometry(part.atlasVertices, part.indices),
        new THREE.MeshStandardMaterial({
          color: deltoidRegions[i].color,
          roughness: 0.75,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.part = part.id;
      atlasGroup.add(mesh);
      return mesh;
    });
    const atlasBox = new THREE.Box3().setFromObject(atlasGroup),
      atlasCenter = atlasBox.getCenter(new THREE.Vector3());
    atlasGroup.position.copy(atlasCenter).multiplyScalar(-1);
    const atlasContainer = new THREE.Group();
    scene.add(atlasContainer);
    atlasContainer.add(atlasGroup);
    atlasContainer.scale.setScalar(0.85);
    const focus = new THREE.Vector3(-0.18, -0.045, -0.088);
    atlasContainer.position.copy(focus);
    props.asset.atlasBones.forEach((m) => {
      const vertices = [];
      for (let i = 0; i < m.positions.length; i += 3)
        vertices.push(m.positions.slice(i, i + 3));
      atlasGroup.add(
        new THREE.Mesh(makeGeometry(vertices, m.indices), boneMaterial),
      );
    });
    let dirty = true,
      raf = 0;
    const disposeOverlays = () => {
      for (const obj of [...overlays.children]) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        overlays.remove(obj);
      }
    };
    function update() {
      const state = latest.current;
      const f = state.asset.frames[state.frame];
      root.visible = !state.atlas;
      atlasGroup.visible = state.atlas;
      bones.forEach(({ mesh, data }) => {
        const t = f.pose.transforms[data.frame];
        mesh.matrix.set(
          ...([...t[0], ...t[1], ...t[2], 0, 0, 0, 1] as Parameters<
            THREE.Matrix4["set"]
          >),
        );
      });
      atlasMuscles.forEach((mesh, i) => {
        const selected = state.asset.parts[i].id === state.part;
        mesh.visible = !isolate.current || selected;
        (mesh.material as THREE.MeshStandardMaterial).color.set(
          selected ? "#d1824d" : "#ad8573",
        );
      });
      disposeOverlays();
      const m = f.pose.muscles.find((m) => m.id === state.part)!;
      if (state.showPaths && m.path.length > 1) {
        const curve = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 1; i < m.path.length; i++)
          curve.add(
            new THREE.LineCurve3(
              new THREE.Vector3(...(m.path[i - 1] as [number, number, number])),
              new THREE.Vector3(...(m.path[i] as [number, number, number])),
            ),
          );
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 100, 0.002, 8, false),
          new THREE.MeshBasicMaterial({
            color: "#aa5d32",
            depthTest: false,
            transparent: true,
            opacity: 0.9,
          }),
        );
        tube.renderOrder = 5;
        overlays.add(tube);
      }
      if (state.showAttachments) {
        const ends = [m.path[0], m.path[m.path.length - 1]].filter(Boolean);
        ends.forEach((v, i) => {
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.0035, 16, 12),
            new THREE.MeshBasicMaterial({
              color: i ? "#345d66" : "#604431",
              depthTest: false,
            }),
          );
          dot.position.set(v[0], v[1], v[2]);
          dot.renderOrder = 6;
          overlays.add(dot);
        });
      }
      dirty = true;
    }
    function orient(view: string) {
      controls.target.copy(focus);
      const d = Math.max(0.53, 0.34 / camera.aspect);
      camera.position
        .copy(focus)
        .add(
          new THREE.Vector3(
            view === "side" ? -d : view === "oblique" ? -0.3 * d : 0,
            0.02,
            view === "side" ? 0 : view === "back" ? -d : d,
          ),
        );
      controls.update();
      dirty = true;
    }
    engine.current = { update, orient };
    update();
    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      dirty = true;
    };
    resize();
    orient("oblique");
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    controls.addEventListener("change", () => {
      dirty = true;
    });
    const draw = () => {
      raf = requestAnimationFrame(draw);
      controls.update();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    draw();
    let down = [0, 0];
    const onDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObjects(
        (latest.current.atlas ? atlasMuscles : []).filter((m) => m.visible),
      )[0];
      if (hit) latest.current.onPart(hit.object.userData.part);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      disposeOverlays();
      const materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material))
            o.material.forEach((m) => materials.add(m));
          else materials.add(o.material);
        }
      });
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      engine.current = null;
    };
  }, [props.asset]);
  useEffect(() => {
    engine.current?.update();
  }, [
    props.frame,
    props.part,
    props.atlas,
    props.showPaths,
    props.showAttachments,
    isolated,
  ]);
  return (
    <div
      className="deltoid-stage"
      ref={shell}
      role="group"
      aria-label={props.atlas ? "Resting anatomy" : "Moving mechanics"}
    >
      <div ref={host} className="deltoid-canvas" />
      {failed && (
        <p className="deltoid-canvas-error" role="alert">
          3D is unavailable in this browser. The attachment descriptions and
          native length results are still available.
        </p>
      )}
      <div className="deltoid-stage-heading">
        <span>
          {props.atlas
            ? "RESTING ATLAS · RIGHT DELTOID"
            : "MOVING BONES · CALCULATED PATH"}
        </span>
        <button
          className="icon-button"
          aria-label="Expand deltoid demonstration"
          onClick={() =>
            document.fullscreenElement
              ? document.exitFullscreen()
              : shell.current
                  ?.closest(".deltoid-interaction")
                  ?.requestFullscreen()
          }
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="deltoid-stage-tools">
        <div className="segmented">
          {["front", "side", "back"].map((view) => (
            <button key={view} onClick={() => engine.current?.orient(view)}>
              {view[0].toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
        <button
          className="small-button"
          aria-label="Reset deltoid camera"
          onClick={() => engine.current?.orient("oblique")}
        >
          <RotateCcw size={14} />
        </button>
        {props.atlas && (
          <button
            className="small-button"
            aria-pressed={isolated}
            onClick={() => setIsolated(!isolated)}
          >
            <Focus size={14} /> Isolate
          </button>
        )}
      </div>
    </div>
  );
}
