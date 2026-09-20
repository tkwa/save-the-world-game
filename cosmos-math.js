// Geometry and camera state are independent of the campaign's random stream.
export const AU_PER_LIGHT_YEAR = 63241.077;
export const COLLECTOR_COUNT = 2048;
export const COSMOS_SEED = 'critical-path-cosmos-v2';
// Approximate astronomical scales, retained separately from the scenario's
// speculative industrial/propulsion assumptions:
// https://www.nasa.gov/science-research/astrophysics/how-big-is-space-we-asked-a-nasa-expert-episode-61/
// https://science.nasa.gov/learn/basics-of-space-flight/chapter1-1/
// The final 92-billion-ly diameter is present-day physical extent, not light
// travel time, a future reach claim, or a literal boundary of the whole universe.
export const SOLAR_RADIUS_AU = 0.00465047;
export const MILKY_WAY_RADIUS_LY = 50000;
export const SUN_GALACTIC_RADIUS_LY = 26000;
export const OBSERVABLE_RADIUS_LY = 46e9;
export const MAX_PROBE_SPEED_C = 0.27;
export const AU_METERS = 149597870700;
export const YEAR_SECONDS = 365.25 * 86400;
export const SOLAR_LUMINOSITY_WATTS = 3.828e26;
export const MERCURY_MASS_KG = 3.3010e23;
export const STEFAN_BOLTZMANN = 5.670374419e-8;
export const ORBITAL_TIME_SCALE = 0.02;

// Astronomical/physical constants, not manufacturing forecasts:
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/fact_notes.html
// https://physics.nist.gov/cgi-bin/cuu/Value?sigma
// Every value below is an explicit speculative engineering assumption. They
// define an optimistic consistency envelope, not a validated Dyson design.
export const INDUSTRY_ASSUMPTIONS = Object.freeze({
    effectiveRadiusAU: 0.25,
    targetCoverage: 0.9,
    collectorKgPerSquareMeter: 0.005, // Thin collector plus its share of radiators.
    collectorMassFraction: 0.8, // Remaining 20%: extraction, factories, transport.
    seedIndustrialMassKg: 1e6, // Assumed 1,000 t seed industry at the ASI date.
    usableMaterialKg: 1e21, // In-situ stock; about 0.3% of Mercury's mass.
    energyJoulesPerKg: 1e9, // Lumped refining, fabrication and orbital logistics.
    conversionEfficiency: 0.2,
    industrialEnergyShare: 0.2,
    radiatorAreaPerCollectorArea: 2,
    radiatorEmissivity: 0.9,
    radiatorKelvin: 750,
    preNanotechDoublingDays: 730.5,
    minimumDoublingDays: 7, // Best assumed post-nanotech factory replication.
    maxProcessingKgPerSecond: 1e13 // Mining/logistics ceiling, never unlimited.
});

const TAU = Math.PI * 2;

export function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function smoothstep(start, end, value) {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
}

