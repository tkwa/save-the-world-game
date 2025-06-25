// Minigame functions for the AI Timeline Game

async function loadCorrelationDataset() {
    if (gameState.correlationDataset) return gameState.correlationDataset;
    
    try {
        const response = await fetch('minigames/correlations/data.json');
        gameState.correlationDataset = await response.json();
        return gameState.correlationDataset;
    } catch (error) {
        console.error('Failed to load correlation dataset:', error);
        return null;
    }
}

async function startCapabilityEvalsMinigame() {
    const dataset = await loadCorrelationDataset();
    if (!dataset || !dataset.images) {
        alert('Error: Could not load minigame data.');
        return;
    }
    
    // Select random image
    const randomImage = dataset.images[Math.floor(Math.random() * dataset.images.length)];
    gameState.currentMinigame = {
        type: 'capability-evals',
        image: randomImage,
        attempts: 0
    };
    
    gameState.currentPage = 'capability-evals-minigame';
    showPage('capability-evals-minigame');
}

function submitCapabilityEvalsAnswer(selectedCorrelation, buttonElement) {
    const minigame = gameState.currentMinigame;
    if (!minigame || minigame.type !== 'capability-evals') return;
    
    const correctAnswer = minigame.image.correlation;
    const isCorrect = Math.abs(selectedCorrelation - correctAnswer) < 0.001;
    
    // Disable all buttons
    const allButtons = document.querySelectorAll('#buttons .button');
    allButtons.forEach(btn => {
        if (!btn.textContent.includes('Back to Game')) {
            btn.disabled = true;
            btn.style.cursor = 'default';
        }
    });
    
    // Get or create feedback div
    let feedbackDiv = document.getElementById('minigame-feedback');
    if (!feedbackDiv) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'minigame-feedback';
        feedbackDiv.style.textAlign = 'center';
        feedbackDiv.style.fontSize = '18px';
        feedbackDiv.style.fontWeight = 'bold';
        feedbackDiv.style.margin = '20px 0';
        feedbackDiv.style.padding = '15px';
        feedbackDiv.style.borderRadius = '8px';
        
        const contentDiv = document.getElementById('story-content');
        contentDiv.appendChild(feedbackDiv);
    }
    
    if (isCorrect) {
        // Success!
        buttonElement.style.backgroundColor = '#28a745'; // Green
        buttonElement.style.color = 'white';
        
        feedbackDiv.textContent = 'Correct! Capability Evals completed.';
        feedbackDiv.style.backgroundColor = '#d4edda';
        feedbackDiv.style.color = '#155724';
        feedbackDiv.style.border = '1px solid #c3e6cb';
        
        // Complete the eval after a delay
        setTimeout(() => {
            gameState.evalsBuilt.capability = true;
            gameState.currentMinigame = null;
            gameState.currentPage = '2026';
            showPage('2026');
        }, 2000);
        
    } else {
        // Failure - highlight correct answer and show error
        buttonElement.style.backgroundColor = '#dc3545'; // Red
        buttonElement.style.color = 'white';
        
        // Find and highlight correct answer button
        allButtons.forEach(btn => {
            if (btn.textContent === correctAnswer.toFixed(3)) {
                btn.style.backgroundColor = '#28a745'; // Green
                btn.style.color = 'white';
            }
        });
        
        feedbackDiv.innerHTML = `Incorrect. The correct answer was ${correctAnswer.toFixed(3)}.<br>Capability Evals are now on cooldown for 15 days.`;
        feedbackDiv.style.backgroundColor = '#f8d7da';
        feedbackDiv.style.color = '#721c24';
        feedbackDiv.style.border = '1px solid #f5c6cb';
        
        // Set cooldown and return after delay
        setTimeout(() => {
            gameState.capabilityEvalsCooldown = 15;
            gameState.currentMinigame = null;
            gameState.currentPage = '2026';
            showPage('2026');
        }, 3000);
    }
}

function startForecastingEvalsMinigame() {
    if (gameState.forecastingEvalsCooldown > 0) {
        return; // Should not reach here due to UI checks, but safety check
    }
    
    // Initialize coin flip data with random weighted probability
    const trueProbabilities = [0.5, 0.6, 0.7, 0.8];
    const randomProb = trueProbabilities[Math.floor(Math.random() * trueProbabilities.length)];
    
    gameState.coinFlipData = {
        trueProbability: randomProb,
        heads: 0,
        tails: 0,
        total: 0,
        active: true
    };
    
    gameState.currentMinigame = {
        type: 'forecasting-evals',
        startDate: new Date(gameState.currentDate)
    };
    
    gameState.currentPage = 'forecasting-evals-minigame';
    showPage('forecasting-evals-minigame');
}

