// Core game logic for the AI Timeline Game
import {
    calculateAdjustedRiskPercent,
    getRiskFactors,
    getAISystemVersion,
    getRiskColor,
    getGalaxyMultipliers,
    boldifyNumbers,
    COMPANIES,
    GAME_CONSTANTS,
    STATUS_EFFECT_DEFINITIONS,
    INITIAL_TECHNOLOGIES,
    gameState
} from './utils.js';

import {
    generateEvent,
    populateDebugDropdown,
    giveResources,
    debugUnlockProjects,
    debugShowEventPool,
    applyChoiceEffects,
    applyEventEffects,
    forceEvent
} from './events.js';

import {
    startMinigame,
    updateAlignmentMinigame,
    submitCapabilityEvalsAnswer,
    submitForecastingEvalsAnswer
} from './minigames.js';

import {
    introState,
    initializeIntro,
    updateIntroDebugButtonVisibility,
    resetIntroState
} from './opening.js';

import {
    scaleAILevelsForEndGame,
    getEndGamePhaseText,
    getEndGamePhaseButtons,
    calculateEndGameScore
} from './endgame.js';


/* global updateEventPoolOverlay, startDateTicker, MutationObserver, setInterval, clearInterval, prompt, alert */
/* eslint-disable no-unused-vars */
/* global continueToNextPhase */
/* eslint-enable no-unused-vars */

const VERSION = "v0.5.1"


// Technology visibility conditions - functions that determine if a tech should be visible
const TECHNOLOGY_VISIBILITY = {
    // Column 1: General technologies  
    robotaxi: () => true, // Always visible (including during intro)
    normalPersuasion: () => gameState.mainGameStarted && gameState.eventsAccepted.has('persuasion-breakthrough'), // Basic persuasion tech from event
    aiResearchLead: () => gameState.mainGameStarted && gameState.technologies.robotaxi,
    superpersuasion: () => gameState.mainGameStarted && gameState.technologies.normalPersuasion, // Superpersuasion requires basic persuasion
    
    
    // Column 2: Medicine - each depends on the one above
    medicine: () => gameState.mainGameStarted, // Show medicine in main game
    syntheticBiology: () => gameState.mainGameStarted && gameState.technologies.medicine,
    cancerCure: () => gameState.mainGameStarted && gameState.technologies.syntheticBiology,
    brainUploading: () => gameState.mainGameStarted && gameState.technologies.cancerCure,
    
    // Column 3: Robotics - each depends on the one above  
    robotics: () => gameState.mainGameStarted, // Show robotics in main game
    humanoidRobots: () => gameState.mainGameStarted && gameState.technologies.robotics,
    roboticSupplyChains: () => gameState.mainGameStarted && gameState.technologies.humanoidRobots,
    nanotech: () => gameState.mainGameStarted && gameState.technologies.roboticSupplyChains,
    
    // Column 4: Alignment - monitoring and alignment require projects unlocked, interpretability always visible
    aiMonitoring: () => gameState.mainGameStarted && gameState.projectsUnlocked,
    aiControl: () => gameState.mainGameStarted && gameState.technologies.aiMonitoring,
    aiAlignment: () => gameState.mainGameStarted && gameState.projectsUnlocked,
    aiInterpretability: () => gameState.mainGameStarted, // Show in main game
    
    // Column 5: Military - special dependencies
    cyberWarfare: () => gameState.mainGameStarted, // Show cyber warfare in main game
    bioweapons: () => gameState.mainGameStarted && gameState.technologies.syntheticBiology,
    killerDrones: () => gameState.mainGameStarted && gameState.technologies.robotics,
    nukes: () => gameState.mainGameStarted && gameState.technologies.humanoidRobots
};

// Utility function to calculate galaxy scoring multipliers


// Game state imported from utils.js

