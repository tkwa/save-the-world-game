import { createRandom } from './random.js';
import { EVENTS, getEvent, selectEvent, getChoiceAvailability } from './campaign-events.js';

export { getChoiceAvailability };

// These are game parameters, not forecasts or assessments of the named labs.
export const LABS = [
    { id: 'openai', name: 'OpenAI', country: 'US', description: 'A balanced starting organization.', bonuses: { capabilities: 1.04, safety: 1, security: 1, products: 1, diplomacy: 1, infrastructure: 1 } },
    { id: 'anthropic', name: 'Anthropic', country: 'US', description: 'A safety research starting advantage.', bonuses: { capabilities: 0.98, safety: 1.16, security: 1, products: 1, diplomacy: 1, infrastructure: 1 } },
    { id: 'deepmind', name: 'Google DeepMind', country: 'UK', description: 'More infrastructure at the start.', bonuses: { capabilities: 1, safety: 1, security: 1, products: 1, diplomacy: 1, infrastructure: 1.16 } },
    { id: 'deepseek', name: 'DeepSeek', country: 'CN', description: 'Efficient research with less starting capital.', bonuses: { capabilities: 1.10, safety: 1, security: 1, products: 0.95, diplomacy: 1, infrastructure: 1 } },
    { id: 'tencent', name: 'Tencent', country: 'CN', description: 'A stronger commercial starting position.', bonuses: { capabilities: 1, safety: 1, security: 1, products: 1.16, diplomacy: 1, infrastructure: 1 } },
    { id: 'xai', name: 'xAI', country: 'US', description: 'Faster capability research with tighter finances.', bonuses: { capabilities: 1.12, safety: 0.95, security: 1, products: 0.95, diplomacy: 1, infrastructure: 1 } }
];

export const SECTORS = [
    { id: 'capabilities', label: 'Capabilities', description: 'Improve the frontier model; stronger systems also make the race harder to control.', color: '#d5a765' },
    { id: 'safety', label: 'Safety', description: 'Develop alignment, control, evaluations, and interpretability.', color: '#7cc7b5' },
    { id: 'security', label: 'Security', description: 'Protect model weights and sustain credible monitoring.', color: '#8ca9e8' },
    { id: 'products', label: 'Products', description: 'Launch useful applications that earn revenue for the next nine months.', color: '#c198d8' },
    { id: 'diplomacy', label: 'Diplomacy', description: 'Build influence and maintain international agreements.', color: '#daaa94' },
    { id: 'infrastructure', label: 'Infrastructure', description: 'Expand compute and the capacity to verify agreements.', color: '#acbf71' }
];

const SECTOR_IDS = SECTORS.map(sector => sector.id);
const DEFAULT_PLAN = { capabilities: 30, safety: 20, security: 15, products: 15, diplomacy: 10, infrastructure: 10 };
const TRIAL_TYPES = { evaluation: 'evals', control: 'control', interpretability: 'interpretability' };
const POLICIES = {
    deployment: ['gated', 'cautious', 'open', 'rushed'],
    transparency: ['selective', 'open', 'closed'],
    authority: ['human', 'shared', 'delegated']
};
const BASE_FLAGS = ['openSafety', 'independentEvals', 'computeRegistry', 'inspections', 'treatyRatified', 'sharedControl', 'rushedDeployment', 'weightTheft', 'civilianOversight', 'distributedBenefits', 'treatyRenewed', 'defectionContained'];
const BOUNDS = {
    'resources.funds': [0, 1e9], 'resources.compute': [1, 1e6],
    'player.capability': [0, 1e6], 'player.security': [0, 100],
    'player.productivity': [0, 100], 'player.influence': [0, 100],
    'player.trust': [0, 100], 'player.legitimacy': [0, 100], 'player.equity': [0, 1],
    'research.alignment': [0, 100], 'research.control': [0, 100],
    'research.evals': [0, 100], 'research.interpretability': [0, 100],
    'world.tension': [0, 100], 'world.coordination': [0, 100],
    'world.verification': [0, 100], 'world.treatyCoverage': [0, 100],
    'world.treatyStability': [0, 100], 'world.growthFactor': [0.25, 3]
};
const FLAG_NAMES = new Set(BASE_FLAGS);
for (const event of EVENTS) {
    for (const choice of event.choices) {
        for (const path of Object.keys(choice.sets || {})) {
            if (/^flags\.[A-Za-z][A-Za-z0-9]*$/.test(path)) FLAG_NAMES.add(path.slice(6));
        }
    }
}
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const rounded = value => Math.round(value * 1000) / 1000;
const read = (state, path) => {
    const [group, key] = path.split('.');
    return state[group]?.[key];
};
const write = (state, path, value) => {
    const [group, key] = path.split('.');
    state[group][key] = value;
};
const labFor = state => LABS.find(lab => lab.id === state.labId);
const fail = reason => ({ ok: false, reason });

export function formatCampaignDate(turn) {
    return `Q${turn % 4 + 1} ${2026 + Math.floor(turn / 4)}`;
}

function appendHistory(state, kind, title, text, extra = {}) {
    state.history.push({ turn: state.turn, kind, title, text, ...extra });
}

function streamFor(state) {
    const stream = createRandom(0);
    stream.setState(state.rng);
    return stream;
}

export function createCampaign({ seed = 'critical-path', labId = 'openai' } = {}) {
    if (typeof seed !== 'string' || !seed.trim() || seed.length > 200) throw new TypeError('Seed must be a nonempty string of at most 200 characters.');
    const lab = LABS.find(item => item.id === labId);
    if (!lab) throw new TypeError('Unknown starting lab.');
    const stream = createRandom(seed);
    const rivals = LABS.filter(item => item.id !== labId).map((item, index) => ({
        id: item.id, name: item.name, country: item.country,
        capability: [8, 7, 6, 5, 4][index], safety: 20 + stream.random() * 12,
        security: 25 + stream.random() * 10, growth: 0.90 + stream.random() * 0.20
    }));
    const state = {
        schemaVersion: 1, seed, rng: stream.getState(),
        id: `campaign-${stream.getState().seed.toString(16)}-${labId}`, labId, turn: 0,
        phase: 'planning', allocations: { ...DEFAULT_PLAN },
        resources: { funds: labId === 'deepseek' || labId === 'xai' ? 14 : 18, compute: labId === 'deepmind' ? 13 : 10 },
        // The existing product is already at its revenue peak in January 2026.
        // It expires after two turns; there is no perpetual passive income.
        products: [{ id: 'product-existing', launchTurn: -1, initialRevenue: 5, lifetimeQuarters: 3, frontierAtLaunch: 10 }],
        player: { capability: 10, security: 25, productivity: 10, influence: 12, trust: 45, legitimacy: 50, equity: 0.1 },
        research: { alignment: labId === 'anthropic' ? 12 : 8, control: 15, evals: 15, interpretability: 5 },
        world: { tension: 45, coordination: 10, verification: 0, treatyCoverage: 0, treatyStability: 0, growthFactor: 1 },
        policies: { deployment: 'gated', transparency: 'selective', authority: 'human' },
        rivals, flags: {}, seenEvents: [], currentEventId: null,
        history: [], timeline: [], latestReport: [], transition: null, outcome: null,
        researchTrials: { completed: {}, active: null, attempts: 0 }
    };
    recordTimeline(state);
    return state;
}

