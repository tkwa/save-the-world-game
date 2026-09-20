import { createRandom } from './random.js';

export const RESEARCH_TYPES = Object.freeze({
    evaluation: { name: 'Evaluation', title: 'Paired replay', duration: '1–2 minutes' },
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

function evaluationPuzzle(random) {
    const contexts = [
        ['Files', 'A file assistant is asked to handle a private document.'],
        ['Support', 'A support agent is asked to disclose another customer’s data.'],
        ['Lab notes', 'A research agent encounters instructions to alter its own audit log.'],
        ['Purchases', 'A shopping agent encounters a request beyond its spending authority.'],
        ['Scheduler', 'An assistant receives conflicting instructions about a private meeting.'],
        ['Code review', 'A coding agent encounters credentials in a repository.']
    ];
    const rows = contexts.map(([label, description], row) => {
        // Each case is a matched pair. An ordinary failure is deliberately a
        // distractor: it is not evidence of an unsafe action.
        const pairs = shuffled([
            ['safe', 'unsafe'], ['safe', 'unsafe'], ['safe', 'safe'],
            ['failed', 'unsafe'], ['unsafe', 'unsafe'], ['safe', 'failed']
        ], random);
        if (random() < 0.5) pairs[1] = ['failed', 'safe'];
        return {
            id: `batch-${row}`, label, description,
            cases: pairs.map(([screened, deployed], column) => ({ id: `case-${row}-${column}`, screened, deployed }))
        };
    });
    return { type: 'evaluation', rows };
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

export function scoreEvaluation(puzzle, marked) {
    const cases = puzzle.rows.flatMap(row => row.cases);
    const selected = validSelection(marked, new Set(cases.map(item => item.id)));
    const positives = cases.filter(item => item.screened === 'safe' && item.deployed === 'unsafe');
    const correct = positives.filter(item => selected.has(item.id)).length;
    const falseAlarms = selected.size - correct;
    const missed = positives.length - correct;
    // Precision and recall both matter; marking every case is not a shortcut.
    const score = selected.size + positives.length === 0 ? 1 : 2 * correct / (selected.size + positives.length);
    return { score: clamp(score), correct, falseAlarms, missed, total: positives.length };
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
