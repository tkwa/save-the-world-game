import test from 'node:test';
import assert from 'node:assert/strict';
import {
    LABS, createCampaign, setPlan, getForecast, advanceQuarter, getCurrentEvent,
    getChoiceAvailability, resolveDecision, getTransitionDecision, resolveTransition,
    startResearchTrial, completeResearchTrial, cancelResearchTrial, serializeCampaign, restoreCampaign
} from '../campaign.js';

function chooseFirst(state, preferences = {}) {
    const decision = state.phase === 'decision' ? getCurrentEvent(state) : getTransitionDecision(state);
    const available = decision.choices.filter(choice => getChoiceAvailability(state, choice).available);
    assert.ok(available.length, `${decision.id} must have an available choice`);
    const choice = available.find(item => item.id === preferences[decision.id]) || available[0];
    const result = state.phase === 'decision' ? resolveDecision(state, choice.id) : resolveTransition(state, choice.id);
    assert.equal(result.ok, true, result.reason);
}

function play(state, preferences = {}) {
    let actions = 0;
    while (state.phase !== 'complete' && actions++ < 300) {
        if (state.phase === 'planning') assert.equal(advanceQuarter(state).ok, true);
        else chooseFirst(state, preferences);
        serializeCampaign(state);
    }
    assert.equal(state.phase, 'complete', 'the campaign must finish');
    return state;
}

test('fresh campaigns are deterministic, independent, and validate lab/seed identifiers', () => {
    const first = createCampaign({ seed: 'same', labId: 'anthropic' });
    const second = createCampaign({ seed: 'same', labId: 'anthropic' });
    assert.deepEqual(first, second);
    assert.notDeepEqual(first.rng, createCampaign({ seed: 'different', labId: 'anthropic' }).rng);
    first.flags.openSafety = true;
    first.allocations.safety = 99;
    assert.deepEqual(second.flags, {});
    assert.equal(second.allocations.safety, 20);
    assert.equal(first.rivals.some(rival => rival.id === 'anthropic'), false);
    for (const options of [{ seed: '' }, { seed: 12 }, { labId: 'fictional' }]) assert.throws(() => createCampaign(options), TypeError);
});

test('forecasts are read-only and funded quarterly production matches the shown values', () => {
    const state = createCampaign({ seed: 'forecast' });
    const before = structuredClone(state);
    const forecast = getForecast(state);
    assert.deepEqual(state, before);
    assert.deepEqual(getForecast(state), forecast);
    assert.equal(forecast.date, 'Q1 2026');
    assert.equal(forecast.leader.id, state.labId);
    assert.ok(forecast.riskLow <= forecast.risk && forecast.risk <= forecast.riskHigh);
    assert.equal(advanceQuarter(state).ok, true);
    assert.ok(Math.abs(state.player.capability - before.player.capability - forecast.capabilityGain) < 0.001);
    assert.ok(Math.abs(state.resources.funds - before.resources.funds - forecast.quarterlyRevenue + forecast.quarterlyCost) < 0.001);
    assert.equal(state.turn, 1);
    assert.equal(state.timeline.length, 2);
    assert.deepEqual(state.allocations, before.allocations, 'the allocation plan persists');
});

test('an unfunded organization scales its work instead of spending negative money', () => {
    const state = createCampaign();
    state.resources.funds = 0;
    state.resources.compute = 200;
    setPlan(state, { capabilities: 100, safety: 0, security: 0, products: 0, diplomacy: 0, infrastructure: 0 });
    const forecast = getForecast(state);
    assert.ok(forecast.funding > 0 && forecast.funding < 1);
    const capability = state.player.capability;
    advanceQuarter(state);
    assert.equal(state.resources.funds, 0);
    assert.ok(Math.abs(state.player.capability - capability - forecast.capabilityGain) < 0.001);
    assert.ok(state.latestReport.some(line => line.includes('reduced capacity')));
});