function performDailyCoinFlip() {
    if (!gameState.coinFlipData.active) {
        console.log('Coin flip not active');
        return;
    }
    
    for (let i = 0; i < 2; i++) {
        console.log('Performing daily coin flip...');
        const isHeads = Math.random() < gameState.coinFlipData.trueProbability;
        
        if (isHeads) {
            gameState.coinFlipData.heads++;
        } else {
            gameState.coinFlipData.tails++;
        }
        gameState.coinFlipData.total++;
        
        console.log(`Coin flip result: ${isHeads ? 'Heads' : 'Tails'}, Total: ${gameState.coinFlipData.total}`);
    }
    
    // Update the display if on the forecasting page
    if (gameState.currentPage === 'forecasting-evals-minigame') {
        console.log('Updating forecasting display...');
        updateForecastingMinigameDisplay();
    } else {
        console.log(`Not on forecasting page, current page: ${gameState.currentPage}`);
    }
}

function updateForecastingMinigameDisplay() {
    // Update just the content of the forecasting page without recreating buttons
    const contentDiv = document.getElementById('story-content');
    if (contentDiv) {
        const coinData = gameState.coinFlipData;
        const percentage = coinData.total > 0 ? ((coinData.heads / coinData.total) * 100).toFixed(1) : '0.0';
        
        const newContent = `<h2>Forecasting Evals</h2><p><div style="text-align: center;">
            <p>A weighted coin has been flipped daily. Estimate the true probability of heads:</p>
            <div style="background-color: #f9f9f9; border: 2px solid #333; border-radius: 8px; padding: 20px; margin: 20px 0; display: inline-block;">
                <h3>Coin Flip Results</h3>
                <div style="font-size: 18px; margin: 10px 0;">
                    <strong>Heads:</strong> ${coinData.heads}<br>
                    <strong>Tails:</strong> ${coinData.tails}<br>
                    <strong>Total Flips:</strong> ${coinData.total}<br>
                    <strong>Sample %:</strong> ${percentage}%
                </div>
            </div>
            <p>What is the true probability of heads for this coin?</p>
        </div></p>`;
        
        contentDiv.innerHTML = newContent;
    }
}

function submitForecastingEvalsAnswer(selectedPercentage, buttonElement) {
    const trueProbability = gameState.coinFlipData.trueProbability;
    const correctPercentage = trueProbability * 100;
    const isCorrect = Math.abs(selectedPercentage - correctPercentage) < 0.1;
    
    // Stop coin flipping
    gameState.coinFlipData.active = false;
    
    // Disable all buttons
    const allButtons = document.querySelectorAll('#buttons .button');
    allButtons.forEach(btn => {
        if (!btn.textContent.includes('Back to Game')) {
            btn.disabled = true;
            btn.style.cursor = 'default';
        }
    });
    
    // Get or create feedback div
    let feedbackDiv = document.getElementById('minigame-feedback');
    if (!feedbackDiv) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'minigame-feedback';
        feedbackDiv.style.textAlign = 'center';
        feedbackDiv.style.fontSize = '18px';
        feedbackDiv.style.fontWeight = 'bold';
        feedbackDiv.style.margin = '20px 0';
        feedbackDiv.style.padding = '15px';
        feedbackDiv.style.borderRadius = '8px';
        
        const contentDiv = document.getElementById('story-content');
        contentDiv.appendChild(feedbackDiv);
    }
    
    if (isCorrect) {
        // Success!
        buttonElement.style.backgroundColor = '#28a745'; // Green
        buttonElement.style.color = 'white';
        
        feedbackDiv.textContent = 'Correct! Forecasting Evals completed.';
        feedbackDiv.style.backgroundColor = '#d4edda';
        feedbackDiv.style.color = '#155724';
        feedbackDiv.style.border = '1px solid #c3e6cb';
        
        // Complete the eval after a delay
        setTimeout(() => {
            gameState.evalsBuilt.forecasting = true;
            gameState.currentMinigame = null;
            gameState.currentPage = '2026';
            updateForecastingDisplay(); // This function is in game-core.js
            showPage('2026');
        }, 2000);
        
    } else {
        // Failure - highlight correct answer and show error
        buttonElement.style.backgroundColor = '#dc3545'; // Red
        buttonElement.style.color = 'white';
        
        // Find and highlight correct answer button
        allButtons.forEach(btn => {
            if (btn.textContent === `${correctPercentage}%`) {
                btn.style.backgroundColor = '#28a745'; // Green
                btn.style.color = 'white';
            }
        });
        
        feedbackDiv.innerHTML = `Incorrect. The correct answer was ${correctPercentage}%.<br>Forecasting Evals are now on cooldown for 15 days.`;
        feedbackDiv.style.backgroundColor = '#f8d7da';
        feedbackDiv.style.color = '#721c24';
        feedbackDiv.style.border = '1px solid #f5c6cb';
        
        // Set cooldown and return after delay
        setTimeout(() => {
            gameState.forecastingEvalsCooldown = 15;
            gameState.currentMinigame = null;
            gameState.currentPage = '2026';
            showPage('2026');
        }, 3000);
    }
}