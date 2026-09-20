import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeIntro, resetIntroState, introState } from '../opening.js';
import { gameState, resetSharedGameState } from '../utils.js';

test('resetting the opening cancels pending title updates and clears intro-only flags', context => {
    resetSharedGameState();
    resetIntroState();
    gameState.currentPage = 'intro';
    const title = { innerHTML: 'untouched' };
    const oldDocument = globalThis.document;
    globalThis.document = {
        querySelector: selector => selector === '#story-content h2' ? title : null,
        querySelectorAll: () => [],
        getElementById: () => null
    };
    const callbacks = [];
    const cleared = [];
    context.mock.method(console, 'log', () => {});
    context.mock.method(globalThis, 'setTimeout', callback => {
        callbacks.push(callback);
        return callbacks.length;
    });
    context.mock.method(globalThis, 'clearTimeout', id => cleared.push(id));
    try {
        initializeIntro();
        assert.ok(introState.companyName);
        assert.equal(callbacks.length, 1);
        introState.debugSpeedMode = true;
        resetIntroState();
        callbacks[0]();
        assert.deepEqual(cleared, [1]);
        assert.equal(title.innerHTML, 'untouched');
        assert.equal(introState.companyName, null);
        assert.equal(introState.selectedCompany, null);
        assert.equal(introState.buttonCooldown, false);
        assert.equal(introState.debugSpeedMode, false);
        assert.equal(introState.isNewGame, true);
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
        resetIntroState();
    }
});
