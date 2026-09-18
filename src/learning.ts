import { muscles, questions, type Muscle, type sources } from "./data";

export type ChallengeKind = "identify" | "locate" | "action" | "apply";
export type PracticeMode = "mix" | ChallengeKind;
export type Challenge = {
  id: string;
  kind: ChallengeKind;
  muscle: string;
  prompt: string;
  options: string[];
  answer: string;
  cue: string;
  explanation: string;
  source: keyof typeof sources;
};
export const locationCues: Record<string, string> = {
  deltoid:
    "Look for the broad cap over the outer shoulder. It wraps from the clavicle and scapula onto the upper arm.",
  supraspinatus:
    "Look on the back of the scapula, above its prominent horizontal spine. Remove the overlying trapezius to see it.",
  infraspinatus:
    "Look for a broad, triangular muscle below the spine on the back of the scapula. It is larger than the narrow teres minor beneath it.",
  "teres-minor":
    "Look along the outer border of the scapula, just below infraspinatus. You are looking for a narrow strip, not the broad muscle above it.",
  subscapularis:
    "Look on the front, rib-facing surface of the scapula. Isolating it after the answer will make that relationship easier to see.",
  pectoralis:
    "Look at the large fan of muscle on the front of the chest, converging toward the upper arm.",
  trapezius:
    "Look at the broad superficial muscle running from the neck and thoracic spine toward the shoulder blades.",
  serratus:
    "Look for the finger-like slips along the side of the rib cage, wrapping toward the scapula.",
  rhomboids:
    "Look between the spine and the inner border of the shoulder blade, underneath trapezius.",
  latissimus:
    "Look for the broad sheet on the lower back that narrows as it travels toward the upper arm.",
  biceps:
    "Look on the front of the upper arm. Its two heads converge toward the front of the elbow.",
  triceps:
    "Look on the back of the upper arm, where the three heads converge toward the point of the elbow.",
};
const actionChoices = [
  "Abduction",
  "Internal rotation",
  "External rotation",
  "Horizontal adduction",
  "Scapular retraction",
  "Scapular protraction",
  "Shoulder adduction",
  "Forearm supination",
  "Elbow extension",
  "Scapular upward rotation",
];
const primary: Record<string, string> = {
  deltoid: "Abduction",
  supraspinatus: "Abduction",
  infraspinatus: "External rotation",
  "teres-minor": "External rotation",
  subscapularis: "Internal rotation",
  pectoralis: "Horizontal adduction",
  trapezius: "Scapular upward rotation",
  serratus: "Scapular protraction",
  rhomboids: "Scapular retraction",
  latissimus: "Shoulder adduction",
  biceps: "Forearm supination",
  triceps: "Elbow extension",
};
const actionDistractors: Record<string, string[]> = {
  deltoid: ["Scapular retraction", "Elbow extension", "Forearm supination"],
  supraspinatus: [
    "Scapular protraction",
    "Elbow extension",
    "Forearm supination",
  ],
  infraspinatus: [
    "Internal rotation",
    "Elbow extension",
    "Scapular upward rotation",
  ],
  "teres-minor": [
    "Internal rotation",
    "Forearm supination",
    "Scapular protraction",
  ],
  subscapularis: ["External rotation", "Elbow extension", "Forearm supination"],
  pectoralis: ["External rotation", "Scapular retraction", "Elbow extension"],
  trapezius: ["Elbow extension", "Forearm supination", "Internal rotation"],
  serratus: ["Scapular retraction", "Elbow extension", "Forearm supination"],
  rhomboids: ["Scapular protraction", "Forearm supination", "Elbow extension"],
  latissimus: [
    "External rotation",
    "Forearm supination",
    "Scapular upward rotation",
  ],
  biceps: [
    "Elbow extension",
    "Scapular upward rotation",
    "Scapular protraction",
  ],
  triceps: ["Forearm supination", "Scapular retraction", "External rotation"],
};
function namesFor(m: Muscle) {
  const others = muscles.filter((x) => x.id !== m.id);
  others.sort(
    (a, b) => Number(b.group === m.group) - Number(a.group === m.group),
  );
  return [m.name, ...others.slice(0, 3).map((x) => x.name)];
}
export const challenges: Challenge[] = muscles.flatMap((m) => [
  {
    id: `identify-${m.id}`,
    kind: "identify" as const,
    muscle: m.id,
    prompt: "Which muscle is highlighted?",
    options: namesFor(m),
    answer: m.name,
    cue: locationCues[m.id],
    explanation: locationCues[m.id],
    source: m.source,
  },
  {
    id: `action-${m.id}`,
    kind: "action" as const,
    muscle: m.id,
    prompt: `Which action can the ${m.name.toLowerCase()} contribute to?`,
    options: [
      primary[m.id],
      ...(actionDistractors[m.id] ||
        actionChoices.filter((x) => x !== primary[m.id]).slice(0, 3)),
    ],
    answer: primary[m.id],
    cue: `Follow its attachment from ${m.origin.toLowerCase()} to ${m.insertion.toLowerCase()}. Which joint does that line of pull cross?`,
    explanation: `${m.name}: ${m.actions.join(", ").toLowerCase()}. ${m.insight}`,
    source: m.source,
  },
  {
    id: `locate-${m.id}`,
    kind: "locate" as const,
    muscle: m.id,
    prompt: `Find the ${m.name.toLowerCase()} on the model.`,
    options: namesFor(m),
    answer: m.name,
    cue: locationCues[m.id],
    explanation: locationCues[m.id],
    source: m.source,
  },
]);
challenges.push(
  ...questions.map((q) => ({
    id: `apply-${q.id}`,
    kind: "apply" as const,
    muscle: q.muscle,
    prompt: q.q,
    options: q.options,
    answer: q.options[q.answer],
    cue: `Use the model to think about ${muscles
      .find((m) => m.id === q.muscle)!
      .actions.join(" and ")
      .toLowerCase()}.`,
    explanation: q.explanation,
    source: (q.id === "stretch"
      ? "stretch"
      : "anatomy") as keyof typeof sources,
  })),
);
export const focusOptions = [
  { id: "all", label: "Whole upper body" },
  { id: "cuff", label: "Rotator cuff" },
  { id: "scapula", label: "Scapular control" },
  { id: "arm", label: "Upper arm" },
  ...muscles.map((m) => ({ id: m.id, label: m.name })),
];
export const modeOptions: { id: PracticeMode; label: string }[] = [
  { id: "mix", label: "Mix it up" },
  { id: "identify", label: "Name a structure" },
  { id: "locate", label: "Find on the model" },
  { id: "action", label: "Predict an action" },
  { id: "apply", label: "Reason through a movement" },
];
export type Memory = {
  seen: number;
  misses: number;
  streak: number;
  dueAt: number;
  dueTurn: number;
  lastAt: number;
};
export type Response = {
  cardId: string;
  answer: string;
  correct: boolean;
  assisted: boolean;
  revealed: boolean;
  at: number;
};
export type LearningState = {
  focus: string;
  mode: PracticeMode;
  activeId: string;
  turn: number;
  hinted: boolean;
  response: Response | null;
  memories: Record<string, Memory>;
  history: Response[];
};
export const learningKey = "kinetic-learning-v2";
export const initialLearning: LearningState = {
  focus: "all",
  mode: "mix",
  activeId: "identify-deltoid",
  turn: 0,
  hinted: false,
  response: null,
  memories: {},
  history: [],
};
const validCard = (id: unknown) =>
  typeof id === "string" && challenges.some((c) => c.id === id);