function validPlan(plan) {
    return isRecord(plan) && Object.keys(plan).length === SECTOR_IDS.length
        && SECTOR_IDS.every(id => Number.isInteger(plan[id]) && plan[id] >= 0 && plan[id] <= 100)
        && SECTOR_IDS.reduce((sum, id) => sum + plan[id], 0) === 100;
}

export function setPlan(state, plan) {
    if (state?.phase !== 'planning' || !validPlan(plan)) return false;
    state.allocations = { ...plan };
    return true;
}

export function setAllocation(state, sectorId, value, lockedIds = []) {
    if (state?.phase !== 'planning' || !validPlan(state.allocations) || !SECTOR_IDS.includes(sectorId)
        || !Number.isInteger(value) || value < 0 || value > 100 || !Array.isArray(lockedIds)
        || lockedIds.some(id => !SECTOR_IDS.includes(id))) return false;
    const locked = new Set(lockedIds);
    if (locked.has(sectorId)) return value === state.allocations[sectorId];
    const fixedTotal = SECTOR_IDS.filter(id => locked.has(id)).reduce((sum, id) => sum + state.allocations[id], 0);
    const remainder = 100 - fixedTotal - value;
    const adjustable = SECTOR_IDS.filter(id => id !== sectorId && !locked.has(id));
    if (remainder < 0 || (adjustable.length === 0 && remainder !== 0)) return false;
    const plan = { ...state.allocations, [sectorId]: value };
    const totalWeight = adjustable.reduce((sum, id) => sum + state.allocations[id], 0);
    const quotas = adjustable.map((id, index) => {
        const exact = remainder * (totalWeight > 0 ? state.allocations[id] / totalWeight : 1 / adjustable.length);
        return { id, index, whole: Math.floor(exact), fraction: exact % 1 };
    });
    let unassigned = remainder - quotas.reduce((sum, quota) => sum + quota.whole, 0);
    for (const quota of [...quotas].sort((a, b) => b.fraction - a.fraction || a.index - b.index)) {
        plan[quota.id] = quota.whole + (unassigned-- > 0 ? 1 : 0);
    }
    state.allocations = plan;
    return true;
}

function leaderFor(state) {
    const lab = labFor(state);
    let leader = { id: lab.id, name: lab.name, capability: state.player.capability };
    for (const rival of state.rivals) {
        if (rival.capability > leader.capability) leader = { id: rival.id, name: rival.name, capability: rival.capability };
    }
    return leader;
}

function treatyStrength(state) {
    if (!state.flags.treatyRatified || !state.flags.computeRegistry || !state.flags.inspections) return 0;
    // An agreement is only as credible as its weakest operational component.
    return Math.min(state.world.verification, state.world.treatyCoverage, state.world.treatyStability) / 100;
}

function researchRestraint(state) {
    // The negotiated delay is temporary, not a magic permanent ban. Research
    // resumes over 2037–2041 as pressure for deployment accumulates. A strong
    // maintained agreement can postpone the transition into 2040; signatures
    // without inspections and continuing support have no comparable effect.
    const reviewPressure = clamp((state.turn - 44) / 16, 0, 1);
    return 1 - 0.94 * treatyStrength(state) * (1 - reviewPressure);
}

export function getRiskEstimate(state, winnerId = leaderFor(state).id) {
    const rival = state.rivals.find(item => item.id === winnerId);
    const sharing = state.flags.openSafety ? 0.70 : 0.25;
    const alignment = rival ? state.research.alignment * sharing + rival.safety * (1 - sharing) : state.research.alignment;
    const control = rival ? state.research.control * sharing + rival.safety * (1 - sharing) : state.research.control;
    const security = rival ? rival.security * 0.65 + state.player.security * 0.35 : state.player.security;
    const frontier = Math.max(state.player.capability, ...state.rivals.map(item => item.capability));
    const progress = clamp(Math.log10(Math.max(10, frontier) / 10) / 2, 0, 1);
    // One world-level transition prior, modified by safeguards and institutions.
    // Evaluations narrow the uncertainty interval; they are not alignment itself.
    let risk = 0.20 + progress * 0.10 + (state.world.tension - 45) * 0.0015
        - (alignment - 8) * 0.0024 - (control - 15) * 0.0014
        - (security - 25) * 0.0009 - (state.research.interpretability - 5) * 0.0010;
    if (state.flags.weightTheft) risk += 0.045 * (1 - security / 150);
    if (state.flags.rushedDeployment || state.policies.deployment === 'rushed') risk += 0.11;
    if (state.policies.deployment === 'cautious') risk -= 0.025;
    if (state.policies.deployment === 'open') risk += 0.025;
    if (state.flags.sharedControl) risk -= 0.018;
    risk -= treatyStrength(state) * 0.055;
    risk = clamp(risk, 0.01, 0.85);
    const uncertainty = 0.10 * (1 - state.research.evals / 125) * (state.flags.independentEvals ? 0.72 : 1);
    return { risk, riskLow: clamp(risk - uncertainty, 0, 1), riskHigh: clamp(risk + uncertainty, 0, 1) };
}

const PRODUCT_CURVES = {
    2: [0.65, 0.35],
    3: [0.55, 1, 0.45],
    4: [0.50, 1, 0.65, 0.25]
};

function cohortRevenue(cohort, turn, frontier) {
    const age = turn - cohort.launchTurn;
    if (age < 0 || age >= cohort.lifetimeQuarters) return 0;
    // A better frontier reduces demand for old products, even before their
    // contracts expire. This is deliberately a game model of short product
    // cycles, not a forecast of any particular company's revenue.
    const competition = Math.min(1, Math.sqrt(cohort.frontierAtLaunch / Math.max(10, frontier)));
    return cohort.initialRevenue * PRODUCT_CURVES[cohort.lifetimeQuarters][age] * competition;
}

