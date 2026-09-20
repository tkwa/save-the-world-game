import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    eventWeight,
    getChoiceCosts,
    canPayChoiceCosts,
    payChoiceCosts,
    validateEventData,
    createFallbackEventData,
    createEventDataLoader,
    selectEventTemplate,
    createEventInstance
} from '../event-selection.js';
import { applyChoiceEffects, generateEvent, invalidateEventGeneration } from '../events.js';
import { createInitialGameState, gameState } from '../utils.js';
import { getRandomState } from '../random.js';

const catalog = JSON.parse(await readFile(new URL('../events.json', import.meta.url), 'utf8'));
const template = (type, weight) => ({ type, weight, title: `Title: ${type}`, text_versions: [`Text: ${type}`] });

test('weights preserve explicit zero and reject malformed numeric values', () => {
    assert.equal(eventWeight({}), 1);
    assert.equal(eventWeight({ weight: 0 }), 0);
    assert.equal(eventWeight({ weight: 0.25 }), 0.25);
    for (const weight of [-1, Infinity, -Infinity, NaN, null, true, '3']) {
        assert.equal(eventWeight({ weight }), 0);
    }
    assert.equal(eventWeight(null), 0);
});

test('weighted selection excludes disabled entries, including at a zero random draw', () => {
    const disabled = template('disabled', 0);
    const first = template('first', 1);
    const second = template('second', 3);
    const pool = [disabled, first, disabled, second];
    assert.equal(selectEventTemplate(pool, () => 0), first);
    assert.equal(selectEventTemplate(pool, () => 0.249999), first);
    assert.equal(selectEventTemplate(pool, () => 0.25), second);
    assert.equal(selectEventTemplate(pool, () => 0.999999), second);
});

test('empty, disabled, and malformed pools use a playable routine fallback', () => {
    for (const pool of [[], null, [template('disabled', 0)], [template('bad', -1)],
        [{ type: 'missing-text', weight: 1 }]]) {
        const selected = selectEventTemplate(pool, () => 0);
        assert.equal(selected, null);
        const fallback = createEventInstance(selected);
        assert.equal(fallback.type, 'nothing');
        assert.equal(fallback.title, 'Routine Progress');
        assert.equal(typeof fallback.text, 'string');
        assert.equal(fallback.choices, null);
    }
});

test('finite weights do not overflow the selection total', () => {
    const first = template('first', Number.MAX_VALUE);
    const second = template('second', Number.MAX_VALUE);
    assert.equal(selectEventTemplate([first, second], () => 0.25), first);
    assert.equal(selectEventTemplate([first, second], () => 0.75), second);
});

test('selection preserves a chosen title, handler, choices, and original template', () => {
    const selected = {
        ...template('selected', 1),
        customHandler: 'handleSelected',
        choices: [{ text: 'Continue', action: 'accept' }, { text: 'Hidden', action: 'decline' }],
        text_versions: ['First text', 'Second text']
    };
    const instance = createEventInstance(selected, {
        random: () => 0.75,
        transformText: (text, type) => `${type}: ${text}`,
        filterChoices: choices => choices.filter(choice => choice.action === 'accept')
    });
    assert.equal(instance.title, 'Title: selected');
    assert.equal(instance.text, 'selected: Second text');
    assert.equal(instance.customHandler, 'handleSelected');
    assert.equal(instance.originalEventData, selected);
    assert.deepEqual(instance.choices, [selected.choices[0]]);
    assert.equal(selected.choices.length, 2);
});

test('the shipped catalog and fallback both satisfy the runtime data contract', () => {
    assert.equal(validateEventData(catalog), true);
    assert.equal(validateEventData(createFallbackEventData()), true);
    assert.equal(validateEventData({ ...catalog, defaultEvents: [] }), true);
});

