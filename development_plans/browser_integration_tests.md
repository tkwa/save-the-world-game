# Browser Integration Testing Plan

## Summary

- Implement browser integration tests for key workflows
  - Browser flow integration: Starting the game, playing forcing a series of events, going to endgame
    - use debug function to speed up waiting times by 100x
- Use optimization strategies below to reduce test runtime, ideally below 5s

## Current Architecture

The game currently uses Node.js-based testing for business logic validation:
- **tests.js**: Unit tests for utility functions, game mechanics, and event validation
- **validate-events.js**: Schema validation for events.json structure
- **Node.js environment**: Tests run in isolated Node.js context with ES module imports

## Proposed Tiered Testing Approach

### Tier 1: Business Logic (Current - Node.js)
- **Purpose**: Test pure functions, calculations, and data validation
- **Tools**: Current Node.js test runner with ES modules
- **Coverage**: 
  - Risk calculations and formulas
  - Game state transitions
  - Event logic and validation
  - Utility functions
- **Benefits**: Fast execution, deterministic, easy to debug

### Tier 2: Integration Testing (New - Browser)
- **Purpose**: Test actual game functionality in browser environment
- **Tools**: Playwright or Puppeteer for browser automation
- **Coverage**:
  - Page loads and navigation
  - Button clicks and user interactions
  - Event system integration
  - DOM updates and UI state
  - Canvas rendering (minigames)
  - Local storage persistence

### Tier 3: Visual Regression (Future)
- **Purpose**: Catch UI layout and styling issues
- **Tools**: Screenshot comparison tools
- **Coverage**: Visual consistency across game states

## Implementation Strategy

### Phase 1: Setup Browser Testing Framework
1. Add Playwright or Puppeteer to devDependencies
2. Create `tests/integration/` directory structure
3. Add npm scripts for browser testing
4. Set up headless browser configuration

### Phase 2: Core Integration Tests
1. Game initialization and startup flow
2. Resource allocation and turn progression  
3. Event system (trigger events, make choices, verify outcomes)
4. Technology unlocking and progression
5. Minigame launches and completion

### Phase 3: Advanced Scenarios
1. Multi-turn game sessions
2. Edge cases and error handling
3. Save/load functionality
4. Performance testing for large game states

## Benefits of Browser Integration Testing

1. **Real Environment**: Tests run in actual browser JavaScript engine
2. **DOM Integration**: Validates HTML/CSS interactions with game logic
3. **User Journey**: Tests complete user workflows end-to-end
4. **Regression Detection**: Catches issues that unit tests miss
5. **Confidence**: Higher assurance that deployment will work

## Example Browser Integration Test

