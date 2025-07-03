# Changelog

All notable changes to the Save the World Game will be documented in this file.

## Summary

- **v0.5.1** : Standard web hosting setup with mobile UX warning
- **v0.5.0** : Add intro sequence
- **v0.4.0** : Interpretability project; dynamic project unlocking system
- **v0.3.5** : Refactor consolidating shared functions to utils.js
- **v0.3.2** : Add Projects and Alignment minigame
- **v0.3.1** : Fixed event handlers; nuclear weapons now later in DSA tree
- **v0.3.0** : Competitor acquisition events and VP Safety role with unit testing
- **v0.2.0** : Projects panel system and humanoid robotics event chain  
- **v0.1.0** : Initial AI strategy game with turn-based gameplay and minigames

## [v0.5.1] - 2025-07-03

### Web Standards and Development Improvements
- **Standard Hosting Setup**: Renamed `savetheworld.html` to `index.html` for conventional web hosting compatibility
- **Mobile UX Warning**: Added responsive overlay warning users on screens <768px that desktop experience is recommended
- **Enhanced Code Quality**: Implemented 9 additional ESLint rules including strict equality, const preference, brace requirements, and security protections

### Technical Improvements
- **ESLint Rules**: Added eqeqeq, prefer-const, no-var, curly, no-new-func, no-global-assign, no-unreachable, no-duplicate-case, no-fallthrough
- **Code Consistency**: Fixed gameState declaration to use const instead of let per linting recommendations
- **Test Updates**: Updated test suite to reference new index.html filename for technology emoji validation

### User Experience
- **Mobile Detection**: JavaScript-based screen width detection with dismissible overlay warning
- **Professional Presentation**: Warning includes emoji indicator and clear messaging about optimal experience
- **Seamless Transition**: Existing users can continue playing without interruption on desktop browsers

## [v0.5.0] - 2025-07-02

### Major Features
- **Enhanced Intro Sequence**: Complete redesign with step-based text system, dynamic AI level display, and progressive narrative flow from 3.3x to ~10x AI capability
- **Technology Visibility Controls**: Implemented mainGameStarted flag system to hide all technologies except robotaxi during intro, revealing full tech tree only when main game begins
- **Flexible Text Display System**: Replaced linear text array with dictionary-based system allowing mixed timing (some texts every 2 clicks, intellectual tasks every click)

### Intro Sequence Improvements
- **Dynamic AI Level**: Button shows actual increase value (+0.XX) and AI level displays with "x" suffix matching main game
- **Compound Growth**: AI R&D increases by 3% of current level instead of flat amount, creating realistic exponential progression
- **Progressive Narrative**: 6 intellectual tasks (poetry, scientific reasoning, mathematical proofs, creative writing, strategic planning, persuasive communication) appear rapidly to show accelerating AI progress
- **Smart Text Flow**: Line breaks only appear where paragraph breaks should naturally occur, maintaining sentence continuity
- **Risk Progression**: Rogue AI Risk fades in at step 19 and progresses from 9% to 20% over remaining clicks

### Technical Improvements
- **Step-Based Architecture**: Text system uses step numbers as keys for maximum flexibility in timing and content
- **Performance Optimization**: Reduced excessive DOM manipulation with statusBarSetup flag to prevent repeated calls
- **Permanent Button States**: Added permanentlyDisabled flag to prevent button re-enabling after intro completion
- **Dynamic Content Updates**: AI level value updates in real-time within displayed text using regex replacement

### User Experience
- **Natural Flow**: Removed awkward line breaks between "board games" and intellectual capabilities list
- **Visual Consistency**: Intro status bar matches main game layout with proper 4-column structure
- **HTML Rendering**: Supports bold text and line breaks within text content for enhanced presentation

## [v0.4.0] - 2025-07-01

### Major Features
- **Interpretability Project System**: Complete implementation of labor-hour based interpretability research requiring 1B hours for 100% completion
- **Dynamic Project Unlocking**: Two-stage project unlock system with interpretability at 80 safety points and alignment at 320 safety points
- **Variable Project Display**: Projects section now shows different buttons based on unlock status rather than fixed layout
- **Enhanced Risk Calculations**: Interpretability reduces risk by factor of 1 + (progress / 100) in denominator alongside safety and alignment

