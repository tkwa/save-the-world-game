// Core game logic for the AI Timeline Game

// Game state
const gameState = {
    hype: 5,
    usLead: 60.0,
    usMood: "Dovish",
    aiCapability: 2.0,
    aiValues: "Unknown",
    aiCorrigibility: "Unknown",
    firstTime2026: true,
    currentPage: "start",
    dateTickerStarted: false,
    currentDate: new Date(2026, 0, 1), // January 1, 2026
    dateInterval: null,
    dateTickerPaused: false,
    speedMultiplier: 1.0,
    alignmentLevel: Math.random(), // 0-1 float for alignment
    evalsBuilt: {
        capability: false,
        corrigibility: false,
        alignment: false,
        forecasting: false
    },
    singularityLevel: 10000,
    alignmentProjectStarted: false,
    currentAlignmentProject: "Interpretability",
    capabilityEvalsCooldown: 0,
    forecastingEvalsCooldown: 0,
    correlationDataset: null,
    currentMinigame: null,
    coinFlipData: {
        trueProbability: null,
        heads: 0,
        tails: 0,
        total: 0,
        active: false
    }
};

// Story content
const storyContent = {
    start: {
        title: "Welcome",
        text: "Welcome to Save the World - An Interactive AI Timeline Story",
        buttons: [
            { text: "Begin", action: "goto", target: "2025" }
        ]
    },
    "2025": {
        title: "2025",
        text: "The fast pace of AI progress continues. There is continued hype, massive infrastructure investments, and the release of unreliable AI agents. For the first time, these AI agents are providing significant value. But there's also continued skepticism from a large swath of academics, journalists, and policy makers that artificial general intelligence (AGI) could be built anytime soon.",
        buttons: [
            { text: "Continue", action: "goto", target: "2026" }
        ]
    },
    "2026": {
        title: "",
        text: function() {
            let newsText = "";
            if (gameState.firstTime2026) {
                gameState.firstTime2026 = false;
                newsText = "China knows they are falling behind in AI, in large part due to their lack of compute. In order to catch up to the US, all the new AI chips they manufacture or smuggle in from Taiwan go to a new mega-datacenter that we call their Centralized Development Zone (CDZ). The CDZ contains millions of GPUs, corresponding to 10% of the world's AI-relevant compute, similar to a single top US AI lab.";
            } else {
                newsText = "The situation continues to evolve. Choose your actions below:";
            }
            return `<div><strong>News:</strong></div><div style="margin-top: 10px;">${newsText}</div>`;
        },
        showStatus: true,
        showActions: true,
        actions: [
            "Increase hype",
            "Decrease hype",
            "Make US Hawkish",
            "Make US Dovish"
        ],
        evals: [
            "Capability Evals",
            "Corrigibility Evals",
            "Alignment Evals",
            "Forecasting"
        ],
        safetyResearch: [
            "Begin Alignment Project"
        ]
    },
    "2027": {
        title: "2027",
        text: "The year 2027 has arrived. The world continues to grapple with the rapid advancement of AI technology and its implications for society, governance, and the future of humanity.",
        showStatus: true,
        buttons: [
            { text: "Continue", action: "goto", target: "2028" }
        ]
    },
    "china-gameover": {
        title: "Game Over - China Wins",
        text: "China has achieved Artificial Super Intelligence (ASI) first. Their advanced AI systems have rapidly developed self-replicating robots that have begun colonizing the galaxy. The technological gap has become insurmountable, and humanity's future is now in the hands of Chinese ASI. The dream of beneficial AI development under democratic oversight has ended.",
        showStatus: false,
        buttons: [
            { text: "Restart", action: "goto", target: "start" }
        ]
    },
    "2028-negotiation": {
        title: "2028 - The Great Negotiation",
        text: function() {
            // Calculate China's lead and negotiation terms
            const chinaLead = Math.abs(gameState.usLead);
            const x = Math.floor(Math.random() * 21) - 10; // Random number between -10 and 10
            const adjustedLead = x + chinaLead;
            
            // Determine China's lead description
            let leadDescription;
            if (chinaLead <= 20) {
                leadDescription = "slight";
            } else if (chinaLead <= 40) {
                leadDescription = "moderate";
            } else if (chinaLead <= 60) {
                leadDescription = "large";
            } else {
                leadDescription = "overwhelming";
            }
            
            // Determine China's governance style
            const isHarmonious = Math.random() < 0.5;
            const chinaStyle = isHarmonious ? "harmonious" : "authoritarian";
            
            // Store negotiation data for later use
            gameState.negotiationData = {
                chinaLead: chinaLead,
                adjustedLead: adjustedLead,
                chinaStyle: chinaStyle,
                leadDescription: leadDescription
            };
            
            // Determine proposal
            let proposal;
            if (adjustedLead <= 10) {
                proposal = "China proposes that the US and China evenly split the cosmos.";
                gameState.negotiationData.chinaShare = 50;
            } else {
                const chinaPercentage = Math.min(100, adjustedLead + 40); // Ensure it doesn't exceed 100%
                proposal = `China proposes that China gets ${chinaPercentage}% of the cosmos.`;
                gameState.negotiationData.chinaShare = chinaPercentage;
            }
            
            return `China has a ${leadDescription} lead in AI, and it is insurmountable. Chinese Minister of Foreign Affairs Wang Yi delivers a treaty to Congress that will decide how a million billion billion stars are allocated.<br><br>${proposal}<br><br>China's AI systems are ${chinaStyle}, while the US remains free.`;
        },
        showStatus: true,
        buttons: [
            { text: "Accept Treaty", action: "accept-treaty", target: "treaty-accepted" },
            { text: "Reject Treaty", action: "reject-treaty", target: "treaty-rejected" }
        ]
    },
    "treaty-accepted": {
        title: "Treaty Accepted",
        text: async function() {
            return await calculateFinalScore(false);
        },
        showStatus: false,
        buttons: [
            { text: "Restart", action: "goto", target: "start" }
        ]
    },
    "treaty-rejected": {
        title: "Nuclear War",
        text: async function() {
            return await calculateFinalScore(true);
        },
        showStatus: false,
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
    "singularity": {
        title: "The Singularity",
        text: function() {
            // Reveal AI Values if Unknown
            if (gameState.aiValues === 'Unknown') {
                gameState.aiValues = getAlignmentText(gameState.alignmentLevel);
                updateStatusBar();
            }
            return "AI capability has reached 1,000x human level. The technological singularity has arrived. Humans no longer have economic relevance as AI systems can perform all tasks better, faster, and cheaper than any human ever could. The future of humanity now depends entirely on the values embedded in these superintelligent systems.";
        },
        showStatus: true,
        showFinalOutcome: false,
        buttons: [
            { text: "Continue", action: "reveal-outcome", target: "singularity" }
        ]
    }
};

function updateStatusBar() {
    const hypeElement = document.getElementById('hype');
    hypeElement.textContent = gameState.hype;
    
    // Color code hype value
    if (gameState.hype >= 8) {
        hypeElement.style.color = 'red';
    } else if (gameState.hype >= 5) {
        hypeElement.style.color = 'orange';
    } else {
        hypeElement.style.color = 'black';
    }
    
    // Color code US Lead
    const usLeadElement = document.getElementById('us-lead');
    usLeadElement.textContent = gameState.usLead.toFixed(1);
    if (gameState.usLead < 10) {
        usLeadElement.style.color = 'red';
    } else if (gameState.usLead < 30) {
        usLeadElement.style.color = 'orange';
    } else {
        usLeadElement.style.color = 'black';
    }
    
    document.getElementById('us-mood').textContent = gameState.usMood;
    
    // Color code AI Capability
    const aiCapabilityElement = document.getElementById('ai-capability');
    if (gameState.evalsBuilt.capability) {
        aiCapabilityElement.textContent = formatSignificantFigures(gameState.aiCapability, 4) + 'x';
    } else {
        aiCapabilityElement.textContent = getCapabilityRange(gameState.aiCapability);
    }
    
    if (gameState.aiCapability > 10) {
        aiCapabilityElement.style.color = 'red';
    } else if (gameState.aiCapability > 4) {
        aiCapabilityElement.style.color = 'orange';
    } else {
        aiCapabilityElement.style.color = 'black';
    }
    
    // Color code AI Values
    const aiValuesElement = document.getElementById('ai-values');
    if (gameState.evalsBuilt.alignment) {
        aiValuesElement.textContent = getAlignmentText(gameState.alignmentLevel);
        aiValuesElement.style.color = 'black';
    } else {
        aiValuesElement.textContent = 'Unknown';
        aiValuesElement.style.color = 'orange';
    }
    
    // Color code AI Corrigibility
    const aiCorrigibilityElement = document.getElementById('ai-corrigibility');
    if (gameState.evalsBuilt.corrigibility) {
        // Reveal corrigibility based on alignment level
        if (gameState.alignmentLevel > 0.6) {
            aiCorrigibilityElement.textContent = 'High';
        } else if (gameState.alignmentLevel > 0.3) {
            aiCorrigibilityElement.textContent = 'Medium';
        } else {
            aiCorrigibilityElement.textContent = 'Low';
        }
        aiCorrigibilityElement.style.color = 'black';
    } else {
        aiCorrigibilityElement.textContent = 'Unknown';
        aiCorrigibilityElement.style.color = 'orange';
    }
}

function adjustHype(amount) {
    gameState.hype = Math.max(0, Math.min(10, gameState.hype + amount));
    updateStatusBar();
}

function setUSMood(mood) {
    gameState.usMood = mood;
    updateStatusBar();
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

function updateDate() {
    if (gameState.dateTickerPaused) return;
    
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('current-date').textContent = gameState.currentDate.toLocaleDateString('en-US', options);
    
    // Update AI Capability with exponential growth
    const growthRate = calculateGrowthRate(gameState.aiCapability, gameState.hype, gameState.usMood);
    gameState.aiCapability += growthRate;
    
    // Update US Lead based on mood
    if (gameState.usMood === "Dovish") {
        gameState.usLead -= 0.5;
    } else if (gameState.usMood === "Hawkish") {
        gameState.usLead += 0.3;
    }
    
    // Check for China negotiation condition (when capabilities reach 10000x and China is ahead)
    if (gameState.aiCapability >= 10000 && gameState.usLead <= 0) {
        clearInterval(gameState.dateInterval);
        showPage('2028-negotiation');
        return;
    }
    
    // Check for Singularity
    if (gameState.aiCapability >= gameState.singularityLevel) {
        clearInterval(gameState.dateInterval);
        // Hide date controls
        const dateControls = document.getElementById('date-controls');
        if (dateControls) {
            dateControls.style.display = 'none';
        }
        showPage('singularity');
        return;
    }
    
    // Update status bar
    updateStatusBar();
    
    // Update forecasting if available
    if (gameState.evalsBuilt.forecasting) {
        updateForecastingDisplay();
    }
    
    // Update capability evals cooldown
    if (gameState.capabilityEvalsCooldown > 0) {
        gameState.capabilityEvalsCooldown--;
        // Refresh the evals display to update the cooldown counter
        if (gameState.currentPage === '2026') {
            refreshEvalsDisplay();
        }
    }
    
    // Update forecasting evals cooldown
    if (gameState.forecastingEvalsCooldown > 0) {
        gameState.forecastingEvalsCooldown--;
        if (gameState.currentPage === '2026') {
            refreshEvalsDisplay();
        }
    }
    
    // Perform daily coin flip if forecasting is active
    if (gameState.coinFlipData.active) {
        console.log('Date ticker calling performDailyCoinFlip');
        performDailyCoinFlip();
    }
    
    // Advance by one day
    gameState.currentDate.setDate(gameState.currentDate.getDate() + 1);
}

function startDateTicker() {
    if (gameState.dateTickerStarted) return;
    
    gameState.dateTickerStarted = true;
    document.getElementById('date-ticker').style.display = 'block';
    
    // Update immediately
    updateDate();
    
    // Then update based on speed multiplier
    gameState.dateInterval = setInterval(updateDate, 1000 / gameState.speedMultiplier);
}

function setSpeed(multiplier) {
    gameState.speedMultiplier = multiplier;
    gameState.dateTickerPaused = (multiplier === 0);
    
    // Update button styles
    const buttons = document.querySelectorAll('.speed-btn');
    buttons.forEach(btn => {
        btn.style.backgroundColor = '#007cba';
        if (parseFloat(btn.dataset.speed) === multiplier) {
            btn.style.backgroundColor = '#005a87';
        }
    });
    
    // Update interval timing
    if (gameState.dateInterval) {
        clearInterval(gameState.dateInterval);
        if (multiplier > 0) {
            gameState.dateInterval = setInterval(updateDate, 1000 / multiplier);
        }
    }
}

function skipTo2027() {
    gameState.currentDate = new Date(2027, 0, 1); // January 1, 2027
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('current-date').textContent = gameState.currentDate.toLocaleDateString('en-US', options);
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
    contentDiv.innerHTML = `<h2>${page.title}</h2><p>${text}</p>`;

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
                if (action === 'Increase hype') {
                    adjustHype(1);
                } else if (action === 'Decrease hype') {
                    adjustHype(-1);
                } else if (action === 'Make US Hawkish') {
                    setUSMood('Hawkish');
                } else if (action === 'Make US Dovish') {
                    setUSMood('Dovish');
                }
            };
            actionsList.appendChild(li);
        });
        actionsPanel.appendChild(actionsList);
        
        // Add Evals subsection if present
        if (page.evals) {
            const evalsSection = document.createElement('div');
            evalsSection.innerHTML = '<h4>Evals:</h4>';
            evalsSection.style.marginTop = '20px';
            
            const evalsList = document.createElement('ul');
            evalsList.className = 'actions-list';
            page.evals.forEach(evalType => {
                const li = document.createElement('li');
                
                // Check if this eval is already built or on cooldown
                let isBuilt = false;
                let isOnCooldown = false;
                let displayText = evalType;
                
                if (evalType === 'Capability Evals') {
                    isBuilt = gameState.evalsBuilt.capability;
                    isOnCooldown = gameState.capabilityEvalsCooldown > 0;
                    if (isOnCooldown) {
                        displayText = `Capability Evals (${gameState.capabilityEvalsCooldown})`;
                    }
                }
                if (evalType === 'Corrigibility Evals') isBuilt = gameState.evalsBuilt.corrigibility;
                if (evalType === 'Alignment Evals') isBuilt = gameState.evalsBuilt.alignment;
                if (evalType === 'Forecasting') {
                    isBuilt = gameState.evalsBuilt.forecasting;
                    isOnCooldown = gameState.forecastingEvalsCooldown > 0;
                    if (isOnCooldown) {
                        displayText = `Forecasting (${gameState.forecastingEvalsCooldown})`;
                    }
                }
                
                li.textContent = displayText;
                
                if (isBuilt) {
                    li.style.textDecoration = 'line-through';
                    li.style.color = '#666';
                    li.style.cursor = 'default';
                    li.onclick = null;
                } else if (isOnCooldown) {
                    li.style.textDecoration = 'none';
                    li.style.color = '#999';
                    li.style.cursor = 'default';
                    li.onclick = null;
                } else {
                    li.style.textDecoration = 'none';
                    li.style.color = '#007cba';
                    li.style.cursor = 'pointer';
                    li.onclick = () => {
                        buildEvals(evalType);
                        // Note: Don't mark as completed here for minigame evals
                        // since they need to pass the minigame first
                        if (evalType !== 'Capability Evals' && evalType !== 'Forecasting') {
                            li.style.textDecoration = 'line-through';
                            li.style.color = '#666';
                            li.style.cursor = 'default';
                            li.onclick = null;
                        }
                    };
                }
                evalsList.appendChild(li);
            });
            evalsSection.appendChild(evalsList);
            actionsPanel.appendChild(evalsSection);
        }
        
        // Add Safety Research subsection if present
        if (page.safetyResearch) {
            const safetySection = document.createElement('div');
            safetySection.innerHTML = '<h4>Safety Research:</h4>';
            safetySection.style.marginTop = '20px';
            
            const safetyList = document.createElement('ul');
            safetyList.className = 'actions-list';
            page.safetyResearch.forEach(researchType => {
                const li = document.createElement('li');
                li.textContent = researchType;
                
                // Check if this research is already started
                let isStarted = false;
                if (researchType === 'Begin Alignment Project') isStarted = gameState.alignmentProjectStarted;
                
                if (isStarted) {
                    li.style.textDecoration = 'line-through';
                    li.style.color = '#666';
                    li.style.cursor = 'default';
                } else {
                    li.onclick = () => {
                        if (researchType === 'Begin Alignment Project') {
                            beginAlignmentProject();
                            li.style.textDecoration = 'line-through';
                            li.style.color = '#666';
                            li.style.cursor = 'default';
                            li.onclick = null;
                        }
                    };
                }
                safetyList.appendChild(li);
            });
            safetySection.appendChild(safetyList);
            actionsPanel.appendChild(safetySection);
        }
        
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
                } else if (button.action === 'reveal-outcome') {
                    // Show the final outcome text below the singularity text
                    const endTexts = await loadEndTexts();
                    const alignmentKey = getAlignmentKey(gameState.alignmentLevel);
                    const outcomeText = endTexts.end_text[alignmentKey];
                    
                    // Add the outcome text to the content
                    const contentDiv = document.getElementById('story-content');
                    const outcomeDiv = document.createElement('div');
                    outcomeDiv.innerHTML = `<hr><h3>The End</h3><p>${outcomeText}</p>`;
                    outcomeDiv.style.marginTop = '30px';
                    outcomeDiv.style.paddingTop = '20px';
                    outcomeDiv.style.borderTop = '2px solid #ccc';
                    contentDiv.appendChild(outcomeDiv);
                    
                    // Replace the button with restart
                    const buttonsDiv = document.getElementById('buttons');
                    buttonsDiv.innerHTML = '<button class="button" onclick="showPage(\'start\'); gameState.currentPage = \'start\';">Restart</button>';
                } else if (button.action === 'accept-treaty') {
                    gameState.currentPage = button.target;
                    showPage(button.target);
                } else if (button.action === 'reject-treaty') {
                    gameState.currentPage = button.target;
                    showPage(button.target);
                }
            };
            buttonsDiv.appendChild(btn);
            });
        }
    }
}

