// Event system for Critical Path game

// Company metadata shared across the game
const COMPANIES = [
    { name: "OpenAI", longName: "OpenAI", homeCountry: "US", flag: "🇺🇸" },
    { name: "Anthropic", longName: "Anthropic", homeCountry: "US", flag: "🇺🇸" },
    { name: "DeepMind", longName: "Google DeepMind", homeCountry: "UK", flag: "🇬🇧" },
    { name: "DeepSeek", longName: "DeepSeek", homeCountry: "CN", flag: "🇨🇳" },
    { name: "Tencent", longName: "Tencent", homeCountry: "CN", flag: "🇨🇳" },
    { name: "xAI", longName: "xAI", homeCountry: "US", flag: "🇺🇸" }
];

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
    
    // Sanctions event has 100% probability if sanctions are active
    if (gameState.hasSanctions) {
        const sanctionsEvent = events.specialEvents.sanctions;
        const randomText = sanctionsEvent.text_versions[Math.floor(Math.random() * sanctionsEvent.text_versions.length)];
        
        // Calculate scaled costs for dynamic choice text
        const aiLevel = gameState.playerAILevel;
        const scaledMoneyCost = Math.max(3, Math.round(aiLevel * 0.2));
        const scaledDiplomacyCost = Math.max(3, Math.round(aiLevel * 0.15));
        
        // Create choices with dynamic costs
        const dynamicChoices = sanctionsEvent.choices.map(choice => {
            if (choice.action === 'accept') {
                return {
                    ...choice,
                    text: `Remove sanctions (-$${scaledMoneyCost}B, -${scaledDiplomacyCost} Diplomacy)`
                };
            }
            return choice;
        });
        
        const event = {
            type: sanctionsEvent.type,
            text: randomText,
            choices: dynamicChoices,
            customHandler: sanctionsEvent.customHandler
        };
        trackEventSeen(event);
        return event;
    }
    
    // Calculate probability of safety incidents
    const adjustedRisk = calculateAdjustedRisk();
    const safetyIncidentChance = Math.pow(adjustedRisk, 2) / 100;
    const severeIncidentChance = Math.pow(adjustedRisk, 3) * gameState.playerAILevel / 100000; // Divide by 100000 instead of 1000 for proper scaling
    
    if (Math.random() * 100 < severeIncidentChance) {
        // Severe safety incident occurs
        const event = generateSevereSecurityIncident(events);
        trackEventSeen(event);
        return event;
    } else if (Math.random() * 100 < safetyIncidentChance) {
        // Regular safety incident occurs
        const event = generateSafetyIncident(events);
        trackEventSeen(event);
        return event;
    } else {
        // Filter events based on requirements and get available pool
        const availableEvents = getAvailableEvents(events.defaultEvents);
        
        // Debug: Log available event types to console
        console.log('Available event types in pool:', availableEvents.map(e => e.type));
        console.log('Completed one-time events:', Array.from(gameState.eventsAccepted));
        
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
    
    // Also track appearance count for maxTimes filtering
    const currentCount = gameState.eventAppearanceCounts.get(event.type) || 0;
    gameState.eventAppearanceCounts.set(event.type, currentCount + 1);
}

// Check if event requirements are met and hasn't been accepted yet
function getAvailableEvents(allEvents) {
    return allEvents.filter(event => {
        // Check if event has requirements
        if (event.requires) {
            for (const requirement of event.requires) {
                if (!gameState.eventsAccepted.has(requirement)) {
                    return false; // Requirement not met
                }
            }
        }
        
        
        // Check special requirements for safety research limitations
        if (event.type === 'safety-research-limitations') {
            if (gameState.safetyPoints < 100) {
                return false; // Need at least 100 safety points
            }
        }
        
        // Check special requirements for competitor acquisition
        if (event.type === 'competitor-acquisition') {
            const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
            if (maxCompetitorLevel < gameState.playerAILevel * 2) {
                return false; // Need a competitor at least 2x player level
            }
        }
        
        // Check special requirements for falling behind
        if (event.type === 'falling-behind') {
            const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
            if (gameState.playerAILevel >= maxCompetitorLevel) {
                return false; // Player must be behind the top competitor
            }
            // Also check if this is the first time falling behind
            if (!gameState.hasEverFallenBehind) {
                gameState.hasEverFallenBehind = true; // Mark that player has fallen behind
                return true; // Trigger the event
            } else {
                return false; // Already triggered once
            }
        }
        
        // Check if this event has already been accepted (oneTimeAccept events)
        if (event.oneTimeAccept && gameState.eventsAccepted.has(event.type)) {
            return false; // Already accepted
        }
        
        // Check if this event has exceeded maxTimes appearances
        if (event.maxTimes) {
            const appearanceCount = gameState.eventAppearanceCounts.get(event.type) || 0;
            if (appearanceCount >= event.maxTimes) {
                return false; // Already appeared maximum times
            }
        }
        
        // Check AI level range requirements
        if (event.aiLevelRange) {
            const playerLevel = gameState.playerAILevel;
            if (event.aiLevelRange.min !== undefined && playerLevel < event.aiLevelRange.min) {
                return false; // Player AI level too low
            }
            if (event.aiLevelRange.max !== undefined && playerLevel > event.aiLevelRange.max) {
                return false; // Player AI level too high
            }
        }
        
        return true; // Event is available
    });
}


// Generate a safety incident event
function generateSafetyIncident(events) {
    gameState.safetyIncidentCount++;
    const fine = Math.floor(gameState.safetyIncidentCount ** 1.5);
    
    const safetyEvent = events.safetyIncidents;
    const randomText = safetyEvent.text_versions[Math.floor(Math.random() * safetyEvent.text_versions.length)];
    
    return {
        type: 'safety-incident',
        text: boldifyNumbers(`${randomText} The incident draws regulatory scrutiny and ${gameState.companyName} is fined $${fine}B. Your legal team recommends increased safety measures.`),
        fine: fine
    };
}

