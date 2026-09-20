// A replayable random stream for campaign logic. This is not a cryptographic RNG.
// Keep the algorithm/version stable: saved campaigns depend on its exact sequence.
const ALGORITHM = 'mulberry32';
const VERSION = 1;
const UINT32_MAX = 0xffffffff;
const UINT32_RANGE = 0x100000000;
const INCREMENT = 0x6d2b79f5;

function isUint32(value) {
    return Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

function normalizeSeed(seed) {
    if (isUint32(seed)) return seed;
    if (typeof seed !== 'string' || seed.trim().length === 0) {
        throw new TypeError('A random seed must be a uint32 or a nonempty string.');
    }

    // FNV-1a over UTF-16 code units; deterministic without platform dependencies.
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193) >>> 0;
    }
    return hash;
}

function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
        || snapshot.algorithm !== ALGORITHM || snapshot.version !== VERSION
        || !isUint32(snapshot.seed) || !isUint32(snapshot.state)
        || !Number.isSafeInteger(snapshot.draws) || snapshot.draws < 0) {
        throw new TypeError('Invalid or unsupported random-state snapshot.');
    }
    return {
        seed: snapshot.seed,
        state: snapshot.state,
        draws: snapshot.draws
    };
}

/** An isolated stream for simulations, without consuming campaign randomness. */
export function createRandom(seed) {
    let originalSeed = normalizeSeed(seed);
    let state = originalSeed;
    let draws = 0;

    function random() {
        if (draws === Number.MAX_SAFE_INTEGER) {
            throw new RangeError('The random stream has exhausted its draw counter.');
        }
        state = (state + INCREMENT) >>> 0;
        draws++;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
    }

    function getState() {
        return { algorithm: ALGORITHM, version: VERSION, seed: originalSeed, state, draws };
    }

    function setState(snapshot) {
        // Validate everything before changing the stream; failed restores are atomic.
        const restored = validateSnapshot(snapshot);
        originalSeed = restored.seed;
        state = restored.state;
        draws = restored.draws;
    }

    return { random, getState, setState };
}

function initialSeed() {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    // Older runtimes without Web Crypto still work. Saves retain this seed, so
    // the clock is used only when creating a stream, never when replaying it.
    const monotonicTime = globalThis.performance?.now?.() ?? 0;
    return (Date.now() ^ Math.floor(monotonicTime * 1000)) >>> 0;
}

let campaignRandom = createRandom(initialSeed());

export function random() {
    return campaignRandom.random();
}

/** Begin a repeatable campaign stream. This does not reset other game state. */
export function setRandomSeed(seed) {
    const replacement = createRandom(seed);
    campaignRandom = replacement;
    return campaignRandom.getState();
}

export function getRandomState() {
    return campaignRandom.getState();
}

export function setRandomState(snapshot) {
    campaignRandom.setState(snapshot);
}
