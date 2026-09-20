# Claude Code Session Summary: Critical Path Game Development

## Overview
This session involved extensive development of "Critical Path," a turn-based AI strategy game where players act as CEOs of AI companies navigating the race to AGI while balancing safety concerns. The game evolved from initial concept to a fully-featured dark-themed strategy experience with comprehensive systems overhaul.

## Major System Implementations

### AI Capabilities Status Bar Redesign
- **Competitor System**: Changed from single open-source AI level to list of 3 top competitors (8, 6, 4 starting levels)
- **Company Names**: Random assignment of player company and 3 competitors from pool (OpenAI, Anthropic, Google, Amazon, Tencent, xAI)
- **Geometric Distribution**: Competitors increase using continuous exponential distribution with inverse CDF sampling
- **Visual Formatting**: Competitor levels displayed as comma-separated list without spaces

### Resource/AI Capability System Rebalancing
- **Power Law Scaling**: Implemented X^0.8 formulas for diminishing returns on resource allocation
- **Infrastructure Integration**: Datacenters provide 20% AI labor boost stacking additively
- **Sanctions Mechanics**: Only affect base compute, not datacenter bonuses (overseas datacenters protected)
- **Resource Calculation**: `baseCompute = playerAILevel; if (sanctions) baseCompute /= 2; totalResources = baseCompute * (1 + datacenterBoost)`

### Infrastructure Tracking System
- **Three Infrastructure Types**: Datacenters (🏢), Power Plants (⚡), Biotech Labs (🧪)
- **Visual Indicators**: Multiple icons shown with proper spacing using `Array().fill().join(' ')` method
- **Tooltips**: Detailed explanations for each infrastructure type's benefits
- **Requirements**: Only Synthetic Biology requires biotech labs (not medicine breakthroughs)

### Technology Tree Expansion
- **Alignment Technologies**: Monitoring (👁️), Control (🎛️), Alignment (🧭), Interpretability (🔬)
- **Military Technologies**: Cyber Warfare (🔓), Bioweapons (☣️), Killer Drones (🦟), Nuclear Weapons (☢️)
- **Civilian Technologies**: Arranged in three columns with proper spacing and tooltips
- **Column Layout**: Civilian | Alignment | Military with 15px gaps between columns

### Event System Architecture  
- **Complete DSA Track**: Overseas Datacenter → Nuclear Weapons → UN Recognition → Missile Defense → Decisive Strategic Advantage
- **Risk Mechanics**: Probabilistic sanctions system (85% chance for unauthorized datacenter construction)
- **Event Requirements**: Prerequisites system ensuring logical progression through technology tree
- **Custom Handlers**: Specialized functions for events with complex risk/reward mechanics

### Game Balance and Display
- **Resource Rounding**: All resource displays (funds, diplomacy, product, safety) show rounded whole numbers
- **Safety R&D Display**: Shows absolute risk decreases instead of relative percentages
- **Funds Display**: Rounds down to whole billions for cleaner presentation
- **Competitor AI Levels**: Round to whole numbers for clarity

### User Interface Overhaul
- **Dark Theme Implementation**: Complete visual redesign with professional dark color scheme
- **Status Bar Formatting**: Color-coded indicators (red for danger, amber for warnings, green for positive effects)
- **Smart Button States**: Event action buttons grey out when unaffordable instead of showing popup errors
- **Resource Allocation Buttons**: Converted from radio buttons to action buttons with immediate resource application

## Game Design Improvements

### Narrative and Flow
- **Streamlined Headings**: Removed redundant "Turn X" formatting, simplified to "July 2026"
- **Better Game Setup**: Enhanced second-screen description explaining the CEO's strategic dilemma
- **Event Integration**: Events flow naturally after resource allocation without separate panels

### Resource Management
- **Immediate Application**: Resources apply when allocation button is clicked, not at end of turn
- **Visual Feedback**: Clear indication of sanctions impact ("5 resources (10 resources x 50% sanctions factor)")
- **Button State Management**: Selected allocation button highlighted, others greyed out until next turn

### Strategic Depth
- **Product Breakthroughs**: Medicine and robotics events providing ongoing economic benefits
- **Geopolitical Realism**: Datacenter locations reflect real-world AI infrastructure considerations
- **Risk Escalation**: "Rogue AI Risk" label becomes red and bold at >75% for critical warnings

## Technical Architecture

### Code Organization
- **Modular Functions**: Separated concerns with dedicated functions for resource calculation, event generation, and UI updates
- **State Management**: Clean game state reset functionality and proper turn advancement logic
- **Error Prevention**: Eliminated popup dialogs in favor of disabled button states

### Event JSON Structure
```json
{
  "type": "event-name",
  "weight": 4,
  "requires": ["prerequisite-events"],
  "oneTime": true,
  "text_versions": ["Multiple narrative variants..."],
  "choices": [
    {
      "text": "Action description (-cost, +benefit)",
      "action": "accept",
      "cost": {"productPoints": 4, "money": 2},
      "benefit": {"incomeBonus": 1},
      "result_text": "Consequence narrative..."
    }
  ]
}
```

### UI Component System
- **Dynamic Action Labels**: Buttons show actual resource numbers ("AI R&D (+3 AI Level, +3 Risk)")
- **Conditional Styling**: Status bar elements change color based on game state
- **Responsive Button States**: Event actions enable/disable based on affordability and allocation status