test('a product ramps up, fades, and expires without leaving permanent passive revenue', () => {
    const state = createCampaign({ seed: 'product-lifecycle' });
    state.products = [];
    setPlan(state, { capabilities: 0, safety: 0, security: 0, products: 100, diplomacy: 0, infrastructure: 0 });
    const launch = getForecast(state);
    assert.equal(launch.productRevenue, 0);
    assert.equal(launch.quarterlyRevenue, launch.newProductRevenue);
    assert.deepEqual(launch.productCashflow.map(item => item.turn), [0, 1, 2]);
    assert.deepEqual(launch.productCashflow.map(item => item.revenue), [0.55, 1, 0.45].map(weight => launch.newProduct.initialRevenue * weight));
    advanceQuarter(state);
    assert.deepEqual(state.products, [launch.newProduct]);
    chooseFirst(state);
    setPlan(state, { capabilities: 0, safety: 100, security: 0, products: 0, diplomacy: 0, infrastructure: 0 });
    const peak = getForecast(state);
    assert.equal(peak.newProduct, null);
    assert.ok(peak.productRevenue > launch.newProductRevenue);
    advanceQuarter(state);
    if (state.phase === 'decision') chooseFirst(state);
    const fading = getForecast(state);
    assert.ok(fading.productRevenue > 0 && fading.productRevenue < peak.productRevenue);
    advanceQuarter(state);
    if (state.phase === 'decision') chooseFirst(state);
    assert.deepEqual(state.products, []);
    assert.equal(getForecast(state).quarterlyRevenue, 0);
    assert.ok(state.player.productivity > 10, 'learned product skill remains, but does not itself generate income');
    serializeCampaign(state);
});

test('frontier competition makes an older product less valuable', () => {
    const state = createCampaign({ seed: 'competitive-market' });
    setPlan(state, { capabilities: 0, safety: 100, security: 0, products: 0, diplomacy: 0, infrastructure: 0 });
    const before = getForecast(state).productRevenue;
    state.rivals[0].capability = 40;
    assert.equal(getForecast(state).productRevenue, before / 2);
});

test('partly funded launches earn only their funded share and match the cash-flow forecast', () => {
    const state = createCampaign({ seed: 'partly-funded-product' });
    state.resources.funds = 0;
    state.resources.compute = 200;
    setPlan(state, { capabilities: 60, safety: 5, security: 5, products: 20, diplomacy: 0, infrastructure: 10 });
    const forecast = getForecast(state);
    assert.ok(forecast.funding > 0 && forecast.funding < 1);
    assert.equal(forecast.productCashflow[0].revenue, forecast.quarterlyRevenue);
    assert.ok(Math.abs(forecast.quarterlyRevenue - forecast.quarterlyCost * forecast.funding) < 1e-10);
    advanceQuarter(state);
    assert.equal(state.resources.funds, 0);
    assert.deepEqual(state.products.find(product => product.id === forecast.newProduct.id), forecast.newProduct);
    assert.equal(state.products.filter(product => product.id === forecast.newProduct.id).length, 1);
    serializeCampaign(state);
});

test('pending decisions cannot be skipped, double-applied, or bought without resources', () => {
    const state = createCampaign();
    advanceQuarter(state);
    assert.equal(state.phase, 'decision');
    const event = getCurrentEvent(state);
    const initial = serializeCampaign(state);
    assert.equal(advanceQuarter(state).ok, false);
    assert.equal(resolveDecision(state, 'not-an-option').ok, false);
    assert.equal(serializeCampaign(state), initial);
    const paid = event.choices.find(choice => choice.costs?.['resources.funds'] > 0);
    state.resources.funds = 0;
    const broke = serializeCampaign(state);
    assert.equal(resolveDecision(state, paid.id).ok, false);
    assert.equal(serializeCampaign(state), broke);
    chooseFirst(state);
    const resolved = serializeCampaign(state);
    assert.equal(resolveDecision(state, paid.id).ok, false);
    assert.equal(serializeCampaign(state), resolved);
    assert.equal(state.history.filter(entry => entry.kind === 'decision').length, 1);
});

test('all real lab starts complete a bounded ordinary campaign with separate outcomes', () => {
    for (const lab of LABS) {
        for (const seed of ['lab-check-1', 'lab-check-2', 'lab-check-3']) {
            const state = play(createCampaign({ seed, labId: lab.id }));
            assert.ok(state.turn >= 8 && state.turn <= 36, `${lab.id}: ${state.turn} quarters`);
            assert.ok(state.outcome.year >= 2027 && state.outcome.year <= 2034);
            for (const key of ['humanControl', 'flourishing', 'personalOwnership']) assert.ok(state.outcome[key] >= 0 && state.outcome[key] <= 100);
            assert.equal(Object.hasOwn(state.outcome, 'score'), false);
            assert.ok(state.outcome.dysonCompletionYears >= 3.5 && state.outcome.dysonCompletionYears <= 80);
        }
    }
});

