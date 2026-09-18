"""Bounded, deterministic search of native muscle–tendon geometry.

Returns the longest validated candidate found, not a global optimum or a stretch
prescription. Every candidate starts from a fresh native state. The service lock
is released between evaluations so ordinary pose requests remain responsive.
"""
import itertools
import math
import random
import time
from threading import Event, Lock, Thread
from uuid import uuid4

try:
    from .girdle import assemble as assemble_girdle
except ImportError:
    from girdle import assemble as assemble_girdle

SEARCH_VERSION = "native-longest-path-v1"
MAX_EVALUATIONS = 1600
MAX_SECONDS = 20


class Cancelled(Exception):
    pass


class BudgetReached(Exception):
    pass


def validate_request(engine, request):
    if request.get("version") != engine.calculation_version:
        raise ValueError("The model changed. Reload it before searching.")
    muscle = request.get("muscle")
    if muscle not in {engine.sample_id(m.getName()) for m in engine.muscles}:
        raise ValueError("Choose a modeled muscle path to search.")
    allowed = {c["id"]: c for c in engine.controls}
    supplied = request.get("coordinates")
    if not isinstance(supplied, dict) or set(supplied) - allowed.keys():
        raise ValueError("Unknown joint coordinates.")
    coordinates = {
        c["id"]: engine.baseline["coordinates"][c["id"]]
        for c in engine.controls
    }
    coordinates.update(supplied)
    for name, value in coordinates.items():
        c = allowed[name]
        if (isinstance(value, bool) or not isinstance(value, (int, float))
                or not math.isfinite(value) or not c["min"] <= value <= c["max"]):
            raise ValueError("The starting pose must be within the slider limits.")
    controls = request.get("controls", list(allowed))
    if (not isinstance(controls, list) or not controls
            or any(not isinstance(n, str) or n not in allowed for n in controls)
            or len(set(controls)) != len(controls)):
        raise ValueError("Choose at least one supported joint control to search.")
    return muscle, coordinates, [c for c in engine.controls if c["id"] in controls]


def native_sample(engine, muscle, coordinates):
    """Called only while holding the shared OpenSim lock."""
    values = dict(engine.default)
    values.update({n: math.radians(v * engine.scales[n]) for n, v in coordinates.items()})
    if engine.region == "shoulder":
        engine.state = assemble_girdle(engine.model, engine.coordinates, values)
    else:
        engine.state = engine.model.initializeState()
        for n, v in values.items():
            engine.coordinates[n].setValue(engine.state, v, False)
        engine.model.assemble(engine.state)
        engine.model.realizePosition(engine.state)
    errors = engine.state.getQErr()
    if any(abs(errors.get(i)) > 1e-7 for i in range(errors.size())):
        return None
    for n, v in coordinates.items():
        actual = math.degrees(engine.coordinates[n].getValue(engine.state)) / engine.scales[n]
        # MoBL's coupled wrist assembly has a documented ~0.00055-degree
        # residual; use the same 0.001-degree tolerance as its native audit.
        if abs(actual - v) > 1e-3:
            return None
    length = muscle.getLength(engine.state)
    path = engine.path(muscle)
    if (not math.isfinite(length) or length <= 0 or len(path) < 2
            or any(not math.isfinite(v) for p in path for v in p)
            or abs(sum(math.dist(a, b) for a, b in zip(path, path[1:])) - length) > .001):
        return None
    if engine.region == "arm" and muscle.getName() == "SUP" and coordinates["pro_sup"] > 1e-6:
        return None
    return length


