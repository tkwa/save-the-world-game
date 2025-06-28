# Changelog

All notable changes to the Save the World Game will be documented in this file.

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