import { useState } from "react";
import {
  bodyLayers,
  type BodyMuscle,
  type PathAppearance,
  type PathMode,
  type PathSide,
} from "./wholeBodyDisplay";

export default function WholeBodyLayers({
  appearance,
  onChange,
  selected,
  count,
  bonesOnly,
}: {
  appearance: PathAppearance;
  onChange: (next: PathAppearance) => void;
  selected?: BodyMuscle;
  count: number;
  bonesOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  function mode(next: PathMode) {
    onChange({
      ...appearance,
      mode: next,
      side:
        next === "all"
          ? "both"
          : next === "muscle"
            ? "selected"
            : appearance.side,
      layers:
        next === "region" && !appearance.layers.length && selected?.layer
          ? [selected.layer]
          : appearance.layers,
    });
    if (next === "region") setExpanded(true);
  }
  return (
    <section className="wholebody-layers" aria-label="Muscle display layers">
      <div
        className="wholebody-display-modes"
        role="group"
        aria-label="Path display"
      >
        {(
          [
            ["muscle", "Selected muscle"],
            ["region", "Regional context"],
            ["all", "All paths"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={appearance.mode === id}
            onClick={() => mode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="wholebody-layer-summary">
        <span aria-live="polite">
          {count} {count === 1 ? "path" : "paths"} shown
          {appearance.mode === "muscle" && selected
            ? ` · ${selected.family}`
            : ""}
        </span>
        <button
          className="small-button"
          aria-expanded={expanded}
          aria-controls="wholebody-layer-settings"
          onClick={() => setExpanded(!expanded)}
        >
          Layer settings
        </button>
      </div>
      {expanded && (
        <div id="wholebody-layer-settings" className="wholebody-layer-settings">
          {appearance.mode === "region" && (
            <fieldset>
              <legend>Add muscle groups</legend>
              <div className="wholebody-layer-groups">
                {bodyLayers.map((layer) => (
                  <label key={layer.id}>
                    <input
                      type="checkbox"
                      checked={appearance.layers.includes(layer.id)}
                      onChange={(e) =>
                        onChange({
                          ...appearance,
                          layers: e.target.checked
                            ? [...appearance.layers, layer.id]
                            : appearance.layers.filter((id) => id !== layer.id),
                        })
                      }
                    />
                    {layer.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="wholebody-layer-appearance">
            <label>
              Side{" "}
              <select
                aria-label="Muscle layer side"
                value={appearance.side}
                onChange={(e) =>
                  onChange({ ...appearance, side: e.target.value as PathSide })
                }
              >
                <option value="selected">Selected side</option>
                <option value="both">Both sides</option>
                <option value="Right">Right</option>
                <option value="Left">Left</option>
              </select>
            </label>
            <label className="wholebody-bone-opacity">
              Bone opacity{" "}
              <output>{Math.round(appearance.boneOpacity * 100)}%</output>
              <input
                aria-label="Bone opacity"
                disabled={bonesOnly}
                type="range"
                min="0"
                max="100"
                step="5"
                value={appearance.boneOpacity * 100}
                onChange={(e) =>
                  onChange({
                    ...appearance,
                    boneOpacity: Number(e.target.value) / 100,
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={appearance.markers}
                onChange={(e) =>
                  onChange({ ...appearance, markers: e.target.checked })
                }
              />
              Show attachment markers
            </label>
          </div>
          <p>
            The highlighted path stays visible. Groups add context to the
            selected muscle. Bones only shows the skeleton at full opacity.
          </p>
        </div>
      )}
    </section>
  );
}
