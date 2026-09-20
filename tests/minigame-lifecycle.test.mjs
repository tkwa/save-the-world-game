import test from 'node:test';
import assert from 'node:assert/strict';
import { startMinigame, disposeMinigame, submitCapabilityEvalsAnswer, updateAlignmentMinigame } from '../minigames.js';
import { gameState, resetSharedGameState } from '../utils.js';
import { getRandomState } from '../random.js';

test('an aborted dataset load cannot populate or navigate a replacement campaign', async context => {
    resetSharedGameState();
    gameState.currentPage = 'main-game';
    let resolveFetch;
    let signal;
    context.mock.method(globalThis, 'fetch', (_url, options) => {
        signal = options.signal;
        return new Promise(resolve => { resolveFetch = resolve; });
    });
    const loading = startMinigame('capability-evals');
    disposeMinigame();
    resetSharedGameState();
    const freshRandom = getRandomState();
    resolveFetch({ ok: true, json: async () => ({ images: [{ filename: 'plot.png', correlation: 0.5 }] }) });
    await loading;
    assert.equal(signal.aborted, true);
    assert.equal(gameState.currentPage, 'start');
    assert.equal(gameState.currentMinigame, null);
    assert.equal(gameState.correlationDataset, null);
    assert.deepEqual(getRandomState(), freshRandom);
});

test('leaving the loading page invalidates a response even without a disposal hook', async context => {
    resetSharedGameState();
    gameState.currentPage = 'main-game';
    let resolveFetch;
    context.mock.method(globalThis, 'fetch', () => new Promise(resolve => { resolveFetch = resolve; }));
    const loading = startMinigame('capability-evals');
    gameState.currentPage = 'start';
    const freshRandom = getRandomState();
    resolveFetch({ ok: true, json: async () => ({ images: [{ filename: 'plot.png', correlation: 0.5 }] }) });
    await loading;
    assert.equal(gameState.currentPage, 'start');
    assert.equal(gameState.currentMinigame, null);
    assert.equal(gameState.correlationDataset, null);
    assert.deepEqual(getRandomState(), freshRandom);
    disposeMinigame();
});

test('answer feedback is recorded once and its delayed navigation cannot escape a reset', context => {
    resetSharedGameState();
    gameState.currentPage = 'capability-evals-minigame';
    gameState.currentMinigame = { type: 'capability-evals', image: { correlation: 0.5 } };
    const feedback = { style: {}, textContent: '' };
    const oldDocument = globalThis.document;
    globalThis.document = {
        querySelectorAll: () => [],
        getElementById: () => feedback
    };
    const callbacks = [];
    const cleared = [];
    context.mock.method(globalThis, 'setTimeout', callback => {
        callbacks.push(callback);
        return callbacks.length;
    });
    context.mock.method(globalThis, 'clearTimeout', id => cleared.push(id));
    try {
        submitCapabilityEvalsAnswer(0.5, { style: {} });
        assert.equal(gameState.evalsBuilt.capability, true);
        submitCapabilityEvalsAnswer(0, { style: {} });
        assert.equal(gameState.capabilityEvalsCooldown, 0);
        assert.equal(callbacks.length, 1);
        disposeMinigame();
        resetSharedGameState();
        callbacks[0]();
        assert.equal(gameState.evalsBuilt.capability, false);
        assert.equal(gameState.currentPage, 'start');
        assert.equal(gameState.currentMinigame, null);
        assert.deepEqual(cleared, [1]);
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
        disposeMinigame();
    }
});

test('alignment has one animation loop and canceled frames cannot attach to a new game', context => {
    resetSharedGameState();
    gameState.currentPage = 'alignment-minigame';
    gameState.currentMinigame = { type: 'alignment-research', dotsData: { gameStarted: false } };
    const previous = {
        document: globalThis.document,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        cancelAnimationFrame: globalThis.cancelAnimationFrame
    };
    let renders = 0;
    const canvas = {
        width: 600,
        height: 400,
        getContext: () => ({
            fillRect: () => { renders++; },
            strokeRect: () => {},
            fillText: () => {}
        })
    };
    const callbacks = [];
    const canceled = [];
    globalThis.document = { getElementById: () => canvas };
    globalThis.requestAnimationFrame = callback => {
        callbacks.push(callback);
        return callbacks.length;
    };
    globalThis.cancelAnimationFrame = id => canceled.push(id);
    context.mock.method(console, 'log', () => {});
    try {
        updateAlignmentMinigame();
        updateAlignmentMinigame();
        assert.equal(callbacks.length, 1);
        const oldRenders = renders;
        disposeMinigame();
        gameState.currentMinigame = { type: 'alignment-research', dotsData: { gameStarted: false } };
        callbacks[0](200);
        assert.equal(renders, oldRenders);
        assert.equal(callbacks.length, 1);
        assert.deepEqual(canceled, [1]);
    } finally {
        disposeMinigame();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
});
