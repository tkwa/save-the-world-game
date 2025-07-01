// Shared utility functions for Critical Path AI Strategy Game
/* global gameState */

// Game constants
const GAME_CONSTANTS = {
    // Initial values
    INITIAL_PLAYER_AI_LEVEL: 10,
    INITIAL_DOOM_LEVEL: 20.0,
    INITIAL_COMPETITOR_AI_LEVELS: [8, 6, 4],
    INITIAL_TURN: 1,
    INITIAL_YEAR: 2026,
    INITIAL_MONEY: 10,
    MAX_COMPETITORS: 3,
    
    // AI capability risk thresholds
    AI_RISK_THRESHOLDS: {
        LEVEL_1: 16,
        LEVEL_2: 32,
        LEVEL_3: 64,
        LEVEL_4: 128,
        LEVEL_5: 256,
        LEVEL_6: 512
    },
    
    // Risk assessment thresholds
    RISK_THRESHOLDS: {
        MEDIUM: 15,
        HIGH: 50,
        CRITICAL: 75
    },
    
    // Resource calculation constants
    RESOURCE_FORMULAS: {
        AI_GAIN_EXPONENT: 0.8,
        AI_GAIN_DIVISOR: 5,
        SAFETY_GAIN_EXPONENT: 0.8,
        SAFETY_GAIN_DIVISOR: 5,
        RISK_REDUCTION_DIVISOR: 10,
        SAFETY_DIMINISHING_RETURNS_EXPONENT: -0.1,
        DIPLOMACY_GAIN_DIVISOR: 10,
        PRODUCT_GAIN_DIVISOR: 10,
        COMPETITOR_PENALTY_POWER: 2,
        PLAYER_LEVEL_POWER: 2
    },
    
    // Infrastructure and sanctions
    DATACENTER_BOOST_MULTIPLIER: 0.20,
    SANCTIONS_PENALTY_DIVISOR: 2,
    
    // End game thresholds
    DOOM_GAME_OVER_THRESHOLD: 100,
    ASI_THRESHOLD: 1000,
    NARROW_RACE_THRESHOLD: 900,
    TOTAL_GALAXIES: 100,
    
    // Growth and simulation
    COMPETITOR_GROWTH_DIVISOR: 25,
    CAPABILITY_GROWTH_EXPONENT: 1.6,
    GROWTH_RATE_BASE: 0.010,
    HYPE_DIVISOR: 10,
    HAWKISH_MULTIPLIER: 1.3,
    DOVISH_MULTIPLIER: 0.5,
    MAX_SIMULATION_ITERATIONS: 10000,
    
    // Display and UI
    PERCENTAGE_MULTIPLIER: 100,
    TIMEOUT_DELAY_MS: 100,
    
    // Galaxy multipliers
    GALAXY_MULTIPLIERS: {
        ROGUE: 0,
        HUMANITY: 10,
        PLAYER: 100,
    },
    
    // Minigame
    FORECASTING_OPTIONS: [50, 60, 70, 80],
    
    // Event variables
    DATACENTER_COUNTRIES: ['Brazil', 'Indonesia', 'Turkey'],
    
    // Country flag mappings
    COUNTRY_FLAGS: {
        'Brazil': '🇧🇷',
        'Indonesia': '🇮🇩', 
        'Turkey': '🇹🇷'
    }
};

// Technology configuration
const INITIAL_TECHNOLOGIES = {
    // General technologies (column 1 - all visible from start)
    robotaxi: true, // Starts enabled
    aiNovelist: false,
    aiResearchLead: false,
    persuasion: false,
    // Medicine technologies (column 2 - only medicine visible at start)
    medicine: false,
    syntheticBiology: false,
    cancerCure: false,
    brainUploading: false,
    // Robotics technologies (column 3 - only robotics visible at start)
    robotics: false,
    humanoidRobots: false,
    nanotech: false,
    // Alignment technologies (column 4 - all visible from start)
    aiMonitoring: false,
    aiControl: false,
    aiAlignment: false,
    aiInterpretability: false,
    // Military technologies (column 5 - only cyberWarfare visible at start)
    cyberWarfare: false, // Starts shown but not developed
    bioweapons: false,
    killerDrones: false,
    nukes: false
};

