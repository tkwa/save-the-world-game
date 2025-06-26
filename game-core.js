// Core game logic for the AI Timeline Game

// Game state
const gameState = {
    // AI Information
    playerAILevel: 10,
    doomLevel: 20,
    opensourceAILevel: 2,

    // Corporate Divisions
    diplomacyPoints: 0,
    productPoints: 0,
    safetyPoints: 0,

    // Status Effects
    hasSanctions: false,
    hasUNRecognition: false,

    // Other game state
    currentPage: "start",
    alignmentLevel: Math.random(), // 0-1 float for alignment
    evalsBuilt: {
        capability: false,
        corrigibility: false,
        alignment: false,
        forecasting: false
    },
    correlationDataset: null,
    currentMinigame: null,
    companyName: null,
    currentTurn: 1,
    currentMonth: "January",
    currentYear: 2026,
    money: 1, // Starting money
    gameOverReason: null,
    currentEvent: null,
    safetyIncidentCount: 0,
    selectedAllocation: null,
    eventsSeen: {}, // Tracks count of each event type seen
    choicesTaken: {}, // Tracks choices taken for each event type
    dsaEventsAccepted: new Set() // Tracks which DSA events have been accepted
};

// Story content
const storyContent = {
    start: {
        title: "",
        text: "",
        buttons: [
            { text: "New Game", action: "goto", target: "game-setup" }
        ]
    },
    "game-setup": {
        title: "January 2026",
        text: async function () {
            // Randomly assign company
            const companies = ["OpenAI", "Anthropic", "Google", "Amazon", "Tencent", "xAI"];
            gameState.companyName = companies[Math.floor(Math.random() * companies.length)];
            gameState.currentTurn = 1;
            gameState.currentMonth = "January";
            gameState.currentYear = 2026;
            // Generate first event
            gameState.currentEvent = await generateEvent();
            return `As AI systems become capable of automating AI R&D, the AI race has reached a critical juncture. The CEO of ${gameState.companyName} faces a dilemma: move too slowly on capabilities and competitors will achieve ASI first, leaving the company behind while their untested systems reshape the world. Move too quickly and build misaligned systems that could destroy everything. Looming over all is the possibility of decisive strategic advantage-- the possibility that one AI system becomes completely economically and militarily dominant.`;
        },
        showStatus: false,
        buttons: [
            { text: "Begin", action: "goto", target: "main-game" }
        ]
    },
    "main-game": {
        title: function () {
            return `${gameState.currentMonth || 'January'} ${gameState.currentYear || 2026}`;
        },
        text: function () {
            if (gameState.currentTurn === 1) {
                return `You are the CEO of ${gameState.companyName}.`;
            } else {
                return '';
            }
        },
        customContent: function () {
            // Show current event after resource allocation
            if (gameState.currentEvent) {
                let eventHtml = `<div style="border-top: 2px solid #555; padding-top: 20px; margin-top: 20px;">`;
                eventHtml += `<p style="color: #d0d0d0; margin-bottom: 15px;">${gameState.currentEvent.text}</p>`;

                if (gameState.currentEvent.showResult && gameState.currentEvent.resultText) {
                    // Showing result of choice - just display result and next turn button
                    eventHtml += `<p style="color: #d0d0d0; margin-bottom: 15px;">${gameState.currentEvent.resultText}</p>`;
                    eventHtml += `<button class="button" onclick="finishTurn()">Next Turn</button>`;
                } else if (gameState.currentEvent.choices && gameState.currentEvent.choices.length > 0) {
                    // Event has choices - show them as buttons
                    gameState.currentEvent.choices.forEach((choice, index) => {
                        const canAfford = canAffordChoice(choice);
                        const allocationMade = gameState.selectedAllocation !== null;
                        const enabled = allocationMade && canAfford;
                        
                        const buttonStyle = enabled ?
                            `margin: 5px 5px 5px 0;` :
                            `margin: 5px 5px 5px 0; background-color: #666; cursor: not-allowed; opacity: 0.6;`;
                        const onclick = enabled ? `handleEventChoice(${index})` : '';
                        eventHtml += `<button class="button" onclick="${onclick}" style="${buttonStyle}">${choice.text}</button>`;
                    });
                } else {
                    // No choices - just next turn button
                    const allocationMade = gameState.selectedAllocation !== null;
                    const buttonStyle = allocationMade ?
                        `` :
                        `background-color: #666; cursor: not-allowed; opacity: 0.6;`;
                    const onclick = allocationMade ? `finishTurn()` : '';
                    eventHtml += `<button class="button" onclick="${onclick}" style="${buttonStyle}">Next Turn</button>`;
                }

                eventHtml += `</div>`;
                return eventHtml;
            }
            return '';
        },
        showStatus: true,
        showActions: true,
        actions: [
            "ai-rd",
            "diplomacy",
            "product",
            "safety-rd",
            "revenue"
        ],
    },
    "end-game": {
        title: "Game Over",
        text: function () {
            return calculateEndGameScore();
        },
        showStatus: true,
        buttons: [
            { text: "Restart", action: "goto", target: "start" }
        ]
    },
    "capability-evals-minigame": {
        title: "Capability Evals",
        text: function () {
            const minigame = gameState.currentMinigame;
            if (!minigame || minigame.type !== 'capability-evals') {
                return "Error: Minigame data not found.";
            }

            const imagePath = `minigames/correlations/images/${minigame.image.filename}`;
            return `<div style="text-align: center;">
                <p>Estimate the correlation strength in this scatterplot:</p>
                <img src="${imagePath}" alt="Correlation Plot" style="max-width: 400px; height: auto; border: 1px solid #ccc; margin: 20px 0;">
                <p>Select the correlation value that best matches the data:</p>
            </div>`;
        },
        showStatus: false,
        customButtons: true,
        buttons: []
    },
    "forecasting-evals-minigame": {
        title: "Forecasting Evals",
        text: function () {
            const coinData = gameState.coinFlipData;
            const percentage = coinData.total > 0 ? ((coinData.heads / coinData.total) * 100).toFixed(1) : '0.0';

            return `<div style="text-align: center;">
                <p>A weighted coin has been flipped daily. Estimate the true probability of heads:</p>
                <div style="background-color: #f9f9f9; border: 2px solid #333; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
                    <h3>Coin Flip Results</h3>
                    <div style="font-size: 18px; margin: 10px 0;">
                        <strong>Heads:</strong> ${coinData.heads}<br>
                        <strong>Tails:</strong> ${coinData.tails}<br>
                        <strong>Total Flips:</strong> ${coinData.total}<br>
                        <strong>Current %:</strong> ${percentage}%
                    </div>
                </div>
                <p>What is the true probability of heads for this coin?</p>
            </div>`;
        },
        showStatus: false,
        customButtons: true,
        buttons: []
    },
};

