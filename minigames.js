// Minigame functions for the AI Timeline Game

// Generic minigame starter - avoid circular dependency by using direct function calls
function startMinigame(type) {
    switch (type) {
        case 'capability-evals':
            startCapabilityEvalsMinigame();
            break;
        case 'alignment-research':
            startAlignmentMinigame();
            break;
        case 'forecasting':
            startForecastingEvalsMinigame();
            break;
        default:
            console.error(`Unknown minigame type: ${type}`);
    }
}

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

// Alignment Minigame: Blue vs Red circle area coverage
function startAlignmentMinigame() {
    gameState.currentMinigame = {
        type: 'alignment-research',
        dotsData: {
            circles: [],
            gameTime: 15000, // 15 seconds
            gameActive: true,
            gameStartTime: Date.now(),
            lastSpawnTime: Date.now(),
            spawnInterval: 500 // Average 0.5 seconds between spawns
        }
    };
    
    gameState.currentPage = 'alignment-minigame';
    showPage('alignment-minigame');
}

function updateAlignmentMinigame() {
    const minigame = gameState.currentMinigame;
    if (!minigame || minigame.type !== 'alignment-research' || !minigame.dotsData.gameActive) return;
    
    const dotsData = minigame.dotsData;
    const currentTime = Date.now();
    const gameCanvas = document.getElementById('alignment-canvas');
    if (!gameCanvas) return;
    
    const ctx = gameCanvas.getContext('2d');
    
    // Clear canvas to black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Check if game time is up
    if (currentTime - dotsData.gameStartTime > dotsData.gameTime) {
        endAlignmentMinigame();
        return;
    }
    
    // Spawn new circles at random intervals (exponential distribution)
    if (currentTime - dotsData.lastSpawnTime > getNextSpawnDelay(dotsData.spawnInterval)) {
        spawnAlignmentCircle();
        dotsData.lastSpawnTime = currentTime;
    }
    
    // Update and draw all circles (in order, so later ones overlap earlier ones)
    dotsData.circles.forEach(circle => {
        let radius;
        
        if (circle.stopped) {
            // Circle was clicked - keep it at the size when it was stopped
            const stoppedAge = (circle.stoppedAt - circle.spawnTime) / 1000;
            radius = stoppedAge * circle.growthRate;
        } else {
            // Circle is still growing
            const age = (currentTime - circle.spawnTime) / 1000; // Age in seconds
            radius = age * circle.growthRate; // pixels per second
        }
        
        // Draw circle
        ctx.fillStyle = circle.color;
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Update circle's current radius for scoring
        circle.currentRadius = radius;
    });
    
    // Continue animation
    if (dotsData.gameActive) {
        requestAnimationFrame(updateAlignmentMinigame);
    }
}

function getNextSpawnDelay(averageInterval) {
    // Exponential distribution for random intervals
    // Returns delay in milliseconds
    return -Math.log(Math.random()) * averageInterval;
}

function spawnAlignmentCircle() {
    const dotsData = gameState.currentMinigame.dotsData;
    const canvas = document.getElementById('alignment-canvas');
    
    // Randomly choose blue or red (50/50)
    const isBlue = Math.random() < 0.5;
    
    const circle = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        spawnTime: Date.now(),
        color: isBlue ? 'blue' : 'red',
        growthRate: isBlue ? 20 : 100, // pixels per second
        currentRadius: 0
    };
    
    dotsData.circles.push(circle);
}

function clickAlignmentCanvas(event) {
    const minigame = gameState.currentMinigame;
    if (!minigame || minigame.type !== 'alignment-research' || !minigame.dotsData.gameActive) return;
    
    const canvas = document.getElementById('alignment-canvas');
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const dotsData = minigame.dotsData;
    
    // Check if click hit any circles (check from newest to oldest so top circles are prioritized)
    for (let i = dotsData.circles.length - 1; i >= 0; i--) {
        const circle = dotsData.circles[i];
        
        // Skip if circle is already stopped
        if (circle.stopped) continue;
        
        const distance = Math.sqrt((clickX - circle.x) ** 2 + (clickY - circle.y) ** 2);
        
        if (distance <= circle.currentRadius) {
            // Hit! Stop this circle from growing
            circle.stopped = true;
            circle.stoppedAt = Date.now();
            break; // Only stop one circle per click
        }
    }
}

function endAlignmentMinigame() {
    const minigame = gameState.currentMinigame;
    if (!minigame) return;
    
    minigame.dotsData.gameActive = false;
    
    // Calculate blue area percentage
    const canvas = document.getElementById('alignment-canvas');
    const ctx = canvas.getContext('2d');
    
    // Sample the canvas to determine blue area percentage
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let bluePixels = 0;
    let totalPixels = 0;
    
    // Sample every 4th pixel for performance (can adjust for accuracy)
    for (let i = 0; i < pixels.length; i += 16) { // RGBA = 4 bytes, so i += 16 samples every 4th pixel
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        totalPixels++;
        
        // Check if pixel is blue (blue = 0, 0, 255; black = 0, 0, 0; red = 255, 0, 0)
        if (b > 200 && r < 50 && g < 50) {
            bluePixels++;
        }
    }
    
    const bluePercentage = totalPixels > 0 ? (bluePixels / totalPixels) * 100 : 0;
    const success = bluePercentage >= 50; // Success if 50% or more blue
    
    // Create feedback
    let feedbackDiv = document.getElementById('minigame-feedback');
    if (!feedbackDiv) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'minigame-feedback';
        feedbackDiv.style.cssText = `
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
        `;
        document.getElementById('story-content').appendChild(feedbackDiv);
    }
    
    if (success) {
        feedbackDiv.innerHTML = `Success! Blue coverage: ${bluePercentage.toFixed(1)}%<br>Alignment Research completed.`;
        feedbackDiv.style.backgroundColor = '#d4edda';
        feedbackDiv.style.color = '#155724';
        feedbackDiv.style.border = '1px solid #c3e6cb';
        
        setTimeout(() => {
            gameState.evalsBuilt.alignment = true;
            gameState.currentMinigame = null;
            gameState.currentPage = '2026';
            showPage('2026');
        }, 2000);
    } else {
        feedbackDiv.innerHTML = `Failed! Blue coverage: ${bluePercentage.toFixed(1)}%<br>Alignment Research is now on cooldown for 15 days.`;
        feedbackDiv.style.backgroundColor = '#f8d7da';
        feedbackDiv.style.color = '#721c24';
        feedbackDiv.style.border = '1px solid #f5c6cb';
        
        setTimeout(() => {
            gameState.alignmentEvalsCooldown = 15;
            gameState.currentMinigame = null;
            gameState.currentPage = '2026';
            showPage('2026');
        }, 3000);
    }
}

// Make functions globally accessible
window.startMinigame = startMinigame;
window.clickAlignmentCanvas = clickAlignmentCanvas;