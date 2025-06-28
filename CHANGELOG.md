# Changelog

All notable changes to the Save the World Game will be documented in this file.

## [v0.3.0] - 2025-06-28

### Major Features
- **Competitor Acquisition Event**: Added complex merger/acquisition mechanics when a competitor reaches 2x player's AI capability level. Players can choose to merge and become VP of Safety and Alignment with reduced scoring multiplier (11x vs 20x) but focus on humanity's benefit.
- **Dynamic Endgame Scoring**: Implemented separate scoring for merged vs independent companies, with shareholder assessment using original company name while galaxy allocation uses current company.
- **VP of Safety and Alignment Role**: New career path that changes player incentives from profit maximization to humanity optimization.

### Gameplay Changes
- Acquisition event triggers when any competitor reaches 2x player AI level with weight 2
- Merger removes the acquiring competitor from the game (reduces to 2 competitors total)
- Player inherits the superior AI capabilities and receives resource bonuses scaled to new capability level
- Projects panel automatically unlocks upon merger if not already available
- Safety points preserved during merger while other resources receive capability-based bonuses

### Technical Improvements
- **Unit Testing Framework**: Added comprehensive test suite with 12 test cases covering event availability, merger mechanics, and endgame scoring
- **Test Runner**: Created browser-based test runner for easy validation during development
- Fixed safety incident calculation bug to properly use adjusted risk instead of raw doom level
- Enhanced variable substitution system for complex event text generation

### Bug Fixes
- Safety incidents now correctly respect safety research and alignment investments (was using raw doom level, now uses adjusted risk)
- Corporate espionage investigation event only enters pool when espionage is actually attempted

## [v0.2.0] - 2025-06-28

### Major Features
- **Projects Panel System**: Added gated alignment research that unlocks at 100 safety points, replacing immediate access to alignment minigames.
- **Humanoid Robotics Event Chain**: Expanded robotics progression from Boston Dynamics acquisition to humanoid robots to nuclear weapons manufacturing.
- **Technology Visibility Overhaul**: Implemented flexible technology icon system that responds to game events and achievements rather than simple dependencies.

### Gameplay Changes
- Alignment and Monitoring tech icons now require Projects panel unlock
- AI Interpretability is always visible from game start
- Robotics event changed to Boston Dynamics acquisition ($3B, -1 Diplomacy, -1 Product)
- Added humanoid robotics development event ($6B, -5 Product) as prerequisite for nuclear weapons
- Alignment technology automatically lights up when player achieves >0% alignment score
- Circle growth in alignment minigame now slows by 50% after reaching 120px radius

### Technical Improvements
- Refactored event handling system for consistency across all event types
- Eliminated code duplication in event handlers and choice processing
- Removed unused functions and cleaned up codebase (70+ lines of dead code)
- Added ESLint configuration for better code quality
- Improved Projects panel styling with dark green buttons

### UI/UX
- Renamed "Research" section to "Projects" 
- Projects panel hidden until unlocked through safety research milestone
- Enhanced event button text with emoji indicators for technology unlocks
- Improved visual feedback for technology progression

## [v0.1.0] - 2025-06-27

Initial release of the AI strategy game featuring turn-based gameplay where players act as CEOs navigating the race to AGI. Core mechanics include resource allocation across AI R&D, safety research, diplomacy, and product development, with complex risk calculations, technology trees, alignment minigames, and multiple ending scenarios based on player choices and AI alignment outcomes.