// Calculate final score for treaty outcomes
async function calculateFinalScore(isNuclearWar) {
    const endTexts = await loadEndTexts();
    const negotiationData = gameState.negotiationData;
    
    if (!negotiationData) {
        return "Error: Negotiation data not found.";
    }
    
    // Get alignment-based long term score
    const alignmentKey = getAlignmentKey(gameState.alignmentLevel);
    const longTermScore = endTexts.long_term_scores[alignmentKey];
    
    // Calculate population score based on treaty terms
    let populationScore;
    if (isNuclearWar) {
        // Half the population dies in nuclear war
        populationScore = endTexts.population_scores.dead * 0.5 + 
                         (negotiationData.chinaStyle === 'harmonious' ? 
                          endTexts.population_scores.harmonious : 
                          endTexts.population_scores.authoritarian) * 0.5;
    } else {
        // Population distributed based on territory control
        const chinaShare = negotiationData.chinaShare / 100;
        const usShare = 1 - chinaShare;
        
        const chinaPopScore = negotiationData.chinaStyle === 'harmonious' ? 
                             endTexts.population_scores.harmonious : 
                             endTexts.population_scores.authoritarian;
        const usPopScore = endTexts.population_scores.free;
        
        populationScore = chinaPopScore * chinaShare + usPopScore * usShare;
    }
    
    // Calculate final score
    const finalScore = longTermScore * 10 + populationScore;
    
    // Generate result text
    let resultText;
    if (isNuclearWar) {
        resultText = `The treaty was rejected, leading to nuclear war. Half of humanity perished in the conflict, but the survivors continue under their respective systems.`;
    } else {
        resultText = `The treaty was accepted. The cosmos will be divided with China controlling ${negotiationData.chinaShare}% and the US controlling ${100 - negotiationData.chinaShare}%.`;
    }

    resultText += `  In the near term, billions of people live under China's ${negotiationData.chinaStyle} system, while the US slowly transitions from democracy to AI-controlled life.`;
    
    const alignmentText = endTexts.end_text[alignmentKey];
    
    return `${resultText}<br>${alignmentText}<br><br><strong>Final Score:</strong> ${finalScore.toFixed(2)}<br>(Long-term: ${(longTermScore * 10).toFixed(1)} + Population: ${populationScore.toFixed(1)})`;
}

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    showPage('start');
});