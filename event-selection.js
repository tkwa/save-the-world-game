// Event data, selection, and resource costs shared by the runtime and tests.

const RESOURCE_KEYS = ['money', 'diplomacyPoints', 'productPoints', 'safetyPoints'];

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isNonnegativeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function eventWeight(event) {
    if (!isRecord(event)) return 0;
    if (event.weight === undefined) return 1;
    return isNonnegativeNumber(event.weight) ? event.weight : 0;
}

// Return null for invalid cost data so a malformed choice cannot grant resources.
function getChoiceCosts(choice) {
    if (!isRecord(choice)) return null;
    const costs = {};
    if (choice.cost !== undefined) {
        if (!isRecord(choice.cost)) return null;
        for (const [resource, amount] of Object.entries(choice.cost)) {
            if (!RESOURCE_KEYS.includes(resource) || !isNonnegativeNumber(amount)) return null;
            costs[resource] = amount;
        }
    }
    if (choice.precalculatedCosts !== undefined) {
        if (!isRecord(choice.precalculatedCosts)) return null;
        for (const [resource, amount] of Object.entries(choice.precalculatedCosts)) {
            const resourceKey = resource === 'diplomacy' ? 'diplomacyPoints' : resource;
            if (!RESOURCE_KEYS.includes(resourceKey) || !isNonnegativeNumber(amount)) return null;
            // Dynamic costs replace estimates; they are not an additional charge.
            costs[resourceKey] = amount;
        }
    }
    return costs;
}

function canPayChoiceCosts(state, choice) {
    const costs = getChoiceCosts(choice);
    if (!costs || !isRecord(state)) return false;
    return Object.entries(costs).every(([resource, amount]) => amount === 0 ||
        (isNonnegativeNumber(state[resource]) && state[resource] >= amount));
}

function payChoiceCosts(state, choice) {
    if (!canPayChoiceCosts(state, choice)) return false;
    for (const [resource, amount] of Object.entries(getChoiceCosts(choice))) {
        if (amount > 0) state[resource] -= amount;
    }
    return true;
}

function isEventTemplate(event) {
    if (!isRecord(event) || !isText(event.type) ||
        !Array.isArray(event.text_versions) || event.text_versions.length === 0 ||
        !event.text_versions.every(isText)) return false;
    if (event.title !== undefined && !isText(event.title)) return false;
    if (event.weight !== undefined && !isNonnegativeNumber(event.weight)) return false;
    if (event.customHandler !== undefined && !isText(event.customHandler)) return false;
    if (event.requires !== undefined &&
        (!Array.isArray(event.requires) || !event.requires.every(isText))) return false;
    if (event.maxTimes !== undefined &&
        (!Number.isInteger(event.maxTimes) || event.maxTimes < 0)) return false;
    if (event.aiLevelRange !== undefined) {
        if (!isRecord(event.aiLevelRange)) return false;
        const { min, max } = event.aiLevelRange;
        if ((min !== undefined && !isNonnegativeNumber(min)) ||
            (max !== undefined && !isNonnegativeNumber(max)) ||
            (min !== undefined && max !== undefined && min > max)) return false;
    }
    if (event.other_texts !== undefined &&
        (!isRecord(event.other_texts) || !Object.values(event.other_texts).every(isText))) return false;
    if (event.choices !== undefined) {
        if (!Array.isArray(event.choices) || event.choices.length === 0) return false;
        if (!event.choices.every(choice => isRecord(choice) && isText(choice.text) &&
            isText(choice.action) && getChoiceCosts(choice) !== null)) return false;
    }
    return true;
}

function validateEventData(data) {
    return isRecord(data) && isRecord(data.specialEvents) &&
        isEventTemplate(data.specialEvents.sanctions) &&
        Array.isArray(data.specialEvents.sanctions.choices) &&
        data.specialEvents.sanctions.choices.some(choice => choice.action === 'decline') &&
        Object.values(data.specialEvents).every(isEventTemplate) &&
        isEventTemplate(data.safetyIncidents) &&
        Array.isArray(data.defaultEvents) && data.defaultEvents.every(isEventTemplate);
}

