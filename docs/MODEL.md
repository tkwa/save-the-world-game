# <span class="ai-marker" role="img" tabindex="0" aria-label="AI-written article" data-tooltip="This article was written by AI.">✨</span> Model assumptions

Critical Path explores Thomas Kwa's worldview through a small quarterly strategy model. Its coefficients make strategic tradeoffs playable; they are not estimates fitted to data or a forecast. Future events involving real labs are fictional possibilities viewed from January 2026. Lab bonuses are game parameters. [AI 2027](https://ai-2027.com/) and [AI 2040](https://ai-2040.com/) provide secondary scenario inspiration.

## Timeline and outcomes

The reference assumptions are roughly 20% existential risk, ASI between Q4 2027 and 2034, economic output doubling in the first year after ASI and accelerating thereafter, and aging and nanotechnology solved within two years. Mature nanotechnology permits nearly arbitrary arrangements of uncontested matter, subject to energy and logistics constraints. Dyson-swarm construction begins in the ASI year and takes 3.5–80 years. Strong, sustained coordination can delay ASI toward 2040. These assumptions describe the intended scenario range, not a guarantee for every policy or seed.

`campaign.js` implements quarterly competition and a short transition act. Capability is displayed on the Epoch Capabilities Index (ECI) scale, starting at 155 for the player’s lab; this scenario sets ASI at 225. Finances are denominated in stylized billions of US dollars per quarter. Research, trust, influence, and institutional indices summarize mechanisms without claiming calibrated real-world units.

Each lab contributes a conditional probability of permanent loss of human control in the current quarter. The display separates the player's lab from all other labs. The model is almost zero below ECI 190, rises steeply before and through the game's ASI threshold, then approaches a ceiling set mainly by alignment. Control, evaluations, and interpretability suppress the player's risk most strongly from ECI 180 to 225, with diminishing effect toward 225. Other labs use their own safety and security levels; public safety work can improve them. Competing hazard rates combine these probabilities without counting the same quarter twice.

The displayed percentages use the current state. Growth, research, and a decision can change the hazard before the quarter's draw. The game draws once per quarter after its last decision. If a lab reaches ASI, the draw waits for the player's authority choice instead. An early draw can produce a pre-ASI takeover; the game leaves later survival, welfare, and technology unknown. These draws use a separate deterministic stream, so a save or render cannot reroll them. The coefficients are scenario assumptions, not measured risks for the named labs or a calibrated forecast. Existing saves without the quarterly-risk marker retain the older transition-only rule.

Human flourishing (0–100), human control (percent), and personal ownership (percent) remain separate. There is no overall score. The ending records a first-year economic multiplier and dated technical milestones; it does not simulate the full later economy. Human extinction removes human welfare and ownership, but autonomous AI can still build industry and send probes.

## ECI calibration