function validResponse(v: unknown): v is Response {
  if (!v || typeof v !== "object") return false;
  const r = v as Response;
  return (
    validCard(r.cardId) &&
    typeof r.answer === "string" &&
    typeof r.correct === "boolean" &&
    typeof r.assisted === "boolean" &&
    typeof r.revealed === "boolean" &&
    Number.isFinite(r.at)
  );
}
export function readLearning(): LearningState {
  try {
    const p = JSON.parse(localStorage.getItem(learningKey) || "null");
    if (!p || typeof p !== "object") return initialLearning;
    return {
      focus: focusOptions.some((f) => f.id === p.focus) ? p.focus : "all",
      mode: modeOptions.some((m) => m.id === p.mode) ? p.mode : "mix",
      activeId: validCard(p.activeId) ? p.activeId : initialLearning.activeId,
      turn: Number.isSafeInteger(p.turn) && p.turn >= 0 ? p.turn : 0,
      hinted: p.hinted === true,
      response:
        validResponse(p.response) && p.response.cardId === p.activeId
          ? p.response
          : null,
      memories:
        p.memories && typeof p.memories === "object"
          ? (Object.fromEntries(
              Object.entries(p.memories).filter(
                ([id, value]) =>
                  validCard(id) &&
                  !!value &&
                  typeof value === "object" &&
                  [
                    "seen",
                    "misses",
                    "streak",
                    "dueAt",
                    "dueTurn",
                    "lastAt",
                  ].every(
                    (k) =>
                      Number.isFinite((value as Record<string, unknown>)[k]) &&
                      Number((value as Record<string, unknown>)[k]) >= 0,
                  ),
              ),
            ) as Record<string, Memory>)
          : {},
      history: Array.isArray(p.history)
        ? p.history.filter(validResponse).slice(-60)
        : [],
    };
  } catch {
    return initialLearning;
  }
}
export function inFocus(c: Challenge, focus: string) {
  if (focus === "all") return true;
  const m = muscles.find((m) => m.id === c.muscle)!;
  if (focus === "cuff") return m.group === "Rotator cuff";
  if (focus === "scapula")
    return ["trapezius", "serratus", "rhomboids"].includes(m.id);
  if (focus === "arm") return m.group === "Upper arm";
  return c.muscle === focus;
}
export function matchingCards(state: LearningState) {
  return challenges.filter(
    (c) =>
      inFocus(c, state.focus) &&
      (state.mode === "mix" || c.kind === state.mode),
  );
}
export function remember(
  state: LearningState,
  answer: string,
  revealed = false,
  now = Date.now(),
): LearningState {
  if (state.response) return state;
  const card = challenges.find((c) => c.id === state.activeId)!;
  const correct = answer === card.answer && !revealed;
  const assisted = state.hinted || revealed;
  const old = state.memories[card.id] || {
    seen: 0,
    misses: 0,
    streak: 0,
    dueAt: 0,
    dueTurn: 0,
    lastAt: 0,
  };
  const strong = correct && !assisted;
  const streak = strong ? old.streak + 1 : 0;
  const delays = [
    6 * 3600_000,
    24 * 3600_000,
    3 * 24 * 3600_000,
    7 * 24 * 3600_000,
    14 * 24 * 3600_000,
  ];
  const response: Response = {
    cardId: card.id,
    answer,
    correct,
    assisted,
    revealed,
    at: now,
  };
  return {
    ...state,
    response,
    memories: {
      ...state.memories,
      [card.id]: {
        seen: old.seen + 1,
        misses: old.misses + (!strong ? 1 : 0),
        streak,
        dueAt: strong
          ? now + delays[Math.min(streak - 1, delays.length - 1)]
          : now,
        dueTurn: state.turn + 3,
        lastAt: now,
      },
    },
    history: [...state.history, response].slice(-60),
  };
}
export function nextChallenge(
  state: LearningState,
  now = Date.now(),
): LearningState {
  const turn = state.turn + 1;
  const cards = matchingCards(state);
  if (!cards.length) return state;
  const recent = new Set([
    state.activeId,
    ...state.history.slice(-2).map((r) => r.cardId),
  ]);
  const eligible = cards.filter(
    (c) => !state.memories[c.id] || state.memories[c.id].dueTurn <= turn,
  );
  const base = eligible.length ? eligible : cards;
  const available = base.filter((c) => !recent.has(c.id));
  const pool = available.length ? available : base;
  const due = pool
    .filter((c) => {
      const m = state.memories[c.id];
      return m && m.dueAt <= now && m.dueTurn <= turn;
    })
    .sort((a, b) => state.memories[a.id].dueAt - state.memories[b.id].dueAt);
  const unseen = pool.filter((c) => !state.memories[c.id]);
  const kindCycle: ChallengeKind[] = ["identify", "action", "locate", "apply"];
  const next =
    due[0] ||
    unseen.find((c) => c.kind === kindCycle[turn % kindCycle.length]) ||
    unseen[0] ||
    [...pool].sort(
      (a, b) =>
        (state.memories[a.id]?.dueAt || 0) - (state.memories[b.id]?.dueAt || 0),
    )[0];
  return { ...state, turn, activeId: next.id, hinted: false, response: null };
}
export function changeFocus(
  state: LearningState,
  focus: string,
  mode: PracticeMode,
): LearningState {
  const changed = { ...state, focus, mode };
  // Every muscle supports naming, locating, and actions. A focus with no
  // application scenario falls back to a mixed practice instead of a dead end.
  if (!matchingCards(changed).length) changed.mode = "mix";
  return nextChallenge(changed);
}
export function shuffledOptions(card: Challenge, turn: number) {
  const values = [...card.options];
  let seed = [...card.id].reduce(
    (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
    turn + 1,
  );
  for (let i = values.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
