import { assetUrl } from "./urls";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Activity, ArrowRight, BookOpen, ExternalLink, X } from "lucide-react";
import MovementLab from "./MovementLab";

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
  const [helpOpen, setHelpOpen] = useState(false);
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
          href={assetUrl("")}
          aria-label="SplineFitness Movement Lab home"
          onClick={(event) => {
            event.preventDefault();
            setReferenceOpen(false);
          }}
        >
          <img
            className="brand-logo"
            src={assetUrl("/spline-mark.svg")}
            alt=""
            width="52"
            height="38"
          />
          <span>
            SplineFitness<span className="brand-subtitle">MOVEMENT LAB</span>
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
      </header>
      <main>
        <section className="page-heading">
          <div>
            <div className="breadcrumb">
              SPLINEFITNESS <span>/</span> MOVEMENT LAB
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
            <a
              href={assetUrl("/credits/index.html")}
              target="_blank"
              rel="noreferrer"
            >
              Sources & model credits <ExternalLink size={12} />
            </a>
            <span>·</span>
            <button onClick={() => setHelpOpen(true)}>How to explore</button>
          </div>
        </footer>
      </main>
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
