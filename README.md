A WIP game to represent the AI singularity.

Done:
- Skeleton
- Capability evals minigame
- Forecasting minigame

TODO:
- Corrigibility evals minigame
- Alignment evals minigame
- Alignment minigames
- Events

# Critical Path: a turn-based game

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

Spending: Every turn, the player can choose between allocating all their resources ($) to
  * AI R&D (immediately turned into AL)
  * Diplomacy R&D (DP)
  * Product R&D (PP)
  * Safety R&D (SP; each SP gained also decreases XL by 3%)
  * None

More $ are generated the higher the AI level is: f(1) = 1, f(99) = 9. floor(sqrt(max(1, AL - OL))) is reasonable.

Status bar: 3 columns. All values are ints.
* AI Information
    * Player AI Level (AL)-- 10 - 100, starts at 10.
    * Doom Level (XL)-- 0 - 100, starts at 20, increases with XL
        * Instant game over if doom >= 100; in this case all AIs are misaligned
        * Otherwise doom happens with Doom Level % at game over
    * Open-source AI level (OL)-- 2 - 100
        * Player must always stay ahead of this. It increases by floor(sqrt(max(1, OL / 8))).
* Corporate Divisions
    * DP / PP / SP
* Status effects: Sanctions, UN Recognition

Plot ideas
* Pause track
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
* International treaty (requires 2 Evals, 10 SP): Unrestricted AI development poses an unacceptable risk of catastrophe. [name] has drafted a treaty that places development of frontier AI under an international body of neutral observers. However, treaties are a messy, bureaucratic process, and this document codifies today's best guess at an alignment protocol-- it will only cut existential risk by half, not eliminate it. (-6 DP, -50% XL) (Leads to end screen with AL and OL proportionally scaled up to 100) / Not yet


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