// Opening sequence for Critical Path game
import { COMPANIES, GAME_CONSTANTS, gameState } from './utils.js';
import { showPage } from './game-core.js';
import { generateEvent } from './events.js';

// Intro sequence state
let introState = {
    currentStep: 0,
    aiLevel: 3.3,
    currentMonth: "October",
    currentYear: 2024,
    buttonCooldown: false,
    buttonPercentage: 3,
    cooldownTime: 2500, // milliseconds
    companyName: null,
    isButtonPressed: false,
    initializing: false,
    isNewGame: true, // Flag to track if this is a new game
    debugSpeedMode: false, // Debug mode to speed up intro 10x
    riskShown: false, // Flag to track if Rogue AI Risk has been shown
    riskLevel: 9, // Start at 9% when risk first appears, increase to 20% over remaining clicks
    statusBarSetup: false, // Flag to track if status bar has been set up (avoid repeated DOM manipulation)
    permanentlyDisabled: false // Flag to track if button should stay disabled permanently
};

// Text sequences - most appear every 2 clicks, but 6 intellectual tasks appear on consecutive clicks
const introTexts = {
    1: "Since 2011, the capabilities of AI systems have grown steadily, but exponentially.",
    3: "  Humans are notorious for underestimating exponentials.",
    5: "<br><br>AIs began to surpass humans at image recognition and board games, then poetry, ",
    6: "scientific reasoning, ",
    7: "mathematical proofs, ",
    8: "protein design, ",
    9: "and persuasion.",
    11: "  By 2025, AI systems are human-level at software development",
    12: "-- and think about <strong>{aiLevel}x</strong> faster than any human.",
    13: "<br><br>When AI systems become capable of automating AI R&D, the exponential progress only speeds up.", // Button changes to 4%, delay to 2s
    15: "<br>But no one knows if our ability to control AIs will keep pace with their rate of improvement.",
    17: "<br>Companies evaluate their AIs for ability to make chemical and biological weapons, and to escape containment.",
    19: "<br>You face a dilemma: move too slowly on capabilities and competitors will achieve superintelligence first.", // Button changes to 5%
    21: "<br>Move too quickly and risk building misaligned systems that could destroy everything.", // Fade in Rogue AI Risk
    23: "<br>The risks are low, but increasing every month..." // Final text
};

// Function to get intro text with dynamic values substituted
function getIntroText(step) {
    let text = introTexts[step];
    if (text && text.includes('{aiLevel}')) {
        text = text.replace('{aiLevel}', introState.aiLevel.toFixed(2));
    }
    return text;
}

const EXTRA_CLICKS_AFTER_TEXT = 6;

// Initialize intro sequence - only called once at the start of a new game
function initializeIntro() {
    // Only initialize if this is a new game or we haven't selected a company yet
    if (introState.companyName && !introState.isNewGame) {
        // Just update display if already initialized and not a new game
        updateIntroDisplay();
        return;
    }
    
    console.log('initializeIntro called');
    
    // Randomly select a company for the intro
    const selectedCompany = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
    console.log('Selected company:', selectedCompany);
    
    introState.companyName = selectedCompany.name;
    introState.selectedCompany = selectedCompany; // Store full company info
    
    console.log('introState.companyName set to:', introState.companyName);
    
    // Reset intro state
    introState.currentStep = 0;
    introState.aiLevel = 3.3;
    introState.currentMonth = "October";
    introState.currentYear = 2024;
    introState.buttonCooldown = false;
    introState.buttonPercentage = 3;
    introState.cooldownTime = 2500;
    introState.isButtonPressed = false;
    
    updateIntroDisplay();
    
    // Clear the new game flag after initialization
    introState.isNewGame = false;
    
    // Update the title to show the selected company
    setTimeout(() => updateIntroTitle(), 0);
}

// Reset intro state for a new game
function resetIntroState() {
    introState.companyName = null;
    introState.selectedCompany = null;
    introState.currentStep = 0;
    introState.aiLevel = 3.3;
    introState.currentMonth = "December";
    introState.currentYear = 2024;
    introState.buttonCooldown = false;
    introState.buttonPercentage = 3;
    introState.cooldownTime = 2500;
    introState.isButtonPressed = false;
    introState.initializing = false;
    introState.isNewGame = true; // Set flag to indicate this is a new game
    introState.riskShown = false; // Reset risk shown flag
    introState.riskLevel = 9; // Reset risk level
    introState.statusBarSetup = false; // Reset status bar setup flag for new game
    introState.permanentlyDisabled = false; // Reset permanent disabled flag for new game
}

