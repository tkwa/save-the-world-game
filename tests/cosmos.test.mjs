import test from 'node:test';
import assert from 'node:assert/strict';
import {
    COLLECTOR_COUNT, AU_PER_LIGHT_YEAR, MAX_PROBE_SPEED_C, OBSERVABLE_RADIUS_LY,
    createCosmosGeometry, cosmosFrame, createIndustryModel, industryState,
    SOLAR_LUMINOSITY_WATTS, YEAR_SECONDS, ORBITAL_TIME_SCALE,
    collectorPosition, projectPoint, probePosition, canvasResolution
} from '../cosmos-math.js';
import { createCosmos } from '../cosmos.js';

const outcome = {
    kind: 'flourishing', year: 2031, dysonStartYear: 2031,
    dysonCompletionYears: 12, probeLaunchYear: 2040, flourishing: 86, humanControl: 82
};

test('geometry is deterministic, bounded, and independent of the campaign random stream', () => {
    const first = createCosmosGeometry();
    assert.deepEqual(first, createCosmosGeometry());
    assert.notDeepEqual(first.stars, createCosmosGeometry('different').stars);
    assert.equal(first.collectors.length, COLLECTOR_COUNT);
    assert.equal(first.stars.length, 42);
    assert.equal(first.galaxy.length, 6500);
    assert.equal(first.web.length, 4);
    assert.ok(first.web.every(layer => layer.samples.length < 6000));
    for (const collector of first.collectors) {
        assert.ok(collector.plane >= 0 && collector.plane < first.planes.length);
        assert.ok(collector.radius > 0 && collector.radius < 0.36);
        const position = collectorPosition(collector, first.planes[collector.plane], 0.37);
        assert.ok(position.every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(...position) - collector.radius) < 1e-12);
    }
});

test('construction, time, and logarithmic pullback are continuous and monotonic', () => {
    for (const years of [3.5, 12, 80]) {
        let previous = cosmosFrame(0, { ...outcome, dysonCompletionYears: years });
        for (let index = 1; index <= 1000; index++) {
            const frame = cosmosFrame(index / 1000, { ...outcome, dysonCompletionYears: years });
            assert.ok(frame.year >= previous.year);
            assert.ok(frame.builtFraction >= previous.builtFraction);
            assert.ok(frame.scale <= previous.scale * (1 + 1e-12));
            assert.ok(frame.scale > 0 && Number.isFinite(frame.scale));
            previous = frame;
        }
        const completed = cosmosFrame(0.32, { ...outcome, dysonCompletionYears: years });
        assert.equal(completed.builtFraction, 1);
        assert.equal(completed.elapsedYears, years);
        assert.equal(previous.phase, 'observable-universe');
    }
});

test('seeking is deterministic; construction duration varies without confusing welfare with industrial capacity', () => {
    assert.deepEqual(cosmosFrame(0.83, outcome), cosmosFrame(0.83, outcome));
    const fast = cosmosFrame(1, { ...outcome, dysonCompletionYears: 3.5 });
    const slow = cosmosFrame(1, { ...outcome, dysonCompletionYears: 80, flourishing: 20 });
    assert.ok(slow.duration > fast.duration);
    assert.equal(slow.expansion, fast.expansion);
    const alien = cosmosFrame(1, { ...outcome, kind: 'extinction' });
    assert.equal(alien.humanControl, 0, 'Extinction cannot retain a misleading human-controlled population');
    assert.equal(alien.kind, 'extinction');
    assert.equal(alien.builtFraction, 1);
    assert.equal(alien.expansion, fast.expansion, 'Human extinction does not imply machine extinction');
});

test('a probe starts at Sol, follows its destination ray, and cannot overshoot', () => {
    const star = createCosmosGeometry().stars[0];
    const before = cosmosFrame(0.48, outcome);
    const initial = probePosition(star, before);
    assert.equal(initial.launched, false);
    assert.deepEqual(initial.position.map(Math.abs), [0, 0, 0]);
    const future = { ...before, elapsedYears: 10000 };
    assert.deepEqual(probePosition(star, future).position, star.position);
    assert.equal(probePosition(star, future).arrived, true);
    const midway = probePosition(star, { ...before, elapsedYears: before.launchYears + star.launchDelay + 10 });
    assert.ok(midway.fraction > 0 && midway.fraction < 1);
    for (let axis = 0; axis < 3; axis++) assert.equal(midway.position[axis], star.position[axis] * midway.fraction);
});