test('runtime data validation rejects missing shapes and unsafe choice costs', () => {
    for (const value of [null, [], {}, { ...catalog, specialEvents: {} },
        { ...catalog, safetyIncidents: ['old malformed fallback'] },
        { ...catalog, defaultEvents: {} }]) {
        assert.equal(validateEventData(value), false);
    }
    for (const invalidEvent of [
        { ...template('bad', 1), text_versions: [] },
        { ...template('bad', 1), text_versions: [null] },
        { ...template('bad', 1), choices: [{ action: 'accept' }] },
        { ...template('bad', 1), choices: [{ text: 'Buy', action: 'accept', cost: { money: -3 } }] },
        { ...template('bad', 1), requires: 'not-an-array' },
        template('bad', Infinity)
    ]) {
        assert.equal(validateEventData({ ...catalog, defaultEvents: [invalidEvent] }), false);
    }
});

test('failed HTTP loads return usable data and retry, then cache the successful catalog', async () => {
    let calls = 0;
    let warnings = 0;
    const load = createEventDataLoader(async url => {
        assert.equal(url, 'events.json');
        calls++;
        if (calls === 1) return { ok: false, status: 503, json: () => assert.fail('must check HTTP first') };
        return { ok: true, json: async () => catalog };
    }, () => warnings++);
    const fallback = await load();
    assert.equal(validateEventData(fallback), true);
    assert.equal(fallback.defaultEvents[0].type, 'nothing');
    assert.equal(await load(), catalog);
    assert.equal(await load(), catalog);
    assert.equal(calls, 2);
    assert.equal(warnings, 1);
});

test('network failures, malformed JSON, and malformed shapes all recover on a later load', async () => {
    for (const fail of [
        async () => { throw new Error('network unavailable'); },
        async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } }),
        async () => ({ ok: true, json: async () => ({ defaultEvents: [] }) })
    ]) {
        let calls = 0;
        const load = createEventDataLoader(async () => ++calls === 1 ? fail() :
            { ok: true, json: async () => catalog });
        assert.equal(validateEventData(await load()), true);
        assert.equal(await load(), catalog);
        assert.equal(calls, 2);
    }
    const unavailableFetch = createEventDataLoader(undefined);
    assert.equal(validateEventData(await unavailableFetch()), true);
});

test('concurrent event loads share one pending request', async () => {
    let calls = 0;
    let release;
    const request = new Promise(resolve => { release = resolve; });
    const load = createEventDataLoader(() => { calls++; return request; });
    const first = load();
    const second = load();
    await Promise.resolve();
    assert.equal(calls, 1);
    release({ ok: true, json: async () => catalog });
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a, catalog);
    assert.equal(b, catalog);
});

test('reset discards runtime catalog additions without refetching every turn', async () => {
    let calls = 0;
    const load = createEventDataLoader(async () => {
        calls++;
        return { ok: true, json: async () => structuredClone(catalog) };
    });
    const first = await load();
    first.defaultEvents.push(template('runtime-investigation', 1));
    assert.equal(await load(), first);
    assert.equal(calls, 1);
    load.reset();
    const next = await load();
    assert.notEqual(next, first);
    assert.equal(next.defaultEvents.some(event => event.type === 'runtime-investigation'), false);
    assert.equal(await load(), next);
    assert.equal(calls, 2);
});

test('a stale response cannot refill the cache or detach a new pending load after reset', async () => {
    const releases = [];
    const load = createEventDataLoader(() => new Promise(resolve => releases.push(resolve)));
    const oldRequest = load();
    await Promise.resolve();
    load.reset();
    const newRequest = load();
    await Promise.resolve();
    const oldCatalog = createFallbackEventData();
    releases[0]({ ok: true, json: async () => oldCatalog });
    assert.equal(await oldRequest, oldCatalog);
    const concurrentNewRequest = load();
    await Promise.resolve();
    assert.equal(releases.length, 2);
    releases[1]({ ok: true, json: async () => catalog });
    assert.equal(await newRequest, catalog);
    assert.equal(await concurrentNewRequest, catalog);
    assert.equal(await load(), catalog);
});