test('research and safety plans produce different race results and risks', () => {
    const research = createCampaign({ seed: 'strategy-contrast' });
    const safety = createCampaign({ seed: 'strategy-contrast' });
    setPlan(research, { capabilities: 65, safety: 5, security: 5, products: 15, diplomacy: 0, infrastructure: 10 });
    setPlan(safety, { capabilities: 10, safety: 45, security: 20, products: 15, diplomacy: 5, infrastructure: 5 });
    play(research);
    play(safety);
    assert.ok(research.turn < safety.turn);
    assert.ok(research.outcome.transitionRisk > safety.outcome.transitionRisk);
    assert.equal(research.outcome.winner, 'OpenAI');
    assert.notEqual(safety.outcome.winner, 'OpenAI');
});

test('verification and sustained diplomacy can delay the race; signatures alone cannot', () => {
    const coordinated = createCampaign({ seed: 'coop-3' });
    setPlan(coordinated, { capabilities: 0, safety: 10, security: 15, products: 25, diplomacy: 35, infrastructure: 15 });
    play(coordinated, { 'credential-breach': 'share-alert', 'civilian-mandate': 'advisory' });
    assert.equal(coordinated.flags.treatyRatified, true);
    assert.equal(coordinated.flags.treatyRenewed, true);
    assert.ok(coordinated.turn >= 44, `coordination only reached turn ${coordinated.turn}`);
    assert.ok(coordinated.world.verification >= 75);
    const paperTreaty = createCampaign();
    const before = getForecast(paperTreaty).capabilityGain;
    paperTreaty.flags.treatyRatified = true;
    paperTreaty.world.treatyCoverage = 100;
    paperTreaty.world.treatyStability = 100;
    assert.equal(getForecast(paperTreaty).capabilityGain, before, 'unverified signatures do not slow research');
});

test('neglecting an established treaty erodes its verification and stability', () => {
    const state = createCampaign();
    Object.assign(state.flags, { treatyRatified: true, computeRegistry: true, inspections: true });
    Object.assign(state.world, { treatyCoverage: 90, treatyStability: 90, verification: 90 });
    setPlan(state, { capabilities: 70, safety: 0, security: 0, products: 30, diplomacy: 0, infrastructure: 0 });
    advanceQuarter(state);
    assert.ok(state.world.verification < 90);
    assert.ok(state.world.treatyStability < 90);
});

test('a successful verified coordination campaign can defer superintelligence to 2040', () => {
    const state = createCampaign({ seed: 'calibrate-26' });
    setPlan(state, { capabilities: 0, safety: 10, security: 15, products: 25, diplomacy: 35, infrastructure: 15 });
    play(state, { 'credential-breach': 'share-alert', 'civilian-mandate': 'advisory' });
    assert.equal(state.outcome.year, 2040);
    assert.equal(state.flags.treatyRatified, true);
    assert.equal(state.flags.treatyRenewed, true);
    assert.ok(state.world.verification >= 75 && state.world.treatyCoverage >= 75 && state.world.treatyStability >= 75);
    assert.ok(state.resources.funds > 0, 'finite product cohorts can fund the sustained effort');
});

test('the ending draws uncertainty once and cannot reroll through rendering or repeat submissions', () => {
    const state = createCampaign({ seed: 'ending-once' });
    while (state.phase !== 'transition') {
        if (state.phase === 'planning') advanceQuarter(state);
        else chooseFirst(state);
    }
    const atTransition = structuredClone(state);
    assert.deepEqual(getTransitionDecision(state), getTransitionDecision(state));
    assert.deepEqual(state, atTransition);
    while (state.phase === 'transition') chooseFirst(state);
    assert.deepEqual(state.rng, atTransition.rng, 'final choices consume no additional random draws');
    const complete = serializeCampaign(state);
    assert.equal(resolveTransition(state, 'delegate').ok, false);
    assert.equal(advanceQuarter(state).ok, false);
    assert.equal(getTransitionDecision(state), null);
    assert.equal(serializeCampaign(state), complete);
});