### Project Mechanics
- **Progressive Unlock**: Interpretability unlocks first (80 safety), followed by alignment (320 safety) 
- **Labor-Hour Allocation**: Interpretability uses sqrt(hours/1000)*100 formula for realistic diminishing returns
- **Button Behavior**: Project buttons grey out other allocations when selected, max progress buttons disabled at 100%
- **Cost Structure**: All projects cost same as Safety R&D using Math.sqrt(playerAILevel)/2 formula

### User Interface
- **Tooltip Integration**: Updated risk tooltips to show all three factors (safety, alignment, interpretability) in calculation
- **Concise Labeling**: Interpretability button uses "Interp 🔬" for space efficiency
- **Selection State**: Project buttons properly integrate with allocation system showing selection status

### Event System
- **Restructured Events**: Modified safety-research-limitations event to unlock interpretability research first
- **New Alignment Event**: Created alignment-research-breakthrough event at 320 safety with compelling narrative
- **Event Conditions**: Added proper safety point thresholds for both interpretability (80) and alignment (320) events

### Technical Improvements
- **State Management**: Added interpretabilityProgress, interpretabilityLaborHours, and alignmentUnlocked to game state
- **Code Documentation**: Comprehensive project system guide added to CLAUDE.md for future development
- **Function Updates**: Extended getRiskFactors() and calculateAdjustedRiskPercent() to handle interpretability

## [v0.3.5] - 2025-07-01

### Major Refactoring
- **New utils.js Module**: Created centralized utility file containing all shared functions, constants, and game state factory
- **DRY Principle Implementation**: Eliminated code duplication by moving shared functions to single source of truth
- **Risk Calculation Consolidation**: Fixed inconsistent risk calculation formulas that were causing negative riskReduction values

### Technical Improvements
- **Script Loading Order**: Updated HTML to load utils.js first, ensuring proper dependency resolution
- **Cross-File Function Access**: Implemented proper global exports for browser environment and Node.js testing
- **ESLint Compliance**: Fixed all ESLint errors with proper global declarations and unused variable handling
- **Mathematical Consistency**: All risk calculations now use centralized getRiskFactors() function from utils.js

### Functions Moved to utils.js
- `GAME_CONSTANTS`, `INITIAL_TECHNOLOGIES`, `COMPANIES` array
- `createInitialGameState()` factory function
- `calculateAdjustedRiskPercent()`, `getRiskFactors()`, `getAISystemVersion()`
- `getRiskColor()`, `getGalaxyMultipliers()`

### Bug Fixes
- Fixed endgame.js duplicate risk calculation code to use shared functions
- Resolved "calculateAdjustedRisk is not defined" error in endgame calculations
- Fixed cross-file dependency issues and script loading order problems
- Eliminated formula inconsistencies between getRiskFactors() and generateActionLabels()

## [v0.3.2] - 2025-06-28

### Major Features
- **Complete Projects Allocation System**: Projects now fully integrated into turn-based allocation system with proper cost display, greying out behavior, and immediate minigame launch
- **Improved UI Layout**: Restructured allocation interface with "Sectors" and "Projects" headers, vertical divider, and proper button sizing

### Technical Improvements
- Projects apply allocation immediately when selected (unlike sectors which wait for turn advance)
- Added `allocationApplied` flag to prevent double-application of project costs
- Projects properly participate in mutual exclusion with sectors
- Removed redundant CEO display text and fixed empty paragraph rendering

### Bug Fixes
- Fixed alignment minigame not launching due to page refresh override
- Fixed allocation prompt boldness and "undefined" text display
- Fixed tooltip transparency inheritance on disabled buttons
- Increased project button height to accommodate 2-line cost text

## [v0.3.1] - 2025-06-28

### Bug Fixes
- Fixed TypeError in nuclear weapons, missile defense, and overseas datacenter custom handlers
- Handlers now correctly access `other_texts` via `event.originalEventData.other_texts`

### Improvements  
- Updated overseas datacenter event text to focus on US government compliance rather than sanctions
- Added conditional text for Chinese companies about "navigating US export controls"
- Changed "be above board" to "comply" for clearer language

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