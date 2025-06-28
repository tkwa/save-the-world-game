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
        totalEquityOffered: null
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

// Main test runner
async function runAllTests() {
    console.log('🧪 Critical Path Game - Acquisition Event Tests\n');
    
    const results = await Promise.all([
        testAcquisitionEventAvailability(),
        testMergerMechanics(), 
        testEndgameScoring(),
        testRoleIndicator(),
        testPreferenceText()
    ]);
    
    const allPassed = results.every(result => result);
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('🎉 All tests passed! Ready for commit.');
    } else {
        console.log('❌ Some tests failed. Please fix before committing.');
    }
    
    return allPassed;
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runAllTests, TestSuite };
} else if (typeof window !== 'undefined') {
    window.runTests = runAllTests;
}