test('technical trials are deterministic, cancelable, and award research only once', () => {
    const state = createCampaign({ seed: 'trials' });
    const initialRandom = structuredClone(state.rng);
    const first = startResearchTrial(state, 'control');
    assert.equal(first.ok, true);
    assert.equal(advanceQuarter(state).ok, false);
    assert.equal(startResearchTrial(state, 'evaluation').ok, false);
    cancelResearchTrial(state);
    const resumed = startResearchTrial(state, 'control');
    assert.equal(resumed.trial.seed, first.trial.seed);
    assert.notEqual(resumed.trial.id, first.trial.id);
    assert.equal(completeResearchTrial(state, first.trial.id, 1).ok, false, 'an abandoned callback cannot finish the replacement attempt');
    assert.equal(completeResearchTrial(state, resumed.trial.id, NaN).ok, false);
    assert.equal(completeResearchTrial(state, 'wrong-id', 1).ok, false);
    const before = state.research.control;
    assert.equal(completeResearchTrial(state, resumed.trial.id, 0.75).ok, true);
    assert.equal(state.research.control - before, 12.5);
    assert.equal(completeResearchTrial(state, resumed.trial.id, 1).ok, false);
    assert.equal(startResearchTrial(state, 'control').ok, false);
    assert.deepEqual(state.rng, initialRandom);
    assert.equal(state.researchTrials.completed.control.score, 0.75);
    assert.equal(state.history.at(-1).kind, 'research-trial');
    serializeCampaign(state);
});

test('trial inputs are strict, all three rewards are bounded, and completion does not touch the race random stream', () => {
    const state = createCampaign({ seed: 'strict-trials' });
    const baseline = createCampaign({ seed: 'strict-trials' });
    const initial = serializeCampaign(state);
    for (const type of ['unknown', 'constructor', ['control'], { toString: () => 'evaluation' }, null, undefined]) {
        assert.equal(startResearchTrial(state, type).ok, false);
        assert.equal(serializeCampaign(state), initial);
    }
    for (const [type, field, score, gain] of [['evaluation', 'evals', 0, 5], ['control', 'control', 0.5, 10], ['interpretability', 'interpretability', 1, 15]]) {
        const { trial } = startResearchTrial(state, type);
        const pending = serializeCampaign(state);
        for (const invalidScore of [-1, 1.0001, Infinity, -Infinity, NaN, '1', null, undefined, true, {}, new Number(1), 1n]) {
            assert.equal(completeResearchTrial(state, trial.id, invalidScore).ok, false);
            assert.equal(serializeCampaign(state), pending, `${type} rejects invalid scores atomically`);
        }
        const before = state.research[field];
        assert.equal(completeResearchTrial(state, trial.id, score).ok, true);
        assert.equal(state.research[field] - before, gain);
        assert.equal(state.history.filter(entry => entry.kind === 'research-trial' && entry.eventId === type).length, 1);
        assert.equal(state.history.at(-1).trialScore, score);
        const complete = serializeCampaign(state);
        assert.equal(completeResearchTrial(state, trial.id, 1).ok, false);
        assert.equal(startResearchTrial(state, type).ok, false);
        assert.equal(serializeCampaign(state), complete);
    }
    assert.deepEqual(state.rng, baseline.rng);
    advanceQuarter(state);
    advanceQuarter(baseline);
    assert.deepEqual(state.rng, baseline.rng, 'trials leave the next quarter on the same random stream');
    assert.equal(state.researchTrials.attempts, 3);
});

test('cancellation gives no reward and trial operations cannot mutate decisions or ended campaigns', () => {
    const state = createCampaign({ seed: 'trial-phase-guards' });
    const before = structuredClone(state);
    const { trial } = startResearchTrial(state, 'evaluation');
    assert.equal(cancelResearchTrial(state).ok, true);
    assert.equal(cancelResearchTrial(state).ok, true, 'repeated cancellation is harmless');
    assert.equal(completeResearchTrial(state, trial.id, 1).ok, false);
    assert.deepEqual(state.research, before.research);
    assert.deepEqual(state.rng, before.rng);
    assert.deepEqual(state.history, before.history);
    assert.deepEqual(state.researchTrials.completed, {});
    const checked = new Set();
    let actions = 0;
    while (actions++ < 300) {
        if (state.phase !== 'planning' && !checked.has(state.phase)) {
            checked.add(state.phase);
            const snapshot = serializeCampaign(state);
            assert.equal(startResearchTrial(state, 'control').ok, false);
            assert.equal(completeResearchTrial(state, trial.id, 1).ok, false);
            assert.equal(cancelResearchTrial(state).ok, false);
            assert.equal(serializeCampaign(state), snapshot);
        }
        if (state.phase === 'complete') break;
        if (state.phase === 'planning') advanceQuarter(state);
        else chooseFirst(state);
    }
    assert.deepEqual([...checked].sort(), ['complete', 'decision', 'transition']);
});

