import type { ModelConfig, ModelPose } from "./biomechanics";
export type DeltoidPart = {
  id: string;
  name: string;
  indices: number[];
  atlasVertices: number[][];
};
export type DeltoidFrame = {
  angle: number;
  pose: ModelPose;
};
export type DeltoidAsset = {
  schema: number;
  modelVersion: string;
  config: ModelConfig;
  parts: DeltoidPart[];
  atlasBones: { name: string; positions: number[]; indices: number[] }[];
  frames: DeltoidFrame[];
  license: string;
  scope: string;
};
export const deltoidRegions = [
  {
    id: "DeltoideusClavicle_A",
    name: "Anterior",
    position: "Front of the shoulder",
    origin: "Lateral third of the clavicle",
    color: "#bf8263",
  },
  {
    id: "DeltoideusScapula_M",
    name: "Middle",
    position: "Outer shoulder cap",
    origin: "Acromion of the scapula",
    color: "#c8936e",
  },
  {
    id: "DeltoideusScapula_P",
    name: "Posterior",
    position: "Back of the shoulder",
    origin: "Spine of the scapula",
    color: "#aa7057",
  },
];