[Epoch AI’s ECI](https://epoch.ai/eci) combines benchmark results into a capability scale; differences are meaningful, but ratios are not. Its September 2026 data puts GPT-5.2 Pro, released in December 2025, at about 155 and the September frontier at about 166. Epoch reports a [recent frontier trend of roughly 14 points per year](https://epoch.ai/data-insights/eci-frontier-trend). These sources were checked on September 20, 2026.

The campaign begins in January 2026. Its existing internal capability variable `c` is converted for display as `155 + 70 × ln((c + 1) / 11) / ln(1001 / 11)`. This maps the initial 10 to ECI 155 and the existing ASI threshold of 1,000 to ECI 225. The initial balanced OpenAI plan gains about 3.3 ECI points per quarter, comparable to the recent observed pace; funding, choices, and coordination change that rate. The added 1 keeps zero-capability loss and recovery states finite and monotone.

ECI 225 as a superintelligence threshold is a game assumption, not an Epoch claim. Named labs retain their scenario advantages and starting order, rather than reproducing a historical model leaderboard. ECI conversion changes the display rather than the game's underlying capability units; forecasts and lab leads use ECI points.

The capability bars mark SAR at 200, TED at 215, and ASI at 225 ECI. These positions are game assumptions. [AI 2040's capability strategy](https://ai-2040.com/supplements/capability-scaling-strategy) describes top-expert-dominating AI, and the [AI Futures Model milestone definitions](https://github.com/AI-Futures-Project/aifm-public/blob/1c40ecdb246c25980515441a66571931c5604e11/constants/chartExplanations.ts#L26) describe superhuman AI research and ASI. Those sources do not assign these milestones ECI values.

## Campaign mechanisms

A standing allocation divides AI labor among capabilities, safety, security, products, diplomacy, and infrastructure. Available funding limits productive work. Each product cohort earns for three quarters, with a rise and decline; competition reduces its receipts as the frontier advances. Maintaining income therefore requires continued product work.

New product cohorts earn more when the lab launches them with stronger models and the market has had time to adopt AI services. A cohort keeps its launch revenue scale; later capability gains do not retroactively raise its sales. Compute and institutional operating costs also grow with capability and adoption. When funds cannot cover the full plan, work and spending fall together. Surplus owned compute can be idled, so a cash-poor lab can still launch a smaller product and recover. The forecast shows actual expected spending, not the cost of a fully funded plan. One-time cash decisions become more expensive as capability rises.

These curves express the possibility of a very large AI business near superintelligence, not a calibrated prediction of one company's income. The [AI 2027 compute forecast](https://ai-2027.com/research/compute-forecast#financials) projects $140 billion of annual revenue and $100 billion of annual compute costs for a leading AI firm in 2027. The [AI 2040 Plan A scenario](https://ai-2040.com/print/scenario?plan=A&supplements=0) puts the leading firm's annual recurring revenue at $1.5 trillion in early 2031. The game presents quarterly receipts; those annual figures are scale checks, not targets for each campaign. Firm revenue, cash reserves, profit, and world economic output are different quantities.

Safety research improves several safeguards through one allocation. Optional evaluation, containment, and interpretability puzzles offer bounded, one-time research rewards. Puzzle randomness is separate from campaign randomness. Agreements depend on coverage, verification, stability, and incentives; diplomatic effort alone cannot indefinitely halt competitors. Public safety research can help rival labs.

Rules live in `campaign.js` and `campaign-events.js`. Save validation checks bounds, identifiers, histories, research rewards, and consistency of derived outcomes. Determinism requires the same engine version and inputs; it is not a promise that balance changes preserve old replays.

## Evaluation exercise

The evaluation game uses synthetic agent behavior and tool traces. A reassuring result can reflect a respected authorization boundary, a broken test environment, or behavior that changes under different conditions. The player chooses follow-up experiments under a small budget and reports what those observations support. Findings concern the stated deployment, not whether a model is safe in general.

The design draws on [METR's capability-elicitation guidance](https://metr.org/blog/2024-03-15-guidelines-for-capability-elicitation/) and [Anthropic's work on evaluation-sensitive behavior](https://red.anthropic.com/2025/wont-vs-cant/). Its finite set of possible explanations makes a short deduction game possible; real evaluations have many more possible confounds. The campaign reward measures performance in this exercise, not a real-world safety guarantee.

## Swarm manufacturing

`cosmos-math.js` constructs an inverse scenario: given the ending's completion date, it calculates the necessary industrial growth rate, then applies explicit material, energy, thermal, replication, and processing limits. This checks consistency under optimistic assumptions; it does not establish engineering feasibility.

The defaults in `INDUSTRY_ASSUMPTIONS` are speculative:

| Quantity | Assumption |
| --- | --- |
| Effective collecting radius; target | 0.25 AU; intercept 90% of solar luminosity |
| Collector plus radiator mass | 5 g per m² of collecting area; 80% of total industry mass |
| Initial industry; available material | 1,000 tonnes at ASI; 10²¹ kg of usable local material |
| Energy per kg manufactured | 10⁹ J, including lumped refining and orbital logistics |
| Energy conversion; industrial allocation | 20%; 20% of converted power |
| Radiators | Twice collecting area, emissivity 0.9, temperature 750 K |
| Replication limits | Two-year doubling before mature nanotechnology; at least seven days afterward |
| Processing ceiling | 10¹³ kg per second |

For industrial mass `M`, growth follows `dM/dt = min(gM, processing ceiling)` until available material or target mass is exhausted. The rate `g` is bounded by replication and available manufacturing power per kg. Power comes from collecting area and is limited by radiative capacity, using the Stefan–Boltzmann law. The [NIST constants table](https://physics.nist.gov/cuu/pdf/all.pdf) supplies the radiation constant.

The target requires about 9.89 × 10¹⁹ kg, derived from area and areal mass: about 0.03% of [Mercury's mass](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html). The power calculation uses [solar luminosity](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) of 3.828 × 10²⁶ W. If the requested date fails the model's constraints, the model reports incomplete construction.

The calculation omits detailed factory designs, material composition, launch trajectories, collision avoidance, and ecological effects. Uniform interception at one effective radius simplifies a distributed swarm. The 1,000-tonne seed is assumed to be in place at ASI; delivering it is not simulated.

## Animation scale and time

Collectors follow schematic orbits with relative Keplerian periods. Visible collector groups are enlarged, and orbital motion runs at 0.02 of the physical clock for readability. Construction playback changes its time scale to make late exponential growth visible; mass still comes from the industrial model at the displayed elapsed time.

The probe sequence depicts a later wave launched at least two years after swarm completion, even if the campaign reports earlier probes. Assumed cruise speeds are 0.15–0.27 c. Acceleration and braking are omitted. After 150 years of that wave, simulation time stops while the camera continues outward; the largest travel bound is 40.5 light-years, not a settled sphere.

The camera then shows a roughly 100,000-light-year Milky Way and the roughly 92-billion-light-year present-day diameter of the observable universe, following [NASA's scale comparison](https://www.nasa.gov/science-research/astrophysics/how-big-is-space-we-asked-a-nasa-expert-episode-61/). The observable universe is not the whole universe or an expansion target reached by the probes. Stars, galaxies, and the cosmic web are representative procedural geometry, not an astronomical catalog.