## Quality of Life Features

### Visual Polish
- **Consistent Typography**: Monospace font throughout with proper bold formatting
- **Color Psychology**: Red for danger/depletion, amber for moderate warnings, green for positive effects
- **Clean Event Display**: Removed yellow panels in favor of integrated dark theme styling

### User Experience
- **No Popup Interruptions**: All resource validation through visual button states
- **Clear Progression**: Turn advancement only possible after resource allocation
- **Immediate Feedback**: Status bar updates instantly when resources change

## Game Balance and Mechanics

### Resource Economics
- **Corporate Resources**: Expire each turn unless used, separate from saved money
- **Sanctions Impact**: Meaningful economic penalties requiring strategic response
- **Income Diversification**: Product breakthroughs provide alternative revenue streams

### Strategic Choices
- **Risk vs. Reward**: DSA track offers power at the cost of increased risk and sanctions risk
- **Resource Allocation**: Five distinct paths (AI R&D, Diplomacy, Product, Safety R&D, Revenue) with clear tradeoffs
- **Event Responses**: Meaningful choices with lasting consequences tracked throughout the game

## Technical Challenges Resolved

### Infrastructure Display Issues
- **Problem**: Emoji spacing using `&thinsp;` and string manipulation caused "character not found" icons
- **Solution**: Replaced with `Array().fill().join(' ')` method using regular spaces for proper emoji rendering

### Geometric Distribution Implementation
- **Issue**: Initially used discrete geometric distribution instead of continuous exponential
- **Fix**: Implemented proper continuous distribution using inverse CDF sampling: `x = -ln(U) / λ`

### Technology Requirements
- **Confusion**: Medicine vs Synthetic Biology biotech lab requirements
- **Clarification**: Only Synthetic Biology requires biotech labs, medicine is standalone drug discovery

### Event Button Text Updates
- **Change**: Updated "Accept sanctions" to "Risk sanctions" for clearer player understanding
- **Context**: Better communicates the probabilistic nature of sanctions in overseas datacenter construction

## Current Game State Summary
The game now features a comprehensive AI strategy simulation with:

### Core Systems
- **Balanced Resource Economy**: Power law scaling with infrastructure bonuses and sanctions mechanics
- **Dynamic Competitor AI**: Exponential growth using proper continuous distribution 
- **Three-Column Technology Tree**: Civilian, Alignment, and Military technologies with tooltips
- **Infrastructure Tracking**: Visual indicators for datacenters, power plants, and biotech labs
- **Probabilistic Event System**: Risk-based sanctions and complex multi-stage events

### Visual Design
- **Professional Dark Theme**: Consistent monospace typography with color-coded status indicators
- **Comprehensive Tooltips**: Detailed explanations for all game mechanics and technologies
- **Clean Status Bar**: AI capabilities, resources, infrastructure, and technology progression
- **Rounded Displays**: All numbers show as clean whole values for better readability

### File Architecture
- `game-core.js`: Main game logic with resource calculations and status bar updates
- `events.js`: Event system with custom handlers for complex mechanics  
- `events.json`: Event definitions with probabilistic choices and requirements
- `savetheworld.html`: UI layout with tooltip system and dark theme styling

The game provides a realistic simulation of AI company strategy with meaningful tradeoffs between growth, safety, and geopolitical considerations.

## TODO: Testing and Debug Infrastructure

### Smoke Test Implementation
- **Single Integration Test**: Create one comprehensive test that simulates a complete game playthrough
  - Start new game → allocate resources for 3-5 turns → trigger event → make choice → reach endgame
  - Use Puppeteer/Playwright to automate browser interactions
  - Verify key milestones: status bar updates, event generation, endgame trigger
  - Focus on "does the game work" rather than "is every detail correct"

### Debug Utilities for Manual Testing
- **Console Commands**: Add global functions accessible from browser console
  - `setGameState({playerAILevel: 500, rawRiskLevel: 80})` - Jump to specific scenarios
  - `fastForward(turns)` - Skip ahead multiple turns quickly
  - `triggerEvent('nuclear-weapons')` - Force specific events for testing
  - `unlockAll()` - Enable all technologies and events for exploration
  
- **Scenario Presets**: Quick setup for common test cases
  - `scenarios.highRisk()` - 90% risk, low safety research
  - `scenarios.richCompany()` - High money, low AI level
  - `scenarios.nearASI()` - Close to singularity threshold
  - `scenarios.sanctions()` - Active sanctions scenario

### Import/Export Game State
- **JSON Serialization**: Convert entire gameState object to/from JSON
  - `exportGame()` → copies JSON to clipboard
  - `importGame(jsonString)` → loads saved state
  - Include all game variables: resources, events seen, technology unlocks, turn number
  - Useful for reproducing bugs and sharing specific game situations

### Implementation Context
- **Integration Points**: 
  - Add debug functions to `window` object in game-core.js
  - Create new `debug.js` file for utility functions
  - Use existing `gameState` object as single source of truth
  - Leverage existing `updateStatusBar()` and `showPage()` for state refresh
  
- **Development Workflow**:
  - Manual testing becomes faster with scenario jumping
  - Bug reproduction easier with state export/import
  - Smoke test catches major breaks during refactoring
  - No maintenance overhead during rapid development phase