test('a near-complete research index reports only the progress actually granted', () => {
    const state = createCampaign();
    state.research.control = 98;
    const { trial } = startResearchTrial(state, 'control');
    completeResearchTrial(state, trial.id, 1);
    assert.equal(state.research.control, 100);
    assert.match(state.latestReport[0], /added 2\.0 research progress/);
    serializeCampaign(state);
});

test('factory automation is a once-only policy-dependent milestone with no extra costs or interrupted decisions', () => {
    const initial = createCampaign({ seed: 'factory-milestone' });
    while (initial.turn < 9 || initial.phase === 'decision') {
        if (initial.phase === 'planning') advanceQuarter(initial);
        else chooseFirst(initial);
    }
    assert.equal(initial.seenEvents.includes('factory-autonomy'), false);
    const expected = {
        gated: /approval gates.*Human operators authorize procurement/,
        cautious: /planning assistant.*Human operators retain production and procurement authority/,
        open: /automated production.*agents manage scheduling, procurement/,
        rushed: /automated production.*agents manage scheduling, procurement/
    };
    for (const [policy, pattern] of Object.entries(expected)) {
        let state = structuredClone(initial);
        state.policies.deployment = policy;
        state.rivals[0].capability = 110;
        const alreadySeen = structuredClone(state);
        alreadySeen.seenEvents.push('factory-autonomy');
        advanceQuarter(state);
        advanceQuarter(alreadySeen);
        const milestone = state.history.find(entry => entry.kind === 'milestone');
        assert.equal(milestone.eventId, 'factory-autonomy');
        assert.equal(milestone.turn, 10);
        assert.equal(Object.hasOwn(milestone, 'choiceId'), false);
        assert.match(milestone.text, pattern);
        assert.ok(state.latestReport.includes(milestone.text));
        for (const key of ['resources', 'player', 'research', 'world', 'products', 'flags', 'rng', 'rivals']) {
            assert.deepEqual(state[key], alreadySeen[key], `${key} is unaffected by the milestone`);
        }
        assert.equal(state.phase, 'decision', 'another eligible decision still appears in the same quarter');
        assert.equal(state.currentEventId, alreadySeen.currentEventId);
        assert.notEqual(state.currentEventId, 'factory-autonomy');
        chooseFirst(state);
        assert.ok(state.latestReport.includes(milestone.text), 'resolving the decision preserves the new milestone report');
        state = restoreCampaign(serializeCampaign(state));
        play(state);
        assert.equal(state.history.filter(entry => entry.eventId === 'factory-autonomy').length, 1);
        assert.equal(state.seenEvents.filter(id => id === 'factory-autonomy').length, 1);
    }
});

test('factory milestone waits for both its date and frontier threshold', () => {
    const state = createCampaign({ seed: 'factory-threshold' });
    while (state.turn < 9 || state.phase === 'decision') {
        if (state.phase === 'planning') advanceQuarter(state);
        else chooseFirst(state);
    }
    state.player.capability = 1;
    state.rivals.forEach(rival => { rival.capability = 1; });
    advanceQuarter(state);
    assert.equal(state.turn, 10);
    assert.equal(state.seenEvents.includes('factory-autonomy'), false);
    if (state.phase === 'decision') chooseFirst(state);
    state.rivals[0].capability = 110;
    advanceQuarter(state);
    assert.equal(state.seenEvents.includes('factory-autonomy'), true);
    assert.equal(state.history.find(entry => entry.kind === 'milestone').turn, 11);
    serializeCampaign(state);
});

