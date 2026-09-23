import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EVENTS, RETIRED_EVENT_IDS, FLAG_EFFECTS, POLICY_VALUES,
    getEvent, selectEvent, getChoiceCost, getChoiceAvailability, validateEventCatalog
} from '../campaign-events.js';

function stateAt(turn = 0) {
    return {
        turn, phase: 'planning',
        resources: { funds: 18, compute: 10 },
        player: { capability: 10, security: 25, productivity: 10, influence: 12, trust: 45, legitimacy: 50, equity: 0.1 },
        research: { alignment: 8, control: 15, evals: 15, interpretability: 5 },
        world: { tension: 45, coordination: 10, verification: 0, treatyCoverage: 0, treatyStability: 0, growthFactor: 1 },
        policies: { deployment: 'gated', transparency: 'selective', authority: 'human' },
        rivals: [{ id: 'anthropic', capability: 8 }],
        flags: {}, seenEvents: []
    };
}

function preparedState(turn = 16) {
    const state = stateAt(turn);
    state.resources = { funds: 100, compute: 50 };
    for (const section of ['player', 'research', 'world']) {
        for (const key of Object.keys(state[section])) state[section][key] = 80;
    }
    state.player.equity = 0.1;
    state.player.capability = 250;
    state.world.growthFactor = 1;
    state.rivals[0].capability = 300;
    return state;
}

test('the authored catalog has 26 valid events and stable lookup identities', () => {
    assert.equal(EVENTS.length, 26);
    assert.deepEqual(validateEventCatalog(), []);
    for (const item of EVENTS) assert.equal(getEvent(item.id), item);
    assert.equal(getEvent('not-an-event'), null);
    assert.equal(getEvent(undefined), null);
});

test('every event has an unconditional free fallback at zero available resources', () => {
    const state = stateAt();
    for (const section of ['resources', 'player', 'research', 'world']) {
        for (const key of Object.keys(state[section])) state[section][key] = 0;
    }
    for (const item of EVENTS) {
        assert.ok(item.choices.some(option => getChoiceAvailability(state, option).available), item.id);
    }
});

test('January 2026 starts without a forced event; the breach is an early priority', () => {
    const state = stateAt();
    assert.equal(selectEvent(state), null);
    state.turn = 1;
    assert.equal(selectEvent(state).id, 'credential-breach');
    state.turn = 5;
    state.player.capability = 10;
    assert.notEqual(selectEvent(state)?.id, 'credential-breach');
});

test('selection respects priority, then stable catalog order, without random draws or mutation', () => {
    const state = preparedState();
    state.flags.treatyRatified = true;
    state.seenEvents = EVENTS.filter(item => !['deceptive-evaluation', 'suspected-defection'].includes(item.id)).map(item => item.id);
    const before = structuredClone(state);
    assert.equal(getEvent('deceptive-evaluation').priority, getEvent('suspected-defection').priority);
    assert.equal(selectEvent(state).id, 'deceptive-evaluation');
    assert.equal(selectEvent(state).id, 'deceptive-evaluation');
    assert.deepEqual(state, before);
    state.seenEvents.push('deceptive-evaluation');
    assert.equal(selectEvent(state).id, 'suspected-defection');
    state.seenEvents.push('suspected-defection');
    assert.equal(selectEvent(state), null);
});

test('all 24 active events can be selected under valid campaign conditions', () => {
    const flagSets = [
        {},
        { computeRegistry: true },
        { computeRegistry: true, inspections: true },
        { computeRegistry: true, inspections: true, treatyRatified: true }
    ];
    const active = EVENTS.filter(item => !RETIRED_EVENT_IDS.includes(item.id));
    assert.equal(active.length, 24);
    for (const item of active) {
        let found = false;
        for (const flags of flagSets) {
            for (const turn of [1, 3, 5, 8, 10, 12, 16, 22, 30, 38, 46, 54]) {
                const state = preparedState(turn);
                state.player.capability = 400;
                state.flags = flags;
                state.seenEvents = EVENTS.filter(other => other.id !== item.id).map(other => other.id);
                if (selectEvent(state)?.id === item.id) found = true;
            }
        }
        assert.ok(found, `${item.id} must be reachable`);
    }
});

