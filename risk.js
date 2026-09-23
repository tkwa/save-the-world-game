// Scenario parameters, not measured probabilities for the named companies.
// A cap is an individual lab's quarterly probability ceiling. Rates are
// competing hazard intensities, so the final attributed probabilities add up.
const BASELINE_SHAPE = 1e-6;
const DEPLOYMENT_EXPOSURE = Object.freeze({ cautious: 0.5, gated: 0.8, open: 0.95, rushed: 1 });
const AUTHORITY_EXPOSURE = Object.freeze({ 'human-checkpoints': 0.6, 'shared-council': 0.5, delegate: 1 });
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function finite(value, label) {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
    return value;
}

function fraction(value, label) {
    return clamp(finite(value, label) / 100, 0, 1);
}

function growthShape(eci) {
    const x = Math.max(0, (eci - 190) / 35);
    const exponent = 5 * x * x;
    // This equals g/(1+g), where g = expm1(5*x*x)/expm1(5), without
    // overflowing for a far-superhuman capability or losing small increments.
    const saturation = -Math.expm1(-exponent) /
        (1 + (Math.expm1(5) - 1) * Math.exp(-exponent));
    return BASELINE_SHAPE + (1 - BASELINE_SHAPE) * saturation;
}

function monitoringWindow(eci) {
    const x = clamp((eci - 180) / 45, 0, 1);
    return 1 - x * x * (3 - 2 * x);
}

function labHazard(id, capability, alignment, monitoring, exposure, capabilityToECI) {
    if (finite(capability, 'Capability') < 0) throw new RangeError('Capability must be nonnegative.');
    const eci = finite(capabilityToECI(capability), 'ECI');
    const cap = 0.002 + 0.4 * Math.pow(1 - alignment, 3);
    const suppression = 1 - 0.95 * monitoring * monitoringWindow(eci);
    const probability = cap * growthShape(eci) * exposure * suppression;
    return { id, eci, cap, rate: -Math.log1p(-probability) };
}

/**
 * Conditional risk during one quarter, given survival to its start.
 * Each attributedRisk is the mutually exclusive share of the first catastrophe
 * attributed to that lab under constant competing hazards for this quarter.
 * No random draws, campaign mutations, or implicit safety transfer occur here.
 */
export function getQuarterlyRisk(state, capabilityToECI, { authorityChoice = null, deployedLabId = state?.labId } = {}) {
    if (!state || typeof state.labId !== 'string' || !state.labId || !Array.isArray(state.rivals)
        || typeof capabilityToECI !== 'function') throw new TypeError('Invalid risk model inputs.');
    const deployment = state.policies?.deployment;
    if (!Object.hasOwn(DEPLOYMENT_EXPOSURE, deployment)) throw new RangeError('Unknown deployment policy.');
    if (authorityChoice !== null && !Object.hasOwn(AUTHORITY_EXPOSURE, authorityChoice)) {
        throw new RangeError('Unknown authority choice.');
    }
    if (authorityChoice !== null && deployedLabId !== state.labId
        && !state.rivals.some(rival => rival.id === deployedLabId)) throw new RangeError('Unknown deployed lab.');
    const research = state.research;
    const ownMonitoring = 0.55 * fraction(research?.control, 'Control')
        + 0.30 * fraction(research?.evals, 'Evaluations')
        + 0.15 * fraction(research?.interpretability, 'Interpretability');
    const ownExposure = authorityChoice !== null && deployedLabId === state.labId
        ? AUTHORITY_EXPOSURE[authorityChoice] : DEPLOYMENT_EXPOSURE[deployment];
    const labs = [labHazard(state.labId, state.player?.capability,
        fraction(research?.alignment, 'Alignment'), ownMonitoring, ownExposure, capabilityToECI)];
    const ids = new Set([state.labId]);
    for (const rival of state.rivals) {
        if (typeof rival?.id !== 'string' || !rival.id || ids.has(rival.id)) throw new RangeError('Invalid or duplicate rival identifier.');
        ids.add(rival.id);
        // Published safety work already changes rival.safety in the campaign.
        // Local monitoring and security do not protect another lab by default.
        const safety = fraction(rival.safety, 'Rival safety');
        const monitoring = 0.65 * safety + 0.35 * fraction(rival.security, 'Rival security');
        const exposure = authorityChoice !== null && deployedLabId === rival.id ? AUTHORITY_EXPOSURE[authorityChoice] : 1;
        labs.push(labHazard(rival.id, rival.capability, safety, monitoring, exposure, capabilityToECI));
    }
    const totalRate = labs.reduce((sum, lab) => sum + lab.rate, 0);
    const total = -Math.expm1(-totalRate);
    const byLab = labs.map(lab => ({ ...lab, attributedRisk: totalRate === 0 ? 0 : total * (lab.rate / totalRate) }));
    const own = byLab[0].attributedRisk;
    return { own, others: total - own, total, byLab };
}
