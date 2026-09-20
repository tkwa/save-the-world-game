import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandGate, growCompetitors, ratifyTreaty } from '../campaign-controls.js';

test('rival identity follows its capability through a ranking change', () => {
    const state = { competitorNames: ['A', 'B'], competitorAILevels: [8, 6] };
    const draws = [.99, .00001];
    growCompetitors(state, () => draws.shift());
    assert.equal(state.competitorNames[0], 'B');
    assert.ok(state.competitorAILevels[0] > state.competitorAILevels[1]);
});

test('zero RNG and shaken rivals cannot create an invalid capability', () => {
    const state = { competitorNames: ['A'], competitorAILevels: [8] };
    growCompetitors(state, () => 0);
    assert.ok(Number.isFinite(state.competitorAILevels[0]));
    state.statusEffects = { shaken: { restrictionsActive: true } };
    const original = state.competitorAILevels[0];
    growCompetitors(state, () => .5);
    assert.equal(state.competitorAILevels[0], original);
});

test('treaty completion is an idempotent recorded transition', () => {
    const state = { internationalTreatyProgress: 2001, currentTurn: 20 };
    assert.equal(ratifyTreaty(state), true);
    assert.equal(state.internationalTreatyProgress, 2000);
    assert.equal(state.internationalTreatyRatificationTurn, 20);
    assert.equal(ratifyTreaty(state), false);
});

test('commands reject invalid, repeated, unaffordable and out-of-order choices', () => {
    const gate = createCommandGate();
    const choice = { action: 'buy' };
    const state = { currentEvent: { choices: [choice] }, selectedAllocation: null };
    const yes = () => true;
    assert.equal(gate.beginChoice(state, 0, yes), null);
    state.selectedAllocation = 'product';
    for (const i of [-1, .5, NaN, 1]) assert.equal(gate.beginChoice(state, i, yes), null);
    assert.equal(gate.beginChoice(state, 0, () => false), null);
    assert.equal(gate.beginTurn(state), null);
    const token = gate.beginChoice(state, 0, yes);
    assert.notEqual(token, null);
    gate.endChoice(token);
    assert.equal(gate.beginChoice(state, 0, yes), null);
    state.currentEvent.choices = [{ action: 'follow-up' }];
    assert.notEqual(gate.beginChoice(state, 0, yes), null);
});

test('turn lock lasts across awaits and old operations cannot unlock a new run', () => {
    const gate = createCommandGate();
    const state = { selectedAllocation: 'revenue', currentEvent: { choices: [] } };
    const old = gate.beginTurn(state);
    assert.equal(gate.beginTurn(state), null);
    gate.reset();
    assert.equal(gate.isCurrent(old), false);
    const current = gate.beginTurn(state);
    gate.endTurn(old);
    assert.equal(gate.beginTurn(state), null);
    gate.endTurn(current);
    assert.notEqual(gate.beginTurn(state), null);
});