test('a research setback can reach zero without permanently preventing funded recovery', () => {
    // A saved pending handoff from the preview could reach a paused lab when a
    // rival crossed the world threshold. Resolve the real choice, including its
    // cost and research loss, rather than constructing only the final zero.
    let state = createCampaign({ seed: 'research-recovery' });
    state.player.capability = 12;
    state.resources.funds = 100;
    state.phase = 'decision';
    state.currentEventId = 'research-handoff';
    state.seenEvents.push('research-handoff');
    state = restoreCampaign(serializeCampaign(state));
    assert.equal(resolveDecision(state, 'separate').ok, true);
    assert.equal(state.player.capability, 0);
    assert.equal(state.resources.funds, 95);
    state = restoreCampaign(serializeCampaign(state));
    setPlan(state, { capabilities: 60, safety: 10, security: 10, products: 10, diplomacy: 5, infrastructure: 5 });
    for (let quarter = 0; quarter < 3; quarter++) {
        const before = state.player.capability;
        const forecast = getForecast(state);
        assert.equal(forecast.funding, 1);
        assert.ok(forecast.capabilityGain > 0);
        assert.equal(advanceQuarter(state).ok, true);
        assert.ok(state.player.capability > before, 'paid research must recover from zero and continue progressing');
        assert.ok(Math.abs(state.player.capability - before - forecast.capabilityGain) < 0.001);
        state = restoreCampaign(serializeCampaign(state));
        if (state.phase === 'decision') chooseFirst(state);
    }
});

test('the recoverable research base grants nothing to paused or unfunded work', () => {
    const state = createCampaign({ seed: 'no-free-recovery' });
    state.player.capability = 0;
    setPlan(state, { capabilities: 0, safety: 20, security: 15, products: 25, diplomacy: 25, infrastructure: 15 });
    assert.equal(getForecast(state).capabilityGain, 0);
    state.resources.funds = 0;
    state.products = [];
    setPlan(state, { capabilities: 100, safety: 0, security: 0, products: 0, diplomacy: 0, infrastructure: 0 });
    assert.equal(getForecast(state).funding, 0);
    assert.equal(getForecast(state).capabilityGain, 0);
    advanceQuarter(state);
    assert.equal(state.player.capability, 0);
    serializeCampaign(state);
});

test('established human controls do not disappear because transition cash is exhausted', () => {
    const state = createCampaign({ seed: 'balance-1', labId: 'openai' });
    setPlan(state, { capabilities:15, safety:40, security:20, products:10, diplomacy:10, infrastructure:5 });
    let actions = 0;
    while (state.phase !== 'transition' && actions++ < 200) {
        if (state.phase === 'planning') advanceQuarter(state);
        else chooseFirst(state);
    }
    assert.equal(state.phase, 'transition');
    assert.ok(state.research.control >= 35);
    state.resources.funds = 0;
    const checkpoint = getTransitionDecision(state).choices.find(choice => choice.id === 'human-checkpoints');
    assert.equal(getChoiceAvailability(state, checkpoint).available, true);
    assert.equal(resolveTransition(state, checkpoint.id).ok, true);
    assert.equal(state.policies.authority, 'human');
    assert.equal(state.resources.funds, 0);
    serializeCampaign(state);
});

test('transition choices use the same exact resource thresholds as campaign decisions', () => {
    const state = createCampaign({ seed: 'transition-availability' });
    while (state.phase !== 'transition') {
        if (state.phase === 'planning') advanceQuarter(state);
        else chooseFirst(state);
    }
    const choices = getTransitionDecision(state).choices;
    const human = choices.find(choice => choice.id === 'human-checkpoints');
    const council = choices.find(choice => choice.id === 'shared-council');
    state.research.control = 34.999;
    assert.equal(getChoiceAvailability(state, human).available, false);
    const before = serializeCampaign(state);
    assert.equal(resolveTransition(state, human.id).ok, false);
    assert.equal(serializeCampaign(state), before);
    state.research.control = 35;
    assert.equal(getChoiceAvailability(state, human).available, true);
    state.world.coordination = 44.999;
    state.world.verification = 30;
    assert.equal(getChoiceAvailability(state, council).available, false);
    state.world.coordination = 45;
    state.world.verification = 29.999;
    assert.equal(getChoiceAvailability(state, council).available, false);
    state.world.verification = 30;
    assert.equal(getChoiceAvailability(state, council).available, true);
    assert.equal(resolveTransition(state, human.id).ok, true);
    assert.equal(state.phase, 'transition');
    const access = getTransitionDecision(state).choices.find(choice => choice.id === 'universal-access');
    state.resources.funds = 3.999;
    assert.equal(getChoiceAvailability(state, access).available, false);
    assert.equal(resolveTransition(state, access.id).ok, false);
    assert.equal(state.resources.funds, 3.999);
    state.resources.funds = 4;
    assert.equal(getChoiceAvailability(state, access).available, true);
    assert.equal(resolveTransition(state, access.id).ok, true);
    assert.equal(state.resources.funds, 0);
    serializeCampaign(state);
});