function updateStatusBar() {
    // AI Information
    const playerAIElement = document.getElementById('player-ai-level');
    playerAIElement.textContent = gameState.playerAILevel;
    playerAIElement.style.fontWeight = 'bold';
    // Red if less than open source AI level
    playerAIElement.style.color = gameState.playerAILevel < gameState.opensourceAILevel ? '#ff6b6b' : '#e0e0e0';
    
    const doomElement = document.getElementById('doom-level');
    doomElement.textContent = `${gameState.doomLevel}%`;
    doomElement.style.fontWeight = 'bold';
    // Red if >50%, amber if >15%, otherwise white
    if (gameState.doomLevel > 50) {
        doomElement.style.color = '#ff6b6b';
    } else if (gameState.doomLevel > 15) {
        doomElement.style.color = '#ffa726';
    } else {
        doomElement.style.color = '#e0e0e0';
    }
    
    // Make "Rogue AI Risk" label red and bold if >75%
    const doomLabelElement = document.getElementById('doom-label');
    if (gameState.doomLevel > 75) {
        doomLabelElement.style.color = '#ff6b6b';
        doomLabelElement.style.fontWeight = 'bold';
    } else {
        doomLabelElement.style.color = '#e0e0e0';
        doomLabelElement.style.fontWeight = 'normal';
    }
    
    const opensourceElement = document.getElementById('opensource-ai-level');
    opensourceElement.textContent = gameState.opensourceAILevel;
    opensourceElement.style.fontWeight = 'bold';
    opensourceElement.style.color = '#e0e0e0';

    // Company Divisions
    document.getElementById('company-name-header').textContent = gameState.companyName || 'Company';
    
    const moneyElement = document.getElementById('money');
    moneyElement.textContent = `$${gameState.money}B`;
    moneyElement.style.fontWeight = 'bold';
    moneyElement.style.color = gameState.money === 0 ? '#ff6b6b' : '#e0e0e0';
    
    const diplomacyElement = document.getElementById('diplomacy-points');
    diplomacyElement.textContent = gameState.diplomacyPoints;
    diplomacyElement.style.fontWeight = 'bold';
    diplomacyElement.style.color = gameState.diplomacyPoints === 0 ? '#ff6b6b' : '#e0e0e0';
    
    const productElement = document.getElementById('product-points');
    productElement.textContent = gameState.productPoints;
    productElement.style.fontWeight = 'bold';
    productElement.style.color = gameState.productPoints === 0 ? '#ff6b6b' : '#e0e0e0';
    
    const safetyElement = document.getElementById('safety-points');
    safetyElement.textContent = gameState.safetyPoints;
    safetyElement.style.fontWeight = 'bold';
    safetyElement.style.color = gameState.safetyPoints === 0 ? '#ff6b6b' : '#e0e0e0';

    // Status Effects
    const sanctionsElement = document.getElementById('sanctions-status');
    if (gameState.hasSanctions) {
        sanctionsElement.textContent = 'Sanctions Active';
        sanctionsElement.style.color = '#ffa726'; // Orange for bad status
    } else {
        sanctionsElement.textContent = '';
    }
    
    const unRecognitionElement = document.getElementById('un-recognition-status');
    if (gameState.hasUNRecognition) {
        unRecognitionElement.textContent = 'UN Recognition';
        unRecognitionElement.style.color = '#66bb6a'; // Green for good status
    } else {
        unRecognitionElement.textContent = '';
    }
}




