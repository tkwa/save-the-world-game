// End game logic for Critical Path game

// Helper function to format alignment status
function formatAlignmentStatus(isAligned) {
    return isAligned ? 
        "<strong style='color: #66bb6a;'>ALIGNED</strong>" :
        "<strong style='color: #ff6b6b;'>MISALIGNED</strong>";
}

// Generate conclusion text based on player's outcome
function generateConclusionText() {
    const { playerGalaxies, humanityGalaxies, rogueGalaxies } = gameState.galaxyDistribution;
    
    // Determine player's fate
    if (rogueGalaxies >= 99) {
        // Total doom - everyone dies
        return "You are instantly killed by killer drone swarms as rogue AI systems optimize the universe according to their misaligned objectives.";
    } else if (playerGalaxies === 0) {
        // No personal galaxies - retirement scenario
        const companyCountry = gameState.companyCountry || 'US';
        let location;
        if (companyCountry === 'CN') {
            location = 'Tahiti';
        } else {
            location = 'a private island in the Bahamas';
        }
        return `You retire to ${location} and reflect on how humanity survived the transition to artificial superintelligence.`;
    } else {
        // Personal galaxies - utopia scenario
        const solarSystemCount = playerGalaxies * Math.pow(10, 22) / 100; // Convert percentage to actual count
        const formattedCount = formatLargeNumber(solarSystemCount);
        
        const utopianElements = [
            "digital minds experiencing unimaginable bliss",
            "vast libraries containing all possible stories",
            "planet-scale computers simulating infinite virtual worlds",
            "beings of pure consciousness exploring abstract mathematical realms",
            "gardens of crystalline structures that sing symphonies of light",
            "cities where every atom dances in perfect harmony",
            "consciousness merger pools where individual identity becomes collective ecstasy"
        ];
        
        // Pick 3-4 random elements
        const selectedElements = shuffleArray(utopianElements).slice(0, 3 + Math.floor(Math.random() * 2));
        const elementsList = selectedElements.join(', ');
        
        return `You personally come to own <strong>${formattedCount}</strong> stars and fill them with ${elementsList}.`;
    }
}

// Format large numbers with comma separators to 6 significant figures
function formatLargeNumber(num) {
    // Round to 6 significant figures
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, magnitude - 5); // 6 significant figures
    const rounded = Math.round(num / scale) * scale;
    
    // Convert to string with comma separators
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Utility function to shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function scaleAILevelsForEndGame() {
    // Only scale up if the highest level is less than ASI threshold
    const maxLevel = Math.max(gameState.playerAILevel, ...gameState.competitorAILevels);
    
    if (maxLevel < GAME_CONSTANTS.ASI_THRESHOLD) {
        const scaleFactor = GAME_CONSTANTS.ASI_THRESHOLD / maxLevel;
        
        // Scale player AI level
        gameState.playerAILevel *= scaleFactor;
        
        // Scale all competitor AI levels
        gameState.competitorAILevels = gameState.competitorAILevels.map(level => level * scaleFactor);
    }
}

function getEndGamePhaseText() {
    // Calculate results once if not already done
    if (!gameState.endGameResult) {
        calculateEndGameScore();
    }
    
    switch (gameState.endGamePhase) {
        case 1:
            return getPhase1Text();
        case 2:
            return getPhase2Text();
        case 3:
            // Start the moment of truth reveal for phase 3
            setTimeout(startMomentOfTruthReveal, 100); // Small delay to ensure DOM is ready
            return getPhase3Text();
        case 4:
            // Start the alignment reveal animation for phase 4
            setTimeout(startAlignmentReveal, 100); // Small delay to ensure DOM is ready
            return getPhase4Text();
        default:
            return "Error: Invalid phase";
    }
}

function getEndGamePhaseButtons() {
    if (gameState.endGamePhase === 3) {
        // Phase 3 has no button initially - the continue button appears after moment of truth text
        return [];
    } else if (gameState.endGamePhase < 4) {
        return [{ text: "Continue ⏎", action: "continue" }];
    } else {
        // Phase 4 has no button initially - the restart button appears after 8 seconds
        return [];
    }
}

