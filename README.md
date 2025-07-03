A WIP game to represent the AI singularity.


## To run

Open `savetheworld.html` in a browser, e.g. by using Cursor Live Preview or `python -m http.server 8000`.

## Status

TODO for Claude (check off when finished):
- [ ] Decide what other rules should be added to the linter




Still deciding on details...
- [ ] Move game to index.html
- [ ] On mobile, add a warning to the home screen saying the game is best experienced on desktop. I'm thinking check for screen width unless there's a better way
- [ ] Bump patch version

- [ ] Integrate capabilities minigame as capabilities forecasting
- [ ] Add Greedy status effect that doubles your own galaxy values but halves humanity galaxy values, when you get $10T
- [ ] Add event for completed international treaty (when progress reaches 2000)
  - [ ] Create treaty-completed event in events.json with proper narrative
  - [ ] Implement completion trigger when internationalTreatyProgress >= 2000
  - [ ] Add game state changes (pause track, end AI race mechanics)
  - [ ] Update endgame logic to handle treaty completion scenario


Longer term goals -- Claude shouldn't start these yet
- [ ] Inter-company relations module (minor version)
  - [ ] Lobby for/against antitrust, spending all your diplomacy points. Or decline
    - All countries start with antitrust
    - For: keeps your competitors small if you're leading, mergers can hasten the singularity, ...
    - Against: allows you to merge if behind, mergers can be good for safety, ...
  - [ ] Formulas for the fair value of a company in terms of their AI level, consistent with existing TAM math
  - [ ] competitor-acquisition-forced event
    - While two competitors are both 2.5x ahead of you, there's a forced acquisition event with weight 3. Description says it's clear that without merging you will fall hopelessly behind in the ASI race, and several employees threaten to quit if no merger happens, so you offer to sell yourself to the two leading companies. They offer you the same equity percent, 70% of the "fair value". You only have the choice of who to merge with and are told a merger is more likely to succeed between countries with better relations and where antitrust is not a concern. The choices are "Pick $companyA" and "Pick $companyB". This can only happen below 100x AI; above that someone else will soon get ASI anyway
    - The chance of success is baseline 70%, modified by a country and antitrust modifier. Country modifier is x0.4 if US/CN and no 3rd country flag infrastructure, x0.7 if UK/CN (or US/CN if your company has a flag infra), x1.3 if allied or same countries. Antitrust modifier is (1 - combined market share).
    - On success, you become Head of $originalCompany Division, $newCompany. "You retain a surprising amount of influence in $parentCompany's decisions, but the experience makes you disillusioned with humanity, and you continue going to work 
  mainly to enrich yourself." Then the value of humanity galaxies gets halved in the end screen, and the selfishness in 
  the role tooltip doubles. This is implemented as the Disillusioned status effect.
    - On failure, immediate game end. A message says the company dissolves, you and other shareholders invest the proceeds in AI stocks, then you are taken to a version of endgame phase 3 where you have 0.01\% equity
  - [ ] strategic-blocking-acquisition event
    - Intelligence reports that $CompetitorA is close to acquiring $CompetitorB for $fairValueB, which would create a $combinedLevel AI capability rival. You could outbid them to prevent this consolidation.
    - Choices:
      - "Outbid with cash (-$fairValueB * 1.2, prevent rival mega-merger, acquire $CompetitorB)"
      - "Outbid with equity (-$CompetitorB_level Diplomacy, dilute equity by $fairValueB * 1.4, acquire $CompetitorB)"  
      - "Let the consolidation happen (risk facing $combinedLevel competitor)"
- [ ] Intra-company relations module (patch version)
  - [ ] Your head of research wants to leave to start a competitor because $company is neglecting safety. (requires overseas datacenter) Choose to offer them equity (reducing your share by 10-30%), promise to pause AI R&D for 6 months, or let them leave. If they leave they take your overseas datacenter(s)
  - [ ] Board fight event (multi-stage allocation-based)
    - **Instigating Event**: "Board Crisis" - Board challenges your authority over strategic direction. Three stakeholder groups emerge with conflicting preferences:
      - Employees prefer AI R&D allocations (technical leadership focus)
      - Investors prefer Product allocations (market growth focus) 
      - Government prefers Safety R&D allocations (responsible development)
    - **Mechanics**: Player must allocate toward stakeholder preferences for 2+ of next 5 turns to win their support. So it's only possible to satisfy 2 out of 3 groups maximum.
    - **Final Event**: "Board Vote Resolution" - Outcome depends on coalition built:
      - **Employees + Investors**: 2x equity, 1.25x risk multiplier
      - **Employees + Government**: 1.5x equity, government controls your allocation next turn (random: diplomacy/product/safety, overridden by superpersuasion effect)
      - **Investors + Government**: Gain datacenter
      - **No Government support**: Sanctions imposed
      - **Government only**: 0.75x equity (isolated position)