test('custom-action costs are charged by the real common effects path', () => {
    Object.assign(gameState, createInitialGameState());
    gameState.money = 10;
    const event = catalog.defaultEvents.find(event => event.type === 'competitor-warning-shot');
    const choice = event.choices.find(choice => choice.action === 'accelerate-development');
    assert.deepEqual(getChoiceCosts(choice), { money: 3 });
    applyChoiceEffects(choice);
    assert.equal(gameState.money, 7);
});

test('normal effects debit once, and unaffordable choices do not debit or grant benefits', () => {
    Object.assign(gameState, createInitialGameState());
    gameState.money = 10;
    const choice = { action: 'accept', cost: { money: 3 }, benefit: { incomeBonus: 2 } };
    const incomeBefore = gameState.incomeBonus || 0;
    applyChoiceEffects(choice);
    assert.equal(gameState.money, 7);
    assert.equal(gameState.incomeBonus, incomeBefore + 2);
    gameState.money = 2;
    applyChoiceEffects(choice);
    assert.equal(gameState.money, 2);
    assert.equal(gameState.incomeBonus, incomeBefore + 2);
});

test('payment is atomic with unavailable resources, including safety points', () => {
    const state = { money: 10, diplomacyPoints: 1, safetyPoints: 4 };
    const choice = { action: 'custom', cost: { money: 3, diplomacyPoints: 2 } };
    assert.equal(canPayChoiceCosts(state, choice), false);
    assert.equal(payChoiceCosts(state, choice), false);
    assert.deepEqual(state, { money: 10, diplomacyPoints: 1, safetyPoints: 4 });
    assert.equal(payChoiceCosts(state, { cost: { safetyPoints: 4 } }), true);
    assert.equal(state.safetyPoints, 0);
    assert.equal(payChoiceCosts(state, { cost: { productPoints: 1 } }), false);
    assert.equal(payChoiceCosts(state, { cost: { productPoints: 0 } }), true);
    assert.equal(state.productPoints, undefined);
});

test('dynamic sanctions costs replace estimates and are charged only by common effects', () => {
    Object.assign(gameState, createInitialGameState());
    gameState.money = 100;
    gameState.diplomacyPoints = 100;
    const choice = {
        action: 'accept',
        cost: { money: 10 },
        precalculatedCosts: { money: 20, diplomacy: 15 }
    };
    assert.deepEqual(getChoiceCosts(choice), { money: 20, diplomacyPoints: 15 });
    applyChoiceEffects(choice);
    assert.equal(gameState.money, 80);
    assert.equal(gameState.diplomacyPoints, 85);
});

test('invalid costs fail closed without mutation or negative-resource exploits', () => {
    for (const cost of [null, [], { money: -1 }, { money: Infinity }, { money: NaN },
        { money: '3' }, { unknownResource: 1 }]) {
        const state = { money: 10 };
        assert.equal(getChoiceCosts({ cost }), null);
        assert.equal(payChoiceCosts(state, { cost }), false);
        assert.deepEqual(state, { money: 10 });
    }
    assert.equal(canPayChoiceCosts({}, { precalculatedCosts: { money: -1 } }), false);
});

test('a reset during event loading cancels the old campaign before effects or random draws', async () => {
    const originalFetch = globalThis.fetch;
    let release;
    const response = new Promise(resolve => { release = resolve; });
    globalThis.fetch = () => response;
    try {
        Object.assign(gameState, createInitialGameState());
        const request = generateEvent();
        await Promise.resolve();
        invalidateEventGeneration();
        Object.assign(gameState, createInitialGameState());
        const randomBefore = getRandomState();
        release({ ok: true, json: async () => catalog });
        assert.equal(await request, null);
        assert.deepEqual(gameState.eventsSeen, {});
        assert.equal(gameState.eventAppearanceCounts.size, 0);
        assert.equal(gameState.safetyIncidentCount, 0);
        assert.deepEqual(getRandomState(), randomBefore);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