// Update just the intro title without re-rendering the whole page
function updateIntroTitle() {
    const titleElement = document.querySelector('#story-content h2');
    if (titleElement) {
        const role = 'CEO';
        const companyDisplay = introState.companyName || 'Company';
        const currentMonth = introState.currentMonth || 'December';
        const currentYear = introState.currentYear || 2024;
        const flagDisplay = (introState.selectedCompany && introState.selectedCompany.flag) ? 
            `<span style="font-size: 20px; margin-left: 8px;">${introState.selectedCompany.flag}</span>` : '';
        
        const newTitle = `<div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${currentMonth} ${currentYear}</span>
            <span style="font-size: 14px; color: #999;">
                Role: ${role}, ${companyDisplay}${flagDisplay}
            </span>
        </div>`;
        
        titleElement.innerHTML = newTitle;
    }
}



// Hide Resources and Status Effects columns for intro
function setupIntroStatusBar() {
    // Only set up once, use a flag to avoid repeated DOM manipulation
    if (introState.statusBarSetup) {
        return;
    }
    
    console.log('setupIntroStatusBar: setting up intro status bar (one-time)');
    
    // Hide Resources column
    const resourcesColumn = document.querySelector('.resources-column');
    if (resourcesColumn) {
        resourcesColumn.style.display = 'none';
    }
    
    // Hide Status Effects column (the third status-column)
    const statusColumns = document.querySelectorAll('.status-column');
    if (statusColumns.length >= 3) {
        statusColumns[2].style.display = 'none'; // Third column is Status Effects
    }
    
    // Hide competitors display during intro
    const competitorsLine = document.getElementById('competitors-line');
    if (competitorsLine) {
        competitorsLine.style.display = 'none';
    }
    
    // Hide Rogue AI Risk section initially (will be shown later via fadeInRogueAIRisk)
    // But don't hide it if it's already been shown
    if (!introState.riskShown) {
        const riskSection = document.getElementById('rogue-ai-risk-section');
        if (riskSection) {
            riskSection.style.display = 'none';
            console.log('setupIntroStatusBar: hiding risk section');
        }
    } else {
        console.log('setupIntroStatusBar: NOT hiding risk section because riskShown =', introState.riskShown);
    }
    
    // Mark as set up to avoid repeated calls
    introState.statusBarSetup = true;
}

// Restore full status bar for main game
function restoreFullStatusBar() {
    // Show Resources column
    const resourcesColumn = document.querySelector('.resources-column');
    if (resourcesColumn) {
        resourcesColumn.style.display = 'block';
    }
    
    // Show Status Effects column (the third status-column)
    const statusColumns = document.querySelectorAll('.status-column');
    if (statusColumns.length >= 3) {
        statusColumns[2].style.display = 'block'; // Third column is Status Effects
    }
    
    // Show competitors line
    const competitorsLine = document.getElementById('competitors-line');
    if (competitorsLine) {
        competitorsLine.style.display = 'inline';
    }
    
    // Show Rogue AI Risk section
    const riskSection = document.getElementById('rogue-ai-risk-section');
    if (riskSection) {
        riskSection.style.display = 'block';
    }
}

// Update the intro display
function updateIntroDisplay() {
    // Set up the simplified status bar for intro
    setupIntroStatusBar();
    
    // Update AI level display (main status bar) with "x" suffix
    const aiLevelDisplay = document.getElementById('player-ai-level');
    if (aiLevelDisplay) {
        aiLevelDisplay.textContent = introState.aiLevel.toFixed(2) + 'x';
    }
    
    // Update company name (main status bar)
    const companyNameDisplay = document.getElementById('company-name-ai');
    if (companyNameDisplay) {
        companyNameDisplay.textContent = introState.companyName;
    }
    
    // Competitors are hidden during intro, no need to update them
    
    
    // Update button text with current absolute increase value
    const button = document.getElementById('intro-ai-button');
    if (button) {
        const currentIncrease = (introState.buttonPercentage / 100) * introState.aiLevel;
        button.innerHTML = `AI R&D (+${currentIncrease.toFixed(2)})`;
        
        // Update button state - don't re-enable if permanently disabled
        if (introState.permanentlyDisabled) {
            button.disabled = true;
            button.style.backgroundColor = '#666';
            button.style.cursor = 'not-allowed';
            button.classList.remove('filling');
        } else if (introState.buttonCooldown) {
            button.disabled = true;
            button.classList.add('filling');
        } else {
            button.disabled = false;
            button.classList.remove('filling');
        }
    } else {
        console.log('intro-ai-button element not found');
    }
}