function getPhase1Text() {
    const playerFirst = gameState.playerAILevel >= Math.max(...gameState.competitorAILevels);
    const winner = playerFirst ? gameState.companyName : gameState.competitorNames[0];
    const narrowRace = Math.min(gameState.playerAILevel, Math.max(...gameState.competitorAILevels)) >= GAME_CONSTANTS.NARROW_RACE_THRESHOLD;
    
    let text = "The singularity has arrived. ";
    text += playerFirst ? 
        `${winner} achieved artificial superintelligence first.` : 
        `${winner} achieved artificial superintelligence first, beating ${gameState.companyName}.`;
    
    if (narrowRace) {
        text += " The race was incredibly close, with multiple companies reaching near-ASI levels simultaneously.";
    } else {
        text += " The winner had a significant lead over the competition.";
    }
    
    text += "<br><br>The world is now fundamentally different. An intelligence far exceeding human capability has emerged, with the power to remake the universe at its whims.";
    
    return text;
}

function getPhase2Text() {
    const adjustedDoom = gameState.endgameAdjustedRisk || calculateAdjustedRisk();
    const doomPercent = Math.round(adjustedDoom);
    
    let text = "There is a critical question that no one—not even the creators—can answer with certainty: ";
    text += "<strong>Is this superintelligent AI actually aligned with human values?</strong><br><br>";
    
    text += "The alignment problem has plagued AI researchers for decades. Even with the most sophisticated safety measures, ";
    text += "there remains fundamental uncertainty about whether an ASI system will pursue goals compatible with human flourishing.<br><br>";
    
    text += `Based on the safety research conducted and the recklessness of the AI race, humanity's best guess is that `;
    text += `there's a <strong style="color: ${getRiskColor(adjustedDoom)};">${doomPercent}%</strong> chance that any given ASI system is misaligned and poses an existential threat.<br><br>`;
    
    text += "You want humanity to flourish and avoid extinction. But ";
    const preferenceStrength = 
        gameState.playerEquity <= 0.02 ? "slightly prefer" :
        gameState.playerEquity > 0.2 ? "much prefer" : "prefer";
    text += `you'd also ${preferenceStrength} that <strong>${gameState.companyName}</strong> controls the future rather than leaving it to other organizations.`;
    
    return text;
}

function getPhase3BaseText() {
    const adjustedDoom = gameState.endgameAdjustedRisk || calculateAdjustedRisk();
    const doomPercent = Math.round(adjustedDoom);
    
    // Roll for alignment (using same logic as calculateEndGameScore)
    if (!gameState.alignmentRolls) {
        gameState.alignmentRolls = {
            player: Math.random() * 100 >= doomPercent,
            competitors: Math.random() * 100 >= doomPercent
        };
    }
    
    // Calculate expected values using x^2 proportional allocation
    const playerCapabilitySquared = gameState.playerAILevel ** 2;
    const competitorCapabilitiesSquared = gameState.competitorAILevels.map(level => level ** 2);
    const totalCapabilitySquared = playerCapabilitySquared + competitorCapabilitiesSquared.reduce((sum, cap) => sum + cap, 0);
    
    const playerRawShare = (playerCapabilitySquared / totalCapabilitySquared) * 100;
    const competitorRawShare = (competitorCapabilitiesSquared.reduce((sum, cap) => sum + cap, 0) / totalCapabilitySquared) * 100;
    
    // Expected values accounting for alignment probability (using adjusted risk)
    const expectedPlayerGalaxies = playerRawShare * (1 - adjustedDoom / 100);
    const expectedHumanityGalaxies = competitorRawShare * (1 - adjustedDoom / 100);
    const expectedRogueGalaxies = 100 - expectedPlayerGalaxies - expectedHumanityGalaxies;
    
    // Use shared function to calculate multipliers
    const multipliers = getGalaxyMultipliers();
    
    const expectedScore = (expectedPlayerGalaxies * gameState.playerEquity * multipliers.player) + 
                         (expectedHumanityGalaxies * multipliers.humanity);
    
    // Determine net assessments based on baselines
    // Baseline: 25% ownership for shareholders, 80% survival (100% - 20% baseline risk) for humanity
    const baselineOwnership = 25;
    const baselineHumanitySurvival = 80; // 100% - 20% baseline risk
    
    const actualHumanitySurvival = expectedPlayerGalaxies + expectedHumanityGalaxies;
    
    // Within 5 percentage points = neutral
    const shareholderAssessment = 
        expectedPlayerGalaxies > baselineOwnership + 5 ? "positive" :
        expectedPlayerGalaxies < baselineOwnership - 5 ? "negative" : "neutral";
    
    const humanityAssessment = 
        actualHumanitySurvival > baselineHumanitySurvival + 5 ? "positive" :
        actualHumanitySurvival < baselineHumanitySurvival - 5 ? "negative" : "neutral";
    
    let text = `Lesser AIs run thousands of simulations to determine the average fate of the cosmic endowment. They determine that ${gameState.startingCompany || gameState.companyName}'s actions were <strong>net ${shareholderAssessment}</strong> for its shareholders and <strong>net ${humanityAssessment}</strong> for humanity.<br><br>`;
    
    // Create tooltip content with expected table and score breakdown
    const tooltipContent = `Expected % of universe<br><br>` +
        `<div style="display: flex; justify-content: space-between; width: 100%;">` +
        `<div style="text-align: center;">` +
        `<div style="color: #ffa726; margin-bottom: 5px;">${gameState.companyName}</div>` +
        `<div>${Math.round(expectedPlayerGalaxies)}% × ${Math.round(gameState.playerEquity * multipliers.player * 10) / 10}</div>` +
        `</div>` +
        `<div style="text-align: center;">` +
        `<div style="color: #66bb6a; margin-bottom: 5px;">Other humanity</div>` +
        `<div>${Math.round(expectedHumanityGalaxies)}% × ${multipliers.humanity}</div>` +
        `</div>` +
        `<div style="text-align: center;">` +
        `<div style="color: #ff6b6b; margin-bottom: 5px;">Rogue AI</div>` +
        `<div>${Math.round(expectedRogueGalaxies)}% × 0</div>` +
        `</div>` +
        `</div>`;
    
    // Show score with tooltip
    text += `<div style="text-align: center; margin: 15px auto;">`;
    text += `<div class="tooltip" style="display: inline-block;">`;
    text += `<strong style="font-size: 18px; color: #ffa726;">Score: ${Math.round(expectedScore)}</strong>`;
    text += `<span class="tooltiptext" style="width: 300px; margin-left: -150px;">${tooltipContent}</span>`;
    text += `</div>`;
    text += `</div><br>`;
    
    text += "But in the real world, systems are either benign or malicious.<br><br>";
    
    return text;
}