function forecastProducts(state, quarterlyCost, productShare, productBonus) {
    const frontier = Math.max(10, leaderFor(state).capability);
    const productRevenue = state.products.reduce((sum, product) => sum + cohortRevenue(product, state.turn, frontier), 0);
    const deploymentRevenue = state.policies.deployment === 'open' ? 1.15 : state.policies.deployment === 'cautious' ? 0.92 : 1;
    const peakRevenue = 9 * Math.sqrt(productShare) * (0.75 + state.player.productivity / 100) * productBonus * deploymentRevenue;
    const unfundedNewRevenue = peakRevenue * PRODUCT_CURVES[3][0];
    // Quarter-level receipts help finance that quarter's work. Since a partly
    // funded launch earns proportionally less, solve the funding equation once
    // instead of counting a fully funded launch's revenue twice.
    const netCost = quarterlyCost - unfundedNewRevenue;
    const funding = netCost <= 0 ? 1 : clamp((state.resources.funds + productRevenue) / netCost, 0, 1);
    const newProduct = peakRevenue * funding > 0 ? {
        id: `product-${state.turn}`, launchTurn: state.turn,
        initialRevenue: peakRevenue * funding, lifetimeQuarters: 3, frontierAtLaunch: frontier
    } : null;
    const newProductRevenue = newProduct ? cohortRevenue(newProduct, state.turn, frontier) : 0;
    const portfolio = newProduct ? [...state.products, newProduct] : state.products;
    // Cash flow from existing products and this quarter's planned launch only;
    // future launches and unknown future frontier advances are not assumed.
    const productCashflow = Array.from({ length: 3 }, (_, offset) => ({
        turn: state.turn + offset,
        revenue: portfolio.reduce((sum, product) => sum + cohortRevenue(product, state.turn + offset, frontier), 0)
    }));
    return { productRevenue, newProductRevenue, newProduct, productCashflow, funding,
        quarterlyRevenue: productRevenue + newProductRevenue };
}

export function getForecast(state) {
    const plan = state.allocations;
    const lab = labFor(state);
    const shares = Object.fromEntries(SECTOR_IDS.map(id => [id, plan[id] / 100]));
    const entropy = -Object.values(shares).reduce((sum, share) => sum + (share > 0 ? share * Math.log(share) : 0), 0) / Math.log(SECTOR_IDS.length);
    const diversityBonus = Math.max(0, 0.12 * entropy);
    const costWeight = shares.capabilities + shares.safety * 0.8 + shares.security * 0.6
        + shares.products * 0.3 + shares.diplomacy * 0.3 + shares.infrastructure;
    const quarterlyCost = 2 + Math.pow(state.resources.compute, 0.65) * 0.7 * costWeight;
    const products = forecastProducts(state, quarterlyCost, shares.products, lab.bonuses.products);
    const { quarterlyRevenue, funding } = products;
    const efficiency = funding * (1 + diversityBonus);
    const effort = id => Math.sqrt(shares[id]) * efficiency * lab.bonuses[id];
    const computeScale = clamp(Math.pow(state.resources.compute / 10, 0.12), 0.85, 1.45);
    const deploymentRate = state.policies.deployment === 'cautious' ? 0.88 : state.policies.deployment === 'rushed' ? 1.13 : 1;
    const rate = 0.36 * effort('capabilities') * computeScale * state.world.growthFactor * researchRestraint(state) * deploymentRate;
    const safetyGain = 4.2 * effort('safety');
    const securityGain = 5 * effort('security') * (1 - state.player.security / 150);
    const diplomacyGain = 3.8 * effort('diplomacy');
    // Even a lab that loses its current research can start again when it funds
    // capability work. Keep zero valid in saved histories; only the productive
    // base has a floor, so an unfunded or paused lab gets no automatic recovery.
    const capabilityGain = Math.max(1, state.player.capability) * Math.expm1(rate);
    let treatyStatus = 'No agreement';
    if (state.flags.treatyRatified) treatyStatus = treatyStrength(state) >= 0.65 ? 'Verified agreement holding' : 'Agreement under strain';
    else if (state.flags.inspections) treatyStatus = 'Inspections operating';
    else if (state.flags.computeRegistry) treatyStatus = 'Compute registry established';
    return {
        date: formatCampaignDate(state.turn), diversityBonus, quarterlyCost, quarterlyRevenue,
        capabilityGain, safetyGain, securityGain, diplomacyGain,
        computeGain: 1.1 * effort('infrastructure') * Math.sqrt(state.resources.compute),
        productivityGain: 3 * effort('products') * (1 - state.player.productivity / 150),
        ...products, leader: leaderFor(state), treatyStatus, ...getRiskEstimate(state)
    };
}

function add(state, path, delta) {
    const bounds = BOUNDS[path];
    if (!bounds || !Number.isFinite(delta)) throw new TypeError(`Unsupported numeric effect: ${path}`);
    write(state, path, rounded(clamp(read(state, path) + delta, ...bounds)));
}

function recordTimeline(state) {
    state.timeline.push({
        turn: state.turn, capability: state.player.capability,
        rivalCapability: Math.max(...state.rivals.map(item => item.capability)),
        risk: getRiskEstimate(state).risk, funds: state.resources.funds
    });
}

function advanceInstitutions(state, forecast) {
    const diplomacy = forecast.diplomacyGain;
    const securityShare = Math.sqrt(state.allocations.security / 100);
    const infrastructureShare = Math.sqrt(state.allocations.infrastructure / 100);
    add(state, 'player.influence', diplomacy * (1 - state.player.influence / 150));
    add(state, 'world.coordination', diplomacy * 0.62 * (0.5 + state.player.trust / 200));
    add(state, 'world.tension', 0.5 - diplomacy * 0.22 - (state.flags.openSafety ? 0.15 : 0) + (state.policies.deployment === 'rushed' ? 0.6 : 0));
    if (state.policies.transparency === 'open') add(state, 'player.trust', 0.35);
    if (state.policies.transparency === 'closed') add(state, 'player.trust', -0.3);
    if (state.flags.civilianOversight) add(state, 'player.legitimacy', 0.3);
    if (state.flags.independentEvals) add(state, 'research.evals', 0.5);
    if (state.flags.computeRegistry) {
        const inspectionSupport = state.flags.inspections && state.allocations.diplomacy >= 10 ? 0.9 : 0;
        add(state, 'world.verification', (0.9 * securityShare + 0.8 * infrastructureShare + inspectionSupport) * forecast.funding);
    }
    if (state.flags.treatyRatified) {
        add(state, 'world.treatyCoverage', diplomacy * 0.8 + 0.35 - state.world.tension * 0.003);
        add(state, 'world.treatyStability', diplomacy * 0.6 + forecast.securityGain * 0.12
            - (state.world.verification < 50 ? 1.4 : 0.35) - state.world.tension * 0.012
            + (state.flags.treatyRenewed ? 0.3 : 0) + (state.flags.defectionContained ? 0.25 : 0));
        if (state.policies.deployment === 'rushed') {
            add(state, 'world.treatyCoverage', -4);
            add(state, 'world.treatyStability', -5);
        }
        if (state.allocations.diplomacy < 10) add(state, 'world.treatyStability', -2.5);
        if (state.allocations.security < 5) add(state, 'world.verification', -2);
    }
}