// Handle AI R&D button press
function handleAIRDButtonPress() {
    // Check if button is permanently disabled
    if (introState.permanentlyDisabled) {
        console.log('Button is permanently disabled, ignoring click');
        return;
    }
    
    // Check if button is disabled
    const button = document.getElementById('intro-ai-button');
    if (button && button.disabled) {
        console.log('Button is disabled, ignoring click');
        return;
    }
    
    if (introState.buttonCooldown) return;
    
    // Start cooldown
    introState.buttonCooldown = true;
    introState.isButtonPressed = true;
    
    // Increase AI level by percentage of current level
    const increase = (introState.buttonPercentage / 100) * introState.aiLevel;
    introState.aiLevel += increase;
    
    // Increment step counter first
    introState.currentStep++;
    
    // Advance month every other button press
    if (introState.currentStep % 2 === 0) {
        advanceMonth();
    }
    
    // Check if there's text to display at this step
    if (introTexts[introState.currentStep]) {
        const dynamicText = getIntroText(introState.currentStep);
        addIntroText(dynamicText, introState.currentStep);
        console.log(`Button press ${introState.currentStep}: "${dynamicText.substring(0, 50)}..."`);
        
        // Handle special steps that have text
        if (introState.currentStep === 14) {
            // Step 14: change button to 4%, reduce delay to 2s
            introState.buttonPercentage = 4;
            introState.cooldownTime = 2000;
        } else if (introState.currentStep === 20) {
            // Step 20: change button to 5%
            introState.buttonPercentage = 5;
        }
    }
    
    // Handle special steps that don't necessarily have text
    if (introState.currentStep === 19) {
        // Step 19: fade in Rogue AI Risk
        console.log('Step 19 reached - calling fadeInRogueAIRisk, riskShown:', introState.riskShown);
        fadeInRogueAIRisk();
    }
    
    // Increase risk level if it's been shown (after text index 9)
    if (introState.riskShown && introState.riskLevel < 20) {
        introState.riskLevel++;
        updateRiskDisplay();
        console.log('Increased risk level to', introState.riskLevel + '%');
    }
    
    // Check if all texts have been shown and handle extra clicks
    const lastTextStep = 24; // Step when last text was shown
    if (introState.currentStep > lastTextStep) {
        // All texts shown - count extra clicks (every button press now counts)
        const extraClicks = introState.currentStep - lastTextStep;
        console.log(`All texts shown. currentStep: ${introState.currentStep}, lastTextStep: ${lastTextStep}, extraClicks: ${extraClicks}, need: ${EXTRA_CLICKS_AFTER_TEXT}`);
        
        if (extraClicks >= EXTRA_CLICKS_AFTER_TEXT) {
            // After 6 extra clicks: permanently disable button and show transition button
            introState.permanentlyDisabled = true;
            const button = document.getElementById('intro-ai-button');
            if (button) {
                button.disabled = true;
                button.style.backgroundColor = '#666';
                button.style.cursor = 'not-allowed';
            }
            showTransitionButton();
        }
        // Continue allowing clicks until we reach the extra click limit
    }
    
    updateIntroDisplay();
    
    // Update any existing dynamic text with the new AI level
    updateDynamicTexts();
    
    // Start button animation and cooldown
    if (button) {
        button.classList.add('filling');
        
        // Calculate actual cooldown time (10x faster in debug mode)
        const actualCooldownTime = introState.debugSpeedMode ? Math.round(introState.cooldownTime / 10) : introState.cooldownTime;
        
        // Update animation duration to match cooldown time
        button.style.animationDuration = `${actualCooldownTime}ms`;
        
        setTimeout(() => {
            introState.buttonCooldown = false;
            button.classList.remove('filling');
            button.style.animationDuration = ''; // Reset to default
            updateIntroDisplay();
        }, actualCooldownTime);
    }
}