test('all projected coordinates remain finite across the complete camera path', () => {
    const geometry = createCosmosGeometry();
    for (let step = 0; step <= 100; step++) {
        const frame = cosmosFrame(step / 100, outcome, 320, 220);
        for (const point of [[0, 0, 0], ...geometry.stars.map(star => star.position)]) {
            assert.ok(Object.values(projectPoint(point, frame)).every(Number.isFinite));
        }
    }
});

test('render resolution respects DPR and pixel limits, including very wide viewports', () => {
    assert.deepEqual(canvasResolution(400, 300, 1), { width: 400, height: 300, scale: 1 });
    for (const [width, height, dpr] of [[400, 300, 4], [1920, 1080, 3], [8000, 500, 2], [1, 1, 1]]) {
        const resolution = canvasResolution(width, height, dpr);
        assert.ok(resolution.width * resolution.height <= 1800000);
        assert.ok(resolution.width <= 2400 && resolution.height <= 2400);
        assert.ok(resolution.scale <= 2);
    }
});

function browserDouble({ reduced = false } = {}) {
    const frames = new Map();
    const listeners = new Map();
    const mediaListeners = new Map();
    let nextId = 0;
    let renders = 0;
    let disconnected = false;
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, {
        get(target, name) {
            if (name in target) return target[name];
            if (name === 'createRadialGradient' || name === 'createLinearGradient') return () => gradient;
            return (...args) => {
                for (const value of args) {
                    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(name)} received nonfinite coordinates`);
                }
                if (name === 'setTransform') renders++;
            };
        },
        set(target, name, value) { target[name] = value; return true; }
    });
    const document = {
        hidden: false,
        addEventListener(name, callback) { listeners.set(name, callback); },
        removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
        createElement() { return { width: 1, height: 1, getContext: () => ctx }; }
    };
    const view = {
        devicePixelRatio: 3,
        requestAnimationFrame(callback) { frames.set(++nextId, callback); return nextId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        ResizeObserver: class {
            constructor(callback) { this.callback = callback; }
            observe() {}
            disconnect() { disconnected = true; }
        },
        matchMedia() { return {
            matches: reduced,
            addEventListener(name, callback) { mediaListeners.set(name, callback); },
            removeEventListener(name, callback) { if (mediaListeners.get(name) === callback) mediaListeners.delete(name); }
        }; }
    };
    document.defaultView = view;
    const canvas = {
        width: 1, height: 1, ownerDocument: document,
        getContext: () => ctx,
        getBoundingClientRect: () => ({ width: 800, height: 480 })
    };
    return {
        canvas, document, frames, listeners, mediaListeners,
        get renders() { return renders; },
        get disconnected() { return disconnected; },
        frame(timestamp) {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(callback => callback(timestamp));
        }
    };
}

test('renderer starts paused, seeks immediately, plays without duplicate frames, and fully disposes', () => {
    const browser = browserDouble();
    const progress = [];
    const renderer = createCosmos(browser.canvas, { outcome, onProgress: value => progress.push(value) });
    assert.equal(browser.frames.size, 0);
    assert.equal(progress.at(-1), 0);
    renderer.seek(0.82);
    assert.equal(progress.at(-1), 0.82);
    renderer.play();
    renderer.play();
    assert.equal(browser.frames.size, 1);
    browser.frame(0);
    browser.frame(100);
    assert.ok(progress.at(-1) > 0.82);
    renderer.pause();
    assert.equal(browser.frames.size, 0);
    const paused = progress.at(-1);
    browser.frame(10000);
    assert.equal(progress.at(-1), paused);
    renderer.play();
    renderer.dispose();
    const renders = browser.renders;
    renderer.dispose();
    renderer.seek(0);
    renderer.play();
    browser.frame(20000);
    assert.equal(browser.renders, renders);
    assert.equal(browser.frames.size, 0);
    assert.equal(browser.listeners.size, 0);
    assert.equal(browser.mediaListeners.size, 0);
    assert.equal(browser.disconnected, true);
});

test('visibility changes pause the scene and do not automatically restart it', () => {
    const browser = browserDouble();
    const renderer = createCosmos(browser.canvas, { outcome });
    renderer.play();
    browser.document.hidden = true;
    browser.listeners.get('visibilitychange')();
    assert.equal(browser.frames.size, 0);
    browser.document.hidden = false;
    browser.listeners.get('visibilitychange')();
    assert.equal(browser.frames.size, 0);
    renderer.dispose();
});

test('reduced-motion playback reveals a still without scheduling motion', () => {
    const browser = browserDouble({ reduced: true });
    let last;
    const renderer = createCosmos(browser.canvas, { outcome, onProgress: (value, metadata) => { last = { value, metadata }; } });
    renderer.play();
    assert.equal(last.value, 1);
    assert.equal(last.metadata.playing, false);
    assert.equal(browser.frames.size, 0);
    renderer.seek(0.35);
    assert.equal(last.value, 0.35);
    assert.equal(browser.frames.size, 0);
    renderer.dispose();
});


test('large-scale camera movement does not advance civilization time or colonize the visible volume', () => {
    const frozen = cosmosFrame(0.67, outcome);
    for (let step = 67; step <= 100; step++) {
        const frame = cosmosFrame(step / 100, outcome);
        assert.equal(frame.timeHeld, true);
        assert.equal(frame.year, frozen.year);
        assert.equal(frame.elapsedYears, frozen.elapsedYears);
        assert.equal(frame.maxProbeReachLightYears, 150 * MAX_PROBE_SPEED_C);
    }
    const galaxy = cosmosFrame(0.79, outcome);
    const universe = cosmosFrame(1, outcome);
    assert.ok(galaxy.viewSpanLightYears >= 100000);
    assert.ok(universe.viewSpanLightYears > OBSERVABLE_RADIUS_LY * 2);
    assert.ok(universe.viewSpanLightYears / galaxy.viewSpanLightYears > 500000);
    assert.ok(universe.maxProbeReachLightYears * AU_PER_LIGHT_YEAR * universe.scale < 1);
    assert.equal(universe.scaleLabel, '120 billion ly');
});

test('physical probe motion always stays sublight and within the reported upper bound', () => {
    const geometry = createCosmosGeometry();
    for (let step = 48; step <= 100; step++) {
        const frame = cosmosFrame(step / 100, outcome);
        for (const star of geometry.stars) {
            assert.ok(star.speed > 0 && star.speed <= MAX_PROBE_SPEED_C);
            const probe = probePosition(star, frame);
            assert.ok(Math.hypot(...probe.position) / AU_PER_LIGHT_YEAR <= frame.maxProbeReachLightYears + 1e-9);
        }
    }
});

test('production rendering exercises every phase and reports scale and held time', () => {
    const browser = browserDouble();
    let metadata;
    const renderer = createCosmos(browser.canvas, { outcome, onProgress: (_, value) => { metadata = value; } });
    const phases = new Set();
    for (let step = 0; step <= 100; step++) {
        renderer.seek(step / 100);
        phases.add(metadata.phase);
        assert.ok(Number.isFinite(metadata.viewSpanLightYears));
        assert.ok(Number.isFinite(metadata.maxProbeReachLightYears));
        assert.ok(metadata.scaleLabel.length > 0);
    }
    assert.deepEqual([...phases], ['construction', 'solar-system', 'interstellar', 'galaxy', 'local-group', 'observable-universe']);
    assert.equal(metadata.timeHeld, true);
    assert.equal(metadata.schematic, true);
    renderer.dispose();
});


test('manufacturing begins with finite seed industry and nanotechnology gates the faster regime', () => {
    const model = createIndustryModel({ ...outcome, nanotechYear: 2033 });
    const initial = industryState(model, 0);
    const before = industryState(model, 1.999);
    const mature = industryState(model, 2);
    assert.equal(initial.massKg, model.assumptions.seedIndustrialMassKg);
    assert.ok(initial.coverage < 1e-12, 'Seed industry is not a pre-existing large fraction of a swarm');
    assert.equal(before.nanotechMature, false);
    assert.equal(mature.nanotechMature, true);
    assert.ok(mature.processingKgPerSecond > before.processingKgPerSecond);
    assert.ok(Math.abs(mature.massKg / initial.massKg - 2) < 1e-12);
    const otherDeadline = createIndustryModel({ ...outcome, dysonCompletionYears: 3.5, nanotechYear: 2033 });
    assert.equal(industryState(otherDeadline, 1).massKg, industryState(model, 1).massKg,
        'An ambitious deadline cannot cause nanotech growth before nanotechnology arrives');
});

test('all supported default deadlines conserve mass and respect instantaneous energy and logistics budgets', () => {
    for (const years of [3.5, 12, 80]) {
        for (const nanoDelay of [0, 1, 2]) {
            const model = createIndustryModel({ ...outcome, dysonCompletionYears: years, nanotechYear: 2031 + nanoDelay });
            assert.equal(model.feasibleByDeadline, true);
            assert.ok(model.requiredDoublingDays >= model.assumptions.minimumDoublingDays);
            let previousMass = 0;
            for (let step = 0; step <= 500; step++) {
                const state = industryState(model, years * step / 500);
                assert.ok(state.massKg >= previousMass);
                assert.ok(state.massKg <= model.assumptions.usableMaterialKg);
                assert.ok(Math.abs((state.massKg + state.materialRemainingKg) / model.assumptions.usableMaterialKg - 1) < 1e-12);
                assert.ok(state.manufacturingPowerUsedWatts <= state.manufacturingPowerBudgetWatts * (1 + 1e-12));
                assert.ok(state.processingKgPerSecond <= model.assumptions.maxProcessingKgPerSecond);
                assert.ok(state.interceptedPowerWatts <= SOLAR_LUMINOSITY_WATTS);
                assert.ok(state.coverage >= 0 && state.coverage <= 0.9);
                previousMass = state.massKg;
            }
            assert.equal(industryState(model, years).complete, true);
            assert.equal(industryState(model, years + 200).massKg, model.targetMassKg);
        }
    }
});

test('energy, material, and throughput shortages stay unfinished rather than forcing the scenario date', () => {
    for (const overrides of [
        { usableMaterialKg: 1e10 },
        { energyJoulesPerKg: 1e18 },
        { maxProcessingKgPerSecond: 1 },
        { industrialEnergyShare: 0 },
        { radiatorKelvin: 10 }
    ]) {
        const model = createIndustryModel(outcome, overrides);
        const state = industryState(model, model.completionYears);
        assert.equal(model.feasibleByDeadline, false);
        assert.equal(state.complete, false);
        assert.ok(state.massFraction < 1);
        assert.ok(state.manufacturingPowerUsedWatts <= state.manufacturingPowerBudgetWatts * (1 + 1e-12));
        assert.ok(state.massKg <= model.massCeilingKg);
        for (const value of Object.values(state)) {
            if (typeof value === 'number') assert.ok(Number.isFinite(value));
        }
    }
    const lateNanotech = createIndustryModel({ ...outcome, nanotechYear: 2043 });
    assert.equal(lateNanotech.feasibleByDeadline, false);
    assert.equal(industryState(lateNanotech, 12).complete, false);
});

test('an energy-limited interval obeys its integrated work budget', () => {
    const model = createIndustryModel(outcome, { energyJoulesPerKg: 1e18 });
    const before = industryState(model, 2);
    const dt = 0.01;
    const after = industryState(model, 2 + dt);
    const usedEnergy = (after.massKg - before.massKg) * model.assumptions.energyJoulesPerKg;
    const trapezoidEnergy = (before.manufacturingPowerBudgetWatts + after.manufacturingPowerBudgetWatts) / 2 * dt * YEAR_SECONDS;
    assert.ok(usedEnergy <= trapezoidEnergy * (1 + 1e-8));
    assert.equal(before.limitingFactor, 'energy');
});

test('orbital positions obey relative Kepler periods with an explicit cinematic time scale', () => {
    const geometry = createCosmosGeometry();
    for (const collector of geometry.collectors.slice(0, 10)) {
        const plane = geometry.planes[collector.plane];
        const first = collectorPosition(collector, plane, 0);
        const orbit = collector.radius ** 1.5 / ORBITAL_TIME_SCALE;
        const next = collectorPosition(collector, plane, orbit);
        for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(first[axis] - next[axis]) < 1e-12);
    }
});