// Generate a severe safety incident event
function generateSevereSecurityIncident(events) {
    gameState.safetyIncidentCount++;
    const fine = Math.floor(gameState.safetyIncidentCount ** 1.5);
    
    const safetyEvent = events.safetyIncidents;
    const randomText = safetyEvent.text_versions[Math.floor(Math.random() * safetyEvent.text_versions.length)];
    
    // Apply sanctions unless superpersuasion tech is active
    const applySanctions = !gameState.technologies.persuasion;
    
    const sanctionsText = applySanctions ? 
        " International authorities respond with comprehensive sanctions against your company." : 
        " Your superpersuasion technology helps mitigate the diplomatic fallout, avoiding sanctions.";
    
    return {
        type: 'severe-safety-incident',
        text: boldifyNumbers(`${randomText} This severe incident triggers an international crisis of confidence in AI safety. ${gameState.companyName} faces a massive $${fine}B fine and intense regulatory scrutiny.${sanctionsText}`),
        fine: fine,
        applySanctions: applySanctions
    };
}

// Simple variable substitution function using a dictionary
function substituteVariables(text, variables) {
    let substitutedText = text;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp('\\$' + key, 'g');
        substitutedText = substitutedText.replace(regex, value);
    }
    return substitutedText;
}

// Create variable dictionary for specific event types
function createEventVariables(eventType) {
    const variables = {};
    
    // Common variables available to all events
    variables.companyName = gameState.companyName || 'Your company';
    variables.playerLevel = `${Math.round(gameState.playerAILevel)}x`;
    
    if (eventType === 'overseas-datacenter' || eventType === 'second-datacenter' || eventType === 'nuclear-weapons') {
        if (eventType === 'overseas-datacenter') {
            // Pick a random country for the datacenter event and store it
            const countries = GAME_CONSTANTS.DATACENTER_COUNTRIES;
            const country = countries[Math.floor(Math.random() * countries.length)];
            gameState.datacenterCountry = country;
            variables.country = country;
            
            // Add Chinese company specific text for overseas datacenter
            if (gameState.companyCountry === 'CN') {
                variables.chineseCompanyText = ' This involves navigating US export controls on Chinese companies.';
            } else {
                variables.chineseCompanyText = '';
            }
        } else if ((eventType === 'second-datacenter' || eventType === 'nuclear-weapons') && gameState.datacenterCountry) {
            // Use the previously stored datacenter country for second datacenter and nuclear weapons
            variables.country = gameState.datacenterCountry;
        }
    }
    
    if (eventType === 'competitor-breakthrough') {
        // Calculate market share before breakthrough
        const playerLevel = gameState.playerAILevel;
        const competitorPenaltyBefore = gameState.competitorAILevels.reduce((sum, yLevel) => {
            return sum + Math.pow(yLevel / playerLevel, 2);
        }, 0);
        const marketShareBefore = (1 / (1 + competitorPenaltyBefore)) * 100;
        
        // Randomly select a competitor and store for later use
        const randomCompetitorIndex = Math.floor(Math.random() * gameState.competitorAILevels.length);
        const competitorName = gameState.competitorNames[randomCompetitorIndex] || `Competitor ${randomCompetitorIndex + 1}`;
        gameState.breakthroughCompetitorIndex = randomCompetitorIndex;
        
        // Permanently double competitor capability
        gameState.competitorAILevels[randomCompetitorIndex] *= 2;
        const newCompetitorLevel = gameState.competitorAILevels[randomCompetitorIndex];
        
        const competitorPenaltyAfter = gameState.competitorAILevels.reduce((sum, yLevel) => {
            return sum + Math.pow(yLevel / playerLevel, 2);
        }, 0);
        const marketShareAfter = (1 / (1 + competitorPenaltyAfter)) * 100;
        
        // Determine surpassing text based on levels
        let surpassingText = '';
        if (newCompetitorLevel > playerLevel) {
            surpassingText = `, surpassing ${gameState.companyName || 'your company'}`;
        }
        
        // Get player's AI system name
        const playerAISystemName = getAISystemVersion(gameState.companyName || 'Company', gameState.playerAILevel);
        
        variables.competitorName = competitorName;
        variables.aiSystemName = playerAISystemName;
        variables.newCompetitorLevel = `${Math.round(newCompetitorLevel)}x`;
        variables.surpassingText = surpassingText;
        variables.marketShareBefore = (Math.round(marketShareBefore * 10) / 10).toString();
        variables.marketShareAfter = (Math.round(marketShareAfter * 10) / 10).toString();
    }
    
    if (eventType === 'competitor-acquisition') {
        // Find the leading competitor (at least 2x player level)
        let leadingCompetitorIndex = -1;
        let maxCompetitorLevel = 0;
        
        for (let i = 0; i < gameState.competitorAILevels.length; i++) {
            if (gameState.competitorAILevels[i] >= gameState.playerAILevel * 2 && 
                gameState.competitorAILevels[i] > maxCompetitorLevel) {
                leadingCompetitorIndex = i;
                maxCompetitorLevel = gameState.competitorAILevels[i];
            }
        }
        
        if (leadingCompetitorIndex !== -1) {
            const competitorName = gameState.competitorNames[leadingCompetitorIndex] || `Competitor ${leadingCompetitorIndex + 1}`;
            gameState.acquisitionCompetitorIndex = leadingCompetitorIndex;
            
            // Calculate fair value: X^2 / (X^2 + Y^2) where X = player, Y = competitor
            const playerLevel = gameState.playerAILevel;
            const competitorLevel = maxCompetitorLevel;
            const fairValue = (playerLevel ** 2) / (playerLevel ** 2 + competitorLevel ** 2);
            
            // Random offer between 30% and 100% of fair value for the TOTAL company
            const offerMultiplier = 0.3 + Math.random() * 0.7; // 0.3 to 1.0
            const totalCompanyEquityOffered = fairValue * offerMultiplier;
            
            // Player owns 10% of their current company, so they get 10% of the total equity offered
            const playerEquityReceived = totalCompanyEquityOffered * gameState.playerEquity; // playerEquity is 0.1 (10%)
            
            // Store both values for use in the handler
            gameState.totalEquityOffered = totalCompanyEquityOffered;
            gameState.offeredEquity = playerEquityReceived;
            
            // Format total equity as percentage for display (what the company gets)
            const totalEquityPercent = Math.round(totalCompanyEquityOffered * 100 * 10) / 10; // Round to 1 decimal place
            
            variables.competitorName = competitorName;
            variables.competitorLevel = `${Math.round(maxCompetitorLevel)}x`;
            variables.equityOffer = `${totalEquityPercent}%`;
        }
    }
    
    if (eventType === 'falling-behind') {
        // Find the leading competitor who overtook the player
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const leadingCompetitorIndex = gameState.competitorAILevels.findIndex(level => level === maxCompetitorLevel);
        const competitorName = gameState.competitorNames[leadingCompetitorIndex] || `Competitor ${leadingCompetitorIndex + 1}`;
        
        variables.competitorName = competitorName;
        variables.competitorLevel = `${Math.round(maxCompetitorLevel)}x`;
    }
    
    return variables;
}