// Add new intro text
function addIntroText(text, step) {
    const textContainer = document.getElementById('intro-text-container');
    if (textContainer) {
        // Simply append the text to the container, using innerHTML to handle line breaks
        textContainer.innerHTML += text;
        
        // Add data attribute to the container for dynamic text updates
        if (text.includes('faster than any human')) {
            textContainer.setAttribute('data-dynamic-step', step);
        }
    }
}

// Update existing dynamic text elements
function updateDynamicTexts() {
    const textContainer = document.getElementById('intro-text-container');
    if (textContainer && textContainer.hasAttribute('data-dynamic-step')) {
        // Re-render all text up to current step to update dynamic values
        const currentHTML = textContainer.innerHTML;
        if (currentHTML.includes('faster than any human')) {
            // Find the current AI level in the text and replace it with updated value
            const aiLevelRegex = /<strong>[\d.]+x<\/strong>/g;
            const newAiLevel = `<strong>${introState.aiLevel.toFixed(2)}x</strong>`;
            const updatedHTML = currentHTML.replace(aiLevelRegex, newAiLevel);
            textContainer.innerHTML = updatedHTML;
        }
    }
}

// Advance month in intro
function advanceMonth() {
    const months = ["January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"];
    
    const currentIndex = months.indexOf(introState.currentMonth);
    const nextIndex = (currentIndex + 1) % 12;
    
    introState.currentMonth = months[nextIndex];
    
    // Advance year if we wrapped around to January
    if (nextIndex === 0) {
        introState.currentYear++;
    }
    
    // Update just the title with the new month/year
    updateIntroTitle();
}

// Fade in Rogue AI Risk display
function fadeInRogueAIRisk() {
    console.log('fadeInRogueAIRisk called');
    const riskElement = document.getElementById('rogue-ai-risk-section');
    console.log('Risk element found:', !!riskElement);
    
    if (riskElement) {
        console.log('Before fade: display =', riskElement.style.display, 'opacity =', riskElement.style.opacity);
        
        riskElement.style.opacity = '0';
        riskElement.style.display = 'block';
        riskElement.style.transition = 'opacity 1s ease-in';
        
        // Set initial risk level when first shown
        updateRiskDisplay();
        console.log('Set initial risk level to', introState.riskLevel + '%');
        
        setTimeout(() => {
            riskElement.style.opacity = '1';
            console.log('After fade: display =', riskElement.style.display, 'opacity =', riskElement.style.opacity);
        }, 100);
        
        // Mark risk as shown so setupIntroStatusBar won't hide it again
        introState.riskShown = true;
        console.log('Set riskShown flag to true');
    } else {
        console.log('Risk element not found!');
    }
}

// Update risk display with current risk level and appropriate color
function updateRiskDisplay() {
    const riskLevelElement = document.getElementById('risk-level');
    if (riskLevelElement) {
        riskLevelElement.textContent = introState.riskLevel + '%';
        
        // Set color based on risk level (same logic as main game)
        if (introState.riskLevel < 15) {
            riskLevelElement.style.color = '#66bb6a'; // Green for low risk
        } else if (introState.riskLevel < 50) {
            riskLevelElement.style.color = '#ffa726'; // Orange for medium risk
        } else {
            riskLevelElement.style.color = '#ff6b6b'; // Red for high risk
        }
    }
}

// Show transition button to main game
function showTransitionButton() {
    const transitionButton = document.getElementById('intro-transition-button');
    if (transitionButton) {
        transitionButton.style.opacity = '0';
        transitionButton.style.display = 'inline-block';
        transitionButton.style.transition = 'opacity 1s ease-in';
        
        setTimeout(() => {
            transitionButton.style.opacity = '1';
        }, 500);
    }
}

