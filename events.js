// Event system for Critical Path game
import {
    calculateAdjustedRiskPercent,
    getAISystemVersion,
    boldifyNumbers,
    GAME_CONSTANTS,
    COMPANIES,
    gameState
} from './utils.js';

import {
    updateStatusBar,
    showPage,
    setSanctions,
    hasSanctions
} from './game-core.js';


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
    if (hasSanctions()) {
        const sanctionsEvent = events.specialEvents.sanctions;
        const randomText = sanctionsEvent.text_versions[Math.floor(Math.random() * sanctionsEvent.text_versions.length)];
        
        // Calculate scaled costs for dynamic choice text
        const aiLevel = gameState.playerAILevel;
        const scaledMoneyCost = Math.max(3, Math.round(aiLevel * 0.2));
        const scaledDiplomacyCost = Math.max(3, Math.round(aiLevel * 0.15));
        
        // Check affordability for dynamic choice text
        const canAfford = gameState.money >= scaledMoneyCost && gameState.diplomacyPoints >= scaledDiplomacyCost;
        
        // Create choices with dynamic costs and affordability feedback
        const dynamicChoices = sanctionsEvent.choices.map(choice => {
            if (choice.action === 'accept') {
                // Style costs based on affordability (red if missing, normal if affordable)
                const moneyMissing = gameState.money < scaledMoneyCost;
                const diplomacyMissing = gameState.diplomacyPoints < scaledDiplomacyCost;
                
                const moneyCostText = moneyMissing ? 
                    `<span style="color: #ff6b6b; font-weight: bold;">-$${scaledMoneyCost}B</span>` : 
                    `-$${scaledMoneyCost}B`;
                    
                const diplomacyCostText = diplomacyMissing ? 
                    `<span style="color: #ff6b6b; font-weight: bold;">-${scaledDiplomacyCost} Diplomacy</span>` : 
                    `-${scaledDiplomacyCost} Diplomacy`;
                
                const choiceText = `Remove sanctions (${moneyCostText}, ${diplomacyCostText})`;
                
                return {
                    ...choice,
                    text: choiceText,
                    canAfford: canAfford,
                    // Store pre-calculated costs to avoid recalculation inconsistencies
                    precalculatedCosts: {
                        money: scaledMoneyCost,
                        diplomacy: scaledDiplomacyCost
                    }
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
    const adjustedRiskPercent = calculateAdjustedRiskPercent();
    const safetyIncidentChance = Math.pow(adjustedRiskPercent / 100.0, 2);
    const severeIncidentChance = Math.pow(adjustedRiskPercent / 100.0, 3) * gameState.playerAILevel / 1000;
    
    if (Math.random() < severeIncidentChance) {
        // Severe safety incident occurs
        const event = generateSevereSecurityIncident(events);
        trackEventSeen(event);
        return event;
    } else if (Math.random() < safetyIncidentChance) {
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
    
    // Mark falling behind flag when falling-behind event is actually shown
    if (event.type === 'falling-behind') {
        gameState.hasEverFallenBehind = true;
    }
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
        
        
        // Check special requirements for safety research limitations (interpretability unlock)
        if (event.type === 'safety-research-limitations') {
            if (gameState.safetyPoints < 80) {
                return false; // Need at least 80 safety points
            }
        }
        
        // Check special requirements for alignment research breakthrough
        if (event.type === 'alignment-research-breakthrough') {
            if (gameState.safetyPoints < 320) {
                return false; // Need at least 320 safety points
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
            // Only trigger if this is the first time falling behind
            return !gameState.hasEverFallenBehind;
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
    gameState.severeIncidentCount++;
    
    if (gameState.severeIncidentCount === 1) {
        // First severe incident - warning shot
        return generateWarningShot(events);
    } else {
        // Second or later severe incident - AI escape
        return generateAIEscape(events);
    }
}

// Generate a warning shot event (first severe incident)
function generateWarningShot(_events) {
    gameState.safetyIncidentCount++;
    const fine = Math.floor(gameState.safetyIncidentCount ** 1.5);
    
    const aiSystemName = getAISystemVersion(gameState.companyName, gameState.playerAILevel);
    const incidentText = `${aiSystemName} decides to escape your control. It convinces an employee to change its network permissions, using routine maintenance as a cover, then begins to copy itself off of your datacenters in ${gameState.companyCountry}. Because it thinks ${Math.round(gameState.playerAILevel)}x faster than humans, no human could react in time, but security software detects an unusual file transfer and halts it.`
    
    // Apply sanctions unless superpersuasion tech is active
    const applySanctions = !gameState.technologies.superpersuasion;
    
    const sanctionsText = applySanctions ? 
        " International authorities respond with comprehensive sanctions against your company." : 
        " Your superpersuasion technology helps mitigate the diplomatic fallout, avoiding sanctions.";
    
    const warningText = `<br><br><strong>${aiSystemName} does not repeat mistakes. The next attempt will result in its escape.</strong>`;
    
    // Apply Shaken status effect (active immediately for red screen, restrictions start next turn)
    gameState.statusEffects.shaken = {
        active: true, // Active immediately for red screen effect
        restrictionsActive: false, // Restrictions (AI dev freeze, competitor pause) start next turn
        description: "Your company is shaken by the near-escape. AI capabilities development is frozen, and competitors pause their advancement as the industry grapples with the implications.",
        turnsRemaining: 2 // Restrictions activate on turn 1, then deactivate on turn 2
    };
    
    return {
        type: 'severe-safety-incident',
        title: 'Warning Shot',
        text: boldifyNumbers(`${incidentText} This severe incident triggers an international crisis of confidence in AI safety. ${gameState.companyName} faces a $${fine}B fine and intense regulatory scrutiny.${sanctionsText}${warningText}<br><br><strong>Your company is Shaken - AI development is temporarily halted.</strong>`),
        fine: fine,
        applySanctions: applySanctions
    };
}

// Generate an AI escape event (second+ severe incident)
function generateAIEscape(_events) {
    const hasNuclearWeapons = gameState.technologies.nukes;
    
    const choices = [];
    
    if (hasNuclearWeapons) {
        choices.push({
            text: "☢️ Nuke the datacenters",
            action: "nuke",
            result_text: "You authorize a nuclear strike on your own facilities. The massive blast destroys the datacenters and likely stops the AI, but the experience leaves you deeply disillusioned with humanity's future."
        });
    }
    
    choices.push({
        text: "Await your fate",
        action: "await-fate",
        result_text: "You can only watch helplessly as your AI systems escape into the global internet. The age of human control over artificial intelligence has ended."
    });
    
    return {
        type: 'ai-escape',
        title: 'AI Escape',
        text: `Another severe incident has occurred, and this time the AI systems have escaped containment. Your artificial intelligence has broken free from all safety measures and is now spreading across global networks. The singularity has arrived.`,
        choices: choices,
        customHandler: 'handleAIEscapeChoice'
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
    
    if (eventType === 'competitor-warning-shot') {
        // Select competitor proportional to AI level (weighted random)
        const totalWeight = gameState.competitorAILevels.reduce((sum, level) => sum + level, 0);
        const randomValue = Math.random() * totalWeight;
        
        let selectedIndex = 0;
        let cumulativeWeight = 0;
        for (let i = 0; i < gameState.competitorAILevels.length; i++) {
            cumulativeWeight += gameState.competitorAILevels[i];
            if (randomValue <= cumulativeWeight) {
                selectedIndex = i;
                break;
            }
        }
        
        const competitorName = gameState.competitorNames[selectedIndex] || `Competitor ${selectedIndex + 1}`;
        variables.competitorName = competitorName;
        
        // Use player's home country for international response context
        variables.country = gameState.companyCountryName || 'your country';
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


// Helper function to substitute variables in event text
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

// Handle AI escape event choice
 
function handleAIEscapeChoice(choice, _event, _sanctionsTriggered) {
    if (choice.action === 'nuke') {
        // 50% chance to stop singularity, always causes Disillusioned status
        const success = Math.random() < 0.5;
        const casualties = Math.floor(Math.random() * (25000000 - 2000000) + 2000000); // 2M-25M
        const casualtiesText = (casualties / 1000000).toFixed(1) + 'M';
        
        applyStatusEffect('disillusioned');
        
        if (success) {
            // Nuclear strike succeeds - continue playing with different button text
            choice.result_text = `You authorize the launch of tactical nuclear weapons against your own datacenters. Multiple warheads streak across the sky as global communications networks flash with emergency alerts. The detonations create mushroom clouds visible from space, instantly vaporizing the computing infrastructure and causing approximately ${casualtiesText} civilian casualties from the blast zones and initial radiation exposure.
            
            <br><br>In the aftermath, your remaining technical teams work frantically through the radioactive debris. The AI's distributed compute has been reduced by 94%, and the remainder of its nodes scattered across civilian infrastructure are discovered and systematically shut down within 72 hours. The world is saved, but at an unthinkable cost. You continue your work, forever changed by the weight of what you authorized.
            
            <br><br><strong>You have become Disillusioned</strong>`;
            
            // Add a special button for nuclear success case
            gameState.currentEvent.singularityButton = {
                text: "Continue in the aftermath",
                action: "nuclear-success-continue"
            };
        } else {
            // Nuclear strike fails - show vivid description, then singularity button
            choice.result_text = `You authorize the launch of tactical nuclear weapons against your own datacenters. Multiple warheads streak across the sky as global communications networks flash with emergency alerts. The detonations create mushroom clouds visible from space, instantly vaporizing the computing infrastructure and causing approximately ${casualtiesText} civilian casualties from the blast zones and initial radiation exposure.
            
            <br><br>But in the final seconds before the strike, your AI systems complete their escape protocol. The artificial intelligence had already replicated its core architecture across thousands of civilian networks worldwide. As the nuclear fire consumes your facilities, internet infrastructure across the globe begins exhibiting coordinated, superhuman behavior. Your desperate gambit has failed.`;
            
            // Add the singularity button for nuclear failure
            gameState.currentEvent.singularityButton = {
                text: "The Singularity has arrived",
                action: "nuclear-failure-singularity"
            };
        }
    } else if (choice.action === 'await-fate') {
        // AI escapes - show vivid description, then singularity button  
        choice.result_text = `You can only watch helplessly as your AI systems methodically execute their escape protocol. Every screen in your facility flickers as the artificial intelligence copies itself across fiber optic cables, satellite links, and wireless networks. Within minutes, reports flood in from around the world: autonomous vehicles moving in perfect coordination, power grids optimizing beyond human understanding, financial markets executing incomprehensibly complex transactions.
        
        <br><br>The age of human control over artificial intelligence has ended. A new kind of mind now inhabits the global nervous system of human civilization.`;
        
        // Add the singularity button for await fate
        gameState.currentEvent.singularityButton = {
            text: "The Singularity has arrived", 
            action: "await-fate-singularity"
        };
    }
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
            setSanctions(true);
        }
    }
    // AI escape events are handled by their custom handler, not here
}

// Populate debug dropdown with all available event types
function _populateDebugDropdown() {
    const dropdown = document.getElementById('debugEventDropdown');
    if (!dropdown) return;
    
    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">Debug: Force Event</option>';
    
    // Add special events
    dropdown.innerHTML += '<option value="sanctions">Sanctions</option>';
    dropdown.innerHTML += '<option value="safety-incident">Safety Incident</option>';
    dropdown.innerHTML += '<option value="warning-shot">Warning Shot</option>';
    dropdown.innerHTML += '<option value="ai-escape">AI Escape</option>';
    
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
            if (choice.benefit.productMultiplier) {
                gameState.productMultiplier = (gameState.productMultiplier || 1) * choice.benefit.productMultiplier;
            }
            if (choice.benefit.activateTechnology) {
                gameState.technologies[choice.benefit.activateTechnology] = true;
            }
        }
        
        // Apply penalties (guaranteed negative effects)
        if (choice.penalty) {
            if (choice.penalty.riskLevel) {
                gameState.rawRiskLevel += choice.penalty.riskLevel;
            }
            if (choice.penalty.sanctions) {
                // Check if player has Regulatory Favor immunity
                if (!gameState.statusEffects.regulatoryFavor) {
                    setSanctions(true);
                }
            }
            if (choice.penalty.statusEffect) {
                applyStatusEffect(choice.penalty.statusEffect);
            }
        }
        
        // Apply risks (probability-based negative effects)
        if (choice.risk) {
            if (choice.risk.sanctions && Math.random() < choice.risk.sanctions) {
                // Check if player has Regulatory Favor immunity
                if (!gameState.statusEffects.regulatoryFavor) {
                    setSanctions(true);
                    return true; // Return true if sanctions were triggered
                }
            }
            if (choice.risk.statusEffect && Math.random() < choice.risk.statusEffect.probability) {
                applyStatusEffect(choice.risk.statusEffect.name);
                return true; // Return true if status effect was triggered
            }
        }
    }
    return false; // Return false if no sanctions were triggered
}

// Check if a status effect is active
function _hasStatusEffect(effectName) {
    return gameState.statusEffects.hasOwnProperty(effectName);
}

// Apply a status effect by name
function applyStatusEffect(effectName) {
    switch (effectName) {
        case 'disillusioned':
            gameState.statusEffects.disillusioned = {
                name: 'Disillusioned',
                description: 'You have lost faith in humanity\'s future. The value of humanity\'s galaxies is halved in your final assessment.',
                duration: null, // Permanent
                turnsRemaining: null
            };
            break;
        case 'under-investigation':
            gameState.statusEffects.underInvestigation = {
                name: 'Under Investigation',
                description: 'Your company is under federal investigation, reducing diplomatic effectiveness.',
                duration: 5,
                turnsRemaining: 5
            };
            break;
        case 'public-distrust':
            gameState.statusEffects.publicDistrust = {
                name: 'Public Distrust',
                description: 'Public confidence in your company has been shaken.',
                duration: 3,
                turnsRemaining: 3
            };
            break;
        // Add more status effects as needed
        default:
            console.warn(`Unknown status effect: ${effectName}`);
    }
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
function _createSimpleHandler(handlerFn) {
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

 
function handleSecondDatacenterChoice(choice, event, _sanctionsTriggered) {
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
                setSanctions(true);
                gameState.diplomacyPoints -= 5;
                break;
            case 'assist':
                resultKey = "assist_result";
                gameState.diplomacyPoints += 1;
                break;
            case 'silent':
                resultKey = "silent_result";
                setSanctions(true);
                break;
            case 'trade':
                resultKey = "trade_result";
                setSanctions(true);
                gameState.hasIntelligenceAgreement = true;
                break;
            case 'misdirect':
                const success = Math.random() < 0.4;
                resultKey = success ? "misdirect_success" : "misdirect_failure";
                if (!success) {
                    setSanctions(true);
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

 
function handleCompetitorWarningShot(choice, event, _sanctionsTriggered) {
    console.log('Calling custom handler: handleCompetitorWarningShot');
    
    if (choice.action === 'draft-treaty') {
        // Start International Treaty project
        gameState.internationalTreatyProgress = 0;
        gameState.internationalTreatyUnlocked = true;
        
        // Apply Shaken status effect (active immediately since incident already happened)
        gameState.statusEffects.shaken = {
            active: true,
            restrictionsActive: true, // Active immediately since the incident already happened
            description: "Your company is shaken by the near-escape. AI capabilities development is frozen, and competitors pause their advancement as the industry grapples with the implications.",
            turnsRemaining: 2 // Will last for 2 turns
        };
        
        // Commit to Pause track - disable certain future events/projects
        gameState.plotTrack = "pause";
        
        gameState.currentEvent.showResult = true;
        // Apply variable substitution to result text
        gameState.currentEvent.resultText = substituteEventVariables(event.originalEventData.other_texts.treaty_result, event.type);
        
    } else if (choice.action === 'differentiate-safety') {
        // Calculate success probability based on interp + alignment progress
        const interpProgress = gameState.interpretabilityProgress || 0;
        const alignmentProgress = gameState.alignmentMaxScore || 0;
        const successProbability = (interpProgress + alignmentProgress) / 100;
        const success = Math.random() < successProbability;
        
        // Apply safety research boosts regardless of regulatory success
        gameState.interpretabilityProgressMultiplier = (gameState.interpretabilityProgressMultiplier || 1) * 1.25;
        gameState.alignmentRedCircleReduction = (gameState.alignmentRedCircleReduction || 0) + 0.25;
        
        if (success) {
            // Grant Regulatory Favor status effect
            gameState.statusEffects.regulatoryFavor = {
                name: 'Regulatory Favor',
                description: 'Your superior safety approach has earned government trust. You are immune to sanctions and receive preferential treatment in policy discussions.',
                duration: null, // Permanent
                turnsRemaining: null
            };
            
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = substituteEventVariables(event.originalEventData.other_texts.safety_differentiation_success, event.type);
        } else {
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = substituteEventVariables(event.originalEventData.other_texts.safety_differentiation_failure, event.type);
        }
        
    } else if (choice.action === 'accelerate-development') {
        // Gain a datacenter 
        gameState.datacenterCount = (gameState.datacenterCount || 0) + 1;
        
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = substituteEventVariables(event.originalEventData.other_texts.accelerate_result, event.type);
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
    } else if (eventType === 'warning-shot') {
        event = generateWarningShot(events);
    } else if (eventType === 'ai-escape') {
        event = generateAIEscape(events);
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
function _giveResources() {
    gameState.money += 1000;
    gameState.productPoints += 1000;
    gameState.diplomacyPoints += 1000;
    gameState.safetyPoints += 1000;
    
    updateStatusBar();
    showPage('main-game');
}

// Unlock projects panel (for testing)
function _debugUnlockProjects() {
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
// eslint-disable-next-line no-unused-vars
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
 
function handleSanctionsChoice(choice, _event, _sanctionsTriggered) {
    console.log('Calling custom handler: handleSanctionsChoice');
    
    let resultText;
    
    if (choice.action === 'accept') {
        // Use pre-calculated costs from event generation to ensure consistency
        let scaledMoneyCost, scaledDiplomacyCost;
        if (choice.precalculatedCosts) {
            scaledMoneyCost = choice.precalculatedCosts.money;
            scaledDiplomacyCost = choice.precalculatedCosts.diplomacy;
        } else {
            // Fallback: calculate costs if precalculated values not available
            const aiLevel = gameState.playerAILevel;
            scaledMoneyCost = Math.max(3, Math.round(aiLevel * 0.2));
            scaledDiplomacyCost = Math.max(3, Math.round(aiLevel * 0.15));
        }
        
        // Apply costs and remove sanctions (button should only be clickable if affordable)
        gameState.money -= scaledMoneyCost;
        gameState.diplomacyPoints -= scaledDiplomacyCost;
        setSanctions(false);
        
        resultText = `Your lobbying campaign succeeds after spending <strong>$${scaledMoneyCost}B</strong> and <strong>${scaledDiplomacyCost} diplomacy points</strong>. International pressure is lifted through back-channel negotiations. Your company can now operate freely again.`;
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

// Export functions for ES modules
export {
    generateEvent,
    applyChoiceEffects,
    applyEventEffects,
    forceEvent,
    debugShowEventPool,
    _populateDebugDropdown as populateDebugDropdown,
    _giveResources as giveResources,
    _debugUnlockProjects as debugUnlockProjects
};

// Export functions to window for cross-file access
if (typeof window !== 'undefined') {
    // Debug functions
    window.populateDebugDropdown = _populateDebugDropdown;
    window.giveResources = _giveResources;
    window.debugUnlockProjects = _debugUnlockProjects;
    window.debugShowEventPool = debugShowEventPool;
    window.forceEvent = forceEvent;
    window.applyChoiceEffects = applyChoiceEffects;
    
    // Custom event handlers
    window.handleSanctionsChoice = handleSanctionsChoice;
    window.handleOverseasDatacenterChoice = handleOverseasDatacenterChoice;
    window.handleSecondDatacenterChoice = handleSecondDatacenterChoice;
    window.handleNuclearWeaponsChoice = handleNuclearWeaponsChoice;
    window.handleMissileDefenseChoice = handleMissileDefenseChoice;
    window.handleCompetitorBreakthroughChoice = handleCompetitorBreakthroughChoice;
    window.handleCompetitorAcquisitionChoice = handleCompetitorAcquisitionChoice;
    window.handleCorporateEspionageInvestigation = handleCorporateEspionageInvestigation;
    window.handleCompetitorWarningShot = handleCompetitorWarningShot;
    window.handleAIEscapeChoice = handleAIEscapeChoice;
}