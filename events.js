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
            choices: sanctionsEvent.choices
        };
        trackEventSeen(event);
        return event;
    }
    
    // Calculate probability of safety incident based on adjusted risk level squared
    const adjustedRisk = calculateAdjustedRisk();
    const safetyIncidentChance = Math.pow(adjustedRisk, 2) / 100;
    
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
    
    // Handle competitor breakthrough event variables
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
        
        // Substitute variables
        substitutedText = substitutedText.replace(/\$competitorName/g, competitorName);
        substitutedText = substitutedText.replace(/\$companyName/g, gameState.companyName || 'Your company');
        substitutedText = substitutedText.replace(/\$aiSystemName/g, playerAISystemName);
        substitutedText = substitutedText.replace(/\$newCompetitorLevel/g, `${Math.round(newCompetitorLevel)}x`);
        substitutedText = substitutedText.replace(/\$surpassingText/g, surpassingText);
        substitutedText = substitutedText.replace(/\$marketShareBefore/g, (Math.round(marketShareBefore * 10) / 10).toString());
        substitutedText = substitutedText.replace(/\$marketShareAfter/g, (Math.round(marketShareAfter * 10) / 10).toString());
    }
    
    // Handle competitor acquisition event variables
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
            
            // Substitute variables
            substitutedText = substitutedText.replace(/\$competitorName/g, competitorName);
            substitutedText = substitutedText.replace(/\$competitorLevel/g, `${Math.round(maxCompetitorLevel)}x`);
            substitutedText = substitutedText.replace(/\$companyName/g, gameState.companyName || 'Your company');
            substitutedText = substitutedText.replace(/\$playerLevel/g, `${Math.round(gameState.playerAILevel)}x`);
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
                choices: event.choices || null,
                customHandler: event.customHandler || null
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
        choices: fallbackEvent.choices || null,
        customHandler: fallbackEvent.customHandler || null
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

// Custom event handlers for events with risk/success-failure mechanics

function handleOverseasDatacenterChoice(choice, _event, sanctionsTriggered) {
    console.log('Calling custom handler: handleOverseasDatacenterChoice');
    
    if (choice.action === 'accept' || choice.action === 'accept-sanctions') {
        // Increment datacenter count for successful construction
        gameState.datacenterCount++;
        
        if (choice.action === 'accept-sanctions') {
            let resultText;
            if (sanctionsTriggered) {
                resultText = "You proceed with unauthorized datacenter construction, bypassing government approval processes. The facility comes online successfully, but intelligence agencies discover the operation. The US government responds with comprehensive economic sanctions against your company.";
            } else {
                resultText = "You proceed with unauthorized datacenter construction, bypassing government approval processes. The facility comes online successfully, and your covert operations remain undetected. You've gained substantial computational capacity without triggering sanctions.";
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

function handleNuclearWeaponsChoice(choice, _event, sanctionsTriggered) {
    if (choice.action === 'accept') {
        let resultText;
        if (sanctionsTriggered) {
            resultText = "Your team begins the secretive nuclear weapons program. The project advances rapidly thanks to your robotics expertise and AI-assisted design. However, intelligence agencies detect the program through satellite imagery and financial tracking. International sanctions are immediately imposed.";
        } else {
            resultText = "Your team begins the secretive nuclear weapons program. The project advances rapidly thanks to your robotics expertise and AI-assisted design. Intelligence agencies remain unaware of the program, and your company's position in global politics fundamentally changes without immediate retaliation.";
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

function handleMissileDefenseChoice(choice, _event, sanctionsTriggered) {
    if (choice.action === 'accept') {
        let resultText;
        if (sanctionsTriggered) {
            resultText = "Your missile defense system comes online successfully. Advanced AI-controlled interceptors and cyber warfare capabilities now protect your facilities from conventional military threats. However, the deployment is detected by multiple intelligence agencies, triggering immediate international sanctions and significantly escalating global tensions.";
        } else {
            resultText = "Your missile defense system comes online successfully. Advanced AI-controlled interceptors and cyber warfare capabilities now protect your facilities from conventional military threats. The deployment remains largely undetected, though global tensions increase significantly due to the technology's existence.";
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
                    oneTime: true,
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
        
        // Define company metadata for the acquiring company
        const companies = [
            { name: "OpenAI", longName: "OpenAI", homeCountry: "US", flag: "🇺🇸" },
            { name: "Anthropic", longName: "Anthropic", homeCountry: "US", flag: "🇺🇸" },
            { name: "Google", longName: "Google DeepMind", homeCountry: "UK", flag: "🇬🇧" },
            { name: "DeepSeek", longName: "DeepSeek", homeCountry: "CN", flag: "🇨🇳" },
            { name: "Tencent", longName: "Tencent", homeCountry: "CN", flag: "🇨🇳" },
            { name: "xAI", longName: "xAI", homeCountry: "US", flag: "🇺🇸" }
        ];
        
        // Find the acquiring company's metadata
        const acquiringCompany = companies.find(c => c.name === newCompanyName);
        
        gameState.companyName = newCompanyName;
        gameState.playerAILevel = newAILevel;
        gameState.isVPSafetyAlignment = true;
        gameState.playerEquity = 0.01; // 1% equity in the acquiring company
        
        // Update company metadata to match the acquiring company
        if (acquiringCompany) {
            gameState.companyLongName = acquiringCompany.longName;
            gameState.companyCountry = acquiringCompany.homeCountry;
            gameState.companyFlag = acquiringCompany.flag;
        }
        
        // Replace the acquiring competitor with a new one from unused companies
        const allCompanies = ["OpenAI", "Anthropic", "Google", "DeepSeek", "Tencent", "xAI"];
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
        
        const resultText = `The merger is completed successfully. ${gameState.startingCompany} becomes the Safety and Alignment division of ${newCompanyName}, and you assume the role of VP of Safety and Alignment. With access to ${newCompanyName}'s advanced AI capabilities and resources, you now focus on ensuring AI development benefits humanity. Having little financial interest in the ASI race, your priorities have fundamentally shifted toward what would be best for the world.<br><br>You are somewhat resentful about accepting such a low valuation, but the acquisition was ultimately necessary given the competitive reality.`;
        
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