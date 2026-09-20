import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutcome, ensureOutcome } from '../outcome.js';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(
    Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be near ${expected}`);
const base = () => ({
    companyName: 'Player Lab',
    playerAILevel: 10,
    competitorNames: ['Rival Lab'],
    competitorAILevels: [10],
    playerEquity: 0.1,
    rawRiskLevel: 20,
    currentMonth: 'May',
    currentYear: 2028,
    currentTurn: 29,
    gameOverReason: 'ai-singularity'
});

function sequence(values) {
    let index = 0;
    return () => {
        assert.ok(index < values.length, 'Unexpected additional outcome roll');
        return values[index++];
    };
}

test('squared capability shares conserve territory and include the company in human control', () => {
    const result = createOutcome({ ...base(), playerAILevel: 3, competitorAILevels: [4] }, { riskPercent: 0 });
    close(result.realized.companyShare, 36);
    close(result.realized.otherHumanShare, 64);
    close(result.realized.humanShare, 100);
    close(result.realized.personalShare, 3.6);
    close(result.realized.rogueShare, 0);
    assert.equal(result.winner.name, 'Rival Lab');
    assert.equal(result.winner.isPlayer, false);
    assert.equal('score' in result.realized, false, 'There must be no combined utility score');
});

test('expected outcomes and realized outcomes use one distinct alignment draw per organization', () => {
    const result = createOutcome(base(), { rng: sequence([0.1, 0.8]) });
    assert.deepEqual(result.participants.map(actor => actor.roll), [0.1, 0.8]);
    assert.deepEqual(result.participants.map(actor => actor.aligned), [false, true]);
    assert.deepEqual(result.expected, {
        companyShare: 40, otherHumanShare: 40, humanShare: 80, rogueShare: 20, personalShare: 4
    });
    assert.deepEqual(result.realized, {
        companyShare: 0, otherHumanShare: 50, humanShare: 50, rogueShare: 50, personalShare: 0
    });
});

test('independent rival risks can differ from the player risk', () => {
    const state = { ...base(), competitors: [{ id: 'careless', name: 'Rival Lab', aiLevel: 10, riskPercent: 90 }] };
    const result = createOutcome(state, { riskPercent: 10, rng: sequence([0.5, 0.5]) });
    close(result.expected.companyShare, 45);
    close(result.expected.otherHumanShare, 5);
    close(result.expected.humanShare, 50);
    close(result.realized.companyShare, 50);
    close(result.realized.rogueShare, 50);
});

test('winner identification follows the largest capability, not the first rival', () => {
    const result = createOutcome({ ...base(), competitorNames: ['First', 'Actual leader', 'Third'], competitorAILevels: [9, 30, 11] }, { riskPercent: 0 });
    assert.equal(result.winner.name, 'Actual leader');
    assert.equal(result.winner.id, 'rival-2');
    assert.equal(result.winner.tied, false);
});

test('stable competitor records remain attached to their names and IDs', () => {
    const result = createOutcome({ ...base(), competitors: [
        { id: 'one', name: 'Low', capability: 1 },
        { id: 'two', name: 'High', capability: 100 }
    ] }, { riskPercent: 0 });
    assert.equal(result.winner.id, 'two');
    assert.equal(result.winner.name, 'High');
    assert.equal(result.participants.length, 3, 'Legacy arrays must not create duplicate rivals');
});

test('ties are represented explicitly', () => {
    const result = createOutcome(base(), { riskPercent: 0 });
    assert.equal(result.winner.tied, true);
    assert.deepEqual(result.winner.tiedNames, ['Player Lab', 'Rival Lab']);
});

for (const reason of ['risk-100', 'ai-escape', 'nuclear-failure']) {
    test(`${reason} has a distinct reason and deterministic catastrophe without additional rolls`, () => {
        const result = createOutcome({ ...base(), gameOverReason: reason }, {
            riskPercent: 0, rng: () => assert.fail('Catastrophe must not reroll alignment')
        });
        assert.equal(result.reason, reason);
        assert.equal(result.catastrophe, true);
        assert.equal(result.route, 'catastrophe');
        assert.equal(result.winner, null);
        assert.equal(result.realized.rogueShare, 100);
        assert.equal(result.realized.humanShare, 0);
        assert.equal(result.realized.personalShare, 0);
        assert.deepEqual(result.expected, result.realized);
        assert.ok(result.participants.every(actor => actor.roll === null));
    });
}

for (const [reason, route] of [
    ['ai-singularity', 'competition'], ['dsa-singularity', 'concentration'],
    ['treaty', 'coordination'], ['treaty-completed', 'coordination']
]) {
    test(`${reason} resolves through the normal share model with its own route`, () => {
        const result = createOutcome({ ...base(), gameOverReason: reason }, { riskPercent: 0 });
        assert.equal(result.route, route);
        assert.equal(result.catastrophe, false);
        assert.equal(result.realized.humanShare, 100);
        if (route === 'coordination') assert.equal(result.winner, null, 'A treaty must not assert an ASI race winner');
    });
}

test('risk bounds and exact probability boundaries are respected', () => {
    const neverRoll = () => assert.fail('Certain outcomes do not consume RNG');
    assert.equal(createOutcome(base(), { riskPercent: -1, rng: neverRoll }).realized.humanShare, 100);
    assert.equal(createOutcome(base(), { riskPercent: 101, rng: neverRoll }).realized.rogueShare, 100);
    assert.equal(createOutcome(base(), { riskPercent: Infinity, rng: neverRoll }).riskPercent, 100);
    assert.equal(createOutcome(base(), { riskPercent: -Infinity, rng: neverRoll }).riskPercent, 0);
    assert.equal(createOutcome(base(), { rng: sequence([0.2, 0.2]) }).realized.humanShare, 100);
    assert.equal(createOutcome(base(), { rng: sequence([0, 0]) }).realized.rogueShare, 100);
});

test('invalid capabilities and equity remain finite, bounded, and conserved', () => {
    const result = createOutcome({ ...base(), playerAILevel: NaN, competitorAILevels: [-5, Infinity, 0], playerEquity: Infinity }, { riskPercent: 0 });
    assert.equal(result.playerEquity, 1);
    assert.equal(result.winner, null);
    assert.deepEqual(result.participants.map(actor => actor.rawShare), [25, 25, 25, 25]);
    assert.equal(result.realized.humanShare, 100);
    assert.equal(result.realized.personalShare, 25);
    assert.equal(createOutcome({ ...base(), playerEquity: -2 }, { riskPercent: 0 }).realized.personalShare, 0);
});

test('large finite capability values do not overflow when squared', () => {
    const result = createOutcome({ ...base(), playerAILevel: 1e308, competitorAILevels: [1e308] }, { riskPercent: 0 });
    assert.deepEqual(result.participants.map(actor => actor.rawShare), [50, 50]);
    assert.equal(result.realized.humanShare, 100);
});

test('an organization with no resources does not receive an unsupported alignment result', () => {
    const result = createOutcome({ ...base(), playerAILevel: 0 }, { rng: sequence([0.9]) });
    assert.equal(result.participants[0].aligned, null);
    assert.equal(result.participants[0].roll, null);
    assert.equal(result.realized.companyShare, 0);
    assert.equal(result.realized.humanShare, 100);
});

test('creating an outcome is pure and the result is deeply immutable', () => {
    const state = base();
    const before = JSON.stringify(state);
    const result = createOutcome(state, { rng: sequence([0.5, 0.1]) });
    assert.equal(JSON.stringify(state), before);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.participants[0]));
    assert.ok(Object.isFrozen(result.realized));
    state.companyName = 'Changed later';
    assert.equal(result.companyName, 'Player Lab');
});

test('cache reuses exactly the same outcome despite new state or RNG', () => {
    const state = base();
    const first = ensureOutcome(state, { rng: sequence([0.5, 0.1]) });
    state.playerAILevel = 1e8;
    state.playerEquity = 1;
    state.rawRiskLevel = 100;
    const second = ensureOutcome(state, { rng: () => assert.fail('Cached result must not reroll') });
    assert.equal(first, second);
    assert.equal(state.outcome, first);
    assert.equal(second.realized.companyShare, 50);
    assert.equal(second.realized.personalShare, 5);
});

test('JSON-restored cached outcomes do not reroll or recompute', () => {
    const state = base();
    ensureOutcome(state, { rng: sequence([0.9, 0.1]) });
    const restored = JSON.parse(JSON.stringify(state));
    const result = ensureOutcome(restored, { rng: () => assert.fail('Reload must preserve outcome') });
    assert.deepEqual(result, state.outcome);
    assert.ok(Object.isFrozen(result));
});

test('invalid RNG output fails without storing a partial outcome', () => {
    for (const value of [NaN, Infinity, -0.01, 1, '0.5']) {
        const state = base();
        assert.throws(() => ensureOutcome(state, { rng: () => value }), /Outcome RNG/);
        assert.equal(state.outcome, undefined);
    }
});

test('shares remain conserved across deterministic varied campaigns', () => {
    let seed = 713;
    const rng = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
    for (let run = 0; run < 400; run++) {
        const state = {
            ...base(), playerAILevel: 10 ** (rng() * 300), playerEquity: rng(),
            competitors: Array.from({ length: Math.floor(rng() * 7) }, (_, index) => ({
                id: `rival-${index}`, name: `Rival ${index}`, aiLevel: 10 ** (rng() * 300), riskPercent: rng() * 100
            }))
        };
        const result = createOutcome(state, { riskPercent: rng() * 100, rng });
        close(result.participants.reduce((sum, actor) => sum + actor.rawShare, 0), 100);
        for (const projection of [result.expected, result.realized]) {
            close(projection.companyShare + projection.otherHumanShare + projection.rogueShare, 100);
            close(projection.humanShare + projection.rogueShare, 100);
            assert.ok(projection.personalShare <= projection.companyShare);
            assert.ok(Object.values(projection).every(value => Number.isFinite(value) && value >= 0 && value <= 100));
        }
    }
});

test('every ending phase renders the cached outcome and keeps the two results separate', async () => {
    const { gameState } = await import('../utils.js');
    const { calculateEndGameScore, getEndGamePhaseText, getEndGamePhaseButtons, disposeEndgame } = await import('../endgame.js');
    const original = { ...gameState };
    try {
        Object.assign(gameState, base(), { outcome: null });
        calculateEndGameScore({ riskPercent: 20, rng: sequence([0.9, 0.1]) });
        const resolved = gameState.outcome;
        gameState.companyName = 'Incorrect later name';
        gameState.rawRiskLevel = 100;
        gameState.playerEquity = 1;
        let allText = '';
        for (let phase = 1; phase <= 4; phase++) {
            gameState.endGamePhase = phase;
            const first = getEndGamePhaseText();
            assert.equal(getEndGamePhaseText(), first, 'Re-render must be stable');
            assert.doesNotMatch(first, /Incorrect later name/);
            assert.equal(gameState.outcome, resolved);
            assert.ok(getEndGamePhaseButtons().some(button => button.text === 'Restart'), 'Restart is immediately available');
            allText += first;
        }
        assert.match(allText, /Human control/);
        assert.match(allText, /Personal ownership/);
        assert.match(allText, /5\.0%/);
        assert.doesNotMatch(allText, /Final score|Expected score|Overall score/i);
        disposeEndgame();
        assert.equal(gameState.outcome, resolved, 'Scene disposal must retain the outcome for replay');
    } finally {
        for (const key of Object.keys(gameState)) delete gameState[key];
        Object.assign(gameState, original);
    }
});
