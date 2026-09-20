import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, setAllocation, setPlan, getForecast, SECTORS } from '../campaign.js';
import { createRandom } from '../random.js';

test('slider redistribution preserves locks, integer shares, and the full budget', () => {
    const state = createCampaign();
    const rng = createRandom('allocation-fuzz');
    for (let step = 0; step < 1500; step++) {
        const sector = SECTORS[Math.floor(rng.random() * SECTORS.length)].id;
        const value = Math.floor(rng.random() * 101);
        const locks = SECTORS.filter(item => item.id !== sector && rng.random() < 0.3).map(item => item.id);
        const before = { ...state.allocations };
        const changed = setAllocation(state, sector, value, locks);
        if (changed) {
            assert.equal(state.allocations[sector], value);
            for (const id of locks) assert.equal(state.allocations[id], before[id]);
        } else assert.deepEqual(state.allocations, before);
        assert.equal(Object.values(state.allocations).reduce((sum, number) => sum + number, 0), 100);
        assert.ok(Object.values(state.allocations).every(number => Number.isInteger(number) && number >= 0 && number <= 100));
    }
});

test('zero-weight sectors redistribute evenly and locked impossible plans are atomic', () => {
    const state = createCampaign();
    assert.equal(setPlan(state, { capabilities: 100, safety: 0, security: 0, products: 0, diplomacy: 0, infrastructure: 0 }), true);
    assert.equal(setAllocation(state, 'capabilities', 50), true);
    assert.deepEqual(state.allocations, { capabilities: 50, safety: 10, security: 10, products: 10, diplomacy: 10, infrastructure: 10 });
    const before = structuredClone(state);
    assert.equal(setAllocation(state, 'safety', 90, ['capabilities']), false);
    assert.deepEqual(state, before);
    assert.equal(setAllocation(state, 'safety', 50, ['capabilities', 'safety']), false);
    assert.deepEqual(state, before);
});

test('bad plan inputs and changes during a decision are rejected without mutation', () => {
    const state = createCampaign();
    for (const value of [-1, 101, 1.5, NaN, Infinity, '20']) assert.equal(setAllocation(state, 'safety', value), false);
    assert.equal(setAllocation(state, '__proto__', 10), false);
    assert.equal(setAllocation(state, 'safety', 10, ['unknown']), false);
    assert.equal(setPlan(state, { capabilities: 100 }), false);
    assert.equal(setPlan(state, { ...state.allocations, surprise: 0 }), false);
    assert.equal(setPlan(state, { ...state.allocations, safety: 21 }), false);
    const before = structuredClone(state.allocations);
    state.phase = 'decision';
    assert.equal(setPlan(state, before), false);
    assert.equal(setAllocation(state, 'safety', 50), false);
    assert.deepEqual(state.allocations, before);
});

test('diversity gives a modest explicit bonus without defeating specialization', () => {
    const balanced = createCampaign();
    const focused = createCampaign();
    setPlan(focused, { capabilities: 100, safety: 0, security: 0, products: 0, diplomacy: 0, infrastructure: 0 });
    const broadForecast = getForecast(balanced);
    const focusedForecast = getForecast(focused);
    assert.ok(broadForecast.diversityBonus > 0.10 && broadForecast.diversityBonus <= 0.12);
    assert.equal(focusedForecast.diversityBonus, 0);
    assert.ok(focusedForecast.capabilityGain > broadForecast.capabilityGain);
    assert.equal(focusedForecast.safetyGain, 0);
});