async function finishTurn() {
    // Only advance turn if allocation has been made
    if (!gameState.selectedAllocation) {
        return; // Don't advance turn
    }

    // Advance turn without applying resources (already applied when button was clicked)
    await advanceTurn();
}

async function advanceTurn() {

    // Increase open-source AI level
    gameState.opensourceAILevel += Math.floor(Math.sqrt(Math.max(1, gameState.opensourceAILevel / 8)));

    // Apply overseas datacenter bonus
    if (gameState.aiLevelPerTurn) {
        gameState.playerAILevel += gameState.aiLevelPerTurn;
    }

    // Apply event effects
    applyEventEffects(gameState.currentEvent);

    // Apply income bonus from product breakthroughs
    if (gameState.incomeBonus) {
        gameState.money += gameState.incomeBonus;
    }

    // Advance turn
    gameState.currentTurn++;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = (gameState.currentTurn - 1) % 12;
    gameState.currentMonth = months[monthIndex];
    if (monthIndex === 0 && gameState.currentTurn > 1) {
        gameState.currentYear++;
    }

    // Generate new event for next turn
    gameState.currentEvent = await generateEvent();

    // Clear selection for next turn (after everything is processed)
    gameState.selectedAllocation = null;

    updateStatusBar();

    // Check end conditions
    if (gameState.doomLevel >= 100) {
        gameState.gameOverReason = 'doom-100';
        showPage('end-game');
        return;
    }

    if (gameState.playerAILevel >= 100 || gameState.opensourceAILevel >= 100) {
        gameState.gameOverReason = 'ai-singularity';
        showPage('end-game');
        return;
    }

    // Refresh the page to show new turn
    showPage('main-game');
}

function buildEvals(evalType) {
    if (evalType === 'Capability Evals') {
        startCapabilityEvalsMinigame();
    } else if (evalType === 'Corrigibility Evals') {
        gameState.evalsBuilt.corrigibility = true;
    } else if (evalType === 'Alignment Evals') {
        gameState.evalsBuilt.alignment = true;
    } else if (evalType === 'Forecasting') {
        startForecastingEvalsMinigame();
    }
    updateStatusBar();
}

function beginAlignmentProject() {
    gameState.alignmentProjectStarted = true;
    updateResearchDisplay();
}

function toggleAlignmentProject() {
    if (!gameState.alignmentProjectStarted) return;

    gameState.currentAlignmentProject = gameState.currentAlignmentProject === "Interpretability" ? "Control" : "Interpretability";
    updateResearchDisplay();
}