test('retired commercial events cannot interrupt play but retain their legacy definitions', () => {
    assert.deepEqual(RETIRED_EVENT_IDS, ['price-pressure', 'factory-autonomy']);
    assert.equal(Object.isFrozen(RETIRED_EVENT_IDS), true);
    const state = preparedState(54);
    state.seenEvents = EVENTS.filter(item => !RETIRED_EVENT_IDS.includes(item.id)).map(item => item.id);
    const before = structuredClone(state);
    for (const id of RETIRED_EVENT_IDS) {
        const item = getEvent(id);
        assert.equal(item.eligible(state), true, `${id} still has its original eligibility`);
        assert.ok(item.choices.length >= 2, `${id} keeps its in-flight save choices`);
        assert.ok(item.choices.some(option => getChoiceAvailability(state, option).available));
    }
    assert.equal(selectEvent(state), null);
    assert.deepEqual(state, before, 'selection must not mark a milestone seen');
    state.seenEvents = state.seenEvents.filter(id => id !== 'agent-contract');
    assert.equal(selectEvent(state).id, 'agent-contract', 'the initial deployment decision remains available');
    assert.deepEqual(getEvent('price-pressure').choices.map(option => option.id), ['reliability', 'autonomy', 'niche']);
    assert.deepEqual(getEvent('factory-autonomy').choices.map(option => option.id), ['bounded', 'scale', 'assist']);
});

test('factory milestone eligibility still requires its original quarter and capability thresholds', () => {
    const item = getEvent('factory-autonomy');
    const state = stateAt(9);
    state.player.capability = 110;
    assert.equal(item.eligible(state), false);
    state.turn = 10;
    state.player.capability = 109;
    assert.equal(item.eligible(state), false);
    state.rivals[0].capability = 110;
    assert.equal(item.eligible(state), true);
    assert.equal(RETIRED_EVENT_IDS.includes(item.id), true);
});

test('coordination events require their institutional prerequisites', () => {
    const state = preparedState();
    const registry = getEvent('compute-register');
    const inspections = getEvent('reciprocal-inspections');
    const pilot = getEvent('verification-pilot');
    const treaty = getEvent('treaty-table');
    assert.equal(registry.eligible(state), true);
    assert.ok(!inspections.eligible(state));
    assert.ok(!pilot.eligible(state));
    assert.ok(!treaty.eligible(state));
    state.flags.computeRegistry = true;
    assert.equal(registry.eligible(state), false);
    assert.equal(inspections.eligible(state), true);
    assert.ok(!treaty.eligible(state));
    state.flags.inspections = true;
    assert.equal(inspections.eligible(state), false);
    assert.equal(pilot.eligible(state), true);
    assert.equal(treaty.eligible(state), true);
    state.flags.treatyRatified = true;
    assert.equal(pilot.eligible(state), false);
    assert.equal(treaty.eligible(state), false);
});

test('registry and inspection invitations remain unseen until their influence prerequisite is met', () => {
    for (const [id, turn, minimum, flag] of [
        ['compute-register', 4, 16, 'computeRegistry'],
        ['reciprocal-inspections', 8, 22, 'inspections']
    ]) {
        const state = stateAt(turn);
        if (id === 'reciprocal-inspections') state.flags.computeRegistry = true;
        state.seenEvents = EVENTS.filter(item => item.id !== id).map(item => item.id);
        state.player.influence = minimum - 0.001;
        assert.equal(selectEvent(state), null, `${id} cannot consume an unavailable opening`);
        assert.equal(state.seenEvents.includes(id), false);
        state.player.influence = minimum;
        const item = selectEvent(state);
        assert.equal(item?.id, id, `${id} remains available after preparation`);
        const agreement = item.choices.find(option => option.sets?.[`flags.${flag}`]);
        assert.equal(getChoiceAvailability(state, agreement).available, true);
        state.seenEvents.push(id);
        assert.equal(selectEvent(state), null, 'a completed invitation remains a one-time decision');
    }
});

test('influence eligibility preserves the financial tradeoff and free fallback', () => {
    const state = preparedState(12);
    state.flags.computeRegistry = true;
    state.resources.funds = 0;
    for (const [id, flag] of [['compute-register', 'computeRegistry'], ['reciprocal-inspections', 'inspections']]) {
        state.flags.computeRegistry = id === 'reciprocal-inspections';
        state.seenEvents = EVENTS.filter(item => item.id !== id).map(item => item.id);
        const item = selectEvent(state);
        assert.equal(item?.id, id, 'funds do not gate the invitation itself');
        const agreement = item.choices.find(option => option.sets?.[`flags.${flag}`]);
        assert.equal(getChoiceAvailability(state, agreement).available, false);
        assert.ok(item.choices.some(option => getChoiceAvailability(state, option).available));
    }
});

