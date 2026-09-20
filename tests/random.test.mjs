import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../random.js';

const draw = (stream, count) => Array.from({ length: count }, () => stream.random());

test('the saved Mulberry32 algorithm keeps its published sequence', () => {
    assert.deepEqual(draw(createRandom(1), 6), [
        0.6270739405881613,
        0.002735721180215478,
        0.5274470399599522,
        0.9810509674716741,
        0.9683778982143849,
        0.281103502959013
    ]);
});

test('equal numeric and text seeds reproduce independent streams', () => {
    for (const seed of [0, 0xffffffff, 1984, 'shared campaign', '🌍']) {
        const first = createRandom(seed);
        const second = createRandom(seed);
        const values = draw(first, 500);
        assert.deepEqual(draw(second, 500), values);
        assert.ok(values.every(value => value >= 0 && value < 1 && Number.isFinite(value)));
    }
    assert.notDeepEqual(draw(createRandom('campaign-a'), 10), draw(createRandom('campaign-b'), 10));
});

test('JSON snapshots resume a stream exactly, including after multiple restores', () => {
    const source = createRandom('save file');
    draw(source, 31);
    const snapshot = JSON.parse(JSON.stringify(source.getState()));
    const expected = draw(source, 500);
    const resumed = createRandom(0);
    resumed.setState(snapshot);
    assert.deepEqual(draw(resumed, 500), expected);
    source.setState(snapshot);
    assert.deepEqual(draw(source, 500), expected);
    assert.equal(source.getState().draws, 531);
});

test('snapshots and restored state do not alias callers objects', () => {
    const stream = createRandom(88);
    const snapshot = stream.getState();
    snapshot.state = 0;
    assert.equal(stream.getState().state, 88);
    const saved = stream.getState();
    stream.setState(saved);
    saved.state = 0;
    assert.equal(stream.getState().state, 88);
});

test('bad seeds and malformed snapshots fail without changing the stream', () => {
    for (const seed of [undefined, null, {}, [], '', '  ', -1, 0x100000000, 1.5, NaN, Infinity]) {
        assert.throws(() => createRandom(seed), TypeError);
    }
    const stream = createRandom(42);
    draw(stream, 3);
    const before = stream.getState();
    const malformed = [
        undefined, null, {}, [], '42',
        { ...before, algorithm: 'unknown' },
        { ...before, version: 2 },
        { ...before, seed: -1 },
        { ...before, seed: '42' },
        { ...before, state: NaN },
        { ...before, state: 0x100000000 },
        { ...before, state: 1.25 },
        { ...before, draws: -1 },
        { ...before, draws: 1.5 },
        { ...before, draws: Number.MAX_SAFE_INTEGER + 1 }
    ];
    for (const snapshot of malformed) {
        assert.throws(() => stream.setState(snapshot), TypeError);
        assert.deepEqual(stream.getState(), before);
    }
});