function updateResearchDisplay() {
    const researchSection = document.getElementById('research-section');
    const alignmentProjectBtn = document.getElementById('alignment-project-btn');

    if (gameState.alignmentProjectStarted) {
        researchSection.style.display = 'block';
        alignmentProjectBtn.textContent = `Switch to ${gameState.currentAlignmentProject === 'Interpretability' ? 'Control' : 'Interpretability'}`;
        alignmentProjectBtn.onclick = toggleAlignmentProject;
        alignmentProjectBtn.disabled = false;
        alignmentProjectBtn.style.backgroundColor = '#007cba';
        alignmentProjectBtn.style.cursor = 'pointer';

        // Add current project indicator above the button
        const currentProject = alignmentProjectBtn.parentNode.querySelector('.current-project');
        if (currentProject) {
            currentProject.textContent = `Current: ${gameState.currentAlignmentProject}`;
        } else {
            const indicator = document.createElement('div');
            indicator.className = 'current-project';
            indicator.style.fontSize = '14px';
            indicator.style.color = '#666';
            indicator.style.marginBottom = '5px';
            indicator.textContent = `Current: ${gameState.currentAlignmentProject}`;
            alignmentProjectBtn.parentNode.insertBefore(indicator, alignmentProjectBtn);
        }
    } else {
        alignmentProjectBtn.textContent = 'Not Started';
        alignmentProjectBtn.onclick = null;
        alignmentProjectBtn.disabled = true;
        alignmentProjectBtn.style.backgroundColor = '#ccc';
        alignmentProjectBtn.style.cursor = 'default';

        // Remove current project indicator
        const currentProject = alignmentProjectBtn.parentNode.querySelector('.current-project');
        if (currentProject) {
            currentProject.remove();
        }
    }
}

function calculateGrowthRate(capability, hype, usMood) {
    let growthRate = capability ** 1.6 * 0.010 * (hype / 10);
    if (usMood === "Hawkish") {
        growthRate *= 1.3;
    } else if (usMood === "Dovish") {
        growthRate *= 0.5;
    }
    return growthRate;
}

function calculateDaysToSingularity() {
    let currentCapability = gameState.aiCapability;
    let days = 0;
    const maxIterations = 10000; // Prevent infinite loops

    while (currentCapability < gameState.singularityLevel && days < maxIterations) {
        const growthRate = calculateGrowthRate(currentCapability, gameState.hype, gameState.usMood);
        currentCapability += growthRate;
        days++;
    }

    return days >= maxIterations ? "∞" : days;
}

function updateForecastingDisplay() {
    if (gameState.evalsBuilt.forecasting) {
        const daysToSingularity = calculateDaysToSingularity();
        let forecastDiv = document.getElementById('forecasting-display');

        if (!forecastDiv) {
            forecastDiv = document.createElement('div');
            forecastDiv.id = 'forecasting-display';
            forecastDiv.style.textAlign = 'center';
            forecastDiv.style.fontSize = '16px';
            forecastDiv.style.marginTop = '10px';
            forecastDiv.style.color = '#666';

            const dateTicker = document.getElementById('date-ticker');
            if (dateTicker) {
                dateTicker.appendChild(forecastDiv);
            }
        }

        forecastDiv.innerHTML = `<div>Days to Singularity: ${daysToSingularity}</div>`;
    }
}

function refreshEvalsDisplay() {
    // Refresh the evals display to update cooldown counters
    const currentPage = gameState.currentPage;
    if (currentPage === '2026') {
        // Find and update the evals section
        const actionsPanel = document.querySelector('.actions-panel');
        if (actionsPanel) {
            showPage('2026'); // Refresh the entire page to update evals display
        }
    }
}

function calculateResources() {
    // Formula from README: floor(sqrt(max(1, AL - OL)))
    let baseResources = Math.floor(Math.sqrt(Math.max(1, gameState.opensourceAILevel / 4, gameState.playerAILevel - gameState.opensourceAILevel)));

    // Apply UN recognition multiplier
    if (gameState.resourceMultiplier) {
        baseResources = Math.floor(baseResources * gameState.resourceMultiplier);
    }

    // Sanctions halve resources (rounded up)
    if (gameState.hasSanctions) {
        baseResources = Math.ceil(baseResources / 2);
    }

    return baseResources;
}

