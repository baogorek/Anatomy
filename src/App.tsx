import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Activity, ArrowRight, BookOpen, ExternalLink, X } from "lucide-react";
import MovementLab from "./MovementLab";
import { sources } from "./data";

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <span>{title}</span>
        <button
          autoFocus
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false);
  const referenceButton = useRef<HTMLButtonElement>(null);
  function closeReference() {
    setReferenceOpen(false);
    requestAnimationFrame(() => referenceButton.current?.focus());
  }
  return (
    <div className="app">
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setReferenceOpen(false);
          }}
          aria-label="Kinetic home"
        >
          <span className="brand-mark">
            k<span />
          </span>
          <span>
            kinetic<span className="brand-subtitle">ANATOMY IN MOTION</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className="active"
            aria-current="page"
            onClick={() => setReferenceOpen(false)}
          >
            <Activity size={17} />
            Movement lab
          </button>
        </nav>
        <div className="header-right">
          <span className="trainer-badge">
            <span />
            THE CURIOUS COACH
          </span>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <div className="breadcrumb">
              YOUR ANATOMY STUDIO <span>/</span> MOVEMENT LAB
            </div>
            <h1>
              Change the position. <em>Trace the effect.</em>
            </h1>
            <p>
              Move the joints. Follow a muscle. Compare how its length changes
              between positions.
            </p>
          </div>
          <button
            ref={referenceButton}
            className="heading-action anatomy-reference-action"
            aria-expanded={referenceOpen}
            onClick={() => setReferenceOpen((v) => !v)}
          >
            <BookOpen size={18} />
            Anatomy reference
          </button>
        </section>
        <MovementLab
          referenceOpen={referenceOpen}
          onAtlas={() => setReferenceOpen(true)}
          onCloseAtlas={closeReference}
        />
        <footer>
          <span>
            <span className="footer-dot" /> Built for curious minds and
            thoughtful movement.
          </span>
          <div>
            <button onClick={() => setSourceOpen(true)}>
              Sources & model credits
            </button>
            <span>·</span>
            <button onClick={() => setHelpOpen(true)}>How to explore</button>
          </div>
        </footer>
      </main>
      {sourceOpen && (
        <Modal title="SOURCES & CREDITS" onClose={() => setSourceOpen(false)}>
          <div className="sources-content">
            <h2>Grounded in anatomy.</h2>
            <p>
              Muscle explanations and prompts are written for this studio.
              Exercise variations are illustrative coaching examples, not
              individualized rehabilitation plans.
            </p>
            <h3>Learning references</h3>
            {Object.values(sources).map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                {s.name}
                <ExternalLink size={14} />
              </a>
            ))}
            <h3>3D anatomy</h3>
            <p>
              Z-Anatomy by Gauthier Kervyn, derived from BodyParts3D, © The
              Database Center for Life Science. Browser model prepared by
              hpfrei. Descriptive metadata reduced; geometry unchanged. Colors
              and upper-body clipping applied in the viewer.
            </p>
            <a
              href="https://github.com/hpfrei/body-anatomy-3d-viewer"
              target="_blank"
              rel="noreferrer"
            >
              Model source <ExternalLink size={14} />
            </a>
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              Model licensed under CC BY-SA 4.0 <ExternalLink size={14} />
            </a>
            <a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">
              Full attribution & modifications <ExternalLink size={14} />
            </a>
            <h3>Movement models</h3>
            <p>
              Movement Lab uses native OpenSim calculations for the shoulder,
              elbow, wrist, hip, knee, ankle, neck, spine and whole body. Each
              workspace draws its source model’s bones and muscle paths. The
              anatomy reference is a separate resting atlas.
            </p>
            <a
              href="https://github.com/ComputationalBiomechanicsLab/rmr-solver"
              target="_blank"
              rel="noreferrer"
            >
              Shoulder model & study data · CC BY 4.0 <ExternalLink size={14} />
            </a>
            <a
              href="https://github.com/opencap-org/opencap-core"
              target="_blank"
              rel="noreferrer"
            >
              Lai–Uhlrich model source · OpenCap repository{" "}
              <ExternalLink size={14} />
            </a>
            <p>
              Exact package versions, model publications and assumptions are
              linked in the movement lab.
            </p>
            <p className="source-disclaimer">
              The model is a simplified anatomical reference. It is not a
              measurement of your anatomy or range of motion.
            </p>
          </div>
        </Modal>
      )}
      {helpOpen && (
        <Modal
          title="WELCOME TO YOUR ANATOMY STUDIO"
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-content">
            <h2>Follow your curiosity.</h2>
            <p>
              <strong>1. Move and compare.</strong> Choose Regional or Whole
              body, move the sliders and select a muscle path. Save a reference
              pose to compare positions.
            </p>
            <p>
              <strong>2. Follow a path.</strong> Focus the camera, isolate a
              muscle or adjust the layers. Find longest path searches the
              selected path within the model’s slider limits.
            </p>
            <p>
              <strong>3. Browse anatomy.</strong> Open Anatomy reference to
              search the broader resting atlas. Modeled entries link to movement
              paths; Anatomy only entries have no linked length calculation.
            </p>
            <p>
              Opening the reference preserves your current pose. Muscle–tendon
              path length is not tension, activation or a measure of a safe
              stretch.
            </p>
            <button
              className="primary-button"
              onClick={() => setHelpOpen(false)}
            >
              Start exploring <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default App;