test('own-lab model decisions require the player capability threshold even when rivals are ahead', () => {
    for (const [id, minimum] of [['internal-model-gap', 140], ['research-handoff', 180]]) {
        const state = stateAt(12);
        state.player.capability = 12;
        state.rivals[0].capability = 300;
        state.seenEvents = EVENTS.filter(item => item.id !== id).map(item => item.id);
        assert.equal(selectEvent(state), null, `${id} does not describe a rival's model as the player's`);
        state.player.capability = minimum - 0.001;
        assert.equal(selectEvent(state), null);
        state.player.capability = minimum;
        assert.equal(selectEvent(state)?.id, id);
        state.turn = 11;
        assert.equal(selectEvent(state), null, 'the original quarter prerequisite is preserved');
    }
});

test('a long slowdown requires new decisions about enforcement, renewal, loopholes, and readiness', () => {
    const state = preparedState();
    const schedule = [
        ['suspected-defection', 16], ['treaty-renewal', 22],
        ['slowdown-backlash', 30], ['hardware-loophole', 38], ['shared-readiness', 46]
    ];
    for (const [id, turn] of schedule) {
        const item = getEvent(id);
        state.turn = turn;
        state.flags.treatyRatified = false;
        assert.equal(item.eligible(state), false);
        state.flags.treatyRatified = true;
        state.turn = turn - 1;
        assert.equal(item.eligible(state), false);
        state.turn = turn;
        assert.equal(item.eligible(state), true);
        const demanding = item.choices.find(option => option.requirements && Object.keys(option.requirements).length);
        assert.ok(demanding, `${id} requires preparation`);
        assert.ok(Object.values(demanding.costs || {}).some(amount => amount > 0), `${id} requires resources`);
    }
});

test('treaty negotiations do not preempt the verification work needed to make a deal', () => {
    const state = preparedState(10);
    state.flags = { computeRegistry: true, inspections: true };
    state.world.verification = 30;
    state.seenEvents = EVENTS.filter(item => !['verification-pilot', 'treaty-table'].includes(item.id)).map(item => item.id);
    assert.equal(getEvent('treaty-table').eligible(state), false);
    assert.equal(selectEvent(state).id, 'verification-pilot');
    state.world.verification = 38;
    state.player.influence = 35;
    assert.equal(getEvent('treaty-table').eligible(state), false);
    state.player.influence = 38;
    assert.equal(getEvent('treaty-table').eligible(state), true);
    assert.equal(selectEvent(state).id, 'treaty-table');
});

test('the emergency opportunity remains unseen until there is enough preparation', () => {
    const state = preparedState(18);
    state.player.capability = 400;
    state.player.influence = 49;
    const emergency = getEvent('last-coordination-window');
    assert.equal(emergency.eligible(state), false);
    state.player.influence = 58;
    state.world.verification = 59;
    assert.equal(emergency.eligible(state), false);
    state.world.verification = 60;
    assert.equal(emergency.eligible(state), true);
});

test('the late rescue route is more demanding and begins with a weaker treaty', () => {
    const early = getEvent('treaty-table').choices.find(option => option.id === 'ratify');
    const late = getEvent('last-coordination-window').choices.find(option => option.id === 'emergency-deal');
    for (const path of ['player.influence', 'world.verification', 'world.coordination']) {
        assert.ok(late.requirements[path] > early.requirements[path], path);
    }
    assert.ok(late.costs['resources.funds'] > early.costs['resources.funds']);
    assert.ok(late.effects['world.treatyStability'] < early.effects['world.treatyStability']);
    assert.ok(late.effects['world.treatyCoverage'] < early.effects['world.treatyCoverage']);
});

test('availability checks exact cost and preparation thresholds without changing state', () => {
    const state = preparedState();
    const option = getEvent('treaty-table').choices.find(option => option.id === 'ratify');
    const cost = getChoiceCost(state, 'resources.funds', option.costs['resources.funds']);
    state.resources.funds = cost;
    state.player.influence = 38;
    state.world.coordination = 42;
    state.world.verification = 38;
    const before = structuredClone(state);
    assert.deepEqual(getChoiceAvailability(state, option), { available: true, reason: '' });
    assert.deepEqual(state, before);
    state.world.verification = 37;
    assert.deepEqual(getChoiceAvailability(state, option), { available: false, reason: 'Requires 38 verification; currently 37.' });
    state.world.verification = 38;
    state.resources.funds = cost - 0.001;
    assert.deepEqual(getChoiceAvailability(state, option), { available: false,
        reason: `Requires $${cost}B; currently $${cost - 0.001}B.` });
});