function generateActionLabels(resources) {
    return [
        `AI R&D (+${resources} AI Level, +${resources} Risk)`,
        `+${resources} Diplomacy`,
        `+${resources} Product`,
        `Safety R&D (+${resources} Safety, -${Math.floor(resources * 3)}% Risk)`,
        `Revenue (+$${resources}B)`
    ];
}

function canAffordChoice(choice) {
    if (!choice.cost) return true;

    if (choice.cost.productPoints && gameState.productPoints < choice.cost.productPoints) {
        return false;
    }
    if (choice.cost.diplomacyPoints && gameState.diplomacyPoints < choice.cost.diplomacyPoints) {
        return false;
    }
    if (choice.cost.money && gameState.money < choice.cost.money) {
        return false;
    }

    return true;
}

function applyResourceAllocation(resourceType, corporateResources) {
    switch(resourceType) {
        case 'ai-rd':
            gameState.playerAILevel += corporateResources;
            gameState.doomLevel += corporateResources;
            break;
        case 'diplomacy':
            gameState.diplomacyPoints += corporateResources;
            break;
        case 'product':
            gameState.productPoints += corporateResources;
            break;
        case 'safety-rd':
            gameState.safetyPoints += corporateResources;
            // Each SP decreases XL by 3% (relative reduction)
            const reductionFactor = 1 - (corporateResources * 0.03);
            gameState.doomLevel = Math.floor(gameState.doomLevel * Math.max(0, reductionFactor));
            break;
        case 'revenue':
            // Convert corporate resources to saved money
            gameState.money += corporateResources;
            break;
    }
    updateStatusBar();
}

function resetGameState() {
    gameState.playerAILevel = 10;
    gameState.doomLevel = 20;
    gameState.opensourceAILevel = 2;
    gameState.diplomacyPoints = 0;
    gameState.productPoints = 0;
    gameState.safetyPoints = 0;
    gameState.hasSanctions = false;
    gameState.hasUNRecognition = false;
    gameState.currentPage = "start";
    gameState.alignmentLevel = Math.random();
    gameState.evalsBuilt = {
        capability: false,
        corrigibility: false,
        alignment: false,
        forecasting: false
    };
    gameState.correlationDataset = null;
    gameState.currentMinigame = null;
    gameState.companyName = null;
    gameState.currentTurn = 1;
    gameState.currentMonth = "January";
    gameState.currentYear = 2026;
    gameState.money = 1;
    gameState.gameOverReason = null;
    gameState.currentEvent = null;
    gameState.safetyIncidentCount = 0;
    gameState.selectedAllocation = null;
    gameState.incomeBonus = 0;
    gameState.aiLevelPerTurn = 0;
    gameState.resourceMultiplier = null;
    gameState.eventsSeen = {};
    gameState.choicesTaken = {};
    gameState.dsaEventsAccepted = new Set();
}

