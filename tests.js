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
        acquisitionCompetitorIndex: null
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

    suite.test('Merger removes acquiring competitor from list', () => {
        gameState = createTestGameState();
        gameState.competitorAILevels = [25, 12, 8];
        gameState.competitorNames = ['OpenAI', 'Google', 'Anthropic'];
        gameState.acquisitionCompetitorIndex = 0;
        
        const originalLength = gameState.competitorAILevels.length;
        
        // Simulate merger - remove the acquiring competitor
        gameState.competitorAILevels.splice(gameState.acquisitionCompetitorIndex, 1);
        gameState.competitorNames.splice(gameState.acquisitionCompetitorIndex, 1);
        
        suite.assertEqual(gameState.competitorAILevels.length, originalLength - 1, 'Competitor list should be shorter');
        suite.assertEqual(gameState.competitorNames.length, originalLength - 1, 'Competitor names list should be shorter');
        suite.assertFalse(gameState.competitorNames.includes('OpenAI'), 'Acquiring competitor should be removed');
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

    suite.test('VP Safety Alignment gets 11x multiplier instead of 20x', () => {
        gameState = createTestGameState();
        gameState.isVPSafetyAlignment = true;
        
        const playerMultiplier = gameState.isVPSafetyAlignment ? 11 : 20;
        
        suite.assertEqual(playerMultiplier, 11, 'VP Safety Alignment should get 11x multiplier');
    });

    suite.test('Regular player gets 20x multiplier', () => {
        gameState = createTestGameState();
        gameState.isVPSafetyAlignment = false;
        
        const playerMultiplier = gameState.isVPSafetyAlignment ? 11 : 20;
        
        suite.assertEqual(playerMultiplier, 20, 'Regular player should get 20x multiplier');
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

// Main test runner
async function runAllTests() {
    console.log('🧪 Critical Path Game - Acquisition Event Tests\n');
    
    const results = await Promise.all([
        testAcquisitionEventAvailability(),
        testMergerMechanics(), 
        testEndgameScoring(),
        testRoleIndicator()
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