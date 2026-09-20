# Presidential Campaign Event System

## Overview
A multi-stage event system where the player can run for President of the United States in 2028, fundamentally changing the game mechanics if they win.

## Event Timeline

### April 2028: Presidential Election Announcement
**Event: "Presidential Campaign 2028"**

**Trigger conditions:**
- Month: April 2028
- Required: Normal Persuasion technology unlocked
- Penalty: -20 Diplomacy if company is Chinese (foreign interference concerns)

**Event text:**
"The 2028 presidential election approaches. Your AI advisors identify a critical opportunity: with advanced persuasion technology, a well-funded candidate could reshape American AI policy from the Oval Office. However, running would expose you to unprecedented scrutiny and potentially transform your role from CEO to Commander-in-Chief."

**Choices:**
1. **"Run for President" (unlocks Presidential Campaign project)**
   - Unlocks Presidential Campaign project
   - Public announcement triggers media attention
   - Begin polling at 15% (modified by diplomacy/reputation)

2. **"Decline - focus on technology"**
   - Continue normal gameplay
   - No further presidential events

### Presidential Campaign Project
- **Cost**: $1B + all available Diplomacy points
- **Progress**: Tracks polling numbers (0-100%)
- **Mechanics**: 
  - Base polling increases by 5-15% per turn based on spending
  - Random events can boost or hurt polling
  - Superpersuasion technology provides +10% bonus per turn
  - Chinese company penalty: -5% per turn

### November 2028: Election Results (Exit Polls)
**Event: "Election Night 2028 - Exit Polls"**

**Event text:**
"Election night arrives. Early exit polls show a tight three-way race between you, VP JD Vance (Republican), and Secretary Pete Buttigieg (Democrat). News networks hesitate to call the race as polling data fluctuates throughout the evening..."

**Choice:**
- **"Continue" (only option)**

### November 2028: Final Results
**Event: "Election Night 2028 - Final Results"**

**Outcome determination:**
- Player polling % determines win probability
- Win probability = 9 * polling^3

**Result text (if won):**
"BREAKING: In a stunning upset, you have been elected President of the United States. Your victory speech, optimized by AI for maximum emotional impact, promises a new era of American technological leadership. The transition team begins immediately..."

**Result text (if lost):**
"Despite a well-funded campaign, you concede defeat to [winner]. Your political advisors suggest various options for the future, including potential legal challenges..."

### January 2029: Inauguration OR Overturn Option

#### If Player Lost Election:
**Event: "Overturn the Election" (only if Superpersuasion unlocked)**

**Event text:**
"Your superpersuasion AI has identified systematic vulnerabilities in the electoral process. Deep analysis of voting patterns, social media influence, and information flows suggests the election results could be challenged through coordinated campaigns targeting key demographics and election officials..."

**Choices:**
1. **"Overturn the results" (-50 Diplomacy, high risk)**
   - 60% chance: Successfully become president through "legal challenges"
   - 40% chance: Massive backlash, lose all political capital, potential sanctions

2. **"Accept the results"**
   - Return to normal gameplay

#### If Player Won Election:
**Event: "Inauguration Day 2029"**

**Automatic changes upon becoming president:**
- **Equity**: Reduced to 0.1% (blind trust requirements)
- **Status Effect**: Gain "Hopeful" (+20% to humanity galaxy values)
- **UI Changes**:
  - Background: American flag
  - Role: "President of the United States 🇺🇸"
  - Company: "USA"
  - US flag appears in infrastructure column
- **Resources**: 
  - Gain $15 trillion (federal budget control)
  - Gain $1 trillion per month (ongoing federal spending)
  - Money is effectively infinite for rest of game
  - Gain 2 datacenters
- **Gameplay Changes**:
  - All allocation buttons except Diplomacy and AI R&D replaced with Executive Orders costing Diplomacy
  - Your company's AI level is kept and becomes the USA AI level
  - Diplomacy is doubled
  - Sectors replaced with Executive Actions
  - Events stop appearing

## Executive Orders System

Available Executive Orders randomly replace normal allocation buttons.

### **Regular orders** 

- **"Domestic AI Pause"** (-50 Diplomacy)
  - American company AI levels frozen for 3 turns

- **"China AI Sanctions"** (-20 Diplomacy, Chinese company AI levels half speed for 2 turns)
  - Export controls on semiconductors and cloud services

- **"Develop $technology"** (-? diplomacy depending on tier)
  - Immediately develops an available technology

- **"AI Kill Switch Mandate"**
  - All AI systems must have government backdoors
  - Rogue AI Risk

- **"AI National Emergency"** (-100 Diplomacy, unlock emergency power options)
  - Suspend normal laws during "AI crisis"
  - Enables next tier of actions

- **"Found / Expand CAISI"** (-20*2^n Diplomacy)
  - On n+1th occurrence, add passive safety income of 20*2^n

- **Reroll**
  - Rerolls other events for next month

### **Emergency Powers**

- **"Nationalize $otherCompany"** (-30 Diplomacy, -$1T)
  - Seize competitor facilities under Defense Production Act
  - 50% chance that an American competitor is removed. If so
    - Your AI level becomes the higher of yours and theirs
    - They stop appearing in the competitors list
    - You get two datacenters

- **"Sabotage Foreign AI"** (-100 Diplomacy, risk of war)
  - CIA/military cyber attacks on Chinese AI infrastructure
  - Requires Cyber Warfare
  - 50% to destroy a random percentage of Chinese datacenters, slowing their progress by that amount
  - 50% chance triggers nuclear standoff, if no missile defense
  - Risk: Nuclear escalation

- **"Suspend Civil Liberties"** (-200 Diplomacy)
  - Martial law to prevent interference
  - All actions cost 50% less diplomacy going forward
  - Permanent authoritarian transformation

### **Authoritarian Powers**

- **"Global Conquest"** (-400 Diplomacy)
  - Requires missile defense
  - Starts "Global Conquest" endgame path

## Events

- Nuclear standoff
  - Only possible if no missile defense
  - China threatens to nuke you

- Global conquest path ending in authoritarian victory where you personally own up to half the galaxies?

## Implementation Notes

### UI Changes for Presidency
- New CSS class for American flag background
- Modified allocation panel with executive order buttons
- Presidential seal/imagery integration
- Updated status bar styling

### Possible Changes

- Race contested by other AI companies?