def find_longest(engine, request, native_lock, cancelled, progress=lambda _: None,
                 max_evaluations=MAX_EVALUATIONS, max_seconds=MAX_SECONDS):
    mid, original, controls = validate_request(engine, request)
    muscle = next(m for m in engine.muscles if engine.sample_id(m.getName()) == mid)
    started = time.monotonic()
    evaluations = 0
    rejected = 0
    cache = {}
    candidates = []

    def check_cancel():
        if cancelled.is_set():
            raise Cancelled()

    def full_pose(coordinates):
        check_cancel()
        with native_lock:
            return engine.evaluate({"coordinates": coordinates})

    initial_pose = full_pose(original)
    initial = next(m for m in initial_pose["muscles"] if m["id"] == mid)
    if not initial["available"]:
        raise ValueError("This path is unavailable at the starting pose. Choose another pose or path.")
    baseline = initial["length"]

    def step(c):
        return .1 if engine.region == "spine" or c.get("level") else 1 if engine.region == "wholebody" else .5

    def snap(c, value):
        return round(max(c["min"], min(c["max"], c["min"] + round((value-c["min"])/step(c))*step(c))), 8)

    def distance(p):
        return sum(((p[c["id"]]-original[c["id"]])/(c["max"]-c["min"]))**2 for c in controls)

    def score(p):
        nonlocal evaluations, rejected
        check_cancel()
        key = tuple(p[c["id"]] for c in engine.controls)
        if key in cache:
            return cache[key]
        if evaluations >= max_evaluations or time.monotonic()-started >= max_seconds:
            raise BudgetReached()
        with native_lock:
            check_cancel()
            try:
                result = native_sample(engine, muscle, p)
            except (RuntimeError, ValueError):
                result = None
        evaluations += 1
        value = result if result is not None else -math.inf
        cache[key] = value
        if result is None:
            rejected += 1
        else:
            candidates.append((value, distance(p), dict(p)))
        if evaluations == 1 or evaluations % 20 == 0:
            progress(dict(evaluations=evaluations, bestLength=max([baseline] + [x[0] for x in candidates])))
        return value

    def improve(seed, spans):
        current = dict(seed)
        value = score(current)
        for span in spans:
            for _ in range(3):
                moved = False
                for c in controls:
                    n = c["id"]
                    choices = [c["min"], c["max"]] if span == 1 else [
                        snap(c, current[n] + sign * max(step(c), (c["max"]-c["min"])*span))
                        for sign in (-1, 1)
                    ]
                    for angle in choices:
                        p = {**current, n: angle}
                        found = score(p)
                        if found > value + 1e-9:
                            current, value, moved = p, found, True
                if not moved:
                    break
        return current

    budget_limited = False
    try:
        score(original)
        # Improve the user's pose first; irrelevant controls remain exactly fixed
        # unless changing them actually improves the objective.
        local = improve(original, [1, .25, .08, .02, .005])
        # Multiple starts reduce dependence on the initial configuration. Corners
        # are useful for geometric maxima, but interior samples also matter.
        if len(controls) <= 6:
            for corner in itertools.product((0, 1), repeat=len(controls)):
                score({**original, **{c["id"]: c["max"] if bit else c["min"] for c, bit in zip(controls, corner)}})
        rng = random.Random(20260918)
        for _ in range(48):
            score({**original, **{c["id"]: snap(c, rng.uniform(c["min"], c["max"])) for c in controls}})
        seeds = sorted(candidates, key=lambda x: (-x[0], x[1]))[:3]
        for _, _, seed in seeds:
            improve(seed, [.25, .08, .02, .005])
        # Reset changes that contribute no measurable gain (including controls
        # made irrelevant by a different joint configuration).
        best = max(candidates, key=lambda x: (x[0], -x[1]))[2] if candidates else local
        for c in controls:
            if best[c["id"]] != original[c["id"]]:
                restored = {**best, c["id"]: original[c["id"]]}
                if score(restored) >= score(best) - 1e-9:
                    best = restored
    except BudgetReached:
        budget_limited = True

    # Verify promising results through the normal app calculation plus local
    # discontinuity checks across EVERY searched control, including whole body.
    # Always retain the known starting pose as the no-improvement fallback.
    winner, winning_pose = dict(original), initial_pose
    longest = baseline
    ranked = sorted(candidates, key=lambda x: (-round(x[0], 9), x[1]))
    checked = set()
    for length, _, p in ranked:
        check_cancel()
        if length <= baseline + 1e-9 or len(checked) >= 8:
            break
        key = tuple(p[c["id"]] for c in controls)
        if key in checked:
            continue
        checked.add(key)
        try:
            pose = full_pose(p)
            sample = next(m for m in pose["muscles"] if m["id"] == mid)
            if not sample["available"] or abs(sample["length"]-length) > 1e-7:
                continue
            continuous = True
            for c in controls:
                ends = []
                for offset in (-.01, .01):
                    check_cancel()
                    probe = {**p, c["id"]: max(c["min"], min(c["max"], p[c["id"]]+offset))}
                    with native_lock:
                        ends.append(native_sample(engine, muscle, probe))
                if any(v is None for v in ends) or abs(ends[1]-ends[0]) > .002:
                    continuous = False
                    break
            if continuous and sample["length"] > longest + 1e-9:
                winner, winning_pose, longest = p, pose, sample["length"]
                break
        except (RuntimeError, ValueError):
            continue
    check_cancel()
    return dict(
        algorithm=SEARCH_VERSION, region=engine.region, version=engine.calculation_version,
        muscle=mid, coordinates=winner, startLength=baseline, length=longest,
        gain=longest-baseline, pose=winning_pose, evaluations=evaluations,
        rejected=rejected, elapsedMs=round((time.monotonic()-started)*1000),
        budgetLimited=budget_limited, controls=[c["id"] for c in controls],
        atLimits=[c["id"] for c in controls if min(abs(winner[c["id"]]-c["min"]), abs(winner[c["id"]]-c["max"])) < 1e-6],
    )


class SearchJobs:
    """One bounded search at a time; recent completed results are kept briefly."""
    def __init__(self, engines, native_lock):
        self.engines, self.native_lock = engines, native_lock
        self.lock = Lock()
        self.jobs = {}

    def start(self, request):
        engine = self.engines[request["region"]]
        validate_request(engine, request)
        with self.lock:
            now = time.monotonic()
            self.jobs = {k: v for k, v in self.jobs.items() if now-v["created"] < 600}
            if any(j["status"] == "running" for j in self.jobs.values()):
                raise RuntimeError("A path search is already running. Cancel it or wait for it to finish.")
            while len(self.jobs) >= 16:
                del self.jobs[next(iter(self.jobs))]
            jid = uuid4().hex
            job = dict(id=jid, status="running", evaluations=0, created=now, cancel=Event())
            self.jobs[jid] = job
        Thread(target=self.run, args=(engine, request, job), daemon=True).start()
        return dict(id=jid, status="running")

    def run(self, engine, request, job):
        def progress(value):
            with self.lock:
                job.update(value)
        try:
            result = find_longest(engine, request, self.native_lock, job["cancel"], progress)
            with self.lock:
                if job["cancel"].is_set():
                    job["status"] = "cancelled"
                else:
                    job.update(status="complete", result=result)
        except Cancelled:
            with self.lock:
                job["status"] = "cancelled"
        except Exception as error:
            print("Path search failed:", error, flush=True)
            with self.lock:
                job.update(status="error", error=str(error) if isinstance(error, ValueError) else "The model could not complete this search. Your pose is unchanged.")

    def get(self, jid, cancel=False):
        with self.lock:
            job = self.jobs.get(jid)
            if job is None:
                return None
            if cancel:
                job["cancel"].set()
            return {k: v for k, v in job.items() if k not in ("cancel", "created")}
