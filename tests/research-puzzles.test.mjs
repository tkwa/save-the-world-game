import test from 'node:test';
import assert from 'node:assert/strict';
import {
    RESEARCH_TYPES, createResearchPuzzle, scoreControl,
    inspectControl, optimalControlCut, scoreInterpretability
} from '../research-puzzles.js';

test('each lab is deterministic and distinct', () => {
    for (const type of Object.keys(RESEARCH_TYPES)) {
        const first = createResearchPuzzle(type, 'lab-seed');
        assert.deepEqual(createResearchPuzzle(type, 'lab-seed'), first);
        assert.notDeepEqual(createResearchPuzzle(type, 'other-seed'), first);
        assert.equal(first.type, type);
    }
    assert.throws(() => createResearchPuzzle('unknown', 0), /Unknown/);
    assert.throws(() => createResearchPuzzle('control', NaN), /seed/);
});

test('containment follows all paths, including a route that bypasses the gateway', () => {
    const puzzle = createResearchPuzzle('control', 42);
    const original = inspectControl(puzzle, []);
    assert.equal(original.exposed.length, 2);
    assert.equal(original.available.length, 2);
    const gatewayOutputs = puzzle.links.filter(link => link.from === 'gateway').map(link => link.id);
    const bypass = inspectControl(puzzle, gatewayOutputs);
    assert.equal(bypass.exposed.length, 1);
    assert.equal(bypass.available.length, 2);
    assert.ok(scoreControl(puzzle, gatewayOutputs).score < 0.5);
});

test('blocking every access link cannot masquerade as a useful containment solution', () => {
    const puzzle = createResearchPuzzle('control', 12);
    const result = scoreControl(puzzle, puzzle.links.map(link => link.id));
    assert.equal(result.safe, true);
    assert.equal(result.available.length, 0);
    assert.equal(result.score, 0.45);
});

test('every generated containment puzzle has a verified perfect solution', () => {
    for (let seed = 0; seed < 16; seed++) {
        const puzzle = createResearchPuzzle('control', seed);
        const optimum = optimalControlCut(puzzle);
        const result = scoreControl(puzzle, optimum.blocked);
        assert.equal(result.score, 1, `seed ${seed}`);
        assert.equal(result.safe, true);
        assert.equal(result.available.length, 2);
        assert.ok(Number.isFinite(puzzle.optimalCost));
        assert.ok(puzzle.optimalCost > 0);
    }
});

test('ablation measures causal interactions rather than labeling any single circuit bad', () => {
    const puzzle = createResearchPuzzle('interpretability', 58);
    const gate = puzzle.gates[0];
    const initial = scoreInterpretability(puzzle, []);
    assert.equal(initial.leakage, 100);
    assert.deepEqual(initial.performance, [100, 100, 100]);
    assert.equal(initial.score, 0);
    const left = scoreInterpretability(puzzle, [gate.members[0]]);
    const right = scoreInterpretability(puzzle, [gate.members[1]]);
    const both = scoreInterpretability(puzzle, gate.members);
    assert.equal(left.leakage, 45);
    assert.equal(right.leakage, 45);
    assert.equal(both.leakage, 45);
    assert.notDeepEqual(left.performance, right.performance);
    assert.ok(both.performance.every((value, i) => value < Math.max(left.performance[i], right.performance[i])));
});

test('every ablation puzzle permits a safe solution above the useful-task thresholds', () => {
    for (let seed = 0; seed < 30; seed++) {
        const puzzle = createResearchPuzzle('interpretability', seed);
        const inexpensive = puzzle.gates.map(gate => [...gate.members].sort((a, b) => {
            const cost = id => puzzle.modules.find(module => module.id === id).weights.reduce((sum, value) => sum + value, 0);
            return cost(a) - cost(b);
        })[0]);
        const result = scoreInterpretability(puzzle, inexpensive);
        assert.equal(result.score, 1);
        assert.equal(result.solved, true);
        assert.equal(result.leakage, 0);
        assert.ok(result.performance.every(value => value >= puzzle.minimumPerformance));
        const allOff = scoreInterpretability(puzzle, puzzle.modules.map(module => module.id));
        assert.equal(allOff.solved, false);
        assert.equal(allOff.score, 0.25);
    }
});

test('scorers reject nonexistent selections, deduplicate IDs, and never mutate puzzles', () => {
    for (const type of ['control', 'interpretability']) {
        const puzzle = createResearchPuzzle(type, 'immutability');
        const original = structuredClone(puzzle);
        const scorer = { control: scoreControl, interpretability: scoreInterpretability }[type];
        const id = type === 'control' ? puzzle.links[0].id : puzzle.modules[0].id;
        assert.deepEqual(scorer(puzzle, [id, id]), scorer(puzzle, new Set([id])));
        assert.throws(() => scorer(puzzle, ['nonexistent']), /Unknown/);
        assert.throws(() => scorer(puzzle, null), /Selections/);
        assert.deepEqual(puzzle, original);
    }
});

test('all possible circuit configurations produce finite bounded scores', () => {
    const puzzle = createResearchPuzzle('interpretability', 99);
    for (let mask = 0; mask < 256; mask++) {
        const selected = puzzle.modules.filter((_, i) => mask & (1 << i)).map(module => module.id);
        const result = scoreInterpretability(puzzle, selected);
        assert.ok(Number.isFinite(result.score) && result.score >= 0 && result.score <= 1);
        assert.ok(result.performance.every(value => value >= 0 && value <= 100));
    }
});
