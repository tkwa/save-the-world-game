import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as game from '../campaign.js';

const plan = values => Object.fromEntries(game.SECTORS.map((sector, index) => [sector.id, values[index]]));
const cooperative = { 'credential-breach': 'share-alert', 'civilian-mandate': 'advisory' };
const aggressive = {
    'credential-breach': 'contain', 'agent-contract': 'wide', 'outside-evaluators': 'internal',
    'research-agents': 'delegate', 'compute-register': 'wait', 'publish-safety': 'private',
    'deceptive-evaluation': 'accept-tests', 'weights-circulate': 'race', 'grid-connection': 'private',
    'clinical-access': 'premium', 'civilian-mandate': 'board', 'internal-model-gap': 'secret',
    'research-handoff': 'agents', 'automation-dividend': 'reinvest', 'last-coordination-window': 'lead',
    'transition-authority': 'delegate', 'transition-distribution': 'retain-ownership',
    'transition-expansion': 'solar-industry'
};

// Allocations: capabilities, safety, security, products, diplomacy, infrastructure.
export const STRATEGIES = {
    balanced: { allocations: [30, 20, 15, 15, 10, 10] },
    research: { allocations: [50, 15, 10, 10, 5, 10] },
    safety: { allocations: [15, 40, 20, 10, 10, 5] },
    coordinationPreset: { allocations: [10, 20, 15, 10, 35, 10] },
    fundedCoordination: { allocations: [0, 10, 15, 25, 35, 15], preferences: cooperative },
    commercial: { allocations: [10, 10, 10, 55, 10, 5] },
    safetyCommercial: { allocations: [0, 40, 15, 30, 10, 5], preferences: cooperative },
    race: { allocations: [65, 5, 5, 15, 0, 10], preferences: aggressive },
    pureCapability: { allocations: [100, 0, 0, 0, 0, 0], preferences: aggressive },
    balancedWithLabs: { allocations: [30, 20, 15, 15, 10, 10], trials: true },
    commercialWithLabs: { allocations: [10, 10, 10, 55, 10, 5], trials: true },
    adaptiveCash: { allocations: [30, 20, 15, 15, 10, 10], preferences: cooperative, adaptive: true }
};

