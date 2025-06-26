// Event system for Critical Path game

let eventData = null;

// Load event data from JSON file
async function loadEventData() {
    if (eventData) return eventData;
    
    try {
        const response = await fetch('events.json');
        eventData = await response.json();
        return eventData;
    } catch (error) {
        console.error('Failed to load event data:', error);
        // Fallback data in case of load failure
        return {
            safetyIncidents: ["A safety incident occurs."],
            nothingEvents: ["Nothing significant happens this month."]
        };
    }
}

// Generate a random event based on current game state
async function generateEvent() {
    const events = await loadEventData();
    
    // Calculate probability of safety incident based on doom level squared
    const safetyIncidentChance = Math.pow(gameState.doomLevel, 2) / 100;
    
    if (Math.random() * 100 < safetyIncidentChance) {
        // Safety incident occurs
        const event = generateSafetyIncident(events);
        trackEventSeen(event);
        return event;
    } else {
        // Filter events based on requirements and get available pool
        const availableEvents = getAvailableEvents(events.defaultEvents);
        const event = selectWeightedEvent(availableEvents);
        trackEventSeen(event);
        return event;
    }
}

// Track that an event has been seen
function trackEventSeen(event) {
    if (!gameState.eventsSeen[event.type]) {
        gameState.eventsSeen[event.type] = 0;
    }
    gameState.eventsSeen[event.type]++;
}

// Check if event requirements are met and hasn't been accepted yet
function getAvailableEvents(allEvents) {
    return allEvents.filter(event => {
        // Check if event has requirements
        if (event.requires) {
            for (const requirement of event.requires) {
                if (!gameState.dsaEventsAccepted.has(requirement)) {
                    return false; // Requirement not met
                }
            }
        }
        
        // Check if this event has already been accepted (one-time events)
        if (event.oneTime && gameState.dsaEventsAccepted.has(event.type)) {
            return false; // Already accepted
        }
        
        return true; // Event is available
    });
}

// Generate a safety incident event
function generateSafetyIncident(events) {
    gameState.safetyIncidentCount++;
    const fine = gameState.safetyIncidentCount;
    
    const safetyEvent = events.safetyIncidents;
    const randomText = safetyEvent.text_versions[Math.floor(Math.random() * safetyEvent.text_versions.length)];
    
    return {
        type: 'safety-incident',
        text: `${randomText} The incident draws regulatory scrutiny and ${gameState.companyName} is fined $${fine}B. Your legal team recommends increased safety measures.`,
        fine: fine
    };
}

// Select a random event from an array using weighted probabilities
function selectWeightedEvent(eventArray) {
    const totalWeight = eventArray.reduce((sum, event) => sum + (event.weight || 1), 0);
    let randomValue = Math.random() * totalWeight;
    
    for (const event of eventArray) {
        randomValue -= (event.weight || 1);
        if (randomValue <= 0) {
            // Select random text from text_versions
            const randomText = event.text_versions[Math.floor(Math.random() * event.text_versions.length)];
            
            return {
                type: event.type,
                text: randomText,
                choices: event.choices || null
            };
        }
    }
    
    // Fallback to last event if something goes wrong
    const fallbackEvent = eventArray[eventArray.length - 1];
    const randomText = fallbackEvent.text_versions[Math.floor(Math.random() * fallbackEvent.text_versions.length)];
    
    return {
        type: fallbackEvent.type,
        text: randomText,
        choices: fallbackEvent.choices || null
    };
}

// Apply event effects (called when turn finishes)
function applyEventEffects(event) {
    if (event && event.type === 'safety-incident') {
        gameState.money = Math.max(0, gameState.money - event.fine);
    }
}