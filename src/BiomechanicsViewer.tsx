import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Focus, Maximize2, RotateCcw, Plus, Minus } from "lucide-react";
import { joints, boneNames, type Joint } from "./jointLearning";
import { pathColor, type ModelConfig, type ModelPose } from "./biomechanics";

type Props = {
  config: ModelConfig;
  joint: Joint | "wholebody";
  pose: ModelPose;
  reference: ModelPose;
  selected: string;
  onSelect: (id: string) => void;
  hideResults: boolean;
  spineLevel?: string;
  focusFrame?: string;
  visiblePaths?: ReadonlySet<string>;
  familyPaths?: ReadonlySet<string>;
  boneOpacity?: number;
  showPathMarkers?: boolean;
  onBonesOnlyChange?: (value: boolean) => void;
  isolated?: boolean;
  onIsolationChange?: (value: boolean) => void;
};
export default function BiomechanicsViewer(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    shell = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const focusJoint = useRef<((scapula?: boolean) => void) | null>(null);
  const frameWhole = useRef<(() => void) | null>(null);
  const focusPath = useRef<(() => void) | null>(null);
  const zoom = useRef<((factor: number) => void) | null>(null);
  const update = useRef<(() => void) | null>(null),
    orient = useRef<((view: string, fit?: boolean) => void) | null>(null);
  const [localIsolated, setLocalIsolated] = useState(false),
    isolation = useRef(false),
    [failed, setFailed] = useState(false),
    [expanded, setExpanded] = useState(false);
  const isolated = props.isolated ?? localIsolated;
  function setIsolated(value: boolean) {
    setLocalIsolated(value);
    props.onIsolationChange?.(value);
  }
  isolation.current = isolated;
  const [bonesOnly, setBonesOnly] = useState(false);
  const [hover, setHover] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedBone, setSelectedBone] = useState(
    props.joint === "wholebody"
      ? props.config.meshes[0]?.id || ""
      : joints[props.joint].bones[0],
  );
  const display = useRef({ bonesOnly, selectedBone });
  display.current = { bonesOnly, selectedBone };
  useEffect(() => {
    setSelectedBone(
      props.joint === "wholebody"
        ? props.config.meshes[0]?.id || ""
        : joints[props.joint].bones[0],
    );
    setLocalIsolated(false);
  }, [props.joint]);
  useEffect(() => {
    const sync = () =>
      setExpanded(
        document.fullscreenElement ===
          shell.current?.closest(".bio-interaction"),
      );
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    const host = mount.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#edf0e5");
    const camera = new THREE.PerspectiveCamera(36, 1, 0.005, 50);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive OpenSim bones and muscle paths",
    );
    renderer.domElement.setAttribute("role", "img");
    scene.add(new THREE.HemisphereLight("#ffffff", "#929b83", 2.5));
    const sun = new THREE.DirectionalLight("#fff7e6", 3);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = props.config.region === "arm" ? 0.12 : 0.3;
    controls.maxDistance = 5;
    const root = new THREE.Group();
    // Proper rotation: OpenSim +X forward, +Y up, +Z right -> Three front +Z.
    root.rotation.y = -Math.PI / 2;
    scene.add(root);
    const bones = new THREE.Group(),
      paths = new THREE.Group();
    root.add(bones, paths);
    const renderedPathIds = new Set<string>();
    const markerCanvas = document.createElement("canvas");
    markerCanvas.width = markerCanvas.height = 32;
    const markerContext = markerCanvas.getContext("2d");
    if (markerContext) {
      markerContext.fillStyle = "white";
      markerContext.beginPath();
      markerContext.arc(16, 16, 14, 0, Math.PI * 2);
      markerContext.fill();
    }
    const markerTexture = new THREE.CanvasTexture(markerCanvas);
    const material = new THREE.MeshStandardMaterial({
      color: "#ded8c5",
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const meshes = props.config.meshes
      .filter(
        (data) =>
          props.config.region !== "arm" ||
          !["thorax.vtp", "clavicle.vtp", "scapula.vtp"].includes(data.name),
      )
      .map((data) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(data.vertices.flat(), 3),
        );
        geometry.setIndex(data.indices);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material.clone());
        mesh.userData.bone = props.joint === "wholebody" ? data.id : data.name;
        mesh.matrixAutoUpdate = false;
        bones.add(mesh);
        return {
          mesh,
          frame: data.frame,
          name: data.name,
          id: props.joint === "wholebody" ? data.id : data.name,
        };
      });
    let dirty = true,
      frame = 0;
    const legFrames = [
      "/bodyset/tibia_r",
      "/bodyset/talus_r",
      "/bodyset/calcn_r",
      "/bodyset/toes_r",
    ];
    const followsPose =
      props.joint === "shoulder" ||
      props.joint === "ankle" ||
      props.config.region === "arm" ||
      props.config.region === "neck" ||
      props.config.region === "spine" ||
      props.config.region === "wholebody";
    const armFrames = [
      "/bodyset/radius",
      "/bodyset/ulna",
      "/bodyset/proximal_row",
      "/bodyset/hand",
    ];
    if (props.joint === "elbow") armFrames.push("/bodyset/humerus");
    const visibleBounds = () => {
      const box = new THREE.Box3();
      for (const item of meshes)
        if (
          props.config.region === "spine"
            ? /\/bodyset\/(pelvis|sacrum|lumbar[1-5]|thoracic[0-9]+)$/.test(
                item.frame,
              )
            : props.config.region === "neck"
              ? /\/bodyset\/(cerv[1-7]|skull|jaw|rclavicle|lclavicle)$/.test(
                  item.frame,
                )
              : props.config.region === "arm"
                ? armFrames.includes(item.frame)
                : props.joint !== "ankle" || legFrames.includes(item.frame)
        )
          box.expandByObject(item.mesh);
      if (props.config.region === "neck") {
        // SCM reaches the sternum below the C7/skull bounds. Include both
        // endpoints so the reference panel cannot crop away that attachment.
        for (const muscle of latest.current.pose.muscles.filter(
          (m) => m.id === "stern_mast" || m.id === "stern_mast_L",
        ))
          for (const p of muscle.path)
            box.expandByPoint(
              new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(
                root.matrixWorld,
              ),
            );
      }
      return box;
    };
    let jointFocused = false;
    let pathFocused = false;
    let scapulaFocused = false;
    let previousAnchor: THREE.Vector3 | null = null;
    const selectedPathBounds = () => {
      const { pose, reference, selected } = latest.current;
      const muscle = pose.muscles.find((m) => m.id === selected);
      if (
        !muscle?.available ||
        muscle.path.length < 2 ||
        !reference.muscles.find((m) => m.id === selected)?.available
      )
        return null;
      return new THREE.Box3().setFromPoints(
        muscle.path.map((p) =>
          new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(root.matrixWorld),
        ),
      );
    };
    const scapulaCenter = () => {
      const scapula = meshes.find((item) => item.name === "scapula.vtp");
      return scapula
        ? new THREE.Box3()
            .setFromObject(scapula.mesh)
            .getCenter(new THREE.Vector3())
        : null;
    };
    const spinalFrame = () => {
      const upper = (latest.current.spineLevel || "L3_L4").split("_")[0];
      return `/bodyset/${upper.startsWith("T") ? "thoracic" : "lumbar"}${upper.slice(1)}`;
    };
    const viewAnchor = () => {
      if (pathFocused)
        return (
          selectedPathBounds()?.getCenter(new THREE.Vector3()) ||
          controls.target.clone()
        );
      // The scapular body origin lies near the glenoid. Center the visible
      // blade for its close-up, including when the atlas narrows the canvas.
      if (props.joint === "shoulder" && jointFocused && scapulaFocused) {
        const center = scapulaCenter();
        if (center) return center;
      }
      const t =
        latest.current.pose.transforms[
          props.joint === "wholebody"
            ? latest.current.focusFrame || "/bodyset/pelvis"
            : props.joint === "spine"
              ? spinalFrame()
              : props.joint === "neck"
                ? "/bodyset/cerv3"
                : props.joint === "shoulder"
                  ? "/bodyset/humerus"
                  : props.joint === "wrist"
                    ? "/bodyset/proximal_row"
                    : props.joint === "elbow"
                      ? "/bodyset/ulna"
                      : "/bodyset/talus_r"
        ];
      return jointFocused && t
        ? new THREE.Vector3(t[0][3], t[1][3], t[2][3]).applyMatrix4(
            root.matrixWorld,
          )
        : visibleBounds().getCenter(new THREE.Vector3());
    };
    const disposablePaths = () => {
      for (const child of [...paths.children]) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        paths.remove(child);
      }
    };
    update.current = () => {
      const { pose, reference, selected, hideResults } = latest.current;
      meshes.forEach(({ mesh, frame, name, id }) => {
        mesh.material.color.set(
          display.current.bonesOnly && display.current.selectedBone === id
            ? "#75a698"
            : props.joint === "shoulder" &&
                !display.current.bonesOnly &&
                name === "scapula.vtp"
              ? "#75a698"
              : props.joint === "shoulder" &&
                  !display.current.bonesOnly &&
                  name === "clavicle.vtp"
                ? "#c5a16c"
                : "#ded8c5",
        );
        const context =
          ((props.joint === "shoulder" && name === "thorax.vtp") ||
            (props.joint === "spine" &&
              !/^(lumbar|thoracic|sacrum)/.test(name))) &&
          !(display.current.bonesOnly && display.current.selectedBone === id);
        const opacity =
          props.joint === "wholebody" || props.joint === "spine"
            ? display.current.bonesOnly
              ? 1
              : Math.min(latest.current.boneOpacity ?? 1, context ? 0.3 : 1)
            : context
              ? 0.3
              : 1;
        mesh.material.transparent = opacity < 1;
        mesh.material.opacity = opacity;
        mesh.material.depthWrite = opacity === 1;
        mesh.visible = opacity > 0;
        const t = pose.transforms[frame];
        if (t)
          mesh.matrix.set(
            ...([...t[0], ...t[1], ...t[2], 0, 0, 0, 1] as Parameters<
              THREE.Matrix4["set"]
            >),
          );
      });
      disposablePaths();
      renderedPathIds.clear();
      paths.visible = !display.current.bonesOnly;
      const referencePaths = new Map(reference.muscles.map((m) => [m.id, m]));
      for (const muscle of pose.muscles) {
        if (
          (props.joint === "wholebody" || props.joint === "spine") &&
          !muscle.available
        )
          continue;
        if (
          latest.current.visiblePaths &&
          !latest.current.visiblePaths.has(muscle.id)
        )
          continue;
        if (isolation.current && muscle.id !== selected) continue;
        const chosen = muscle.id === selected;
        const related = latest.current.familyPaths?.has(muscle.id);
        const base = referencePaths.get(muscle.id);
        if (
          (props.config.region === "arm" ||
            props.config.region === "neck" ||
            props.config.region === "spine" ||
            props.config.region === "wholebody") &&
          !base?.available
        )
          continue;
        const color =
          hideResults || !base?.available
            ? "#63765a"
            : pathColor(muscle.length - (base?.length ?? muscle.length));
        const points = muscle.path.map(
          (p) => new THREE.Vector3(p[0], p[1], p[2]),
        );
        if (points.length < 2) continue;
        // Piecewise straight native wrap samples: no smoothing across a wrapping surface.
        const curve = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 1; i < points.length; i++)
          if (points[i].distanceTo(points[i - 1]) > 1e-8)
            curve.add(new THREE.LineCurve3(points[i - 1], points[i]));
        if (!curve.curves.length) continue;
        let mesh: THREE.Mesh;
        if (props.joint === "wholebody" || props.joint === "spine") {
          // All native centerlines retain a small screen-space width at any zoom.
          // These widths show selection/context, not anatomical muscle diameters.
          mesh = new Line2(
            new LineGeometry().setPositions(muscle.path.flat()),
            new LineMaterial({
              color,
              linewidth: chosen ? 4 : related ? 1.5 : 1,
              worldUnits: false,
              depthTest: true,
              transparent: !chosen,
              opacity: chosen
                ? 1
                : related
                  ? 0.72
                  : props.joint === "spine"
                    ? 0.4
                    : 0.22,
              depthWrite: chosen,
            }),
          );
          mesh.renderOrder = chosen ? 2 : 1;
        } else {
          const geometry = new THREE.TubeGeometry(
            curve,
            Math.max(40, points.length * 2),
            chosen ? 0.0035 : 0.0017,
            5,
            false,
          );
          mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              color,
              roughness: 0.7,
              transparent: !chosen,
              opacity: chosen ? 1 : 0.63,
              depthWrite: chosen,
            }),
          );
        }
        mesh.userData.muscle = muscle.id;
        renderedPathIds.add(muscle.id);
        paths.add(mesh);
        if (
          chosen &&
          (props.joint === "wholebody" || props.joint === "spine") &&
          latest.current.showPathMarkers
        ) {
          const endpoints = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints([
              points[0],
              points[points.length - 1],
            ]),
            new THREE.PointsMaterial({
              color: "#294f41",
              size: 7,
              sizeAttenuation: false,
              map: markerTexture,
              transparent: true,
              alphaTest: 0.2,
              depthWrite: false,
            }),
          );
          endpoints.userData.endpoint = true;
          // The line remains the picking target; Points' world-space raycast
          // threshold would otherwise create a huge invisible touch target.
          endpoints.raycast = () => {};
          paths.add(endpoints);
        } else if (
          chosen &&
          props.joint !== "wholebody" &&
          props.joint !== "spine"
        )
          for (const p of [points[0], points[points.length - 1]]) {
            const dot = new THREE.Mesh(
              new THREE.SphereGeometry(0.006, 12, 8),
              new THREE.MeshStandardMaterial({ color: "#294f41" }),
            );
            dot.position.copy(p);
            dot.userData.muscle = muscle.id;
            paths.add(dot);
          }
      }
      root.updateMatrixWorld(true);
      if (followsPose) {
        const anchor = viewAnchor();
        if (previousAnchor) {
          const shift = anchor.clone().sub(previousAnchor);
          camera.position.add(shift);
          controls.target.add(shift);
          controls.update();
        }
        previousAnchor = anchor;
      }
      dirty = true;
    };
    update.current();
    // Follow the limb while retaining the user’s zoom and viewing angle.
    const box = visibleBounds();
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // A bent knee can put most of the lower leg along the viewing-depth axis.
    let fitWidth = followsPose ? Math.max(size.x, size.z) : size.x;
    let fitHeight = followsPose ? Math.max(size.y, size.z) : size.y;
    let distance = Math.max(fitHeight, fitWidth) * 1.9;
    orient.current = (view, fit = false) => {
      const keepFraming = props.joint === "wholebody" && !fit;
      const viewDistance = keepFraming ? controls.getDistance() : distance;
      if (followsPose && !keepFraming) {
        jointFocused = false;
        pathFocused = false;
        center.copy(viewAnchor());
        previousAnchor = center.clone();
      }
      const target = keepFraming ? controls.target.clone() : center;
      controls.target.copy(target);
      const offset = new THREE.Vector3(
        view === "side"
          ? viewDistance
          : view === "oblique"
            ? viewDistance * 0.72
            : 0,
        0.04,
        view === "side"
          ? 0.001
          : view === "back"
            ? -viewDistance
            : view === "oblique"
              ? viewDistance * 0.72
              : viewDistance,
      );
      if (keepFraming) offset.normalize().multiplyScalar(viewDistance);
      camera.position.copy(target).add(offset);
      controls.update();
      dirty = true;
    };
    frameWhole.current = () => {
      const bounds = visibleBounds();
      const extent = bounds.getSize(new THREE.Vector3());
      fitWidth = Math.max(extent.x, extent.z);
      fitHeight = Math.max(extent.y, extent.z);
      distance = Math.max(fitHeight, fitWidth / camera.aspect) * 1.85;
      orient.current?.("back", true);
    };
    orient.current(
      props.joint === "shoulder" ||
        props.joint === "spine" ||
        props.joint === "wholebody"
        ? "back"
        : props.joint === "knee" || props.config.region === "arm"
          ? "side"
          : props.config.region === "hip"
            ? "oblique"
            : "front",
      true,
    );
    focusJoint.current = (scapula = false) => {
      pathFocused = false;
      scapulaFocused = scapula;
      const name =
        props.joint === "wholebody"
          ? latest.current.focusFrame || "/bodyset/pelvis"
          : props.joint === "spine"
            ? spinalFrame()
            : props.joint === "neck"
              ? "/bodyset/cerv3"
              : props.joint === "shoulder"
                ? scapula
                  ? "/bodyset/scapula"
                  : "/bodyset/humerus"
                : props.joint === "wrist"
                  ? "/bodyset/proximal_row"
                  : props.joint === "elbow"
                    ? "/bodyset/ulna"
                    : props.joint === "hip"
                      ? "/bodyset/femur_r"
                      : followsPose
                        ? "/bodyset/talus_r"
                        : "/bodyset/tibia_r";
      const t = latest.current.pose.transforms[name];
      if (!t) return;
      const target = new THREE.Vector3(t[0][3], t[1][3], t[2][3]).applyMatrix4(
        root.matrixWorld,
      );
      if (props.joint === "shoulder" && scapula) {
        const center = scapulaCenter();
        if (center) target.copy(center);
      }
      const offset = camera.position.clone().sub(controls.target).normalize();
      if (followsPose) {
        jointFocused = true;
        previousAnchor = target.clone();
      }
      controls.target.copy(target);
      camera.position
        .copy(target)
        .addScaledVector(
          offset,
          props.joint === "spine"
            ? 0.35
            : props.joint === "neck"
              ? 0.55
              : props.joint === "wrist"
                ? 0.4
                : props.joint === "elbow"
                  ? 0.65
                  : props.joint === "ankle"
                    ? 0.65
                    : props.joint === "shoulder"
                      ? 0.8
                      : 1,
        );
      controls.update();
      dirty = true;
    };
    focusPath.current = () => {
      const bounds = selectedPathBounds();
      if (!bounds) return;
      const target = bounds.getCenter(new THREE.Vector3());
      const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const fit = THREE.MathUtils.clamp(
        (radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)) * 1.3,
        controls.minDistance,
        controls.maxDistance,
      );
      const offset = camera.position.clone().sub(controls.target).normalize();
      jointFocused = false;
      pathFocused = true;
      previousAnchor = target.clone();
      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(offset, fit);
      controls.update();
      setHover(null);
      dirty = true;
    };
    zoom.current = (factor) => {
      const offset = camera.position.clone().sub(controls.target);
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position.copy(controls.target).add(offset.setLength(nextDistance));
      controls.update();
      setHover(null);
      dirty = true;
    };
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      const previousDistance = distance;
      distance = Math.max(fitHeight, fitWidth / camera.aspect) * 1.85;
      if (
        (props.config.region === "neck" ||
          props.joint === "shoulder" ||
          props.joint === "spine" ||
          props.joint === "wholebody") &&
        previousDistance > 0
      ) {
        const offset = camera.position.clone().sub(controls.target);
        camera.position
          .copy(controls.target)
          .addScaledVector(offset, distance / previousDistance);
        controls.update();
      }
      dirty = true;
    };
    resize();
    orient.current(
      props.joint === "shoulder" ||
        props.joint === "spine" ||
        props.joint === "wholebody"
        ? "back"
        : props.joint === "knee" || props.config.region === "arm"
          ? "side"
          : props.config.region === "hip"
            ? "oblique"
            : "front",
      true,
    );
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener("change", () => {
      dirty = true;
    });
    const render = () => {
      frame = requestAnimationFrame(render);
      controls.update();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    render();
    let down = [0, 0];
    const onDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    function pick(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2((x / rect.width) * 2 - 1, (-y / rect.height) * 2 + 1),
        camera,
      );
      const bone = ray.intersectObjects(
        meshes
          .filter(
            ({ mesh }) =>
              display.current.bonesOnly || mesh.material.opacity === 1,
          )
          .map(({ mesh }) => mesh),
        false,
      )[0];
      if (display.current.bonesOnly) return { id: null, bone, x, y };
      const hit = ray
        .intersectObjects(paths.children, false)
        .find((h) => !bone || h.distance <= bone.distance + 0.008);
      if (hit) return { id: hit.object.userData.muscle as string, bone, x, y };
      // Thin lines remain pickable within a small screen-space target on mouse/touch.
      let best = e.pointerType === "touch" ? 16 : 8,
        id: string | null = null;
      for (const muscle of latest.current.pose.muscles) {
        if (!renderedPathIds.has(muscle.id)) continue;
        for (let i = 1; i < muscle.path.length; i++) {
          const a = new THREE.Vector3(
            ...(muscle.path[i - 1] as [number, number, number]),
          ).applyMatrix4(root.matrixWorld);
          const b = new THREE.Vector3(
            ...(muscle.path[i] as [number, number, number]),
          ).applyMatrix4(root.matrixWorld);
          const pa = a.clone().project(camera),
            pb = b.clone().project(camera);
          if (pa.z < -1 || pa.z > 1 || pb.z < -1 || pb.z > 1) continue;
          const ax = ((pa.x + 1) * rect.width) / 2,
            ay = ((1 - pa.y) * rect.height) / 2,
            bx = ((pb.x + 1) * rect.width) / 2,
            by = ((1 - pb.y) * rect.height) / 2;
          const dx = bx - ax,
            dy = by - ay,
            len = dx * dx + dy * dy;
          const t = len
            ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len))
            : 0;
          const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
          if (distance >= best) continue;
          const world = a.lerp(b, t);
          if (bone && camera.position.distanceTo(world) > bone.distance + 0.012)
            continue;
          best = distance;
          id = muscle.id;
        }
      }
      return { id, bone, x, y };
    }
    const onMove = (e: PointerEvent) => {
      if (e.buttons || latest.current.hideResults) {
        setHover(null);
        return;
      }
      const hit = pick(e);
      if (hit.id) {
        setHover({
          name:
            latest.current.config.muscles.find((m) => m.id === hit.id)?.name ||
            hit.id,
          x: Math.max(
            8,
            Math.min(hit.x + 14, renderer.domElement.clientWidth - 220),
          ),
          y: Math.min(hit.y + 12, renderer.domElement.clientHeight - 65),
        });
        renderer.domElement.style.cursor = "pointer";
      } else {
        setHover(null);
        renderer.domElement.style.cursor = "grab";
      }
    };
    const onLeave = () => setHover(null);
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const hit = pick(e);
      if (hit.id) latest.current.onSelect(hit.id);
      else if (hit.bone && display.current.bonesOnly)
        setSelectedBone(hit.bone.object.userData.bone);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposablePaths();
      meshes.forEach(({ mesh }) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      material.dispose();
      markerTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      update.current = null;
      orient.current = null;
      focusJoint.current = null;
      frameWhole.current = null;
      focusPath.current = null;
      zoom.current = null;
    };
  }, [props.config, props.joint]);
  useEffect(() => {
    update.current?.();
  }, [
    props.pose,
    props.reference,
    props.selected,
    props.hideResults,
    props.focusFrame,
    props.visiblePaths,
    props.familyPaths,
    props.boneOpacity,
    props.showPathMarkers,
    isolated,
    bonesOnly,
    selectedBone,
  ]);
  useEffect(() => {
    setHover(null);
  }, [
    props.pose,
    props.hideResults,
    props.joint,
    props.visiblePaths,
    bonesOnly,
  ]);
  return (
    <div className="bio-viewer" ref={shell}>
      <div className="bio-viewport">
        <div className="bio-viewer-top">
          <span>
            {props.joint === "wholebody"
              ? "WHOLE BODY · BOTH SIDES · OPENSIM"
              : props.joint === "spine"
                ? "THORACOLUMBAR SPINE · BOTH SIDES · OPENSIM"
                : props.joint === "neck"
                  ? "NECK · BOTH SIDES · OPENSIM"
                  : `RIGHT ${joints[props.joint].name.toUpperCase()} JOINT · OPENSIM`}
          </span>
          <button
            className="icon-button"
            aria-label={
              expanded ? "Exit movement fullscreen" : "Expand movement model"
            }
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : shell.current
                    ?.closest(".bio-interaction")
                    ?.requestFullscreen()
            }
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <div ref={mount} className="bio-canvas" />
        <div className="bio-bone-controls">
          <button
            className="small-button"
            aria-pressed={bonesOnly}
            onClick={() => {
              setBonesOnly(!bonesOnly);
              props.onBonesOnlyChange?.(!bonesOnly);
            }}
          >
            Bones only
          </button>
          <button
            className="small-button"
            onClick={() => focusJoint.current?.()}
          >
            Focus joint
          </button>
          {(props.joint === "spine" || props.joint === "wholebody") && (
            <button
              className="small-button"
              onClick={() => frameWhole.current?.()}
            >
              {props.joint === "wholebody" ? "Whole body" : "Whole spine"}
            </button>
          )}
          {props.joint === "wholebody" && (
            <button
              className="small-button"
              disabled={
                bonesOnly ||
                props.hideResults ||
                !props.pose.muscles.find((m) => m.id === props.selected)
                  ?.available ||
                !props.pose.muscles.find((m) => m.id === props.selected)?.path
                  .length ||
                !props.reference.muscles.find((m) => m.id === props.selected)
                  ?.available
              }
              onClick={() => focusPath.current?.()}
            >
              Focus selected path
            </button>
          )}
          {props.joint === "shoulder" && (
            <button
              className="small-button"
              onClick={() => focusJoint.current?.(true)}
            >
              Focus scapula
            </button>
          )}
          {props.joint === "shoulder" && (
            <button
              className="small-button"
              onClick={() => frameWhole.current?.()}
            >
              Whole shoulder
            </button>
          )}
          {bonesOnly && (
            <label>
              Identify a bone{" "}
              <select
                aria-label="Identify a bone"
                value={selectedBone}
                onChange={(e) => setSelectedBone(e.target.value)}
              >
                {props.config.meshes
                  .filter(
                    (m) =>
                      props.config.region !== "arm" ||
                      !["thorax.vtp", "clavicle.vtp", "scapula.vtp"].includes(
                        m.name,
                      ),
                  )
                  .map((m) => (
                    <option
                      key={m.id || m.name}
                      value={props.joint === "wholebody" ? m.id : m.name}
                    >
                      {props.joint === "wholebody"
                        ? m.label
                        : boneNames[m.name] || m.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        {props.joint === "wholebody" && (
          <div
            className="bio-zoom-controls"
            role="group"
            aria-label="Camera zoom"
          >
            <button
              className="small-button"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => zoom.current?.(0.8)}
            >
              <Plus size={18} />
            </button>
            <button
              className="small-button"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => zoom.current?.(1.25)}
            >
              <Minus size={18} />
            </button>
          </div>
        )}
        {hover && !props.hideResults && !bonesOnly && (
          <div
            className="bio-path-tooltip"
            role="tooltip"
            style={{ left: hover.x, top: hover.y }}
          >
            {hover.name}
            <small>Click to see muscle anatomy</small>
          </div>
        )}
        {failed && (
          <p className="bio-canvas-error" role="alert">
            3D is unavailable in this browser. The joint controls and calculated
            lengths are still available below.
          </p>
        )}
        <div className="bio-viewer-bottom">
          <div className="segmented">
            {["front", "back", "side"].map((v) => (
              <button key={v} onClick={() => orient.current?.(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button
            className="small-button"
            onClick={() =>
              props.joint === "wholebody"
                ? frameWhole.current?.()
                : orient.current?.(
                    props.joint === "shoulder" || props.joint === "spine"
                      ? "back"
                      : "front",
                  )
            }
            aria-label="Reset movement camera"
          >
            <RotateCcw size={14} />
          </button>
          {props.joint !== "wholebody" && (
            <button
              className={`small-button ${isolated ? "selected" : ""}`}
              aria-pressed={isolated}
              disabled={bonesOnly}
              onClick={() => setIsolated(!isolated)}
            >
              <Focus size={14} />{" "}
              {isolated && props.joint === "spine"
                ? "Show muscle context"
                : "Isolate path"}
            </button>
          )}
        </div>
      </div>
      {!bonesOnly && (
        <button
          className="bio-picked-path"
          disabled={props.hideResults}
          onClick={() => props.onSelect(props.selected)}
        >
          <span>SELECTED MUSCLE PATH</span>
          <strong>
            {props.config.muscles.find((m) => m.id === props.selected)?.name}
          </strong>
          <small>View muscle anatomy ↗</small>
        </button>
      )}
      <div className="bio-legend">
        {props.hideResults ? (
          <span>Comparison colors are hidden</span>
        ) : (
          <>
            <span>
              <i style={{ background: "#9d4c2d" }} /> Longer
            </span>
            <span>
              <i style={{ background: "#28687b" }} /> Shorter
            </span>
            <span>
              <i style={{ background: "#596847" }} /> Little change
            </span>
          </>
        )}
        <span>Click a line · drag to rotate · scroll or pinch to zoom</span>
      </div>
    </div>
  );
}
