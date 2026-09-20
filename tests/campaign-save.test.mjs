import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCampaign, advanceQuarter, getCurrentEvent, getChoiceAvailability, resolveDecision,
    getTransitionDecision, resolveTransition, serializeCampaign, restoreCampaign,
    startResearchTrial, completeResearchTrial, cancelResearchTrial
} from '../campaign.js';

function step(state) {
    if (state.phase === 'planning') advanceQuarter(state);
    else if (state.phase !== 'complete') {
        const definition = state.phase === 'decision' ? getCurrentEvent(state) : getTransitionDecision(state);
        const choice = definition.choices.find(item => getChoiceAvailability(state, item).available);
        (state.phase === 'decision' ? resolveDecision : resolveTransition)(state, choice.id);
    }
}

test('a save during a pending event continues through the exact same campaign and ending', () => {
    const original = createCampaign({ seed: 'save-and-replay', labId: 'deepmind' });
    advanceQuarter(original);
    assert.equal(original.phase, 'decision');
    const restored = restoreCampaign(serializeCampaign(original));
    assert.equal(getCurrentEvent(restored).id, getCurrentEvent(original).id);
    let limit = 300;
    while (original.phase !== 'complete' && limit-- > 0) {
        step(original);
        step(restored);
        assert.deepEqual(restored, original);
        assert.deepEqual(restoreCampaign(serializeCampaign(original)), original);
    }
    assert.equal(original.phase, 'complete');
});

test('active research trials resume with the same puzzle seed and one-time reward', () => {
    const original = createCampaign({ seed: 'trial-save' });
    const { trial } = startResearchTrial(original, 'interpretability');
    const restored = restoreCampaign(serializeCampaign(original));
    assert.deepEqual(restored.researchTrials.active, trial);
    completeResearchTrial(original, trial.id, 0.6);
    completeResearchTrial(restored, trial.id, 0.6);
    assert.deepEqual(restored, original);
    assert.deepEqual(restoreCampaign(serializeCampaign(restored)), original);
});

test('save/restore preserves cancellation identities and blocks abandoned trial results', () => {
    const state = createCampaign({ seed: 'cancel-and-resume' });
    const abandoned = startResearchTrial(state, 'evaluation').trial;
    cancelResearchTrial(state);
    const restored = restoreCampaign(serializeCampaign(state));
    const current = startResearchTrial(restored, 'evaluation').trial;
    assert.equal(current.seed, abandoned.seed);
    assert.notEqual(current.id, abandoned.id);
    const activeRestored = restoreCampaign(serializeCampaign(restored));
    assert.deepEqual(activeRestored.researchTrials.active, current);
    assert.equal(completeResearchTrial(activeRestored, abandoned.id, 1).ok, false);
    assert.deepEqual(activeRestored, restored);
    assert.equal(completeResearchTrial(activeRestored, current.id, 0.8).ok, true);
    const completed = restoreCampaign(serializeCampaign(activeRestored));
    assert.equal(startResearchTrial(completed, 'evaluation').ok, false);
    assert.equal(completeResearchTrial(completed, current.id, 1).ok, false);
    assert.deepEqual(completed, activeRestored);
});

test('save validation rejects inconsistent trial completions, history, attempt IDs, and phases', () => {
    const active = createCampaign({ seed: 'trial-integrity' });
    const { trial } = startResearchTrial(active, 'control');
    const invalidActive = [
        state => { state.researchTrials.active.type = ['control']; },
        state => { state.researchTrials.active.seed = 'another-puzzle'; },
        state => { state.researchTrials.active.id = `${state.id}:trial:control:99`; },
        state => { state.researchTrials.attempts = 0; },
        state => { state.researchTrials.attempts = 0.5; },
        state => { state.researchTrials.attempts = Number.MAX_SAFE_INTEGER + 1; },
        state => { state.researchTrials.active.unknown = true; }
    ];
    for (const modify of invalidActive) {
        const state = structuredClone(active);
        modify(state);
        assert.throws(() => restoreCampaign(JSON.stringify(state)), /Invalid campaign save/);
    }
    completeResearchTrial(active, trial.id, 0.6);
    const invalidCompleted = [
        state => { delete state.researchTrials.completed.control; },
        state => { state.researchTrials.completed.control.score = 0.7; },
        state => { state.researchTrials.attempts = 0; },
        state => { state.history = []; },
        state => { state.history.push({ ...state.history[0] }); },
        state => { state.history[0].trialScore = 1; },
        state => { state.researchTrials.active = { ...trial }; }
    ];
    for (const modify of invalidCompleted) {
        const state = structuredClone(active);
        modify(state);
        assert.throws(() => restoreCampaign(JSON.stringify(state)), /Invalid campaign save/);
    }
    const decision = createCampaign({ seed: 'trial-integrity' });
    advanceQuarter(decision);
    decision.researchTrials = { completed: {}, active: trial, attempts: 1 };
    assert.throws(() => restoreCampaign(JSON.stringify(decision)), /invalid active research trial/);
});