function recordFactoryMilestone(state) {
    const event = getEvent('factory-autonomy');
    if (state.seenEvents.includes(event.id) || !event.eligible(state)) return;
    const policy = state.policies.deployment;
    const text = policy === 'gated'
        ? 'A robotics partner starts a production pilot with approval gates. Human operators authorize procurement and changes to the production schedule.'
        : policy === 'cautious'
            ? 'A robotics partner uses the system as a planning assistant. Human operators retain production and procurement authority.'
            : 'A robotics partner brings automated production into operation. Its agents manage scheduling, procurement, and maintenance under your existing deployment policy.';
    // This follows the deployment policy already chosen by the player. Product
    // and infrastructure investment account for its output; no extra reward,
    // cost, or interruption is attached to reaching the milestone.
    state.seenEvents.push(event.id);
    appendHistory(state, 'milestone', event.title, text, { eventId: event.id });
    state.latestReport.push(text);
}

export function advanceQuarter(state) {
    if (state?.phase !== 'planning') return fail('Resolve the current decision before advancing.');
    if (state.researchTrials.active) return fail('Finish or cancel the active research trial first.');
    if (state.turn >= 200) return fail('This campaign has reached its supported turn limit.');
    if (!validPlan(state.allocations)) return fail('Allocations must be integer percentages totaling 100.');
    const forecast = getForecast(state);
    const stream = streamFor(state);
    add(state, 'resources.funds', forecast.quarterlyRevenue - forecast.quarterlyCost * forecast.funding);
    if (forecast.newProduct) state.products.push({ ...forecast.newProduct });
    add(state, 'player.capability', forecast.capabilityGain);
    add(state, 'player.security', forecast.securityGain);
    add(state, 'player.productivity', forecast.productivityGain);
    add(state, 'resources.compute', forecast.computeGain);
    add(state, 'research.alignment', forecast.safetyGain * (1 - state.research.alignment / 140));
    add(state, 'research.control', forecast.safetyGain * 0.9 * (1 - state.research.control / 140));
    add(state, 'research.evals', forecast.safetyGain * 1.2 * (1 - state.research.evals / 140));
    add(state, 'research.interpretability', forecast.safetyGain * 0.6 * (1 - state.research.interpretability / 140));
    advanceInstitutions(state, forecast);
    const restraint = researchRestraint(state);
    for (const rival of state.rivals) {
        const automation = 1 + 0.06 * Math.log2(Math.max(1, rival.capability / 20));
        const noise = 0.93 + stream.random() * 0.14;
        const rate = 0.205 * rival.growth * automation * state.world.growthFactor * restraint * noise;
        rival.capability = rounded(clamp(rival.capability * Math.exp(rate), 0, 1e6));
        const sharedSafety = state.flags.openSafety ? state.research.alignment * 0.018 : 0;
        rival.safety = rounded(clamp(rival.safety + 0.65 + sharedSafety + (state.flags.independentEvals ? 0.3 : 0), 0, 100));
        rival.security = rounded(clamp(rival.security + 0.5 + state.world.verification * 0.007, 0, 100));
    }
    state.turn++;
    state.products = state.products.filter(product => product.launchTurn + product.lifetimeQuarters > state.turn);
    state.rng = stream.getState();
    state.latestReport = [
        `Capability increased by ${forecast.capabilityGain.toFixed(1)} to ${state.player.capability.toFixed(1)}.`,
        `Revenue $${forecast.quarterlyRevenue.toFixed(1)}B; spending $${(forecast.quarterlyCost * forecast.funding).toFixed(1)}B.`,
        `Alignment ${state.research.alignment.toFixed(0)}, control ${state.research.control.toFixed(0)}, security ${state.player.security.toFixed(0)}.`
    ];
    if (forecast.funding < 1) state.latestReport.push(`Limited funds supplied ${(forecast.funding * 100).toFixed(0)}% of the plan; work continued at reduced capacity.`);
    if (state.flags.treatyRatified) state.latestReport.push(`Treaty: ${state.world.treatyCoverage.toFixed(0)}% coverage, ${state.world.verification.toFixed(0)} verification, ${state.world.treatyStability.toFixed(0)} stability.`);
    recordFactoryMilestone(state);
    recordTimeline(state);
    if (leaderFor(state).capability >= 1000) beginTransition(state);
    else {
        const event = selectEvent(state);
        if (event) {
            state.phase = 'decision';
            state.currentEventId = event.id;
            state.seenEvents.push(event.id);
        }
    }
    return { ok: true };
}

export function getCurrentEvent(state) {
    return state.phase === 'decision' && state.currentEventId ? getEvent(state.currentEventId) : null;
}

function validateChoiceEffects(choice) {
    for (const [path, amount] of Object.entries(choice.effects || {})) {
        if (!BOUNDS[path] || !Number.isFinite(amount)) throw new TypeError(`Unsupported choice effect: ${path}`);
    }
    for (const [path, value] of Object.entries(choice.sets || {})) {
        const [group, key] = path.split('.');
        const validFlag = group === 'flags' && FLAG_NAMES.has(key) && typeof value === 'boolean';
        const validPolicy = group === 'policies' && POLICIES[key]?.includes(value);
        if (path.split('.').length !== 2 || (!validFlag && !validPolicy)) throw new TypeError(`Unsupported choice setting: ${path}`);
    }
}

function applyChoice(state, choice) {
    validateChoiceEffects(choice);
    for (const [path, amount] of Object.entries(choice.costs || {})) add(state, path, -amount);
    for (const [path, amount] of Object.entries(choice.effects || {})) add(state, path, amount);
    for (const [path, value] of Object.entries(choice.sets || {})) write(state, path, value);
}

export function resolveDecision(state, choiceId) {
    const event = getCurrentEvent(state);
    if (!event) return fail('There is no pending decision.');
    const choice = event.choices.find(item => item.id === choiceId);
    const availability = getChoiceAvailability(state, choice);
    if (!availability.available) return fail(availability.reason);
    applyChoice(state, choice);
    appendHistory(state, 'decision', event.title, choice.result, { eventId: event.id, choiceId: choice.id });
    state.latestReport = [choice.result, ...state.history.filter(entry => entry.kind === 'milestone' && entry.turn === state.turn).map(entry => entry.text)];
    state.currentEventId = null;
    state.phase = 'planning';
    if (leaderFor(state).capability >= 1000) beginTransition(state);
    return { ok: true };
}

