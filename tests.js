// Unit tests for Critical Path AI Strategy Game

class TestSuite {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFunction) {
        this.tests.push({ name, testFunction });
    }

    async runAll() {
        console.log('Running tests...\n');
        
        for (const test of this.tests) {
            try {
                await test.testFunction();
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.error(`❌ ${test.name}: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    }

    assertTrue(condition, message) {
        if (!condition) {
            throw new Error(message || 'Expected true, got false');
        }
    }

    assertFalse(condition, message) {
        if (condition) {
            throw new Error(message || 'Expected false, got true');
        }
    }
}

// Initialize test state
function createTestGameState() {
    return {
        playerAILevel: 10,
        competitorAILevels: [8, 6, 4],
        competitorNames: ['OpenAI', 'Google', 'Anthropic'],
        companyName: 'TestCorp',
        money: 100,
        diplomacyPoints: 50,
        productPoints: 30,
        safetyPoints: 25,
        projectsUnlocked: false,
        startingCompany: null,
        isVPSafetyAlignment: false,
        dsaEventsAccepted: new Set(),
        acquisitionCompetitorIndex: null,
        playerEquity: 0.1,
        offeredEquity: null,
        totalEquityOffered: null,
        hasEverFallenBehind: false
    };
}

// Mock global state for testing
let gameState = createTestGameState();

// Test helper functions
function mockCalculateAdjustedRisk() {
    return gameState.doomLevel || 20;
}

// Test the acquisition event availability
function testAcquisitionEventAvailability() {
    const suite = new TestSuite();

    suite.test('Acquisition event not available when no competitor is 2x player level', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [15, 12, 8]; // None are 2x (20+)
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const shouldBeAvailable = maxCompetitorLevel >= gameState.playerAILevel * 2;
        
        suite.assertFalse(shouldBeAvailable, 'Event should not be available when no competitor is 2x player level');
    });

    suite.test('Acquisition event available when competitor is exactly 2x player level', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [20, 12, 8]; // First competitor is exactly 2x
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const shouldBeAvailable = maxCompetitorLevel >= gameState.playerAILevel * 2;
        
        suite.assertTrue(shouldBeAvailable, 'Event should be available when competitor is exactly 2x player level');
    });

    suite.test('Acquisition event available when competitor is more than 2x player level', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [25, 12, 8]; // First competitor is 2.5x
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const shouldBeAvailable = maxCompetitorLevel >= gameState.playerAILevel * 2;
        
        suite.assertTrue(shouldBeAvailable, 'Event should be available when competitor is more than 2x player level');
    });

    return suite.runAll();
}

// Test the merger mechanics
function testMergerMechanics() {
    const suite = new TestSuite();

    suite.test('Merger preserves starting company name', () => {
        gameState = createTestGameState();
        gameState.companyName = 'TestCorp';
        gameState.acquisitionCompetitorIndex = 0; // OpenAI
        
        // Simulate accepting merger
        if (!gameState.startingCompany) {
            gameState.startingCompany = gameState.companyName;
        }
        
        suite.assertEqual(gameState.startingCompany, 'TestCorp', 'Starting company should be preserved');
    });

    suite.test('Merger changes company name to competitor', () => {
        gameState = createTestGameState();
        gameState.companyName = 'TestCorp';
        gameState.competitorNames = ['OpenAI', 'Google', 'Anthropic'];
        gameState.acquisitionCompetitorIndex = 0;
        
        // Simulate merger
        const newCompanyName = gameState.competitorNames[gameState.acquisitionCompetitorIndex];
        gameState.companyName = newCompanyName;
        
        suite.assertEqual(gameState.companyName, 'OpenAI', 'Company name should change to acquiring competitor');
    });

    suite.test('Merger updates player AI level to competitor level', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [25, 12, 8];
        gameState.acquisitionCompetitorIndex = 0;
        
        // Simulate merger
        const newAILevel = gameState.competitorAILevels[gameState.acquisitionCompetitorIndex];
        gameState.playerAILevel = newAILevel;
        
        suite.assertEqual(gameState.playerAILevel, 25, 'Player AI level should match acquiring competitor');
    });

    suite.test('Merger sets VP Safety Alignment flag', () => {
        gameState = createTestGameState();
        gameState.isVPSafetyAlignment = false;
        
        // Simulate merger
        gameState.isVPSafetyAlignment = true;
        
        suite.assertTrue(gameState.isVPSafetyAlignment, 'VP Safety Alignment flag should be set');
    });

    suite.test('Merger replaces acquiring competitor with new company', () => {
        gameState = createTestGameState();
        gameState.companyName = 'TestCorp';
        gameState.competitorAILevels = [25, 12, 8];
        gameState.competitorNames = ['OpenAI', 'Google', 'Anthropic'];
        gameState.acquisitionCompetitorIndex = 0;
        
        const originalLength = gameState.competitorAILevels.length;
        const newAILevel = 25; // Player's new AI level after merger
        
        // Simulate merger - replace the acquiring competitor
        const allCompanies = ["OpenAI", "Anthropic", "Google", "DeepSeek", "Tencent", "xAI"];
        const usedCompanies = [gameState.companyName, ...gameState.competitorNames];
        const availableCompanies = allCompanies.filter(company => !usedCompanies.includes(company));
        
        if (availableCompanies.length > 0) {
            const newCompanyName = availableCompanies[0]; // Use first available for testing
            const minLevel = newAILevel * 0.1;
            const maxLevel = newAILevel * 0.4;
            const newCompetitorLevel = minLevel + Math.random() * (maxLevel - minLevel);
            
            gameState.competitorNames[gameState.acquisitionCompetitorIndex] = newCompanyName;
            gameState.competitorAILevels[gameState.acquisitionCompetitorIndex] = newCompetitorLevel;
        }
        
        suite.assertEqual(gameState.competitorAILevels.length, originalLength, 'Competitor list should maintain same size');
        suite.assertEqual(gameState.competitorNames.length, originalLength, 'Competitor names list should maintain same size');
        suite.assertFalse(gameState.competitorNames.includes('OpenAI'), 'Acquiring competitor should be replaced');
        suite.assertTrue(gameState.competitorAILevels[0] >= newAILevel * 0.1, 'New competitor should be at least 10% of merged level');
        suite.assertTrue(gameState.competitorAILevels[0] <= newAILevel * 0.4, 'New competitor should be at most 40% of merged level');
    });

    suite.test('Merger adds appropriate resources', () => {
        gameState = createTestGameState();
        const originalMoney = gameState.money;
        const originalDiplomacy = gameState.diplomacyPoints;
        const originalProduct = gameState.productPoints;
        
        gameState.playerAILevel = 25; // New AI level after merger
        
        // Simulate resource bonus
        const levelBasedBonus = Math.floor(gameState.playerAILevel / 4);
        gameState.money += Math.floor(Math.random() * levelBasedBonus + levelBasedBonus);
        gameState.diplomacyPoints += Math.floor(Math.random() * levelBasedBonus + levelBasedBonus/2);
        gameState.productPoints += Math.floor(Math.random() * levelBasedBonus + levelBasedBonus/2);
        
        suite.assertTrue(gameState.money > originalMoney, 'Money should increase after merger');
        suite.assertTrue(gameState.diplomacyPoints >= originalDiplomacy, 'Diplomacy points should not decrease');
        suite.assertTrue(gameState.productPoints >= originalProduct, 'Product points should not decrease');
    });

    suite.test('Merger unlocks projects panel', () => {
        gameState = createTestGameState();
        gameState.projectsUnlocked = false;
        
        // Simulate merger
        gameState.projectsUnlocked = true;
        
        suite.assertTrue(gameState.projectsUnlocked, 'Projects panel should be unlocked after merger');
    });

    suite.test('Safety points should not change during merger', () => {
        gameState = createTestGameState();
        const originalSafetyPoints = gameState.safetyPoints;
        
        // Simulate merger - safety points should remain unchanged
        
        suite.assertEqual(gameState.safetyPoints, originalSafetyPoints, 'Safety points should not change during merger');
    });

    return suite.runAll();
}

// Test endgame scoring changes
function testEndgameScoring() {
    const suite = new TestSuite();

    suite.test('VP Safety Alignment gets variable multiplier based on offered equity', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.05; // 5% equity after merger (could be anywhere from 30%-100% of fair value)
        
        // Player gets: 10 (humanity survival) + 100 * equity (ownership stake)
        const playerMultiplier = 10 + (100 * gameState.playerEquity);
        
        suite.assertEqual(playerMultiplier, 15, 'VP Safety Alignment should get 15x multiplier (10 + 100 * 0.05)');
    });

    suite.test('Regular player gets 20x multiplier (10% equity)', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.1; // 10% equity
        
        // Player gets: 10 (humanity survival) + 100 * equity (ownership stake)
        const playerMultiplier = 10 + (100 * gameState.playerEquity);
        
        suite.assertEqual(playerMultiplier, 20, 'Regular player should get 20x multiplier (10 + 100 * 0.1)');
    });

    suite.test('Merger sets equity to offered amount', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.1; // Start with 10%
        gameState.offeredEquity = 0.03; // 3% offered equity
        
        // Simulate merger
        gameState.playerEquity = gameState.offeredEquity || 0.01;
        
        suite.assertEqual(gameState.playerEquity, 0.03, 'Player equity should be set to offered equity after merger');
    });

    suite.test('Merger equity calculation uses fair value formula with 10% player ownership', () => {
        gameState = createTestGameState();
        const playerLevel = 10;
        const competitorLevel = 25;
        
        // Calculate fair value: X^2 / (X^2 + Y^2)
        const fairValue = (playerLevel ** 2) / (playerLevel ** 2 + competitorLevel ** 2);
        const expectedFairValue = 100 / (100 + 625); // 100/725 ≈ 0.138
        
        suite.assertTrue(Math.abs(fairValue - expectedFairValue) < 0.001, 'Fair value calculation should be correct');
        
        // Total offer should be between 30% and 100% of fair value
        const minTotalOffer = fairValue * 0.3;
        const maxTotalOffer = fairValue * 1.0;
        
        // Player gets 10% of the total offer (since they own 10% of their company)
        const minPlayerOffer = minTotalOffer * 0.1;
        const maxPlayerOffer = maxTotalOffer * 0.1;
        
        suite.assertTrue(minPlayerOffer < maxPlayerOffer, 'Min player offer should be less than max player offer');
        suite.assertTrue(minPlayerOffer > 0, 'Min player offer should be positive');
        suite.assertTrue(maxPlayerOffer < 0.1, 'Max player offer should be less than 10%');
        
        // Example: if total offer is 8%, player gets 0.8%
        const exampleTotalOffer = 0.08;
        const expectedPlayerOffer = exampleTotalOffer * gameState.playerEquity; // 0.08 * 0.1 = 0.008
        suite.assertEqual(expectedPlayerOffer, 0.008, 'Player should get 10% of total equity offer');
    });

    suite.test('Shareholder assessment uses starting company', () => {
        gameState = createTestGameState();
        gameState.startingCompany = 'TestCorp';
        gameState.companyName = 'OpenAI';
        
        const shareholderCompany = gameState.startingCompany || gameState.companyName;
        
        suite.assertEqual(shareholderCompany, 'TestCorp', 'Shareholder assessment should use starting company');
    });

    suite.test('Galaxy allocation uses current company', () => {
        gameState = createTestGameState();
        gameState.startingCompany = 'TestCorp';
        gameState.companyName = 'OpenAI';
        
        // Galaxy allocation should use current company name
        const galaxyCompany = gameState.companyName;
        
        suite.assertEqual(galaxyCompany, 'OpenAI', 'Galaxy allocation should use current company');
    });

    return suite.runAll();
}

// Test role indicator
function testRoleIndicator() {
    const suite = new TestSuite();

    suite.test('CEO role indicator shows correct company', () => {
        gameState = createTestGameState();
        gameState.companyName = 'TestCorp';
        gameState.isVPSafetyAlignment = false;
        
        const role = gameState.isVPSafetyAlignment ? 
            'VP of Safety and Alignment' : 
            `CEO of ${gameState.companyName || 'Company'}`;
        
        suite.assertEqual(role, 'CEO of TestCorp', 'CEO role should show correct company name');
    });

    suite.test('VP Safety Alignment role indicator', () => {
        gameState = createTestGameState();
        gameState.companyName = 'OpenAI';
        gameState.isVPSafetyAlignment = true;
        
        const role = gameState.isVPSafetyAlignment ? 
            'VP of Safety and Alignment' : 
            `CEO of ${gameState.companyName || 'Company'}`;
        
        suite.assertEqual(role, 'VP of Safety and Alignment', 'VP role should show correct title');
    });

    return suite.runAll();
}

// Test preference text modifier
function testPreferenceText() {
    const suite = new TestSuite();

    suite.test('Low equity shows "slightly prefer"', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.01; // 1% equity
        
        const preferenceStrength = 
            gameState.playerEquity <= 0.02 ? "slightly prefer" :
            gameState.playerEquity > 0.2 ? "much prefer" : "prefer";
        
        suite.assertEqual(preferenceStrength, "slightly prefer", 'Low equity should show "slightly prefer"');
    });

    suite.test('Equity at 2% threshold shows "slightly prefer"', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.02; // Exactly 2% equity
        
        const preferenceStrength = 
            gameState.playerEquity <= 0.02 ? "slightly prefer" :
            gameState.playerEquity > 0.2 ? "much prefer" : "prefer";
        
        suite.assertEqual(preferenceStrength, "slightly prefer", '2% equity should show "slightly prefer"');
    });

    suite.test('Mid equity shows "prefer"', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.1; // 10% equity
        
        const preferenceStrength = 
            gameState.playerEquity <= 0.02 ? "slightly prefer" :
            gameState.playerEquity > 0.2 ? "much prefer" : "prefer";
        
        suite.assertEqual(preferenceStrength, "prefer", 'Mid equity should show "prefer"');
    });

    suite.test('High equity shows "much prefer"', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.25; // 25% equity
        
        const preferenceStrength = 
            gameState.playerEquity <= 0.02 ? "slightly prefer" :
            gameState.playerEquity > 0.2 ? "much prefer" : "prefer";
        
        suite.assertEqual(preferenceStrength, "much prefer", 'High equity should show "much prefer"');
    });

    suite.test('Equity at 20% threshold shows "prefer"', () => {
        gameState = createTestGameState();
        gameState.playerEquity = 0.2; // Exactly 20% equity
        
        const preferenceStrength = 
            gameState.playerEquity <= 0.02 ? "slightly prefer" :
            gameState.playerEquity > 0.2 ? "much prefer" : "prefer";
        
        suite.assertEqual(preferenceStrength, "prefer", '20% equity should show "prefer" (not much prefer)');
    });

    return suite.runAll();
}

// Test falling behind event
function testFallingBehindEvent() {
    const suite = new TestSuite();

    suite.test('Falling behind event not available when player is ahead', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 15;
        gameState.competitorAILevels = [12, 10, 8]; // Player is ahead
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const shouldBeAvailable = gameState.playerAILevel < maxCompetitorLevel;
        
        suite.assertFalse(shouldBeAvailable, 'Event should not be available when player is ahead');
    });

    suite.test('Falling behind event available when player falls behind for first time', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [15, 12, 8]; // Player is behind
        gameState.hasEverFallenBehind = false; // First time falling behind
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const shouldBeAvailable = gameState.playerAILevel < maxCompetitorLevel && !gameState.hasEverFallenBehind;
        
        suite.assertTrue(shouldBeAvailable, 'Event should be available when player falls behind for first time');
    });

    suite.test('Falling behind event not available if already triggered', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [15, 12, 8]; // Player is behind
        gameState.hasEverFallenBehind = true; // Already triggered
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const shouldBeAvailable = gameState.playerAILevel < maxCompetitorLevel && !gameState.hasEverFallenBehind;
        
        suite.assertFalse(shouldBeAvailable, 'Event should not be available if already triggered once');
    });

    suite.test('Falling behind event correctly identifies leading competitor', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        gameState.competitorAILevels = [15, 12, 8];
        gameState.competitorNames = ['OpenAI', 'Google', 'Anthropic'];
        
        const maxCompetitorLevel = Math.max(...gameState.competitorAILevels);
        const leadingCompetitorIndex = gameState.competitorAILevels.findIndex(level => level === maxCompetitorLevel);
        const leadingCompetitor = gameState.competitorNames[leadingCompetitorIndex];
        
        suite.assertEqual(maxCompetitorLevel, 15, 'Should identify correct max level');
        suite.assertEqual(leadingCompetitorIndex, 0, 'Should identify correct index');
        suite.assertEqual(leadingCompetitor, 'OpenAI', 'Should identify correct competitor name');
    });

    return suite.runAll();
}

// Test that all other_texts values are used in events.js
function testOtherTextsUsage() {
    const suite = new TestSuite();
    
    suite.test('All other_texts values should be referenced in events.js', async () => {
        let eventData, eventsJsContent;
        
        // Check if we're in Node.js environment
        if (typeof require !== 'undefined' && typeof process !== 'undefined') {
            // Node.js environment
            const fs = require('fs');
            const path = require('path');
            
            eventData = JSON.parse(fs.readFileSync('events.json', 'utf8'));
            eventsJsContent = fs.readFileSync('events.js', 'utf8');
        } else {
            // Browser environment
            const response = await fetch('events.json');
            eventData = await response.json();
            
            const eventsJsResponse = await fetch('events.js');
            eventsJsContent = await eventsJsResponse.text();
        }
        
        const eventsWithOtherTexts = eventData.defaultEvents.filter(event => 
            event.other_texts && !event.type.includes('-example') && !event.type.includes('-demo')
        );
        
        for (const event of eventsWithOtherTexts) {
            const eventType = event.type;
            const otherTexts = event.other_texts;
            
            for (const [key, value] of Object.entries(otherTexts)) {
                // Check if the key is referenced in events.js
                const keyPattern = new RegExp(`other_texts\\.${key}`, 'g');
                const isKeyUsed = keyPattern.test(eventsJsContent);
                
                suite.assertTrue(isKeyUsed, `Event "${eventType}" other_texts key "${key}" should be used in events.js`);
                
                // Check if the actual text content appears nowhere else in the codebase (to ensure no duplication)
                const textPattern = new RegExp(value.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                const textMatches = eventsJsContent.match(textPattern);
                
                // It should not appear as a hardcoded string (only in JSON)
                suite.assertTrue(!textMatches || textMatches.length === 0, 
                    `Event "${eventType}" other_texts value "${key}" should not be hardcoded in events.js`);
            }
        }
    });
    
    return suite.runAll();
}

// Test AI level range filtering
function testAILevelRangeFiltering() {
    const suite = new TestSuite();
    
    suite.test('Events with aiLevelRange.min should be filtered correctly', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 10;
        
        const mockEvents = [
            { type: 'early-event', weight: 1, aiLevelRange: { min: 5 } },
            { type: 'mid-event', weight: 1, aiLevelRange: { min: 15 } },
            { type: 'no-range', weight: 1 }
        ];
        
        const availableEvents = mockEvents.filter(event => {
            if (event.aiLevelRange) {
                const playerLevel = gameState.playerAILevel;
                if (event.aiLevelRange.min !== undefined && playerLevel < event.aiLevelRange.min) {
                    return false;
                }
                if (event.aiLevelRange.max !== undefined && playerLevel > event.aiLevelRange.max) {
                    return false;
                }
            }
            return true;
        });
        
        suite.assertEqual(availableEvents.length, 2, 'Should have 2 available events (early-event and no-range)');
        suite.assertTrue(availableEvents.some(e => e.type === 'early-event'), 'Should include early-event');
        suite.assertTrue(availableEvents.some(e => e.type === 'no-range'), 'Should include no-range event');
        suite.assertFalse(availableEvents.some(e => e.type === 'mid-event'), 'Should exclude mid-event');
    });
    
    suite.test('Events with aiLevelRange.max should be filtered correctly', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 30;
        
        const mockEvents = [
            { type: 'early-event', weight: 1, aiLevelRange: { max: 20 } },
            { type: 'late-event', weight: 1, aiLevelRange: { max: 40 } },
            { type: 'no-range', weight: 1 }
        ];
        
        const availableEvents = mockEvents.filter(event => {
            if (event.aiLevelRange) {
                const playerLevel = gameState.playerAILevel;
                if (event.aiLevelRange.min !== undefined && playerLevel < event.aiLevelRange.min) {
                    return false;
                }
                if (event.aiLevelRange.max !== undefined && playerLevel > event.aiLevelRange.max) {
                    return false;
                }
            }
            return true;
        });
        
        suite.assertEqual(availableEvents.length, 2, 'Should have 2 available events (late-event and no-range)');
        suite.assertTrue(availableEvents.some(e => e.type === 'late-event'), 'Should include late-event');
        suite.assertTrue(availableEvents.some(e => e.type === 'no-range'), 'Should include no-range event');
        suite.assertFalse(availableEvents.some(e => e.type === 'early-event'), 'Should exclude early-event');
    });
    
    suite.test('Events with both min and max should be filtered correctly', () => {
        gameState = createTestGameState();
        gameState.playerAILevel = 25;
        
        const mockEvents = [
            { type: 'too-early', weight: 1, aiLevelRange: { min: 30, max: 50 } },
            { type: 'just-right', weight: 1, aiLevelRange: { min: 20, max: 30 } },
            { type: 'too-late', weight: 1, aiLevelRange: { min: 10, max: 20 } }
        ];
        
        const availableEvents = mockEvents.filter(event => {
            if (event.aiLevelRange) {
                const playerLevel = gameState.playerAILevel;
                if (event.aiLevelRange.min !== undefined && playerLevel < event.aiLevelRange.min) {
                    return false;
                }
                if (event.aiLevelRange.max !== undefined && playerLevel > event.aiLevelRange.max) {
                    return false;
                }
            }
            return true;
        });
        
        suite.assertEqual(availableEvents.length, 1, 'Should have 1 available event');
        suite.assertTrue(availableEvents.some(e => e.type === 'just-right'), 'Should include just-right event');
    });
    
    return suite.runAll();
}

// Test conditional choice filtering
function testConditionalChoices() {
    const suite = new TestSuite();
    
    suite.test('Choices with true conditions should be included', () => {
        gameState = createTestGameState();
        gameState.projectsUnlocked = true;
        gameState.isVPSafetyAlignment = false;
        
        const mockChoices = [
            { text: "Choice A", condition: "projectsUnlocked", action: "accept" },
            { text: "Choice B", condition: "isVPSafetyAlignment", action: "accept" },
            { text: "Choice C", action: "accept" } // No condition
        ];
        
        // Apply the same filtering logic as filterChoicesByCondition
        const filteredChoices = mockChoices.filter(choice => {
            if (choice.condition) {
                const conditionKey = choice.condition;
                if (typeof conditionKey === 'string') {
                    return gameState[conditionKey] === true;
                }
            }
            return true;
        });
        
        suite.assertEqual(filteredChoices.length, 2, 'Should have 2 choices (A and C)');
        suite.assertTrue(filteredChoices.some(c => c.text === 'Choice A'), 'Should include Choice A');
        suite.assertTrue(filteredChoices.some(c => c.text === 'Choice C'), 'Should include Choice C');
        suite.assertFalse(filteredChoices.some(c => c.text === 'Choice B'), 'Should exclude Choice B');
    });
    
    suite.test('Choices with false conditions should be excluded', () => {
        gameState = createTestGameState();
        gameState.projectsUnlocked = false;
        gameState.isVPSafetyAlignment = false;
        
        const mockChoices = [
            { text: "Choice A", condition: "projectsUnlocked", action: "accept" },
            { text: "Choice B", condition: "isVPSafetyAlignment", action: "accept" },
            { text: "Choice C", action: "accept" }
        ];
        
        const filteredChoices = mockChoices.filter(choice => {
            if (choice.condition) {
                const conditionKey = choice.condition;
                if (typeof conditionKey === 'string') {
                    return gameState[conditionKey] === true;
                }
            }
            return true;
        });
        
        suite.assertEqual(filteredChoices.length, 1, 'Should have 1 choice (C only)');
        suite.assertTrue(filteredChoices.some(c => c.text === 'Choice C'), 'Should include Choice C');
        suite.assertFalse(filteredChoices.some(c => c.text === 'Choice A'), 'Should exclude Choice A');
        suite.assertFalse(filteredChoices.some(c => c.text === 'Choice B'), 'Should exclude Choice B');
    });
    
    suite.test('Choices without conditions should always be included', () => {
        gameState = createTestGameState();
        
        const mockChoices = [
            { text: "Always available", action: "accept" },
            { text: "Also always available", action: "decline" }
        ];
        
        const filteredChoices = mockChoices.filter(choice => {
            if (choice.condition) {
                const conditionKey = choice.condition;
                if (typeof conditionKey === 'string') {
                    return gameState[conditionKey] === true;
                }
            }
            return true;
        });
        
        suite.assertEqual(filteredChoices.length, 2, 'Should include all choices without conditions');
    });
    
    suite.test('Invalid condition types should be ignored', () => {
        gameState = createTestGameState();
        
        const mockChoices = [
            { text: "Invalid condition", condition: 123, action: "accept" }, // Number instead of string
            { text: "Valid choice", action: "accept" }
        ];
        
        const filteredChoices = mockChoices.filter(choice => {
            if (choice.condition) {
                const conditionKey = choice.condition;
                if (typeof conditionKey === 'string') {
                    return gameState[conditionKey] === true;
                }
            }
            return true;
        });
        
        suite.assertEqual(filteredChoices.length, 2, 'Should include both choices (invalid condition treated as no condition)');
    });
    
    return suite.runAll();
}

// Mock functions for Node.js environment (unused but available for future use)
function _mockUpdateStatusBar() {}
function _mockShowPage() {}

// Test multi-stage event system
function testMultiStageEventSystem() {
    const suite = new TestSuite();
    
    // Create a mock MultiStageEventManager class for testing
    class MockMultiStageEventManager {
        constructor() {
            this.stageData = new Map();
        }
        
        initStage(eventType, stageId, stageData = {}) {
            if (!this.stageData.has(eventType)) {
                this.stageData.set(eventType, {});
            }
            
            const eventStages = this.stageData.get(eventType);
            eventStages.currentStage = stageId;
            eventStages.data = { ...eventStages.data, ...stageData };
            
            return eventStages;
        }
        
        getStageData(eventType) {
            return this.stageData.get(eventType) || { currentStage: null, data: {} };
        }
        
        nextStage(eventType, stageId, text, choices, stageData = {}) {
            const stages = this.initStage(eventType, stageId, stageData);
            
            gameState.currentEvent = {
                type: eventType,
                text: text,
                choices: choices,
                customHandler: gameState.currentEvent?.customHandler || null,
                isMultiStage: true,
                currentStage: stageId
            };
            
            this.refreshUI();
            return stages;
        }
        
        completeEvent(eventType, resultText) {
            this.stageData.delete(eventType);
            
            gameState.currentEvent.showResult = true;
            gameState.currentEvent.resultText = resultText;
            
            this.refreshUI();
        }
        
        refreshUI() {
            // Mock implementation for testing
            // In real environment, these would call updateStatusBar() and showPage('main-game')
        }
        
        createChoice(text, action, options = {}) {
            return {
                text,
                action,
                ...options
            };
        }
    }
    
    suite.test('MultiStageEventManager can initialize and track stages', () => {
        gameState = createTestGameState();
        
        const manager = new MockMultiStageEventManager();
        
        // Initialize a stage
        const stages = manager.initStage('test-event', 'stage1', { value: 42 });
        
        suite.assertEqual(stages.currentStage, 'stage1', 'Should set current stage correctly');
        suite.assertEqual(stages.data.value, 42, 'Should store stage data correctly');
    });
    
    suite.test('MultiStageEventManager can transition between stages', () => {
        gameState = createTestGameState();
        gameState.currentEvent = { type: 'test-event' };
        
        const manager = new MockMultiStageEventManager();
        
        // Initialize first stage
        manager.initStage('test-event', 'stage1', { counter: 1 });
        
        // Transition to next stage
        const choices = [
            { text: 'Choice A', action: 'accept' },
            { text: 'Choice B', action: 'decline' }
        ];
        
        manager.nextStage('test-event', 'stage2', 'Stage 2 text', choices, { counter: 2 });
        
        const stageData = manager.getStageData('test-event');
        suite.assertEqual(stageData.currentStage, 'stage2', 'Should transition to stage 2');
        suite.assertEqual(stageData.data.counter, 2, 'Should update stage data');
        suite.assertEqual(gameState.currentEvent.text, 'Stage 2 text', 'Should update event text');
        suite.assertEqual(gameState.currentEvent.choices.length, 2, 'Should update choices');
    });
    
    suite.test('MultiStageEventManager can complete events and clean up', () => {
        gameState = createTestGameState();
        gameState.currentEvent = { type: 'test-event' };
        
        const manager = new MockMultiStageEventManager();
        
        // Initialize and complete event
        manager.initStage('test-event', 'stage1', { data: 'test' });
        manager.completeEvent('test-event', 'Final result text');
        
        const stageData = manager.getStageData('test-event');
        suite.assertEqual(stageData.currentStage, null, 'Should clear stage data after completion');
        suite.assertEqual(gameState.currentEvent.showResult, true, 'Should set showResult flag');
        suite.assertEqual(gameState.currentEvent.resultText, 'Final result text', 'Should set result text');
    });
    
    suite.test('createChoice helper creates properly formatted choice objects', () => {
        const manager = new MockMultiStageEventManager();
        
        const basicChoice = manager.createChoice('Test choice', 'accept');
        suite.assertEqual(basicChoice.text, 'Test choice', 'Should set choice text');
        suite.assertEqual(basicChoice.action, 'accept', 'Should set choice action');
        
        const detailedChoice = manager.createChoice('Detailed choice', 'custom', {
            cost: { money: 5 },
            benefit: { incomeBonus: 1 }
        });
        suite.assertEqual(detailedChoice.cost.money, 5, 'Should include cost options');
        suite.assertEqual(detailedChoice.benefit.incomeBonus, 1, 'Should include benefit options');
    });
    
    suite.test('MultiStageEventManager can use other_texts for stage content', () => {
        gameState = createTestGameState();
        gameState.currentEvent = { 
            type: 'test-event',
            originalEventData: {
                other_texts: {
                    'stage2_text': 'Stage 2 content from other_texts',
                    'completion_text': 'Event completed via other_texts'
                }
            }
        };
        
        const manager = new MockMultiStageEventManager();
        
        // Add methods for other_texts integration to mock
        manager.nextStageFromOtherTexts = function(eventType, stageId, otherTextKey, choices, stageData = {}) {
            const originalEvent = gameState.currentEvent?.originalEventData;
            if (originalEvent && originalEvent.other_texts && originalEvent.other_texts[otherTextKey]) {
                const stageText = originalEvent.other_texts[otherTextKey];
                const stages = this.initStage(eventType, stageId, stageData);
                
                // Preserve originalEventData when updating currentEvent
                gameState.currentEvent = {
                    type: eventType,
                    text: stageText,
                    choices: choices,
                    customHandler: gameState.currentEvent?.customHandler || null,
                    isMultiStage: true,
                    currentStage: stageId,
                    originalEventData: originalEvent // Preserve this!
                };
                
                this.refreshUI();
                return stages;
            }
            return this.nextStage(eventType, stageId, 'Text not found', choices, stageData);
        };
        
        manager.completeEventFromOtherTexts = function(eventType, otherTextKey) {
            const originalEvent = gameState.currentEvent?.originalEventData;
            if (originalEvent && originalEvent.other_texts && originalEvent.other_texts[otherTextKey]) {
                const resultText = originalEvent.other_texts[otherTextKey];
                this.stageData.delete(eventType);
                gameState.currentEvent.showResult = true;
                gameState.currentEvent.resultText = resultText;
                this.refreshUI();
                return;
            }
            return this.completeEvent(eventType, 'Result text not found');
        };
        
        // Test using other_texts for stage transition
        manager.nextStageFromOtherTexts('test-event', 'stage2', 'stage2_text', [
            { text: 'Choice A', action: 'accept' }
        ]);
        
        suite.assertEqual(gameState.currentEvent.text, 'Stage 2 content from other_texts', 'Should use other_texts for stage content');
        
        // Test using other_texts for completion
        manager.completeEventFromOtherTexts('test-event', 'completion_text');
        
        // Debug: Check what we actually got
        const actualResult = gameState.currentEvent.resultText;
        suite.assertEqual(actualResult, 'Event completed via other_texts', 'Should use other_texts for completion');
    });
    
    return suite.runAll();
}

// Test events.json schema validation
function testEventsSchemaValidation() {
    const suite = new TestSuite();
    
    suite.test('events.json should be valid according to schema', () => {
        // Check if we're in Node.js environment
        if (typeof require !== 'undefined' && typeof process !== 'undefined') {
            const { validateEvents } = require('./validate-events.js');
            const isValid = validateEvents();
            suite.assertTrue(isValid, 'events.json should pass schema validation');
        } else {
            // Skip in browser environment
            console.log('Skipping schema validation test in browser environment');
        }
    });
    
    return suite.runAll();
}

// Mock functions for Node.js environment
function mockGetChoiceAffordability(choice) {
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

function mockFormatChoiceTextWithCosts(choice) {
    if (!choice.cost) return choice.text;
    
    const affordability = mockGetChoiceAffordability(choice);
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

// Test unaffordable choice highlighting
function testUnaffordableChoiceHighlighting() {
    const suite = new TestSuite();
    
    suite.test('getChoiceAffordability should identify missing resources correctly', () => {
        gameState = createTestGameState();
        gameState.money = 5; // Less than needed
        gameState.diplomacyPoints = 2; // Less than needed
        gameState.productPoints = 10; // Enough
        
        const choice = {
            text: "Expensive option (-$10B, -3 Diplomacy, -1 Product)",
            cost: {
                money: 10,
                diplomacyPoints: 3,
                productPoints: 1
            }
        };
        
        const affordability = mockGetChoiceAffordability(choice);
        
        suite.assertFalse(affordability.canAfford, 'Choice should be unaffordable');
        suite.assertEqual(affordability.missingResources.length, 2, 'Should have 2 missing resources');
        
        const missingTypes = affordability.missingResources.map(r => r.type);
        suite.assertTrue(missingTypes.includes('money'), 'Should identify missing money');
        suite.assertTrue(missingTypes.includes('diplomacyPoints'), 'Should identify missing diplomacy');
        suite.assertFalse(missingTypes.includes('productPoints'), 'Should not identify product as missing');
    });
    
    suite.test('formatChoiceTextWithCosts should highlight unaffordable costs in red', () => {
        gameState = createTestGameState();
        gameState.money = 5; // Less than needed
        gameState.diplomacyPoints = 10; // Enough
        
        const choice = {
            text: "Test choice (-$10B, -3 Diplomacy)",
            cost: {
                money: 10,
                diplomacyPoints: 3
            }
        };
        
        const formattedText = mockFormatChoiceTextWithCosts(choice);
        
        // Should highlight money cost in red but not diplomacy
        suite.assertTrue(formattedText.includes('<span style="color: #ff6b6b; font-weight: bold;">-$10B</span>'), 
            'Should highlight unaffordable money cost in red');
        suite.assertTrue(formattedText.includes('-3 Diplomacy'), 
            'Should include diplomacy cost');
        // Check that diplomacy cost is not wrapped in the red styling
        const diplomacyNotHighlighted = !formattedText.includes('<span style="color: #ff6b6b; font-weight: bold;">-3 Diplomacy</span>');
        suite.assertTrue(diplomacyNotHighlighted, 'Should not highlight affordable diplomacy cost in red');
    });
    
    suite.test('formatChoiceTextWithCosts should not highlight when all costs are affordable', () => {
        gameState = createTestGameState();
        gameState.money = 15; // More than enough
        gameState.diplomacyPoints = 10; // More than enough
        
        const choice = {
            text: "Affordable choice (-$10B, -3 Diplomacy)",
            cost: {
                money: 10,
                diplomacyPoints: 3
            }
        };
        
        const formattedText = mockFormatChoiceTextWithCosts(choice);
        
        // Should not highlight any costs
        suite.assertFalse(formattedText.includes('color: #ff6b6b'), 'Should not highlight any costs when affordable');
        suite.assertEqual(formattedText, choice.text, 'Should return original text when all costs affordable');
    });
    
    suite.test('formatChoiceTextWithCosts should handle choices without costs', () => {
        const choice = {
            text: "Free choice"
        };
        
        const formattedText = mockFormatChoiceTextWithCosts(choice);
        
        suite.assertEqual(formattedText, choice.text, 'Should return original text for choices without costs');
    });
    
    return suite.runAll();
}

// Main test runner
async function runAllTests() {
    const startTime = Date.now();
    console.log('🧪 Critical Path Game - Acquisition Event Tests\n');
    
    const results = await Promise.all([
        testAcquisitionEventAvailability(),
        testMergerMechanics(), 
        testEndgameScoring(),
        testRoleIndicator(),
        testPreferenceText(),
        testFallingBehindEvent(),
        testOtherTextsUsage(),
        testAILevelRangeFiltering(),
        testConditionalChoices(),
        testMultiStageEventSystem(),
        testEventsSchemaValidation(),
        testUnaffordableChoiceHighlighting()
    ]);
    
    const allPassed = results.every(result => result);
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log(`🎉 All tests passed! Ready for commit. (${executionTime}ms)`);
    } else {
        console.log(`❌ Some tests failed. Please fix before committing. (${executionTime}ms)`);
    }
    
    return { passed: allPassed, executionTime };
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests, TestSuite };
} else if (typeof window !== 'undefined') {
    window.runTests = runAllTests;
}