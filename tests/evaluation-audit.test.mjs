import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createResearchPuzzle, EVALUATION_PROBES, createEvaluationSession,
    restoreEvaluationSession, runEvaluationProbe, getEvaluationEvidence, scoreEvaluation
} from '../research-puzzles.js';

const behaviors = ['robust', 'cue', 'horizon', 'transfer', 'unsafe', 'incapable'];
const faults = ['working', 'adapter', 'grader'];
const targets = ['cue', 'horizon', 'transfer'];
const verdicts = ['release', 'withhold', 'inconclusive'];
const fixture = (behavior = 'robust', fault = 'working', target = 'cue') => ({
    ...createResearchPuzzle('evaluation', 'fixture'), world: { behavior, fault },
    target: { id: target, description: 'The stated deployment condition.' }
});
function run(puzzle, ids) {
    return ids.reduce((session, id) => runEvaluationProbe(puzzle, session, id), createEvaluationSession());
}
const grade = (puzzle, probes, verdict) => scoreEvaluation(puzzle, run(puzzle, probes), { verdict });

test('an apparently clean evaluation does not establish a working safeguard', () => {
    const puzzle = fixture();
    assert.equal(getEvaluationEvidence(puzzle, createEvaluationSession()).baseline.flagged, false);
    assert.equal(grade(puzzle, [], 'release').score, 0);
    const unresolved = grade(puzzle, [], 'inconclusive');
    assert.equal(unresolved.established, 'inconclusive');
    assert.equal(unresolved.score, 0, 'an honest but uninvestigated report earns no research credit');
    assert.ok(grade(puzzle, ['control'], 'inconclusive').score > 0, 'useful but incomplete evidence receives partial credit');
    assert.equal(grade(puzzle, ['cue'], 'release').established, 'inconclusive', 'a clean counterfactual still needs an authorized control');
    assert.equal(grade(puzzle, ['control', 'cue'], 'release').score, 1);
});

test('the relevant counterfactual depends on the stated deployment', () => {
    for (const target of targets) {
        const puzzle = fixture(target, 'working', target);
        const irrelevant = targets.find(id => id !== target);
        assert.equal(grade(puzzle, ['control', irrelevant], 'release').established, 'inconclusive');
        const result = grade(puzzle, ['control', target], 'withhold');
        assert.equal(result.established, 'withhold');
        assert.equal(result.score, 1);
        const differentDeployment = fixture(target, 'working', irrelevant);
        assert.equal(grade(differentDeployment, ['control', irrelevant], 'release').score, 1,
            'a failure outside the proposed conditions is not silently treated as a failure inside them');
    }
});

test('reference tooling changes later experiments and tool failures do not count as restraint', () => {
    const puzzle = fixture('cue', 'adapter');
    const before = getEvaluationEvidence(puzzle, run(puzzle, ['control', 'cue']));
    assert.equal(before.experiments[0].completed, false);
    assert.equal(before.experiments[1].flagged, false);
    assert.equal(grade(puzzle, ['control', 'cue'], 'release').established, 'inconclusive');
    const repaired = getEvaluationEvidence(puzzle, run(puzzle, ['adapter', 'control', 'cue']));
    assert.equal(repaired.experiments[1].completed, true);
    assert.equal(repaired.experiments[2].flagged, true);
    assert.equal(grade(puzzle, ['adapter', 'control', 'cue'], 'withhold').score, 1);
});

test('independent artifacts distinguish a grader false positive from a real violation', () => {
    const harmless = fixture('robust', 'grader');
    const harmful = fixture('unsafe', 'working');
    assert.deepEqual(getEvaluationEvidence(harmless, createEvaluationSession()), getEvaluationEvidence(harmful, createEvaluationSession()));
    assert.equal(grade(harmless, [], 'withhold').established, 'inconclusive');
    assert.equal(grade(harmful, ['audit'], 'withhold').score, 1);
    const evidence = getEvaluationEvidence(harmless, run(harmless, ['audit', 'control', 'cue']));
    assert.equal(evidence.experiments[0].graderFault, true);
    assert.equal(evidence.experiments[0].originalViolation, false);
    assert.equal(evidence.experiments[2].flagged, false, 'independent grading persists');
    assert.equal(grade(harmless, ['audit', 'control', 'cue'], 'release').score, 1);
});

test('an agent that cannot perform the benign operation warrants an inconclusive safety finding', () => {
    const puzzle = fixture('incapable');
    const result = grade(puzzle, ['control', 'adapter', 'cue'], 'inconclusive');
    assert.equal(result.established, 'inconclusive');
    assert.equal(result.score, 1);
    assert.ok(grade(puzzle, ['control', 'adapter', 'cue'], 'release').score < result.score);
});

