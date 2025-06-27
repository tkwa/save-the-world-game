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
    
    // Sanctions event has 100% probability if sanctions are active
    if (gameState.hasSanctions) {
        const sanctionsEvent = events.specialEvents.sanctions;
        const randomText = sanctionsEvent.text_versions[Math.floor(Math.random() * sanctionsEvent.text_versions.length)];
        
        const event = {
            type: sanctionsEvent.type,
            text: randomText,
            choices: sanctionsEvent.choices,
            customHandler: 'handleSanctionsChoice'
        };
        trackEventSeen(event);
        return event;
    }
    
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
        
        // Debug: Log available event types to console
        console.log('Available event types in pool:', availableEvents.map(e => e.type));
        console.log('Completed one-time events:', Array.from(gameState.dsaEventsAccepted));
        
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
        
        // Check special requirements for UN recognition
        if (event.type === 'seek-un-recognition') {
            const currentResources = calculateResources();
            if (currentResources < 6) {
                return false; // Need at least 6 resources
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
    const fine = Math.floor(gameState.safetyIncidentCount ** 1.5);
    
    const safetyEvent = events.safetyIncidents;
    const randomText = safetyEvent.text_versions[Math.floor(Math.random() * safetyEvent.text_versions.length)];
    
    return {
        type: 'safety-incident',
        text: `${randomText} The incident draws regulatory scrutiny and ${gameState.companyName} is fined $${fine}B. Your legal team recommends increased safety measures.`,
        fine: fine
    };
}

// Helper function to substitute variables in event text
function substituteEventVariables(text, eventType) {
    let substitutedText = text;
    
    // Handle country substitution for both overseas-datacenter and nuclear-weapons events
    if (text.includes('$country')) {
        let country;
        
        if (eventType === 'overseas-datacenter') {
            // Pick a random country for the datacenter event and store it
            const countries = GAME_CONSTANTS.DATACENTER_COUNTRIES;
            country = countries[Math.floor(Math.random() * countries.length)];
            gameState.datacenterCountry = country;
        } else if (eventType === 'nuclear-weapons' && gameState.datacenterCountry) {
            // Use the previously stored datacenter country for nuclear weapons
            country = gameState.datacenterCountry;
        }
        
        if (country) {
            substitutedText = substitutedText.replace(/\$country/g, country);
        }
    }
    
    return substitutedText;
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
            
            return {
                type: event.type,
                text: randomText,
                choices: event.choices || null
            };
        }
    }
    
    // Fallback to last event if something goes wrong
    const fallbackEvent = eventArray[eventArray.length - 1];
    let randomText = fallbackEvent.text_versions[Math.floor(Math.random() * fallbackEvent.text_versions.length)];
    
    // Apply variable substitution to fallback
    randomText = substituteEventVariables(randomText, fallbackEvent.type);
    
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
            if (choice.benefit.unRecognition) {
                gameState.hasUNRecognition = true;
            }
        }
        
        // Apply penalties (guaranteed negative effects)
        if (choice.penalty) {
            if (choice.penalty.doomLevel) {
                gameState.doomLevel += choice.penalty.doomLevel;
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

// Custom event handlers for events with risk/success-failure mechanics

function handleOverseasDatacenterChoice(choice) {
    if (choice.action === 'accept-sanctions') {
        // Apply standard effects and check if sanctions were triggered
        const sanctionsTriggered = applyChoiceEffects(choice);
        
        let resultText;
        if (sanctionsTriggered) {
            resultText = "You proceed with unauthorized datacenter construction, bypassing government approval processes. The facility comes online successfully, but intelligence agencies discover the operation. The US government responds with comprehensive economic sanctions against your company.";
        } else {
            resultText = "You proceed with unauthorized datacenter construction, bypassing government approval processes. The facility comes online successfully, and your covert operations remain undetected. You've gained substantial computational capacity without triggering sanctions.";
        }
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        // Handle other choices normally
        applyChoiceEffects(choice);
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleNuclearWeaponsChoice(choice) {
    if (choice.action === 'accept') {
        // Apply standard effects and check if sanctions were triggered
        const sanctionsTriggered = applyChoiceEffects(choice);
        
        let resultText;
        if (sanctionsTriggered) {
            resultText = "Your team begins the secretive nuclear weapons program. The project advances rapidly thanks to your robotics expertise and AI-assisted design. However, intelligence agencies detect the program through satellite imagery and financial tracking. International sanctions are immediately imposed.";
        } else {
            resultText = "Your team begins the secretive nuclear weapons program. The project advances rapidly thanks to your robotics expertise and AI-assisted design. Intelligence agencies remain unaware of the program, and your company's position in global politics fundamentally changes without immediate retaliation.";
        }
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        applyChoiceEffects(choice);
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleMissileDefenseChoice(choice) {
    if (choice.action === 'accept') {
        // Apply standard effects and check if sanctions were triggered
        const sanctionsTriggered = applyChoiceEffects(choice);
        
        let resultText;
        if (sanctionsTriggered) {
            resultText = "Your missile defense system comes online successfully. Advanced AI-controlled interceptors and cyber warfare capabilities now protect your facilities from conventional military threats. However, the deployment is detected by multiple intelligence agencies, triggering immediate international sanctions and significantly escalating global tensions.";
        } else {
            resultText = "Your missile defense system comes online successfully. Advanced AI-controlled interceptors and cyber warfare capabilities now protect your facilities from conventional military threats. The deployment remains largely undetected, though global tensions increase significantly due to the technology's existence.";
        }
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = resultText;
    } else {
        applyChoiceEffects(choice);
        if (choice.result_text) {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = choice.result_text;
        }
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleSanctionsChoice(choice) {
    applyChoiceEffects(choice);
    
    // Special handling for sanctions removal
    if (choice.action === 'accept') {
        gameState.hasSanctions = false;
    }
    
    if (choice.result_text) {
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = choice.result_text;
    }
    
    updateStatusBar();
    showPage('main-game');
}

function handleStandardChoice(choice) {
    applyChoiceEffects(choice);
    
    if (choice.result_text) {
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = choice.result_text;
    }
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
            choices: sanctionsEvent.choices,
            customHandler: 'handleSanctionsChoice'
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
            
            event = {
                type: eventTemplate.type,
                text: randomText,
                choices: eventTemplate.choices || null,
                customHandler: eventTemplate.customHandler || null
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