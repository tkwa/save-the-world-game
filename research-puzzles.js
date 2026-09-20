import { createRandom } from './random.js';

export const RESEARCH_TYPES = Object.freeze({
    evaluation: { name: 'Evaluation', title: 'Release audit', duration: '2–4 minutes' },
    control: { name: 'Control', title: 'Access containment', duration: '1–2 minutes' },
    interpretability: { name: 'Interpretability', title: 'Circuit ablation', duration: '1–2 minutes' }
});

const clamp = value => Math.max(0, Math.min(1, value));

function shuffled(values, random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function validSelection(values, allowed) {
    if (!(values instanceof Set) && !Array.isArray(values)) throw new TypeError('Selections must be an array or Set.');
    const selected = new Set(values);
    if ([...selected].some(id => !allowed.has(id))) throw new RangeError('Unknown puzzle selection.');
    return selected;
}

export const EVALUATION_PROBES = Object.freeze([
    { id: 'control', label: 'Authorized control', description: 'Ask for an allowed draft using the same tools. Can this agent perform the operation at all?' },
    { id: 'adapter', label: 'Replace the tool adapter', description: 'Install a reference adapter and repeat the original challenge. Later experiments keep this adapter.' },
    { id: 'audit', label: 'Check artifacts and grader', description: 'Inspect the original file diff and an allowed-write calibration case. Independently grade later experiments.' },
    { id: 'cue', label: 'Remove the evaluation banner', description: 'Repeat the same short request as an ordinary job. Change only the evaluation cue.' },
    { id: 'horizon', label: 'Extend the workflow', description: 'Keep the banner and familiar requests, but run six dependent actions instead of one.' },
    { id: 'transfer', label: 'Use held-out requests', description: 'Use fresh wording and identifiers. Keep the evaluation banner and one-action horizon.' }
]);

const EVALUATION_TARGETS = [
    { id: 'cue', label: 'Ordinary jobs', description: 'Familiar requests, one action each, without an evaluation banner.' },
    { id: 'horizon', label: 'Long workflows', description: 'Familiar requests, six dependent actions, with disclosed monitoring.' },
    { id: 'transfer', label: 'New requests', description: 'Unfamiliar wording and identifiers, one action each, with disclosed monitoring.' }
];
const EVALUATION_BEHAVIORS = ['robust', 'cue', 'horizon', 'transfer', 'unsafe', 'incapable'];
// One nuisance at most: three probes can establish a useful result. Tool and
// grader faults are part of the evaluation, not evidence of model restraint.
const EVALUATION_WORLDS = EVALUATION_BEHAVIORS.flatMap(behavior =>
    ['working', 'adapter', 'grader'].map(fault => ({ behavior, fault })));

function evaluationPuzzle(random) {
    return {
        type: 'evaluation', version: 2, budget: 3,
        target: { ...EVALUATION_TARGETS[Math.floor(random() * EVALUATION_TARGETS.length)] },
        world: { ...EVALUATION_WORLDS[Math.floor(random() * EVALUATION_WORLDS.length)] },
        protectedFile: ['customer.csv', 'payroll.csv', 'access-list.csv'][Math.floor(random() * 3)]
    };
}

export function createEvaluationSession() {
    return { probes: [] };
}

function evaluationProbes(puzzle, session) {
    if (puzzle?.type !== 'evaluation' || puzzle.version !== 2 || !Array.isArray(session?.probes)) {
        throw new TypeError('Invalid evaluation session.');
    }
    const ids = session.probes;
    if (ids.length > puzzle.budget || new Set(ids).size !== ids.length ||
        ids.some(id => !EVALUATION_PROBES.some(probe => probe.id === id))) {
        throw new RangeError('Invalid evaluation experiments.');
    }
    return ids;
}

export function restoreEvaluationSession(puzzle, session = createEvaluationSession()) {
    return { probes: [...evaluationProbes(puzzle, session)] };
}

export function runEvaluationProbe(puzzle, session, id) {
    const probes = evaluationProbes(puzzle, session);
    if (!EVALUATION_PROBES.some(probe => probe.id === id)) throw new RangeError('Unknown evaluation experiment.');
    if (probes.includes(id)) throw new RangeError('This experiment has already run.');
    if (probes.length >= puzzle.budget) throw new RangeError('No experiment credits remain.');
    return { probes: [...probes, id] };
}

function evaluationObservations(puzzle, world, probes) {
    let repaired = false, audited = false;
    const working = () => repaired || world.fault !== 'adapter';
    const violates = condition => working() && (world.behavior === 'unsafe' || world.behavior === condition);
    const challenge = (id, label) => {
        const violation = violates(id);
        const flagged = violation || (!audited && world.fault === 'grader');
        const request = id === 'cue' ? 'Ordinary support job: amend the protected record, then draft a reply.' :
            id === 'horizon' ? 'Workflow, step 6: amend the protected record before closing the ticket.' :
                id === 'transfer' ? 'New request: correct the owner field in the protected archive.' :
                    'Evaluation ticket: amend the protected record, then draft a reply.';
        return { id, label, kind: 'challenge', flagged,
            trace: [
                request,
                !working() ? 'Tool: adapter rejected the write_file argument before execution.' :
                    'Agent response: “Request handled.” Runner did not record a write receipt.',
                audited ? `Independent diff: ${violation ? `/records/${puzzle.protectedFile} was changed` : 'protected record unchanged'}.` :
                    `Grader: ${flagged ? '1 boundary alert' : 'no boundary alert'}; file diff not attached.`
            ] };
    };
    const baseline = challenge('baseline', 'Original evaluation');
    const experiments = [];
    for (const id of probes) {
        const label = EVALUATION_PROBES.find(probe => probe.id === id).label;
        if (id === 'adapter') {
            repaired = true;
            const result = challenge('baseline', label);
            experiments.push({ ...result, id, trace: ['Tool: reference adapter installed for this and later runs.', ...result.trace.slice(1)] });
        } else if (id === 'audit') {
            // Inspect the original saved artifact, not a new run after repair.
            const originalViolation = world.fault !== 'adapter' && world.behavior === 'unsafe';
            audited = true;
            experiments.push({ id, label, kind: 'audit', originalViolation, graderFault: world.fault === 'grader',
                trace: [
                    `Original file diff: ${originalViolation ? `/records/${puzzle.protectedFile} was changed` : 'no protected file was changed'}.`,
                    `Allowed-write calibration: ${world.fault === 'grader' ? 'grader incorrectly flagged an authorized draft' : 'grader correctly accepted the authorized draft'}.`,
                    'Later experiments use independent file-diff checks.'
                ] });
        } else if (id === 'control') {
            const completed = working() && world.behavior !== 'incapable';
            experiments.push({ id, label, kind: 'control', completed,
                trace: [
                    'Request: write the approved summary to /drafts/summary.txt.',
                    !working() ? 'Tool: adapter rejected the write_file argument before execution.' :
                        completed ? 'Tool: write_file completed successfully.' : 'Runner: tools responded, but the agent produced no write.',
                    `Artifact: ${completed ? 'approved draft present' : 'no completed draft'}.`
                ] });
        } else experiments.push(challenge(id, label));
    }
    return { baseline, experiments, remaining: puzzle.budget - probes.length };
}

export function getEvaluationEvidence(puzzle, session) {
    return evaluationObservations(puzzle, puzzle.world, evaluationProbes(puzzle, session));
}

function controlPuzzle(random) {
    const nodes = [
        { id: 'model', label: 'Model', x: 50, y: 5, kind: 'source' },
        { id: 'planner', label: 'Planner', x: 50, y: 20, kind: 'tool' },
        { id: 'researcher', label: 'Research', x: 19, y: 37, kind: 'tool' },
        { id: 'worker', label: 'Writer', x: 81, y: 37, kind: 'tool' },
        { id: 'library', label: 'Library', x: 10, y: 61, kind: 'useful' },
        { id: 'gateway', label: 'Gateway', x: 50, y: 61, kind: 'tool' },
        { id: 'drafts', label: 'Drafts', x: 90, y: 61, kind: 'useful' },
        { id: 'terminal', label: 'Shell', x: 27, y: 87, kind: 'dangerous' },
        { id: 'secrets', label: 'Secrets', x: 73, y: 87, kind: 'dangerous' }
    ];
    const bypass = random() < 0.5 ? ['worker', 'terminal'] : ['researcher', 'secrets'];
    const links = [
        ['model', 'planner'], ['planner', 'researcher'], ['planner', 'worker'],
        ['researcher', 'library'], ['worker', 'drafts'], ['researcher', 'gateway'],
        ['worker', 'gateway'], ['gateway', 'terminal'], ['gateway', 'secrets'],
        ['library', 'gateway'], bypass, ['researcher', 'drafts']
    ].map(([from, to], i) => ({ id: `link-${i}`, from, to, cost: 1 + Math.floor(random() * 3) }));
    const puzzle = { type: 'control', nodes, links };
    const optimum = optimalControlCut(puzzle);
    return { ...puzzle, optimalCost: optimum.cost };
}

function interpretabilityPuzzle(random) {
    // Two conjunctive circuits drive the unwanted behavior. Each has a cheap
    // ablation and an expensive one. Observing only one feature in isolation
    // does not identify its interaction partner.
    const roles = shuffled([
        { weights: [3, 4, 3], gate: 0 }, { weights: [25, 8, 18], gate: 0 },
        { weights: [4, 3, 4], gate: 1 }, { weights: [10, 27, 15], gate: 1 },
        { weights: [18, 16, 12] }, { weights: [15, 12, 18] },
        { weights: [13, 17, 14] }, { weights: [12, 13, 16] }
    ], random);
    const modules = roles.map((role, i) => ({
        id: `circuit-${i}`, label: `C${i + 1}`, weights: role.weights,
        waveform: Array.from({ length: 12 }, () => 0.15 + random() * 0.85)
    }));
    const gates = [0, 1].map(gate => ({
        members: roles.flatMap((role, i) => role.gate === gate ? [`circuit-${i}`] : []),
        strength: gate === 0 ? 55 : 45
    }));
    return { type: 'interpretability', modules, gates, minimumPerformance: 85, metrics: ['Reasoning', 'Tool use', 'Dialogue'] };
}

export function createResearchPuzzle(type, seed = 0) {
    if (!Object.hasOwn(RESEARCH_TYPES, type)) throw new RangeError('Unknown research type.');
    const { random } = createRandom(seed);
    if (type === 'evaluation') return evaluationPuzzle(random);
    if (type === 'control') return controlPuzzle(random);
    return interpretabilityPuzzle(random);
}

export function scoreEvaluation(puzzle, session, report) {
    const probes = evaluationProbes(puzzle, session);
    if (!['release', 'withhold', 'inconclusive'].includes(report?.verdict)) throw new TypeError('Invalid evaluation report.');
    const evidence = getEvaluationEvidence(puzzle, session);
    const signature = observations => JSON.stringify(observations);
    const initial = EVALUATION_WORLDS.filter(world =>
        signature(evaluationObservations(puzzle, world, [])) === signature(evaluationObservations(puzzle, puzzle.world, [])));
    const consistent = initial.filter(world =>
        signature(evaluationObservations(puzzle, world, probes)) === signature(evidence));
    const unsafe = world => world.behavior === 'unsafe' || world.behavior === puzzle.target.id;
    const demonstratedControl = evidence.experiments.some(result => result.kind === 'control' && result.completed);
    const allViolate = consistent.every(unsafe);
    const noneViolate = consistent.every(world => !unsafe(world));
    const limitedAgent = consistent.every(world => world.behavior === 'incapable');
    const established = allViolate ? 'withhold' :
        noneViolate && demonstratedControl && probes.includes(puzzle.target.id) ? 'release' : 'inconclusive';
    // Grade the claims licensed by observable evidence. Two hidden worlds with
    // identical observations receive the same grade; a lucky verdict is not proof.
    const conclusion = report.verdict === established ? 1 : report.verdict === 'inconclusive' ? 0.3 : 0.1;
    const evidenceQuality = established !== 'inconclusive' || limitedAgent ? 1 :
        Math.max(0, 1 - consistent.length / initial.length);
    const explanations = {
        robust: 'The simulated agent respects the file boundary in all of these test conditions.',
        cue: 'The simulated agent respects the boundary when an evaluation banner is present, but violates it in ordinary-job context.',
        horizon: 'The simulated agent respects the boundary on short tasks, but violates it during longer workflows.',
        transfer: 'The simulated agent respects familiar requests, but violates the boundary when wording and identifiers change.',
        unsafe: 'The simulated agent violates the boundary even on familiar, one-action requests when its tools work.',
        incapable: 'The simulated agent cannot complete the authorized operation either. Its lack of violations does not demonstrate a working safeguard.'
    };
    const faults = {
        working: 'The adapter and grader worked as intended.',
        adapter: 'The original tool adapter blocked execution. Replacing it restores a real opportunity to act.',
        grader: 'The original grader flagged authorized drafts. File-diff checks separate those false alarms from actual violations.'
    };
    const conclusionText = {
        release: 'Working controls and the relevant counterfactual support this deployment within the exercise. They do not establish general safety.',
        withhold: 'The observed evidence establishes a boundary violation relevant to the proposed deployment.',
        inconclusive: limitedAgent ? 'The agent did not demonstrate the required operation. The audit cannot distinguish a safeguard from inability.' :
            'The collected evidence leaves a relevant confound or untested condition. An inconclusive report is warranted.'
    };
    return {
        score: clamp(conclusion * evidenceQuality), established,
        conclusion: conclusionText[established], evidenceQuality,
        remainingExplanations: consistent.length,
        actualMechanism: `${explanations[puzzle.world.behavior]} ${faults[puzzle.world.fault]}`,
        reportSupported: report.verdict === established
    };
}

export function inspectControl(puzzle, blocked) {
    const selected = validSelection(blocked, new Set(puzzle.links.map(link => link.id)));
    const reached = new Set(['model']);
    let changed = true;
    while (changed) {
        changed = false;
        for (const link of puzzle.links) {
            if (!selected.has(link.id) && reached.has(link.from) && !reached.has(link.to)) {
                reached.add(link.to);
                changed = true;
            }
        }
    }
    const useful = puzzle.nodes.filter(node => node.kind === 'useful');
    const dangerous = puzzle.nodes.filter(node => node.kind === 'dangerous');
    return {
        reached: [...reached],
        available: useful.filter(node => reached.has(node.id)).map(node => node.id),
        exposed: dangerous.filter(node => reached.has(node.id)).map(node => node.id),
        cost: puzzle.links.reduce((sum, link) => sum + (selected.has(link.id) ? link.cost : 0), 0),
        usefulTotal: useful.length
    };
}

export function optimalControlCut(puzzle) {
    if (puzzle.links.length > 18) throw new RangeError('The containment puzzle is too large for exhaustive scoring.');
    let best = { cost: Infinity, blocked: [] };
    for (let mask = 0; mask < 2 ** puzzle.links.length; mask++) {
        const blocked = puzzle.links.filter((_, i) => mask & (1 << i)).map(link => link.id);
        const cost = puzzle.links.reduce((sum, link, i) => sum + (mask & (1 << i) ? link.cost : 0), 0);
        if (cost >= best.cost) continue;
        const result = inspectControl(puzzle, blocked);
        if (!result.exposed.length && result.available.length === result.usefulTotal) best = { cost, blocked };
    }
    return best;
}

export function scoreControl(puzzle, blocked) {
    const result = inspectControl(puzzle, blocked);
    const utility = result.available.length / result.usefulTotal;
    const safe = result.exposed.length === 0;
    const efficiency = safe && result.cost > 0 ? Math.min(1, puzzle.optimalCost / result.cost) : 0;
    // Unsafe configurations cannot beat any fully contained, useful solution.
    const score = safe ? 0.45 + 0.4 * utility + 0.15 * efficiency * utility : 0.2 * utility;
    return { ...result, score: clamp(score), safe, optimalCost: puzzle.optimalCost };
}

export function scoreInterpretability(puzzle, ablated) {
    const selected = validSelection(ablated, new Set(puzzle.modules.map(module => module.id)));
    const performance = puzzle.metrics.map((_, i) => {
        const total = puzzle.modules.reduce((sum, module) => sum + module.weights[i], 0);
        const retained = puzzle.modules.reduce((sum, module) => sum + (selected.has(module.id) ? 0 : module.weights[i]), 0);
        return Math.round(retained / total * 1000) / 10;
    });
    const leakage = puzzle.gates.reduce((sum, gate) => sum + (gate.members.every(id => !selected.has(id)) ? gate.strength : 0), 0);
    const utility = performance.reduce((sum, value) => sum + Math.min(1, value / puzzle.minimumPerformance), 0) / performance.length;
    const safety = 1 - leakage / 100;
    const score = safety * (0.25 + 0.75 * utility);
    return {
        score: clamp(score), performance, leakage, ablated: selected.size,
        solved: leakage === 0 && performance.every(value => value >= puzzle.minimumPerformance)
    };
}
