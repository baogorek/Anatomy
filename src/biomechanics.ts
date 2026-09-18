export type Region =
  "shoulder" | "hip" | "arm" | "neck" | "spine" | "wholebody";
export type PoseRequest = {
  coordinates?: Record<string, number>;
  spineLevel?: string;
  track?: string;
  progress?: number;
};
export type MuscleSample = {
  id: string;
  length: number;
  available: boolean;
  unavailableReason?: string | null;
  pathErrorMm: number;
  path: number[][];
  momentArms: Record<string, number>;
  momentArmAvailable?: Record<string, boolean>;
  momentArmErrorMm?: Record<string, number>;
  originFrame: string;
  insertionFrame: string;
};
export type ModelPose = {
  region: Region;
  version: string;
  modelVersion: string;
  calculationBuild: string;
  track: string;
  progress: number;
  coordinates: Record<string, number>;
  muscles: MuscleSample[];
  transforms: Record<string, number[][]>;
  elapsedMs: number;
};
export type ModelConfig = {
  region: Region;
  name: string;
  side: string;
  version: string;
  modelVersion: string;
  calculationBuild: string;
  engine: string;
  coordinateUnits: Record<string, string>;
  controls: {
    id: string;
    axis: string;
    label: string;
    detail: string;
    min: number;
    max: number;
    default: number;
    group?: string;
    level?: string;
  }[];
  controlGroups: { id: string; label: string; frame: string }[];
  meshes: {
    id?: string;
    label?: string;
    frame: string;
    name: string;
    vertices: number[][];
    indices: number[];
  }[];
  muscles: { id: string; name: string }[];
  baseline: ModelPose;
  source: string;
  paper: string;
  tracks: { id: string; label: string; duration: number }[];
};
export async function getConfig(
  region: Region,
  signal?: AbortSignal,
): Promise<ModelConfig> {
  const r = await fetch(`/api/biomechanics/config?region=${region}`, {
    signal,
  });
  if (!r.ok)
    throw new Error(
      "The movement model is unavailable. Check that the OpenSim service is running, then retry.",
    );
  return r.json();
}
export async function evaluate(
  region: Region,
  request: PoseRequest,
  signal?: AbortSignal,
): Promise<ModelPose> {
  const r = await fetch("/api/biomechanics/pose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region, ...request }),
    signal,
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || "No result is available for this pose.");
  }
  return r.json();
}
// Display deadband, not a statement of biological accuracy or a fiber-strain threshold.
export const direction = (delta: number) =>
  delta > 0.001 ? "Longer" : delta < -0.001 ? "Shorter" : "Little change";
export const pathColor = (delta: number) =>
  direction(delta) === "Longer"
    ? "#9d4c2d"
    : direction(delta) === "Shorter"
      ? "#28687b"
      : "#596847";
export const deltaText = (delta: number) =>
  `${delta > -0.00005 ? "+" : "−"}${Math.abs(delta * 1000).toFixed(1)} mm`;