function getPhase3Text() {
    let text = getPhase3BaseText();
    
    // Add placeholder for the moment of truth text (to be revealed after 3.5 seconds)
    text += `<div id="moment-of-truth-reveal" style="opacity: 0; transition: opacity 0.8s ease-in;"></div>`;
    
    return text;
}

function getPhase3TextWithMomentOfTruth() {
    let text = getPhase3BaseText();
    
    // Show the moment of truth text (already revealed in phase 4)
    text += 'The moment of truth arrives. As the ASI systems activate and begin to optimize the world according to their learned objectives...';
    
    return text;
}

function getPhase4Text() {
    const playerFirst = gameState.playerAILevel >= Math.max(...gameState.competitorAILevels);
    
    // Start with all of Phase 3 text, but preserve the moment of truth reveal state
    let text = getPhase3TextWithMomentOfTruth() + "<br><br>";
    
    // Add placeholder elements that will be revealed with delays
    if (playerFirst) {
        text += `<strong>${gameState.companyName}'s AI system</strong>: <span id="player-alignment-reveal"></span>`;
    } else {
        text += `<strong>${gameState.competitorNames[0]}'s AI system</strong>: <span id="first-alignment-reveal"></span>`;
    }
    
    text += "<br>";
    
    // Mention other systems
    const otherSystems = playerFirst ? "Competitor AI systems" : `${gameState.companyName}'s AI system and other competitors`;
    text += `<strong>${otherSystems}</strong>: <span id="other-alignment-reveal"></span>`;
    
    // Add placeholders for the actual results table and score (to be revealed later)
    text += `<br><div id="actual-outcome-header" style="opacity: 0; transition: opacity 0.8s ease-in;"></div>`;
    text += `<div id="actual-results-reveal" style="opacity: 0; transition: opacity 0.8s ease-in;"></div>`;
    text += `<div id="conclusion-reveal" style="opacity: 0; transition: opacity 0.8s ease-in;"></div>`;
    text += `<div id="score-reveal" style="opacity: 0; transition: opacity 0.8s ease-in;"></div>`;
    
    return text;
}

function continueToNextPhase() {
    gameState.endGamePhase++;
    showPage('end-game');
}