// Transition to main game  
async function startMainGame() {
    console.log('startMainGame called');
    
    // Restore full status bar before transitioning
    restoreFullStatusBar();
    
    try {
        // Do exactly what the old game-setup page did
        
        // Use the company selected during intro, or select random if intro was skipped
        const selectedCompany = introState.selectedCompany || 
            COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
            
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
        
        // Set up game state exactly like game-setup did
        gameState.currentTurn = GAME_CONSTANTS.INITIAL_TURN;
        gameState.currentMonth = "January";
        gameState.currentYear = GAME_CONSTANTS.INITIAL_YEAR;
        
        // Set AI level - use intro level if available, otherwise default
        if (introState.aiLevel) {
            gameState.playerAILevel = Math.round(introState.aiLevel);
        }
        
        // Set risk level to match intro progression (should be 20% when main game starts)
        if (introState.riskShown) {
            gameState.rawRiskLevel = introState.riskLevel;
            console.log('Set main game risk level to', introState.riskLevel + '%');
        }
        
        // Mark that main game has started (affects tech visibility)
        gameState.mainGameStarted = true;
        
        // Generate first event (this is crucial!)
        gameState.currentEvent = await generateEvent();
        
        console.log('Transitioning to main game with company:', gameState.companyName);
        
        // Navigate to main game
        showPage('main-game');
    } catch (error) {
        console.error('Error in startMainGame:', error);
        // Fallback to standard game setup
        showPage('game-setup');
    }
}

// Update intro debug button visibility based on main debug controls
function updateIntroDebugButtonVisibility() {
    const debugControls = document.getElementById('debug-controls');
    const showDebugButton = debugControls && debugControls.style.display !== 'none';
    const debugButton = document.getElementById('intro-debug-speed-button');
    
    if (showDebugButton && !debugButton) {
        // Add debug button if it should be shown but doesn't exist
        const buttonHtml = `<button id="intro-debug-speed-button" onclick="toggleIntroDebugSpeed()" 
                style="position: fixed; top: 60px; right: 20px; background-color: #666; color: white; padding: 6px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; font-family: 'Courier New', Courier, monospace; z-index: 1000;">
            Debug: 10x Speed (OFF)
        </button>`;
        document.body.insertAdjacentHTML('beforeend', buttonHtml);
    } else if (!showDebugButton && debugButton) {
        // Remove debug button if it shouldn't be shown but exists
        debugButton.remove();
    }
}

// Toggle debug speed mode for intro
function toggleIntroDebugSpeed() {
    introState.debugSpeedMode = !introState.debugSpeedMode;
    const button = document.getElementById('intro-debug-speed-button');
    if (button) {
        button.textContent = introState.debugSpeedMode ? 'Debug: 10x Speed (ON)' : 'Debug: 10x Speed (OFF)';
        button.style.backgroundColor = introState.debugSpeedMode ? '#4CAF50' : '#666';
    }
    console.log('Intro debug speed mode:', introState.debugSpeedMode ? 'ON (10x faster)' : 'OFF (normal speed)');
}

// Skip intro and start main game with AI level set to 10x
function skipIntroToMainGame() {
    // Set AI level to 10x to match expected intro completion level
    introState.aiLevel = 10.0;
    
    // Set up company if not already done
    if (!introState.companyName) {
        const selectedCompany = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
        introState.companyName = selectedCompany.name;
        introState.selectedCompany = selectedCompany;
    }
    
    // Start main game with the skip settings
    startMainGame();
}

// Start a new game by resetting intro state and going to intro page
function startNewGame() {
    resetIntroState();
    showPage('intro');
}

// Export functions for ES modules
export {
    introState,
    initializeIntro,
    handleAIRDButtonPress,
    startMainGame,
    skipIntroToMainGame,
    startNewGame,
    resetIntroState,
    restoreFullStatusBar,
    toggleIntroDebugSpeed,
    updateIntroDebugButtonVisibility
};

// Export functions for global use
if (typeof window !== 'undefined') {
    window.initializeIntro = initializeIntro;
    window.handleAIRDButtonPress = handleAIRDButtonPress;
    window.startMainGame = startMainGame;
    window.skipIntroToMainGame = skipIntroToMainGame;
    window.startNewGame = startNewGame;
    window.resetIntroState = resetIntroState;
    window.restoreFullStatusBar = restoreFullStatusBar;
    window.toggleIntroDebugSpeed = toggleIntroDebugSpeed;
    window.updateIntroDebugButtonVisibility = updateIntroDebugButtonVisibility;
}