test('malformed, incompatible, and inconsistent saves are rejected explicitly', () => {
    for (const text of ['', '{', 'null', '[]', '{}', 'x'.repeat(2_000_001)]) assert.throws(() => restoreCampaign(text), /Invalid campaign save/);
    const modifications = [
        state => { state.schemaVersion = 2; },
        state => { state.labId = 'invented'; },
        state => { state.id = 'unrelated'; },
        state => { state.phase = 'unknown'; },
        state => { state.resources.funds = -1; },
        state => { state.products[0].lifetimeQuarters = 100; },
        state => { state.products[0].launchTurn = 1; },
        state => { state.products[0].initialRevenue = -1; },
        state => { state.products[0].frontierAtLaunch = 0; },
        state => { state.products.push({ ...state.products[0] }); },
        state => { state.products[0].unknown = true; },
        state => { state.player.equity = 2; },
        state => { state.research.control = null; },
        state => { state.allocations.safety++; },
        state => { state.rivals[1] = { ...state.rivals[0] }; },
        state => { state.flags.unknown = true; },
        state => { state.policies.authority = 'invalid'; },
        state => { state.currentEventId = 'credential-breach'; },
        state => { state.seenEvents = ['not-real']; },
        state => { state.timeline = []; },
        state => { state.rng.version = 20; },
        state => { state.rng.seed++; },
        state => { state.rng.extra = true; },
        state => { state.researchTrials.active = { id: 'invalid', type: 'control', seed: 'invalid' }; },
        state => { state.researchTrials.completed.control = { score: 2, turn: 0 }; },
        state => { state.extra = true; }
    ];
    for (const modify of modifications) {
        const state = createCampaign();
        modify(state);
        assert.throws(() => restoreCampaign(JSON.stringify(state)), /Invalid campaign save/);
    }
    const state = createCampaign();
    state.resources.funds = Infinity;
    assert.throws(() => serializeCampaign(state), /outside its bounds/);
});

test('an outcome is derived from the saved campaign, not an independently editable score', () => {
    const state = createCampaign({ seed: 'outcome-validation' });
    let limit = 300;
    while (state.phase !== 'complete' && limit-- > 0) step(state);
    assert.equal(state.phase, 'complete');
    const good = serializeCampaign(state);
    const changed = JSON.parse(good);
    changed.outcome.personalOwnership = changed.outcome.personalOwnership === 50 ? 51 : 50;
    assert.throws(() => restoreCampaign(JSON.stringify(changed)), /does not match the campaign decisions/);
    const reordered = Object.fromEntries(Object.entries(JSON.parse(good)).reverse());
    reordered.outcome = Object.fromEntries(Object.entries(reordered.outcome).reverse());
    assert.deepEqual(restoreCampaign(JSON.stringify(reordered)), state, 'JSON property order does not matter');
});

test('factory milestones survive saves once, while legacy pending factory decisions remain resolvable', () => {
    const state = createCampaign({ seed: 'factory-save' });
    let limit = 100;
    while (!state.history.some(entry => entry.kind === 'milestone') && limit-- > 0) step(state);
    const milestone = state.history.find(entry => entry.kind === 'milestone');
    assert.equal(milestone.eventId, 'factory-autonomy');
    const saved = serializeCampaign(state);
    assert.deepEqual(restoreCampaign(saved), state);
    for (const change of [
        value => { value.history.push({ ...milestone }); },
        value => { value.seenEvents = value.seenEvents.filter(id => id !== 'factory-autonomy'); },
        value => { value.history.find(entry => entry.kind === 'milestone').choiceId = 'bounded'; },
        value => { value.history.find(entry => entry.kind === 'milestone').eventId = 'price-pressure'; }
    ]) {
        const changed = JSON.parse(saved);
        change(changed);
        assert.throws(() => restoreCampaign(JSON.stringify(changed)), /Invalid campaign save/);
    }
    const legacy = JSON.parse(saved);
    legacy.history = legacy.history.filter(entry => entry.kind !== 'milestone');
    legacy.phase = 'decision';
    legacy.currentEventId = 'factory-autonomy';
    const restored = restoreCampaign(JSON.stringify(legacy));
    assert.equal(getCurrentEvent(restored).id, 'factory-autonomy');
    assert.equal(resolveDecision(restored, 'assist').ok, true);
    limit = 100;
    while (restored.phase !== 'complete' && limit-- > 0) {
        step(restored);
        serializeCampaign(restored);
    }
    assert.equal(restored.phase, 'complete');
    assert.equal(restored.history.filter(entry => entry.eventId === 'factory-autonomy').length, 1);
    assert.equal(restored.history.find(entry => entry.eventId === 'factory-autonomy').kind, 'decision');
});
