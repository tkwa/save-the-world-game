// Ending percentages represent shares of the game's accessible future.
// Human control and personal ownership are deliberately separate outcomes.
const CATASTROPHE_REASONS = new Set(['risk-100', 'ai-escape', 'nuclear-failure']);
const TREATY_REASONS = new Set(['treaty', 'treaty-completed']);
const OUTCOME_VERSION = 1;

function bounded(value, fallback, min, max) {
    const number = Number(value);
    return Number.isNaN(number) || value === null || value === undefined
        ? fallback
        : Math.max(min, Math.min(max, number));
}

function capability(value) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function label(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
}

function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

function distribution(companyShare, otherHumanShare, equity) {
    const company = bounded(companyShare, 0, 0, 100);
    const other = bounded(otherHumanShare, 0, 0, 100 - company);
    const humanShare = company + other;
    return {
        companyShare: company,
        otherHumanShare: other,
        humanShare,
        rogueShare: 100 - humanShare,
        personalShare: company * equity
    };
}

/**
 * Resolve one terminal state without changing it. Inject rng for deterministic
 * simulations; it must return a finite number in [0, 1). riskPercent is the
 * player's already-adjusted risk. Rivals may supply their own riskPercent.
 * Legacy parallel rival arrays and stable `competitors` objects are supported.
 */
function createOutcome(state = {}, options = {}) {
    const rng = options.rng ?? Math.random;
    if (typeof rng !== 'function') throw new TypeError('Outcome RNG must be a function.');
    const riskPercent = bounded(options.riskPercent ?? state.endgameAdjustedRisk ?? state.rawRiskLevel, 20, 0, 100);
    const playerEquity = bounded(state.playerEquity, 0.1, 0, 1);
    const companyName = label(state.companyLongName ?? state.companyName, 'Your company');
    const reason = label(state.gameOverReason, 'ai-singularity');
    const catastrophe = CATASTROPHE_REASONS.has(reason);
    const route = catastrophe ? 'catastrophe' : TREATY_REASONS.has(reason) ? 'coordination'
        : reason === 'dsa-singularity' ? 'concentration' : 'competition';
    const legacyLevels = Array.isArray(state.competitorAILevels) ? state.competitorAILevels : [];
    const legacyNames = Array.isArray(state.competitorNames) ? state.competitorNames : [];
    const rivals = Array.isArray(state.competitors) ? state.competitors
        : legacyLevels.map((aiLevel, index) => ({ aiLevel, name: legacyNames[index] }));
    const usedIds = new Set(['player']);
    const participants = [{
        id: 'player', name: companyName, isPlayer: true,
        capability: capability(state.playerAILevel), riskPercent
    }, ...rivals.map((rival, index) => {
        const data = rival && typeof rival === 'object' ? rival : {};
        let id = label(data.id, `rival-${index + 1}`);
        while (usedIds.has(id)) id += `-${index + 1}`;
        usedIds.add(id);
        return {
            id,
            name: label(data.name ?? data.companyName, `Competitor ${index + 1}`),
            isPlayer: false,
            capability: capability(data.aiLevel ?? data.capability ?? data.level),
            riskPercent: bounded(data.riskPercent ?? state.competitorRiskPercents?.[index], riskPercent, 0, 100)
        };
    })];

    // Scale before squaring so very large finite capabilities cannot overflow.
    // With no positive capabilities, equal shares are the explicit fallback.
    const maxCapability = participants.reduce((max, actor) => Math.max(max, actor.capability), 0);
    const weights = participants.map(actor => maxCapability > 0 ? (actor.capability / maxCapability) ** 2 : 1);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let assigned = 0;
    participants.forEach((actor, index) => {
        actor.rawShare = index === participants.length - 1
            ? Math.max(0, 100 - assigned) : 100 * weights[index] / totalWeight;
        assigned += actor.rawShare;
        actor.roll = null;
        if (catastrophe || actor.riskPercent === 100) {
            actor.aligned = false;
        } else if (actor.rawShare === 0) {
            actor.aligned = null;
        } else if (actor.riskPercent === 0) {
            actor.aligned = true;
        } else {
            const draw = rng();
            if (typeof draw !== 'number' || !Number.isFinite(draw) || draw < 0 || draw >= 1) {
                throw new RangeError('Outcome RNG must return a finite number in [0, 1).');
            }
            actor.roll = draw;
            actor.aligned = draw >= actor.riskPercent / 100;
        }
    });

    const player = participants[0];
    const expectedCompany = catastrophe ? 0 : player.rawShare * (1 - player.riskPercent / 100);
    const expectedOther = catastrophe ? 0 : participants.slice(1).reduce(
        (sum, actor) => sum + actor.rawShare * (1 - actor.riskPercent / 100), 0);
    const actualOther = participants.slice(1).reduce((sum, actor) => sum + (actor.aligned ? actor.rawShare : 0), 0);
    const leaders = maxCapability > 0 ? participants.filter(actor => actor.capability === maxCapability) : [];
    const winner = !catastrophe && route !== 'coordination' && leaders.length > 0 ? {
        id: leaders[0].id,
        name: leaders[0].name,
        isPlayer: leaders[0].isPlayer,
        tied: leaders.length > 1,
        tiedNames: leaders.map(actor => actor.name)
    } : null;

    return freeze({
        version: OUTCOME_VERSION,
        reason,
        route,
        catastrophe,
        companyName,
        startingCompany: label(state.startingCompany, companyName),
        date: {
            month: label(state.currentMonth, 'January'),
            year: Math.trunc(bounded(state.currentYear, 2026, 1900, 9999)),
            turn: Math.trunc(bounded(state.currentTurn, 1, 1, Number.MAX_SAFE_INTEGER))
        },
        playerEquity,
        riskPercent,
        winner,
        participants,
        expected: distribution(expectedCompany, expectedOther, playerEquity),
        realized: distribution(player.aligned ? player.rawShare : 0, actualOther, playerEquity)
    });
}

/** The only mutation boundary: rendering and reloading reuse the same result. */
function ensureOutcome(state, options = {}) {
    if (!state || typeof state !== 'object') throw new TypeError('Outcome state must be an object.');
    if (state.outcome?.version === OUTCOME_VERSION) return freeze(state.outcome);
    const outcome = createOutcome(state, options);
    state.outcome = outcome;
    return outcome;
}

export { createOutcome, ensureOutcome, OUTCOME_VERSION };