// Helper function to automatically bold numbers, percentages, and multipliers
function boldifyNumbers(text) {
    if (!text) return text;
    
    // Split by <strong> tags to avoid double-bolding
    const parts = text.split(/(<strong>.*?<\/strong>)/);
    
    for (let i = 0; i < parts.length; i += 2) { // Only process non-strong parts (even indices)
        if (parts[i]) {
            // Bold percentages: 50%, 12.5%, etc.
            parts[i] = parts[i].replace(/\b(\d+(?:\.\d+)?%)\b/g, '<strong>$1</strong>');
            
            // Bold multipliers: 17x, 2.5x, etc.
            parts[i] = parts[i].replace(/\b(\d+(?:\.\d+)?x)\b/g, '<strong>$1</strong>');
            
            // Bold numbers in specific game contexts (more targeted approach)
            // Numbers after "reaching", "remains at", "drops from", "to"
            parts[i] = parts[i].replace(/\b(reaching|remains at|drops from|to)\s+(\d+(?:\.\d+)?)\b/gi, '$1 <strong>$2</strong>');
            
            // Numbers with currency symbols: $3B, $10M, etc.
            parts[i] = parts[i].replace(/(\$\d+(?:\.\d+)?[BM]?)\b/g, '<strong>$1</strong>');
            
            // Standalone numbers at start of sentences or after punctuation (likely metrics)
            parts[i] = parts[i].replace(/(^|[.!?]\s+)(\d+(?:\.\d+)?)\b/g, '$1<strong>$2</strong>');
        }
    }
    
    return parts.join('');
}

// Helper function to substitute variables in event text (legacy wrapper)
function substituteEventVariables(text, eventType) {
    const variables = createEventVariables(eventType);
    let result = substituteVariables(text, variables);
    
    // Apply automatic number bolding after variable substitution
    result = boldifyNumbers(result);
    
    return result;
}

// Filter choices based on boolean conditions in gameState
function filterChoicesByCondition(choices) {
    if (!choices) return null;
    
    return choices.filter(choice => {
        // Check if choice has a condition
        if (choice.condition) {
            // Simple boolean check: choice.condition should be a string key in gameState
            const conditionKey = choice.condition;
            if (typeof conditionKey === 'string') {
                return gameState[conditionKey] === true;
            }
        }
        // If no condition, always include the choice
        return true;
    });
}

// Select a random event from an array using weighted probabilities
function selectWeightedEvent(eventArray) {
    const totalWeight = eventArray.reduce((sum, event) => sum + (event.weight || 1), 0);
    let randomValue = Math.random() * totalWeight;
    
    for (const event of eventArray) {
        randomValue -= (event.weight || 1);
        if (randomValue <= 0) {
            // Select random text from text_versions
            let randomText = event.text_versions[Math.floor(Math.random() * event.text_versions.length)];
            
            // Apply variable substitution
            randomText = substituteEventVariables(randomText, event.type);
            
            // Filter choices based on conditions
            const filteredChoices = filterChoicesByCondition(event.choices);
            
            return {
                type: event.type,
                text: randomText,
                choices: filteredChoices,
                customHandler: event.customHandler || null,
                originalEventData: event // Preserve original data for multi-stage access
            };
        }
    }
    
    // Fallback to last event if something goes wrong
    const fallbackEvent = eventArray[eventArray.length - 1];
    let randomText = fallbackEvent.text_versions[Math.floor(Math.random() * fallbackEvent.text_versions.length)];
    
    // Apply variable substitution to fallback
    randomText = substituteEventVariables(randomText, fallbackEvent.type);
    
    // Filter choices based on conditions for fallback too
    const filteredChoices = filterChoicesByCondition(fallbackEvent.choices);
    
    return {
        type: fallbackEvent.type,
        text: randomText,
        choices: filteredChoices,
        customHandler: fallbackEvent.customHandler || null,
        originalEventData: fallbackEvent // Preserve original data for multi-stage access
    };
}

// Apply event effects (called when turn finishes)
function applyEventEffects(event) {
    if (event && event.type === 'safety-incident') {
        gameState.money = Math.max(0, gameState.money - event.fine);
    } else if (event && event.type === 'severe-safety-incident') {
        // Apply fine
        gameState.money = Math.max(0, gameState.money - event.fine);
        // Apply sanctions if required
        if (event.applySanctions) {
            gameState.hasSanctions = true;
        }
    }
}

