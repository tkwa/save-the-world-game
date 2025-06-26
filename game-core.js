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
    money: 1 // Starting money
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
            return `You are now the CEO of ${gameState.companyName}. The race to AGI begins now.`;
        },
        showStatus: false,
        buttons: [
            { text: "Begin", action: "goto", target: "main-game" }
        ]
    },
    "main-game": {
        title: function() {
            const turnTitle = `Turn ${gameState.currentTurn || 1} (${gameState.currentMonth || 'January'} ${gameState.currentYear || 2026})`;
            return gameState.companyName ? `${gameState.companyName} - ${turnTitle}` : "Critical Path";
        },
        text: function() {
            return `You are leading a top AI lab. You have $${gameState.money} to spend this turn. Choose how to allocate your resources:`;
        },
        showStatus: true,
        showActions: true,
        actions: [
            "AI R&D (increase AI Level)", 
            "Diplomacy R&D (increase Diplomacy)",
            "Product R&D (increase Product)", 
            "Safety R&D (increase Safety, decrease Doom)",
            "Skip Turn"
        ],
    },
    "end-game": {
        title: "Game Over",
        text: function() {
            if (gameState.playerAILevel >= 100) {
                return "You have achieved AGI! The future of humanity is now determined by your AI systems.";
            } else if (gameState.opensourceAILevel >= 100) {
                return "Open-source AI has reached AGI first. The future is uncertain as multiple uncontrolled AI systems compete for dominance.";
            }
            return "Game over.";
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
    
    // Corporate Divisions
    document.getElementById('money').textContent = gameState.money;
    document.getElementById('diplomacy-points').textContent = gameState.diplomacyPoints;
    document.getElementById('product-points').textContent = gameState.productPoints;
    document.getElementById('safety-points').textContent = gameState.safetyPoints;
    
    // Status Effects
    document.getElementById('sanctions-status').textContent = gameState.hasSanctions ? 'Sanctions Active' : 'No Sanctions';
    document.getElementById('un-recognition-status').textContent = gameState.hasUNRecognition ? 'UN Recognition' : 'No UN Recognition';
}



function allocateResources(resourceType) {
    switch(resourceType) {
        case 'AI R&D (increase AI Level)':
            gameState.playerAILevel += 5;
            break;
        case 'Diplomacy R&D (increase Diplomacy)':
            gameState.diplomacyPoints += 3;
            break;
        case 'Product R&D (increase Product)':
            gameState.productPoints += 3;
            break;
        case 'Safety R&D (increase Safety, decrease Doom)':
            gameState.safetyPoints += 3;
            gameState.doomLevel = Math.max(0, gameState.doomLevel - 3);
            break;
        case 'Skip Turn':
            // Do nothing
            break;
    }
    
    // Increase open-source AI level
    gameState.opensourceAILevel += Math.floor(Math.sqrt(Math.max(1, gameState.opensourceAILevel / 8)));
    
    // Advance turn
    gameState.currentTurn++;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = (gameState.currentTurn - 1) % 12;
    gameState.currentMonth = months[monthIndex];
    if (monthIndex === 0 && gameState.currentTurn > 1) {
        gameState.currentYear++;
    }
    
    updateStatusBar();
    
    // Check end conditions
    if (gameState.playerAILevel >= 100 || gameState.opensourceAILevel >= 100) {
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

function calculateRevenue() {
    // Formula from README: floor(sqrt(max(1, AL - OL)))
    return Math.floor(Math.sqrt(Math.max(1, gameState.playerAILevel - gameState.opensourceAILevel)));
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
        actionsPanel.innerHTML = '<h3>Available Actions:</h3>';
        
        const actionsList = document.createElement('ul');
        actionsList.className = 'actions-list';
        page.actions.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action;
            li.onclick = () => {
                allocateResources(action);
            };
            actionsList.appendChild(li);
        });
        actionsPanel.appendChild(actionsList);
        
        
        
        contentDiv.appendChild(actionsPanel);
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
                    gameState.currentPage = button.target;
                    showPage(button.target);
                }
            };
            buttonsDiv.appendChild(btn);
            });
        }
    }
}


// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    showPage('start');
});