import learningSources from "./learningSources.json";

export const sources = learningSources;
export type Muscle = {
  id: string;
  name: string;
  latin: string;
  group: string;
  match: string;
  view: "front" | "back";
  deep?: boolean;
  description: string;
  origin: string;
  insertion: string;
  actions: string[];
  insight: string;
  exercise: { name: string; cue: string };
  mobility: { name: string; cue: string };
  source: keyof typeof sources;
};
export const muscles: Muscle[] = [
  {
    id: "deltoid",
    name: "Deltoid",
    latin: "Musculus deltoideus",
    group: "Shoulder",
    match: "deltoid muscle",
    view: "front",
    description:
      "The shoulder’s outer contour is formed by three regions of the deltoid. Their different lines of pull let the arm move forward, out to the side, and backward.",
    origin: "Lateral clavicle, acromion & spine of scapula",
    insertion: "Deltoid tuberosity of the humerus",
    actions: ["Abduction", "Flexion", "Extension"],
    insight:
      "Think in regions: anterior fibers help a front raise, middle fibers a lateral raise, and posterior fibers a reverse fly. One muscle can contribute to several different movements.",
    exercise: {
      name: "Scaption raise",
      cue: "Raise light weights slightly forward of your sides, with thumbs up. Stay in a comfortable range and let the shoulder blades move.",
    },
    mobility: {
      name: "Cross-body shoulder stretch",
      cue: "Bring one arm across your chest. Support above the elbow and gently draw the arm closer without twisting your torso.",
    },
    source: "deltoid",
  },
  {
    id: "supraspinatus",
    name: "Supraspinatus",
    latin: "Musculus supraspinatus",
    group: "Rotator cuff",
    match: "supraspinatus muscle",
    view: "back",
    deep: true,
    description:
      "A small muscle above the scapular spine. It assists arm elevation and helps keep the humeral head centered in the socket.",
    origin: "Supraspinous fossa of the scapula",
    insertion: "Superior facet of the greater tubercle",
    actions: ["Abduction", "Joint stabilization"],
    insight:
      "The supraspinatus and deltoid cooperate during elevation. Avoid imagining a sudden handoff from one muscle to the other.",
    exercise: {
      name: "Light scaption raise",
      cue: "Lift in a plane slightly forward of your side with the thumb facing up. Choose a range you can control without discomfort.",
    },
    mobility: {
      name: "Supported table slide",
      cue: "Rest the forearms on a table and move the torso backward to explore comfortable shoulder elevation. Do not push through a pinch.",
    },
    source: "cuff",
  },
  {
    id: "infraspinatus",
    name: "Infraspinatus",
    latin: "Musculus infraspinatus",
    group: "Rotator cuff",
    match: "infraspinatus muscle",
    view: "back",
    deep: true,
    description:
      "This broad muscle sits below the scapular spine and is a major external rotator of the shoulder.",
    origin: "Infraspinous fossa of the scapula",
    insertion: "Middle facet of the greater tubercle",
    actions: ["External rotation", "Joint stabilization"],
    insight:
      "External rotation happens at the shoulder. Keep the elbow near the ribs during a band drill so trunk rotation does not replace the intended movement.",
    exercise: {
      name: "Band external rotation",
      cue: "With the elbow bent and beside your ribs, rotate the forearm outward against a light band. Keep the torso facing forward.",
    },
    mobility: {
      name: "Gentle cross-body reach",
      cue: "Support the upper arm as you bring it across the chest. Use a comfortable amount of pull and keep the shoulder relaxed.",
    },
    source: "shoulder",
  },
  {
    id: "teres-minor",
    name: "Teres minor",
    latin: "Musculus teres minor",
    group: "Rotator cuff",
    match: "teres minor muscle",
    view: "back",
    deep: true,
    description:
      "A narrow rotator cuff muscle along the outer scapular border. It helps rotate the arm outward and stabilize the shoulder.",
    origin: "Lateral border of the scapula",
    insertion: "Inferior facet of the greater tubercle",
    actions: ["External rotation", "Joint stabilization"],
    insight:
      "Teres minor belongs to the rotator cuff; teres major does not. Similar names do not imply the same function.",
    exercise: {
      name: "Side-lying external rotation",
      cue: "Lie on the opposite side, keep the working elbow bent beside your ribs, and rotate a very light load upward with control.",
    },
    mobility: {
      name: "Cross-body shoulder stretch",
      cue: "Draw the supported arm across the chest gently. This targets the posterior shoulder region rather than isolating one cuff muscle.",
    },
    source: "cuff",
  },
  {
    id: "subscapularis",
    name: "Subscapularis",
    latin: "Musculus subscapularis",
    group: "Rotator cuff",
    match: "subscapularis muscle",
    view: "front",
    deep: true,
    description:
      "The cuff muscle on the rib-facing surface of the scapula. Its position gives it an inward rotational pull on the humerus.",
    origin: "Subscapular fossa, anterior scapula",
    insertion: "Lesser tubercle of the humerus",
    actions: ["Internal rotation", "Joint stabilization"],
    insight:
      "The subscapularis is hidden between the scapula and ribs. Use “Isolate” to understand where it sits without overlying structures.",
    exercise: {
      name: "Band internal rotation",
      cue: "Keep the elbow bent beside your ribs. Draw the forearm toward your abdomen against light resistance without turning your trunk.",
    },
    mobility: {
      name: "Gentle assisted external rotation",
      cue: "With the elbow at your side, guide the forearm outward only within a comfortable range. Do not force end range.",
    },
    source: "cuff",
  },
  {
    id: "pectoralis",
    name: "Pectoralis major",
    latin: "Musculus pectoralis major",
    group: "Chest & back",
    match: "pectoralis major muscle",
    view: "front",
    description:
      "A fan-shaped chest muscle with clavicular and sternocostal portions. It draws the upper arm toward the body and turns it inward.",
    origin: "Clavicle, sternum & upper costal cartilages",
    insertion: "Lateral lip of the intertubercular groove",
    actions: ["Horizontal adduction", "Internal rotation", "Adduction"],
    insight:
      "In a chest press, the upper arm moves across the body. The elbow also extends, so the triceps contributes to the same exercise.",
    exercise: {
      name: "Incline push-up",
      cue: "Place hands on a stable raised surface. Lower and press with the body moving as a unit; choose a height that permits control.",
    },
    mobility: {
      name: "Low doorway chest stretch",
      cue: "Place the forearm on a doorframe below shoulder height. Step through gently until you feel mild tension across the chest.",
    },
    source: "anatomy",
  },
  {
    id: "trapezius",
    name: "Trapezius",
    latin: "Musculus trapezius",
    group: "Chest & back",
    match: "trapezius muscle",
    view: "back",
    description:
      "An extensive upper-back muscle whose regions move and orient the scapula. Its upper and lower fibers contribute to upward rotation.",
    origin: "Occiput, nuchal ligament & C7–T12 spinous processes",
    insertion: "Lateral clavicle, acromion & scapular spine",
    actions: ["Upward rotation", "Retraction", "Elevation / depression"],
    insight:
      "During overhead reaching, the scapula needs to rotate. A permanent “shoulders down and back” cue can work against that motion.",
    exercise: {
      name: "Prone Y raise",
      cue: "Use no load at first. Reach the arms diagonally overhead while lifting slightly from the floor, without arching the lower back.",
    },
    mobility: {
      name: "Gentle neck side bend",
      cue: "Sit tall and tip one ear toward the same-side shoulder. Keep the opposite shoulder relaxed and avoid pulling on your head.",
    },
    source: "anatomy",
  },
  {
    id: "serratus",
    name: "Serratus anterior",
    latin: "Musculus serratus anterior",
    group: "Chest & back",
    match: "serratus anterior muscle",
    view: "front",
    description:
      "Wrapping from the ribs to the scapula, the serratus helps the shoulder blade travel around the chest wall.",
    origin: "Outer surfaces of upper eight or nine ribs",
    insertion: "Anterior surface of the medial scapular border",
    actions: ["Protraction", "Upward rotation"],
    insight:
      "A reaching action at the top of a push-up adds scapular protraction. Keep it distinct from rounding through the entire spine.",
    exercise: {
      name: "Wall push-up plus",
      cue: "Perform a wall push-up, then gently push the wall away a little farther by allowing the shoulder blades to glide around the ribs.",
    },
    mobility: {
      name: "Controlled wall slide",
      cue: "Slide the forearms upward on a wall while reaching lightly into it. Allow the scapulae to rotate and avoid flaring the ribs.",
    },
    source: "anatomy",
  },
  {
    id: "rhomboids",
    name: "Rhomboids",
    latin: "Musculi rhomboidei",
    group: "Chest & back",
    match: "rhomboid",
    view: "back",
    deep: true,
    description:
      "The major and minor rhomboids connect the spine to the medial edge of the scapula beneath the trapezius.",
    origin: "Lower nuchal ligament & C7–T5 spinous processes",
    insertion: "Medial border of the scapula",
    actions: ["Retraction", "Downward rotation"],
    insight:
      "Rows combine shoulder extension, elbow flexion, and scapular motion. Retraction describes the scapula’s motion toward the spine.",
    exercise: {
      name: "Supported band row",
      cue: "Draw the elbows back smoothly and let the shoulder blades move toward the spine. Return with a controlled reach.",
    },
    mobility: {
      name: "Seated upper-back reach",
      cue: "Reach both hands forward and let the shoulder blades separate gently. Breathe without collapsing through the lower back.",
    },
    source: "anatomy",
  },
  {
    id: "latissimus",
    name: "Latissimus dorsi",
    latin: "Musculus latissimus dorsi",
    group: "Chest & back",
    match: "latissimus dorsi muscle",
    view: "back",
    description:
      "A broad back muscle linking the trunk to the humerus. It brings an elevated arm down and backward.",
    origin:
      "Lower thoracic spine, thoracolumbar fascia, iliac crest & lower ribs",
    insertion: "Floor of the intertubercular groove",
    actions: ["Extension", "Adduction", "Internal rotation"],
    insight:
      "A pulldown and straight-arm pulldown both involve the shoulder, but the latter reduces the changing elbow angle.",
    exercise: {
      name: "Light straight-arm pulldown",
      cue: "From a comfortable overhead position, pull a band toward your thighs. Keep a soft elbow and avoid leaning backward.",
    },
    mobility: {
      name: "Bench-supported lat stretch",
      cue: "Place the hands on a bench and hinge the hips backward. Reach through the arms while keeping the lower ribs comfortable.",
    },
    source: "anatomy",
  },
  {
    id: "biceps",
    name: "Biceps brachii",
    latin: "Musculus biceps brachii",
    group: "Upper arm",
    match: "biceps brachii",
    view: "front",
    description:
      "A two-headed anterior arm muscle that crosses the shoulder and elbow. It bends the elbow and turns the palm upward.",
    origin: "Supraglenoid tubercle & coracoid process",
    insertion: "Radial tuberosity & bicipital aponeurosis",
    actions: ["Elbow flexion", "Supination"],
    insight:
      "Turning a palm upward is forearm supination, not shoulder external rotation. Watch where the rotation actually occurs.",
    exercise: {
      name: "Supinated curl",
      cue: "Curl a light load with palms facing forward, keeping the upper arms quiet. Lower slowly without swinging the trunk.",
    },
    mobility: {
      name: "Gentle arm extension",
      cue: "With a straight but unlocked elbow and palm forward, reach the arm slightly behind the torso. Avoid forcing the front of the shoulder.",
    },
    source: "anatomy",
  },
  {
    id: "triceps",
    name: "Triceps brachii",
    latin: "Musculus triceps brachii",
    group: "Upper arm",
    match: "triceps brachii",
    view: "back",
    description:
      "Three heads converge at the back of the elbow. All extend the elbow; the long head also crosses the shoulder.",
    origin: "Infraglenoid tubercle & posterior humerus",
    insertion: "Olecranon of the ulna",
    actions: ["Elbow extension", "Shoulder extension (long head)"],
    insight:
      "Changing shoulder position changes the length of the triceps long head. The other two heads do not cross the shoulder.",
    exercise: {
      name: "Band pressdown",
      cue: "Keep the upper arms beside the trunk and straighten the elbows against light resistance. Control the return.",
    },
    mobility: {
      name: "Overhead triceps reach",
      cue: "Bend one elbow overhead and reach the hand toward the upper back. Support the arm lightly, without forcing the shoulder.",
    },
    source: "anatomy",
  },
];
export const groups = ["Shoulder", "Rotator cuff", "Chest & back", "Upper arm"];
export const questions = [
  {
    id: "cuff",
    q: "Which muscle is NOT part of the rotator cuff?",
    options: ["Supraspinatus", "Teres major", "Infraspinatus", "Subscapularis"],
    answer: 1,
    explanation:
      "The cuff consists of supraspinatus, infraspinatus, teres minor, and subscapularis. Teres major is a separate muscle.",
    muscle: "teres-minor",
  },
  {
    id: "abduction",
    q: "Lifting your arm out to the side is called…",
    options: ["Adduction", "Internal rotation", "Abduction", "Extension"],
    answer: 2,
    explanation:
      "Abduction moves a limb away from the midline. The deltoid and supraspinatus help abduct the arm.",
    muscle: "deltoid",
  },
  {
    id: "external",
    q: "Which pair helps externally rotate the shoulder?",
    options: [
      "Infraspinatus and teres minor",
      "Pectoralis major and latissimus dorsi",
      "Biceps and triceps",
      "Subscapularis and pectoralis major",
    ],
    answer: 0,
    explanation:
      "Infraspinatus and teres minor are external rotators. Subscapularis is the rotator cuff’s internal rotator.",
    muscle: "infraspinatus",
  },
  {
    id: "scapula",
    q: "Which muscle helps the scapula move around the ribs during a reaching action?",
    options: [
      "Biceps brachii",
      "Rhomboid major",
      "Triceps brachii",
      "Serratus anterior",
    ],
    answer: 3,
    explanation:
      "Serratus anterior contributes to scapular protraction and upward rotation. Think of the reach at the top of a push-up plus.",
    muscle: "serratus",
  },
  {
    id: "stretch",
    q: "What is the best response to pain during a shoulder stretch?",
    options: [
      "Bounce gently to loosen the joint",
      "Hold longer until it eases",
      "Back off or stop the stretch",
      "Add resistance to stabilize it",
    ],
    answer: 2,
    explanation:
      "A stretch should create comfortable tension. Back off or stop if it hurts; persistent pain needs individual assessment.",
    muscle: "deltoid",
  },
  {
    id: "subscap",
    q: "Where would you find subscapularis?",
    options: [
      "On the rib-facing surface of the scapula",
      "Over the outer shoulder",
      "On the back of the humerus",
      "Above the clavicle",
    ],
    answer: 0,
    explanation:
      "Subscapularis lies in the subscapular fossa on the anterior, rib-facing surface of the scapula.",
    muscle: "subscapularis",
  },
  {
    id: "supination",
    q: "Turning your palm upward while keeping the upper arm still is…",
    options: [
      "Scapular retraction",
      "Shoulder abduction",
      "Forearm supination",
      "Shoulder extension",
    ],
    answer: 2,
    explanation:
      "Supination occurs in the forearm. Biceps brachii contributes to this action as well as elbow flexion.",
    muscle: "biceps",
  },
  {
    id: "overhead",
    q: "What should the scapula normally be allowed to do during an overhead reach?",
    options: [
      "Stay pinned down and back",
      "Rotate upward",
      "Remain completely still",
      "Only retract",
    ],
    answer: 1,
    explanation:
      "Upward rotation helps orient the shoulder socket as the arm elevates. Serratus anterior and trapezius cooperate in this motion.",
    muscle: "trapezius",
  },
  {
    id: "press",
    q: "A chest press combines shoulder horizontal adduction with…",
    options: [
      "Elbow flexion",
      "Forearm pronation only",
      "Scapular downward rotation only",
      "Elbow extension",
    ],
    answer: 3,
    explanation:
      "Pectoralis major contributes at the shoulder and triceps extends the elbow. Compound exercises involve multiple joint actions.",
    muscle: "pectoralis",
  },
  {
    id: "long-head",
    q: "Which triceps head crosses both the shoulder and the elbow?",
    options: ["Lateral head", "Medial head", "Long head", "All three heads"],
    answer: 2,
    explanation:
      "The long head originates on the scapula, so it crosses the shoulder as well as the elbow. The other heads originate on the humerus.",
    muscle: "triceps",
  },
];