export function runCampaign({ labId = 'openai', seed = 'balance-0', strategy = 'balanced' } = {}) {
    const config = STRATEGIES[strategy];
    assert.ok(config, `Unknown strategy: ${strategy}`);
    const state = game.createCampaign({ labId, seed });
    const standingPlan = plan(config.allocations);
    assert.equal(game.setPlan(state, standingPlan), true);
    if (config.trials) {
        for (const type of ['evaluation', 'control', 'interpretability']) {
            const started = game.startResearchTrial(state, type);
            assert.equal(started.ok, true);
            assert.equal(game.completeResearchTrial(state, started.trial.id, 1).ok, true);
        }
    }
    const missed = [];
    const checkpoints = [];
    let partialQuarters = 0, zeroFundingQuarters = 0, planChanges = 0, actions = 0;
    while (state.phase !== 'complete' && actions++ < 400) {
        if (state.phase === 'planning') {
            if (config.adaptive) {
                const forecast = game.getForecast(state);
                const desired = state.resources.funds < 8 || forecast.funding < 1 ?
                    plan([20, 15, 10, 40, 10, 5]) : standingPlan;
                if (game.SECTORS.some(sector => desired[sector.id] !== state.allocations[sector.id])) {
                    assert.equal(game.setPlan(state, desired), true);
                    planChanges++;
                }
            }
            const forecast = game.getForecast(state);
            partialQuarters += forecast.funding < 0.999;
            zeroFundingQuarters += forecast.funding < 0.001;
            checkpoints.push({ turn: state.turn, funds: state.resources.funds,
                influence: state.player.influence, capability: state.player.capability,
                funding: forecast.funding, capabilityGain: forecast.capabilityGain });
            assert.equal(game.advanceQuarter(state).ok, true);
        } else {
            assert.ok(['decision', 'transition'].includes(state.phase), state.phase);
            const event = state.phase === 'decision' ? game.getCurrentEvent(state) : game.getTransitionDecision(state);
            const preferredId = config.preferences?.[event.id] ?? event.choices[0].id;
            const preferred = event.choices.find(choice => choice.id === preferredId);
            assert.ok(preferred, `Stale strategy preference: ${event.id}/${preferredId}`);
            const availability = game.getChoiceAvailability(state, preferred);
            if (!availability.available) missed.push({ turn: state.turn, eventId: event.id,
                choiceId: preferredId, reason: availability.reason,
                funds: state.resources.funds, influence: state.player.influence });
            const choice = availability.available ? preferred :
                event.choices.find(option => game.getChoiceAvailability(state, option).available);
            assert.ok(choice, `No available choice: ${event.id}`);
            const result = state.phase === 'decision' ?
                game.resolveDecision(state, choice.id) : game.resolveTransition(state, choice.id);
            assert.equal(result.ok, true, result.reason);
        }
    }
    assert.equal(state.phase, 'complete', `${labId}/${seed}/${strategy} failed to finish`);
    game.serializeCampaign(state);
    return { state, missed, checkpoints, partialQuarters, zeroFundingQuarters, planChanges };
}

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function summarize(runs) {
    const states = runs.map(run => run.state);
    const survivors = states.filter(state => state.outcome.survival);
    const turns = states.map(state => state.turn);
    return {
        campaigns: states.length, turnRange: [Math.min(...turns), Math.max(...turns)], meanTurn: mean(turns),
        meanRisk: mean(states.map(state => state.outcome.transitionRisk)),
        extinctions: states.length - survivors.length,
        playerWins: states.filter(state => state.outcome.winner === game.LABS.find(lab => lab.id === state.labId).name).length,
        treaties: states.filter(state => state.flags.treatyRatified).length,
        renewed: states.filter(state => state.flags.treatyRenewed).length,
        meanControl: mean(survivors.map(state => state.outcome.humanControl)),
        meanFlourishing: mean(survivors.map(state => state.outcome.flourishing)),
        meanOwnership: mean(survivors.map(state => state.outcome.personalOwnership)),
        meanFunds: mean(states.map(state => state.resources.funds)),
        meanPartialQuarters: mean(runs.map(run => run.partialQuarters)),
        meanZeroFundingQuarters: mean(runs.map(run => run.zeroFundingQuarters)),
        meanPlanChanges: mean(runs.map(run => run.planChanges)),
        invitationInfluenceFailures: runs.flatMap(run => run.missed).filter(miss =>
            ['compute-register', 'reciprocal-inspections'].includes(miss.eventId) && miss.reason.includes('influence')).length
    };
}

export async function sweep(seedCount = 40) {
    assert.ok(Number.isSafeInteger(seedCount) && seedCount >= 1 && seedCount <= 10000, 'Seed count must be an integer from 1 to 10000.');
    const hashes = {};
    for (const file of ['campaign.js', 'campaign-events.js', 'random.js']) {
        hashes[file] = createHash('sha256').update(await readFile(new URL(`../${file}`, import.meta.url))).digest('hex');
    }
    const summary = {};
    for (const strategy of Object.keys(STRATEGIES)) {
        const runs = [];
        for (const lab of game.LABS) {
            for (let index = 0; index < seedCount; index++) {
                runs.push(runCampaign({ labId: lab.id, seed: `balance-${index}`, strategy }));
            }
        }
        summary[strategy] = summarize(runs);
    }
    return { hashes, seeds: `balance-0 through balance-${seedCount - 1}`,
        labs: game.LABS.map(lab => lab.id), campaigns: seedCount * game.LABS.length * Object.keys(STRATEGIES).length,
        strategies: STRATEGIES, summary };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    let seedCount = 40, output = null;
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index++) {
        const flag = args[index];
        assert.ok(['--seeds', '--output'].includes(flag) && args[index + 1], 'Usage: node scripts/campaign-balance.mjs [--seeds 40] [--output summary.json]');
        if (flag === '--seeds') seedCount = Number(args[++index]);
        else output = resolve(args[++index]);
    }
    const result = await sweep(seedCount);
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (output) {
        await writeFile(output, json);
        console.log(`${result.campaigns} campaigns completed; summary written to ${output}`);
    } else process.stdout.write(json);
}
