# Critical Path AI Strategy Game - Development Guidelines

## Project Overview
This is a turn-based AI strategy game where players act as CEOs of AI companies navigating the race to AGI while balancing safety concerns. The game features complex mechanics including resource allocation, technology trees, minigames, and risk calculations.

There's a TODO list atop `README.md`.

## Coding Guidelines

### DRY Principle (Don't Repeat Yourself)
- **Avoid duplicating code when possible**
- Extract shared logic into reusable functions
- Create utility functions for commonly used calculations
- Maintain single source of truth for data transformations
- When you see similar code patterns, consider refactoring into shared functions
- If you notice yourself making kludgy changes repeatedly, stop and propose a plan to the user about doing it more extensibly

### Code Organization
- Keep related functions grouped together
- Use clear, descriptive function names
- Add comments for complex calculations or game mechanics
- Prefer pure functions over side effects when possible

### Game-Specific Guidelines
- **Risk calculations**: Use shared `calculateAdjustedRisk()` function
- **UI updates**: Batch DOM updates when possible
- **Game state**: Always update through proper state management
- **Formulas**: Document mathematical formulas in comments
- **Constants**: Use named constants instead of magic numbers
- **Numbers**: Bold important numbers in UI text using `<strong>` tags (percentages, multipliers, values)

### File Structure
- `game-core.js`: Main game logic, state management, UI updates
- `utils.js`: All common functions
- `minigames.js`: Standalone minigame implementations
- `events.js`: Event system and handlers
- `events.json`: Event text and data
- `endgame.js`: End game calculations and display

### Performance Considerations
- Use efficient canvas operations for graphics
- Minimize DOM queries by caching elements
- Use requestAnimationFrame for smooth animations
- Sample pixels efficiently for large canvas operations

### Testing & Debugging
- Add console.log statements for debugging complex calculations
- Use descriptive variable names for intermediate calculations
- Test edge cases (zero values, maximum values)
- Verify formulas match mathematical specifications

### Automated Testing
- **Pre-commit hooks**: Tests run automatically before each commit
- **Test timing**: Execution time is logged in commit messages for performance tracking
- **Commands**: 
  - `npm test` - Run full test suite with timing
  - `npm run lint` - Run ESLint for syntax/style validation
  - Manual: `node -e "require('./tests.js').runAllTests()"`
- **Test categories**: Event logic, merger mechanics, endgame scoring, role indicators, other_texts usage
- **Linting**: ESLint catches syntax errors like duplicate variable declarations (`no-redeclare` rule)
- **Commit integration**: Failed tests block commits; passed tests append timing info to commit messages
- Claude cannot test via `python -m http.server 8000` and should rely on `npm test` and human user testing

## Documentation

### Commits

- Commit often but not more than once per task specified in the README.
- You must make a commit when making a version bump. Start the commit message with "vX.Y.Z:"
- Limit commit messages to 100 words.
- If a series of commits feels like it merits a minor or patch version bump, ask the user and they'll probably approve it

### Version bumps and CHANGELOG.md

Update CHANGELOG.md whenever bumping the version.
- Patch versions get up to 500 chars in changelog and 40-60 in summary line
- Minor versions get up to 1500 chars in changelog and 40-90 in summary line

## Writing style

- The game is meant to be played by a "steely-eyed missile man".
- **Do**:
  - Technical precision, jargon-appropriate language, understated gravity, concise factual statements that respect player intelligence
  - Use game state variables about the player and world when relevant
  - Be specific rather than vague
- **Don't**:
  - Avoid melodrama, sensationalism, talking down to player, casual/jokey tone about serious topics
  - Avoid meaningless adjectives and passive verbs: "substantial", "enhanced", "revolutionary"-- unless you really mean it.
- Example
  - Original: The acquisition succeeds. Boston Dynamics' bipedal robots, quadrupeds, and manipulation systems are now enhanced with your AI capabilities. The combination enables revolutionary automation solutions, generating substantial revenue from manufacturing, logistics, and specialized applications.
  - Better: The acquisition succeeds. Boston Dynamics' bipedal and quadrupedal robots are now piloted by a specialized version of ${aiVersion}. The new subsidiary ${companyName} Dynamics expands from manufacturing to other unskilled trades; your robots can fold clothes and operate in normal office spaces.

## Game Mechanics Notes

### Risk Calculation Formula
```javascript
adjustedRisk = rawRisk / (safetyFactor × alignmentFactor)
where:
  safetyFactor = 1 + √(safetyPoints) / 3
  alignmentFactor = 1 + (alignmentMaxScore / 100)
```

### Technology Dependencies
- Use `TECHNOLOGY_DEPENDENCIES` object for prerequisite checks