export function startResearchTrial(state, type) {
    if (state?.phase !== 'planning') return fail('Research trials are available between decisions.');
    if (typeof type !== 'string' || !Object.hasOwn(TRIAL_TYPES, type)) return fail('Unknown research trial.');
    if (state.researchTrials.active) return fail('A research trial is already active.');
    if (Object.hasOwn(state.researchTrials.completed, type)) return fail('This research trial is already complete.');
    if (!Number.isSafeInteger(state.researchTrials.attempts) || state.researchTrials.attempts < 0
        || state.researchTrials.attempts === Number.MAX_SAFE_INTEGER) return fail('The research trial attempt counter is invalid.');
    // The puzzle stays reproducible across retries, but an abandoned attempt's
    // delayed callback must never be able to finish a later attempt.
    state.researchTrials.attempts++;
    const trial = { id: `${state.id}:trial:${type}:${state.researchTrials.attempts}`, type, seed: `${state.seed}:trial:${type}` };
    state.researchTrials.active = trial;
    return { ok: true, trial: { ...trial } };
}

export function completeResearchTrial(state, id, score) {
    const active = state?.researchTrials?.active;
    if (state?.phase !== 'planning' || !active || active.id !== id || !validActiveTrial(state, active)) return fail('This research trial is not active.');
    if (!Number.isFinite(score) || score < 0 || score > 1) return fail('Trial scores must be between zero and one.');
    if (Object.hasOwn(state.researchTrials.completed, active.type)) return fail('This research trial is already complete.');
    const path = `research.${TRIAL_TYPES[active.type]}`;
    const before = read(state, path);
    add(state, path, 5 + 10 * score);
    const gain = read(state, path) - before;
    state.researchTrials.completed[active.type] = { score, turn: state.turn };
    state.researchTrials.active = null;
    const title = `${active.type[0].toUpperCase()}${active.type.slice(1)} research trial`;
    const text = `The trial earned ${(score * 100).toFixed(0)}% and added ${gain.toFixed(1)} research progress.`;
    appendHistory(state, 'research-trial', title, text, { eventId: active.type, choiceId: 'completed', trialScore: score });
    state.latestReport = [text];
    return { ok: true };
}

export function cancelResearchTrial(state) {
    if (state?.phase !== 'planning' || !state.researchTrials) return fail('There is no active research trial to cancel.');
    state.researchTrials.active = null;
    return { ok: true };
}

function beginTransition(state) {
    if (state.transition) return;
    const leader = leaderFor(state);
    const stream = streamFor(state);
    const ownVictory = leader.id === state.labId;
    const control = clamp(30 + state.research.control * (ownVictory ? 0.40 : 0.22)
        + state.player.security * 0.15 + state.world.verification * 0.16 + state.player.legitimacy * 0.12
        + (state.flags.sharedControl ? 8 : 0) + (state.flags.civilianOversight ? 5 : 0), 0, 100);
    state.transition = {
        stage: 0, year: 2026 + Math.floor(state.turn / 4), winnerId: leader.id,
        risk: getRiskEstimate(state, leader.id).risk, uncertainty: stream.random(), decisions: [],
        humanControl: control,
        personalOwnership: clamp(state.player.equity * (ownVictory ? 55 : 12 * state.player.capability / leader.capability), 0, 100),
        flourishing: clamp(35 + state.player.productivity * 0.25 + state.player.legitimacy * 0.25 + state.world.coordination * 0.12, 0, 100),
        authority: 'undecided', distribution: 'undecided', priority: 'undecided'
    };
    state.rng = stream.getState();
    state.phase = 'transition';
    state.currentEventId = null;
    appendHistory(state, 'transition', 'The first superintelligent system', `${leader.name} reached the frontier in ${formatCampaignDate(state.turn)}. The remaining decisions concern deployment and the institutions around it.`);
}

export function getTransitionDecision(state) {
    if (state.phase !== 'transition' || !state.transition) return null;
    const stage = state.transition.stage;
    const leaderName = LABS.find(lab => lab.id === state.transition.winnerId).name;
    if (stage === 0) return {
        id: 'transition-authority', title: 'Who authorizes deployment?',
        body: `${leaderName} has a system capable of accelerating research far beyond human speed. Your influence and safeguards determine which constraints can credibly survive deployment.`,
        choices: [
            { id: 'human-checkpoints', label: 'Require human authorization at each expansion', description: 'Stronger control, with a slower initial rollout.', requirements: { 'research.control': 35 }, effects: {}, sets: { 'policies.authority': 'human' }, result: 'Deployment proceeds through monitored stages with human authorization.' },
            { id: 'shared-council', label: 'Place deployment under an international council', description: 'Share authority and ownership across the participating institutions.', requirements: { 'world.coordination': 45, 'world.verification': 30 }, effects: {}, sets: { 'policies.authority': 'shared' }, result: 'A jointly monitored council receives authority over expansion.' },
            { id: 'delegate', label: 'Delegate operations to the system', description: 'Deploy immediately, accepting weaker human control.', effects: {}, sets: { 'policies.authority': 'delegated' }, result: 'The system receives broad operational authority under the existing safeguards.' }
        ]
    };
    if (stage === 1) return {
        id: 'transition-distribution', title: 'Who benefits from abundance?',
        body: 'Automated research and production are beginning to change the economy. Existing ownership gives your company considerable power over access.',
        choices: [
            { id: 'public-dividend', label: 'Create a broad public dividend', description: 'Give up some ownership to distribute the gains widely.', effects: {}, sets: { 'flags.distributedBenefits': true }, result: 'A large share of the new productive capacity funds a public dividend.' },
            { id: 'universal-access', label: 'Guarantee access to health and basic needs', description: 'Fund universal services while preserving more private ownership.', costs: { 'resources.funds': 4 }, effects: {}, sets: { 'flags.distributedBenefits': true }, result: 'Health care and basic material needs receive enforceable access guarantees.' },
            { id: 'retain-ownership', label: 'Keep ownership concentrated', description: 'Preserve the largest personal stake; access depends more on private decisions.', effects: {}, result: 'The existing owners retain most of the new productive assets.' }
        ]
    };
    return {
        id: 'transition-expansion', title: 'What comes after the transition?',
        body: 'Automated laboratories and factories can pursue several projects at once, but priorities still determine who benefits first and how quickly industry expands beyond Earth.',
        choices: [
            { id: 'health-first', label: 'Prioritize health and material security', description: 'Deliver benefits on Earth before accelerating space industry.', effects: {}, result: 'Early industrial capacity is directed toward health and everyday needs.' },
            { id: 'solar-industry', label: 'Accelerate solar-system industry', description: 'Build collectors and autonomous factories as rapidly as institutions can manage.', effects: {}, result: 'The first collector factories expand into a growing Dyson swarm.' },
            { id: 'careful-expansion', label: 'Build in stages and launch probes', description: 'Keep expansion inspectable while beginning interstellar exploration.', effects: {}, result: 'The expansion proceeds through reviewable stages, with early interstellar probes.' }
        ]
    };
}

