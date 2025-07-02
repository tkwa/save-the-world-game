// Minigame functions for the AI Timeline Game
import { showPage } from './game-core.js';

/* global alert, updateForecastingDisplay */

// Generic minigame starter - dispatches to specific minigame functions
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

function _submitCapabilityEvalsAnswer(selectedCorrelation, buttonElement) {
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

function _performDailyCoinFlip() {
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

function _submitForecastingEvalsAnswer(selectedPercentage, buttonElement) {
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

// Helper function for exponential distribution
function getNextSpawnDelay(averageInterval) {
    // Exponential distribution for random intervals
    // Returns delay in milliseconds
    return -Math.log(Math.random()) * averageInterval;
}

// Helper function to calculate radius with slowdown after 120px
function calculateRadiusWithSlowdown(ageSeconds, growthRate) {
    const slowdownThreshold = 120; // pixels
    const timeToReachThreshold = slowdownThreshold / growthRate;
    
    if (ageSeconds <= timeToReachThreshold) {
        // Normal growth up to 120px
        return ageSeconds * growthRate;
    } else {
        // After 120px, grow at half rate
        const remainingTime = ageSeconds - timeToReachThreshold;
        const slowGrowthRate = growthRate / 2;
        return slowdownThreshold + (remainingTime * slowGrowthRate);
    }
}

function drawStartButton(ctx, canvas) {
    // Draw start button in center of canvas
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = (canvas.width - buttonWidth) / 2;
    const buttonY = (canvas.height - buttonHeight) / 2;
    
    // Draw button background
    ctx.fillStyle = '#0066a2';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Draw button border
    ctx.strokeStyle = '#66b3ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Draw button text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px "Courier New"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('START GAME', canvas.width / 2, canvas.height / 2);
    
    // Store button coordinates for click detection
    gameState.currentMinigame.startButton = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
}

function startAlignmentGame() {
    const minigame = gameState.currentMinigame;
    if (!minigame || minigame.type !== 'alignment-research') return;
    
    const dotsData = minigame.dotsData;
    const currentTime = Date.now();
    
    // Initialize game state
    dotsData.gameStarted = true;
    dotsData.gameActive = true;
    dotsData.gameStartTime = currentTime;
    dotsData.lastSpawnTime = currentTime;
    dotsData.nextSpawnTime = currentTime + getNextSpawnDelay(dotsData.spawnInterval);
    
    // Clear the start button reference
    delete minigame.startButton;
}

// Alignment Minigame: Blue vs Red circle area coverage
function startAlignmentMinigame() {
    gameState.currentMinigame = {
        type: 'alignment-research',
        dotsData: {
            circles: [],
            gameTime: 12000, // 12 seconds
            gameActive: false, // Don't start immediately
            gameStarted: false, // Track if game has been started
            gameStartTime: null,
            lastSpawnTime: null,
            nextSpawnTime: null,
            spawnInterval: 187, // Average 0.187 seconds between spawns (~80 total circles, ~20 red)
            percentageHistory: [] // Track blue/red percentages over time
        }
    };
    
    gameState.currentPage = 'alignment-minigame';
    showPage('alignment-minigame');
}

function updateAlignmentMinigame() {
    const minigame = gameState.currentMinigame;
    if (!minigame || minigame.type !== 'alignment-research') return;
    
    const dotsData = minigame.dotsData;
    const gameCanvas = document.getElementById('alignment-canvas');
    if (!gameCanvas) return;
    
    const ctx = gameCanvas.getContext('2d');
    
    // Clear canvas to black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // If game hasn't started, show start button and continue animation loop
    if (!dotsData.gameStarted) {
        drawStartButton(ctx, gameCanvas);
        requestAnimationFrame(updateAlignmentMinigame);
        return;
    }
    
    // If game is not active (ended), don't continue
    if (!dotsData.gameActive) return;
    
    const currentTime = Date.now();
    
    // Check if game time is up
    if (currentTime - dotsData.gameStartTime > dotsData.gameTime) {
        endAlignmentMinigame();
        return;
    }
    
    // Spawn new circles at scheduled times
    if (currentTime >= dotsData.nextSpawnTime) {
        spawnAlignmentCircle();
        dotsData.lastSpawnTime = currentTime;
        dotsData.nextSpawnTime = currentTime + getNextSpawnDelay(dotsData.spawnInterval);
    }
    
    // Separate circles into layers for proper z-ordering
    const inactiveCircles = [];
    const activeRedCircles = [];
    
    dotsData.circles.forEach(circle => {
        if (circle.color === 'red' && !circle.stopped) {
            activeRedCircles.push(circle);
        } else {
            inactiveCircles.push(circle);
        }
    });
    
    // Sort inactive layer: blues by spawn time, inactive reds by click time
    inactiveCircles.sort((a, b) => {
        const aTime = a.color === 'blue' ? a.spawnTime : (a.stoppedAt || a.spawnTime);
        const bTime = b.color === 'blue' ? b.spawnTime : (b.stoppedAt || b.spawnTime);
        return aTime - bTime;
    });
    
    // Draw inactive layer first, then active reds on top
    [...inactiveCircles, ...activeRedCircles].forEach(circle => {
        let radius;
        
        if (circle.stopped) {
            // Circle was clicked - keep it at the size when it was stopped
            const stoppedAge = (circle.stoppedAt - circle.spawnTime) / 1000;
            radius = Math.max(0, Math.min(circle.maxRadius, calculateRadiusWithSlowdown(stoppedAge, circle.growthRate)));
        } else {
            // Circle is still growing
            const age = (currentTime - circle.spawnTime) / 1000; // Age in seconds
            radius = Math.max(0, Math.min(circle.maxRadius, calculateRadiusWithSlowdown(age, circle.growthRate)));
            
            // Update physics for active circles
            updateCirclePhysics(circle, currentTime, gameCanvas);
        }
        
        // Skip circles with zero radius (just spawned or timing issues)
        if (radius <= 0) return;
        
        // Check if blue circle has reached max size
        const hasReachedMax = circle.color === 'blue' && radius >= circle.maxRadius;
        
        // Draw circle with appropriate color and border
        if (circle.stopped || hasReachedMax) {
            // Stopped circles and maxed blue circles are darker, no border
            ctx.fillStyle = circle.color === 'blue' ? '#0000AA' : '#AA0000';
        } else {
            // Active circles are lighter
            ctx.fillStyle = circle.color === 'blue' ? '#4444FF' : '#FF4444';
        }
        
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add border for active circles (but not maxed blue circles)
        if (!circle.stopped && !hasReachedMax) {
            // Regular black border for growing circles
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Update circle's current radius for scoring
        circle.currentRadius = radius;
    });
    
    // Update timer and percentage displays
    updateAlignmentUI(dotsData, currentTime);
    
    // Continue animation
    if (dotsData.gameActive) {
        requestAnimationFrame(updateAlignmentMinigame);
    }
}

function updateAlignmentUI(dotsData, currentTime) {
    // Update timer
    const timeLeft = Math.max(0, dotsData.gameTime - (currentTime - dotsData.gameStartTime)) / 1000;
    const timerElement = document.getElementById('alignment-timer');
    if (timerElement) {
        timerElement.textContent = timeLeft.toFixed(1);
    }
    
    // Calculate current blue and red percentages
    const canvas = document.getElementById('alignment-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let bluePixels = 0;
        let redPixels = 0;
        let totalPixels = 0;
        
        // Sample every 16th pixel for performance during live updates
        for (let i = 0; i < pixels.length; i += 64) { // 16 pixels * 4 bytes = 64
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            
            totalPixels++;
            
            // Check if pixel is blue (both light and dark blue)
            if (b > 150 && r < 100 && g < 100) {
                bluePixels++;
            }
            // Check if pixel is red (both light and dark red)
            else if (r > 150 && g < 100 && b < 100) {
                redPixels++;
            }
        }
        
        const bluePercentage = totalPixels > 0 ? (bluePixels / totalPixels) * 100 : 0;
        const redPercentage = totalPixels > 0 ? (redPixels / totalPixels) * 100 : 0;
        const blackPercentage = 100 - bluePercentage - redPercentage;
        
        // Record data point every ~0.1 seconds for smooth graph
        const gameElapsed = (currentTime - dotsData.gameStartTime) / 1000;
        const lastRecorded = dotsData.percentageHistory.length > 0 ? 
            dotsData.percentageHistory[dotsData.percentageHistory.length - 1].time : -1;
        
        if (gameElapsed - lastRecorded >= 0.1) {
            dotsData.percentageHistory.push({
                time: gameElapsed,
                blue: bluePercentage / 100,
                red: redPercentage / 100,
                black: blackPercentage / 100
            });
        }
        
        const percentageElement = document.getElementById('alignment-percentage');
        if (percentageElement) {
            percentageElement.textContent = bluePercentage.toFixed(1);
        }
    }
}

function updateCirclePhysics(circle, currentTime, canvas) {
    // Check if blue circle has reached max size - if so, stop moving
    if (circle.color === 'blue') {
        const age = (currentTime - circle.spawnTime) / 1000;
        const currentRadius = Math.min(circle.maxRadius, calculateRadiusWithSlowdown(age, circle.growthRate));
        if (currentRadius >= circle.maxRadius) {
            // Stop all movement for maxed blue circles
            circle.vx = 0;
            circle.vy = 0;
            circle.ax = 0;
            circle.ay = 0;
            return;
        }
    }
    
    const deltaTime = 1/60; // Assume 60fps for smooth physics
    
    // Change direction every second
    if (currentTime - circle.lastDirectionChange > 1000) {
        // Random direction (angle in radians)
        const angle = Math.random() * 2 * Math.PI;
        // Red circles have 1.5x acceleration
        const baseAcceleration = 0.2 * canvas.width; // 0.2 screenwidth per second per second
        const accelerationMagnitude = circle.color === 'red' ? baseAcceleration * 1.5 : baseAcceleration;
        
        circle.ax = Math.cos(angle) * accelerationMagnitude;
        circle.ay = Math.sin(angle) * accelerationMagnitude;
        circle.lastDirectionChange = currentTime;
    }
    
    // Update velocity with acceleration
    circle.vx += circle.ax * deltaTime;
    circle.vy += circle.ay * deltaTime;
    
    // Apply velocity cap for red circles (0.5 screenwidth/second)
    if (circle.color === 'red') {
        const maxSpeed = 0.5 * canvas.width;
        const currentSpeed = Math.sqrt(circle.vx * circle.vx + circle.vy * circle.vy);
        if (currentSpeed > maxSpeed) {
            const speedRatio = maxSpeed / currentSpeed;
            circle.vx *= speedRatio;
            circle.vy *= speedRatio;
        }
    }
    
    // Update position with velocity
    circle.x += circle.vx * deltaTime;
    circle.y += circle.vy * deltaTime;
    
    // Bounce off walls when center reaches boundary
    if (circle.x <= 0 || circle.x >= canvas.width) {
        circle.vx = -circle.vx;
        circle.x = Math.max(0, Math.min(canvas.width, circle.x));
    }
    if (circle.y <= 0 || circle.y >= canvas.height) {
        circle.vy = -circle.vy;
        circle.y = Math.max(0, Math.min(canvas.height, circle.y));
    }
}

function spawnAlignmentCircle() {
    const dotsData = gameState.currentMinigame.dotsData;
    const canvas = document.getElementById('alignment-canvas');
    
    // 1.8x as many blue circles as red (64.3% blue, 35.7% red)
    const isBlue = Math.random() < 0.643;
    
    // Random initial velocity - red circles start faster
    const initialSpeed = isBlue ? 
        Math.random() * 100 + 50 : // Blue: 50-150 pixels/second
        Math.random() * 100 + 120; // Red: 120-220 pixels/second
    const initialAngle = Math.random() * 2 * Math.PI;
    
    const circle = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: Math.cos(initialAngle) * initialSpeed, // velocity x
        vy: Math.sin(initialAngle) * initialSpeed, // velocity y
        ax: 0, // acceleration x
        ay: 0, // acceleration y
        spawnTime: Date.now(),
        lastDirectionChange: Date.now(),
        color: isBlue ? 'blue' : 'red',
        growthRate: isBlue ? 35 : 80, // blue: 35px/s, red: 80px/s
        maxRadius: isBlue ? 140 : Infinity, // blue circles max at 140px
        currentRadius: 0,
        stopped: false
    };
    
    dotsData.circles.push(circle);
}

function clickAlignmentCanvas(event) {
    const minigame = gameState.currentMinigame;
    if (!minigame || minigame.type !== 'alignment-research') return;
    
    const canvas = document.getElementById('alignment-canvas');
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Check if game hasn't started and click is on start button
    if (!minigame.dotsData.gameStarted && minigame.startButton) {
        const btn = minigame.startButton;
        if (clickX >= btn.x && clickX <= btn.x + btn.width &&
            clickY >= btn.y && clickY <= btn.y + btn.height) {
            startAlignmentGame();
            return;
        }
        return; // Don't process other clicks if game hasn't started
    }
    
    // Game must be active for circle clicking
    if (!minigame.dotsData.gameActive) return;
    
    const dotsData = minigame.dotsData;
    
    // Check for circle hits in visual front-to-back order (same as rendering order)
    // Separate circles into layers for proper click detection
    const inactiveCircles = [];
    const activeRedCircles = [];
    
    dotsData.circles.forEach(circle => {
        if (circle.color === 'red' && !circle.stopped) {
            activeRedCircles.push(circle);
        } else {
            inactiveCircles.push(circle);
        }
    });
    
    // Sort inactive layer: blues by spawn time, inactive reds by click time
    inactiveCircles.sort((a, b) => {
        const aTime = a.color === 'blue' ? a.spawnTime : (a.stoppedAt || a.spawnTime);
        const bTime = b.color === 'blue' ? b.spawnTime : (b.stoppedAt || b.spawnTime);
        return aTime - bTime;
    });
    
    // Check from front to back: active reds first (reverse order), then inactive layer (reverse order)
    const allCirclesBackToFront = [...inactiveCircles, ...activeRedCircles].reverse();
    
    for (const circle of allCirclesBackToFront) {
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

function drawFinalFrame() {
    const minigame = gameState.currentMinigame;
    if (!minigame) return;
    
    const dotsData = minigame.dotsData;
    const gameCanvas = document.getElementById('alignment-canvas');
    if (!gameCanvas) return;
    
    const ctx = gameCanvas.getContext('2d');
    
    // Clear canvas to black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Separate circles into layers for proper z-ordering
    const inactiveCircles = [];
    const activeRedCircles = [];
    
    dotsData.circles.forEach(circle => {
        if (circle.color === 'red' && !circle.stopped) {
            activeRedCircles.push(circle);
        } else {
            inactiveCircles.push(circle);
        }
    });
    
    // Sort inactive layer: blues by spawn time, inactive reds by click time
    inactiveCircles.sort((a, b) => {
        const aTime = a.color === 'blue' ? a.spawnTime : (a.stoppedAt || a.spawnTime);
        const bTime = b.color === 'blue' ? b.spawnTime : (b.stoppedAt || b.spawnTime);
        return aTime - bTime;
    });
    
    // Draw all circles in their final state (inactive layer first, then active reds)
    [...inactiveCircles, ...activeRedCircles].forEach(circle => {
        let radius;
        
        if (circle.stopped) {
            // Circle was clicked - keep it at the size when it was stopped
            const stoppedAge = (circle.stoppedAt - circle.spawnTime) / 1000;
            radius = Math.max(0, Math.min(circle.maxRadius, calculateRadiusWithSlowdown(stoppedAge, circle.growthRate)));
        } else {
            // Circle grew for the full game duration
            const gameEndTime = dotsData.gameStartTime + dotsData.gameTime;
            const finalAge = (gameEndTime - circle.spawnTime) / 1000;
            radius = Math.max(0, Math.min(circle.maxRadius, calculateRadiusWithSlowdown(finalAge, circle.growthRate)));
        }
        
        // Skip circles with zero radius
        if (radius <= 0) return;
        
        // Check if blue circle has reached max size
        const hasReachedMax = circle.color === 'blue' && radius >= circle.maxRadius;
        
        // Draw circle with appropriate color and border
        if (circle.stopped || hasReachedMax) {
            // Stopped circles and maxed blue circles are darker, no border
            ctx.fillStyle = circle.color === 'blue' ? '#0000AA' : '#AA0000';
        } else {
            // Active circles are lighter
            ctx.fillStyle = circle.color === 'blue' ? '#4444FF' : '#FF4444';
        }
        
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add border for active circles (but not maxed blue circles)
        if (!circle.stopped && !hasReachedMax) {
            // Regular black border for growing circles
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

function endAlignmentMinigame() {
    const minigame = gameState.currentMinigame;
    if (!minigame) return;
    
    minigame.dotsData.gameActive = false;
    
    // Draw final frame with all circles frozen
    drawFinalFrame();
    
    // Calculate blue area percentage
    const canvas = document.getElementById('alignment-canvas');
    const ctx = canvas.getContext('2d');
    
    // Sample the canvas to determine blue area percentage
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let bluePixels = 0;
    
    // Check every pixel (RGBA = 4 bytes per pixel)
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // Check if pixel is not black (background)
        if (r > 10 || g > 10 || b > 10) {
            _totalNonBlackPixels++;
            
            // Check if pixel is blue (both light and dark blue)
            // Light blue: #4444FF (68, 68, 255), Dark blue: #0000AA (0, 0, 170)
            if (b > 150 && r < 100 && g < 100) {
                bluePixels++;
            }
            // Check if pixel is red (both light and dark red)  
            // Light red: #FF4444 (255, 68, 68), Dark red: #AA0000 (170, 0, 0)
            else if (r > 150 && g < 100 && b < 100) {
                _redPixels++;
            }
        }
    }
    
    const totalPixels = (canvas.width * canvas.height);
    const bluePercentage = totalPixels > 0 ? (bluePixels / totalPixels) * 100 : 0;
    
    // Update max score if this is better
    if (!gameState.alignmentMaxScore || bluePercentage > gameState.alignmentMaxScore) {
        gameState.alignmentMaxScore = bluePercentage;
    }
    
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
    
    feedbackDiv.innerHTML = `
        Alignment (Blue coverage): ${bluePercentage.toFixed(1)}%<br>
        High score: ${gameState.alignmentMaxScore.toFixed(1)}%<br>
        <div style="margin: 15px 0;">
            <div style="font-weight: bold; margin-bottom: 10px;">Training Loss Over Time</div>
            <div id="graph-container"></div>
        </div>
        <button class="button" onclick="gameState.currentMinigame = null; gameState.currentPage = 'main-game'; showPage('main-game');" style="margin-top: 10px;">Continue</button>
    `;
    
    // Create the line graph and insert it directly
    console.log('Percentage history length:', minigame.dotsData.percentageHistory.length);
    if (minigame.dotsData.percentageHistory.length > 0) {
        console.log('Sample data point:', minigame.dotsData.percentageHistory[0]);
    }
    const graphCanvas = createAlignmentGraph(minigame.dotsData.percentageHistory);
    const graphContainer = document.getElementById('graph-container');
    if (graphContainer) {
        graphContainer.appendChild(graphCanvas);
    }
    feedbackDiv.style.backgroundColor = '#353535';
    feedbackDiv.style.color = '#e0e0e0';
    feedbackDiv.style.border = '1px solid #555';
}

function createAlignmentGraph(percentageHistory) {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    canvas.style.border = '1px solid #555';
    canvas.style.backgroundColor = 'white';
    
    const ctx = canvas.getContext('2d');
    
    // Set up the graph area
    const padding = 40;
    const graphWidth = canvas.width - 2 * padding;
    const graphHeight = canvas.height - 2 * padding;
    
    // Clear background - ensure it's actually white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (percentageHistory.length === 0) {
        // Draw empty graph with message
        ctx.fillStyle = '#000000';
        ctx.font = '16px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText('No data collected', canvas.width / 2, canvas.height / 2);
        return canvas;
    }
    
    // Draw axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Y-axis
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    // X-axis
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Add axis labels
    ctx.fillStyle = '#000000';
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'center';
    
    // Y-axis labels (0 to 1)
    ctx.textAlign = 'right';
    ctx.fillText('1.0', padding - 5, padding + 5);
    ctx.fillText('0.5', padding - 5, padding + graphHeight / 2 + 5);
    ctx.fillText('0.0', padding - 5, canvas.height - padding + 5);
    
    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillText('Training step', canvas.width / 2, canvas.height - 5);
    
    // X-axis tick marks with training step numbers
    const maxTime = Math.max(...percentageHistory.map(p => p.time));
    const maxSteps = maxTime * 100; // Convert to training steps
    const numTicks = 5;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    for (let i = 0; i <= numTicks; i++) {
        const x = padding + (i / numTicks) * graphWidth;
        const steps = Math.round((i / numTicks) * maxSteps);
        
        // Draw tick marks
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - padding);
        ctx.lineTo(x, canvas.height - padding + 5);
        ctx.stroke();
        
        // Draw step numbers
        ctx.fillText(steps.toString(), x, canvas.height - padding + 18);
    }
    
    // Draw legend
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.fillRect(canvas.width - 120, padding, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillText('Loss', canvas.width - 105, padding + 10);
    
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(canvas.width - 120, padding + 20, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillText('Misalignment', canvas.width - 105, padding + 30);
    
    ctx.fillStyle = '#4444ff';
    ctx.fillRect(canvas.width - 120, padding + 40, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillText('Alignment', canvas.width - 105, padding + 50);
    
    // Helper function to convert data coordinates to canvas coordinates
    const dataToCanvas = (time, percentage) => {
        const x = padding + (time / maxTime) * graphWidth;
        const y = canvas.height - padding - (percentage * graphHeight);
        return { x, y };
    };
    
    // Draw loss line (black percentage)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < percentageHistory.length; i++) {
        const point = dataToCanvas(percentageHistory[i].time, percentageHistory[i].black);
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    }
    ctx.stroke();
    
    // Draw misalignment line (red percentage)
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < percentageHistory.length; i++) {
        const point = dataToCanvas(percentageHistory[i].time, percentageHistory[i].red);
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    }
    ctx.stroke();
    
    // Draw alignment line (blue percentage)
    ctx.strokeStyle = '#4444ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < percentageHistory.length; i++) {
        const point = dataToCanvas(percentageHistory[i].time, percentageHistory[i].blue);
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    }
    ctx.stroke();
    
    // Add blue circle marker at final alignment value
    if (percentageHistory.length > 0) {
        const finalData = percentageHistory[percentageHistory.length - 1];
        const finalPoint = dataToCanvas(finalData.time, finalData.blue);
        
        ctx.fillStyle = '#4444ff';
        ctx.beginPath();
        ctx.arc(finalPoint.x, finalPoint.y, 4, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    return canvas;
}

// Export functions for ES modules
export {
    startMinigame,
    clickAlignmentCanvas,
    updateAlignmentMinigame,
    startAlignmentGame,
    _submitCapabilityEvalsAnswer as submitCapabilityEvalsAnswer,
    _performDailyCoinFlip as performDailyCoinFlip,
    _submitForecastingEvalsAnswer as submitForecastingEvalsAnswer
};

// Make functions globally accessible
if (typeof window !== 'undefined') {
    window.startMinigame = startMinigame;
    window.clickAlignmentCanvas = clickAlignmentCanvas;
    window.updateAlignmentMinigame = updateAlignmentMinigame;
    window.startAlignmentGame = startAlignmentGame;
}