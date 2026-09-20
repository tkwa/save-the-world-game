import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCampaign, startResearchTrial, recordEvaluationProgress,
    completeResearchTrial, cancelResearchTrial, serializeCampaign, restoreCampaign
} from '../campaign.js';
import {
    createResearchPuzzle, createEvaluationSession, runEvaluationProbe, getEvaluationEvidence
} from '../research-puzzles.js';

test('saved evaluation experiments reproduce the same ordered evidence and remaining budget', () => {
    let state = createCampaign({ seed: 'evaluation-evidence-resume' });
    const { trial } = startResearchTrial(state, 'evaluation');
    const puzzle = createResearchPuzzle('evaluation', trial.seed);
    const rng = structuredClone(state.rng);
    let session = createEvaluationSession();
    for (const probe of ['adapter', 'audit', 'control']) {
        session = runEvaluationProbe(puzzle, session, probe);
        assert.equal(recordEvaluationProgress(state, trial.id, session).ok, true);
        const saved = serializeCampaign(state);
        state = restoreCampaign(saved);
        const active = state.researchTrials.active;
        assert.equal(active.seed, trial.seed);
        assert.deepEqual(active.probes, session.probes);
        assert.deepEqual(getEvaluationEvidence(createResearchPuzzle('evaluation', active.seed), { probes: active.probes }),
            getEvaluationEvidence(puzzle, session));
        assert.equal(serializeCampaign(state), saved, 'resume does not replace the case or reset its evidence');
    }
    assert.deepEqual(state.rng, rng, 'experiments do not consume campaign randomness');
    assert.equal(getEvaluationEvidence(puzzle, session).remaining, 0);
    const before = serializeCampaign(state);
    assert.equal(recordEvaluationProgress(state, trial.id, { probes: [...session.probes, 'cue'] }).ok, false);
    assert.equal(serializeCampaign(state), before);
});

test('progress accepts one new experiment without allowing erasure, reordering, duplicate spends or stale callbacks', () => {
    const state = createCampaign({ seed: 'evaluation-progress-integrity' });
    const { trial } = startResearchTrial(state, 'evaluation');
    trial.probes.push('cue');
    assert.deepEqual(state.researchTrials.active.probes, [], 'the returned trial cannot alter the saved budget');
    const progress = { probes: ['control'] };
    assert.equal(recordEvaluationProgress(state, trial.id, progress).ok, true);
    progress.probes.push('audit');
    assert.deepEqual(state.researchTrials.active.probes, ['control'], 'recorded progress owns its array');
    const before = serializeCampaign(state);
    for (const invalid of [
        null, {}, { probes: null }, { probes: 'control' }, { probes: ['control'], extra: true },
        { probes: [] }, { probes: ['control'] }, { probes: ['audit', 'control'] },
        { probes: ['control', 'control'] }, { probes: ['control', 'unknown'] },
        { probes: ['control', 'audit', 'adapter'] }, { probes: ['control', 'audit', 'adapter', 'cue'] },
        { probes: ['control', undefined] }, { probes: Array(2) }
    ]) {
        assert.equal(recordEvaluationProgress(state, trial.id, invalid).ok, false);
        assert.equal(serializeCampaign(state), before);
    }
    cancelResearchTrial(state);
    const next = startResearchTrial(state, 'evaluation').trial;
    assert.notEqual(next.seed, trial.seed);
    const restarted = serializeCampaign(state);
    assert.equal(recordEvaluationProgress(state, trial.id, { probes: ['control'] }).ok, false);
    assert.equal(serializeCampaign(state), restarted);
    assert.equal(completeResearchTrial(state, trial.id, 1).ok, false);
    assert.equal(completeResearchTrial(state, next.id, 0.7).ok, true);
    const complete = serializeCampaign(state);
    assert.equal(recordEvaluationProgress(state, next.id, { probes: ['control'] }).ok, false);
    assert.equal(completeResearchTrial(state, next.id, 1).ok, false);
    assert.equal(startResearchTrial(state, 'evaluation').ok, false);
    assert.equal(serializeCampaign(state), complete);
    assert.equal(state.history.filter(entry => entry.kind === 'research-trial').length, 1);
});

test('legacy active evaluation saves resume with an empty budget history and can record progress', () => {
    const state = createCampaign({ seed: 'legacy-evaluation' });
    const { trial } = startResearchTrial(state, 'evaluation');
    state.researchTrials.active.seed = `${state.seed}:trial:evaluation`;
    delete state.researchTrials.active.probes;
    const legacy = serializeCampaign(state);
    const restored = restoreCampaign(legacy);
    assert.equal(serializeCampaign(restored), legacy);
    assert.equal(recordEvaluationProgress(restored, trial.id, { probes: ['audit'] }).ok, true);
    assert.deepEqual(restoreCampaign(serializeCampaign(restored)).researchTrials.active.probes, ['audit']);
    assert.equal(restored.researchTrials.active.seed, `${state.seed}:trial:evaluation`);
});

test('malformed saved probe lists and non-evaluation progress are rejected', () => {
    const state = createCampaign({ seed: 'invalid-saved-evidence' });
    startResearchTrial(state, 'evaluation');
    for (const probes of [null, 'control', ['control', 'control'], ['unknown'], ['control', 'audit', 'adapter', 'cue']]) {
        const changed = structuredClone(state);
        changed.researchTrials.active.probes = probes;
        assert.throws(() => restoreCampaign(JSON.stringify(changed)), /invalid active research trial/);
    }
    cancelResearchTrial(state);
    const control = startResearchTrial(state, 'control').trial;
    const before = serializeCampaign(state);
    assert.equal(recordEvaluationProgress(state, control.id, { probes: ['control'] }).ok, false);
    assert.equal(serializeCampaign(state), before);
    state.researchTrials.active.probes = [];
    assert.throws(() => restoreCampaign(JSON.stringify(state)), /active trial has missing or unsupported fields/);
});
