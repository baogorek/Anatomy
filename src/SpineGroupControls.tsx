import { useId } from "react";
import {
  combinedAngle,
  controlsForAxis,
  distributeSpineAngle,
  resetSpineGroup,
  spineAxes,
  type SpineControl,
} from "./spineControls";
import "./spine-controls.css";

export default function SpineGroupControls({
  controls,
  coordinates,
  label,
  onChange,
  showReset = true,
}: {
  controls: SpineControl[];
  coordinates: Record<string, number>;
  label: string;
  onChange: (coordinates: Record<string, number>) => void;
  showReset?: boolean;
}) {
  const id = useId();
  const jointCount = new Set(controls.map((c) => c.level)).size;
  return (
    <section
      className="bio-spine-group-controls"
      aria-label={`${label} grouped controls`}
    >
      <div className="bio-spine-group-heading">
        <span>Move {jointCount} joints together</span>
        {showReset && (
          <button
            className="small-button"
            onClick={() => onChange(resetSpineGroup(controls, coordinates))}
          >
            Reset {label.toLowerCase()}
          </button>
        )}
      </div>
      <p id={`${id}-help`} className="bio-spine-group-help">
        Angles are summed across the joints, relative to the starting pose—not
        the angle of the torso. Changes are shared evenly; joints at their
        limits stop while the others keep moving.
      </p>
      <div className="bio-spine-group-sliders">
        {spineAxes.map((axis) => {
          const group = controlsForAxis(controls, axis.id);
          const total = combinedAngle(group, coordinates);
          const min = group.reduce((sum, c) => sum + c.min - c.default, 0);
          const max = group.reduce((sum, c) => sum + c.max - c.default, 0);
          return (
            <div className="bio-slider" key={axis.id}>
              <label htmlFor={`${id}-${axis.id}`}>
                <span>{axis.label}</span>
                <output>
                  {Math.abs(total) < 0.05 ? "0.0" : total.toFixed(1)}° total
                </output>
              </label>
              <input
                id={`${id}-${axis.id}`}
                type="range"
                aria-label={`${label} ${axis.label}`}
                aria-describedby={`${id}-help ${id}-${axis.id}-direction`}
                aria-valuetext={`${total.toFixed(1)} degrees total across ${jointCount} joints`}
                min={min}
                max={max}
                step="0.1"
                value={Math.max(min, Math.min(max, total))}
                onChange={(e) =>
                  onChange(
                    distributeSpineAngle(
                      group,
                      coordinates,
                      Number(e.target.value),
                    ),
                  )
                }
              />
              <small id={`${id}-${axis.id}-direction`}>{axis.detail}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