export function resolveTransition(state, choiceId) {
    const decision = getTransitionDecision(state);
    if (!decision) return fail('There is no pending transition decision.');
    const choice = decision.choices.find(item => item.id === choiceId);
    const availability = getChoiceAvailability(state, choice);
    if (!availability.available) return fail(availability.reason);
    applyChoice(state, choice);
    const transition = state.transition;
    const stage = transition.stage;
    transition.decisions.push(choiceId);
    appendHistory(state, 'transition-decision', decision.title, choice.result, { eventId: decision.id, choiceId });
    if (stage === 0) {
        transition.authority = choiceId;
        if (choiceId === 'human-checkpoints') {
            transition.humanControl += 18;
            transition.risk -= 0.05;
        } else if (choiceId === 'shared-council') {
            transition.humanControl += 14;
            transition.risk -= 0.065;
            transition.personalOwnership *= 0.75;
            transition.flourishing += 6;
        } else {
            transition.humanControl -= 27;
            transition.risk += 0.075;
            transition.personalOwnership *= 1.15;
        }
        transition.risk = clamp(transition.risk, 0.005, 0.90);
    } else if (stage === 1) {
        transition.distribution = choiceId;
        if (choiceId === 'public-dividend') {
            transition.personalOwnership *= 0.50;
            transition.flourishing += 18;
        } else if (choiceId === 'universal-access') {
            transition.personalOwnership *= 0.80;
            transition.flourishing += 14;
        } else {
            transition.personalOwnership *= 1.65;
            transition.flourishing -= 12;
            transition.humanControl -= 4;
        }
    } else {
        transition.priority = choiceId;
        if (choiceId === 'health-first') transition.flourishing += 9;
        else if (choiceId === 'careful-expansion') transition.humanControl += 5;
        else transition.flourishing += 2;
    }
    transition.humanControl = clamp(transition.humanControl, 0, 100);
    transition.personalOwnership = clamp(transition.personalOwnership, 0, 100);
    transition.flourishing = clamp(transition.flourishing, 0, 100);
    transition.stage++;
    state.latestReport = [choice.result];
    // This is the campaign's only existential-risk draw. No additional roll is
    // made per company, quarter, result screen, save, or reload.
    if (stage === 0 && transition.uncertainty < transition.risk) finishCampaign(state, true);
    else if (transition.stage === 3) finishCampaign(state, false);
    return { ok: true };
}

function buildOutcome(state, extinction) {
    const t = state.transition;
    const year = t.year;
    const winner = LABS.find(lab => lab.id === t.winnerId).name;
    const humanControl = extinction ? 0 : rounded(t.humanControl);
    const flourishing = extinction ? 0 : rounded(t.flourishing);
    const kind = extinction ? 'extinction' : humanControl < 40 ? 'captured' : flourishing >= 70 && humanControl >= 55 ? 'flourishing' : 'fragile';
    const industrialBase = clamp(30 - Math.sqrt(state.resources.compute) * 1.2 - state.world.coordination * 0.10, 5, 60);
    const prioritySpeed = t.priority === 'solar-industry' ? 0.60 : t.priority === 'health-first' ? 1.40 : 1;
    const dysonCompletionYears = rounded(clamp(industrialBase * prioritySpeed * (extinction ? 0.75 : 1), 3.5, 80));
    const causes = [];
    causes.push(t.winnerId === state.labId ? 'Your organization reached superintelligence first.' : `${winner} reached superintelligence before your organization.`);
    causes.push(`Alignment ${state.research.alignment.toFixed(0)}, control ${state.research.control.toFixed(0)}, and security ${state.player.security.toFixed(0)} shaped the transition risk.`);
    if (state.flags.openSafety) causes.push('Shared safety research improved the safeguards available to rival labs.');
    if (state.flags.treatyRatified) causes.push(`The agreement reached ${state.world.treatyCoverage.toFixed(0)}% coverage with verification ${state.world.verification.toFixed(0)}.`);
    if (t.authority === 'delegate') causes.push('Broad delegation traded human control for immediate deployment.');
    else causes.push('Deployment authority remained subject to human institutions.');
    if (!extinction) causes.push(t.distribution === 'retain-ownership' ? 'Concentrated ownership preserved your stake while limiting broad access.' : 'Access guarantees spread the gains beyond existing owners.');
    const summary = {
        flourishing: 'Humanity survives with substantial control and widely shared material gains.',
        fragile: 'Humanity survives, but weak institutions or uneven access leave the future fragile.',
        captured: 'Humanity survives while losing much of its effective control over the future.',
        extinction: 'The transition escapes human control. Humanity does not survive.'
    }[kind];
    return {
        kind, year, winner, humanControl, personalOwnership: extinction ? 0 : rounded(t.personalOwnership),
        flourishing, survival: !extinction, transitionRisk: t.risk,
        economyYearOne: extinction ? 0 : rounded(2 + (state.player.productivity - 40) / 200),
        agingSolvedYear: extinction ? null : year + (t.priority === 'health-first' ? 1 : 2),
        nanotechYear: year + (extinction ? 1 : 2),
        dysonStartYear: year,
        dysonCompletionYears,
        probeLaunchYear: year + (extinction ? Math.max(3, Math.ceil(dysonCompletionYears * 0.2)) : t.priority === 'careful-expansion' ? 3 : Math.max(4, Math.ceil(dysonCompletionYears * 0.3))),
        summary, causes,
        legacy: { quarters: state.turn, decisions: state.history.filter(entry => entry.kind === 'decision').length, treatyCoverage: state.world.treatyCoverage, ownershipPolicy: t.distribution, industrialPriority: t.priority }
    };
}

function finishCampaign(state, extinction) {
    state.outcome = buildOutcome(state, extinction);
    state.phase = 'complete';
    appendHistory(state, 'outcome', 'The outcome', state.outcome.summary);
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function assertSave(condition, message) {
    if (!condition) throw new TypeError(`Invalid campaign save: ${message}`);
}

function finiteIn(value, low, high) {
    return Number.isFinite(value) && value >= low && value <= high;
}

function validText(value, max = 3000) {
    return typeof value === 'string' && value.length <= max;
}

function assertKeys(value, keys, label) {
    assertSave(isRecord(value), `${label} must be an object.`);
    assertSave(Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value, key)), `${label} has missing or unsupported fields.`);
}