```javascript
// tests/integration/game-flow.spec.js
import { test, expect } from '@playwright/test';

test.describe('Game Flow Integration', () => {
  test('should complete new game startup and first turn', async ({ page }) => {
    // Navigate to game
    await page.goto('http://localhost:8000/savetheworld.html');
    
    // Start new game
    await page.click('button:has-text("New Game")');
    
    // Verify company selection screen appears
    await expect(page.locator('.company-selection')).toBeVisible();
    
    // Select a company (e.g., OpenAI)
    await page.click('button:has-text("OpenAI")');
    
    // Verify main game interface loads
    await expect(page.locator('#game-interface')).toBeVisible();
    await expect(page.locator('#status-bar')).toBeVisible();
    
    // Check initial game state
    const aiLevel = await page.locator('#ai-level').textContent();
    expect(aiLevel).toContain('10'); // Initial AI level
    
    const money = await page.locator('#money').textContent();
    expect(money).toContain('$10B'); // Initial money
    
    // Make resource allocation
    await page.click('#ai-research-btn');
    
    // Verify allocation is reflected in UI
    await expect(page.locator('#selected-allocation')).toContainText('AI Research');
    
    // End turn
    await page.click('#end-turn-btn');
    
    // Wait for turn to process
    await page.waitForSelector('#turn-counter:has-text("2")', { timeout: 5000 });
    
    // Verify turn advanced
    const turnCounter = await page.locator('#turn-counter').textContent();
    expect(turnCounter).toContain('2');
    
    // Verify AI level increased
    const newAiLevel = await page.locator('#ai-level').textContent();
    expect(parseInt(newAiLevel)).toBeGreaterThan(10);
  });

  test('should handle event system correctly', async ({ page }) => {
    await page.goto('http://localhost:8000/savetheworld.html');
    await page.click('button:has-text("New Game")');
    await page.click('button:has-text("OpenAI")');
    
    // Force a specific event for testing (would require dev/test mode)
    await page.evaluate(() => {
      window.forceEvent('safety-research-breakthrough');
    });
    
    // Verify event modal appears
    await expect(page.locator('#event-modal')).toBeVisible();
    await expect(page.locator('.event-title')).toContainText('Safety Research Breakthrough');
    
    // Make a choice
    await page.click('.event-choice:first-child button');
    
    // Verify event modal closes and effects are applied
    await expect(page.locator('#event-modal')).not.toBeVisible();
    
    // Check that game state was updated based on choice
    const safetyPoints = await page.locator('#safety-points').textContent();
    expect(parseInt(safetyPoints)).toBeGreaterThan(0);
  });

  test('should launch and complete minigame', async ({ page }) => {
    await page.goto('http://localhost:8000/savetheworld.html');
    await page.click('button:has-text("New Game")');
    await page.click('button:has-text("OpenAI")');
    
    // Trigger forecasting minigame event
    await page.evaluate(() => {
      window.forceEvent('forecasting-minigame');
    });
    
    await page.click('.event-choice:has-text("Proceed") button');
    
    // Verify minigame loads
    await expect(page.locator('#minigame-container')).toBeVisible();
    await expect(page.locator('#forecasting-minigame')).toBeVisible();
    
    // Make a forecast choice
    await page.click('.forecast-option:first-child');
    
    // Submit forecast
    await page.click('#submit-forecast');
    
    // Verify minigame completes and returns to main game
    await expect(page.locator('#minigame-container')).not.toBeVisible();
    await expect(page.locator('#game-interface')).toBeVisible();
    
    // Check that minigame results were applied
    const resultText = await page.locator('#last-event-result').textContent();
    expect(resultText).toContain('forecast');
  });
});
```

This test demonstrates:
- **Real browser interaction**: Clicks, form submissions, navigation
- **DOM verification**: Checking elements appear/disappear correctly  
- **Game state validation**: Verifying numbers and text update properly
- **Event flow testing**: Complete event trigger → choice → outcome cycle
- **Minigame integration**: Testing canvas-based game components
- **Async handling**: Proper waiting for game state changes

## Performance Estimates

### Current Node.js Tests
- **Execution time**: ~10-13ms (extremely fast!)
- **Test count**: ~50+ tests covering business logic
- **Why so fast**: Pure function testing, no I/O, no browser, minimal framework
- **Only bottleneck**: Single JSON schema validation (~5ms)

### Projected Browser Integration Tests
- **Single test**: 3-8 seconds per test
- **Full suite**: 15-45 seconds for 5-15 integration tests
- **Startup overhead**: ~2-3 seconds for browser launch per test file
- **Parallel execution**: Can reduce total time by 60-80% with multiple browsers

### Combined Test Suite Timing
- **Node.js tests**: 13ms (unchanged)
- **Browser tests**: 20-30 seconds (with parallelization)
- **Total CI time**: ~30 seconds (vs current 13ms)

### Could Browser Tests Be This Fast?

**Short answer: No.** Browser integration tests have fundamental overhead that pure function tests don't:

**Unavoidable Browser Overhead:**
- **Browser startup**: ~1-2 seconds minimum (even headless Chrome)
- **Page load**: ~200-500ms to load HTML/CSS/JS
- **DOM operations**: ~10-50ms per click/assertion vs ~0.1ms for function calls
- **Network simulation**: Local HTTP server still has request overhead
- **Rendering pipeline**: Browser must parse, layout, paint even if headless

**However, we could optimize significantly:**

**Fast Integration Test Strategies:**
1. **Shared browser session**: One browser for multiple tests (~90% faster)
2. **Pre-loaded game state**: Skip startup, load directly into game state
3. **Mocked events**: Use `window.forceEvent()` instead of random triggers
4. **Minimal DOM assertions**: Test game state, not visual appearance
5. **Batch operations**: Multiple actions per test instead of separate tests

