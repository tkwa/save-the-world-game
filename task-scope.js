// Delayed UI work belongs to one page/session. Canceling a scope also invalidates
// callbacks already queued by the browser, which clearing timer IDs alone cannot do.
export function createTaskScope(scheduler = globalThis) {
    let generation = 0;
    const timers = new Set();
    const frames = new Set();

    function timeout(callback, delay = 0) {
        const token = generation;
        const id = scheduler.setTimeout(() => {
            timers.delete(id);
            if (token === generation) callback();
        }, delay);
        timers.add(id);
        return id;
    }

    function frame(callback) {
        const token = generation;
        const id = scheduler.requestAnimationFrame(timestamp => {
            frames.delete(id);
            if (token === generation) callback(timestamp);
        });
        frames.add(id);
        return id;
    }

    function cancel() {
        generation++;
        for (const id of timers) scheduler.clearTimeout(id);
        for (const id of frames) scheduler.cancelAnimationFrame(id);
        timers.clear();
        frames.clear();
    }

    return {
        timeout,
        frame,
        cancel,
        token: () => generation,
        isCurrent: token => token === generation
    };
}