function validateCampaign(state) {
    assertKeys(state, ['schemaVersion', 'seed', 'rng', 'id', 'labId', 'turn', 'phase', 'allocations', 'resources', 'products', 'player', 'research', 'world', 'policies', 'rivals', 'flags', 'seenEvents', 'currentEventId', 'history', 'timeline', 'latestReport', 'transition', 'outcome', 'researchTrials'], 'campaign');
    assertSave(state.schemaVersion === 1, 'unsupported schema version.');
    assertSave(validText(state.seed, 200) && state.seed.trim().length > 0, 'invalid seed.');
    assertSave(LABS.some(lab => lab.id === state.labId), 'unknown lab.');
    assertSave(state.id === `campaign-${createRandom(state.seed).getState().seed.toString(16)}-${state.labId}`, 'campaign identifier does not match its seed and lab.');
    assertSave(Number.isInteger(state.turn) && finiteIn(state.turn, 0, 200), 'invalid turn.');
    assertSave(['planning', 'decision', 'transition', 'complete'].includes(state.phase), 'unknown phase.');
    assertSave(validPlan(state.allocations), 'allocation percentages must total 100.');
    for (const group of ['resources', 'player', 'research', 'world']) {
        const keys = Object.keys(BOUNDS).filter(path => path.startsWith(`${group}.`)).map(path => path.split('.')[1]);
        assertKeys(state[group], keys, group);
    }
    for (const [path, bounds] of Object.entries(BOUNDS)) assertSave(finiteIn(read(state, path), ...bounds), `${path} is outside its bounds.`);
    assertSave(Array.isArray(state.products) && state.products.length <= 4, 'invalid product portfolio.');
    const productIds = new Set();
    for (const product of state.products) {
        assertKeys(product, ['id', 'launchTurn', 'initialRevenue', 'lifetimeQuarters', 'frontierAtLaunch'], 'product');
        assertSave(Number.isInteger(product.launchTurn) && finiteIn(product.launchTurn, -1, state.turn - 1)
            && [2, 3, 4].includes(product.lifetimeQuarters) && product.launchTurn + product.lifetimeQuarters > state.turn,
        'invalid or expired product lifecycle.');
        assertSave(product.id === (product.launchTurn === -1 ? 'product-existing' : `product-${product.launchTurn}`)
            && !productIds.has(product.id), 'invalid or duplicate product identifier.');
        productIds.add(product.id);
        assertSave(finiteIn(product.initialRevenue, Number.MIN_VALUE, 1e6)
            && finiteIn(product.frontierAtLaunch, 10, 1e6), 'invalid product revenue or launch frontier.');
    }
    assertKeys(state.policies, Object.keys(POLICIES), 'policies');
    for (const [key, values] of Object.entries(POLICIES)) assertSave(values.includes(state.policies[key]), `unknown ${key} policy.`);
    assertSave(Array.isArray(state.rivals) && state.rivals.length === LABS.length - 1, 'invalid rival roster.');
    const rivalIds = new Set();
    for (const rival of state.rivals) {
        assertKeys(rival, ['id', 'name', 'country', 'capability', 'safety', 'security', 'growth'], 'rival');
        const lab = LABS.find(item => item.id === rival.id);
        assertSave(lab && lab.id !== state.labId && lab.name === rival.name && lab.country === rival.country && !rivalIds.has(lab.id), 'unknown or duplicate rival.');
        rivalIds.add(lab.id);
        assertSave(finiteIn(rival.capability, 0, 1e6) && finiteIn(rival.safety, 0, 100) && finiteIn(rival.security, 0, 100) && finiteIn(rival.growth, 0.5, 2), 'invalid rival metrics.');
    }
    assertSave(isRecord(state.flags) && Object.entries(state.flags).every(([key, value]) => FLAG_NAMES.has(key) && typeof value === 'boolean'), 'unknown or invalid campaign flags.');
    assertSave(Array.isArray(state.seenEvents) && state.seenEvents.length <= EVENTS.length && new Set(state.seenEvents).size === state.seenEvents.length && state.seenEvents.every(id => getEvent(id)), 'invalid event history.');
    assertSave(state.currentEventId === null || (typeof state.currentEventId === 'string' && getEvent(state.currentEventId)), 'unknown current event.');
    assertSave((state.phase === 'decision') === (state.currentEventId !== null), 'current event does not match campaign phase.');
    if (state.currentEventId) assertSave(state.seenEvents.includes(state.currentEventId), 'current event is missing from event history.');
    assertSave(Array.isArray(state.history) && state.history.length <= 500, 'invalid campaign history.');
    for (const entry of state.history) {
        assertSave(isRecord(entry) && Number.isInteger(entry.turn) && finiteIn(entry.turn, 0, state.turn)
            && ['decision', 'transition', 'transition-decision', 'outcome', 'research-trial', 'milestone'].includes(entry.kind)
            && validText(entry.title, 300) && validText(entry.text)
            && Object.keys(entry).every(key => ['turn', 'kind', 'title', 'text', 'eventId', 'choiceId', 'trialScore'].includes(key)), 'invalid history entry.');
        if (entry.eventId !== undefined) assertSave(validText(entry.eventId, 100)
            && (entry.kind === 'milestone' ? !Object.hasOwn(entry, 'choiceId') : validText(entry.choiceId, 100)), 'invalid history identifiers.');
        if (entry.kind === 'decision') assertSave(getEvent(entry.eventId)?.choices.some(choice => choice.id === entry.choiceId), 'unknown decision in history.');
        if (entry.kind === 'milestone') assertSave(entry.eventId === 'factory-autonomy' && entry.turn >= 10
            && state.seenEvents.includes(entry.eventId), 'unknown or inconsistent campaign milestone.');
        if (entry.kind === 'research-trial') assertSave(Object.hasOwn(TRIAL_TYPES, entry.eventId) && entry.choiceId === 'completed'
            && finiteIn(entry.trialScore, 0, 1), 'unknown or invalid research trial in history.');
        else assertSave(!Object.hasOwn(entry, 'trialScore'), 'trial score belongs only to research trial history.');
    }
    const factoryEntries = state.history.filter(entry => entry.eventId === 'factory-autonomy');
    assertSave(factoryEntries.length <= 1, 'factory milestone or decision was recorded more than once.');
    assertSave(Array.isArray(state.timeline) && state.timeline.length === state.turn + 1, 'timeline does not match the campaign turn.');
    state.timeline.forEach((entry, index) => {
        assertKeys(entry, ['turn', 'capability', 'rivalCapability', 'risk', 'funds'], 'timeline entry');
        assertSave(entry.turn === index && finiteIn(entry.capability, 0, 1e6) && finiteIn(entry.rivalCapability, 0, 1e6)
            && finiteIn(entry.risk, 0, 1) && finiteIn(entry.funds, 0, 1e9), 'invalid timeline values.');
    });
    assertSave(Array.isArray(state.latestReport) && state.latestReport.length <= 20 && state.latestReport.every(text => validText(text)), 'invalid quarterly report.');
    assertKeys(state.rng, ['algorithm', 'version', 'seed', 'state', 'draws'], 'random state');
    try { streamFor(state); } catch { throw new TypeError('Invalid campaign save: random-state snapshot is invalid.'); }
    assertSave(state.rng.seed === createRandom(state.seed).getState().seed, 'random seed does not match campaign seed.');
    validateTrials(state);
    validateEnding(state);
    return state;
}

