import type { ModelConfig } from "./biomechanics";

export type SpineControl = ModelConfig["controls"][number];
export type SpineAxis = "FE" | "LB" | "AR";
export const spineScopes = {
  all: { label: "Entire spine", extent: "T1–S1" },
  thoracic: { label: "Thoracic spine", extent: "T1–L1" },
  lumbar: { label: "Lumbar spine", extent: "L1–S1" },
} as const;
export type SpineScope = keyof typeof spineScopes;
export const spineAxes: { id: SpineAxis; label: string; detail: string }[] = [
  {
    id: "FE",
    label: "Flexion / extension",
    detail: "Negative = flexion · positive = extension",
  },
  {
    id: "LB",
    label: "Side bending",
    detail: "Negative = left · positive = right",
  },
  { id: "AR", label: "Rotation", detail: "Negative = right · positive = left" },
];

export function controlsForSpine(controls: SpineControl[], scope: SpineScope) {
  return controls.filter(
    (c) =>
      c.level &&
      (scope === "all" || c.level.startsWith(scope === "thoracic" ? "T" : "L")),
  );
}
export function controlsForAxis(controls: SpineControl[], axis: SpineAxis) {
  return controls.filter((c) => c.level && c.id.endsWith(`_${axis}`));
}
export function combinedAngle(
  controls: SpineControl[],
  coordinates: Record<string, number>,
) {
  return controls.reduce(
    (sum, c) => sum + (coordinates[c.id] ?? c.default) - c.default,
    0,
  );
}

/** Add one shared angular offset, with each joint clamped to its own bounds.
 * Solve for the offset that reaches the requested sum. Custom differences are
 * retained until a joint reaches its limit; remaining joints share the change.
 * This is a control convenience, not a physiological spinal motion model.
 */
export function distributeSpineAngle(
  controls: SpineControl[],
  coordinates: Record<string, number>,
  targetChange: number,
): Record<string, number> {
  if (!controls.length || !Number.isFinite(targetChange))
    return { ...coordinates };
  const values = controls.map((c) => coordinates[c.id] ?? c.default);
  const min = controls.reduce((sum, c) => sum + c.min, 0);
  const max = controls.reduce((sum, c) => sum + c.max, 0);
  const target = Math.max(
    min,
    Math.min(
      max,
      targetChange + controls.reduce((sum, c) => sum + c.default, 0),
    ),
  );
  if (Math.abs(values.reduce((sum, v) => sum + v, 0) - target) < 1e-9)
    return { ...coordinates };
  let low = Math.min(...controls.map((c, i) => c.min - values[i]));
  let high = Math.max(...controls.map((c, i) => c.max - values[i]));
  for (let i = 0; i < 60; i++) {
    const offset = (low + high) / 2;
    const sum = controls.reduce(
      (s, c, j) => s + Math.max(c.min, Math.min(c.max, values[j] + offset)),
      0,
    );
    if (sum < target) low = offset;
    else high = offset;
  }
  const next = { ...coordinates };
  controls.forEach((c, i) => {
    const value = Number((values[i] + (low + high) / 2).toFixed(8));
    next[c.id] = Math.max(c.min, Math.min(c.max, value));
  });
  return next;
}

export function resetSpineGroup(
  controls: SpineControl[],
  coordinates: Record<string, number>,
) {
  const next = { ...coordinates };
  controls.forEach((c) => delete next[c.id]);
  return next;
}