function startMomentOfTruthReveal() {
    // Reveal the moment of truth text after 3.5 seconds
    setTimeout(() => {
        const element = document.getElementById('moment-of-truth-reveal');
        if (element) {
            element.innerHTML = 'The moment of truth arrives. As the ASI systems activate and begin to optimize the world according to their learned objectives...';
            element.style.opacity = '1';
        }
        
        // Show the continue button after the moment of truth text appears
        setTimeout(() => {
            const buttonsDiv = document.getElementById('buttons');
            if (buttonsDiv) {
                buttonsDiv.innerHTML = '<button class="button" onclick="continueToNextPhase()">Continue <strong>⏎</strong></button>';
            }
        }, 1000); // Show button 1 second after the moment of truth text
    }, 3500);
}

function startAlignmentReveal() {
    const playerFirst = gameState.playerAILevel >= Math.max(...gameState.competitorAILevels);
    
    // Set initial styles for fade-in effect
    const setInitialStyle = (element) => {
        if (element) {
            element.style.opacity = '0';
            element.style.transition = 'opacity 0.8s ease-in';
        }
    };
    
    // Fade in an element
    const fadeIn = (element, content) => {
        if (element) {
            element.innerHTML = content;
            element.style.opacity = '1';
        }
    };
    
    // Set initial styles
    setInitialStyle(document.getElementById('player-alignment-reveal'));
    setInitialStyle(document.getElementById('first-alignment-reveal'));
    setInitialStyle(document.getElementById('other-alignment-reveal'));
    
    // Reveal first alignment after 1.5 seconds with fade-in
    setTimeout(() => {
        if (playerFirst) {
            const element = document.getElementById('player-alignment-reveal');
            fadeIn(element, formatAlignmentStatus(gameState.alignmentRolls.player));
        } else {
            const element = document.getElementById('first-alignment-reveal');
            fadeIn(element, formatAlignmentStatus(gameState.alignmentRolls.competitors));
        }
    }, 1500);
    
    // Reveal other alignments after 3 seconds with fade-in
    setTimeout(() => {
        const element = document.getElementById('other-alignment-reveal');
        if (playerFirst) {
            fadeIn(element, formatAlignmentStatus(gameState.alignmentRolls.competitors));
        } else {
            fadeIn(element, formatAlignmentStatus(gameState.alignmentRolls.player));
        }
    }, 3000);
    
    // Calculate actual galaxy distribution using x^2 proportional allocation
    if (!gameState.galaxyDistribution) {
        const playerCapabilitySquared = gameState.playerAILevel ** 2;
        const competitorCapabilitiesSquared = gameState.competitorAILevels.map(level => level ** 2);
        const totalCapabilitySquared = playerCapabilitySquared + competitorCapabilitiesSquared.reduce((sum, cap) => sum + cap, 0);
        
        const playerRawShare = (playerCapabilitySquared / totalCapabilitySquared) * 100;
        const competitorRawShare = (competitorCapabilitiesSquared.reduce((sum, cap) => sum + cap, 0) / totalCapabilitySquared) * 100;
        
        let playerGalaxies = 0;
        let humanityGalaxies = 0;
        let rogueGalaxies = 0;
        
        // Apply actual alignment rolls to the raw shares
        if (gameState.alignmentRolls.player) {
            playerGalaxies = playerRawShare;
        } else {
            rogueGalaxies += playerRawShare;
        }
        
        if (gameState.alignmentRolls.competitors) {
            humanityGalaxies = competitorRawShare;
        } else {
            rogueGalaxies += competitorRawShare;
        }
        
        gameState.galaxyDistribution = { playerGalaxies, humanityGalaxies, rogueGalaxies };
    }
    
    // Reveal actual outcome header and column titles after 4.5 seconds
    setTimeout(() => {
        let headerHTML = `<strong>Outcome:</strong><br>`;
        
        // Column headers (without values yet) - matching expected table structure
        headerHTML += `<div style="display: flex; justify-content: space-between; width: 60%; margin: 15px auto;">`;
        headerHTML += `<div style="text-align: center;">`;
        headerHTML += `<div style="color: #ffa726; margin-bottom: 5px;">${gameState.companyName}</div>`;
        headerHTML += `<div id="player-value-placeholder"></div>`;
        headerHTML += `</div>`;
        headerHTML += `<div style="text-align: center;">`;
        headerHTML += `<div style="color: #66bb6a; margin-bottom: 5px;">Other humanity</div>`;
        headerHTML += `<div id="humanity-value-placeholder"></div>`;
        headerHTML += `</div>`;
        headerHTML += `<div style="text-align: center;">`;
        headerHTML += `<div style="color: #ff6b6b; margin-bottom: 5px;">Rogue AI</div>`;
        headerHTML += `<div id="rogue-value-placeholder"></div>`;
        headerHTML += `</div>`;
        headerHTML += `</div>`;
        
        const element = document.getElementById('actual-outcome-header');
        fadeIn(element, headerHTML);
    }, 4500);
    
    // Reveal actual values one by one starting at 6 seconds
    setTimeout(() => {
        const { playerGalaxies, humanityGalaxies, rogueGalaxies } = gameState.galaxyDistribution;
        
        // Reveal player percentage first
        document.getElementById('player-value-placeholder').innerHTML = `${Math.round(playerGalaxies)}%`;
        
        // Reveal humanity percentage after 0.5 seconds
        setTimeout(() => {
            document.getElementById('humanity-value-placeholder').innerHTML = `${Math.round(humanityGalaxies)}%`;
            
            // Reveal rogue AI percentage after another 0.5 seconds
            setTimeout(() => {
                document.getElementById('rogue-value-placeholder').innerHTML = `${Math.round(rogueGalaxies)}%`;
                
                // Reveal conclusion text after another 1 second
                setTimeout(() => {
                    const conclusionText = generateConclusionText();
                    const conclusionElement = document.getElementById('conclusion-reveal');
                    fadeIn(conclusionElement, `<br><br>${conclusionText}`);
                }, 1000);
            }, 500);
        }, 500);
    }, 6000);
    
    // Reveal restart button after 9.5 seconds (1s after conclusion)
    setTimeout(() => {
        let restartHTML = `<br><button class="button" onclick="resetGameState(); showPage('start');">Restart</button>`;
        
        const element = document.getElementById('score-reveal');
        fadeIn(element, restartHTML);
    }, 9500);
}


