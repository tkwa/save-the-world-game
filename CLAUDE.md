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
  - Manual: `node -e "require('./tests.js').runAllTests()"`
- **Test categories**: Event logic, merger mechanics, endgame scoring, role indicators, other_texts usage
- **Commit integration**: Failed tests block commits; passed tests append timing info to commit messages

## Writing style

- The game is meant to be played by a "steely-eyed missile man".
- Text shouldn't be overly verbose-- less use of adjectives
- Be specific rather than vague
- Use game state about the player and world when relevant
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

### Minigame Integration
- Register minigames in the global minigame system
- Use consistent scoring and feedback patterns
- Update max scores in game state for progression tracking