**Realistic "Fast" Browser Tests:**
- **Single test**: 100-300ms (vs 3-8 seconds)
- **Suite of 10 tests**: 2-5 seconds (vs 30+ seconds)
- **Still 200-400x slower** than pure function tests, but much more practical

**Best of both worlds approach:**
- Keep 13ms Node.js tests for 90% of logic
- Add 2-5 second browser tests for critical user flows only
- Total test time: ~5-7 seconds instead of 30+ seconds

### Optimization Strategies
- **Selective running**: Only run browser tests on significant changes
- **Test grouping**: Batch multiple scenarios per browser session
- **Headless mode**: 2-3x faster than headed browser testing
- **Parallel workers**: Run 3-4 browser instances simultaneously

## Browser Testing Framework Comparison

### Playwright vs Puppeteer vs Alternatives

| Feature | Playwright | Puppeteer | Cypress | WebdriverIO |
|---------|------------|-----------|---------|-------------|
| **Browser Support** | Chrome, Firefox, Safari, Edge | Chrome/Chromium only | Chrome, Firefox, Edge | All major browsers |
| **Installation Size** | ~200MB (includes browsers) | ~100MB | ~300MB | ~50MB (drivers separate) |
| **API Design** | Modern, promise-based | Promise-based | Cypress-specific | WebDriver standard |
| **Speed** | Very fast | Very fast | Medium | Medium |
| **Debugging** | Excellent (trace viewer) | Good | Excellent | Good |
| **Maintenance** | Microsoft-backed | Google-backed | Strong community | Open source |

### For Our Use Case

**Playwright Pros:**
- ✅ **Multi-browser**: Test across all browsers (good for web game)
- ✅ **Auto-wait**: Built-in smart waiting for elements
- ✅ **Trace viewer**: Excellent debugging for complex game interactions
- ✅ **Fast execution**: Optimized for speed
- ✅ **ES modules**: Native support for our module system
- ✅ **Parallel testing**: Built-in test runner with parallelization
- ✅ **Canvas testing**: Better support for canvas interactions (minigames)

**Playwright Cons:**
- ❌ **Size**: Larger download (~200MB)
- ❌ **Learning curve**: New API to learn
- ❌ **Overkill**: More features than we need for single-page game

**Puppeteer Pros:**
- ✅ **Smaller**: ~100MB download
- ✅ **Simple**: Straightforward API
- ✅ **Chrome-focused**: Perfect for development (most users use Chrome)
- ✅ **Fast**: Very performant
- ✅ **Good docs**: Excellent documentation

**Puppeteer Cons:**
- ❌ **Chrome only**: Can't test Firefox/Safari compatibility
- ❌ **Less automation**: More manual waiting and setup
- ❌ **Canvas testing**: Limited built-in canvas interaction helpers

**Cypress Pros:**
- ✅ **Great DX**: Excellent developer experience and debugging
- ✅ **Built-in server**: Can serve the game automatically
- ✅ **Time travel**: Step through test execution

**Cypress Cons:**
- ❌ **Slow**: Significantly slower than Playwright/Puppeteer
- ❌ **Large**: ~300MB installation
- ❌ **Complex**: Overkill for our simple integration needs

## Recommendation: Playwright

**For our Critical Path game, Playwright is the best choice because:**

1. **Multi-browser support**: Web game needs to work across browsers
2. **Canvas testing**: Better support for minigame interactions
3. **Speed optimization**: Built-in features for our "fast browser tests" goal
4. **Future-proof**: Microsoft backing ensures long-term support
5. **ES modules**: Native compatibility with our module system
6. **Auto-wait**: Reduces flaky tests from timing issues

**Implementation approach:**
```javascript
// playwright.config.js
export default {
  testDir: './tests/integration',
  timeout: 10000,
  use: {
    headless: true,
    baseURL: 'http://localhost:8000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add Firefox/Safari later if needed
  ],
};
```

**Package.json additions:**
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  },
  "scripts": {
    "test:integration": "playwright test",
    "test:all": "npm test && npm run test:integration"
  }
}
```

## Maintaining Current Strengths

- Keep 13ms Node.js tests for fast business logic validation
- Use Playwright browser tests selectively for integration scenarios
- Leverage Playwright's optimization features for speed
- Keep schema validation and event structure tests in Node.js