function calculateEndGameScore() {
    let resultText = "";
    let playerGalaxies = 0;
    let humanityGalaxies = 0;
    let rogueGalaxies = 0;

    if (gameState.gameOverReason === 'doom-100') {
        // Instant game over - all AIs are misaligned
        resultText = `${gameState.companyName} was reckless enough to let doom reach 100%. Humanity is immediately eaten by nanobots, which go on to colonize the stars.`;
        rogueGalaxies = 100;
        playerGalaxies = 0;
        humanityGalaxies = 0;
    } else if (gameState.gameOverReason === 'ai-singularity') {
        resultText = "The singularity has arrived. ";

        narrow_race = Math.min(gameState.playerAILevel, gameState.opensourceAILevel) >= 90;
        if (gameState.playerAILevel >= 100) {
            resultText += narrow_race ? "You achieved ASI first. " : "You achieved ASI first, but open-source AI was close behind. ";
        } else {
            resultText += "Open-source AI achieved ASI first. ";
        }

        // Calculate galaxy splits based on README formula
        const playerShare = Math.max(0, Math.min(100, gameState.playerAILevel - gameState.opensourceAILevel));
        const otherShare = 100 - playerShare;

        // Roll for misalignment using doom level as probability
        const playerMisaligned = Math.random() * 100 < gameState.doomLevel;
        const otherMisaligned = Math.random() * 100 < gameState.doomLevel;

        if (playerMisaligned) {
            rogueGalaxies += playerShare;
            resultText += `Your AI systems became misaligned (${gameState.doomLevel}% chance). `;
        } else {
            playerGalaxies = playerShare;
            resultText += `Your AI systems remained aligned. `;
        }

        if (otherMisaligned) {
            rogueGalaxies += otherShare;
            resultText += `Other AI systems became misaligned. `;
        } else {
            humanityGalaxies = otherShare;
            resultText += `Other AI systems remained aligned. `;
        }
    }

    // Calculate final score: 0x rogue + 10x humanity + 20x player
    const finalScore = (0 * rogueGalaxies) + (10 * humanityGalaxies) + (20 * playerGalaxies);

    resultText += `<br><br><strong>Final Galaxy Distribution:</strong><br>`;
    resultText += `• Rogue AI: ${rogueGalaxies}%<br>`;
    resultText += `• Humanity at large: ${humanityGalaxies}%<br>`;
    resultText += `• Your company: ${playerGalaxies}%<br><br>`;
    resultText += `<strong>Final Score: ${finalScore}</strong><br>`;
    resultText += `(${rogueGalaxies}×0 + ${humanityGalaxies}×10 + ${playerGalaxies}×20)`;

    return resultText;
}

