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
    selectedAllocation: null
};

// Story content
const storyContent = {
    start: {
        title: "Welcome",
        text: "Welcome to Critical Path - An AI Strategy Game",
        buttons: [
            { text: "Begin", action: "goto", target: "game-setup" }
        ]
    },
    "game-setup": {
        title: "Starting Game",
        text: function() {
            // Randomly assign company
            const companies = ["OpenAI", "Anthropic", "Google", "Amazon", "Tencent", "xAI"];
            gameState.companyName = companies[Math.floor(Math.random() * companies.length)];
            gameState.currentTurn = 1;
            gameState.currentMonth = "January";
            gameState.currentYear = 2026;
            // Generate first event
            gameState.currentEvent = generateEvent();
            return `You are now the CEO of ${gameState.companyName}. The race to AGI begins now.`;
        },
        showStatus: false,
        buttons: [
            { text: "Begin", action: "goto", target: "main-game" }
        ]
    },
    "main-game": {
        title: function() {
            return `Turn ${gameState.currentTurn || 1} (${gameState.currentMonth || 'January'} ${gameState.currentYear || 2026})`;
        },
        text: function() {
            const corporateResources = calculateResources();
            let text = `You are the CEO of ${gameState.companyName}. You have ${corporateResources} corporate resources to allocate this turn.`;
            
            text += `<br><br>Choose how to allocate your resources:`;
            return text;
        },
        customContent: function() {
            // Show current event after resource allocation
            if (gameState.currentEvent) {
                let eventHtml = `<div style="background-color: #fff3cd; border: 2px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 15px 0;">`;
                eventHtml += `<strong>📰 Monthly Event:</strong><br>${gameState.currentEvent.text}`;
                eventHtml += `<br><br><button class="button" onclick="finishTurn()" style="font-family: 'Courier New', Courier, monospace;">Continue to Next Turn</button>`;
                eventHtml += `</div>`;
                return eventHtml;
            }
            return '';
        },
        showStatus: true,
        showActions: true,
        actions: [
            "AI R&D (↑ AI Level, ↑ Doom)", 
            "Diplomacy R&D (↑ Diplomacy)",
            "Product R&D (↑ Product)", 
            "Safety R&D (↑ Safety, ↓ Doom)",
            "Skip Turn"
        ],
    },
    "end-game": {
        title: "Game Over",
        text: function() {
            return calculateEndGameScore();
        },
        showStatus: true,
        buttons: [
            { text: "Restart", action: "goto", target: "start" }
        ]
    },
    "capability-evals-minigame": {
        title: "Capability Evals",
        text: function() {
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
        text: function() {
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
    document.getElementById('player-ai-level').textContent = gameState.playerAILevel;
    document.getElementById('doom-level').textContent = gameState.doomLevel;
    document.getElementById('opensource-ai-level').textContent = gameState.opensourceAILevel;
    
    // Company Divisions
    document.getElementById('company-name-header').textContent = gameState.companyName || 'Company';
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('diplomacy-points').textContent = gameState.diplomacyPoints;
    document.getElementById('product-points').textContent = gameState.productPoints;
    document.getElementById('safety-points').textContent = gameState.safetyPoints;
    
    // Status Effects
    document.getElementById('sanctions-status').textContent = gameState.hasSanctions ? 'Sanctions Active' : 'No Sanctions';
    document.getElementById('un-recognition-status').textContent = gameState.hasUNRecognition ? 'UN Recognition' : 'No UN Recognition';
}



function generateEvent() {
    // Calculate probability of safety incident based on doom level squared
    const safetyIncidentChance = Math.pow(gameState.doomLevel, 2) / 100;
    
    if (Math.random() * 100 < safetyIncidentChance) {
        // Safety incident occurs
        gameState.safetyIncidentCount++;
        const fine = gameState.safetyIncidentCount;
        
        const incidents = [
            "A training run goes wrong and the AI starts optimizing for something unexpected, requiring emergency shutdown.",
            "Researchers discover the model has been giving subtly misleading answers in safety evaluations.",
            "An AI system exhibits concerning emergent behavior that wasn't anticipated during development.",
            "A safety researcher raises concerns about potential deceptive alignment in the latest model.",
            "The AI demonstrates unexpected capability gains that outpace safety measures.",
            "Internal testing reveals the model can convincingly argue for harmful actions when prompted carefully.",
            "A whistleblower leaks concerning internal safety discussions to the media."
        ];
        
        const randomIncident = incidents[Math.floor(Math.random() * incidents.length)];
        
        return {
            type: 'safety-incident',
            text: `${randomIncident} The incident draws regulatory scrutiny and ${gameState.companyName} is fined $${fine}B. Your legal team recommends increased safety measures.`,
            fine: fine
        };
    } else {
        // Nothing event
        const nothingEvents = [
            "Development proceeds smoothly this month with steady progress across all teams.",
            "A competitor announces a new model, but early benchmarks suggest it's not a major leap forward.",
            "The AI safety community publishes new research papers that your team reviews for insights.",
            "A tech conference generates buzz about AI progress, but no major announcements affect your position.",
            "Your engineering team optimizes training infrastructure, leading to modest efficiency gains.",
            "Industry analysts publish reports on AI progress, placing your company among the leading developers.",
            "A university partnership provides access to new talent and research collaborations.",
            "Your PR team successfully manages media coverage of your latest model release.",
            "The board of directors expresses confidence in the company's strategic direction.",
            "International governments continue discussions about AI regulation, but no new policies are announced."
        ];
        
        const randomNothing = nothingEvents[Math.floor(Math.random() * nothingEvents.length)];
        
        return {
            type: 'nothing',
            text: randomNothing
        };
    }
}

function finishTurn() {
    if (!gameState.selectedAllocation) {
        alert('Please select a resource allocation first.');
        return;
    }
    
    // Apply the selected allocation
    allocateResources(gameState.selectedAllocation);
    
    // Clear selection for next turn
    gameState.selectedAllocation = null;
}

function allocateResources(resourceType) {
    // Calculate corporate resources for this turn (expires if not used)
    const corporateResources = calculateResources();
    
    switch(resourceType) {
        case 'AI R&D (↑ AI Level, ↑ Doom)':
            gameState.playerAILevel += corporateResources;
            gameState.doomLevel += corporateResources;
            break;
        case 'Diplomacy R&D (↑ Diplomacy)':
            gameState.diplomacyPoints += corporateResources;
            break;
        case 'Product R&D (↑ Product)':
            gameState.productPoints += corporateResources;
            break;
        case 'Safety R&D (↑ Safety, ↓ Doom)':
            gameState.safetyPoints += corporateResources;
            // Each SP decreases XL by 3% (relative reduction)
            const reductionFactor = 1 - (corporateResources * 0.03);
            gameState.doomLevel = Math.floor(gameState.doomLevel * Math.max(0, reductionFactor));
            break;
        case 'Skip Turn':
            // Convert corporate resources to saved money
            gameState.money += corporateResources;
            break;
    }
    
    // Increase open-source AI level
    gameState.opensourceAILevel += Math.floor(Math.sqrt(Math.max(1, gameState.opensourceAILevel / 8)));
    
    // Apply event effects if there was a safety incident
    if (gameState.currentEvent && gameState.currentEvent.type === 'safety-incident') {
        gameState.money = Math.max(0, gameState.money - gameState.currentEvent.fine);
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
    gameState.currentEvent = generateEvent();
    
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
    return Math.floor(Math.sqrt(Math.max(1, gameState.opensourceAILevel / 4, gameState.playerAILevel - gameState.opensourceAILevel)));
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
        
        actionsPanel.style.display = 'grid';
        actionsPanel.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
        actionsPanel.style.gap = '10px';
        actionsPanel.style.margin = '20px 0';
        
        page.actions.forEach((action, index) => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.padding = '15px';
            label.style.border = '2px solid #007cba';
            label.style.borderRadius = '8px';
            label.style.cursor = 'pointer';
            label.style.fontFamily = "'Courier New', Courier, monospace";
            label.style.backgroundColor = '#f8f9fa';
            label.style.transition = 'all 0.2s';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'allocation';
            radio.value = action;
            radio.style.marginRight = '10px';
            radio.style.transform = 'scale(1.2)';
            
            // Set AI R&D as default selection
            if (!gameState.selectedAllocation && index === 0) {
                gameState.selectedAllocation = action;
            }
            
            if (gameState.selectedAllocation === action) {
                radio.checked = true;
                label.style.backgroundColor = '#e3f2fd';
                label.style.borderColor = '#1976d2';
            }
            
            radio.onchange = () => {
                if (radio.checked) {
                    gameState.selectedAllocation = action;
                    // Update UI to show selection
                    showPage('main-game');
                }
            };
            
            label.onmouseover = () => {
                if (!radio.checked) {
                    label.style.backgroundColor = '#e8f4fd';
                }
            };
            
            label.onmouseout = () => {
                if (!radio.checked) {
                    label.style.backgroundColor = '#f8f9fa';
                }
            };
            
            const text = document.createElement('span');
            text.textContent = action;
            
            label.appendChild(radio);
            label.appendChild(text);
            actionsPanel.appendChild(label);
        });
        
        
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


// Make functions globally accessible
window.finishTurn = finishTurn;

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    showPage('start');
});