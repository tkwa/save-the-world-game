# Critical Path AI Strategy Game - Development Guidelines

## Project Overview
This is a turn-based AI strategy game where players act as CEOs of AI companies navigating the race to AGI while balancing safety concerns. The game features complex mechanics including resource allocation, technology trees, minigames, and risk calculations.

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
- `endgame.js`: End game calculations and display
- `utils.js`: Shared utility functions

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
- AI Control requires AI Monitoring
- Military tech has complex dependency chains

### Minigame Integration
- Register minigames in the global minigame system
- Use consistent scoring and feedback patterns
- Update max scores in game state for progression tracking