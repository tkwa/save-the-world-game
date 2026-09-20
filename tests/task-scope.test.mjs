import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskScope } from '../task-scope.js';

function fakeScheduler() {
    let nextId = 1;
    const pending = new Map();
    const cleared = [];
    return {
        pending,
        cleared,
        setTimeout(callback, delay) {
            const id = nextId++;
            pending.set(id, { callback, delay, type: 'timeout' });
            return id;
        },
        clearTimeout(id) { cleared.push(id); },
        requestAnimationFrame(callback) {
            const id = nextId++;
            pending.set(id, { callback, type: 'frame' });
            return id;
        },
        cancelAnimationFrame(id) { cleared.push(id); }
    };
}

test('cancel clears owned timeouts and frames and rejects callbacks already queued', () => {
    const scheduler = fakeScheduler();
    const tasks = createTaskScope(scheduler);
    const token = tasks.token();
    let calls = 0;
    const timerId = tasks.timeout(() => calls++, 500);
    const frameId = tasks.frame(() => calls++);
    tasks.cancel();
    assert.deepEqual(scheduler.cleared, [timerId, frameId]);
    assert.equal(tasks.isCurrent(token), false);
    scheduler.pending.get(timerId).callback();
    scheduler.pending.get(frameId).callback(100);
    assert.equal(calls, 0);
});

test('a canceled scope can be reused without reviving an earlier session', () => {
    const scheduler = fakeScheduler();
    const tasks = createTaskScope(scheduler);
    let obsoleteCalls = 0;
    const oldId = tasks.timeout(() => obsoleteCalls++);
    tasks.cancel();
    const newToken = tasks.token();
    const timestamps = [];
    const newId = tasks.frame(timestamp => timestamps.push(timestamp));
    scheduler.pending.get(oldId).callback();
    scheduler.pending.get(newId).callback(123.5);
    assert.equal(obsoleteCalls, 0);
    assert.deepEqual(timestamps, [123.5]);
    assert.equal(tasks.isCurrent(newToken), true);
    tasks.cancel();
    assert.deepEqual(scheduler.cleared, [oldId]);
});

test('completed callbacks are removed and repeated cancellation is safe', () => {
    const scheduler = fakeScheduler();
    const tasks = createTaskScope(scheduler);
    const id = tasks.timeout(() => {});
    scheduler.pending.get(id).callback();
    tasks.cancel();
    tasks.cancel();
    assert.deepEqual(scheduler.cleared, []);
});