function seeded(seed) {
    let value = 2166136261;
    for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0;
    return () => {
        let next = value += 0x6D2B79F5;
        next = Math.imul(next ^ next >>> 15, next | 1);
        next ^= next + Math.imul(next ^ next >>> 7, next | 61);
        return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
}

export function createCosmosGeometry(seed = COSMOS_SEED) {
    const random = seeded(seed);
    const planes = Array.from({ length: 16 }, (_, index) => {
        const yaw = random() * TAU;
        const inclination = (random() - 0.5) * 2.35;
        return {
            radius: 0.155 + index / 15 * 0.185,
            u: [Math.cos(yaw), Math.sin(yaw), 0],
            v: [-Math.sin(yaw) * Math.cos(inclination), Math.cos(yaw) * Math.cos(inclination), Math.sin(inclination)],
            phase: random() * TAU,
            rate: 0.6 + random() * 0.6
        };
    });
    const collectors = Array.from({ length: COLLECTOR_COUNT }, (_, index) => {
        const plane = planes[index % planes.length];
        return {
            plane: index % planes.length,
            radius: plane.radius * (0.985 + random() * 0.03),
            phase: Math.floor(index / planes.length) / 128 * TAU + plane.phase,
            birth: random(),
            reflectance: random(),
            size: 0.75 + random() * 0.65
        };
    }).sort((a, b) => a.birth - b.birth);
    const stars = Array.from({ length: 42 }, (_, index) => {
        const angle = index * 2.399963229728653 + (random() - 0.5) * 0.65;
        const distance = 4 + Math.sqrt((index + 0.8) / 42) * 23;
        const vertical = (random() - 0.5) * 9;
        return {
            id: index,
            position: [Math.cos(angle) * distance * AU_PER_LIGHT_YEAR,
                Math.sin(angle) * distance * AU_PER_LIGHT_YEAR, vertical * AU_PER_LIGHT_YEAR],
            luminosity: 0.55 + random() * 1.4,
            temperature: random(),
            speed: 0.15 + random() * (MAX_PROBE_SPEED_C - 0.15),
            launchDelay: index * 0.4 + random() * 3,
            human: random()
        };
    });
    const background = Array.from({ length: 1300 }, () => ({
        x: random(), y: random(), size: 0.25 + random() ** 5 * 1.45,
        alpha: 0.12 + random() ** 2 * 0.75, warmth: random()
    }));
    const dust = Array.from({ length: 1200 }, () => ({
        x: random(), offset: (random() + random() + random() - 1.5) * 0.23,
        size: 0.25 + random() * 0.8, alpha: 0.025 + random() * 0.11
    }));
    // Representative spiral-disk samples, not a catalog of individual stars.
    // Physical radii follow NASA's approximate 100,000 ly Milky Way diameter;
    // Sol remains 26,000 ly from its center throughout the camera pullback.
    const galaxy = Array.from({ length: 6500 }, (_, index) => {
        const bulge = index < 1400;
        const radius = bulge ? random() ** 1.8 * 11000 : Math.sqrt(random()) * MILKY_WAY_RADIUS_LY;
        const arm = index % 4;
        const angle = bulge ? random() * TAU : arm / 4 * TAU + radius / 12500 + (random() + random() - 1) * 0.48;
        const z = (random() + random() - 1) * (bulge ? 3800 : 550);
        return {
            position: [(Math.cos(angle) * radius - SUN_GALACTIC_RADIUS_LY) * AU_PER_LIGHT_YEAR,
                Math.sin(angle) * radius * AU_PER_LIGHT_YEAR, z * AU_PER_LIGHT_YEAR],
            tone: bulge ? 0 : random() > 0.72 ? 2 : 1,
            brightness: 0.25 + random() * 0.75,
            size: 0.4 + random() * 0.85
        };
    });
    const localGalaxies = [
        { name: 'Andromeda', position: [2.2e6, 1.1e6, 0.45e6].map(v => v * AU_PER_LIGHT_YEAR), radius: 76000, tilt: 0.34 },
        { name: 'Triangulum', position: [2.05e6, -1.65e6, 0.5e6].map(v => v * AU_PER_LIGHT_YEAR), radius: 30000, tilt: 0.58 }
    ];
    // Crossfaded volumes show structure over many orders of magnitude. Each
    // sample is a galaxy/group, never an individual star or settled system.
    const web = [12e6, 250e6, 5e9, 92e9].map(span => {
        const nodes = Array.from({ length: 74 }, () => {
            const angle = random() * TAU;
            const z = random() * 2 - 1;
            const radius = Math.cbrt(random()) * span * 0.47;
            return [Math.cos(angle) * Math.sqrt(1 - z * z) * radius,
                Math.sin(angle) * Math.sqrt(1 - z * z) * radius, z * radius];
        });
        const samples = [];
        nodes.forEach((node, index) => {
            const nearest = nodes.map((target, targetIndex) => ({ target, targetIndex,
                distance: Math.hypot(...node.map((value, axis) => value - target[axis])) }))
                .filter(entry => entry.targetIndex !== index).sort((a, b) => a.distance - b.distance).slice(0, 3);
            for (const { target, targetIndex } of nearest) {
                if (targetIndex < index) continue;
                for (let point = 0; point < 27; point++) {
                    const t = point / 26;
                    const spread = span * (0.002 + Math.sin(t * Math.PI) * 0.004);
                    const position = node.map((value, axis) =>
                        (value + (target[axis] - value) * t + (random() + random() - 1) * spread) * AU_PER_LIGHT_YEAR);
                    if (Math.hypot(...position) / AU_PER_LIGHT_YEAR > span * 0.5) continue;
                    samples.push({ position, brightness: 0.15 + random() * 0.85, size: 0.3 + random() * 0.85 });
                }
            }
        });
        return { span, samples };
    });
    return { planes, collectors, stars, background, dust, galaxy, localGalaxies, web };
}

function boundedAssumptions(overrides = {}) {
    const ranges = {
        effectiveRadiusAU: [0.1, 5], targetCoverage: [0.01, 0.95],
        collectorKgPerSquareMeter: [0.001, 100], collectorMassFraction: [0.05, 0.95],
        seedIndustrialMassKg: [1, 1e12], usableMaterialKg: [1, 1e26],
        energyJoulesPerKg: [1e6, 1e18], conversionEfficiency: [0.001, 0.8],
        industrialEnergyShare: [0, 1], radiatorAreaPerCollectorArea: [0.01, 100],
        radiatorEmissivity: [0.01, 1], radiatorKelvin: [10, 3000],
        preNanotechDoublingDays: [30, 100000], minimumDoublingDays: [1, 10000],
        maxProcessingKgPerSecond: [0, 1e20]
    };
    return Object.fromEntries(Object.entries(INDUSTRY_ASSUMPTIONS).map(([key, fallback]) => {
        const value = Number(overrides?.[key]);
        return [key, clamp(Number.isFinite(value) ? value : fallback, ...ranges[key])];
    }));
}

// Exact solution to dM/dt = min(g M, throughput), with a finite material stock.
// Energy and radiator limits enter g. Units here are seconds and kilograms.
function growIndustry(mass, seconds, rate, throughput, ceiling) {
    if (seconds <= 0 || rate <= 0 || throughput <= 0) return Math.min(mass, ceiling);
    const crossover = throughput / rate;
    const exponentialSeconds = Math.max(0, Math.log(Math.max(mass, crossover) / mass) / rate);
    const early = mass * Math.exp(Math.min(700, rate * Math.min(seconds, exponentialSeconds)));
    return Math.min(ceiling, early + throughput * Math.max(0, seconds - exponentialSeconds));
}

function timeToMass(initial, target, rate, throughput) {
    if (target <= initial) return 0;
    if (rate <= 0 || throughput <= 0) return Infinity;
    const crossover = throughput / rate;
    const exponentialTarget = Math.max(initial, Math.min(target, crossover));
    return Math.log(exponentialTarget / initial) / rate + Math.max(0, target - Math.max(initial, crossover)) / throughput;
}

/**
 * An inverse scenario: find the manufacturing rate needed for the campaign's
 * completion date, then test it against explicit energy, thermal, replication,
 * logistics and material ceilings. A failed test stays unfinished; no mass or
 * power is invented to force the requested date. There is no launch/trajectory,
 * collision-avoidance, ecosystem or detailed factory-design simulation here.
 */
export function createIndustryModel(outcome = {}, overrides = {}) {
    const assumptions = boundedAssumptions(overrides);
    const completionYears = clamp(Number(outcome.dysonCompletionYears ?? 12), 3.5, 80);
    const startYear = clamp(Number(outcome.dysonStartYear ?? outcome.year ?? 2031), 1900, 9999);
    const nanoYear = Number(outcome.nanotechYear ?? startYear + 2);
    const nanotechDelayYears = clamp(Number.isFinite(nanoYear) ? nanoYear - startYear : 2, 0, completionYears);
    const sphericalArea = 4 * Math.PI * (assumptions.effectiveRadiusAU * AU_METERS) ** 2;
    const collectorAreaPerKg = assumptions.collectorMassFraction / assumptions.collectorKgPerSquareMeter;
    const incidentWattsPerKg = SOLAR_LUMINOSITY_WATTS / sphericalArea * collectorAreaPerKg;
    const radiatedWattsPerKg = assumptions.radiatorAreaPerCollectorArea * collectorAreaPerKg
        * assumptions.radiatorEmissivity * STEFAN_BOLTZMANN * assumptions.radiatorKelvin ** 4;
    const interceptedWattsPerKg = Math.min(incidentWattsPerKg, radiatedWattsPerKg);
    const energyGrowthRate = interceptedWattsPerKg * assumptions.conversionEfficiency
        * assumptions.industrialEnergyShare / assumptions.energyJoulesPerKg;
    const targetMassKg = sphericalArea * assumptions.targetCoverage / collectorAreaPerKg;
    const massCeilingKg = Math.min(targetMassKg, assumptions.usableMaterialKg);
    const seedMassKg = Math.min(assumptions.seedIndustrialMassKg, massCeilingKg);
    const preGrowthRate = Math.min(Math.LN2 / (assumptions.preNanotechDoublingDays * 86400), energyGrowthRate);
    const maximumGrowthRate = Math.min(Math.LN2 / (assumptions.minimumDoublingDays * 86400), energyGrowthRate);
    const matureMassKg = growIndustry(seedMassKg, nanotechDelayYears * YEAR_SECONDS, preGrowthRate,
        assumptions.maxProcessingKgPerSecond, massCeilingKg);
    const remainingSeconds = Math.max(0, completionYears - nanotechDelayYears) * YEAR_SECONDS;
    let low = 0;
    let high = maximumGrowthRate;
    const largestReachableMass = growIndustry(matureMassKg, remainingSeconds, high,
        assumptions.maxProcessingKgPerSecond, massCeilingKg);
    const feasibleByDeadline = largestReachableMass >= targetMassKg * (1 - 1e-12)
        && radiatedWattsPerKg >= incidentWattsPerKg;
    if (feasibleByDeadline) {
        for (let step = 0; step < 60; step++) {
            const candidate = (low + high) / 2;
            if (growIndustry(matureMassKg, remainingSeconds, candidate, assumptions.maxProcessingKgPerSecond,
                massCeilingKg) >= targetMassKg) high = candidate;
            else low = candidate;
        }
    }
    const growthRate = high;
    const model = {
        assumptions, completionYears, startYear, nanotechDelayYears, sphericalArea,
        collectorAreaPerKg, incidentWattsPerKg, radiatedWattsPerKg, energyGrowthRate,
        targetMassKg, massCeilingKg, seedMassKg, preGrowthRate, maximumGrowthRate,
        matureMassKg, growthRate, feasibleByDeadline,
        requiredDoublingDays: growthRate > 0 ? Math.LN2 / growthRate / 86400 : null,
        materialFractionOfMercury: targetMassKg / MERCURY_MASS_KG
    };
    return model;
}

export function industryState(model, elapsedYears) {
    const time = clamp(Number(elapsedYears), 0, 1000);
    const beforeNano = Math.min(time, model.nanotechDelayYears);
    const seedGrowth = growIndustry(model.seedMassKg, beforeNano * YEAR_SECONDS, model.preGrowthRate,
        model.assumptions.maxProcessingKgPerSecond, model.massCeilingKg);
    const nanotechMature = time >= model.nanotechDelayYears;
    const massKg = growIndustry(seedGrowth, Math.max(0, time - model.nanotechDelayYears) * YEAR_SECONDS,
        model.growthRate, model.assumptions.maxProcessingKgPerSecond, model.massCeilingKg);
    const areaSquareMeters = massKg * model.collectorAreaPerKg;
    const coverage = Math.min(model.assumptions.targetCoverage, areaSquareMeters / model.sphericalArea);
    const interceptedPowerWatts = Math.min(SOLAR_LUMINOSITY_WATTS * coverage, massKg * model.radiatedWattsPerKg);
    const usablePowerWatts = interceptedPowerWatts * model.assumptions.conversionEfficiency;
    const manufacturingPowerBudgetWatts = usablePowerWatts * model.assumptions.industrialEnergyShare;
    const rate = nanotechMature ? model.growthRate : model.preGrowthRate;
    const complete = massKg >= model.targetMassKg * (1 - 1e-12)
        && model.radiatedWattsPerKg >= model.incidentWattsPerKg;
    const processingKgPerSecond = massKg >= model.massCeilingKg * (1 - 1e-12) ? 0
        : Math.min(rate * massKg, manufacturingPowerBudgetWatts / model.assumptions.energyJoulesPerKg,
            model.assumptions.maxProcessingKgPerSecond);
    const limitingFactor = complete ? 'complete'
        : massKg >= model.targetMassKg * (1 - 1e-12) && model.radiatedWattsPerKg < model.incidentWattsPerKg ? 'thermal'
        : massKg >= model.massCeilingKg * (1 - 1e-12) ? 'material'
        : processingKgPerSecond >= model.assumptions.maxProcessingKgPerSecond * (1 - 1e-12) ? 'logistics'
        : rate >= model.energyGrowthRate * (1 - 1e-12) ? 'energy' : nanotechMature ? 'manufacturing' : 'seed-industry';
    return {
        massKg, areaSquareMeters, coverage, powerFraction: interceptedPowerWatts / SOLAR_LUMINOSITY_WATTS,
        interceptedPowerWatts, usablePowerWatts, manufacturingPowerBudgetWatts,
        manufacturingPowerUsedWatts: processingKgPerSecond * model.assumptions.energyJoulesPerKg,
        processingKgPerSecond, materialRemainingKg: Math.max(0, model.assumptions.usableMaterialKg - massKg),
        massFraction: complete ? 1 : clamp(massKg / model.targetMassKg), nanotechMature, complete, limitingFactor,
        feasibleByDeadline: model.feasibleByDeadline, requiredDoublingDays: model.requiredDoublingDays
    };
}

// The construction sequence slows its clock during the final industrial surge.
// This remaps display time only; physical mass still comes from industryState(t).
export function constructionTime(progress, model) {
    const p = clamp(progress, 0, 0.32);
    if (p >= 0.32) return model.completionYears;
    if (!model.feasibleByDeadline) return model.completionYears * (p / 0.32);
    if (p <= 0.075) return model.nanotechDelayYears * (p / 0.075);
    const initial = Math.max(model.matureMassKg, model.targetMassKg * 0.005);
    const yearsTo = mass => model.nanotechDelayYears + timeToMass(model.matureMassKg, mass,
        model.growthRate, model.assumptions.maxProcessingKgPerSecond) / YEAR_SECONDS;
    if (p <= 0.18) return model.nanotechDelayYears + (yearsTo(initial) - model.nanotechDelayYears) * (p - 0.075) / 0.105;
    const fraction = Math.expm1((p - 0.18) / 0.14 * 3) / Math.expm1(3);
    return Math.min(model.completionYears, yearsTo(initial + (model.targetMassKg - initial) * fraction));
}

export function cosmosFrame(progress, outcome = {}, width = 960, height = 540, industryModel = null) {
    const p = clamp(progress);
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const kind = ['flourishing', 'fragile', 'captured', 'extinction'].includes(outcome.kind) ? outcome.kind : 'fragile';
    const model = industryModel ?? createIndustryModel(outcome);
    const years = model.completionYears;
    const startYear = clamp(Number(outcome.dysonStartYear ?? outcome.year ?? 2031), 1900, 9999);
    const probeYear = clamp(Number(outcome.probeLaunchYear ?? startYear + years + 2), startYear, startYear + 300);
    // One later launch wave, even if earlier probes left during construction.
    const launchYears = Math.max(years + 2, probeYear - startYear);
    // Human welfare is not industrial capacity: malign AI can build and expand.
    const expansion = clamp(Number(outcome.machineExpansion ?? 1), 0.4, 1);
    let elapsedYears;
    if (p <= 0.32) elapsedYears = constructionTime(p, model);
    else if (p <= 0.48) elapsedYears = years + (launchYears - years) * (p - 0.32) / 0.16;
    else elapsedYears = launchYears + 150 * smoothstep(0.48, 0.67, p);
    // Physical time freezes here; the remaining zoom is a scale comparison.
    const timeHeld = p >= 0.67;
    const camera = [
        [0, 0.07], [0.075, 0.07], [0.18, 0.85], [0.32, 0.85],
        [0.44, 85], [0.49, 85], [0.60, 68 * AU_PER_LIGHT_YEAR],
        [0.67, 68 * AU_PER_LIGHT_YEAR], [0.77, 190000 * AU_PER_LIGHT_YEAR],
        [0.795, 190000 * AU_PER_LIGHT_YEAR], [0.85, 7e6 * AU_PER_LIGHT_YEAR],
        [0.87, 7e6 * AU_PER_LIGHT_YEAR], [1, 120e9 * AU_PER_LIGHT_YEAR]
    ];
    let viewSpanAU = camera.at(-1)[1];
    for (let index = 1; index < camera.length; index++) {
        const [end, endSpan] = camera[index];
        if (p > end) continue;
        const [start, startSpan] = camera[index - 1];
        const t = smoothstep(start, end, p);
        viewSpanAU = Math.exp(Math.log(startSpan) + Math.log(endSpan / startSpan) * t);
        break;
    }
    const scale = Math.min(w, h) / viewSpanAU;
    const industry = industryState(model, elapsedYears);
    const builtFraction = industry.massFraction;
    const viewSpanLightYears = viewSpanAU / AU_PER_LIGHT_YEAR;
    const phase = p < 0.32 ? 'construction' : p < 0.48 ? 'solar-system'
        : p < 0.67 ? 'interstellar' : p < 0.80 ? 'galaxy'
        : p < 0.87 ? 'local-group' : 'observable-universe';
    return {
        progress: p, kind, duration: 58 + (years - 3.5) / 76.5 * 8,
        elapsedYears, year: startYear + elapsedYears, constructionYears: years,
        launchYears, expansion, builtFraction, industry, phase, timeHeld,
        humanControl: kind === 'extinction' ? 0 : clamp(Number(outcome.humanControl ?? 60), 0, 100),
        scale, viewSpanAU, viewSpanLightYears,
        maxProbeReachLightYears: Math.max(0, elapsedYears - launchYears) * MAX_PROBE_SPEED_C,
        scaleLabel: formatDistance(viewSpanAU),
        centerX: w * 0.5, centerY: h * 0.52,
        pitch: 0.68 + smoothstep(0.32, 0.79, p) * 0.25,
        roll: -0.26 + smoothstep(0.32, 0.79, p) * 0.11,
        starVisibility: smoothstep(0.49, 0.59, p) * (1 - smoothstep(0.67, 0.725, p)),
        probeVisibility: smoothstep(0.49, 0.57, p) * (1 - smoothstep(0.675, 0.73, p)),
        galaxyVisibility: smoothstep(0.66, 0.755, p) * (1 - smoothstep(0.86, 0.91, p)),
        schematic: true
    };
}

export function formatDistance(au) {
    const ly = au / AU_PER_LIGHT_YEAR;
    const [value, unit] = ly >= 1e9 ? [ly / 1e9, 'billion ly'] : ly >= 1e6 ? [ly / 1e6, 'million ly']
        : ly >= 1000 ? [ly / 1000, 'thousand ly'] : ly >= 0.1 ? [ly, 'ly'] : [au, 'AU'];
    return `${Number(value.toPrecision(2))} ${unit}`;
}

export function projectPoint(position, frame) {
    const [x, y, z] = position;
    const pitchY = y * Math.cos(frame.pitch) - z * Math.sin(frame.pitch);
    const depth = y * Math.sin(frame.pitch) + z * Math.cos(frame.pitch);
    const rotatedX = x * Math.cos(frame.roll) - pitchY * Math.sin(frame.roll);
    const rotatedY = x * Math.sin(frame.roll) + pitchY * Math.cos(frame.roll);
    return { x: frame.centerX + rotatedX * frame.scale, y: frame.centerY + rotatedY * frame.scale, depth };
}

export function collectorPosition(collector, plane, elapsedYears) {
    const angle = collector.phase + elapsedYears * ORBITAL_TIME_SCALE * TAU / collector.radius ** 1.5;
    const cos = Math.cos(angle) * collector.radius;
    const sin = Math.sin(angle) * collector.radius;
    return plane.u.map((value, index) => value * cos + plane.v[index] * sin);
}

export function probePosition(star, frame, wave = 0) {
    const distance = Math.hypot(...star.position);
    const years = Math.max(0, frame.elapsedYears - frame.launchYears - star.launchDelay - wave * 9);
    const travelled = years * star.speed * AU_PER_LIGHT_YEAR;
    const fraction = clamp(travelled / distance);
    return {
        position: star.position.map(value => value * fraction),
        fraction, launched: years > 0, arrived: fraction >= 1,
        distanceLightYears: distance / AU_PER_LIGHT_YEAR
    };
}

export function canvasResolution(width, height, dpr = 1) {
    const w = Math.max(1, Number.isFinite(width) ? width : 1);
    const h = Math.max(1, Number.isFinite(height) ? height : 1);
    const scale = Math.min(clamp(dpr, 1, 2), Math.sqrt(1800000 / (w * h)), 2400 / Math.max(w, h));
    return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scale };
}
