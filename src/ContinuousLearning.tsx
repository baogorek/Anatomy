import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Focus,
  HelpCircle,
  Layers3,
  Lightbulb,
  MousePointer2,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import AnatomyViewer, { type Layer } from "./AnatomyViewer";
import { muscles, sources } from "./data";
import {
  challenges,
  changeFocus,
  focusOptions,
  learningKey,
  locationCues,
  modeOptions,
  nextChallenge,
  readLearning,
  remember,
  shuffledOptions,
  type PracticeMode,
} from "./learning";

type Props = {
  initialFocus: string | null;
  onExplore: (id: string) => void;
  onMovement: () => void;
};
export default function ContinuousLearning({
  initialFocus,
  onExplore,
  onMovement,
}: Props) {
  const [state, setState] = useState(() => {
    const saved = readLearning();
    return initialFocus ? changeFocus(saved, initialFocus, "mix") : saved;
  });
  const card = challenges.find((c) => c.id === state.activeId)!;
  const target = muscles.find((m) => m.id === card.muscle)!;
  const [draft, setDraft] = useState(""),
    [pickedId, setPickedId] = useState<string | null>(null),
    [compareId, setCompareId] = useState<string | null>(null),
    [written, setWritten] = useState(false),
    [storageOk, setStorageOk] = useState(true);
  const [layer, setLayer] = useState<Layer>(target.deep ? "deep" : "muscles");
  const heading = useRef<HTMLHeadingElement>(null);
  const answer = state.response;
  const viewed =
    muscles.find(
      (m) =>
        m.id ===
        (answer
          ? compareId || target.id
          : card.kind === "locate" && pickedId
            ? pickedId
            : target.id),
    ) || target;
  const visibleNames = !!answer;
  const options = shuffledOptions(card, state.turn);
  const memory = state.memories[card.id];
  const seenBefore = (memory?.seen || 0) - (answer ? 1 : 0);
  const reason =
    seenBefore > 0 && memory
      ? memory.streak === 0
        ? "Returning to something you needed help with."
        : "Seeing what comes back from memory."
      : "A new connection to explore.";
  useEffect(() => {
    try {
      localStorage.setItem(learningKey, JSON.stringify(state));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [state]);
  useEffect(() => {
    setDraft("");
    setPickedId(null);
    setCompareId(null);
    setLayer(target.deep ? "deep" : "muscles");
  }, [card.id, state.turn, target.deep]);
  function submit(value = draft, reveal = false) {
    if (answer) return;
    setState((s) => remember(s, value, reveal));
    setCompareId(null);
    setLayer(target.deep ? "deep" : "muscles");
  }
  function next() {
    setState((s) => nextChallenge(s));
    heading.current?.focus();
  }
  function pick(id: string | null, name: string) {
    if (answer) {
      if (id) {
        setCompareId(id);
        const m = muscles.find((m) => m.id === id)!;
        setLayer(m.deep ? "deep" : "muscles");
      }
      return;
    }
    if (card.kind === "locate" && !written) {
      setPickedId(id);
      setDraft(name);
    }
  }
  function focus(value: string, mode = state.mode) {
    setState((s) => changeFocus(s, value, mode));
  }
  const wrongMuscle = answer
    ? muscles.find((m) => m.name === answer.answer && m.id !== target.id)
    : null;
  return (
    <section
      className="continuous-learning"
      aria-label="Continuous anatomy learning"
    >
      <div className="practice-toolbar">
        <div className="practice-presence">
          <span />
          <strong>Learn in the model</strong>
          <small>Stay curious. Keep connecting.</small>
        </div>
        <div className="practice-filters">
          <label>
            Focus
            <select
              aria-label="Practice focus"
              value={state.focus}
              onChange={(e) => focus(e.target.value)}
            >
              {focusOptions.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prompt
            <select
              aria-label="Prompt type"
              value={state.mode}
              onChange={(e) =>
                focus(state.focus, e.target.value as PracticeMode)
              }
            >
              {modeOptions.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="practice-workspace">
        <div className="practice-model">
          <div className="mobile-model-prompt">
            {written && (card.kind === "locate" || card.kind === "identify")
              ? "Which muscle matches this location?"
              : card.prompt}
          </div>
          <div className="viewer-heading">
            <div>
              <Layers3 size={17} />
              <strong>
                {answer
                  ? "Explore the connection"
                  : card.kind === "locate" && !written
                    ? "Your answer is on the model"
                    : "Look, rotate, reason"}
              </strong>
            </div>
            <div className="layer-switch" aria-label="Anatomical layers">
              {(
                [
                  { id: "muscles", label: "Muscles" },
                  { id: "deep", label: "Deep" },
                  { id: "bones", label: "Bones" },
                ] as const
              ).map((l) => (
                <button
                  key={l.id}
                  aria-pressed={layer === l.id}
                  className={layer === l.id ? "active" : ""}
                  onClick={() => setLayer(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <AnatomyViewer
            onMovement={onMovement}
            onMotionHelp={() => {
              if (!state.response) {
                const next = { ...state, hinted: true };
                // Navigation unmounts this component before its persistence effect.
                try {
                  localStorage.setItem(learningKey, JSON.stringify(next));
                } catch {
                  setStorageOk(false);
                }
                setState(next);
              }
            }}
            selected={viewed}
            onSelect={(id) => pick(id, muscles.find((m) => m.id === id)!.name)}
            onPick={pick}
            layer={layer}
            setLayer={setLayer}
            maskNames={!visibleNames}
            highlight={!!answer || card.kind !== "locate" || !!pickedId}
            viewKey={`${card.id}:${answer ? `feedback-${viewed.id}` : "question"}`}
            onUnavailable={() => setWritten(true)}
          />
          {!answer && (
            <div className="model-learning-caption">
              <MousePointer2 size={15} />
              {card.kind === "locate" && !written
                ? "Click the muscle you think fits. You can change your selection before checking."
                : "Names are hidden so you can make the connection yourself."}
            </div>
          )}
        </div>
        <aside className="practice-conversation" aria-label="Learning prompt">
          <div className="prompt-kind">
            <span className="pill">
              {card.kind === "identify"
                ? "RECOGNIZE"
                : card.kind === "locate"
                  ? "LOCATE"
                  : card.kind === "action"
                    ? "PREDICT"
                    : "APPLY"}
            </span>
            <span>{target.group}</span>
          </div>
          <p className="practice-reason">{reason}</p>
          <h2 ref={heading} tabIndex={-1} aria-live="polite">
            {written && (card.kind === "locate" || card.kind === "identify")
              ? "Which muscle matches this location?"
              : card.prompt}
          </h2>
          {written && (card.kind === "locate" || card.kind === "identify") && (
            <p className="written-description">{locationCues[target.id]}</p>
          )}
          {!answer && (
            <>
              {card.kind === "locate" && !written ? (
                <div className="locate-instruction">
                  <Focus size={27} />
                  <p>
                    {draft
                      ? "A structure is selected. Check your answer or pick another."
                      : "Rotate the model and choose a muscle belly. Either side of the body counts."}
                  </p>
                  {draft && <span>Selection ready</span>}
                </div>
              ) : (
                <div
                  className="answer-options learning-options"
                  aria-label="Answer choices"
                >
                  {options.map((option, i) => (
                    <button
                      key={option}
                      aria-pressed={draft === option}
                      className={draft === option ? "chosen" : ""}
                      onClick={() => setDraft(option)}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {option}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="primary-button check-learning"
                disabled={!draft}
                onClick={() => submit()}
              >
                Check my thinking <ArrowRight size={16} />
              </button>
              <div className="learning-assistance">
                <button
                  onClick={() => setState((s) => ({ ...s, hinted: true }))}
                  disabled={state.hinted}
                >
                  <Lightbulb size={15} /> Give me a clue
                </button>
                <button onClick={() => submit("", true)}>
                  <BookOpen size={15} /> Show me
                </button>
              </div>
              {state.hinted && (
                <div className="learning-clue" role="status">
                  <Lightbulb size={16} />
                  <p>{card.cue}</p>
                </div>
              )}
              {(card.kind === "identify" || card.kind === "locate") && (
                <button
                  className="written-toggle"
                  aria-pressed={written}
                  onClick={() => {
                    setWritten((v) => !v);
                    setDraft("");
                    setPickedId(null);
                  }}
                >
                  {written ? <Focus size={13} /> : <BookOpen size={13} />}{" "}
                  {written
                    ? "Use the 3D model"
                    : "Use a written description instead"}
                </button>
              )}
              <button className="skip-prompt" onClick={next}>
                Try a different prompt <SkipForward size={13} />
              </button>
            </>
          )}
          {answer && (
            <div className="learning-response" role="status">
              <div
                className={`response-title ${answer.correct ? "correct" : ""}`}
              >
                {answer.correct ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <Lightbulb size={20} />
                )}
                <strong>
                  {answer.revealed
                    ? "Let’s look at it together."
                    : answer.correct
                      ? "That’s the connection."
                      : "Look at the difference."}
                </strong>
              </div>
              {!answer.correct && !answer.revealed && (
                <p className="your-answer">You chose: {answer.answer}</p>
              )}
              <h3>{card.answer}</h3>
              <p>{card.explanation}</p>
              <div className="response-model-actions">
                <button
                  className={
                    !compareId || compareId === target.id ? "active" : ""
                  }
                  onClick={() => {
                    setCompareId(target.id);
                    setLayer(target.deep ? "deep" : "muscles");
                  }}
                >
                  <Focus size={14} /> {target.name}
                </button>
                {wrongMuscle && (
                  <button
                    className={compareId === wrongMuscle.id ? "active" : ""}
                    onClick={() => {
                      setCompareId(wrongMuscle.id);
                      setLayer(wrongMuscle.deep ? "deep" : "muscles");
                    }}
                  >
                    Compare {wrongMuscle.name}
                  </button>
                )}
              </div>
              <p className="response-invite">
                Rotate or isolate the structure. You can also click a
                neighboring muscle to compare it.
              </p>
              <details className="attachment-disclosure">
                <summary>
                  Trace the attachments <ChevronDown size={14} />
                </summary>
                <dl>
                  <dt>Origin</dt>
                  <dd>{viewed.origin}</dd>
                  <dt>Insertion</dt>
                  <dd>{viewed.insertion}</dd>
                </dl>
              </details>
              <a
                className="source-link"
                href={sources[card.source].url}
                target="_blank"
                rel="noreferrer"
              >
                Check the anatomy reference <ExternalLink size={12} />
              </a>
              <div className="return-note">
                <RotateCcw size={14} />
                <span>
                  {answer.correct && !answer.assisted
                    ? "We’ll return to this over time, from different angles."
                    : "We’ll bring this connection back sooner."}
                </span>
              </div>
              <button className="primary-button next-learning" onClick={next}>
                Next prompt <ArrowRight size={16} />
              </button>
              <button
                className="open-reference"
                onClick={() => onExplore(viewed.id)}
              >
                Explore {viewed.name.toLowerCase()} freely{" "}
                <ArrowRight size={13} />
              </button>
            </div>
          )}
          {!storageOk && (
            <p className="practice-storage" role="status">
              Browser storage is unavailable. Your learning history will last
              for this visit.
            </p>
          )}
        </aside>
      </div>
      <div className="continuous-footnote">
        <HelpCircle size={15} />
        <p>
          Answers guide what comes next. Clues and revealed answers bring a
          concept back sooner. Change your focus, explore freely, or leave and
          return whenever you like.
        </p>
      </div>
    </section>
  );
}
