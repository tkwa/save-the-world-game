// Small state transitions shared by the legacy campaign and its regression tests.
export function growCompetitors(state, rng, divisor = 25) {
    if (state.statusEffects?.shaken?.restrictionsActive) return;
    const mean = Math.max(0, ...state.competitorAILevels) / divisor;
    const rivals = state.competitorAILevels.map((level, index) => ({
        name: state.competitorNames[index],
        level: level - Math.log(Math.max(Number.MIN_VALUE, rng())) * mean
    })).sort((a, b) => b.level - a.level);
    state.competitorAILevels = rivals.map(rival => rival.level);
    state.competitorNames = rivals.map(rival => rival.name);
}

export function ratifyTreaty(state) {
    if (state.internationalTreatyRatified || state.internationalTreatyProgress < 2000) return false;
    state.internationalTreatyProgress = 2000;
    state.internationalTreatyRatified = true;
    state.internationalTreatyRatificationTurn = state.currentTurn;
    return true;
}

export function createCommandGate() {
    let epoch = 0;
    let turnPending = false;
    let choicePending = false;
    let consumedChoices = new WeakSet();
    return {
        reset() {
            epoch++;
            turnPending = false;
            choicePending = false;
            consumedChoices = new WeakSet();
        },
        beginTurn(state) {
            if (turnPending || !state.selectedAllocation || state.gameOverReason ||
                (state.currentEvent?.choices?.length && !state.currentEvent.resolved && !state.currentEvent.showResult)) return null;
            turnPending = true;
            return epoch;
        },
        endTurn(token) { if (token === epoch) turnPending = false; },
        isCurrent(token) { return token === epoch; },
        beginChoice(state, index, canAfford) {
            const event = state.currentEvent;
            if (turnPending || choicePending || state.gameOverReason || !state.selectedAllocation || event?.showResult ||
                !Number.isInteger(index) || index < 0 || !event?.choices?.[index]) return null;
            const choice = event.choices[index];
            if (consumedChoices.has(choice) || !canAfford(state, choice)) return null;
            consumedChoices.add(choice);
            choicePending = true;
            return epoch;
        },
        endChoice(token) { if (token === epoch) choicePending = false; }
    };
}