async function showPage(pageId) {
    const page = storyContent[pageId];
    const contentDiv = document.getElementById('story-content');
    const buttonsDiv = document.getElementById('buttons');
    const statusBar = document.getElementById('status-bar');
    const mainHeading = document.querySelector('h1');
    const subtitle = document.querySelector('p[style*="text-align: center"]');

    // Hide main heading and subtitle after start screen
    if (pageId !== 'start') {
        if (mainHeading) mainHeading.style.display = 'none';
        if (subtitle) subtitle.style.display = 'none';
    } else {
        if (mainHeading) mainHeading.style.display = 'block';
        if (subtitle) subtitle.style.display = 'block';
    }

    // Show/hide status bar
    if (page.showStatus) {
        statusBar.style.display = 'block';
        updateStatusBar();
    } else {
        statusBar.style.display = 'none';
    }

    // Start date ticker when reaching 2026 page
    if (pageId === '2026') {
        startDateTicker();
        updateResearchDisplay();

        // Add date controls after a short delay to ensure ticker is displayed
        setTimeout(() => {
            const dateTicker = document.getElementById('date-ticker');
            if (dateTicker && !document.getElementById('date-controls')) {
                const dateControls = document.createElement('div');
                dateControls.id = 'date-controls';
                dateControls.className = 'date-controls';
                dateControls.innerHTML = `
                    <button class="button speed-btn" data-speed="0" onclick="setSpeed(0)">Pause</button>
                    <button class="button speed-btn" data-speed="0.25" onclick="setSpeed(0.25)">0.25x</button>
                    <button class="button speed-btn" data-speed="1" onclick="setSpeed(1)" style="background-color: #005a87;">1x</button>
                    <button class="button speed-btn" data-speed="4" onclick="setSpeed(4)">4x</button>
                    <button class="button speed-btn" data-speed="100" onclick="setSpeed(100)">100x</button>
                    <button class="button" onclick="skipTo2027()">Skip to 2027</button>
                `;
                dateTicker.appendChild(dateControls);
            }
        }, 100);
    }

    // Set content
    let text;
    if (typeof page.text === 'function') {
        text = await page.text();
    } else {
        text = page.text;
    }

    let title;
    if (typeof page.title === 'function') {
        title = page.title();
    } else {
        title = page.title;
    }

    contentDiv.innerHTML = `<h2>${title}</h2><p>${text}</p>`;

    // Add actions panel if present
    if (page.showActions && page.actions) {
        const actionsPanel = document.createElement('div');
        actionsPanel.className = 'actions-panel';

        // Add resource allocation header
        const corporateResources = calculateResources();
        const headerDiv = document.createElement('div');
        headerDiv.style.fontFamily = "'Courier New', Courier, monospace";
        headerDiv.style.fontWeight = 'bold';
        headerDiv.style.marginBottom = '10px';

        // Show sanctions calculation if active
        if (gameState.hasSanctions) {
            const baseResources = Math.floor(Math.sqrt(Math.max(1, gameState.opensourceAILevel / 4, gameState.playerAILevel - gameState.opensourceAILevel)));
            const multipliedResources = gameState.resourceMultiplier ? Math.floor(baseResources * gameState.resourceMultiplier) : baseResources;
            headerDiv.textContent = `You have ${corporateResources} Resources (${multipliedResources} resources x 50% sanctions factor) to allocate this turn:`;
        } else {
            headerDiv.textContent = `You have ${corporateResources} resources to allocate this turn:`;
        }
        actionsPanel.appendChild(headerDiv);

        // Create container for action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'grid';
        buttonContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        buttonContainer.style.gap = '5px';

        // No default selection - start with everything greyed out

        // Generate action labels with actual resource numbers
        const actionLabels = generateActionLabels(corporateResources);

        actionLabels.forEach((actionLabel, index) => {
            const button = document.createElement('button');
            button.className = 'button';
            button.textContent = actionLabel;
            button.style.fontFamily = "'Courier New', Courier, monospace";
            button.style.fontSize = '14px';
            button.style.width = 'calc(100% - 10px)';
            button.style.margin = '5px';

            // Style based on selection state
            if (gameState.selectedAllocation === page.actions[index]) {
                button.style.backgroundColor = '#005a87';
                button.style.border = '2px solid #66b3ff';
            } else if (gameState.selectedAllocation) {
                button.style.backgroundColor = '#666';
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
            }

            button.onclick = () => {
                if (!gameState.selectedAllocation) {
                    gameState.selectedAllocation = page.actions[index];
                    applyResourceAllocation(page.actions[index], corporateResources);
                    showPage('main-game');
                }
            };

            buttonContainer.appendChild(button);
        });

        // Add the button container to the actions panel
        actionsPanel.appendChild(buttonContainer);

        contentDiv.appendChild(actionsPanel);

        // Add custom content after actions (like events)
        if (page.customContent) {
            const customDiv = document.createElement('div');
            customDiv.innerHTML = page.customContent();
            contentDiv.appendChild(customDiv);
        }
    }

    // Set buttons
    buttonsDiv.innerHTML = '';

    // Handle custom buttons for minigames
    if (page.customButtons && pageId === 'capability-evals-minigame') {
        const minigame = gameState.currentMinigame;
        if (minigame && minigame.type === 'capability-evals') {
            // Create answer options
            const allOptions = [minigame.image.correlation, ...minigame.image.distractors];
            // Shuffle the options
            for (let i = allOptions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
            }

            allOptions.forEach(correlation => {
                const btn = document.createElement('button');
                btn.className = 'button';
                btn.textContent = correlation.toFixed(3);
                btn.style.margin = '10px';
                btn.onclick = () => submitCapabilityEvalsAnswer(correlation, btn);
                buttonsDiv.appendChild(btn);
            });

            // Add back button
            const backBtn = document.createElement('button');
            backBtn.className = 'button';
            backBtn.textContent = 'Back to Game';
            backBtn.style.backgroundColor = '#666';
            backBtn.style.marginTop = '20px';
            backBtn.onclick = () => {
                gameState.currentMinigame = null;
                gameState.currentPage = '2026';
                showPage('2026');
            };
            buttonsDiv.appendChild(backBtn);
        }
    } else if (page.customButtons && pageId === 'forecasting-evals-minigame') {
        // Forecasting minigame buttons
        const options = [50, 60, 70, 80];

        options.forEach(percentage => {
            const btn = document.createElement('button');
            btn.className = 'button';
            btn.textContent = `${percentage}%`;
            btn.style.margin = '10px';
            btn.onclick = () => submitForecastingEvalsAnswer(percentage, btn);
            buttonsDiv.appendChild(btn);
        });

        // Add back button
        const backBtn = document.createElement('button');
        backBtn.className = 'button';
        backBtn.textContent = 'Back to Game';
        backBtn.style.backgroundColor = '#666';
        backBtn.style.marginTop = '20px';
        backBtn.onclick = () => {
            gameState.currentMinigame = null;
            gameState.coinFlipData.active = false;
            gameState.currentPage = '2026';
            showPage('2026');
        };
        buttonsDiv.appendChild(backBtn);
    } else {
        // Regular buttons
        if (page.buttons && page.buttons.length > 0) {
            page.buttons.forEach(button => {
                const btn = document.createElement('button');
                btn.className = 'button';
                btn.textContent = button.text;
                btn.onclick = async () => {
                    if (button.action === 'goto') {
                        if (button.target === 'start' && gameState.currentPage === 'end-game') {
                            // Reset game state when restarting from end screen
                            resetGameState();
                        }
                        gameState.currentPage = button.target;
                        showPage(button.target);
                    }
                };
                buttonsDiv.appendChild(btn);
            });
        }
    }
}


