import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ECI_START, ECI_ASI, capabilityToECI, createCampaign, setPlan,
    getForecast, advanceQuarter, serializeCampaign, restoreCampaign
} from '../campaign.js';

test('ECI preserves the two scenario anchors and lab ordering, including zero capability', () => {
    assert.equal(ECI_START, 155);
    assert.equal(ECI_ASI, 225);
    assert.equal(capabilityToECI(10), ECI_START);
    assert.equal(capabilityToECI(1000), ECI_ASI);
    const capabilities = [0, 0.001, 1, 4, 5, 6, 7, 8, 10, 18, 65, 140, 180, 999.999, 1000, 1e6];
    const indices = capabilities.map(capabilityToECI);
    assert.ok(indices.every(Number.isFinite));
    assert.ok(indices.every((value, index) => index === 0 || value > indices[index - 1]));
    assert.ok(capabilityToECI(0.001) - capabilityToECI(0) < 0.1, 'rebuilding from zero has no display discontinuity');
    for (const value of [-1, NaN, Infinity, -Infinity, null, '10', undefined]) {
        assert.throws(() => capabilityToECI(value), /finite nonnegative number/);
    }
});

test('the ECI forecast and quarterly report match actual rounded and capped production', () => {
    for (const capability of [0, 0.001, 10, 999.999, 999999.999, 1e6]) {
        const state = createCampaign({ seed: `eci-production-${capability}` });
        state.player.capability = capability;
        state.timeline[0].capability = capability;
        setPlan(state, { capabilities: 60, safety: 10, security: 10, products: 10, diplomacy: 5, infrastructure: 5 });
        const before = capabilityToECI(state.player.capability);
        const saved = serializeCampaign(state);
        const forecast = getForecast(state);
        assert.equal(serializeCampaign(state), saved, 'ECI forecasts do not alter saves or randomness');
        assert.equal(advanceQuarter(state).ok, true);
        const after = capabilityToECI(state.player.capability);
        assert.equal(forecast.eciGain, after - before);
        assert.equal(state.latestReport[0], `ECI increased by ${(after - before).toFixed(1)} points to ${after.toFixed(1)}.`);
        if (capability === 0) assert.ok(after > before, 'funded research recovers from zero in both scales');
        if (capability === 1e6) {
            assert.ok(forecast.capabilityGain > 0);
            assert.equal(forecast.eciGain, 0, 'displayed progress respects the actual internal cap');
        }
    }
});

test('paused or unfunded research does not promise an ECI increase', () => {
    const state = createCampaign({ seed: 'eci-paused' });
    setPlan(state, { capabilities: 0, safety: 20, security: 15, products: 25, diplomacy: 25, infrastructure: 15 });
    assert.equal(getForecast(state).eciGain, 0);
    state.resources.funds = 0;
    state.products = [];
    setPlan(state, { capabilities: 100, safety: 0, security: 0, products: 0, diplomacy: 0, infrastructure: 0 });
    assert.equal(getForecast(state).funding, 0);
    assert.equal(getForecast(state).eciGain, 0);
});

test('version-one saves retain internal units and legacy report text without migration', () => {
    const state = createCampaign({ seed: 'eci-legacy-save' });
    advanceQuarter(state);
    state.latestReport[0] = 'Capability increased by 2.3 to 12.3.';
    const oldSave = serializeCampaign(state);
    const restored = restoreCampaign(oldSave);
    assert.equal(serializeCampaign(restored), oldSave);
    assert.equal(restored.schemaVersion, 1);
    assert.equal(restored.timeline[0].capability, 10);
    assert.equal(restored.products[0].frontierAtLaunch, 10);
    assert.equal(Object.hasOwn(restored.player, 'eci'), false);
    assert.equal(Object.hasOwn(restored, 'eciGain'), false);
    assert.equal(getForecast(restored).eciGain, getForecast(state).eciGain);
    assert.equal(serializeCampaign(restored), oldSave, 'derived ECI values never enter the saved state');
});