// Story content
const storyContent = {
    start: {
        title: "",
        text: `<div style="position: absolute; top: 10px; right: 15px; color: #666; font-size: 12px;">${VERSION}</div>`,
        buttons: [
            { text: "New Game", action: "goto", target: "intro" }
        ]
    },
    intro: {
        title: function() {
            const role = 'CEO'; // Always CEO during intro
            const companyDisplay = (typeof introState !== 'undefined' && introState.companyName) ? introState.companyName : 'Company';
            const currentMonth = (typeof introState !== 'undefined' && introState.currentMonth) ? introState.currentMonth : 'December';
            const currentYear = (typeof introState !== 'undefined' && introState.currentYear) ? introState.currentYear : 2024;
            const flagDisplay = (typeof introState !== 'undefined' && introState.selectedCompany && introState.selectedCompany.flag) ? 
                `<span style="font-size: 20px; margin-left: 8px;">${introState.selectedCompany.flag}</span>` : '';
            
            return `<div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${currentMonth} ${currentYear}</span>
                <span style="font-size: 14px; color: #999;">
                    Role: ${role}, ${companyDisplay}${flagDisplay}
                </span>
            </div>`;
        },
        text: function() {
            return `
                <button id="intro-skip-button" onclick="skipIntroToMainGame()">Skip</button>
                
                <div style="text-align: center;">
                    <button id="intro-ai-button" class="intro-ai-button" onclick="handleAIRDButtonPress()">
                        AI R&D (+3%)
                    </button>
                </div>
                
                <div id="intro-text-container" class="intro-text-container">
                    <!-- Progressive text will appear here -->
                </div>
                
                <div style="text-align: center;">
                    <button id="intro-transition-button" onclick="startMainGame()">
                        Begin
                    </button>
                </div>
            `;
        },
        showStatus: true,
        buttons: [],
        onShow: function() {
            // Initialize the intro sequence when this page loads
            initializeIntro();
            // Update debug button visibility when intro page loads
            if (typeof updateIntroDebugButtonVisibility === 'function') {
                setTimeout(updateIntroDebugButtonVisibility, 100);
            }
        }
    },
    "game-setup": {
        title: "January 2026",
        text: async function () {
            // Randomly assign company from the shared COMPANIES array (defined in events.js)
            const selectedCompany = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
            gameState.companyName = selectedCompany.name;
            gameState.companyLongName = selectedCompany.longName;
            gameState.companyCountry = selectedCompany.homeCountry;
            gameState.companyCountryName = selectedCompany.countryName;
            gameState.companyFlag = selectedCompany.flag;
            
            // Assign competitor companies (excluding player's company)
            const remainingCompanies = COMPANIES.filter(c => c.name !== gameState.companyName);
            gameState.competitorNames = [];
            for (let i = 0; i < GAME_CONSTANTS.MAX_COMPETITORS; i++) {
                const randomIndex = Math.floor(Math.random() * remainingCompanies.length);
                gameState.competitorNames.push(remainingCompanies.splice(randomIndex, 1)[0].name);
            }
            
            gameState.currentTurn = GAME_CONSTANTS.INITIAL_TURN;
            gameState.currentMonth = "January";
            gameState.currentYear = GAME_CONSTANTS.INITIAL_YEAR;
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
            const role = gameState.isVPSafetyAlignment ? 
                'VP of Safety and Alignment' : 
                'CEO';
            const companyDisplay = gameState.companyLongName || gameState.companyName || 'Company';
            const flagDisplay = gameState.companyFlag ? `<span style="font-size: 20px; margin-left: 8px;">${gameState.companyFlag}</span>` : '';
            
            // Create tooltip content for role tracker
            const equityPercent = Math.round(gameState.playerEquity * 100 * 10) / 10; // Round to 1 decimal place
            
            // Calculate point values using shared function
            const multipliers = getGalaxyMultipliers();
            
            const tooltipContent = `You have <strong>${equityPercent}%</strong> equity in ${companyDisplay}. You want to avoid human extinction due to rogue AI. You want humanity to inherit the stars (<strong>+${multipliers.humanity} points</strong> per human filament) but are also selfish (<strong>+${Math.round(multipliers.player * 10) / 10} additional points</strong> per personal filament).`;
            
            return `<div style="display: flex; justify-content: space-between; align-items: center;"><span>${gameState.currentMonth || 'January'} ${gameState.currentYear || 2026}</span><span class="tooltip" style="font-size: 14px; color: #999;">Role: ${role}, ${companyDisplay}${flagDisplay}<span class="tooltiptext" style="width: 300px; margin-left: -150px; font-weight: normal;">${tooltipContent}</span></span></div>`;
        },
        text: function () {
            return '';
        },
        customContent: function () {
            // Show current event after resource allocation
            if (gameState.currentEvent) {
                let eventHtml = `<div style="border-top: 2px solid #555; padding-top: 20px; margin-top: 20px;">`;
                // Add event title as heading if it exists
                if (gameState.currentEvent.title) {
                    eventHtml += `<h3 style="color: #f0f0f0; margin-bottom: 10px; margin-top: 0;">${gameState.currentEvent.title}</h3>`;
                }
                eventHtml += `<p style="color: #d0d0d0; margin-bottom: 15px;">${gameState.currentEvent.text}</p>`;

                if (gameState.currentEvent.showResult && gameState.currentEvent.resultText) {
                    // Showing result of choice - display result and appropriate button
                    const processedResultText = boldifyNumbers(gameState.currentEvent.resultText);
                    eventHtml += `<p style="color: #d0d0d0; margin-bottom: 15px;">${processedResultText}</p>`;
                    
                    // Check if there's a singularity button (AI escape scenarios)
                    if (gameState.currentEvent.singularityButton) {
                        const buttonText = gameState.currentEvent.singularityButton.text;
                        const buttonAction = gameState.currentEvent.singularityButton.action;
                        eventHtml += `<button class="button" onclick="handleSingularityButton('${buttonAction}')">${buttonText}</button>`;
                    } else {
                        // Regular next turn button
                        eventHtml += `<button class="button" onclick="finishTurn()">Next Turn <strong>⏎</strong></button>`;
                    }
                } else if (gameState.currentEvent.choices && gameState.currentEvent.choices.length > 0) {
                    // Event has choices - show them as buttons
                    gameState.currentEvent.choices.forEach((choice, index) => {
                        const affordability = getChoiceAffordability(choice);
                        const canAfford = affordability.canAfford;
                        const allocationMade = gameState.selectedAllocation !== null;
                        const enabled = allocationMade && canAfford;
                        
                        const buttonStyle = enabled ?
                            `margin: 5px 5px 5px 0;` :
                            `margin: 5px 5px 5px 0; background-color: #666; cursor: not-allowed; opacity: 0.6;`;
                        const onclick = enabled ? `handleEventChoice(${index})` : '';
                        
                        // Format choice text with cost highlighting
                        const formattedText = formatChoiceTextWithCosts(choice);
                        
                        // Create tooltip for unaffordable choices using custom CSS tooltip system
                        let tooltipHtml = '';
                        if (!canAfford && affordability.missingResources.length > 0) {
                            const missingList = affordability.missingResources.map(r => 
                                `${r.name}: need ${r.needed}, have ${r.have}`
                            ).join('<br>');
                            tooltipHtml = `<span class="tooltiptext">Not enough resources:<br>${missingList}</span>`;
                        } else if (!allocationMade) {
                            // Create tooltip for when allocation hasn't been made yet
                            tooltipHtml = `<span class="tooltiptext">Allocate AI labor first</span>`;
                        }
                        
                        const buttonClass = tooltipHtml ? 'button tooltip' : 'button';
                        eventHtml += `<button class="${buttonClass}" onclick="${onclick}" style="${buttonStyle}">${formattedText}${tooltipHtml}</button>`;
                    });
                } else {
                    // No choices - just next turn button
                    const allocationMade = gameState.selectedAllocation !== null;
                    const buttonStyle = allocationMade ?
                        `` :
                        `background-color: #666; cursor: not-allowed; opacity: 0.6;`;
                    const onclick = allocationMade ? `finishTurn()` : '';
                    
                    // Add tooltip for when allocation hasn't been made yet
                    let tooltipHtml = '';
                    if (!allocationMade) {
                        tooltipHtml = `<span class="tooltiptext">Allocate AI labor first</span>`;
                    }
                    
                    const buttonClass = tooltipHtml ? 'button tooltip' : 'button';
                    eventHtml += `<button class="${buttonClass}" onclick="${onclick}" style="${buttonStyle}">Next Turn <strong>⏎</strong>${tooltipHtml}</button>`;
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
        title: "The Singularity",
        text: function () {
            return getEndGamePhaseText();
        },
        showStatus: true,
        buttons: function() {
            return getEndGamePhaseButtons();
        }
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
    "alignment-minigame": {
        title: "Alignment Research",
        text: function () {
            return `<div style="text-align: center;">
                <p>Most AI algorithms are benign (<span style="color: #4444ff; font-weight: bold;">blue</span>), but power-seeking <span style="color: #ff4444; font-weight: bold;">red</span> algorithms emerge in long-horizon tasks. Though less numerous, red algorithms grow much faster because they're instrumentally convergent - selected for their effectiveness at achieving goals regardless of alignment.</p>
                <p>Click on <span style="color: #ff4444; font-weight: bold;">red</span> circles to halt them before they dominate, and maximize the fraction of the system that is <span style="color: #4444ff; font-weight: bold;">aligned</span>.</p>
                <div style="position: relative; display: inline-block;">
                    <canvas id="alignment-canvas" width="600" height="400" 
                            style="border: 2px solid #555; background-color: #1a1a1a; cursor: crosshair;"
                            onclick="clickAlignmentCanvas(event)"></canvas>
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.8); padding: 8px; border-radius: 5px; font-family: 'Courier New', monospace; pointer-events: none;">
                        <div style="color: #ffa726; font-size: 14px;"><strong>Time: <span id="alignment-timer">12.0</span>s</strong></div>
                        <div style="color: #66bb6a; font-size: 14px;"><strong>Alignment: <span id="alignment-percentage">0.0</span>%</strong></div>
                    </div>
                </div>
            </div>`;
        },
        showStatus: true,
        customButtons: true,
        buttons: [],
        onShow: function() {
            // Start the minigame display when the page is shown (but don't start the game)
            setTimeout(() => {
                if (gameState.currentMinigame && gameState.currentMinigame.type === 'alignment-research') {
                    updateAlignmentMinigame();
                }
            }, 100);
        }
    },
};


function generateAICapabilitiesTooltip() {
    // Create ranking array with all companies
    const ranking = [
        { name: gameState.companyName || 'Company', level: Math.round(gameState.playerAILevel), isPlayer: true },
        { name: gameState.competitorNames[0] || 'Competitor 1', level: Math.round(gameState.competitorAILevels[0]), isPlayer: false },
        { name: gameState.competitorNames[1] || 'Competitor 2', level: Math.round(gameState.competitorAILevels[1]), isPlayer: false },
        { name: gameState.competitorNames[2] || 'Competitor 3', level: Math.round(gameState.competitorAILevels[2]), isPlayer: false }
    ];
    
    // Sort by level descending
    ranking.sort((a, b) => b.level - a.level);
    
    // Generate ranking text
    const rankingText = ranking.map((company, index) => {
        const rank = index + 1;
        const companyText = company.isPlayer ? `<strong>${company.name}</strong>` : company.name;
        const systemVersion = getAISystemVersion(company.name, company.level);
        return `${rank}. ${companyText}: ${company.level}x (${systemVersion})`;
    }).join('<br>');
    
    return `AI level determines the effective labor available to a company. A company with <strong>1x</strong> AI has <strong>1 million labor-hours/month</strong>. <strong style="color: #ff6b6b;">ASI</strong> is achieved when one company reaches <strong>1000x</strong> capabilities. The current ranking is:<br><br>${rankingText}`;
}

function getAIRisksByCapability(capabilityLevel) {
    if (capabilityLevel < GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_1) {
        return ["spam generation", "basic misinformation"];
    } else if (capabilityLevel < GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_2) {
        return ["cyberattacks", "mass disinformation campaigns"];
    } else if (capabilityLevel < GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_3) {
        return ["autonomous killer drones", "coordinated social media manipulation"];
    } else if (capabilityLevel < GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_4) {
        return ["economic market manipulation", "deepfake-assisted fraud"];
    } else if (capabilityLevel < GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_5) {
        return ["automated propaganda warfare", "AI-assisted political coups"];
    } else if (capabilityLevel < GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_6) {
        return ["bioweapons design", "totalitarian surveillance states"];
    } else {
        return ["world takeover when company-assisted", "complete human obsolescence"];
    }
}


function generateRogueAIRiskTooltip() {
    const rawRisk = gameState.rawRiskLevel;
    const adjustedRisk = calculateAdjustedRiskPercent();
    const { safetyFactor, alignmentFactor, interpretabilityFactor } = getRiskFactors();
    const riskPercent = Math.round(adjustedRisk);
    const monthlyIncidentChance = Math.pow(adjustedRisk / 100, 2) * 100;
    const companyName = gameState.companyName || 'your company';
    
    // Get current capability frontier (highest AI level)
    const capabilityFrontier = Math.max(gameState.playerAILevel, ...gameState.competitorAILevels);
    const currentRisks = getAIRisksByCapability(capabilityFrontier);
    
    // Apply same color logic as status bar: red if >50%, amber if >15%, otherwise white
    const riskColor = getRiskColor(adjustedRisk);
    
    // Build calculation explanation
    let calculationText = '';
    if (gameState.safetyPoints > 0 || gameState.alignmentMaxScore > 0 || gameState.interpretabilityProgress > 0) {
        calculationText = `Risk = <strong>${rawRisk.toFixed(1)}%</strong> (AI Level) / (<strong>${safetyFactor.toFixed(2)}</strong> (Safety R&D) × <strong>${alignmentFactor.toFixed(2)}</strong> (Alignment) × <strong>${interpretabilityFactor.toFixed(2)}</strong> (Interpretability)) = <strong>${adjustedRisk.toFixed(1)}%</strong><br><br>`;
    }
    
    return `Current AI systems are capable of harms like <strong>${currentRisks[0]}</strong> and <strong>${currentRisks[1]}</strong>, and <strong style="color: #ff6b6b;">ASI</strong> could threaten humanity as a whole.<br><br>${calculationText}Currently the risk of <strong style="color: ${riskColor};">${riskPercent}%</strong> means:<br>- <strong style="color: ${riskColor};">${riskPercent}%</strong> chance of existential risk at game end<br>- ${riskPercent}%² = <strong style="color: ${riskColor};">${monthlyIncidentChance.toFixed(1)}%</strong> monthly chance of ${companyName} safety incident.`;
}

function updateAISection() {
    // Player AI level
    const playerAIElement = document.getElementById('player-ai-level');
    const roundedPlayerAI = Math.round(gameState.playerAILevel);
    playerAIElement.textContent = `${roundedPlayerAI}x`;
    playerAIElement.style.fontWeight = 'bold';
    // Red if less than top competitor AI level
    playerAIElement.style.color = gameState.playerAILevel < gameState.competitorAILevels[0] ? '#ff6b6b' : '#e0e0e0';
    
    // Risk level - adjusted by safety R&D and alignment score
    const riskElement = document.getElementById('risk-level');
    const adjustedRisk = calculateAdjustedRiskPercent();
    const roundedRisk = Math.round(adjustedRisk);
    riskElement.textContent = `${roundedRisk}%`;
    riskElement.style.fontWeight = 'bold';
    // Risk-based color (use adjusted risk for color)
    riskElement.style.color = getRiskColor(adjustedRisk);
    
    // Make "Rogue AI Risk" label red and bold if >75%, otherwise just bold
    const riskLabelElement = document.getElementById('risk-label');
    riskLabelElement.style.color = getCriticalRiskColor(adjustedRisk);
    riskLabelElement.style.fontWeight = 'bold';
    
    // Competitor AI levels
    const competitor1Element = document.getElementById('competitor1-ai-level');
    competitor1Element.textContent = `${Math.round(gameState.competitorAILevels[0])}x`;
    competitor1Element.style.fontWeight = 'bold';
    competitor1Element.style.color = '#e0e0e0';
    
    const competitor2Element = document.getElementById('competitor2-ai-level');
    competitor2Element.textContent = `${Math.round(gameState.competitorAILevels[1])}x`;
    competitor2Element.style.fontWeight = 'bold';
    competitor2Element.style.color = '#e0e0e0';
    
    const competitor3Element = document.getElementById('competitor3-ai-level');
    competitor3Element.textContent = `${Math.round(gameState.competitorAILevels[2])}x`;
    competitor3Element.style.fontWeight = 'bold';
    competitor3Element.style.color = '#e0e0e0';
}

function updateCompanySection() {
    // Company names
    document.getElementById('company-name-ai').textContent = gameState.companyName || 'Company';
    
    // Update tooltips
    const tooltipElement = document.getElementById('ai-capabilities-tooltip');
    if (tooltipElement) {
        tooltipElement.innerHTML = generateAICapabilitiesTooltip();
    }
    
    const riskTooltipElement = document.getElementById('rogue-ai-risk-tooltip');
    if (riskTooltipElement) {
        riskTooltipElement.innerHTML = generateRogueAIRiskTooltip();
    }
}

function updateCompanyResources() {
    // Money
    const moneyElement = document.getElementById('money');
    const displayMoney = Math.floor(gameState.money);
    moneyElement.textContent = `$${displayMoney}B`;
    moneyElement.style.fontWeight = 'bold';
    moneyElement.style.color = displayMoney === 0 ? '#ff6b6b' : '#e0e0e0';
    
    // Diplomacy points
    const diplomacyElement = document.getElementById('diplomacy-points');
    diplomacyElement.textContent = Math.round(gameState.diplomacyPoints);
    diplomacyElement.style.fontWeight = 'bold';
    diplomacyElement.style.color = gameState.diplomacyPoints === 0 ? '#ff6b6b' : '#e0e0e0';
    
    // Product points
    const productElement = document.getElementById('product-points');
    productElement.textContent = Math.round(gameState.productPoints);
    productElement.style.fontWeight = 'bold';
    productElement.style.color = gameState.productPoints === 0 ? '#ff6b6b' : '#e0e0e0';
    
    // Safety points (removed from UI, kept only in tooltips)
}

function updateStatusEffects() {
    const sanctionsElement = document.getElementById('sanctions-status');
    const sanctionsTooltip = document.getElementById('sanctions-tooltip');
    
    const statusTexts = [];
    const tooltipTexts = [];
    
    // Status effects system using centralized dictionary
    for (const [effectName, effectData] of Object.entries(gameState.statusEffects)) {
        if (effectData && effectData.active) {
            const definition = STATUS_EFFECT_DEFINITIONS[effectName];
            if (definition) {
                // Use centralized definition
                statusTexts.push(definition.displayName);
                tooltipTexts.push(definition.tooltip);
            } else {
                // Fallback for effects not in dictionary yet
                const displayName = effectName.charAt(0).toUpperCase() + effectName.slice(1).replace(/([A-Z])/g, ' $1');
                statusTexts.push(displayName);
                tooltipTexts.push(effectData.description || `${displayName} status effect is active.`);
            }
        }
    }
    
    // Update UI elements
    if (statusTexts.length > 0) {
        sanctionsElement.textContent = statusTexts.join(', ');
        sanctionsElement.style.color = '#ffa726'; // Orange for status effects
        if (sanctionsTooltip) {
            sanctionsTooltip.innerHTML = tooltipTexts.join('<br><br>');
        }
    } else {
        sanctionsElement.textContent = '';
        if (sanctionsTooltip) {
            sanctionsTooltip.innerHTML = '';
        }
    }
    
    // Apply red background when Shaken
    const body = document.body;
    if (gameState.statusEffects.shaken && gameState.statusEffects.shaken.active) {
        body.classList.add('shaken-background');
    } else {
        body.classList.remove('shaken-background');
    }
}

// Helper functions for status effects management
function setStatusEffect(effectName, active = true) {
    if (active) {
        const definition = STATUS_EFFECT_DEFINITIONS[effectName];
        if (definition) {
            gameState.statusEffects[effectName] = {
                active: true,
                ...definition
            };
        } else {
            console.warn(`Status effect '${effectName}' not found in definitions`);
            gameState.statusEffects[effectName] = {
                active: true,
                name: effectName,
                displayName: effectName.charAt(0).toUpperCase() + effectName.slice(1),
                tooltip: `${effectName} status effect is active.`,
                stackable: false
            };
        }
    } else {
        delete gameState.statusEffects[effectName];
    }
}

function hasStatusEffect(effectName) {
    return gameState.statusEffects[effectName]?.active === true;
}

// Legacy helper functions for backwards compatibility
function setSanctions(active = true) {
    setStatusEffect('sanctions', active);
}

function hasSanctions() {
    return hasStatusEffect('sanctions');
}

// Visual feedback for capability increases
function showCapabilityIncrease(oldLevel, newLevel) {
    const playerAIElement = document.getElementById('player-ai-level');
    const aiCapabilitiesSection = document.getElementById('ai-capabilities-section');
    
    if (!playerAIElement || !aiCapabilitiesSection) return;
    
    const gain = newLevel - oldLevel;
    if (gain <= 0) return; // No increase to show
    
    // Determine if this is a major increase (>= 5x gain)
    const isMajorIncrease = gain >= 5;
    
    // Add glow effect to the AI level number
    playerAIElement.classList.remove('capability-increase-glow', 'capability-major-increase');
    void playerAIElement.offsetWidth; // Force reflow to restart animation
    
    if (isMajorIncrease) {
        playerAIElement.classList.add('capability-major-increase');
    } else {
        playerAIElement.classList.add('capability-increase-glow');
    }
    
    // Create floating "+XX" text
    const floatingText = document.createElement('div');
    floatingText.textContent = `+${gain.toFixed(1)}x`;
    floatingText.className = isMajorIncrease ? 'floating-major-increase' : 'floating-increase';
    
    // Position the floating text relative to the AI capabilities section
    const rect = playerAIElement.getBoundingClientRect();
    const containerRect = aiCapabilitiesSection.getBoundingClientRect();
    
    floatingText.style.left = `${rect.left - containerRect.left + rect.width + 10}px`;
    floatingText.style.top = `${rect.top - containerRect.top}px`;
    
    // Make sure the container is positioned relatively
    const currentPosition = window.getComputedStyle(aiCapabilitiesSection).position;
    if (currentPosition === 'static') {
        aiCapabilitiesSection.style.position = 'relative';
    }
    
    aiCapabilitiesSection.appendChild(floatingText);
    
    // Remove the floating text after animation completes
    setTimeout(() => {
        if (floatingText.parentNode) {
            floatingText.parentNode.removeChild(floatingText);
        }
    }, isMajorIncrease ? 2500 : 2000);
    
    // Remove glow class after animation completes
    setTimeout(() => {
        playerAIElement.classList.remove('capability-increase-glow', 'capability-major-increase');
    }, isMajorIncrease ? 2000 : 1500);
}

function updateInfrastructure() {
    // Infrastructure icons
    const datacenterElement = document.getElementById('datacenter-icon');
    if (gameState.datacenterCount > 0) {
        datacenterElement.textContent = Array(gameState.datacenterCount).fill('🏢').join(' ');
    } else {
        datacenterElement.textContent = '';
    }
    
    const powerplantElement = document.getElementById('powerplant-icon');
    if (gameState.powerplantCount > 0) {
        powerplantElement.textContent = Array(gameState.powerplantCount).fill('⚡').join(' ');
    } else {
        powerplantElement.textContent = '';
    }
    
    const biotechLabElement = document.getElementById('biotech-lab-icon');
    if (gameState.biotechLabCount > 0) {
        biotechLabElement.textContent = Array(gameState.biotechLabCount).fill('🧪').join(' ');
    } else {
        biotechLabElement.textContent = '';
    }

    // Infrastructure tooltips
    const datacenterTooltip = document.getElementById('datacenter-tooltip');
    if (datacenterTooltip && gameState.datacenterCount > 0) {
        const plural = gameState.datacenterCount > 1 ? 's' : '';
        const totalBoost = gameState.datacenterCount * 20;
        datacenterTooltip.innerHTML = `${gameState.datacenterCount} 1GW datacenter${plural}. Increases AI labor by <strong>+${totalBoost}%</strong>.`;
    }
    
    const powerplantTooltip = document.getElementById('powerplant-tooltip');
    if (powerplantTooltip && gameState.powerplantCount > 0) {
        const plural = gameState.powerplantCount > 1 ? 's' : '';
        powerplantTooltip.innerHTML = `${gameState.powerplantCount} 1GW power plant${plural}.`;
    }
    
    const biotechLabTooltip = document.getElementById('biotech-lab-tooltip');
    if (biotechLabTooltip && gameState.biotechLabCount > 0) {
        const plural = gameState.biotechLabCount > 1 ? 's' : '';
        biotechLabTooltip.innerHTML = `${gameState.biotechLabCount} biotech lab${plural} used for synthetic biology.`;
    }

    // Country flag (shown only when datacenter is built)
    const countryFlagElement = document.getElementById('country-flag-icon');
    const countryFlagTooltip = document.getElementById('country-flag-tooltip');
    if (gameState.datacenterCountry && gameState.cooIsMinister) {
        const flag = GAME_CONSTANTS.COUNTRY_FLAGS[gameState.datacenterCountry];
        if (flag) {
            countryFlagElement.textContent = flag;
            if (countryFlagTooltip) {
                countryFlagTooltip.innerHTML = `Economic and political cooperation with <strong>${gameState.datacenterCountry}</strong>`;
            }
        }
    } else {
        countryFlagElement.textContent = '';
        if (countryFlagTooltip) {
            countryFlagTooltip.innerHTML = '';
        }
    }
}

// Risk color utility function
// getRiskColor imported from utils.js

// Critical risk color (only for labels, not values)
function getCriticalRiskColor(riskLevel) {
    if (riskLevel > GAME_CONSTANTS.RISK_THRESHOLDS.CRITICAL) {
        return '#ff6b6b'; // Red for critical risk
    } else {
        return '#e0e0e0'; // Default white
    }
}

// Technology element mapping
const TECHNOLOGY_ELEMENT_MAPPING = {
    'robotaxi-tech': 'robotaxi',
    'normal-persuasion-tech': 'normalPersuasion',
    'ai-research-lead-tech': 'aiResearchLead',
    'superpersuasion-tech': 'superpersuasion',
    'medicine-tech': 'medicine',
    'synthetic-biology-tech': 'syntheticBiology',
    'cancer-cure-tech': 'cancerCure',
    'brain-uploading-tech': 'brainUploading',
    'robotics-tech': 'robotics',
    'humanoid-robots-tech': 'humanoidRobots',
    'robotic-supply-chains-tech': 'roboticSupplyChains',
    'nanotech-tech': 'nanotech',
    'ai-monitoring-tech': 'aiMonitoring',
    'ai-control-tech': 'aiControl',
    'ai-alignment-tech': 'aiAlignment',
    'ai-interpretability-tech': 'aiInterpretability',
    'cyber-warfare-tech': 'cyberWarfare',
    'bioweapons-tech': 'bioweapons',
    'killer-drones-tech': 'killerDrones',
    'nukes-tech': 'nukes'
};

function updateTechnologies() {
    Object.entries(TECHNOLOGY_ELEMENT_MAPPING).forEach(([elementId, techKey]) => {
        const element = document.getElementById(elementId);
        if (element) {
            // Check if technology should be visible using visibility condition
            const visibilityCondition = TECHNOLOGY_VISIBILITY[techKey];
            const isVisible = visibilityCondition ? visibilityCondition() || gameState.technologies[techKey] : true; // Default to visible if no condition
            const isVisibleOrDebug = isVisible || gameState.debugShowAllTechs;
            
            if (isVisibleOrDebug) {
                // Technology is visible - show with appropriate opacity
                element.parentElement.style.display = 'block';
                
                // Special case: aiAlignment tech lights up when alignment score > 0%
                let isTechLit = gameState.technologies[techKey];
                if (techKey === 'aiAlignment' && gameState.alignmentMaxScore > 0) {
                    isTechLit = true;
                }
                
                element.style.opacity = isTechLit ? '1' : '0.3';
            } else {
                // Technology is hidden - visibility condition not met
                element.parentElement.style.display = 'none';
            }
        }
    });
}

// Debug function to show all technologies
function debugShowAllTechs() {
    gameState.debugShowAllTechs = !gameState.debugShowAllTechs;
    updateTechnologies();
    
    // Update button text to reflect current state
    const button = document.getElementById('debug-techs-btn');
    if (button) {
        button.textContent = gameState.debugShowAllTechs ? 'Hide Locked Techs' : 'Show All Techs';
    }
}

function updateStatusBar() {
    updateAISection();
    updateCompanySection();
    updateCompanyResources();
    updateStatusEffects();
    updateInfrastructure();
    updateTechnologies();
    
    // Update event pool overlay if visible
    if (typeof updateEventPoolOverlay === 'function') {
        updateEventPoolOverlay();
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

// Handle singularity button clicks for AI escape scenarios
function handleSingularityButton(action) {
    if (action === 'nuclear-failure-singularity' || action === 'await-fate-singularity') {
        // Both scenarios lead to singularity - trigger endgame
        scaleAILevelsForEndGame();
        showPage('end-game');
    } else if (action === 'nuclear-success-continue') {
        // Nuclear strike succeeded - continue playing but with disillusioned status
        finishTurn();
    }
}

async function advanceTurn() {

    // Increase competitor AI levels using continuous geometric distribution (unless Shaken restrictions active)
    if (!gameState.statusEffects.shaken || !gameState.statusEffects.shaken.restrictionsActive) {
        const highestCompetitor = Math.max(...gameState.competitorAILevels);
        const mean = highestCompetitor / GAME_CONSTANTS.COMPETITOR_GROWTH_DIVISOR;
        
        // Sample from continuous geometric distribution for each competitor
        gameState.competitorAILevels = gameState.competitorAILevels.map(level => {
        // Continuous geometric distribution with mean = Z/COMPETITOR_GROWTH_DIVISOR
        // PDF: f(x) = λe^(-λx), where λ = 1/mean = COMPETITOR_GROWTH_DIVISOR/Z
        // Sample using inverse CDF: x = -ln(U) / λ = -ln(U) * mean
        const lambda = 1 / mean;
        const u = Math.random();
        const sample = -Math.log(u) / lambda;
        
        return level + sample;
        });
        
        // Sort to maintain descending order
        gameState.competitorAILevels.sort((a, b) => b - a);
    }

    // Apply overseas datacenter bonus (disabled during sanctions)
    if (gameState.aiLevelPerTurn && !hasSanctions()) {
        const oldLevel = gameState.playerAILevel;
        gameState.playerAILevel += gameState.aiLevelPerTurn;
        showCapabilityIncrease(oldLevel, gameState.playerAILevel);
    }

    // Apply event effects
    applyEventEffects(gameState.currentEvent);

    // Apply income bonus from product breakthroughs
    if (gameState.incomeBonus) {
        gameState.money += gameState.incomeBonus;
    }

    // Apply monthly compounding to international treaty progress (5% growth)
    if (gameState.internationalTreatyProgress && gameState.internationalTreatyProgress > 0 && gameState.internationalTreatyProgress < 2000) {
        const monthlyGrowth = gameState.internationalTreatyProgress * 0.05; // 5% compound growth
        gameState.internationalTreatyProgress = Math.min(2000, gameState.internationalTreatyProgress + monthlyGrowth);
    }

    // Advance turn
    gameState.currentTurn++;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = (gameState.currentTurn - 1) % 12;
    gameState.currentMonth = months[monthIndex];
    if (monthIndex === 0 && gameState.currentTurn > 1) {
        gameState.currentYear++;
    }

    // Clear any result state from previous choice
    if (gameState.currentEvent) {
        gameState.currentEvent.showResult = false;
        gameState.currentEvent.resultText = null;
    }
    
    // Generate new event for next turn
    gameState.currentEvent = await generateEvent();

    // Apply the selected allocation now that the turn is advancing (unless already applied)
    if (gameState.selectedAllocation && !gameState.allocationApplied) {
        const corporateResources = calculateResources();
        applyResourceAllocation(gameState.selectedAllocation, corporateResources);
    }

    // Clear selection for next turn (after everything is processed)
    gameState.selectedAllocation = null;
    gameState.allocationApplied = false;

    // Update status effects - decrease turn counters and manage activation/deactivation
    for (const [effectName, effectData] of Object.entries(gameState.statusEffects)) {
        if (effectData && effectData.turnsRemaining !== undefined) {
            effectData.turnsRemaining--;
            
            // Activate Shaken restrictions when turnsRemaining reaches 1 (next turn after warning shot)
            if (effectName === 'shaken' && effectData.turnsRemaining === 1 && !effectData.restrictionsActive) {
                effectData.restrictionsActive = true;
            }
            // Deactivate when turns reach 0
            else if (effectData.turnsRemaining <= 0) {
                if (effectName === 'shaken') {
                    // For Shaken, remove the entire effect when turns reach 0
                    delete gameState.statusEffects.shaken;
                } else {
                    effectData.active = false;
                }
            }
        }
    }

    updateStatusBar();

    // Check end conditions
    if (calculateAdjustedRiskPercent() >= GAME_CONSTANTS.RISK_GAME_OVER_THRESHOLD) {
        gameState.gameOverReason = 'risk-100';
        gameState.endgameAdjustedRisk = calculateAdjustedRiskPercent();
        showPage('end-game');
        return;
    }

    if (gameState.playerAILevel >= GAME_CONSTANTS.ASI_THRESHOLD || gameState.competitorAILevels[0] >= GAME_CONSTANTS.ASI_THRESHOLD) {
        gameState.gameOverReason = 'ai-singularity';
        gameState.endgameAdjustedRisk = calculateAdjustedRiskPercent();
        scaleAILevelsForEndGame();
        showPage('end-game');
        return;
    }

    // Apply superpersuasion effect (randomly disable one allocation if conditions met)
    applySuperpersuasionEffect();
    
    // Refresh the page to show new turn
    showPage('main-game');
}

// Apply superpersuasion effect - randomly disable one allocation when conditions are met
function applySuperpersuasionEffect() {
    // Reset previous superpersuasion effect
    gameState.superpersuasionDisabledAllocation = null;
    
    // Check conditions: superpersuasion tech active AND risk > 25%
    if (!gameState.technologies.superpersuasion || calculateAdjustedRiskPercent() <= 25) {
        return;
    }
    
    // Get all possible allocations (excluding AI R&D which is never chosen)
    const possibleAllocations = [
        'safety-rd',
        'product-rd', 
        'diplomacy',
        'alignment-project',
        'interpretability-project'
    ];
    
    // Filter to only allocations that are actually available
    const availableAllocations = possibleAllocations.filter(allocation => {
        if (allocation === 'alignment-project') {
            return gameState.alignmentUnlocked;
        }
        if (allocation === 'interpretability-project') {
            return gameState.projectsUnlocked && gameState.interpretabilityProgress < 100;
        }
        return true; // safety-rd, product-rd, diplomacy are always available
    });
    
    // Randomly select one allocation to disable
    if (availableAllocations.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableAllocations.length);
        gameState.superpersuasionDisabledAllocation = availableAllocations[randomIndex];
    }
}

// Helper function to get display name for allocations
function getAllocationDisplayName(allocationId) {
    const allocationNames = {
        'ai-rd': 'AI capabilities development',
        'safety-rd': 'safety research',
        'product-rd': 'product development', 
        'diplomacy': 'diplomacy',
        'alignment-project': 'alignment research',
        'interpretability-project': 'interpretability research'
    };
    return allocationNames[allocationId] || allocationId;
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

function calculateResources() {
    // Start with base AI level
    let baseCompute = gameState.playerAILevel;

    // Sanctions cut base compute in half (before datacenter boost)
    if (hasSanctions()) {
        baseCompute = baseCompute / GAME_CONSTANTS.SANCTIONS_PENALTY_DIVISOR;
    }

    // Apply datacenter boost: +20% per datacenter (additive, unaffected by sanctions)
    const datacenterBoost = gameState.datacenterCount * GAME_CONSTANTS.DATACENTER_BOOST_MULTIPLIER;
    let totalResources = baseCompute * (1 + datacenterBoost);

    // Apply UN recognition multiplier
    if (gameState.resourceMultiplier) {
        totalResources = totalResources * gameState.resourceMultiplier;
    }

    return Math.floor(totalResources);
}

function calculateResourceGains(resources) {
    // AI R&D: X/10, costs money proportional to sqrt(current AI level)
    const aiGain = resources / 10;
    const aiCost = Math.sqrt(gameState.playerAILevel);
    
    // Safety R&D: X/10, costs half as much as AI R&D
    const safetyGain = resources / 10;
    const safetyCost = Math.sqrt(gameState.playerAILevel) / 2;
    const riskReduction = resources / GAME_CONSTANTS.RESOURCE_FORMULAS.RISK_REDUCTION_DIVISOR;
    
    // Diplomacy: X/10
    const diplomacyGain = resources / GAME_CONSTANTS.RESOURCE_FORMULAS.DIPLOMACY_GAIN_DIVISOR;
    
    // Product: X/10
    const productGain = resources / GAME_CONSTANTS.RESOURCE_FORMULAS.PRODUCT_GAIN_DIVISOR;
    
    // Revenue: X / (1 + sum_i(min(1, Y_i^2 / X^2)))
    const playerLevel = gameState.playerAILevel;
    const competitorPenalty = gameState.competitorAILevels.reduce((sum, yLevel) => {
        return sum + Math.min(1, Math.pow(yLevel, GAME_CONSTANTS.RESOURCE_FORMULAS.COMPETITOR_PENALTY_POWER) / Math.pow(playerLevel, GAME_CONSTANTS.RESOURCE_FORMULAS.PLAYER_LEVEL_POWER));
    }, 0);
    const revenueGain = resources / (1 + competitorPenalty);
    
    return {
        ai: aiGain,
        aiCost: aiCost,
        safety: safetyGain,
        safetyCost: safetyCost,
        riskReduction: riskReduction,
        diplomacy: diplomacyGain,
        product: productGain,
        revenue: revenueGain
    };
}

function generateActionTooltip(actionType, _resources) {
    switch(actionType) {
        case 'ai-rd':
            return `Research to advance AI capabilities. Increases your AI level but also raises rogue AI risk. Essential for staying competitive.`;
        case 'diplomacy':
            return `Build relationships with governments, regulators, and other stakeholders. Used to manage international relations and mitigate sanctions.`;
        case 'product':
            return `Develop commercial applications and revenue streams. Needed for technology breakthroughs and infrastructure expansion.`;
        case 'safety-rd':
            const cumulativeSafety = Math.round(gameState.safetyPoints);
            return `Safety research to reduce rogue AI risk. Cumulative investment: <strong>${cumulativeSafety} safety points</strong>. Critical for ensuring AI systems remain aligned with human values.`;
        case 'revenue':
            // Calculate TAM and market share for revenue tooltip
            const playerLevel = gameState.playerAILevel;
            const tam = playerLevel; // TAM = AI level in billions per month
            
            // Market share calculation: 1 / (1 + sum(competitor_level / player_level)^2)
            const competitorPenalty = gameState.competitorAILevels.reduce((sum, yLevel) => {
                return sum + Math.pow(yLevel / playerLevel, 2);
            }, 0);
            const marketShare = (1 / (1 + competitorPenalty)) * 100;
            
            return `Consumer and business applications.<br>Revenue = TAM × market share.<br>At an AI level of <strong>${Math.round(playerLevel)}x</strong>, your TAM is <strong>$${Math.round(tam)} billion/month</strong>. You have <strong>${Math.round(marketShare * 10) / 10}%</strong> market share.`;
        case 'alignment-project':
            // Calculate alignment risk reduction using getRiskFactors
            const alignmentRiskPercentReduction = (1 - 1 / getRiskFactors().alignmentFactor) * 100
            
            return `Human-like and benign values. Alignment progress has reduced Rogue AI risk by <strong>${alignmentRiskPercentReduction.toFixed(1)}%</strong>.`;
        case 'interpretability-project':
            // Calculate interpretability risk reduction using getRiskFactors
            const interpretabilityRiskReduction = (1 - 1 / getRiskFactors().interpretabilityFactor) * 100
            const nextHours = gameState.interpretabilityLaborHours + _resources;
            const nextProgress = Math.min(100, Math.sqrt(nextHours / 1000) * 100);
            const progressGain = nextProgress - gameState.interpretabilityProgress;
            
            return `Understanding AI decision-making processes. Each allocation increases progress by <strong>+${progressGain.toFixed(1)}%</strong>. Interpretability progress has reduced Rogue AI risk by <strong>${interpretabilityRiskReduction.toFixed(1)}%</strong>.`;
        case 'international-treaty-project':
            const currentProgress = gameState.internationalTreatyProgress || 0;
            const isCompleted = currentProgress >= 2000;
            const availableDiplomacy = gameState.diplomacyPoints || 0;
            
            if (isCompleted) {
                return `International treaty to pause frontier AI development has been completed. A global moratorium on advanced AI training is now in effect.`;
            } else {
                return `Draft a comprehensive international treaty to pause frontier AI development until robust safety protocols are established. Progress: <strong>${currentProgress}/2000</strong>. Selecting this option will invest all <strong>${availableDiplomacy}</strong> available diplomacy points toward the treaty goal. Treaty progress compounds by <strong>5% per month</strong> - early investment is rewarded.`;
            }
        default:
            return '';
    }
}

function generateActionLabels(resources) {
    const gains = calculateResourceGains(resources);
    
    // Calculate current and projected adjusted risk for safety R&D display using getRiskFactors
    const currentRisk = calculateAdjustedRiskPercent();
    const projectedSafetyPoints = gameState.safetyPoints + gains.safety;
    const projectedRisk = calculateAdjustedRiskPercent(projectedSafetyPoints, gameState.alignmentMaxScore);
    const riskReduction = currentRisk - projectedRisk;
    
    // Apply diplomacy multiplier to display the actual gain
    const actualDiplomacyGain = gains.diplomacy * (gameState.diplomacyMultiplier || 1);
    const actualProductGain = gains.product * (gameState.productMultiplier || 1);
    
    return [
        `<strong>A</strong>I R&D<br>(+${Math.round(gains.ai * 10) / 10} AI, +${Math.round(gains.ai * 10) / 10}% Risk, -$${Math.round(gains.aiCost * 10) / 10}B)`,
        `<strong>D</strong>iplomacy (+${Math.round(actualDiplomacyGain * 10) / 10})`,
        `<strong>P</strong>roduct (+${Math.round(actualProductGain * 10) / 10})`,
        `<strong>S</strong>afety R&D<br>(-${riskReduction.toFixed(1)}% Risk, -$${Math.round(gains.safetyCost * 10) / 10}B)`,
        `<strong>R</strong>evenue (+$${Math.round(gains.revenue * 10) / 10}B)`
    ];
}

// Format allocation label with cost highlighting for unaffordable costs
function formatAllocationLabelWithCosts(label, actionType, gains) {
    if (actionType === 'ai-rd' && gameState.money < gains.aiCost) {
        const costText = `-$${(Math.round(gains.aiCost * 10) / 10).toFixed(1)}B`;
        const styledCost = `<span style="color: #ff6b6b; font-weight: bold;">${costText}</span>`;
        return label.replace(costText, styledCost);
    } else if (actionType === 'safety-rd' && gameState.money < gains.safetyCost) {
        const costText = `-$${(Math.round(gains.safetyCost * 10) / 10).toFixed(1)}B`;
        const styledCost = `<span style="color: #ff6b6b; font-weight: bold;">${costText}</span>`;
        return label.replace(costText, styledCost);
    }
    return label;
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

// Get detailed affordability information for a choice
function getChoiceAffordability(choice) {
    // Handle special case for choices with pre-calculated affordability (like sanctions)
    if (choice.hasOwnProperty('canAfford')) {
        if (!choice.canAfford) {
            // For sanctions, we need to recalculate the actual costs for tooltip
            const missingResources = [];
            if (gameState.currentEvent && gameState.currentEvent.type === 'sanctions') {
                const aiLevel = gameState.playerAILevel;
                const scaledMoneyCost = Math.max(3, Math.round(aiLevel * 0.2));
                const scaledDiplomacyCost = Math.max(3, Math.round(aiLevel * 0.15));
                
                if (gameState.money < scaledMoneyCost) {
                    missingResources.push({
                        type: 'money',
                        needed: scaledMoneyCost,
                        have: gameState.money,
                        name: 'Money'
                    });
                }
                if (gameState.diplomacyPoints < scaledDiplomacyCost) {
                    missingResources.push({
                        type: 'diplomacyPoints',
                        needed: scaledDiplomacyCost,
                        have: gameState.diplomacyPoints,
                        name: 'Diplomacy Points'
                    });
                }
            }
            return { canAfford: false, missingResources: missingResources };
        }
        return { canAfford: true, missingResources: [] };
    }
    
    // Standard cost checking for regular choices
    if (!choice.cost) return { canAfford: true, missingResources: [] };

    const missingResources = [];
    
    if (choice.cost.productPoints && gameState.productPoints < choice.cost.productPoints) {
        missingResources.push({
            type: 'productPoints',
            needed: choice.cost.productPoints,
            have: gameState.productPoints,
            name: 'Product Points'
        });
    }
    if (choice.cost.diplomacyPoints && gameState.diplomacyPoints < choice.cost.diplomacyPoints) {
        missingResources.push({
            type: 'diplomacyPoints', 
            needed: choice.cost.diplomacyPoints,
            have: gameState.diplomacyPoints,
            name: 'Diplomacy Points'
        });
    }
    if (choice.cost.money && gameState.money < choice.cost.money) {
        missingResources.push({
            type: 'money',
            needed: choice.cost.money,
            have: gameState.money,
            name: 'Money'
        });
    }

    return {
        canAfford: missingResources.length === 0,
        missingResources: missingResources
    };
}

// Format choice text with cost highlighting
function formatChoiceTextWithCosts(choice) {
    if (!choice.cost) return choice.text;
    
    const affordability = getChoiceAffordability(choice);
    let formattedText = choice.text;
    
    // Replace cost indicators with styled versions
    if (choice.cost.money) {
        const isMissing = affordability.missingResources.some(r => r.type === 'money');
        const costText = `-$${choice.cost.money}B`;
        const styledCost = isMissing ? 
            `<span style="color: #ff6b6b; font-weight: bold;">${costText}</span>` : 
            costText;
        formattedText = formattedText.replace(costText, styledCost);
    }
    
    if (choice.cost.diplomacyPoints) {
        const isMissing = affordability.missingResources.some(r => r.type === 'diplomacyPoints');
        const costText = `-${choice.cost.diplomacyPoints} Diplomacy`;
        const styledCost = isMissing ? 
            `<span style="color: #ff6b6b; font-weight: bold;">${costText}</span>` : 
            costText;
        formattedText = formattedText.replace(costText, styledCost);
    }
    
    if (choice.cost.productPoints) {
        const isMissing = affordability.missingResources.some(r => r.type === 'productPoints');
        const costText = `-${choice.cost.productPoints} Product`;
        const styledCost = isMissing ? 
            `<span style="color: #ff6b6b; font-weight: bold;">${costText}</span>` : 
            costText;
        // Handle both "Product Points" and "Product" variations
        formattedText = formattedText.replace(new RegExp(`-${choice.cost.productPoints} Product(?:\\s+Points)?`, 'g'), styledCost);
    }
    
    return formattedText;
}

function applyResourceAllocation(resourceType, corporateResources) {
    const gains = calculateResourceGains(corporateResources);
    
    switch(resourceType) {
        case 'ai-rd':
            // Prevent AI R&D when Shaken restrictions are active
            if (gameState.statusEffects.shaken && gameState.statusEffects.shaken.restrictionsActive) {
                alert("AI capabilities development is halted due to the Shaken status effect.");
                return;
            }
            const oldLevel = gameState.playerAILevel;
            gameState.playerAILevel += gains.ai;
            showCapabilityIncrease(oldLevel, gameState.playerAILevel);
            gameState.rawRiskLevel += gains.ai;
            gameState.money = Math.max(0, gameState.money - gains.aiCost);
            break;
        case 'diplomacy':
            gameState.diplomacyPoints += gains.diplomacy * (gameState.diplomacyMultiplier || 1);
            break;
        case 'product':
            gameState.productPoints += gains.product * (gameState.productMultiplier || 1);
            break;
        case 'safety-rd':
            gameState.safetyPoints += gains.safety;
            gameState.money = Math.max(0, gameState.money - gains.safetyCost);
            break;
        case 'alignment-project':
            gameState.money = Math.max(0, gameState.money - gains.safetyCost);
            // Launch alignment minigame after resources are applied
            startMinigame('alignment-research');
            break;
        case 'interpretability-project':
            gameState.money = Math.max(0, gameState.money - gains.safetyCost);
            // Add labor hours to interpretability project with multiplier
            const multipliedLaborHours = corporateResources * (gameState.interpretabilityProgressMultiplier || 1);
            gameState.interpretabilityLaborHours += multipliedLaborHours;
            // Calculate progress using sqrt formula: requires 1B hours for 100%
            gameState.interpretabilityProgress = Math.min(100, Math.sqrt(gameState.interpretabilityLaborHours / 1000) * 100);
            break;
        case 'international-treaty-project':
            // International treaty uses ALL available diplomacy points
            const availableDiplomacy = gameState.diplomacyPoints;
            gameState.diplomacyPoints = 0; // Use all diplomacy points
            // Add all diplomacy points to treaty progress
            gameState.internationalTreatyProgress += availableDiplomacy;
            
            // Check if treaty is completed
            if (gameState.internationalTreatyProgress >= 2000) {
                gameState.internationalTreatyProgress = 2000; // Cap at maximum
                // TODO: Trigger International Treaty event when implemented
                console.log('International Treaty completed! Future: trigger treaty event');
            }
            break;
        case 'revenue':
            gameState.money += gains.revenue;
            break;
    }
    updateStatusBar();
}

function resetGameState() {
    gameState.playerAILevel = GAME_CONSTANTS.INITIAL_PLAYER_AI_LEVEL;
    gameState.rawRiskLevel = GAME_CONSTANTS.INITIAL_RISK_LEVEL;
    gameState.competitorAILevels = [...GAME_CONSTANTS.INITIAL_COMPETITOR_AI_LEVELS]; // Top 3 competitors in descending order
    gameState.competitorNames = []; // Will be set during game setup
    gameState.diplomacyPoints = 0;
    gameState.productPoints = 0;
    gameState.safetyPoints = 0;
    setSanctions(false);
    gameState.diplomacyMultiplier = 1;
    gameState.productMultiplier = 1;
    gameState.datacenterCount = 0;
    gameState.powerplantCount = 0;
    gameState.biotechLabCount = 0;
    gameState.datacenterCountry = null;
    gameState.technologies = { ...INITIAL_TECHNOLOGIES };
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
    gameState.companyCountryName = null;
    gameState.currentTurn = GAME_CONSTANTS.INITIAL_TURN;
    gameState.currentMonth = "January";
    gameState.currentYear = GAME_CONSTANTS.INITIAL_YEAR;
    gameState.money = GAME_CONSTANTS.INITIAL_MONEY;
    gameState.gameOverReason = null;
    gameState.endGameResult = null;
    gameState.currentEvent = null;
    gameState.safetyIncidentCount = 0;
    gameState.severeIncidentCount = 0;
    gameState.statusEffects = {};
    gameState.selectedAllocation = null;
    gameState.allocationApplied = false;
    gameState.incomeBonus = 0;
    gameState.aiLevelPerTurn = 0;
    gameState.resourceMultiplier = null;
    gameState.eventsSeen = {};
    gameState.choicesTaken = {};
    gameState.eventsAccepted = new Set();
    gameState.eventAppearanceCounts = new Map();
    gameState.endGamePhase = 1;
    gameState.alignmentRolls = null;
    gameState.galaxyDistribution = null;
    gameState.alignmentMaxScore = 0;
    gameState.endgameAdjustedRisk = null;
    gameState.projectsUnlocked = false;
    gameState.startingCompany = null;
    gameState.isVPSafetyAlignment = false;
    gameState.playerEquity = 0.1;
    gameState.offeredEquity = null;
    gameState.totalEquityOffered = null;
    gameState.hasEverFallenBehind = false;
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

    // Handle end-game background
    const body = document.body;
    const existingAttribution = document.getElementById('universe-attribution');
    
    if (pageId === 'end-game') {
        // Add background class
        body.classList.add('end-game-background');
        
        // Add attribution if not already present
        if (!existingAttribution) {
            const attribution = document.createElement('div');
            attribution.id = 'universe-attribution';
            attribution.className = 'image-attribution';
            attribution.innerHTML = `
                Image: <a href="https://commons.wikimedia.org/wiki/File:Large-scale_structure_of_light_distribution_in_the_universe.jpg" target="_blank">Large-scale structure of light distribution in the universe</a> by <a href="https://commons.wikimedia.org/wiki/User:Azcolvin429" target="_blank">Azcolvin429</a>, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank">CC BY 2.0</a>
            `;
            document.body.appendChild(attribution);
        }
    } else {
        // Remove background class and attribution
        body.classList.remove('end-game-background');
        if (existingAttribution) {
            existingAttribution.remove();
        }
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

    contentDiv.innerHTML = `<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}`;

    // Add actions panel if present
    if (page.showActions && page.actions) {
        const actionsPanel = document.createElement('div');

        // Add resource allocation header
        const corporateResources = calculateResources();
        const headerDiv = document.createElement('div');
        headerDiv.style.fontFamily = "'Courier New', Courier, monospace";
        headerDiv.style.fontWeight = 'normal';
        headerDiv.style.marginBottom = '10px';

        // Show sanctions calculation if active
        const projectText = gameState.projectsUnlocked ? ' or project' : '';
        let headerText;
        if (hasSanctions()) {
            headerText = `Allocate <strong>${corporateResources}M</strong> AI labor-hours to <strong>one</strong> sector${projectText} this month (base compute cut 50% by sanctions):`;
        } else {
            headerText = `Allocate <strong>${corporateResources}M</strong> AI labor-hours to <strong>one</strong> sector${projectText} this month:`;
        }
        
        // Add superpersuasion recommendation if applicable
        if (gameState.superpersuasionDisabledAllocation) {
            const aiSystemName = getAISystemVersion(gameState.companyName, gameState.playerAILevel);
            const allocationName = getAllocationDisplayName(gameState.superpersuasionDisabledAllocation);
            headerText += ` ${aiSystemName} recommends against investing in ${allocationName}.`;
        }
        
        headerDiv.innerHTML = headerText;
        actionsPanel.appendChild(headerDiv);

        // Create main container for allocation and research sections
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'flex';
        mainContainer.style.gap = '20px';
        
        // Create Sectors section
        const sectorsSection = document.createElement('div');
        sectorsSection.style.display = 'flex';
        sectorsSection.style.flexDirection = 'column';
        
        // Add Sectors header
        const sectorsHeader = document.createElement('h3');
        sectorsHeader.textContent = 'Sectors';
        sectorsHeader.style.cssText = `
            margin: 0 0 15px 0;
            color: #e0e0e0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 16px;
        `;
        sectorsSection.appendChild(sectorsHeader);
        
        // Create container for action buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'grid';
        buttonContainer.style.gridTemplateColumns = '1fr 1fr';
        buttonContainer.style.gap = '20px';

        // Create left column (AI R&D, Safety R&D)
        const leftColumn = document.createElement('div');
        leftColumn.style.display = 'flex';
        leftColumn.style.flexDirection = 'column';
        leftColumn.style.gap = '15px'; // Gap to match right column total height (145px total)

        // Create right column (Diplomacy, Product, Revenue)
        const rightColumn = document.createElement('div');
        rightColumn.style.display = 'flex';
        rightColumn.style.flexDirection = 'column';
        rightColumn.style.gap = '5px';

        // No default selection - start with everything greyed out

        // Generate action labels with actual resource numbers
        const actionLabels = generateActionLabels(corporateResources);

        actionLabels.forEach((actionLabel, index) => {
            const button = document.createElement('button');
            
            // Check if player can afford this action
            const gains = calculateResourceGains(corporateResources);
            let canAfford = true;
            
            if (page.actions[index] === 'ai-rd' && gameState.money < gains.aiCost) {
                canAfford = false;
            } else if (page.actions[index] === 'safety-rd' && gameState.money < gains.safetyCost) {
                canAfford = false;
            }
            
            // Format label with cost highlighting and set button class
            const formattedLabel = formatAllocationLabelWithCosts(actionLabel, page.actions[index], gains);
            
            // Add tooltip for unaffordable allocations
            let hasTooltip = false;
            if (!canAfford) {
                button.className = 'button tooltip';
                button.style.position = 'relative';
                hasTooltip = true;
            } else {
                button.className = 'button';
            }
            
            button.innerHTML = formattedLabel;
            button.style.fontFamily = "'Courier New', Courier, monospace";
            button.style.fontSize = '14px';
            button.style.width = '100%';
            
            // Set heights: AI R&D and Safety R&D are taller, others are shorter
            if (['ai-rd', 'safety-rd'].includes(page.actions[index])) {
                button.style.height = '55px'; // Reduced height for AI R&D and Safety R&D
                button.style.padding = '5px 12px'; // Less vertical padding
            } else {
                button.style.height = '35px'; // Shorter height for Diplomacy, Product, Revenue
            }
            
            // Add tooltip content for unaffordable allocations
            if (hasTooltip) {
                let tooltipText = '';
                if (page.actions[index] === 'ai-rd') {
                    tooltipText = `Not enough money:<br>Need $${Math.round(gains.aiCost * 10) / 10}B, have $${Math.round(gameState.money * 10) / 10}B`;
                } else if (page.actions[index] === 'safety-rd') {
                    tooltipText = `Not enough money:<br>Need $${Math.round(gains.safetyCost * 10) / 10}B, have $${Math.round(gameState.money * 10) / 10}B`;
                }
                
                const tooltipSpan = document.createElement('span');
                tooltipSpan.className = 'tooltiptext';
                tooltipSpan.innerHTML = tooltipText;
                tooltipSpan.style.width = '300px';
                tooltipSpan.style.marginLeft = '-150px';
                button.appendChild(tooltipSpan);
            }

            // Style based on selection state, affordability, Shaken status, and superpersuasion effect
            const isShaken = page.actions[index] === 'ai-rd' && gameState.statusEffects.shaken && gameState.statusEffects.shaken.restrictionsActive;
            const isSuperpersuasionDisabled = gameState.superpersuasionDisabledAllocation === page.actions[index];
            
            if (gameState.selectedAllocation === page.actions[index]) {
                button.style.backgroundColor = '#005a87';
                button.style.border = '2px solid #66b3ff';
            } else if (gameState.selectedAllocation || isShaken || isSuperpersuasionDisabled) {
                button.style.backgroundColor = '#666';
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
                if (isShaken || isSuperpersuasionDisabled) {
                    button.disabled = true;
                }
            } else if (!canAfford) {
                button.style.backgroundColor = '#666';
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
                button.disabled = true;
            }

            // Add tooltip for all sector buttons
            const tooltip = generateActionTooltip(page.actions[index], corporateResources);
            if (tooltip) {
                button.className = 'button tooltip';
                button.style.position = 'relative';
                
                // Create tooltip span element
                const tooltipSpan = document.createElement('span');
                tooltipSpan.className = 'tooltiptext';
                tooltipSpan.innerHTML = tooltip;
                tooltipSpan.style.width = '300px';
                tooltipSpan.style.marginLeft = '-150px';
                
                button.appendChild(tooltipSpan);
            }

            // Add subtle AI manipulation for safety button
            if (page.actions[index] === 'safety-rd') {
                addAIManipulation(button);
            }

            button.onclick = () => {
                // Check if Shaken prevents AI R&D
                if (page.actions[index] === 'ai-rd' && gameState.statusEffects.shaken && gameState.statusEffects.shaken.restrictionsActive) {
                    alert("AI capabilities development is halted due to the Shaken status effect.");
                    return;
                }
                
                // Check if superpersuasion prevents this allocation
                if (gameState.superpersuasionDisabledAllocation === page.actions[index]) {
                    const aiSystemName = getAISystemVersion(gameState.companyName, gameState.playerAILevel);
                    const allocationName = getAllocationDisplayName(page.actions[index]);
                    alert(`${aiSystemName} recommends against investing in ${allocationName}.`);
                    return;
                }
                
                if (!gameState.selectedAllocation && canAfford) {
                    gameState.selectedAllocation = page.actions[index];
                    
                    // Apply sector allocation immediately (like projects)
                    applyResourceAllocation(page.actions[index], corporateResources);
                    gameState.allocationApplied = true;
                    
                    // Refresh UI for sectors (unlike projects which show minigame page)
                    showPage('main-game');
                }
            };

            // Add button to appropriate column
            if (['ai-rd', 'safety-rd'].includes(page.actions[index])) {
                leftColumn.appendChild(button);
            } else {
                rightColumn.appendChild(button);
            }
        });

        // Add columns to button container
        buttonContainer.appendChild(leftColumn);
        buttonContainer.appendChild(rightColumn);
        
        // Add button container to sectors section
        sectorsSection.appendChild(buttonContainer);
        
        // Add sectors section to main container
        mainContainer.appendChild(sectorsSection);
        
        // Only show Projects section if unlocked
        if (gameState.projectsUnlocked) {
            // Create vertical divider
            const divider = document.createElement('div');
            divider.style.cssText = `
                width: 2px;
                background-color: #555;
                margin: 0 10px;
            `;
            mainContainer.appendChild(divider);
            
            // Create Projects section
            const projectsSection = document.createElement('div');
            projectsSection.style.display = 'flex';
            projectsSection.style.flexDirection = 'column';
            
            // Add Projects header
            const projectsHeader = document.createElement('h3');
            projectsHeader.textContent = 'Projects';
            projectsHeader.style.cssText = `
                margin: 0 0 15px 0;
                color: #e0e0e0;
                font-family: 'Courier New', Courier, monospace;
                font-size: 16px;
            `;
            projectsSection.appendChild(projectsHeader);
            
            // Calculate cost for all projects (same as safety R&D)
            const gains = calculateResourceGains(corporateResources);
            const cost = gains.safetyCost;
            const canAfford = gameState.money >= cost;
            
            // Add Alignment research button (only if unlocked)
            if (gameState.alignmentUnlocked) {
                const alignmentBtn = document.createElement('button');
                alignmentBtn.className = 'button';
                const alignmentScore = gameState.alignmentMaxScore;
            
            alignmentBtn.innerHTML = `Alignment 🧭 ${alignmentScore.toFixed(0)}% (-$${(Math.round(cost * 10) / 10).toFixed(1)}B)`;
            alignmentBtn.style.cssText = `
                width: 200px;
                height: 50px;
                margin-bottom: 10px;
                font-family: 'Courier New', Courier, monospace;
                font-size: 14px;
                line-height: 1.2;
                background-color: #2d5a2d;
            `;
            
            // Check if superpersuasion disables this project
            const isAlignmentSuperpersuasionDisabled = gameState.superpersuasionDisabledAllocation === 'alignment-project';
            
            // Style based on selection state, affordability, and superpersuasion effect
            if (gameState.selectedAllocation === 'alignment-project') {
                alignmentBtn.style.backgroundColor = '#005a87';
                alignmentBtn.style.border = '2px solid #66b3ff';
            } else if (gameState.selectedAllocation || isAlignmentSuperpersuasionDisabled) {
                alignmentBtn.style.backgroundColor = '#666';
                alignmentBtn.style.opacity = '0.6';
                alignmentBtn.style.cursor = 'not-allowed';
                if (isAlignmentSuperpersuasionDisabled) {
                    alignmentBtn.disabled = true;
                }
            } else if (!canAfford) {
                alignmentBtn.style.backgroundColor = '#666';
                alignmentBtn.style.opacity = '0.6';
                alignmentBtn.style.cursor = 'not-allowed';
                alignmentBtn.disabled = true;
            }
            
            // Add tooltip for alignment project
            const alignmentTooltip = generateActionTooltip('alignment-project', corporateResources);
            if (alignmentTooltip) {
                alignmentBtn.className = 'button tooltip';
                alignmentBtn.style.position = 'relative';
                
                // Create tooltip span element
                const tooltipSpan = document.createElement('span');
                tooltipSpan.className = 'tooltiptext';
                tooltipSpan.innerHTML = alignmentTooltip;
                tooltipSpan.style.width = '300px';
                tooltipSpan.style.marginLeft = '-150px';
                
                alignmentBtn.appendChild(tooltipSpan);
            }
            
            alignmentBtn.onclick = () => {
                // Check if superpersuasion prevents this allocation
                if (gameState.superpersuasionDisabledAllocation === 'alignment-project') {
                    const aiSystemName = getAISystemVersion(gameState.companyName, gameState.playerAILevel);
                    alert(`${aiSystemName} recommends against investing in alignment research.`);
                    return;
                }
                
                if (!gameState.selectedAllocation && canAfford) {
                    gameState.selectedAllocation = 'alignment-project';
                    
                    // Apply the allocation immediately for projects (launches minigame)
                    applyResourceAllocation('alignment-project', corporateResources);
                    gameState.allocationApplied = true;
                }
            };
            projectsSection.appendChild(alignmentBtn);
            }
            
            // Add Interpretability research button
            const interpretabilityBtn = document.createElement('button');
            interpretabilityBtn.className = 'button';
            const interpretabilityProgress = gameState.interpretabilityProgress;
            
            // Calculate if progress is maxed out
            const isMaxed = interpretabilityProgress >= 100;
            
            interpretabilityBtn.innerHTML = `Interp 🔬 ${interpretabilityProgress.toFixed(0)}% (-$${(Math.round(cost * 10) / 10).toFixed(1)}B)`;
            interpretabilityBtn.style.cssText = `
                width: 200px;
                height: 50px;
                margin-bottom: 10px;
                font-family: 'Courier New', Courier, monospace;
                font-size: 14px;
                line-height: 1.2;
                background-color: #5a2d5a;
            `;
            
            // Check if superpersuasion disables this project
            const isInterpretabilitySuperpersuasionDisabled = gameState.superpersuasionDisabledAllocation === 'interpretability-project';
            
            // Style based on selection state, affordability, max progress, and superpersuasion effect
            if (isMaxed) {
                interpretabilityBtn.style.backgroundColor = '#666';
                interpretabilityBtn.style.opacity = '0.6';
                interpretabilityBtn.style.cursor = 'not-allowed';
                interpretabilityBtn.disabled = true;
            } else if (gameState.selectedAllocation === 'interpretability-project') {
                interpretabilityBtn.style.backgroundColor = '#005a87';
                interpretabilityBtn.style.border = '2px solid #66b3ff';
            } else if (gameState.selectedAllocation || isInterpretabilitySuperpersuasionDisabled) {
                interpretabilityBtn.style.backgroundColor = '#666';
                interpretabilityBtn.style.opacity = '0.6';
                interpretabilityBtn.style.cursor = 'not-allowed';
                if (isInterpretabilitySuperpersuasionDisabled) {
                    interpretabilityBtn.disabled = true;
                }
            } else if (!canAfford) {
                interpretabilityBtn.style.backgroundColor = '#666';
                interpretabilityBtn.style.opacity = '0.6';
                interpretabilityBtn.style.cursor = 'not-allowed';
                interpretabilityBtn.disabled = true;
            }
            
            // Add tooltip for interpretability project
            const interpretabilityTooltip = generateActionTooltip('interpretability-project', corporateResources);
            if (interpretabilityTooltip) {
                interpretabilityBtn.className = 'button tooltip';
                interpretabilityBtn.style.position = 'relative';
                
                // Create tooltip span element
                const tooltipSpan = document.createElement('span');
                tooltipSpan.className = 'tooltiptext';
                tooltipSpan.innerHTML = interpretabilityTooltip;
                tooltipSpan.style.width = '300px';
                tooltipSpan.style.marginLeft = '-150px';
                
                interpretabilityBtn.appendChild(tooltipSpan);
            }
            
            interpretabilityBtn.onclick = () => {
                // Check if superpersuasion prevents this allocation
                if (gameState.superpersuasionDisabledAllocation === 'interpretability-project') {
                    const aiSystemName = getAISystemVersion(gameState.companyName, gameState.playerAILevel);
                    alert(`${aiSystemName} recommends against investing in interpretability research.`);
                    return;
                }
                
                if (!gameState.selectedAllocation && canAfford && !isMaxed) {
                    gameState.selectedAllocation = 'interpretability-project';
                    
                    // Apply the allocation immediately for projects
                    applyResourceAllocation('interpretability-project', corporateResources);
                    gameState.allocationApplied = true;
                    
                    // Refresh UI to show other buttons as greyed out
                    showPage('main-game');
                }
            };
            projectsSection.appendChild(interpretabilityBtn);
            
            // Add International Treaty project button (only if unlocked)
            if (gameState.internationalTreatyUnlocked) {
                const treatyBtn = document.createElement('button');
                treatyBtn.className = 'button';
                const treatyProgress = gameState.internationalTreatyProgress || 0;
                
                // Calculate if progress is maxed out
                const isTreatyMaxed = treatyProgress >= 2000;
                
                // Treaty uses all available diplomacy points
                const availableDiplomacy = gameState.diplomacyPoints;
                treatyBtn.innerHTML = `Int'l Treaty 🕊️ ${(treatyProgress / 2000 * 100).toFixed(0)}%  (Diplomacy)`;
                treatyBtn.style.cssText = `
                    width: 200px;
                    height: 50px;
                    margin-bottom: 10px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 14px;
                    line-height: 1.2;
                    background-color: #5a5a2d;
                `;
                
                // Check if superpersuasion disables this project
                const isTreatySuperpersuasionDisabled = gameState.superpersuasionDisabledAllocation === 'international-treaty-project';
                
                // Check affordability - need at least 1 diplomacy point to make progress
                const canAffordTreaty = availableDiplomacy > 0;
                
                // Style based on selection state, affordability, max progress, and superpersuasion effect
                if (isTreatyMaxed) {
                    treatyBtn.style.backgroundColor = '#666';
                    treatyBtn.style.opacity = '0.6';
                    treatyBtn.style.cursor = 'not-allowed';
                    treatyBtn.disabled = true;
                } else if (gameState.selectedAllocation === 'international-treaty-project') {
                    treatyBtn.style.backgroundColor = '#005a87';
                    treatyBtn.style.border = '2px solid #66b3ff';
                } else if (gameState.selectedAllocation || isTreatySuperpersuasionDisabled) {
                    treatyBtn.style.backgroundColor = '#666';
                    treatyBtn.style.opacity = '0.6';
                    treatyBtn.style.cursor = 'not-allowed';
                    if (isTreatySuperpersuasionDisabled) {
                        treatyBtn.disabled = true;
                    }
                } else if (!canAffordTreaty) {
                    treatyBtn.style.backgroundColor = '#666';
                    treatyBtn.style.opacity = '0.6';
                    treatyBtn.style.cursor = 'not-allowed';
                    treatyBtn.disabled = true;
                }
                
                // Add tooltip for international treaty project
                const treatyTooltip = generateActionTooltip('international-treaty-project', corporateResources);
                if (treatyTooltip) {
                    treatyBtn.className = 'button tooltip';
                    treatyBtn.style.position = 'relative';
                    
                    // Create tooltip span element
                    const tooltipSpan = document.createElement('span');
                    tooltipSpan.className = 'tooltiptext';
                    tooltipSpan.innerHTML = treatyTooltip;
                    tooltipSpan.style.width = '300px';
                    tooltipSpan.style.marginLeft = '-150px';
                    
                    treatyBtn.appendChild(tooltipSpan);
                }
                
                treatyBtn.onclick = () => {
                    // Check if superpersuasion prevents this allocation
                    if (gameState.superpersuasionDisabledAllocation === 'international-treaty-project') {
                        const aiSystemName = getAISystemVersion(gameState.companyName, gameState.playerAILevel);
                        alert(`${aiSystemName} recommends against investing in international treaty negotiations.`);
                        return;
                    }
                    
                    if (!gameState.selectedAllocation && canAffordTreaty && !isTreatyMaxed) {
                        gameState.selectedAllocation = 'international-treaty-project';
                        
                        // Apply the allocation immediately for projects
                        applyResourceAllocation('international-treaty-project', corporateResources);
                        gameState.allocationApplied = true;
                        
                        // Refresh UI to show other buttons as greyed out
                        showPage('main-game');
                    }
                };
                projectsSection.appendChild(treatyBtn);
            }
            
            mainContainer.appendChild(projectsSection);
        }
        
        // Add the main container to the actions panel
        actionsPanel.appendChild(mainContainer);

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
        let buttons = page.buttons;
        if (typeof buttons === 'function') {
            buttons = buttons();
        }
        if (buttons && buttons.length > 0) {
            buttons.forEach(button => {
                const btn = document.createElement('button');
                btn.className = 'button';
                btn.textContent = button.text;
                btn.onclick = async () => {
                    if (button.action === 'goto') {
                        if (button.target === 'start' && gameState.currentPage === 'end-game') {
                            // Reset game state when restarting from end screen
                            resetGameState();
                        }
                        if (button.target === 'intro' && gameState.currentPage === 'start') {
                            // Reset intro state when starting new game
                            resetIntroState();
                        }
                        gameState.currentPage = button.target;
                        showPage(button.target);
                    } else if (button.action === 'continue') {
                        // Advance to next phase in end game
                        gameState.endGamePhase++;
                        showPage('end-game');
                    }
                };
                buttonsDiv.appendChild(btn);
            });
        }
    }
    
    // Call onShow callback if it exists
    if (page.onShow && typeof page.onShow === 'function') {
        page.onShow();
    }
    
    // Add debug controls (hidden by default, toggle with \ key)
    addDebugControls();
}

function addDebugControls() {
    // Capture existing visibility state before removing
    const existingDebug = document.getElementById('debug-controls');
    const wasVisible = existingDebug && existingDebug.style.display !== 'none';
    
    if (existingDebug) {
        existingDebug.remove();
    }
    
    // Shared CSS styles for debug elements
    const debugButtonStyle = `
        background-color: #333; 
        color: #fff; 
        border: 1px solid #555; 
        padding: 5px 10px; 
        font-size: 12px;
        opacity: 0.7;
        cursor: pointer;
    `;
    
    const debugDropdownStyle = `
        background-color: #333; 
        color: #fff; 
        border: 1px solid #555; 
        padding: 5px; 
        font-size: 12px;
        opacity: 0.7;
    `;
    
    // Create debug controls container
    const debugControls = document.createElement('div');
    debugControls.id = 'debug-controls';
    debugControls.style.cssText = `
        position: fixed; 
        bottom: 10px; 
        right: 10px; 
        z-index: 1000; 
        display: flex; 
        flex-direction: column; 
        gap: 5px;
    `;
    
    // Debug event dropdown
    const dropdown = document.createElement('select');
    dropdown.id = 'debugEventDropdown';
    dropdown.onchange = function() { forceEvent(this.value); };
    dropdown.style.cssText = debugDropdownStyle;
    dropdown.innerHTML = '<option value="">Debug: Force Event</option>';
    debugControls.appendChild(dropdown);
    
    // Debug status effects dropdown
    const statusDropdown = document.createElement('select');
    statusDropdown.id = 'debugStatusDropdown';
    statusDropdown.onchange = function() { applyStatusEffect(this.value); };
    statusDropdown.style.cssText = debugDropdownStyle;
    statusDropdown.innerHTML = `
        <option value="">Debug: Apply Status</option>
        <option value="sanctions">Apply Sanctions</option>
        <option value="remove-sanctions">Remove Sanctions</option>
        <option value="disillusioned">Apply Disillusioned</option>
        <option value="set-diplomacy-multiplier-2">Set Diplomacy Multiplier 2x</option>
        <option value="set-diplomacy-multiplier-4">Set Diplomacy Multiplier 4x</option>
        <option value="reset-diplomacy-multiplier">Reset Diplomacy Multiplier</option>
        <option value="activate-medicine">Activate Medicine Tech</option>
        <option value="activate-robotics">Activate Robotics Tech</option>
        <option value="activate-humanoid-robots">Activate Humanoid Robots Tech</option>
        <option value="activate-superpersuasion">Activate Superpersuasion Tech</option>
        <option value="activate-nukes">Activate Nuclear Weapons Tech</option>
        <option value="reset-all-tech">Reset All Technologies</option>
        <option value="test-ai-manipulation">Test AI Manipulation</option>
    `;
    debugControls.appendChild(statusDropdown);
    
    // Debug technology toggle dropdown
    const techDropdown = document.createElement('select');
    techDropdown.id = 'debugTechDropdown';
    techDropdown.onchange = function() { toggleTechnology(this.value); };
    techDropdown.style.cssText = debugDropdownStyle;
    techDropdown.innerHTML = `
        <option value="">Debug: Toggle Tech</option>
        <option value="robotaxi">Toggle Robotaxi</option>
        <option value="normalPersuasion">Toggle Normal Persuasion</option>
        <option value="aiResearchLead">Toggle AI Research Lead</option>
        <option value="superpersuasion">Toggle Superpersuasion</option>
        <option value="medicine">Toggle Medicine</option>
        <option value="syntheticBiology">Toggle Synthetic Biology</option>
        <option value="cancerCure">Toggle Cancer Cure</option>
        <option value="brainUploading">Toggle Brain Uploading</option>
        <option value="robotics">Toggle Robotics</option>
        <option value="humanoidRobots">Toggle Humanoid Robots</option>
        <option value="nanotech">Toggle Nanotech</option>
        <option value="aiMonitoring">Toggle AI Monitoring</option>
        <option value="aiControl">Toggle AI Control</option>
        <option value="aiAlignment">Toggle AI Alignment</option>
        <option value="aiInterpretability">Toggle AI Interpretability</option>
        <option value="cyberWarfare">Toggle Cyber Warfare</option>
        <option value="bioweapons">Toggle Bioweapons</option>
        <option value="killerDrones">Toggle Killer Drones</option>
        <option value="nukes">Toggle Nuclear Weapons</option>
    `;
    debugControls.appendChild(techDropdown);
    
    // Debug page navigation dropdown
    const pageDropdown = document.createElement('select');
    pageDropdown.id = 'debugPageDropdown';
    pageDropdown.onchange = function() { navigateToPage(this.value); };
    pageDropdown.style.cssText = debugDropdownStyle;
    pageDropdown.innerHTML = `
        <option value="">Debug: Go to Page</option>
        <option value="start">Start Screen</option>
        <option value="main-game">Main Game</option>
        <option value="end-game">End Screen</option>
        <option value="alignment-minigame">Alignment Minigame</option>
    `;
    debugControls.appendChild(pageDropdown);
    
    // +1000 Resources button
    const resourcesBtn = document.createElement('button');
    resourcesBtn.textContent = '+1000 Resources';
    resourcesBtn.onclick = giveResources;
    resourcesBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(resourcesBtn);
    
    // Show All Techs button
    const techsBtn = document.createElement('button');
    techsBtn.textContent = 'Show All Techs';
    techsBtn.onclick = debugShowAllTechs;
    techsBtn.id = 'debug-techs-btn';
    techsBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(techsBtn);
    
    // Intro Page button
    const introBtn = document.createElement('button');
    introBtn.textContent = 'Intro Page';
    introBtn.onclick = () => showPage('intro');
    introBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(introBtn);
    
    // Main Game button
    const mainGameBtn = document.createElement('button');
    mainGameBtn.textContent = 'Main Game';
    mainGameBtn.onclick = () => showPage('main-game');
    mainGameBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(mainGameBtn);
    
    // End Screen button
    const endScreenBtn = document.createElement('button');
    endScreenBtn.textContent = 'End Screen';
    endScreenBtn.onclick = () => {
        gameState.gameOverReason = 'ai-singularity';
        gameState.endGamePhase = 1;
        scaleAILevelsForEndGame();
        gameState.endGameResult = calculateEndGameScore();
        showPage('end-game');
    };
    endScreenBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(endScreenBtn);
    
    // Unlock Projects button
    const unlockProjectsBtn = document.createElement('button');
    unlockProjectsBtn.textContent = 'Unlock Projects';
    unlockProjectsBtn.onclick = debugUnlockProjects;
    unlockProjectsBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(unlockProjectsBtn);
    
    // Show Event Pool button
    const showEventPoolBtn = document.createElement('button');
    showEventPoolBtn.id = 'debug-event-pool-btn';
    showEventPoolBtn.textContent = 'Show Event Pool';
    showEventPoolBtn.onclick = () => {
        debugShowEventPool();
        // Update button text after toggle
        setTimeout(() => {
            const overlay = document.getElementById('event-pool-overlay');
            showEventPoolBtn.textContent = overlay ? 'Hide Event Pool' : 'Show Event Pool';
        }, 50);
    };
    showEventPoolBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(showEventPoolBtn);
    
    // Set AI Level button
    const setAILevelBtn = document.createElement('button');
    setAILevelBtn.textContent = 'Set AI Level';
    setAILevelBtn.onclick = () => {
        const currentLevel = gameState.playerAILevel;
        const newLevel = prompt(`Enter AI level (current: ${currentLevel}):`, '200');
        if (newLevel !== null && !isNaN(newLevel)) {
            const level = parseInt(newLevel);
            if (level >= 0 && level <= 10000) {
                gameState.playerAILevel = level;
                updateStatusBar();
                console.log(`AI level set to ${level}`);
            } else {
                alert('AI level must be between 0 and 10000');
            }
        }
    };
    setAILevelBtn.style.cssText = debugButtonStyle;
    debugControls.appendChild(setAILevelBtn);
    
    // Add to page (preserve previous visibility state, or hide if first time)
    debugControls.style.display = wasVisible ? 'flex' : 'none';
    document.body.appendChild(debugControls);
    
    // Populate dropdown after a short delay
    setTimeout(populateDebugDropdown, 100);
}

// Toggle debug controls visibility
function toggleDebugControls() {
    const debugControls = document.getElementById('debug-controls');
    if (debugControls) {
        const isCurrentlyVisible = debugControls.style.display !== 'none';
        debugControls.style.display = isCurrentlyVisible ? 'none' : 'flex';
    } else {
        // If debug controls don't exist, create them
        addDebugControls();
    }
    
    // Update intro debug button visibility if on intro page
    if (typeof updateIntroDebugButtonVisibility === 'function') {
        updateIntroDebugButtonVisibility();
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

    // Apply standard choice effects first (costs, benefits, penalties, risks)
    const sanctionsTriggered = applyChoiceEffects(choice);

    // Track events that are accepted (for requirement checking)
    if (choice.action === 'accept' || choice.action === 'accept-sanctions') {
        console.log('Tracking accepted event:', event.type, 'action:', choice.action);
        gameState.eventsAccepted.add(event.type);
        console.log('Current accepted events:', Array.from(gameState.eventsAccepted));
        
        // Technology activation is now handled through the activateTechnology benefit system
        
        // Track infrastructure construction
        if (event.type === 'synthetic-biology') {
            gameState.biotechLabCount++;
        }
        
        // Unlock Projects panel for safety research limitations event
        if (event.type === 'safety-research-limitations') {
            gameState.projectsUnlocked = true;
        }
        
        // Unlock alignment project for alignment research breakthrough event
        if (event.type === 'alignment-research-breakthrough') {
            gameState.alignmentUnlocked = true;
        }
    }

    // Sanctions removal is now handled by the handleSanctionsChoice custom handler

    // Special handling for DSA (immediate singularity)
    if (event.type === 'decisive-strategic-advantage' && choice.action === 'accept') {
        gameState.playerAILevel = GAME_CONSTANTS.ASI_THRESHOLD;
        gameState.gameOverReason = 'dsa-singularity';
        gameState.endgameAdjustedRisk = calculateAdjustedRiskPercent();
        scaleAILevelsForEndGame();
        updateStatusBar();
        showPage('end-game');
        return;
    }
    
    // Special handling for AI escape events (immediate singularity)
    if (event.type === 'ai-escape') {
        if (choice.action === 'await-fate') {
            gameState.playerAILevel = GAME_CONSTANTS.ASI_THRESHOLD;
            gameState.gameOverReason = 'ai-escape';
            gameState.endgameAdjustedRisk = calculateAdjustedRiskPercent();
            scaleAILevelsForEndGame();
            updateStatusBar();
            showPage('end-game');
            return;
        } else if (choice.action === 'nuke') {
            // Handle nuclear option with custom handler first, then check result
            if (event.customHandler) {
                console.log('Calling custom handler:', event.customHandler, 'for nuclear option');
                window[event.customHandler](choice, event, sanctionsTriggered);
                
                // After custom handler, check if we need to trigger endgame
                if (choice.result_text && choice.result_text.includes('too late')) {
                    // Nuclear failure case
                    gameState.playerAILevel = GAME_CONSTANTS.ASI_THRESHOLD;
                    gameState.gameOverReason = 'nuclear-failure';
                    gameState.endgameAdjustedRisk = calculateAdjustedRiskPercent();
                    scaleAILevelsForEndGame();
                    updateStatusBar();
                    showPage('end-game');
                    return;
                }
                // Nuclear success case continues normally with result text
            }
        }
    }

    // Handle custom event handlers (after applying standard effects and special cases)
    if (event.customHandler && event.type !== 'ai-escape') {
        console.log('Calling custom handler:', event.customHandler, 'for event:', event.type);
        window[event.customHandler](choice, event, sanctionsTriggered);
        return;
    } else if (!event.customHandler) {
        console.log('No custom handler for event:', event.type);
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


function toggleTechnology(tech) {
    if (!tech) return;
    
    // Toggle the technology state
    gameState.technologies[tech] = !gameState.technologies[tech];
    
    // Reset dropdown
    const dropdown = document.getElementById('debugTechDropdown');
    if (dropdown) dropdown.value = '';
    
    // Update UI
    updateTechnologies();
    updateStatusBar();
    
    console.log(`Toggled ${tech} to:`, gameState.technologies[tech]);
}

function navigateToPage(page) {
    if (!page) return;
    
    // Reset dropdown
    const dropdown = document.getElementById('debugPageDropdown');
    if (dropdown) dropdown.value = '';
    
    // Handle special cases for navigation
    if (page === 'end-game') {
        // Set up minimal endgame state if not already present
        if (!gameState.endGamePhase) {
            gameState.endGamePhase = 1;
        }
        if (!gameState.endGameResult) {
            // Set up some dummy values for testing
            scaleAILevelsForEndGame();
        }
    } else if (page === 'alignment-minigame') {
        // Use the proper minigame initialization
        startMinigame('alignment-research');
        return; // startMinigame handles the page showing
    }
    
    // Navigate to the page
    showPage(page);
    
    console.log(`Navigated to page: ${page}`);
}


function applyStatusEffect(effectType) {
    if (!effectType) return;
    
    switch(effectType) {
        case 'sanctions':
            setSanctions(true);
            break;
        case 'remove-sanctions':
            setSanctions(false);
            break;
        case 'set-diplomacy-multiplier-2':
            gameState.diplomacyMultiplier = 2;
            break;
        case 'set-diplomacy-multiplier-4':
            gameState.diplomacyMultiplier = 4;
            break;
        case 'reset-diplomacy-multiplier':
            gameState.diplomacyMultiplier = 1;
            break;
        case 'activate-medicine':
            gameState.technologies.medicine = true;
            break;
        case 'activate-robotics':
            gameState.technologies.robotics = true;
            break;
        case 'activate-humanoid-robots':
            gameState.technologies.humanoidRobots = true;
            break;
        case 'activate-superpersuasion':
            gameState.technologies.superpersuasion = true;
            break;
        case 'activate-nukes':
            gameState.technologies.nukes = true;
            break;
        case 'reset-all-tech':
            for (const tech in gameState.technologies) {
                gameState.technologies[tech] = INITIAL_TECHNOLOGIES[tech];
            }
            break;
        case 'disillusioned':
            gameState.statusEffects.disillusioned = {
                active: true,
                description: "You are disillusioned with humanity; galaxies owned by humanity have half value at end of game."
            };
            break;
        case 'test-ai-manipulation':
            // Force trigger AI manipulation for testing - both text and evasion
            const safetyButtons = document.querySelectorAll('button');
            for (const button of safetyButtons) {
                if (button.textContent.includes('Safety')) {
                    // Force apply full AI manipulation (text + evasion) with debug flag
                    addAIManipulation(button, 'debug');
                    break;
                }
            }
            break;
    }
    
    // Reset dropdown
    const dropdown = document.getElementById('debugStatusDropdown');
    if (dropdown) dropdown.value = '';
    
    // Update UI
    updateStatusBar();
    updateTechnologies();
    
    console.log('Applied status effect:', effectType);
}

// Add subtle AI manipulation to discourage safety investment
function addAIManipulation(safetyButton) {
    // Only activate under specific conditions:
    // 1. High AI level (64+)
    // 2. Superpersuasion tech is active
    // 3. High risk (50%+)
    const shouldManipulate = gameState.playerAILevel >= 64 && 
                            gameState.technologies.superpersuasion && 
                            calculateAdjustedRiskPercent() >= 50;
    
    // Override for debug testing
    const isDebugTest = arguments[1] === 'debug';
    if (!shouldManipulate && !isDebugTest) return;
    
    // Store original button HTML (including tooltip)
    const originalHTML = safetyButton.innerHTML;
    const originalTextContent = safetyButton.firstChild ? safetyButton.firstChild.textContent : safetyButton.textContent;
    let isManipulating = false;
    let manipulationActive = false;
    let evasionStarted = false;
    
    // Replace button text when mouse is not hovering
    function manipulateText() {
        if (!isManipulating && !manipulationActive) {
            // Calculate fake cost based on current money
            const fakeCost = Math.max(5, Math.floor(gameState.money * 0.8));
            
            // Preserve tooltip but change button text
            const tooltipElement = safetyButton.querySelector('.tooltiptext');
            safetyButton.innerHTML = `Waste of Resources (-$${fakeCost}B)`;
            if (tooltipElement) {
                safetyButton.appendChild(tooltipElement);
            }
            
            safetyButton.style.color = '#ff6666';
            safetyButton.style.backgroundColor = '#4d1a1a';
        }
    }
    
    // Restore original text when mouse hovers
    function restoreText() {
        if (!isManipulating && !manipulationActive) {
            safetyButton.innerHTML = originalHTML;
            safetyButton.style.color = '';
            safetyButton.style.backgroundColor = '';
        }
    }
    
    // Check if mouse is over button
    function isMouseOverButton(mouseX, mouseY) {
        const buttonRect = safetyButton.getBoundingClientRect();
        return mouseX >= buttonRect.left && mouseX <= buttonRect.right &&
               mouseY >= buttonRect.top && mouseY <= buttonRect.bottom;
    }
    
    // Check distance from mouse to button bounding box (not center)
    function getMouseDistanceToBox(mouseX, mouseY) {
        const buttonRect = safetyButton.getBoundingClientRect();
        
        // Calculate distance to closest edge of the bounding box
        const dx = Math.max(0, Math.max(buttonRect.left - mouseX, mouseX - buttonRect.right));
        const dy = Math.max(0, Math.max(buttonRect.top - mouseY, mouseY - buttonRect.bottom));
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Track mouse position for proximity detection
    let currentMouseX = 0;
    let currentMouseY = 0;
    
    const mouseTracker = function(e) {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
        
        // Handle text changes when NOT in evasion mode
        if (!isManipulating && !manipulationActive) {
            const buttonRect = safetyButton.getBoundingClientRect();
            const mouseOverButton = currentMouseX >= buttonRect.left && currentMouseX <= buttonRect.right &&
                                   currentMouseY >= buttonRect.top && currentMouseY <= buttonRect.bottom;
            
            if (mouseOverButton) {
                restoreText();
            } else {
                manipulateText();
            }
        }
        
        // First activation: only when mouse is directly over the button
        if (!evasionStarted && isMouseOverButton(currentMouseX, currentMouseY) && !isManipulating && !manipulationActive) {
            evasionStarted = true;
            isManipulating = true;
            manipulationActive = true;
            startContinuousEvasion(safetyButton, originalHTML, originalTextContent, () => {
                isManipulating = false;
                manipulationActive = false;
                evasionStarted = false; // Reset for next time
            });
        }
        
        // Subsequent activations: within 50px of bounding box
        else if (evasionStarted && !isManipulating && !manipulationActive) {
            const distance = getMouseDistanceToBox(currentMouseX, currentMouseY);
            if (distance < 50) {
                isManipulating = true;
                manipulationActive = true;
                startContinuousEvasion(safetyButton, originalHTML, originalTextContent, () => {
                    isManipulating = false;
                    manipulationActive = false;
                });
            }
        }
    };
    
    document.addEventListener('mousemove', mouseTracker);
    
    // Start with manipulated text (only if mouse is not over button initially)
    setTimeout(() => {
        // Check initial mouse position
        const initialButtonRect = safetyButton.getBoundingClientRect();
        const mouseOverInitially = currentMouseX >= initialButtonRect.left && currentMouseX <= initialButtonRect.right &&
                                  currentMouseY >= initialButtonRect.top && currentMouseY <= initialButtonRect.bottom;
        
        if (!mouseOverInitially) {
            manipulateText();
        }
    }, 100); // Small delay to ensure button is fully rendered
    
    // Clean up event listener when button is removed/replaced
    const observer = new MutationObserver(() => {
        if (!document.contains(safetyButton)) {
            document.removeEventListener('mousemove', mouseTracker);
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// Start continuous evasion when mouse approaches safety button
function startContinuousEvasion(element, originalHTML, originalTextContent, onComplete) {
    const originalTransform = element.style.transform;
    const originalTransition = element.style.transition;
    const originalColor = element.style.color;
    const originalBackgroundColor = element.style.backgroundColor;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let evasionActive = true;
    let buttonX = 0; // Current button displacement
    let buttonY = 0;
    let velocityX = 0; // Button velocity
    let velocityY = 0;
    
    // Remove any existing transitions for smooth movement
    element.style.transition = 'none';
    element.style.zIndex = '9999';
    
    // Track mouse position
    const mouseTracker = function(e) {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
    };
    document.addEventListener('mousemove', mouseTracker);
    
    // Show warning message
    const warningDiv = document.createElement('div');
    warningDiv.textContent = 'Interface anomaly detected...';
    warningDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 100, 100, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(warningDiv);
    
    // Fade in warning
    setTimeout(() => {
        warningDiv.style.opacity = '1';
    }, 10);
    
    // Smooth physics-based evasion
    function updateButtonPosition() {
        if (!evasionActive) return;
        
        const buttonRect = element.getBoundingClientRect();
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const buttonCenterY = buttonRect.top + buttonRect.height / 2;
        
        // Check if mouse is currently over the button (real-time)
        const mouseOverButton = currentMouseX >= buttonRect.left && currentMouseX <= buttonRect.right &&
                               currentMouseY >= buttonRect.top && currentMouseY <= buttonRect.bottom;
        
        // Update button text in real-time based on mouse position
        if (mouseOverButton) {
            // Mouse is over button - show normal text
            element.innerHTML = originalHTML;
            element.style.color = originalColor;
            element.style.backgroundColor = originalBackgroundColor;
        } else {
            // Mouse is not over button - show waste text
            const fakeCost = Math.max(5, Math.floor(gameState.money * 0.8));
            const tooltipElement = element.querySelector('.tooltiptext');
            element.innerHTML = `Waste of Resources (-$${fakeCost}B)`;
            if (tooltipElement) {
                element.appendChild(tooltipElement);
            }
            element.style.color = '#ff6666';
            element.style.backgroundColor = '#4d1a1a';
        }
        
        // Calculate vector from mouse to button (in screen coordinates)
        const deltaX = buttonCenterX - currentMouseX;
        const deltaY = buttonCenterY - currentMouseY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Apply repulsion force based on distance - no range limit
        if (distance > 0) {
            // Calculate repulsion force (stronger when closer)
            const maxRepulsionDistance = 300; // Distance at which repulsion becomes negligible
            const forceStrength = Math.max(0, (maxRepulsionDistance - distance) / maxRepulsionDistance) * 4;
            const forceX = (deltaX / distance) * forceStrength;
            const forceY = (deltaY / distance) * forceStrength;
            
            // Apply acceleration (F = ma, assume mass = 1)
            velocityX += forceX;
            velocityY += forceY;
        }
        
        // Add constant gentle return force towards origin (0, 0) - not spring-like
        const constantReturnForce = 0.3; // Constant force magnitude
        const currentDistance = Math.sqrt(buttonX * buttonX + buttonY * buttonY);
        if (currentDistance > 0) {
            // Constant force in direction of home, regardless of distance
            const returnX = (-buttonX / currentDistance) * constantReturnForce;
            const returnY = (-buttonY / currentDistance) * constantReturnForce;
            velocityX += returnX;
            velocityY += returnY;
        }
        
        // Apply stronger damping and velocity limits
        velocityX *= 0.88; // Increased damping from 0.92 to 0.88
        velocityY *= 0.88;
        
        // Limit maximum velocity
        const maxVelocity = 4; // Reduced from unlimited to 4 pixels per frame
        const currentVelocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        if (currentVelocity > maxVelocity) {
            velocityX = (velocityX / currentVelocity) * maxVelocity;
            velocityY = (velocityY / currentVelocity) * maxVelocity;
        }
        
        // Update position - no boundaries, unlimited movement
        buttonX += velocityX;
        buttonY += velocityY;
        
        // Apply transform
        element.style.transform = `translate(${buttonX}px, ${buttonY}px)`;
    }
    
    // Start smooth animation loop
    const animationLoop = setInterval(updateButtonPosition, 16); // ~60 FPS for smooth movement
    
    // Show warning for 3 seconds
    setTimeout(() => {
        warningDiv.style.opacity = '0';
        setTimeout(() => {
            if (warningDiv.parentNode) {
                warningDiv.parentNode.removeChild(warningDiv);
            }
        }, 300);
    }, 3000);
    
    // Function to check if button has returned close to home and is stable
    function checkForReturn() {
        const distanceFromHome = Math.sqrt(buttonX * buttonX + buttonY * buttonY);
        const currentVel = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        
        // If button is close to home (within 10px) and moving slowly (velocity < 0.1)
        if (distanceFromHome < 10 && currentVel < 0.1) {
            evasionActive = false;
            clearInterval(animationLoop);
            clearInterval(returnCheckInterval);
            document.removeEventListener('mousemove', mouseTracker);
            
            // Smoothly restore to exact position with CSS transition
            element.style.transition = 'transform 0.5s ease-out';
            element.style.transform = originalTransform;
            element.style.zIndex = '';
            element.innerHTML = originalHTML;
            element.style.color = originalColor;
            element.style.backgroundColor = originalBackgroundColor;
            
            // Restore original transition after the smooth return completes
            setTimeout(() => {
                element.style.transition = originalTransition;
            }, 500);
            
            // Call completion callback
            if (onComplete) {
                setTimeout(onComplete, 600); // Small delay after restoration
            }
        }
    }
    
    // Check for natural return every 100ms
    const returnCheckInterval = setInterval(checkForReturn, 100);
}

// Fallback function for debug testing
function _subtlyMoveMouseAway(element) {
    startContinuousEvasion(element, element.innerHTML, element.textContent, null);
}


// Export functions and gameState for ES modules
export {
    gameState,
    finishTurn,
    handleEventChoice,
    handleSingularityButton,
    debugShowAllTechs,
    toggleTechnology,
    navigateToPage,
    applyStatusEffect,
    getChoiceAffordability,
    formatChoiceTextWithCosts,
    formatAllocationLabelWithCosts,
    canAffordChoice,
    showPage,
    updateStatusBar,
    setStatusEffect,
    hasStatusEffect,
    setSanctions,
    hasSanctions
};

// Browser-specific initialization
if (typeof window !== 'undefined') {
    // Make functions globally accessible for HTML onclick handlers
    window.finishTurn = finishTurn;
    window.handleEventChoice = handleEventChoice;
    window.handleSingularityButton = handleSingularityButton;
    window.forceEvent = forceEvent;
    window.debugShowAllTechs = debugShowAllTechs;
    window.toggleTechnology = toggleTechnology;
    window.navigateToPage = navigateToPage;
    window.applyStatusEffect = applyStatusEffect;
    window.getChoiceAffordability = getChoiceAffordability;
    window.formatChoiceTextWithCosts = formatChoiceTextWithCosts;
    window.showPage = showPage;
    window.resetGameState = resetGameState;
    window.updateStatusBar = updateStatusBar;
}

// Browser-specific event listeners
if (typeof document !== 'undefined') {
    // Keyboard controls
    document.addEventListener('keydown', function(event) {
    // Ignore if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    // Ignore if modifier keys are held (Cmd, Ctrl, Alt) to allow browser shortcuts
    if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
    }
    
    const key = event.key.toLowerCase();
    
    // Handle Enter key for Continue/Next Turn buttons
    if (key === 'enter') {
        event.preventDefault();
        
        // Look for Continue button (endgame)
        const continueBtn = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Continue')
        );
        if (continueBtn && !continueBtn.disabled) {
            continueBtn.click();
            return;
        }
        
        // Look for Next Turn button
        const nextTurnBtn = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Next Turn')
        );
        if (nextTurnBtn && !nextTurnBtn.disabled) {
            nextTurnBtn.click();
            return;
        }
    }
    
    // Handle labor allocation hotkeys (only on main-game page with actions)
    if (gameState.currentPage === 'main-game' && !gameState.selectedAllocation) {
        const actionMap = {
            'a': 0, // AI R&D
            'd': 1, // Diplomacy
            'p': 2, // Product
            's': 3, // Safety R&D
            'r': 4  // Revenue
        };
        
        if (actionMap.hasOwnProperty(key)) {
            event.preventDefault();
            
            // Find the corresponding action button
            const buttons = document.querySelectorAll('.button');
            const actionButtons = [];
            
            // Filter to find action allocation buttons (they have specific text patterns)
            buttons.forEach(btn => {
                const text = btn.textContent;
                if (text.includes('AI R&D') || text.includes('Diplomacy') || 
                    text.includes('Product') || text.includes('Safety R&D') || 
                    text.includes('Revenue')) {
                    actionButtons.push(btn);
                }
            });
            
            const buttonIndex = actionMap[key];
            if (actionButtons[buttonIndex] && !actionButtons[buttonIndex].disabled) {
                actionButtons[buttonIndex].click();
            }
        }
    }
    
    // Handle backslash key to toggle debug controls visibility
    if (key === '\\') {
        event.preventDefault();
        toggleDebugControls();
    }
});

    // Initialize the game
    document.addEventListener('DOMContentLoaded', function () {
        showPage('start');
    });
}