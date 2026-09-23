import test from 'node:test';
import assert from 'node:assert/strict';
import { getQuarterlyRisk } from '../risk.js';

// The injected identity conversion lets the tests specify meaningful ECI levels
// directly, while exercising the production hazard and attribution calculation.
const toECI = value => value;
const fixture = (eci = 155) => ({
    labId: 'player', player: { capability: eci, security: 0 },
    research: { alignment: 0, control: 0, evals: 0, interpretability: 0 },
    policies: { deployment: 'rushed' }, flags: {}, rivals: []
});
const close = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected}`);

test('early quarterly risk is nonzero but rounds to zero, and rises before ASI', () => {
    for (const eci of [155, 175, 190]) {
        const result = getQuarterlyRisk(fixture(eci), toECI);
        assert.ok(result.total > 0 && result.total < 1e-5);
        assert.equal((result.total * 100).toFixed(2), '0.00');
    }
    const halfway = getQuarterlyRisk(fixture(190), toECI).total;
    const late = getQuarterlyRisk(fixture(220), toECI).total;
    assert.ok(late > halfway * 10000);
    assert.ok(late < getQuarterlyRisk(fixture(225), toECI).total);
});

test('the curve rises sharply around ASI and saturates without overflow', () => {
    const samples = [220, 225, 230, 250, 1e200].map(eci => getQuarterlyRisk(fixture(eci), toECI));
    assert.ok(samples[1].total > samples[0].total * 2);
    assert.ok(samples[2].total > samples[1].total * 1.5);
    close(samples[1].total / samples[1].byLab[0].cap, 0.5000005);
    assert.ok(samples.every(result => Number.isFinite(result.total) && result.total <= result.byLab[0].cap));
    close(samples.at(-1).total, samples.at(-1).byLab[0].cap);
    for (let index = 1; index < samples.length; index++) assert.ok(samples[index].total >= samples[index - 1].total);
});

test('alignment sets the ceiling while monitoring suppresses the middle of the trajectory', () => {
    const state = fixture(200);
    const baseline = getQuarterlyRisk(state, toECI);
    for (const key of ['control', 'evals', 'interpretability']) state.research[key] = 100;
    const monitored = getQuarterlyRisk(state, toECI);
    assert.ok(monitored.total < baseline.total * 0.5);
    close(monitored.byLab[0].cap, baseline.byLab[0].cap);
    state.player.capability = 225;
    const frontierMonitoring = getQuarterlyRisk(state, toECI);
    close(frontierMonitoring.total, getQuarterlyRisk(fixture(225), toECI).total);
    state.research.alignment = 100;
    const aligned = getQuarterlyRisk(state, toECI);
    close(aligned.byLab[0].cap, 0.002);
    assert.ok(aligned.total < frontierMonitoring.total / 100);
    assert.ok(aligned.total > 0, 'the model does not promise perfect alignment');
});

test('each lab has its own hazard and attributed probabilities add to the world total', () => {
    const state = fixture(222);
    state.rivals = [
        { id: 'rival-a', capability: 221, safety: 35, security: 25 },
        { id: 'rival-b', capability: 218, safety: 70, security: 75 }
    ];
    const original = getQuarterlyRisk(state, toECI);
    close(original.own + original.others, original.total);
    close(original.byLab.reduce((sum, lab) => sum + lab.attributedRisk, 0), original.total);
    close(original.total, 1 - Math.exp(-original.byLab.reduce((sum, lab) => sum + lab.rate, 0)));
    state.research.control = state.research.evals = state.research.interpretability = 100;
    state.research.alignment = 100;
    state.player.security = 100;
    state.flags.openSafety = true;
    const protectedOwn = getQuarterlyRisk(state, toECI);
    assert.ok(protectedOwn.byLab[0].rate < original.byLab[0].rate);
    for (const index of [1, 2]) close(protectedOwn.byLab[index].rate, original.byLab[index].rate);
    state.rivals[0].safety = 90;
    const protectedRival = getQuarterlyRisk(state, toECI);
    assert.ok(protectedRival.byLab[1].rate < protectedOwn.byLab[1].rate);
    close(protectedRival.byLab[0].rate, protectedOwn.byLab[0].rate);
    close(protectedRival.byLab[2].rate, protectedOwn.byLab[2].rate);
});

test('authority changes the deploying lab’s exposure, including when a rival wins', () => {
    const state = fixture(240);
    state.rivals = [{ id: 'rival', capability: 226, safety: 30, security: 50 }];
    const normal = getQuarterlyRisk(state, toECI);
    state.policies.deployment = 'cautious';
    const cautious = getQuarterlyRisk(state, toECI);
    const checkpoints = getQuarterlyRisk(state, toECI, { authorityChoice: 'human-checkpoints' });
    const council = getQuarterlyRisk(state, toECI, { authorityChoice: 'shared-council' });
    const delegated = getQuarterlyRisk(state, toECI, { authorityChoice: 'delegate' });
    const rivalCouncil = getQuarterlyRisk(state, toECI,
        { authorityChoice: 'shared-council', deployedLabId: 'rival' });
    assert.ok(cautious.own < normal.own);
    assert.ok(council.own < checkpoints.own && checkpoints.own < delegated.own);
    for (const result of [normal, cautious, checkpoints, council, delegated]) {
        assert.ok(-Math.expm1(-result.byLab[0].rate) <= result.byLab[0].cap);
        close(result.byLab[1].rate, normal.byLab[1].rate);
    }
    close(rivalCouncil.byLab[0].rate, cautious.byLab[0].rate);
    assert.ok(rivalCouncil.byLab[1].rate < cautious.byLab[1].rate);
});

test('the model is deterministic, does not mutate input, and rejects nonfinite hazards', () => {
    const state = fixture(212);
    state.rivals = [{ id: 'rival', capability: 205, safety: 50, security: 60 }];
    const before = structuredClone(state);
    const result = getQuarterlyRisk(state, toECI);
    assert.deepEqual(getQuarterlyRisk(state, toECI), result);
    result.byLab[0].cap = 0;
    assert.deepEqual(state, before);
    assert.notEqual(getQuarterlyRisk(state, toECI).byLab[0].cap, 0);
    assert.throws(() => getQuarterlyRisk(state, () => NaN), /ECI must be finite/);
    assert.throws(() => getQuarterlyRisk(state, toECI, { authorityChoice: 'unknown' }), /authority choice/);
    assert.throws(() => getQuarterlyRisk(state, toECI,
        { authorityChoice: 'shared-council', deployedLabId: 'missing' }), /deployed lab/);
    state.research.alignment = Infinity;
    assert.throws(() => getQuarterlyRisk(state, toECI), /Alignment must be finite/);
    state.research.alignment = 0;
    state.rivals[0].id = state.labId;
    assert.throws(() => getQuarterlyRisk(state, toECI), /identifier/);
});