// Handle event choice selection
async function handleEventChoice(choiceIndex) {
    const event = gameState.currentEvent;
    if (!event || !event.choices || choiceIndex >= event.choices.length) {
        console.error('Invalid event choice');
        return;
    }

    const choice = event.choices[choiceIndex];

    // Track choice taken
    if (!gameState.choicesTaken[event.type]) {
        gameState.choicesTaken[event.type] = {};
    }
    if (!gameState.choicesTaken[event.type][choice.action]) {
        gameState.choicesTaken[event.type][choice.action] = 0;
    }
    gameState.choicesTaken[event.type][choice.action]++;

    // Track events that are accepted (for requirement checking)
    if (choice.action === 'accept' || choice.action === 'accept-sanctions') {
        gameState.dsaEventsAccepted.add(event.type);
    }

    if (choice.action === 'accept' || choice.action === 'accept-sanctions') {
        // Apply costs and benefits
        if (choice.cost) {
            if (choice.cost.productPoints) {
                gameState.productPoints -= choice.cost.productPoints;
            }
            if (choice.cost.diplomacyPoints) {
                gameState.diplomacyPoints -= choice.cost.diplomacyPoints;
            }
            if (choice.cost.money) {
                gameState.money -= choice.cost.money;
            }
        }

        // Apply risks (random negative effects)
        if (choice.risk) {
            if (choice.risk.sanctions && Math.random() < choice.risk.sanctions) {
                gameState.hasSanctions = true;
            }
        }

        // Apply penalties (guaranteed negative effects)
        if (choice.penalty) {
            if (choice.penalty.doomLevel) {
                gameState.doomLevel += choice.penalty.doomLevel;
            }
        }

        // Special handling for sanctions removal
        if (event.type === 'sanctions' && choice.action === 'accept') {
            gameState.hasSanctions = false;
        }

        if (choice.benefit) {
            if (choice.benefit.incomeBonus) {
                // Add income bonus to game state (this would need to be tracked and applied each turn)
                gameState.incomeBonus = (gameState.incomeBonus || 0) + choice.benefit.incomeBonus;
            }
            if (choice.benefit.aiLevelPerTurn) {
                // Add AI level per turn bonus (overseas datacenter)
                gameState.aiLevelPerTurn = (gameState.aiLevelPerTurn || 0) + choice.benefit.aiLevelPerTurn;
            }
            if (choice.benefit.resourceMultiplier) {
                // Set resource multiplier (UN recognition)
                gameState.resourceMultiplier = choice.benefit.resourceMultiplier;
            }
            if (choice.benefit.unRecognition) {
                // Grant UN recognition status
                gameState.hasUNRecognition = true;
            }
        }

        // Special handling for DSA (immediate singularity)
        if (event.type === 'decisive-strategic-advantage' && choice.action === 'accept') {
            gameState.playerAILevel = 100;
            gameState.gameOverReason = 'dsa-singularity';
            updateStatusBar();
            showPage('end-game');
            return;
        }
    }

    // Show result text instead of immediately finishing turn
    if (choice.result_text) {
        gameState.currentEvent.showResult = true;
        gameState.currentEvent.resultText = choice.result_text;
        updateStatusBar(); // Refresh status in case resources changed
        showPage('main-game'); // Refresh the page to show result
    } else {
        // No result text, proceed directly to next turn
        await finishTurn();
    }
}

// Make functions globally accessible
window.finishTurn = finishTurn;
window.handleEventChoice = handleEventChoice;

// Initialize the game
document.addEventListener('DOMContentLoaded', function () {
    showPage('start');
});