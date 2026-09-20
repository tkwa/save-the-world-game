import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialGameState, gameState, resetSharedGameState } from '../utils.js';
import { createRandom, setRandomSeed, getRandomState, setRandomState } from '../random.js';

test('campaign creation uses the replayable random stream', () => {
    const isolated = createRandom('new campaign');
    setRandomSeed('new campaign');
    assert.equal(createInitialGameState().alignmentLevel, isolated.random());
    assert.equal(createInitialGameState().alignmentLevel, isolated.random());
    const savedRandom = getRandomState();
    const expected = createInitialGameState();
    setRandomState(savedRandom);
    assert.deepEqual(createInitialGameState(), expected);
});

test('each campaign owns its mutable defaults', () => {
    const first = createInitialGameState();
    const second = createInitialGameState();
    first.competitorAILevels[0] = 900;
    first.competitorNames.push('Previous campaign');
    first.technologies.nanotech = true;
    first.evalsBuilt.forecasting = true;
    first.statusEffects.sanctions = { active: true };
    first.eventsSeen.treaty = 3;
    first.choicesTaken.treaty = { reject: 1 };
    first.eventsAccepted.add('treaty');
    first.eventAppearanceCounts.set('treaty', 2);
    assert.deepEqual(second.competitorAILevels, [8, 6, 4]);
    assert.deepEqual(second.competitorNames, []);
    assert.equal(second.technologies.nanotech, false);
    assert.equal(second.evalsBuilt.forecasting, false);
    assert.deepEqual(second.statusEffects, {});
    assert.deepEqual(second.eventsSeen, {});
    assert.deepEqual(second.choicesTaken, {});
    assert.equal(second.eventsAccepted.size, 0);
    assert.equal(second.eventAppearanceCounts.size, 0);
});

test('restart clears a completed campaign and leaked fields while retaining the shared object', () => {
    const sharedReference = gameState;
    const leakedSymbol = Symbol('temporary game flag');
    Object.assign(gameState, {
        outcome: { kind: 'extinction' },
        endGameResult: '<p>Old ending</p>',
        alignmentRolls: { player: false },
        galaxyDistribution: { rogueGalaxies: 100 },
        internationalTreatyRatified: true,
        internationalTreatyRatifiedTurn: 48,
        internationalTreatyProgress: 2000,
        hasIntelligenceAgreement: true,
        aiLevelPerTurn: 100,
        incomeBonus: 50,
        resourceMultiplier: 2,
        capabilityEvalsCooldown: 15,
        forecastingEvalsCooldown: 15,
        coinFlipData: { active: true },
        acquisitionCompetitorIndex: 2,
        breakthroughCompetitorIndex: 1,
        alignmentProjectStarted: true,
        currentAlignmentProject: 'Control',
        cooIsMinister: true,
        debugShowAllTechs: true,
        oldExtensionField: { shouldDisappear: true },
        [leakedSymbol]: true
    });
    gameState.eventsAccepted.add('old-event');
    gameState.eventAppearanceCounts.set('old-event', 10);
    gameState.statusEffects.shaken = { active: true };
    gameState.technologies.nanotech = true;
    const oldNestedObjects = Object.entries(gameState)
        .filter(([, value]) => value !== null && typeof value === 'object');

    setRandomSeed('restart');
    const expected = createInitialGameState();
    setRandomSeed('restart');
    assert.equal(resetSharedGameState(), sharedReference);
    assert.equal(gameState, sharedReference);
    assert.deepEqual(gameState, expected);
    assert.equal(Object.hasOwn(gameState, 'oldExtensionField'), false);
    assert.equal(Object.hasOwn(gameState, leakedSymbol), false);
    for (const [key, value] of oldNestedObjects) {
        assert.notEqual(gameState[key], value, `${key} must not retain a prior campaign object`);
    }
    assert.equal(gameState.money, 10);
    assert.equal(gameState.currentYear, 2026);
    assert.equal(gameState.internationalTreatyRatified, false);
    assert.equal(gameState.outcome, null);
});