test('unavailable choices report current values without hiding a fractional shortfall', () => {
    const state = stateAt();
    state.player.influence = 21.999;
    state.resources.funds = 6.999;
    assert.deepEqual(getChoiceAvailability(state, { requirements: { 'player.influence': 22 } }),
        { available: false, reason: 'Requires 22 influence; currently 21.999.' });
    assert.deepEqual(getChoiceAvailability(state, { costs: { 'resources.funds': 7 } }),
        { available: false, reason: 'Requires $7B; currently $6.999B.' });
    state.player.influence = 21.5;
    assert.equal(getChoiceAvailability(state, { requirements: { 'player.influence': 22 } }).reason,
        'Requires 22 influence; currently 21.5.');
    state.player.influence = NaN;
    assert.deepEqual(getChoiceAvailability(state, { requirements: { 'player.influence': 22 } }),
        { available: false, reason: 'Requires 22 influence; current value unavailable.' });
});

test('malformed or unknown requirements fail closed rather than granting a choice', () => {
    const state = preparedState();
    for (const value of [null, [], { 'resources.funds': -1 }, { 'resources.funds': Infinity },
        { 'resources.funds': NaN }, { 'resources.funds': '3' }, { 'player.missing': 1 },
        { '__proto__.polluted': 1 }]) {
        assert.equal(getChoiceAvailability(state, { costs: value }).available, false);
        assert.equal(getChoiceAvailability(state, { requirements: value }).available, false);
    }
    state.resources.funds = NaN;
    assert.equal(getChoiceAvailability(state, { costs: { 'resources.funds': 1 } }).available, false);
    assert.equal(getChoiceAvailability(null, {}).available, false);
    assert.equal(getChoiceAvailability(state, null).available, false);
});

test('all lasting flags and policy choices have documented engine meanings', () => {
    const flagsUsed = new Set();
    for (const item of EVENTS) {
        for (const option of item.choices) {
            for (const [path, value] of Object.entries(option.sets || {})) {
                if (path.startsWith('flags.')) {
                    flagsUsed.add(path.slice(6));
                    assert.equal(typeof value, 'boolean');
                    assert.ok(FLAG_EFFECTS[path.slice(6)]);
                } else assert.ok(POLICY_VALUES[path].includes(value));
            }
        }
    }
    assert.deepEqual([...flagsUsed].sort(), Object.keys(FLAG_EFFECTS).sort());
});

test('catalog validation catches duplicate identifiers, invalid effects, and missing fallbacks', () => {
    assert.ok(validateEventCatalog([EVENTS[0], EVENTS[0]]).some(error => error.includes('duplicate event ID')));
    const badEffect = { ...EVENTS[0], choices: EVENTS[0].choices.map((option, index) => index === 0 ?
        { ...option, effects: { 'resources.funds': NaN, 'player.unknown': 5 } } : option) };
    assert.ok(validateEventCatalog([badEffect]).some(error => error.includes('invalid effects')));
    const badSet = { ...EVENTS[0], choices: EVENTS[0].choices.map(option =>
        ({ ...option, sets: { 'flags.unknown': true, 'policies.authority': 'unlimited' } })) };
    assert.ok(validateEventCatalog([badSet]).some(error => error.includes('invalid set')));
    const noFallback = { ...EVENTS[0], choices: EVENTS[0].choices.map(option =>
        ({ ...option, costs: { 'resources.funds': 1 } })) };
    assert.ok(validateEventCatalog([noFallback]).some(error => error.includes('free fallback')));
});

test('decision copy is concise, complete, and contains no unresolved interpolation', () => {
    for (const item of EVENTS) {
        assert.ok(item.body.length < 460, item.id);
        for (const option of item.choices) {
            assert.ok(option.description.length < 160, `${item.id}/${option.id}`);
        }
        const text = [item.title, item.body, ...item.choices.flatMap(option => [option.label, option.description, option.result])].join(' ');
        assert.doesNotMatch(text, /\$[a-zA-Z]|\{\{|\bTODO\b|\bTBD\b/);
    }
});