### Event AI Level Ranges
- Events can specify `aiLevelRange` with optional `min` and/or `max` values
- Events are only available when player AI level is within the specified range
- Examples:
  - `"aiLevelRange": { "min": 12 }` - Only available at AI level 12+
  - `"aiLevelRange": { "max": 50 }` - Only available below AI level 50
  - `"aiLevelRange": { "min": 20, "max": 80 }` - Available between AI levels 20-80

### Conditional Choices
- Choices can specify a `condition` field with a boolean gameState variable name
- Choices are only shown if the condition evaluates to `true`
- Examples:
  - `"condition": "projectsUnlocked"` - Only shown if `gameState.projectsUnlocked` is `true`
  - `"condition": "isVPSafetyAlignment"` - Only shown if player is VP of Safety and Alignment
- Choices without conditions are always available
- Invalid condition types are ignored (treated as no condition)

### Multi-Stage Event System
For complex events requiring multiple interactions, use the `MultiStageEventManager` class in custom handlers.

#### Basic Multi-Stage Event (with hardcoded text):
```javascript
function handleMyMultiStageEvent(choice, event, sanctionsTriggered) {
    const stages = multiStageManager.getStageData(event.type);
    
    // First time: initialize stage
    if (!stages.currentStage) {
        multiStageManager.initStage(event.type, 'stage1', { 
            playerData: someValue 
        });
        
        // Transition to next stage with new text and choices
        multiStageManager.nextStage(event.type, 'stage2', 
            "Stage 2 text here",
            [
                multiStageManager.createChoice("Option A", "accept"),
                multiStageManager.createChoice("Option B", "decline")
            ]
        );
        return;
    }
    
    // Handle subsequent stages
    if (stages.currentStage === 'stage2') {
        // Process choice and complete event
        multiStageManager.completeEvent(event.type, "Final result text");
    }
}
```

#### Data-Driven Multi-Stage Event (using other_texts):
```javascript
// In events.json:
{
  "type": "my-complex-event",
  "customHandler": "handleMyComplexEvent",
  "other_texts": {
    "investigation_stage": "Investigators approach your facility...",
    "negotiation_stage": "The situation escalates to negotiations...",
    "success_outcome": "Your strategy succeeds...",
    "failure_outcome": "The plan backfires..."
  }
}

// In custom handler:
function handleMyComplexEvent(choice, event, sanctionsTriggered) {
    const stages = multiStageManager.getStageData(event.type);
    
    if (!stages.currentStage) {
        // Use other_texts for stage content instead of hardcoded strings
        multiStageManager.nextStageFromOtherTexts(event.type, 'negotiation',
            'investigation_stage',
            [
                multiStageManager.createChoice("Negotiate", "negotiate"),
                multiStageManager.createChoice("Resist", "resist")
            ]
        );
        return;
    }
    
    if (stages.currentStage === 'negotiation') {
        const success = Math.random() < 0.5;
        const outcomeKey = success ? 'success_outcome' : 'failure_outcome';
        
        // Use other_texts for completion message
        multiStageManager.completeEventFromOtherTexts(event.type, outcomeKey);
    }
}
```

**Benefits:**
- Automatic stage data management and cleanup
- Standardized UI refresh handling  
- Helper methods for creating choices
- Simplified state tracking between stages
- **Data-driven content**: Use `other_texts` instead of hardcoded strings
- **Maintainable**: Content changes don't require code modifications
- **Localizable**: Text can be easily translated or modified

### Minigame Integration
- Register minigames in the global minigame system
- Use consistent scoring and feedback patterns
- Update max scores in game state for progression tracking

## Project System (Interpretability/Alignment)

### Implementation Pattern
- **Project Unlocking**: Events trigger project availability via gameState flags
  - `projectsUnlocked`: Unlocks Projects panel (safety-research-limitations event at 80 safety)
  - `alignmentUnlocked`: Unlocks alignment project (alignment-research-breakthrough event at 320 safety)
- **Progress Tracking**: Projects use different mechanisms than sectors
  - Alignment: Minigame-based with `alignmentMaxScore` (0-100%)
  - Interpretability: Labor-hour based with `interpretabilityProgress` (0-100%)
- **Cost Structure**: All projects cost same as Safety R&D (`Math.sqrt(playerAILevel) / 2`)

### Interpretability Project
- **Progress Formula**: `sqrt(laborHours / 1000) * 100` (requires 1B hours for 100%)
- **Risk Reduction**: Factor of `1 + (progress / 100)` reduces risk as divisor
- **Button Text**: "Interp 🔬 X% (-$YB)" for conciseness
- **Max Progress**: Button greyed out at 100%, no further allocation allowed

### Adding New Projects
1. Add unlock flag to `createInitialGameState()` in utils.js
2. Create unlock event in events.json with appropriate safety threshold
3. Add event processing in `game-core.js` (around line 1906)
4. Add project button in Projects section with conditional display
5. Add case to `applyResourceAllocation()` for resource processing
6. Add tooltip case to `generateActionTooltip()` for descriptions