// Populate debug dropdown with all available event types
function populateDebugDropdown() {
    const dropdown = document.getElementById('debugEventDropdown');
    if (!dropdown) return;
    
    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">Debug: Force Event</option>';
    
    // Add special events
    dropdown.innerHTML += '<option value="sanctions">Sanctions</option>';
    dropdown.innerHTML += '<option value="safety-incident">Safety Incident</option>';
    
    // Add default events from JSON
    loadEventData().then(events => {
        events.defaultEvents.forEach(event => {
            dropdown.innerHTML += `<option value="${event.type}">${event.type}</option>`;
        });
    });
}

// Helper function to apply choice effects (costs, benefits, penalties, risks)
function applyChoiceEffects(choice) {
    if (choice.action === 'accept' || choice.action === 'accept-sanctions') {
        // Apply costs
        if (choice.cost) {
            if (choice.cost.productPoints) gameState.productPoints -= choice.cost.productPoints;
            if (choice.cost.diplomacyPoints) gameState.diplomacyPoints -= choice.cost.diplomacyPoints;
            if (choice.cost.money) gameState.money -= choice.cost.money;
        }
        
        // Apply benefits
        if (choice.benefit) {
            if (choice.benefit.incomeBonus) {
                gameState.incomeBonus = (gameState.incomeBonus || 0) + choice.benefit.incomeBonus;
            }
            if (choice.benefit.aiLevelPerTurn) {
                gameState.aiLevelPerTurn = (gameState.aiLevelPerTurn || 0) + choice.benefit.aiLevelPerTurn;
            }
            if (choice.benefit.resourceMultiplier) {
                gameState.resourceMultiplier = choice.benefit.resourceMultiplier;
            }
            if (choice.benefit.diplomacyMultiplier) {
                gameState.diplomacyMultiplier = (gameState.diplomacyMultiplier || 1) * choice.benefit.diplomacyMultiplier;
            }
            if (choice.benefit.activateTechnology) {
                gameState.technologies[choice.benefit.activateTechnology] = true;
            }
        }
        
        // Apply penalties (guaranteed negative effects)
        if (choice.penalty) {
            if (choice.penalty.doomLevel) {
                gameState.doomLevel += choice.penalty.doomLevel;
            }
            if (choice.penalty.sanctions) {
                gameState.hasSanctions = true;
            }
        }
        
        // Apply risks (probability-based negative effects)
        if (choice.risk) {
            if (choice.risk.sanctions && Math.random() < choice.risk.sanctions) {
                gameState.hasSanctions = true;
                return true; // Return true if sanctions were triggered
            }
        }
    }
    return false; // Return false if no sanctions were triggered
}

// Multi-stage event helper system
class MultiStageEventManager {
    constructor() {
        this.stageData = new Map(); // Store stage data per event type
    }
    
    // Initialize a multi-stage event
    initStage(eventType, stageId, stageData = {}) {
        if (!this.stageData.has(eventType)) {
            this.stageData.set(eventType, {});
        }
        
        const eventStages = this.stageData.get(eventType);
        eventStages.currentStage = stageId;
        eventStages.data = { ...eventStages.data, ...stageData };
        
        return eventStages;
    }
    
    // Get current stage data for an event
    getStageData(eventType) {
        return this.stageData.get(eventType) || { currentStage: null, data: {} };
    }
    
    // Transition to next stage with new choices and text
    nextStage(eventType, stageId, text, choices, stageData = {}) {
        const stages = this.initStage(eventType, stageId, stageData);
        
        // Update current event with new stage content
        gameState.currentEvent = {
            type: eventType,
            text: text,
            choices: choices,
            customHandler: gameState.currentEvent?.customHandler || null,
            isMultiStage: true,
            currentStage: stageId,
            originalEventData: gameState.currentEvent?.originalEventData // Preserve original data
        };
        
        this.refreshUI();
        return stages;
    }
    
    // Enhanced method to use other_texts for stage content
    nextStageFromOtherTexts(eventType, stageId, otherTextKey, choices, stageData = {}) {
        // Get the original event to access other_texts
        const originalEvent = gameState.currentEvent?.originalEventData;
        if (!originalEvent || !originalEvent.other_texts || !originalEvent.other_texts[otherTextKey]) {
            console.warn(`other_texts key "${otherTextKey}" not found for event ${eventType}`);
            return this.nextStage(eventType, stageId, `Stage ${stageId} text not found`, choices, stageData);
        }
        
        const stageText = originalEvent.other_texts[otherTextKey];
        
        // Apply variable substitution to the stage text
        const processedText = substituteEventVariables(stageText, eventType);
        
        return this.nextStage(eventType, stageId, processedText, choices, stageData);
    }
    
    // Enhanced method to complete event using other_texts
    completeEventFromOtherTexts(eventType, otherTextKey, variables = {}) {
        const originalEvent = gameState.currentEvent?.originalEventData;
        if (!originalEvent || !originalEvent.other_texts || !originalEvent.other_texts[otherTextKey]) {
            console.warn(`other_texts key "${otherTextKey}" not found for event ${eventType}`);
            return this.completeEvent(eventType, `Event completion text not found`);
        }
        
        let resultText = originalEvent.other_texts[otherTextKey];
        
        // Apply custom variable substitution if provided
        if (Object.keys(variables).length > 0) {
            resultText = substituteVariables(resultText, variables);
        } else {
            // Apply standard event variable substitution
            resultText = substituteEventVariables(resultText, eventType);
        }
        
        return this.completeEvent(eventType, resultText);
    }
    
    // Complete the event and clean up
    completeEvent(eventType, resultText) {
        this.stageData.delete(eventType);
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
        
        this.refreshUI();
    }
    