// Company metadata shared across the game
const COMPANIES = [
    { name: "OpenAI", longName: "OpenAI", homeCountry: "US", flag: "🇺🇸" },
    { name: "Anthropic", longName: "Anthropic", homeCountry: "US", flag: "🇺🇸" },
    { name: "DeepMind", longName: "Google DeepMind", homeCountry: "UK", flag: "🇬🇧" },
    { name: "DeepSeek", longName: "DeepSeek", homeCountry: "CN", flag: "🇨🇳" },
    { name: "Tencent", longName: "Tencent", homeCountry: "CN", flag: "🇨🇳" },
    { name: "xAI", longName: "xAI", homeCountry: "US", flag: "🇺🇸" }
];

// Factory function to create initial game state
function createInitialGameState() {
    return {
        // AI Information
        playerAILevel: GAME_CONSTANTS.INITIAL_PLAYER_AI_LEVEL,
        doomLevel: GAME_CONSTANTS.INITIAL_DOOM_LEVEL,
        competitorAILevels: [...GAME_CONSTANTS.INITIAL_COMPETITOR_AI_LEVELS], // Top 3 competitors in descending order
        competitorNames: [], // Will be set during game setup

        // Corporate Divisions
        diplomacyPoints: 0,
        productPoints: 0,
        safetyPoints: 0,

        // Status Effects
        hasSanctions: false, // TODO: migrate to statusEffects system
        statusEffects: {}, // Generic status effects system
        diplomacyMultiplier: 1,
        productMultiplier: 1,
        
        // Infrastructure
        datacenterCount: 0,
        powerplantCount: 0,
        biotechLabCount: 0,
        datacenterCountry: null, // Stores the country where datacenter was built
        cooIsMinister: false, // Whether COO is serving as minister in datacenter country

        // Technologies
        technologies: { ...INITIAL_TECHNOLOGIES },

        // Other game state
        currentPage: "start",
        alignmentLevel: Math.random(), // 0-1 float for alignment
        evalsBuilt: {
            capability: false,
            corrigibility: false,
            alignment: false,
            forecasting: false
        },
        correlationDataset: null,
        currentMinigame: null,
        companyName: null,
        currentTurn: GAME_CONSTANTS.INITIAL_TURN,
        currentMonth: "January",
        currentYear: GAME_CONSTANTS.INITIAL_YEAR,
        money: GAME_CONSTANTS.INITIAL_MONEY, // Starting money
        gameOverReason: null,
        endGameResult: null, // Stores calculated end game score to avoid re-rolling
        endGamePhase: 1, // Current phase of end game display (1-5)
        currentEvent: null,
        safetyIncidentCount: 0,
        severeIncidentCount: 0,
        isDisillusioned: false,
        selectedAllocation: null,
        allocationApplied: false,
        eventsSeen: {}, // Tracks count of each event type seen
        choicesTaken: {}, // Tracks choices taken for each event type
        eventsAccepted: new Set(), // Tracks which DSA events have been accepted
        eventAppearanceCounts: new Map(), // Tracks how many times each event has appeared
        alignmentMaxScore: 0, // Maximum score achieved in alignment minigame
        endgameAdjustedRisk: null, // Adjusted risk level at endgame trigger
        projectsUnlocked: false, // Whether Projects panel is unlocked (at 100 safety points)
        startingCompany: null, // Original company name for endgame scoring (before merger)
        isVPSafetyAlignment: false, // Whether player became VP of Safety and Alignment through merger
        playerEquity: 0.1, // Player's equity stake in the company (0.1 = 10%, 0.01 = 1%, etc.)
        companyLongName: null, // Full company name (e.g., "Google DeepMind")
        companyCountry: null, // Company home country code
        companyFlag: null, // Company flag emoji
        offeredEquity: null, // Equity player receives in acquisition event (player's share)
        totalEquityOffered: null, // Total equity offered to the old company
        hasEverFallenBehind: false // Whether player has ever fallen behind the top competitor
    };
}

// Risk factor calculation - single source of truth
function getRiskFactors(safetyPoints = null, alignmentMaxScore = null) {
    const safety = safetyPoints !== null ? safetyPoints : gameState.safetyPoints;
    const alignment = alignmentMaxScore !== null ? alignmentMaxScore : gameState.alignmentMaxScore;
    
    const safetyFactor = 1 + Math.pow(safety, 0.6) / 5;
    const alignmentFactor = 1 + (alignment / 100);
    return { safetyFactor, alignmentFactor };
}

// Risk calculation function used across multiple files
function calculateAdjustedRiskPercent(safetyPoints = null, alignmentMaxScore = null) {
    const rawRisk = gameState.doomLevel;
    const { safetyFactor, alignmentFactor } = getRiskFactors(safetyPoints, alignmentMaxScore);
    const adjustedRisk = rawRisk / (safetyFactor * alignmentFactor);
    return Math.min(adjustedRisk, 100); // Cap at 100%
}