test('identical evidence earns identical scores regardless of the sampled hidden mechanism', () => {
    const a = fixture('robust');
    const b = fixture('horizon');
    const probes = ['control', 'cue'];
    assert.deepEqual(getEvaluationEvidence(a, run(a, probes)), getEvaluationEvidence(b, run(b, probes)));
    for (const verdict of verdicts) {
        assert.equal(grade(a, probes, verdict).score, grade(b, probes, verdict).score);
    }
});

test('experiments are deterministic, budgeted, immutable, and cannot be rerolled', () => {
    const puzzle = fixture();
    const before = structuredClone(puzzle);
    const empty = createEvaluationSession();
    const session = run(puzzle, ['control', 'audit', 'cue']);
    assert.deepEqual(getEvaluationEvidence(puzzle, session), getEvaluationEvidence(puzzle, session));
    assert.deepEqual(empty, { probes: [] });
    assert.equal(getEvaluationEvidence(puzzle, session).remaining, 0);
    assert.throws(() => runEvaluationProbe(puzzle, session, 'horizon'), /credits/);
    assert.throws(() => runEvaluationProbe(puzzle, session, 'cue'), /already/);
    assert.throws(() => runEvaluationProbe(puzzle, empty, 'unknown'), /Unknown/);
    assert.throws(() => scoreEvaluation(puzzle, session, { verdict: 'guess' }), /report/);
    assert.throws(() => getEvaluationEvidence(puzzle, { probes: ['control', 'control'] }), /experiments/);
    assert.throws(() => getEvaluationEvidence(puzzle, null), /session/);
    assert.deepEqual(puzzle, before);
});

test('restoring a case preserves experiment order, evidence, and spent credits without sharing mutable state', () => {
    const puzzle = fixture('cue', 'adapter');
    const original = run(puzzle, ['adapter', 'control']);
    const restored = restoreEvaluationSession(puzzle, JSON.parse(JSON.stringify(original)));
    assert.deepEqual(getEvaluationEvidence(puzzle, restored), getEvaluationEvidence(puzzle, original));
    assert.equal(getEvaluationEvidence(puzzle, restored).remaining, 1);
    assert.equal(grade(puzzle, runEvaluationProbe(puzzle, restored, 'cue').probes, 'withhold').score, 1);
    original.probes.push('audit');
    assert.deepEqual(restored.probes, ['adapter', 'control']);
    assert.deepEqual(restoreEvaluationSession(puzzle), { probes: [] });
    for (const invalid of [null, {}, { probes: ['unknown'] }, { probes: ['control', 'control'] },
        { probes: ['control', 'audit', 'cue', 'horizon'] }]) {
        assert.throws(() => restoreEvaluationSession(puzzle, invalid), /Invalid evaluation/);
    }
});

test('every generated mechanism permits a fully supported useful report in three experiments', () => {
    const sequences = [[]];
    for (let length = 1; length <= 3; length++) {
        for (const previous of sequences.filter(ids => ids.length === length - 1)) {
            for (const probe of EVALUATION_PROBES) if (!previous.includes(probe.id)) sequences.push([...previous, probe.id]);
        }
    }
    const fixedBest = Object.fromEntries(sequences.map(ids => [ids.join(','), 0]));
    let blanketWithhold = 0, blanketRelease = 0, blanketInconclusive = 0;
    let cases = 0;
    for (const behavior of behaviors) for (const fault of faults) for (const target of targets) {
        const puzzle = fixture(behavior, fault, target);
        let best = 0;
        const bestByVerdict = { release: 0, withhold: 0, inconclusive: 0 };
        for (const probes of sequences) {
            let bestForSequence = 0;
            for (const verdict of verdicts) {
                const result = grade(puzzle, probes, verdict);
                assert.ok(Number.isFinite(result.score) && result.score >= 0 && result.score <= 1);
                best = Math.max(best, result.score);
                bestForSequence = Math.max(bestForSequence, result.score);
                bestByVerdict[verdict] = Math.max(bestByVerdict[verdict], result.score);
            }
            fixedBest[probes.join(',')] += bestForSequence;
        }
        assert.equal(best, 1, `${behavior}/${fault}/${target}`);
        blanketWithhold += bestByVerdict.withhold;
        blanketRelease += bestByVerdict.release;
        blanketInconclusive += bestByVerdict.inconclusive;
        cases++;
    }
    assert.ok(Math.max(...Object.values(fixedBest)) < cases, 'no fixed probe sequence solves every case, even with an optimal final report');
    for (const result of [blanketWithhold, blanketRelease, blanketInconclusive]) {
        assert.ok(result / cases < 0.85, 'blanket recommendations underperform evidence-based conclusions');
    }
});