    // Standard UI refresh for all handlers
    refreshUI() {
        updateStatusBar();
        showPage('main-game');
    }
    
    // Helper to create standardized choice objects
    createChoice(text, action, options = {}) {
        return {
            text,
            action,
            ...options
        };
    }
}

// Global instance for multi-stage events
const multiStageManager = new MultiStageEventManager();

// Helper function for simple custom handlers (reduces boilerplate)
function createSimpleHandler(handlerFn) {
    return function(choice, event, sanctionsTriggered) {
        const result = handlerFn(choice, event, sanctionsTriggered);
        
        if (result && result.resultText) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = result.resultText;
        }
        
        updateStatusBar();
        showPage('main-game');
    };
}

// Custom event handlers for events with risk/success-failure mechanics

function handleOverseasDatacenterChoice(choice, event, sanctionsTriggered) {
    console.log('Calling custom handler: handleOverseasDatacenterChoice');
    
    if (choice.action === 'accept' || choice.action === 'accept-sanctions') {
        // Increment datacenter count for successful construction
        gameState.datacenterCount++;
        
        if (choice.action === 'accept-sanctions') {
            let resultText;
            if (sanctionsTriggered) {
                resultText = event.originalEventData.other_texts.sanctions_triggered;
            } else {
                resultText = event.originalEventData.other_texts.sanctions_avoided;
            }
            
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = resultText;
        } else {
            // Handle diplomatic route normally
            if (choice.result_text) {
                gameState.currentEvent.showResult = true;
                gameState.currentEvent.resultText = choice.result_text;
            }
        }
    } else {
        // Handle decline or other choices
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleSecondDatacenterChoice(choice, event, sanctionsTriggered) {
    console.log('Calling custom handler: handleSecondDatacenterChoice');
    
    if (choice.action === 'accept') {
        // Increment datacenter count for the second datacenter
        gameState.datacenterCount++;
        
        // Add powerplant (could be tracked separately if needed)
        gameState.powerplantCount = (gameState.powerplantCount || 0) + 1;
        
        // Set flag for COO being a minister (for other events to reference)
        gameState.cooIsMinister = true;
        
        // Show result text from other_texts or fallback to choice result_text
        gameState.currentEvent.showResult = true;
        if (event && event.other_texts && event.other_texts.accepted) {
            // Apply country variable substitution to the result text
            let resultText = event.other_texts.accepted;
            if (gameState.datacenterCountry) {
                resultText = resultText.replace(/\$country/g, gameState.datacenterCountry);
            }
            gameState.currentEvent.resultText = resultText;
        } else if (choice.result_text) {
            // Also apply variable substitution to choice result text
            let resultText = choice.result_text;
            if (gameState.datacenterCountry) {
                resultText = resultText.replace(/\$country/g, gameState.datacenterCountry);
            }
            gameState.currentEvent.resultText = resultText;
        }
    } else {
        // Handle decline normally
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleNuclearWeaponsChoice(choice, event, sanctionsTriggered) {
    if (choice.action === 'accept') {
        let resultText;
        if (sanctionsTriggered) {
            resultText = event.originalEventData.other_texts.sanctions_triggered;
        } else {
            resultText = event.originalEventData.other_texts.sanctions_avoided;
        }
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleMissileDefenseChoice(choice, event, sanctionsTriggered) {
    if (choice.action === 'accept') {
        let resultText;
        if (sanctionsTriggered) {
            resultText = event.originalEventData.other_texts.sanctions_triggered;
        } else {
            resultText = event.originalEventData.other_texts.sanctions_avoided;
        }
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleCompetitorBreakthroughChoice(choice, _event, _sanctionsTriggered) {
    console.log('Calling custom handler: handleCompetitorBreakthroughChoice');
    
    // Use the competitor index stored during text substitution
    const competitorIndex = gameState.breakthroughCompetitorIndex;
    const competitorName = gameState.competitorNames[competitorIndex] || `Competitor ${competitorIndex + 1}`;
    
    // Competitor capability was already doubled during text substitution
    
    if (choice.action === 'accept') {
        // 25% chance to gain player capability, 75% chance the competitor was careful
        const scanSuccessful = Math.random() < 0.25;
        
        // Get current AI system name for result text
        const currentAISystemName = getAISystemVersion(gameState.companyName || 'Company', gameState.playerAILevel);
        
        let resultText;
        if (scanSuccessful) {
            const competitorLevel = gameState.competitorAILevels[competitorIndex];
            const playerLevel = gameState.playerAILevel;
            
            let improvementMultiplier;
            if (competitorLevel > playerLevel) {
                // Competitor surpassed player, so full doubling
                improvementMultiplier = 2;
            } else {
                // Player already ahead, so limited improvement: 2^(competitorLevel/playerLevel)
                improvementMultiplier = Math.pow(2, competitorLevel / playerLevel);
            }
            
            gameState.playerAILevel *= improvementMultiplier;
            // Update sidebar immediately to show player capability change
            updateStatusBar();
            
            // Get new AI system name after improvement
            const newAISystemName = getAISystemVersion(gameState.companyName || 'Company', gameState.playerAILevel);
            
            // Recalculate market share after player improvement
            const finalCompetitorPenalty = gameState.competitorAILevels.reduce((sum, yLevel) => {
                return sum + Math.pow(yLevel / gameState.playerAILevel, 2);
            }, 0);
            const finalMarketShare = (1 / (1 + finalCompetitorPenalty)) * 100;
            
            let improvementText;
            if (improvementMultiplier === 2) {
                improvementText = `The breakthrough is entirely novel! Your team rapidly implements their techniques, doubling your AI capabilities and upgrading to ${newAISystemName}`;
            } else {
                const roundedMultiplier = Math.round(improvementMultiplier * 100) / 100;
                improvementText = `Your team discovers that ${gameState.companyName || 'your company'} was already partially using similar techniques. The stolen insights provide a ${roundedMultiplier}x improvement, upgrading to ${newAISystemName}`;
            }
            
            resultText = `${currentAISystemName} successfully infiltrates ${competitorName}'s communications and reverse-engineers their breakthrough. ${improvementText}. Market share recovers to <strong>${Math.round(finalMarketShare * 10) / 10}%</strong>. However, traces of your intrusion may have been left behind.`;
        } else {
            resultText = `${currentAISystemName} scans thousands of communications but finds that ${competitorName} has been extremely careful with their intellectual property. No significant insights are gained, though traces of your intrusion may have been left behind.`;
        }
        
        // 25% chance to add investigation event to pool (independent of scan success)
        if (Math.random() < 0.25) {
            // Add investigation event to the available pool by adding it to the loaded events
            loadEventData().then(events => {
                const investigationEvent = {
                    type: 'corporate-espionage-investigation',
                    weight: 1,
                    oneTimeAccept: true,
                    text_versions: [
                        'Federal investigators have discovered evidence of unauthorized access to competitor communications from your company\'s systems. A formal investigation into corporate espionage has been launched, and sanctions are being considered.'
                    ],
                    choices: [
                        {
                            text: 'Accept investigation',
                            action: 'accept',
                            penalty: { sanctions: true },
                            result_text: 'The investigation concludes that your company engaged in illegal corporate espionage. Economic sanctions are immediately imposed, severely limiting your operations.'
                        }
                    ]
                };
                
                // Add to events pool if not already there
                const existingEvent = events.defaultEvents.find(e => e.type === 'corporate-espionage-investigation');
                if (!existingEvent) {
                    events.defaultEvents.push(investigationEvent);
                }
            });
        }
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        // Handle decline
        const declineText = `You decide that corporate espionage is too risky and potentially illegal. Your team focuses on independent research to catch up through legitimate means.`;
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = declineText;
    }
    
    updateStatusBar();
    showPage('main-game');
}

// Example: Multi-stage corporate espionage investigation handler using other_texts
// Note: This is a demonstration - the event would need other_texts defined like:
// "other_texts": {
//   "high_evidence_stage": "Federal investigators have found substantial evidence...",
//   "low_evidence_stage": "Investigators have detected suspicious network activity...",
//   "cooperate_result": "Your cooperation reduces tensions...",
//   "obstruct_result": "Your obstruction backfires spectacularly...",
//   "assist_result": "Your proactive assistance is noted favorably...",
//   "silent_result": "Your silence is legally prudent...",
//   "trade_result": "Your offer to share intelligence...",
//   "misdirect_success": "Your misdirection succeeds brilliantly...",
//   "misdirect_failure": "Your misdirection is discovered..."
// }
function handleCorporateEspionageInvestigation(choice, event, _sanctionsTriggered) {
    const stages = multiStageManager.getStageData(event.type);
    
    // Stage 1: Initial discovery - use other_texts for stage content
    if (!stages.currentStage) {
        multiStageManager.initStage(event.type, 'discovery', {
            evidenceLevel: Math.random() * 100,
            investigatorSuspicion: 50
        });
        
        const stageData = multiStageManager.getStageData(event.type);
        const evidenceLevel = stageData.data.evidenceLevel;
        
        // Use other_texts based on evidence level
        const stageTextKey = evidenceLevel > 70 ? 'high_evidence_stage' : 'low_evidence_stage';
        
        const nextChoices = evidenceLevel > 70 ? [
            multiStageManager.createChoice("Cooperate fully", "cooperate"),
            multiStageManager.createChoice("Deny and obstruct", "obstruct"),
            multiStageManager.createChoice("Offer information trade", "trade")
        ] : [
            multiStageManager.createChoice("Proactively assist", "assist"),
            multiStageManager.createChoice("Remain silent", "silent"),
            multiStageManager.createChoice("Misdirect investigation", "misdirect")
        ];
        
        // Use other_texts instead of hardcoded strings
        multiStageManager.nextStageFromOtherTexts(event.type, 'response', stageTextKey, nextChoices);
        return;
    }
    
    // Stage 2: Response handling - use other_texts for results
    if (stages.currentStage === 'response') {
        let resultKey = "";
        
        switch (choice.action) {
            case 'cooperate':
                resultKey = "cooperate_result";
                gameState.diplomacyPoints -= 2;
                break;
            case 'obstruct':
                resultKey = "obstruct_result";
                gameState.hasSanctions = true;
                gameState.diplomacyPoints -= 5;
                break;
            case 'assist':
                resultKey = "assist_result";
                gameState.diplomacyPoints += 1;
                break;
            case 'silent':
                resultKey = "silent_result";
                gameState.hasSanctions = true;
                break;
            case 'trade':
                resultKey = "trade_result";
                gameState.hasSanctions = true;
                gameState.hasIntelligenceAgreement = true;
                break;
            case 'misdirect':
                const success = Math.random() < 0.4;
                resultKey = success ? "misdirect_success" : "misdirect_failure";
                if (!success) {
                    gameState.hasSanctions = true;
                    gameState.diplomacyPoints -= 8;
                }
                break;
        }
        
        // Use other_texts for completion message
        multiStageManager.completeEventFromOtherTexts(event.type, resultKey);
        return;
    }
}

function handleCompetitorAcquisitionChoice(choice, _event, _sanctionsTriggered) {
    console.log('Calling custom handler: handleCompetitorAcquisitionChoice');
    
    const competitorIndex = gameState.acquisitionCompetitorIndex;
    const competitorName = gameState.competitorNames[competitorIndex] || `Competitor ${competitorIndex + 1}`;
    
    if (choice.action === 'accept') {
        // Store original company for endgame scoring
        if (!gameState.startingCompany) {
            gameState.startingCompany = gameState.companyName || 'Company';
        }
        
        // Change to the acquiring company
        const newCompanyName = competitorName;
        const newAILevel = gameState.competitorAILevels[competitorIndex];
        
        // Find the acquiring company's metadata
        const acquiringCompany = COMPANIES.find(c => c.name === newCompanyName);
        
        gameState.companyName = newCompanyName;
        gameState.playerAILevel = newAILevel;
        gameState.isVPSafetyAlignment = true;
        gameState.playerEquity = gameState.offeredEquity || 0.01; // Use offered equity or fallback to 1%
        
        // Update company metadata to match the acquiring company
        if (acquiringCompany) {
            gameState.companyLongName = acquiringCompany.longName;
            gameState.companyCountry = acquiringCompany.homeCountry;
            gameState.companyFlag = acquiringCompany.flag;
        }
        
        // Replace the acquiring competitor with a new one from unused companies
        const allCompanies = COMPANIES.map(c => c.name);
        const usedCompanies = [gameState.companyName, ...gameState.competitorNames];
        const availableCompanies = allCompanies.filter(company => !usedCompanies.includes(company));
        
        if (availableCompanies.length > 0) {
            // Pick a random available company
            const newCompanyName = availableCompanies[Math.floor(Math.random() * availableCompanies.length)];
            
            // Set new capability level between 0.1 and 0.4 of the new (merged) player level
            const minLevel = newAILevel * 0.1;
            const maxLevel = newAILevel * 0.4;
            const newCompetitorLevel = minLevel + Math.random() * (maxLevel - minLevel);
            
            // Replace the acquired competitor
            gameState.competitorNames[competitorIndex] = newCompanyName;
            gameState.competitorAILevels[competitorIndex] = newCompetitorLevel;
        } else {
            // Fallback: just reduce the capability significantly if no companies available
            gameState.competitorAILevels[competitorIndex] = newAILevel * (0.1 + Math.random() * 0.3);
        }
        
        // Add random resources based on new capability level
        const levelBasedBonus = Math.floor(newAILevel / 4); // Scale with AI level
        gameState.money += Math.floor(Math.random() * levelBasedBonus + levelBasedBonus);
        gameState.diplomacyPoints += Math.floor(Math.random() * levelBasedBonus + levelBasedBonus/2);
        gameState.productPoints += Math.floor(Math.random() * levelBasedBonus + levelBasedBonus/2);
        
        // Unlock alignment project if not already unlocked
        if (!gameState.projectsUnlocked) {
            gameState.projectsUnlocked = true;
        }
        
        // Update status immediately
        updateStatusBar();
        
        const playerEquityPercent = Math.round((gameState.offeredEquity || 0.01) * 100 * 10) / 10;
        const totalEquityPercent = Math.round((gameState.totalEquityOffered || 0.1) * 100 * 10) / 10;
        const resultText = `The merger is completed successfully. ${newCompanyName} acquires ${gameState.startingCompany} for ${totalEquityPercent}% equity, giving you ${playerEquityPercent}% equity as your 10% share of the deal. You assume the role of VP of Safety and Alignment. With access to ${newCompanyName}'s advanced AI capabilities and resources, you now focus on ensuring AI development benefits humanity. Having ${playerEquityPercent < 1 ? 'very little' : playerEquityPercent < 5 ? 'little' : 'somewhat less'} financial interest in the ASI race, your priorities have ${playerEquityPercent < 1 ? 'fundamentally' : ''} shifted toward what would be best for the world.<br><br>You are ${playerEquityPercent < 1 ? 'quite resentful about accepting such a low valuation' : playerEquityPercent < 5 ? 'somewhat resentful about the valuation' : 'reasonably satisfied with the valuation'}, but the acquisition was ultimately necessary given the competitive reality.`;
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        // Handle decline
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}


// Force generate a specific event type (for debugging)
async function forceEvent(eventType) {
    if (!eventType) return;
    
    const events = await loadEventData();
    let event = null;
    
    // Handle special events
    if (eventType === 'sanctions') {
        const sanctionsEvent = events.specialEvents.sanctions;
        const randomText = sanctionsEvent.text_versions[Math.floor(Math.random() * sanctionsEvent.text_versions.length)];
        
        event = {
            type: sanctionsEvent.type,
            text: randomText,
            choices: sanctionsEvent.choices
        };
    } else if (eventType === 'safety-incident') {
        event = generateSafetyIncident(events);
    } else {
        // Handle default events
        const eventTemplate = events.defaultEvents.find(e => e.type === eventType);
        if (eventTemplate && getAvailableEvents([eventTemplate]).length > 0) {
            let randomText = eventTemplate.text_versions[Math.floor(Math.random() * eventTemplate.text_versions.length)];
            
            // Apply variable substitution
            randomText = substituteEventVariables(randomText, eventTemplate.type);
            
            // Filter choices based on conditions
            const filteredChoices = filterChoicesByCondition(eventTemplate.choices);
            
            event = {
                type: eventTemplate.type,
                text: randomText,
                choices: filteredChoices,
                customHandler: eventTemplate.customHandler || null,
                originalEventData: eventTemplate // Preserve original data for multi-stage access
            };
        }
    }
    
    if (event) {
        gameState.currentEvent = event;
        trackEventSeen(event);
        updateStatusBar();
        showPage('main-game');
    }
    
    // Reset dropdown
    const dropdown = document.getElementById('debugEventDropdown');
    if (dropdown) dropdown.value = '';
}

// Give debug resources (for testing)
function giveResources() {
    gameState.money += 1000;
    gameState.productPoints += 1000;
    gameState.diplomacyPoints += 1000;
    gameState.safetyPoints += 1000;
    
    updateStatusBar();
    showPage('main-game');
}

// Unlock projects panel (for testing)
function debugUnlockProjects() {
    gameState.projectsUnlocked = true;
    updateStatusBar();
    showPage('main-game');
}

// Show current event pool (for debugging)
function debugShowEventPool() {
    // Remove existing overlay if present
    const existingOverlay = document.getElementById('event-pool-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
        return; // Toggle off if already showing
    }
    
    loadEventData().then(events => {
        const availableEvents = getAvailableEvents(events.defaultEvents);
        
        // Create overlay element
        const overlay = document.createElement('div');
        overlay.id = 'event-pool-overlay';
        overlay.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.8);
            color: #e0e0e0;
            padding: 10px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
            max-width: 400px;
            max-height: 60vh;
            overflow-y: auto;
            z-index: 2000;
            border: 1px solid #555;
        `;
        
        // Build content lines with compact format
        const lines = [];
        lines.push(`Event Pool (${availableEvents.length}):`);
        
        // Compact format: weight | event-name (AI range)
        availableEvents.forEach(e => {
            const weight = (e.weight || 1).toString().padStart(2);
            let aiRange = '';
            if (e.aiLevelRange) {
                const min = e.aiLevelRange.min !== undefined ? e.aiLevelRange.min : '∞';
                const max = e.aiLevelRange.max !== undefined ? e.aiLevelRange.max : '∞';
                aiRange = ` (${min}-${max})`;
            }
            lines.push(`${weight} | ${e.type}${aiRange}`);
        });
        
        // Only show debug-specific player state (not already in status bar)
        lines.push('');
        lines.push('Debug State:');
        lines.push(`Fallen Behind: ${gameState.hasEverFallenBehind}`);
        const acceptedEvents = Array.from(gameState.eventsAccepted);
        if (acceptedEvents.length > 0) {
            lines.push(`Accepted: ${acceptedEvents.join(', ')}`);
        } else {
            lines.push('Accepted: none');
        }
        
        // Set content
        overlay.innerHTML = lines.map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>');
        
        // Add close button
        const closeBtn = document.createElement('div');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 8px;
            cursor: pointer;
            color: #ccc;
            font-weight: bold;
        `;
        closeBtn.onclick = () => {
            overlay.remove();
            // Update button text
            const btn = document.getElementById('debug-event-pool-btn');
            if (btn) btn.textContent = 'Show Event Pool';
        };
        overlay.appendChild(closeBtn);
        
        // Add to page
        document.body.appendChild(overlay);
    });
}

// Update event pool overlay if it's currently visible
function updateEventPoolOverlay() {
    const overlay = document.getElementById('event-pool-overlay');
    if (!overlay) return; // Not currently shown
    
    loadEventData().then(events => {
        const availableEvents = getAvailableEvents(events.defaultEvents);
        
        // Build updated content with compact format
        const lines = [];
        lines.push(`Event Pool (${availableEvents.length}):`);
        
        // Compact format: weight | event-name (AI range)
        availableEvents.forEach(e => {
            const weight = (e.weight || 1).toString().padStart(2);
            let aiRange = '';
            if (e.aiLevelRange) {
                const min = e.aiLevelRange.min !== undefined ? e.aiLevelRange.min : '∞';
                const max = e.aiLevelRange.max !== undefined ? e.aiLevelRange.max : '∞';
                aiRange = ` (${min}-${max})`;
            }
            lines.push(`${weight} | ${e.type}${aiRange}`);
        });
        
        // Only show debug-specific player state (not already in status bar)
        lines.push('');
        lines.push('Debug State:');
        lines.push(`Fallen Behind: ${gameState.hasEverFallenBehind}`);
        const acceptedEvents = Array.from(gameState.eventsAccepted);
        if (acceptedEvents.length > 0) {
            lines.push(`Accepted: ${acceptedEvents.join(', ')}`);
        } else {
            lines.push('Accepted: none');
        }
        
        // Update content (preserve close button)
        const closeBtn = overlay.querySelector('div');
        overlay.innerHTML = lines.map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>');
        if (closeBtn) overlay.appendChild(closeBtn);
    });
}

// Custom handler for sanctions choice with AI-level scaling
function handleSanctionsChoice(choice, event, sanctionsTriggered) {
    console.log('Calling custom handler: handleSanctionsChoice');
    
    let resultText;
    
    if (choice.action === 'accept') {
        // Calculate scaled costs based on AI level
        // Goal: roughly 2 turns of funds and diplomacy to lift sanctions
        const aiLevel = gameState.playerAILevel;
        const scaledMoneyCost = Math.max(3, Math.round(aiLevel * 0.2)); // Scales with AI level, minimum 3B
        const scaledDiplomacyCost = Math.max(3, Math.round(aiLevel * 0.15)); // Scales with AI level, minimum 3
        
        // Check if player can afford the scaled costs
        const canAfford = gameState.money >= scaledMoneyCost && gameState.diplomacyPoints >= scaledDiplomacyCost;
        
        if (canAfford) {
            // Apply scaled costs and remove sanctions
            gameState.money -= scaledMoneyCost;
            gameState.diplomacyPoints -= scaledDiplomacyCost;
            gameState.hasSanctions = false;
            
            resultText = `Your lobbying campaign succeeds after spending <strong>$${scaledMoneyCost}B</strong> and <strong>${scaledDiplomacyCost} diplomacy points</strong>. International pressure is lifted through back-channel negotiations. Your company can now operate freely again.`;
        } else {
            // Can't afford - sanctions remain
            resultText = `You lack the resources to mount an effective lobbying campaign (need <strong>$${scaledMoneyCost}B</strong> and <strong>${scaledDiplomacyCost} diplomacy</strong>). Sanctions remain in effect.`;
        }
    } else {
        // Decline - standard result text
        resultText = choice.result_text;
    }
    
    // Set result text for display
    gameState.currentEvent.showResult = true;
    gameState.currentEvent.resultText = resultText;
    
    updateStatusBar();
    showPage('main-game');
}