- [ ] Safety projects module
  - [ ] Interp minigame and effects
  - [ ] Monitor minigame
    - Available at 160 safety research?
  - [ ] Control minigame and effects-- unlocked when monitoring 
  finished
    - Control has three things that can be improved
      - Red team
      - Monitor
      - Control protocol
  - [ ] Alignment now requires 300 safety research to start

  - [ ] Neuralese event
    - Makes monitoring/control progress impossible until interpretability reaches some values
- [ ] Politics/geopolitics module
  - [ ] China blockades Taiwan
    - Use [drones/nukes/bioweapons] to help one side or the other
  - [ ] Run for president
    - Happens in Dec-March 2028 in China, 
    - Disallowed if you have a second overseas datacenter
- [ ] Intro phase
  - [ ] Interface elements are slowly revealed as : phase system
  - AI R&D -> Revenue -> Safety R&D
- [ ] AI manipulation module
  - The basic idea is that a superpersuader AI that is unsafe will be pushing you away from safety
  - This could involve physical manipulation / dark patterns, textually convincing you to not do safety, 
  - Ideas
    - Urgency / peer pressure:
      - "It's only X turns until a competitor will reach AGI"
      - "You reflect on how galaxies are worth 100x more when owned by you than by humanity.
    - Physical / interface changes
      - AI R&D button is green, safety is dark red
      - Safety R&D gets a warning icon
      - Safety R&D keyboard shortcut disabled and 
      - "Auto-select Recommended" slider selects AIRD most of the time
      - Friction: Safety button requires multiple confirmations, capabilities is one-click. 
      - AI R&D is in the position of the button you clicked last
    



- [ ] Neuralese event that disrupts monitoring and control without sufficient interpretability
- [ ] Some way to slow down AI progress
- [ ] Integrate forecasting minigame as a project


Techs to add functionality for
- [ ] AI Research Lead. AI R&D should reach diminishing returns after 20 unless this is unlocked (perhaps scaling as 0.7 power beyond 20x), and this should be unlocked by an event with costs
- [ ] AI Novelist-- should be activated by persuasion
- [ ] Synthetic Biology-- should double revenue
- [ ] Cancer Cure-- should be Life Extension, an effective cure to aging. Succeeding at this should cancel Disillusioned or create Hopeful, which multiplies score from humanity galaxies by 1.2
- [ ] Brain Uploading-- should go disillusioned -> nothing, nothing -> Hopeful, Hopeful -> Inspired, which multiplies score from humanity galaxies by 1.5
- [ ] Cyberwarfare-- should unlock early on, say 8x, with a flavor event
- [ ] Bioweapons-- Should allow a rogue AI majority to defeat humanity. After Synthetic Biology, there should be an event that tempts you to develop them, but you can instead choose biosafety tech. Perhaps you get a contract from your government for a large amount of money and diplomacy, 
- [ ] Killer Drones: Revealed at a random time after Robotics


Ideas:
- Consider other ways to organize the turn
  - real-time? David says this would be a huge engagement boost, but it might be hard to implement / balance
    - minimum delay between allocating resources
    - how to deal with events?
  - an "available items" section of things you can always spend on?
    - this is appropriate for the setting
    - 

## Critical Path: a turn-based game

1 month per turn, game takes place over the course of 2026-2027, around 25 turns.

Goal is to save the world as a top AI lab. At the start the name is randomly assigned between OpenAI, Anthropic, Google, Amazon, Tencent, xAI.

End score is the sum of:
0x galaxies controlled by rogue AI
10x galaxies controlled by humanity at large
20x galaxies controlled by player.
So 10% rogue AI, 70% everyone else, 20% you --> 1100

Every turn, there is a spending phase and action phase.

Directions
* Foundational science --> Pick correct alignment direction --> solve alignment --> get other companies to implement
* Evals --> wake up government --> pause + international treaty
* Get alignment from someone else

Plot ideas
* Coordination track
  * The company realizes (Safety: Evals, Forecasting) that alignment is too hard for them to solve while in full race mode. They convince everyone (Diplomacy) to slow down / pause, and their success depends on their existing lead.
  * Should be able to commit to this one late if sufficient diplomacy.
* Alignment track (default)
  * The company is able to thread the needle such that they stay ahead in the capabilities race while solving alignment (Safety). Possibly this involves taking alignment insights (Diplomacy) from another lab
* DSA track (most difficult)
  * The lab makes the transition from company to nation-state-equivalent actor to global hegemon
  * Risks: being nationalized, sanctions, nuclear war, rogue AIs.
  * Robotics -> nuclear weapons -> pure fusion weapons?