function createFallbackEventData() {
    return {
        specialEvents: {
            sanctions: {
                type: 'sanctions',
                title: 'International Sanctions',
                customHandler: 'handleSanctionsChoice',
                text_versions: ['Sanctions continue to restrict your operations. Your legal team can seek relief.'],
                choices: [
                    { text: 'Remove sanctions', action: 'accept' },
                    { text: 'Continue with sanctions', action: 'decline',
                        result_text: 'Sanctions remain in effect.' }
                ]
            }
        },
        safetyIncidents: {
            type: 'safety-incident',
            title: 'Safety Incident',
            text_versions: ['A safety incident requires your team to intervene.']
        },
        defaultEvents: [{
            type: 'nothing',
            title: 'Routine Progress',
            weight: 1,
            text_versions: ['Your teams continue their work.']
        }]
    };
}

// Cache only successful loads. A failed request uses playable fallback data and
// is retried on the next call; concurrent callers share one request.
function createEventDataLoader(fetchEvents, onError = () => {}) {
    let cachedData = null;
    let pendingLoad = null;
    let version = 0;
    async function loadEventData() {
        if (cachedData) return cachedData;
        if (!pendingLoad) {
            const requestVersion = version;
            pendingLoad = Promise.resolve().then(async () => {
                try {
                    const response = await fetchEvents('events.json');
                    if (!response || response.ok !== true || typeof response.json !== 'function') {
                        throw new Error(`Event data request failed (${response?.status ?? 'unavailable'}).`);
                    }
                    const data = await response.json();
                    if (!validateEventData(data)) throw new Error('Event data has an invalid structure.');
                    if (requestVersion === version) cachedData = data;
                    return data;
                } catch (error) {
                    onError(error);
                    return createFallbackEventData();
                }
            });
        }
        const request = pendingLoad;
        try {
            return await request;
        } finally {
            if (pendingLoad === request) pendingLoad = null;
        }
    }
    // Runtime additions belong to one campaign. A reset also prevents a stale
    // in-flight response from repopulating the next campaign's cache.
    loadEventData.reset = () => {
        version++;
        cachedData = null;
        pendingLoad = null;
    };
    return loadEventData;
}

// Scaling by the largest weight avoids overflow when several finite weights
// add up to more than Number.MAX_VALUE. Zero-weight events are never selected.
function selectEventTemplate(events, random = Math.random) {
    const candidates = Array.isArray(events) ? events.filter(event =>
        isEventTemplate(event) && eventWeight(event) > 0) : [];
    if (candidates.length === 0) return null;
    const maximum = candidates.reduce((value, event) => Math.max(value, eventWeight(event)), 0);
    const total = candidates.reduce((sum, event) => sum + eventWeight(event) / maximum, 0);
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError('Event random sample must be in [0, 1).');
    }
    let remaining = sample * total;
    for (const event of candidates) {
        remaining -= eventWeight(event) / maximum;
        if (remaining < 0) return event;
    }
    return candidates[candidates.length - 1];
}

function createEventInstance(template, {
    random = Math.random,
    transformText = text => text,
    filterChoices = choices => choices || null
} = {}) {
    const event = template || createFallbackEventData().defaultEvents[0];
    const text = event.text_versions[Math.floor(random() * event.text_versions.length)];
    return {
        type: event.type,
        title: event.title || event.type,
        text: transformText(text, event.type),
        choices: filterChoices(event.choices),
        customHandler: event.customHandler || null,
        originalEventData: event
    };
}

export {
    eventWeight,
    getChoiceCosts,
    canPayChoiceCosts,
    payChoiceCosts,
    validateEventData,
    createFallbackEventData,
    createEventDataLoader,
    selectEventTemplate,
    createEventInstance
};