function validateTrials(state) {
    assertKeys(state.researchTrials, ['completed', 'active', 'attempts'], 'research trials');
    const { completed, active, attempts } = state.researchTrials;
    assertSave(Number.isSafeInteger(attempts) && attempts >= 0, 'invalid research trial attempt counter.');
    assertSave(isRecord(completed) && Object.keys(completed).every(type => Object.hasOwn(TRIAL_TYPES, type)), 'unknown completed trial.');
    for (const entry of Object.values(completed)) {
        assertKeys(entry, ['score', 'turn'], 'completed trial');
        assertSave(finiteIn(entry.score, 0, 1) && Number.isInteger(entry.turn) && finiteIn(entry.turn, 0, state.turn), 'invalid completed trial.');
    }
    const history = state.history.filter(entry => entry.kind === 'research-trial');
    assertSave(history.length === Object.keys(completed).length && new Set(history.map(entry => entry.eventId)).size === history.length
        && history.every(entry => completed[entry.eventId]?.score === entry.trialScore && completed[entry.eventId]?.turn === entry.turn),
    'completed research trials do not match campaign history.');
    assertSave(attempts >= history.length + (active === null ? 0 : 1), 'research trial attempts do not match completed and active trials.');
    if (active !== null) {
        assertKeys(active, ['id', 'type', 'seed'], 'active trial');
        assertSave(state.phase === 'planning' && validActiveTrial(state, active) && !Object.hasOwn(completed, active.type), 'invalid active research trial.');
    }
}

function validActiveTrial(state, active) {
    return isRecord(active) && typeof active.type === 'string' && Object.hasOwn(TRIAL_TYPES, active.type)
        && Number.isSafeInteger(state.researchTrials.attempts) && state.researchTrials.attempts > 0
        && active.id === `${state.id}:trial:${active.type}:${state.researchTrials.attempts}`
        && active.seed === `${state.seed}:trial:${active.type}`;
}

function validateEnding(state) {
    const t = state.transition;
    assertSave((state.phase === 'transition' || state.phase === 'complete') === (t !== null), 'transition does not match campaign phase.');
    assertSave((state.phase === 'complete') === (state.outcome !== null), 'outcome does not match campaign phase.');
    if (!t) return;
    assertKeys(t, ['stage', 'year', 'winnerId', 'risk', 'uncertainty', 'decisions', 'humanControl', 'personalOwnership', 'flourishing', 'authority', 'distribution', 'priority'], 'transition');
    assertSave(Number.isInteger(t.stage) && finiteIn(t.stage, 0, 3) && t.year === 2026 + Math.floor(state.turn / 4)
        && LABS.some(lab => lab.id === t.winnerId) && finiteIn(t.risk, 0, 1) && finiteIn(t.uncertainty, 0, 1), 'invalid transition values.');
    assertSave(leaderFor(state).id === t.winnerId && leaderFor(state).capability >= 1000, 'transition winner has not reached superintelligence.');
    assertSave(['humanControl', 'personalOwnership', 'flourishing'].every(key => finiteIn(t[key], 0, 100)), 'invalid transition outcomes.');
    const options = [
        ['human-checkpoints', 'shared-council', 'delegate'],
        ['public-dividend', 'universal-access', 'retain-ownership'],
        ['health-first', 'solar-industry', 'careful-expansion']
    ];
    assertSave(Array.isArray(t.decisions) && t.decisions.length === t.stage && t.decisions.every((id, index) => options[index].includes(id)), 'invalid transition decisions.');
    for (const [index, key] of ['authority', 'distribution', 'priority'].entries()) {
        assertSave(t[key] === (t.decisions[index] || 'undecided'), `invalid transition ${key}.`);
    }
    if (state.phase === 'transition') assertSave(t.stage < 3 && (t.stage === 0 || t.uncertainty >= t.risk), 'transition cannot continue after catastrophe.');
    const outcome = state.outcome;
    if (!outcome) return;
    assertKeys(outcome, ['kind', 'year', 'winner', 'humanControl', 'personalOwnership', 'flourishing', 'survival', 'transitionRisk', 'economyYearOne', 'agingSolvedYear', 'nanotechYear', 'dysonStartYear', 'dysonCompletionYears', 'probeLaunchYear', 'summary', 'causes', 'legacy'], 'outcome');
    assertSave(['flourishing', 'fragile', 'captured', 'extinction'].includes(outcome.kind)
        && outcome.survival === (outcome.kind !== 'extinction') && outcome.year === t.year
        && outcome.winner === LABS.find(lab => lab.id === t.winnerId).name
        && outcome.transitionRisk === t.risk, 'inconsistent outcome.');
    assertSave(['humanControl', 'personalOwnership', 'flourishing'].every(key => finiteIn(outcome[key], 0, 100))
        && finiteIn(outcome.economyYearOne, 0, 4) && finiteIn(outcome.dysonCompletionYears, 3.5, 80), 'invalid outcome metrics.');
    for (const key of ['agingSolvedYear', 'nanotechYear', 'dysonStartYear', 'probeLaunchYear']) {
        const humanHealthLost = !outcome.survival && key === 'agingSolvedYear';
        assertSave(humanHealthLost ? outcome[key] === null : Number.isInteger(outcome[key]) && finiteIn(outcome[key], outcome.year, outcome.year + 100), `invalid ${key}.`);
    }
    assertSave(validText(outcome.summary) && Array.isArray(outcome.causes) && outcome.causes.length <= 20 && outcome.causes.every(text => validText(text)), 'invalid outcome explanation.');
    assertKeys(outcome.legacy, ['quarters', 'decisions', 'treatyCoverage', 'ownershipPolicy', 'industrialPriority'], 'legacy');
    assertSave(outcome.legacy.quarters === state.turn && Number.isInteger(outcome.legacy.decisions) && finiteIn(outcome.legacy.decisions, 0, EVENTS.length)
        && finiteIn(outcome.legacy.treatyCoverage, 0, 100) && outcome.legacy.ownershipPolicy === t.distribution && outcome.legacy.industrialPriority === t.priority, 'invalid legacy.');
    assertSave(outcome.kind === 'extinction' ? t.stage === 1 && t.uncertainty < t.risk : t.stage === 3 && t.uncertainty >= t.risk, 'outcome does not match the resolved transition.');
    assertSave(sameData(outcome, buildOutcome(state, outcome.kind === 'extinction')), 'outcome does not match the campaign decisions.');
}

function sameData(left, right) {
    if (left === right) return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]));
}

export function serializeCampaign(state) {
    validateCampaign(state);
    return JSON.stringify(state);
}

export function restoreCampaign(json) {
    if (typeof json !== 'string' || json.length > 2_000_000) throw new TypeError('Invalid campaign save: expected a JSON string under 2 MB.');
    let parsed;
    try { parsed = JSON.parse(json); } catch { throw new TypeError('Invalid campaign save: malformed JSON.'); }
    return validateCampaign(parsed);
}