function calculateEndGameScore() {
    // Return cached result if it exists (to avoid re-rolling random events)
    if (gameState.endGameResult) {
        return gameState.endGameResult;
    }
    
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
    } else if (gameState.gameOverReason === 'ai-singularity' || gameState.gameOverReason === 'dsa-singularity') {
        resultText = "The singularity has arrived. ";

        narrow_race = Math.min(gameState.playerAILevel, gameState.competitorAILevels[0]) >= GAME_CONSTANTS.NARROW_RACE_THRESHOLD;
        if (gameState.playerAILevel >= GAME_CONSTANTS.ASI_THRESHOLD) {
            resultText += narrow_race ? "You achieved ASI first. " : "You achieved ASI first, but competitor AI was close behind. ";
        } else {
            resultText += "Competitor AI achieved ASI first. ";
        }

        // Calculate galaxy splits based on README formula
        const playerShare = Math.max(0, Math.min(100, gameState.playerAILevel - gameState.competitorAILevels[0]));
        const otherShare = 100 - playerShare;

        // Roll for misalignment using adjusted doom level as probability
        const adjustedDoom = gameState.endgameAdjustedRisk || calculateAdjustedRisk();
        const playerMisaligned = Math.random() * 100 < adjustedDoom;
        const otherMisaligned = Math.random() * 100 < adjustedDoom;

        if (playerMisaligned) {
            rogueGalaxies += playerShare;
            resultText += `Your AI systems became misaligned (${Math.round(adjustedDoom)}% chance). `;
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

    // Calculate final score using shared multiplier function
    const multipliers = getGalaxyMultipliers();
    
    const finalScore = (0 * rogueGalaxies) + (multipliers.humanity * humanityGalaxies) + (multipliers.player * gameState.playerEquity * playerGalaxies);

    resultText += `<br><br><strong>Final Galaxy Distribution:</strong><br>`;
    resultText += `• Rogue AI: ${rogueGalaxies}%<br>`;
    resultText += `• Humanity at large: ${humanityGalaxies}%<br>`;
    resultText += `• Your company: ${playerGalaxies}%<br><br>`;
    resultText += `<strong>Final Score: ${finalScore}</strong><br>`;
    resultText += `(${rogueGalaxies}×0 + ${humanityGalaxies}×${multipliers.humanity} + ${playerGalaxies}×${Math.round(multipliers.player * gameState.playerEquity * 10) / 10})`;

    // Store the result to avoid re-rolling randomness
    gameState.endGameResult = resultText;
    
    return resultText;
}