// Get AI system version name based on company and capability level
function getAISystemVersion(companyName, capabilityLevel) {
    // Determine capability band based on AI_RISK_THRESHOLDS
    let band = 0;
    if (capabilityLevel >= GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_6) band = 6;
    else if (capabilityLevel >= GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_5) band = 5;
    else if (capabilityLevel >= GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_4) band = 4;
    else if (capabilityLevel >= GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_3) band = 3;
    else if (capabilityLevel >= GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_2) band = 2;
    else if (capabilityLevel >= GAME_CONSTANTS.AI_RISK_THRESHOLDS.LEVEL_1) band = 1;
    
    switch (companyName) {
        case 'Anthropic':
            // Starts at Claude 5 Opus, increments 2 per level
            return `Claude ${5 + (band * 2)} Opus`;
        case 'DeepMind':
            // Starts at Gemini 3.0 Pro, increments 1.5 per level
            if (band == 6) return `OmegaReason`
            else return `Gemini ${(3.0 + (band * 1.5)).toFixed(1)} Pro`;
        case 'OpenAI':
            // o5, o7, then AGT-9, AGT-10, AGT-12, AGT-14
            if (band === 0) return 'OpenAI o5';
            else if (band === 1) return 'OpenAI o7';
            else return `AGT-${9 + ((band - 2) * 2)}`;
        case 'DeepSeek':
            // Deepseek R3, increments 2 per level
            return `Deepseek R${3 + (band * 2)}`;
        case 'xAI':
            // Starts at Grok 5, increments 2 per level
            return `Grok ${5 + (band * 2)}`;
        case 'Tencent':
            if (band === 0) return `Hunyuan ${3 + band}.0`;
            else if (band == 6) return `HunyuanDivine 9.0`
            else return `HunyuanAgent ${3 + band}.0`;
        default:
            return 'AI System';
    }
}

// Get risk color based on risk percentage
function getRiskColor(riskPercent) {
    if (riskPercent < GAME_CONSTANTS.RISK_THRESHOLDS.MEDIUM) {
        return '#66bb6a'; // Green for low risk
    } else if (riskPercent < GAME_CONSTANTS.RISK_THRESHOLDS.HIGH) {
        return '#ffa726'; // Orange for medium risk
    } else {
        return '#ff6b6b'; // Red for high risk
    }
}

// Utility function to calculate galaxy scoring multipliers
function getGalaxyMultipliers() {
    const humanityMultiplier = (gameState.statusEffects.disillusioned && gameState.statusEffects.disillusioned.active) 
        ? GAME_CONSTANTS.GALAXY_MULTIPLIERS.HUMANITY / 2 
        : GAME_CONSTANTS.GALAXY_MULTIPLIERS.HUMANITY;
    
    const playerMultiplier = GAME_CONSTANTS.GALAXY_MULTIPLIERS.PLAYER;
    
    return {
        humanity: humanityMultiplier,
        player: playerMultiplier,
        rogue: GAME_CONSTANTS.GALAXY_MULTIPLIERS.ROGUE
    };
}

// Export functions to global scope for cross-file usage
if (typeof window !== 'undefined') {
    // Browser environment
    window.calculateAdjustedRiskPercent = calculateAdjustedRiskPercent;
    window.getRiskFactors = getRiskFactors;
    window.getAISystemVersion = getAISystemVersion;
    window.getRiskColor = getRiskColor;
    window.getGalaxyMultipliers = getGalaxyMultipliers;
    window.COMPANIES = COMPANIES;
    window.GAME_CONSTANTS = GAME_CONSTANTS;
    window.createInitialGameState = createInitialGameState;
    window.INITIAL_TECHNOLOGIES = INITIAL_TECHNOLOGIES;
} else if (typeof global !== 'undefined') {
    // Node.js environment (for testing)
    /* global global */
    global.calculateAdjustedRiskPercent = calculateAdjustedRiskPercent;
    global.getRiskFactors = getRiskFactors;
    global.getAISystemVersion = getAISystemVersion;
    global.getRiskColor = getRiskColor;
    global.getGalaxyMultipliers = getGalaxyMultipliers;
    global.COMPANIES = COMPANIES;
    global.GAME_CONSTANTS = GAME_CONSTANTS;
    global.createInitialGameState = createInitialGameState;
    global.INITIAL_TECHNOLOGIES = INITIAL_TECHNOLOGIES;
}