### Events
* Sanctions: always occurs iff Sanctions status effect. Resources are halved rounded up. Remove (-$3, -3 DP)
* Safety incident: Chance is equal to XL^2. Player is fined $k on the k'th occurence
* Nothing-- flavor text only
* Model release-- occurs every 3 turns; proceed (+$, can backfire with low safety level), or wait
* Forecasting minigame: on success, XL is visible rather than just very high ... very low
* Evals minigame: get 2 of each resource on success
* Overseas datacenter-- creates 1 AL / turn. Must pay $2 + 3 DP, $3 + accept sanctions, or decline.
* Safety breakthrough: The safety team has made a small breakthrough; however, there are not enough resources to apply it to both current models and superintelligences. Research applications to superalignment (-5 SP), or current models (-3 SP, +1 DP)
* Product breakthrough (medicine): Research (-4 PP, +$1/turn) / Decline
* Product breakthrough (robotics): Research (-4 PP, +$1/turn) / Decline
* Safety release-- The public demands you release safety research; however, your safety techniques are entangled. Publish (1 SP; -10% XL; 50% chance of increasing the public AI level by [0, 10]) / Decline
* Evals: pay 2 Safety Research to multiply XL by a value in [0.3,1.7].
* International treaty: Unrestricted AI development poses an unacceptable risk of catastrophe. [name] has drafted a treaty that places development of frontier AI under an international body of neutral observers. However, treaties are a messy, bureaucratic process, and this document codifies today's best guess at an alignment protocol-- it will only cut existential risk by 75%, not eliminate it. This treaty will end the AI race (Leads to end screen with AI levels proportionally scaled up to 1000) / Not yet

Capabilities breakthrough
* Automated AIRD
* Correlations game: Gives AI Research Lead (better AIRD scaling)

Alignment track:
* AI monitoring

* AI Control
  * Gives a reroll to endgame alignment
  * maybe also gives a reroll to safety incidents?
  * The base risk score calculates
  * Minigame: something outputs suspiciousness scores
* Alignment
  * Reduces the rate at which AI R&D causes risk, retroactively
  * Minigame: expanding circles
* Interpretability
  * 



DSA track: 
Nation-states are more powerful than even the largest companies. An entity must meet four conditions to be classified as a state: sovereign territory, an economic base, military power, and international recognition. 
* Nuclear weapons (requires Product breakthrough (robotics)): The US government normally tries extremely hard to prevent unauthorized actors from building nuclear weapons, but global crises mean that it no longer has the capacity. In its robotics business, [name] encounters the materials and manufacturing. Developing a nuclear device would give [name] true independence against needless regulation. Proceed (-2 PP, -2 DP, 50% chance of sanctions, +3 XL) / Decline
* Seek UN Recognition (requires Overseas datacenter, resources >= 6, Nuclear weapons): Forced choice, 1.5x monthly resources, doubles monthly DP per resource.
* Missile defense (requires UN Recognition): Nuclear-armed states like the US and Russia pose a serious problem for [name]'s security, as their missiles can threaten its datacenters from thousands of kilometers away. However, a combination of cyberweapons and interceptor drones can mitigate this risk.  Proceed (50% chance of sanctions, +5 XL) / Decline
* Decisive strategic advantage (requires Missile defense, AL > OL + 20): [name]'s lead in both general AI and military technology could allow it to establish global hegemony. However, this will require giving its frontier model complete control over weapon systems. If the model is misaligned, there is no turning back. Proceed (Leads to end screen with AL immediately set to 100) / Not yet

### End screen

If AL or OL reaches 100 after a turn, we automatically go to the end screen. The player's AL and the open-source OL determine how the cosmos is split, then each rolls independently for misalignment using XL.

Player's AI: (AL - OL) / 100
Other AIs: (100 - (AL - OL)) / 100

If an AI is misaligned its galaxies go in the rogue AI category rather than player / humanity at large.

Finally the score is computed as above, and the end screen is displayed.

### Balance

There should be about 40 turns

If safety cuts risk by a relative percent based on cumulative investment, it could be
- safety factor = 1 / 1 + (safety investment / X)

If risk continues being proportional to AI level...

We want risk to be cut by ~10x with 1000 investment, and for there to be diminishing returns, so that 1000 capabilities gives 1000 raw risk -> 100 risk. 


### Brainstorming

Need: 
* Who is the player? Do they have to do diplomacy themselves?
    * Frontier lab
        * focus on balancing safety vs corporate race, lobbying, achieving DSA
    * US government
        * Manhattan project; balancing safety vs beating China
    * Safety community
        * Getting enough resources, research direction, waking up government
* How is the score calculated?
* Real time or turn-based?
* What are the key resources?
* How much geopolitics to include?

### Possible features to add

Safety directions: interpretability, control, value alignment