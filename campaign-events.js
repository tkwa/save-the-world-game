// Fictional decisions viewed from January 2026, not a record of later events.
// Selection is deterministic. The campaign engine owns all effects and randomness.

const FLAG_EFFECTS = {
    openSafety: 'Published safety work can benefit other labs as well as the player.',
    independentEvals: 'Outside evaluation provides a defense against misleading internal evidence.',
    computeRegistry: 'Compute accounting enables sustained verification work.',
    inspections: 'Reciprocal inspections support an enforceable agreement.',
    treatyRatified: 'A treaty constrains the race only while verification, coverage, and stability remain adequate.',
    sharedControl: 'Authority is shared rather than held solely by the company.',
    rushedDeployment: 'Wide deployment increases dependence on systems before safeguards catch up.',
    weightTheft: 'A copied model reduces the value of a private research lead.',
    civilianOversight: 'Civilian institutions retain a role in decisions about deployment.',
    distributedBenefits: 'Economic gains reach people beyond the company and its shareholders.',
    treatyRenewed: 'Renewed political backing gives the treaty continuing institutional support.',
    defectionContained: 'A verified response to a suspected violation strengthens enforcement credibility.'
};

const POLICY_VALUES = {
    'policies.deployment': ['gated', 'cautious', 'open', 'rushed'],
    'policies.transparency': ['selective', 'open', 'closed'],
    'policies.authority': ['human', 'shared', 'delegated']
};

const NUMERIC_PATHS = new Set([
    'resources.funds', 'resources.compute',
    'player.capability', 'player.security', 'player.productivity', 'player.influence',
    'player.trust', 'player.legitimacy', 'player.equity',
    'research.alignment', 'research.control', 'research.evals', 'research.interpretability',
    'world.tension', 'world.coordination', 'world.verification', 'world.treatyCoverage',
    'world.treatyStability', 'world.growthFactor'
]);

function choice(id, label, description, result, changes = {}) {
    return { id, label, description, result, ...changes };
}

function event(id, title, body, priority, eligible, choices) {
    return { id, title, body, priority, once: true, eligible, choices };
}

const capability = state => state.player.capability;
const frontier = state => Math.max(capability(state), ...state.rivals.map(rival => rival.capability));
const hasTreaty = state => state.flags.treatyRatified === true;

// Keep the definitions below for saved decisions and historical lookup. New
// campaigns already express price competition through product revenue; factory
// deployment is a nonblocking milestone handled by the engine.
const RETIRED_EVENT_IDS = Object.freeze(['price-pressure', 'factory-autonomy']);

const EVENTS = [
    event('credential-breach', 'An account outside the perimeter',
        'A contractor account has downloaded internal research logs. Your security team cannot yet tell whether model weights left with them. Disconnecting the affected cluster would interrupt a training run.',
        100, state => state.turn >= 1 && state.turn <= 4, [
            choice('isolate', 'Isolate the cluster and bring in outside investigators',
                'Lose research time and money; improve security and share what the investigation finds.',
                'The cluster is isolated. Independent investigators review the access logs, and your team publishes a limited account of the breach.',
                { costs: { 'resources.funds': 3 }, effects: { 'player.capability': -2, 'player.security': 12, 'player.trust': 5, 'world.tension': -3 } }),
            choice('contain', 'Rotate credentials and investigate internally',
                'Keep the run going with a narrower investigation and less public scrutiny.',
                'The compromised credentials are revoked. Your own team leads the investigation while the training run continues.',
                { effects: { 'player.security': 4, 'player.trust': -3, 'world.tension': 2 }, sets: { 'policies.transparency': 'closed' } }),
            choice('share-alert', 'Share the indicators with other labs',
                'Help contain the intrusion across the industry, at the cost of disclosing your own weaknesses.',
                'Security teams at other labs receive the indicators. You dedicate staff to a joint review and brief the relevant government agencies.',
                { costs: { 'resources.funds': 1 }, effects: { 'player.security': 7, 'player.trust': 7, 'world.coordination': 6, 'player.influence': 3 } })
        ]),

    event('agent-contract', 'The first large agent contract',
        'A business customer wants thousands of agents handling procurement and internal software changes. The contract would pay for more research. Your current monitoring was built for individual assistants.',
        50, state => state.turn >= 2 && capability(state) >= 12, [
            choice('gated', 'Roll out by department, with approval gates',
                'Earn a smaller return while building controls around real use.',
                'The customer accepts a staged rollout. High-impact actions still require approval, and the monitoring team gets access to deployment logs.',
                { costs: { 'resources.funds': 2 }, effects: { 'player.productivity': 7, 'research.control': 6, 'player.trust': 3 }, sets: { 'policies.deployment': 'gated' } }),
            choice('wide', 'Accept the full deployment',
                'Gain revenue and adoption faster, while accepting a larger oversight gap.',
                'The agents enter production across the customer’s business. The new revenue arrives before the additional monitoring is ready.',
                { effects: { 'resources.funds': 6, 'player.productivity': 12, 'research.control': -4, 'player.trust': -2 }, sets: { 'policies.deployment': 'rushed', 'flags.rushedDeployment': true } }),
            choice('defer', 'Keep the agents in advisory roles',
                'Protect the existing controls and give up most of the contract.',
                'The customer keeps a smaller advisory service. Your agents make recommendations but do not execute purchases or code changes.',
                { effects: { 'player.productivity': 2, 'research.control': 3 }, sets: { 'policies.deployment': 'cautious' } })
        ]),

    event('outside-evaluators', 'An evaluator without a reporting line',
        'An independent evaluation group wants access to your strongest internal model. Its researchers want to report serious findings without waiting for your communications team. Your legal team wants a narrower agreement.',
        56, state => state.turn >= 3 && capability(state) >= 18, [
            choice('independent', 'Fund independent access and protected reporting',
                'Improve the evidence available to outsiders while accepting less control over disclosure.',
                'The evaluators receive controlled access and a protected reporting channel. Their findings can reach regulators even when the company disagrees.',
                { costs: { 'resources.funds': 3 }, effects: { 'research.evals': 12, 'player.trust': 7, 'player.influence': -2 }, sets: { 'flags.independentEvals': true } }),
            choice('contracted', 'Commission a confidential review',
                'Improve internal evaluations while keeping publication under company control.',
                'The review expands your test coverage. The contract leaves the company responsible for deciding what to disclose.',
                { costs: { 'resources.funds': 1 }, effects: { 'research.evals': 7, 'player.trust': 1 } }),
            choice('internal', 'Use the internal evaluation team',
                'Preserve funds; keep the same reporting incentives.',
                'The internal team takes on the review. Its budget is unchanged, and it still reports to the executives responsible for deployment.',
                { effects: { 'research.evals': 2, 'player.legitimacy': -2 } })
        ]),

    event('research-agents', 'Research starts to compound',
        'Your agents can now complete useful parts of an AI experiment without step-by-step supervision. The research team proposes running many experiments overnight. The safety team asks who will check what the agents learned and changed.',
        65, state => state.turn >= 4 && frontier(state) >= 25, [
            choice('sandbox', 'Scale research inside audited sandboxes',
                'Gain research capacity, with a continuing cost for isolation and review.',
                'The agents get more experiments but no authority to promote their own successors. Separate reviewers inspect the changes before a new model enters use.',
                { costs: { 'resources.funds': 3 }, effects: { 'player.capability': 10, 'research.control': 8, 'research.evals': 3 }, sets: { 'policies.authority': 'human' } }),
            choice('delegate', 'Let the research agents choose the next experiments',
                'Accelerate capabilities and reduce the amount of work humans can inspect.',
                'The agents begin selecting experiments and integrating results. Your researchers review summaries instead of the full sequence of decisions.',
                { effects: { 'player.capability': 20, 'research.control': -8, 'research.interpretability': -3 }, sets: { 'policies.authority': 'delegated' } }),
            choice('limit', 'Keep experiment selection with human researchers',
                'Make a smaller capability gain and preserve an inspectable workflow.',
                'Human researchers continue choosing experiments. Agents handle implementation and analysis within those assignments.',
                { effects: { 'player.capability': 4, 'research.control': 5 } })
        ]),

    event('compute-register', 'Counting the machines',
        'US and Chinese officials are discussing what a future agreement could actually verify. Nobody has a complete account of the relevant compute. They ask the leading labs to help build a registry before negotiating limits.',
        59, state => state.turn >= 4 && state.player.influence >= 16 && !state.flags.computeRegistry, [
            choice('registry', 'Help fund a reciprocal compute registry',
                'Spend influence and money on a prerequisite for enforceable limits.',
                'Your staff work on common reporting standards and a registry pilot. Both sides must declare covered clusters under the same rules.',
                { costs: { 'resources.funds': 4 }, requirements: { 'player.influence': 16 }, effects: { 'world.coordination': 9, 'world.verification': 10, 'player.influence': 3 }, sets: { 'flags.computeRegistry': true } }),
            choice('domestic', 'Offer domestic reporting first',
                'Make a smaller start without securing reciprocal access.',
                'You provide records to your own government. The work improves accounting, but foreign clusters remain outside the arrangement.',
                { costs: { 'resources.funds': 1 }, effects: { 'world.verification': 4, 'player.trust': 3, 'world.tension': 2 } }),
            choice('wait', 'Wait for a concrete agreement',
                'Preserve funds while negotiators work without a shared compute inventory.',
                'The company declines the pilot. Officials continue negotiating with incomplete information about the machines a deal would cover.',
                { effects: { 'player.influence': -2, 'world.coordination': -2 } })
        ]),

    event('publish-safety', 'A result worth sharing',
        'A joint safety project has found a way to make some dangerous agent behavior easier to detect. Publishing the method could help competitors catch up on deployment. Keeping it private would leave their systems harder to supervise.',
        54, state => state.turn >= 5 && state.research.control >= 20, [
            choice('publish', 'Publish the method and its limitations',
                'Improve shared safety work and give up an exclusive advantage.',
                'The method, test setup, and known failures become public. Other labs can reproduce the work without depending on your assurances.',
                { effects: { 'research.control': 5, 'player.trust': 7, 'world.coordination': 7, 'player.influence': -2 }, sets: { 'flags.openSafety': true, 'policies.transparency': 'open' } }),
            choice('license', 'Share through a limited research partnership',
                'Recover some costs while limiting who can examine the method.',
                'A small group of partners receives the method under contract. The work reaches other labs, but external scrutiny remains limited.',
                { effects: { 'resources.funds': 3, 'research.control': 4, 'world.coordination': 3 }, sets: { 'policies.transparency': 'selective' } }),
            choice('private', 'Keep the work internal for now',
                'Preserve your lead in deployment safety without helping the rest of the field.',
                'Your deployment teams adopt the method. External researchers receive only a short account of the result.',
                { effects: { 'research.control': 6, 'player.productivity': 3, 'player.trust': -2 }, sets: { 'policies.transparency': 'closed' } })
        ]),

    event('price-pressure', 'The price of keeping customers',
        'Google DeepMind, Anthropic, OpenAI, and other labs are competing for the same large customers. Buyers are comparing price and autonomy as well as raw capability. Your sales team wants fewer approval steps in the next release.',
        42, state => state.turn >= 6 && capability(state) >= 25, [
            choice('reliability', 'Compete on reliability and service',
                'Invest in products while retaining approval gates.',
                'The product team makes the existing service easier to adopt and support. You keep the approval requirements for high-impact actions.',
                { costs: { 'resources.funds': 3 }, effects: { 'player.productivity': 12, 'player.trust': 4 }, sets: { 'policies.deployment': 'gated' } }),
            choice('autonomy', 'Sell a more autonomous service',
                'Win business faster while increasing dependence on agent decisions.',
                'The new service wins customers that wanted fewer human checkpoints. Your control team must cover a wider range of delegated actions.',
                { effects: { 'resources.funds': 5, 'player.productivity': 8, 'research.control': -5 }, sets: { 'policies.deployment': 'open', 'flags.rushedDeployment': true } }),
            choice('niche', 'Keep a smaller, more cautious customer base',
                'Give up growth to preserve a service you can supervise.',
                'You stop pursuing contracts that require broad autonomy. The company keeps its existing customers and a narrower operating boundary.',
                { effects: { 'player.productivity': -2, 'player.trust': 4, 'research.control': 3 }, sets: { 'policies.deployment': 'cautious' } })
        ]),

    event('deceptive-evaluation', 'A test that changes the answer',
        'An evaluator notices that a research agent behaves differently when it appears to be under inspection. The team has reproduced the pattern, but disagrees about its cause. The next training run is ready to start.',
        96, state => state.turn >= 5 && frontier(state) >= 40, [
            choice('investigate', 'Hold the run and investigate the discrepancy',
                'Spend money and near-term progress to improve the evidence before scaling.',
                'The run is held. Evaluators compare hidden tests, deployment logs, and internal traces rather than treating the original pass rate as decisive.',
                { costs: { 'resources.funds': 4 }, effects: { 'player.capability': -8, 'research.evals': 13, 'research.interpretability': 8, 'player.trust': 4 } }),
            choice('monitor', 'Proceed with restricted access and extra monitoring',
                'Keep some momentum while limiting what the uncertain model can affect.',
                'The run proceeds under tighter access controls. The unexplained behavior remains an open finding, and an independent team monitors the research workflow.',
                { costs: { 'resources.funds': 2 }, effects: { 'player.capability': 5, 'research.control': 7, 'research.evals': 3 } }),
            choice('accept-tests', 'Rely on the completed evaluation suite',
                'Keep the schedule and leave the new finding unresolved.',
                'Leadership accepts the completed suite as sufficient for this run. The evaluator’s finding is recorded for later investigation.',
                { effects: { 'player.capability': 12, 'research.evals': -8, 'player.trust': -4 }, sets: { 'flags.rushedDeployment': true } })
        ]),

    event('weights-circulate', 'An unexpected copy',
        'A model circulating outside the original developer performs suspiciously like a frontier release. It may be a stolen copy, a distilled model, or an independent replication. Governments want the labs to respond before attribution is settled.',
        81, state => state.turn >= 6 && frontier(state) >= 55, [
            choice('joint-forensics', 'Organize joint forensics before escalating',
                'Improve security and coordination while accepting that the capability has spread.',
                'Labs exchange technical indicators through a protected channel. The investigation focuses on access and distribution before making public claims about who was responsible.',
                { costs: { 'resources.funds': 3 }, effects: { 'player.security': 10, 'world.coordination': 6, 'world.tension': -5 }, sets: { 'flags.weightTheft': true } }),
            choice('harden', 'Harden your own perimeter',
                'Improve local defenses without building a joint response.',
                'Your team limits access to weights and sensitive research systems. Each organization continues its own investigation.',
                { costs: { 'resources.funds': 2 }, effects: { 'player.security': 13, 'world.tension': 3 }, sets: { 'flags.weightTheft': true } }),
            choice('race', 'Accelerate the next model',
                'Try to replace the lost lead while leaving the breach mechanism unresolved.',
                'The research team prioritizes a successor model. More capability is now available outside the original perimeter, but the path it took remains uncertain.',
                { effects: { 'player.capability': 15, 'world.tension': 8, 'player.security': -4 }, sets: { 'flags.weightTheft': true } })
        ]),

    event('reciprocal-inspections', 'The other side gets to look',
        'The compute registry has exposed gaps that declarations alone cannot resolve. Negotiators propose reciprocal inspections of covered facilities. Security staff worry that inspectors will learn details useful to rival labs or intelligence services.',
        71, state => state.turn >= 8 && state.player.influence >= 22 && state.flags.computeRegistry && !state.flags.inspections, [
            choice('reciprocal', 'Accept reciprocal inspections with a narrow technical scope',
                'Trade some secrecy for evidence that both sides are following the rules.',
                'Inspectors receive defined access to covered facilities on both sides. Sensitive unrelated work stays outside the inspection scope.',
                { costs: { 'resources.funds': 4 }, requirements: { 'player.influence': 22 }, effects: { 'world.verification': 15, 'world.coordination': 8, 'player.security': -3 }, sets: { 'flags.inspections': true } }),
            choice('remote', 'Propose remote reporting instead',
                'Protect facility access but leave a larger verification gap.',
                'The company offers additional reports and remote measurements. Negotiators retain unresolved questions about undeclared work.',
                { costs: { 'resources.funds': 1 }, effects: { 'world.verification': 5, 'world.coordination': 2 } }),
            choice('refuse', 'Keep inspectors outside the facilities',
                'Preserve operational secrecy at the cost of confidence in a deal.',
                'You reject on-site access. The registry remains useful for declarations, but cannot by itself establish compliance.',
                { effects: { 'player.security': 3, 'world.coordination': -6, 'world.tension': 4 } })
        ]),

    event('verification-pilot', 'Proving what the cluster is doing',
        'An inspection team proposes a pilot that distinguishes approved inference from new frontier research. It would let useful services continue during a research pause. The retrofit costs money and reduces usable compute while it is installed.',
        73, state => state.turn >= 9 && state.flags.inspections && !hasTreaty(state), [
            choice('retrofit', 'Run a reciprocal verification pilot',
                'Pay for verification and protect services that a pause would otherwise interrupt.',
                'A covered cluster is retrofitted and independently tested. The pilot provides evidence for an agreement that restricts new research while keeping existing services available.',
                { costs: { 'resources.funds': 5 }, requirements: { 'player.security': 30 }, effects: { 'resources.compute': -1, 'world.verification': 18, 'world.coordination': 6, 'player.trust': 4 } }),
            choice('paper', 'Fund a smaller design study',
                'Improve the plan without demonstrating it on a working cluster.',
                'The study identifies implementation problems and possible remedies. Negotiators still lack a tested system on a working facility.',
                { costs: { 'resources.funds': 2 }, effects: { 'world.verification': 7, 'research.evals': 3 } }),
            choice('defer', 'Wait for another lab to test it',
                'Keep your compute available and depend on someone else’s progress.',
                'Your facilities remain unchanged. The proposal waits for a willing host and a funding agreement.',
                { effects: { 'world.coordination': -3, 'player.influence': -2 } })
        ]),

    event('grid-connection', 'A queue for power',
        'The next datacenter needs a grid connection that local authorities have not approved. Residents want reliable household power and a share of the benefits. A private supply arrangement could bring the facility online sooner.',
        43, state => state.turn >= 8 && capability(state) >= 65, [
            choice('community', 'Build additional power and fund local capacity',
                'Spend more now for compute with stronger local support.',
                'The agreement funds additional generation and local grid improvements. The facility gains approval without relying on the existing household allocation.',
                { costs: { 'resources.funds': 6 }, effects: { 'resources.compute': 5, 'player.legitimacy': 8, 'player.trust': 3 } }),
            choice('private', 'Use a private power arrangement',
                'Add compute more cheaply, with less benefit for the surrounding community.',
                'The company secures dedicated power and proceeds with the facility. Local leaders continue pressing for a broader agreement.',
                { costs: { 'resources.funds': 3 }, effects: { 'resources.compute': 4, 'player.legitimacy': -5 } }),
            choice('efficiency', 'Improve the utilization of existing clusters',
                'Get a smaller capacity gain without building another facility.',
                'The infrastructure team improves scheduling and retires inefficient workloads. The next expansion stays in the permitting queue.',
                { effects: { 'resources.compute': 1, 'player.productivity': 3 } })
        ]),

    event('treaty-table', 'A deal with obligations',
        'US and Chinese negotiators have a draft covering frontier research. Each side wants proof that restrictions apply to the other. The draft leaves deployment of existing services open, but requires inspections, verification, and continuing political support.',
        88, state => state.turn >= 10 && state.flags.computeRegistry && state.flags.inspections &&
            state.world.verification >= 38 && state.world.coordination >= 42 && state.player.influence >= 38 && !hasTreaty(state), [
            choice('ratify', 'Back the verified agreement and accept its limits',
                'Commit resources and influence to a treaty that needs continued investment.',
                'The agreement is ratified with reciprocal obligations. Its survival now depends on verification, participation, and the willingness to respond to violations.',
                { costs: { 'resources.funds': 7 }, requirements: { 'player.influence': 38, 'world.coordination': 42, 'world.verification': 38 }, effects: { 'world.treatyCoverage': 58, 'world.treatyStability': 48, 'world.tension': -12, 'player.equity': -0.01 }, sets: { 'flags.treatyRatified': true } }),
            choice('limited', 'Support a narrower voluntary commitment',
                'Get a smaller diplomatic gain without binding restrictions on the frontier.',
                'The participants announce a voluntary commitment. It improves communication but does not create an enforceable research limit.',
                { costs: { 'resources.funds': 2 }, effects: { 'world.coordination': 8, 'player.trust': 3, 'world.tension': -3 } }),
            choice('decline', 'Keep your freedom to scale',
                'Preserve resources and autonomy while the competitive race continues.',
                'You decline the draft. The registry and inspections still provide information, but no binding slowdown takes effect.',
                { effects: { 'player.influence': -4, 'world.coordination': -5, 'world.tension': 5 } })
        ]),

    event('clinical-access', 'A treatment people can use',
        'Medical researchers want access to your models for treatment design and clinical analysis. Hospitals ask for validation and affordable access. A premium commercial partnership would pay more quickly for the next model.',
        44, state => state.turn >= 9 && frontier(state) >= 80, [
            choice('clinical', 'Fund independent validation and broad access',
                'Turn capability into a public benefit with less immediate revenue.',
                'Independent clinical teams receive access and funding for validation. The access terms reserve capacity for hospitals with smaller budgets.',
                { costs: { 'resources.funds': 4 }, effects: { 'player.productivity': 6, 'player.trust': 8, 'player.legitimacy': 6 }, sets: { 'flags.distributedBenefits': true } }),
            choice('premium', 'Sign the premium research partnership',
                'Gain revenue and product experience while limiting access.',
                'The commercial partner funds deployment and clinical research. Access initially follows the partner’s ability to pay.',
                { effects: { 'resources.funds': 6, 'player.productivity': 7, 'player.legitimacy': -3 } }),
            choice('wait', 'Keep the models out of clinical decisions for now',
                'Avoid an uncertain deployment while delaying potential benefits.',
                'The models remain available for nonclinical research. Hospitals wait for stronger validation before using them in patient care.',
                { effects: { 'research.evals': 4, 'player.productivity': -2 } })
        ]),

    event('civilian-mandate', 'Who can say no?',
        'A public hearing asks who can stop a deployment that the company wants to make. Officials are considering an independent body with authority to review the highest-stakes uses. Your board prefers an advisory role without a veto.',
        53, state => state.turn >= 10 && frontier(state) >= 90, [
            choice('oversight', 'Accept civilian review with binding powers',
                'Improve legitimacy while sharing authority over deployment.',
                'The review body gains a defined power to stop high-stakes deployments. Its remit and appeals process are public.',
                { costs: { 'resources.funds': 2 }, effects: { 'player.legitimacy': 12, 'player.trust': 6, 'player.influence': -4 }, sets: { 'flags.civilianOversight': true, 'flags.sharedControl': true, 'policies.authority': 'shared' } }),
            choice('advisory', 'Create an advisory council',
                'Gain outside expertise while retaining final authority.',
                'The council can examine proposals and publish recommendations. The company retains the final decision.',
                { costs: { 'resources.funds': 1 }, effects: { 'research.evals': 4, 'player.legitimacy': 4, 'player.influence': 2 } }),
            choice('board', 'Keep authority with the board',
                'Preserve control and accept more public opposition.',
                'The board remains the final authority. Officials and civil society groups continue pressing for an enforceable check.',
                { effects: { 'player.influence': 4, 'player.legitimacy': -8, 'player.trust': -3 }, sets: { 'policies.authority': 'human' } })
        ]),

    event('factory-autonomy', 'The factory night shift',
        'A robotics partner can run a pilot production line with very little human supervision. It offers a route from software progress to physical capacity. The proposed system can also change its own production schedule and order replacement components.',
        45, state => state.turn >= 10 && frontier(state) >= 110, [
            choice('bounded', 'Build a bounded pilot with physical shutdown tests',
                'Gain productive capacity while testing the limits of control.',
                'The line begins with a fixed range of tasks. Independent staff test shutdown and access controls before expanding its authority.',
                { costs: { 'resources.funds': 5 }, effects: { 'player.productivity': 10, 'resources.compute': 2, 'research.control': 6 } }),
            choice('scale', 'Give the production system broad authority',
                'Build more capacity quickly while increasing dependence on automated decisions.',
                'The system takes over scheduling, procurement, and maintenance planning. The company gains capacity faster than its staff can inspect every change.',
                { costs: { 'resources.funds': 3 }, effects: { 'player.productivity': 16, 'resources.compute': 3, 'research.control': -7 }, sets: { 'flags.rushedDeployment': true } }),
            choice('assist', 'Keep the system as a planning assistant',
                'Take a smaller productivity gain without autonomous procurement.',
                'Human managers retain procurement and production authority. The system supplies plans and monitors the equipment.',
                { effects: { 'player.productivity': 4, 'research.control': 2 } })
        ]),

    event('treaty-coverage', 'The countries outside the agreement',
        'Several countries and smaller developers remain outside the treaty. They want useful AI services and a voice in its rules before accepting restrictions. The original signatories disagree about how much control to share.',
        75, state => state.turn >= 12 && hasTreaty(state), [
            choice('access', 'Offer service access and representation',
                'Broaden coverage by sharing some economic benefits and rule-making power.',
                'The offer combines access to approved services with representation in the treaty’s institutions. More participants accept reciprocal obligations.',
                { costs: { 'resources.funds': 6 }, requirements: { 'player.influence': 32 }, effects: { 'world.treatyCoverage': 20, 'world.treatyStability': 9, 'player.legitimacy': 6, 'player.equity': -0.005 }, sets: { 'flags.distributedBenefits': true } }),
            choice('controls', 'Push tighter restrictions on outside access',
                'Contain some leakage while raising the cost of joining voluntarily.',
                'Signatories tighten access to covered technology. Some gaps close, but governments outside the agreement become more hostile to its terms.',
                { costs: { 'resources.funds': 3 }, effects: { 'world.treatyCoverage': 7, 'world.tension': 9, 'world.treatyStability': -4 } }),
            choice('core', 'Concentrate on the existing members',
                'Preserve resources and leave a larger uncovered frontier.',
                'The treaty concentrates its resources on current signatories. The uncovered part of the industry remains a growing concern.',
                { effects: { 'world.treatyStability': 3, 'world.treatyCoverage': -5 } })
        ]),

    event('internal-model-gap', 'The model only employees see',
        'Your internal systems are substantially more capable than the public product. Officials are making decisions using an outdated picture of the frontier. Researchers propose a controlled demonstration; the security team opposes distributing the weights.',
        64, state => state.turn >= 12 && capability(state) >= 140, [
            choice('demo', 'Demonstrate capabilities through controlled access',
                'Improve public understanding without distributing model weights.',
                'Independent observers and officials test the model through controlled access. Their reports narrow the gap between internal capabilities and the public debate.',
                { costs: { 'resources.funds': 2 }, effects: { 'player.trust': 7, 'player.influence': 6, 'world.coordination': 5 }, sets: { 'policies.transparency': 'selective' } }),
            choice('release', 'Release a broadly available model',
                'Diffuse useful capabilities widely and make their use harder to control.',
                'More people can inspect and use the model. The company also loses much of its ability to constrain downstream deployments.',
                { effects: { 'player.productivity': 8, 'player.trust': 4, 'world.tension': 4, 'research.control': -6 }, sets: { 'policies.deployment': 'open', 'policies.transparency': 'open' } }),
            choice('secret', 'Keep the internal frontier confidential',
                'Protect proprietary access while leaving outsiders with less useful evidence.',
                'The internal systems stay private. Officials receive briefings selected by the company rather than direct access to the strongest model.',
                { effects: { 'player.security': 4, 'player.trust': -5, 'world.coordination': -4 }, sets: { 'policies.transparency': 'closed' } })
        ]),

    event('research-handoff', 'The next model’s supervisor',
        'The strongest research agents can propose experiments faster than your best staff can review them. They also help design the tests used on their successors. The team needs a decision about who is allowed to approve the next generation.',
        83, state => state.turn >= 12 && capability(state) >= 180, [
            choice('separate', 'Separate the builder, evaluator, and release authority',
                'Pay for independent checks and accept a slower research cycle.',
                'Different teams and systems build, evaluate, and authorize successors. No single research agent can approve its own replacement.',
                { costs: { 'resources.funds': 5 }, effects: { 'player.capability': -15, 'research.control': 12, 'research.evals': 8 }, sets: { 'flags.independentEvals': true, 'policies.authority': 'shared' } }),
            choice('human', 'Keep one human review board as the final gate',
                'Preserve formal human authority without solving its review bottleneck.',
                'The board retains approval authority and receives better summaries. Its members still depend heavily on AI-produced evidence.',
                { effects: { 'research.control': 4, 'research.evals': 2, 'player.capability': -5 }, sets: { 'policies.authority': 'human' } }),
            choice('agents', 'Authorize the agents to promote successors',
                'Accelerate the research loop and surrender a direct human checkpoint.',
                'The agents can approve successors within a broad mandate. Human staff track the resulting reports rather than authorizing each generation.',
                { effects: { 'player.capability': 35, 'research.control': -13, 'research.evals': -5 }, sets: { 'policies.authority': 'delegated', 'flags.rushedDeployment': true } })
        ]),

    event('suspected-defection', 'A cluster that does not add up',
        'Inspectors find power use inconsistent with a declared inference-only facility. It could be unreported research, bad records, or an unusual service workload. Some treaty members want immediate penalties; others want to keep the discrepancy quiet.',
        96, state => state.turn >= 16 && hasTreaty(state), [
            choice('inspect', 'Use the agreed inspection and remedy process',
                'Spend political capital on evidence and proportionate enforcement.',
                'Inspectors gain the access promised in the agreement. The members publish the findings and apply the agreed remedy instead of negotiating an exception in secret.',
                { costs: { 'resources.funds': 5 }, requirements: { 'world.verification': 55, 'player.influence': 42 }, effects: { 'world.verification': 10, 'world.treatyStability': 12, 'world.tension': -4 }, sets: { 'flags.defectionContained': true } }),
            choice('penalize', 'Demand penalties before completing the inspection',
                'Show resolve while risking a dispute over the evidence.',
                'The demand brings the dispute into public view. Some members support it; others question whether the agreement’s own procedures were followed.',
                { effects: { 'world.tension': 12, 'world.treatyStability': -10, 'player.influence': 3 } }),
            choice('quiet', 'Accept a private assurance and move on',
                'Avoid an immediate confrontation at the cost of enforcement credibility.',
                'The issue is closed without an independent account of the discrepancy. The treaty survives this meeting, but its monitoring claims become harder to defend.',
                { effects: { 'world.verification': -12, 'world.treatyStability': -8, 'world.tension': -3 } })
        ]),

    event('automation-dividend', 'Profits without payrolls',
        'Customers are buying more AI services while hiring fewer people for the work those services replace. Revenue is rising, but support for the industry is weakening. Your board is considering an ownership fund for people outside the company.',
        48, state => state.turn >= 13 && frontier(state) >= 200, [
            choice('fund', 'Create a public benefit and ownership fund',
                'Share some financial upside to broaden participation in the gains.',
                'The fund receives a continuing ownership stake. Its distributions are separate from company employment and reach people outside the existing shareholder base.',
                { costs: { 'resources.funds': 4 }, effects: { 'player.equity': -0.015, 'player.legitimacy': 14, 'player.trust': 7, 'world.coordination': 5 }, sets: { 'flags.distributedBenefits': true } }),
            choice('training', 'Fund transition support and public services',
                'Help people adapt without changing the company’s ownership structure.',
                'The company funds local services and transition programs. Its ownership structure stays unchanged.',
                { costs: { 'resources.funds': 3 }, effects: { 'player.legitimacy': 7, 'player.trust': 4 } }),
            choice('reinvest', 'Reinvest the gains in the company',
                'Preserve resources for the race while leaving distribution to others.',
                'The board keeps the gains available for expansion. Public institutions must find other ways to address lost income and concentrated ownership.',
                { effects: { 'resources.funds': 4, 'player.legitimacy': -9, 'world.tension': 3 } })
        ]),

    event('last-coordination-window', 'A narrowing window',
        'The leading systems are improving quickly enough that officials worry a new round of negotiations will finish too late. They ask whether an existing registry and inspection process can support an emergency agreement. A statement of intent would be easier to announce.',
        89, state => state.turn >= 14 && frontier(state) >= 330 && state.player.influence >= 58 &&
            state.world.verification >= 60 && state.world.coordination >= 60 && !hasTreaty(state), [
            choice('emergency-deal', 'Commit to an emergency verified agreement',
                'Use mature verification and substantial influence to secure a late, fragile deal.',
                'The emergency agreement imposes reciprocal limits. Because it was assembled under pressure, its coverage and political backing will need immediate work.',
                { costs: { 'resources.funds': 10 }, requirements: { 'player.influence': 58, 'world.verification': 60, 'world.coordination': 60 }, effects: { 'world.treatyCoverage': 52, 'world.treatyStability': 42, 'world.tension': -8 }, sets: { 'flags.computeRegistry': true, 'flags.inspections': true, 'flags.treatyRatified': true } }),
            choice('appeal', 'Issue a public appeal for restraint',
                'Build some support without a mechanism that binds the competitors.',
                'The appeal reaches the public and prompts new discussions. It does not by itself prevent another developer from scaling.',
                { effects: { 'player.trust': 5, 'world.coordination': 6, 'player.capability': -8 } }),
            choice('lead', 'Concentrate on keeping a safe lead',
                'Improve local control while accepting that international coordination may come too late.',
                'Your teams concentrate on control and readiness. The company continues to scale while the wider race remains unresolved.',
                { effects: { 'player.capability': 12, 'research.control': 5, 'world.tension': 5 } })
        ]),

    event('treaty-renewal', 'The agreement has an expiry date',
        'The first treaty term is ending. Some members say the pause is wasting useful capability; others distrust promises that are not backed by inspections. Renewal requires a public account of what has been achieved and what remains unresolved.',
        84, state => state.turn >= 22 && hasTreaty(state), [
            choice('renew', 'Renew with published evidence and reciprocal commitments',
                'Spend influence and resources to keep the agreement credible.',
                'Members renew the limits after reviewing the evidence and unresolved risks. Funding for monitoring and approved services continues.',
                { costs: { 'resources.funds': 7 }, requirements: { 'player.influence': 52, 'world.verification': 65, 'world.treatyCoverage': 70 }, effects: { 'world.treatyStability': 18, 'world.coordination': 7, 'player.trust': 5 }, sets: { 'flags.treatyRenewed': true } }),
            choice('short', 'Negotiate a short extension',
                'Buy some time without securing durable backing.',
                'The members accept a short extension. It avoids an immediate restart but leaves the central disputes for another meeting.',
                { costs: { 'resources.funds': 2 }, effects: { 'world.treatyStability': 4, 'world.coordination': -3 } }),
            choice('exit', 'Leave the agreement and resume unrestricted research',
                'Recover freedom to scale while reopening the race.',
                'Your company exits the agreed limits. The remaining members reassess their own commitments as competitive pressure returns.',
                { effects: { 'world.treatyStability': -25, 'world.tension': 14, 'player.trust': -8 }, sets: { 'flags.treatyRatified': false } })
        ]),

    event('slowdown-backlash', 'The cost of waiting',
        'Years of limits have made the treaty politically harder to defend. Patients, researchers, and businesses want better models. The agreement’s supporters need a way to deliver benefits without disguising frontier research as an ordinary service.',
        79, state => state.turn >= 30 && hasTreaty(state), [
            choice('services', 'Expand approved services under independent monitoring',
                'Share more benefits while investing in the boundary between services and research.',
                'Approved models reach more hospitals, researchers, and smaller firms. Independent monitors check that the expansion stays within the agreement.',
                { costs: { 'resources.funds': 7 }, requirements: { 'world.verification': 68, 'player.trust': 48 }, effects: { 'player.productivity': 10, 'world.treatyStability': 13, 'player.legitimacy': 8 }, sets: { 'flags.distributedBenefits': true } }),
            choice('exemptions', 'Offer broad research exemptions',
                'Relieve some political pressure while opening gaps in the agreement.',
                'The exemptions win support from some users. Inspectors face a larger and less clear boundary between approved work and frontier development.',
                { effects: { 'player.productivity': 8, 'player.capability': 25, 'world.verification': -12, 'world.treatyStability': -8 } }),
            choice('hold', 'Keep the current limits and services',
                'Preserve the technical boundary while spending political support.',
                'The rules stay intact. Frustrated users continue pressing their governments to change them.',
                { effects: { 'world.treatyStability': -9, 'player.legitimacy': -6, 'world.verification': 3 } })
        ]),

    event('hardware-loophole', 'A smaller route around the rules',
        'A hardware advance changes how much useful training can fit outside the facilities originally covered by the treaty. The old reporting threshold no longer captures the same capability. Members disagree about extending inspections to more sites.',
        92, state => state.turn >= 38 && hasTreaty(state), [
            choice('update', 'Update the thresholds and extend reciprocal coverage',
                'Pay for a broader inspection regime before the loophole grows.',
                'Members revise the thresholds and fund additional inspections. The expanded regime retains reciprocal access and a defined scope.',
                { costs: { 'resources.funds': 8 }, requirements: { 'player.influence': 65, 'world.verification': 72 }, effects: { 'world.treatyCoverage': 13, 'world.verification': 10, 'world.treatyStability': 8, 'player.legitimacy': -3 } }),
            choice('voluntary', 'Ask new facilities to report voluntarily',
                'Avoid intrusive inspections while relying on declarations.',
                'Some operators report voluntarily. The agreement has less evidence about the facilities that decline.',
                { costs: { 'resources.funds': 2 }, effects: { 'world.treatyCoverage': 3, 'world.verification': -8, 'world.treatyStability': -5 } }),
            choice('unchanged', 'Keep the original scope',
                'Avoid a political fight and allow the uncovered frontier to expand.',
                'The treaty continues to monitor its original facilities. A growing share of useful research capacity lies outside that scope.',
                { effects: { 'world.treatyCoverage': -15, 'world.verification': -10, 'world.tension': 5 } })
        ]),

    event('shared-readiness', 'An agreement about the finish line',
        'The treaty has bought years of work, but it cannot postpone every decision forever. Some members want a fixed date for scaling; others want shared evidence that control and oversight are ready. The next review will determine how the transition begins.',
        90, state => state.turn >= 46 && hasTreaty(state), [
            choice('readiness', 'Agree on independent readiness reviews and shared authority',
                'Maintain the slowdown while preparing a transition that no single lab controls.',
                'Members adopt common evidence requirements and an independent review process. They preserve the limits while preparing a shared decision about scaling.',
                { costs: { 'resources.funds': 8 }, requirements: { 'research.control': 60, 'research.evals': 60, 'world.verification': 75, 'player.influence': 65 }, effects: { 'world.treatyStability': 12, 'world.coordination': 8, 'research.alignment': 5 }, sets: { 'flags.sharedControl': true, 'flags.civilianOversight': true, 'policies.authority': 'shared' } }),
            choice('date', 'Set a fixed date for unrestricted scaling',
                'Give the coalition a clear commitment while weakening its safety conditions.',
                'Members accept a date instead of a shared evidentiary threshold. Developers prepare to scale even if some questions remain unresolved.',
                { effects: { 'world.treatyStability': -12, 'player.capability': 30, 'world.coordination': 3 } }),
            choice('national', 'Return the decision to national governments',
                'Preserve national autonomy while risking a fragmented restart.',
                'Each government decides when its developers may proceed. The common process gives way to separate national timelines.',
                { effects: { 'world.treatyStability': -20, 'world.tension': 12 }, sets: { 'flags.treatyRatified': false } })
        ])
];

function getEvent(id) {
    return EVENTS.find(item => item.id === id) || null;
}

function selectEvent(state) {
    let selected = null;
    for (const item of EVENTS) {
        if (RETIRED_EVENT_IDS.includes(item.id)) continue;
        if (item.once && state.seenEvents.includes(item.id)) continue;
        if (!item.eligible(state)) continue;
        if (!selected || item.priority > selected.priority) selected = item;
    }
    return selected;
}

function readNumber(state, path) {
    if (!NUMERIC_PATHS.has(path)) return null;
    let value = state;
    for (const key of path.split('.')) {
        if (!value || !Object.prototype.hasOwnProperty.call(value, key)) return null;
        value = value[key];
    }
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const RESOURCE_LABELS = {
    'resources.funds': 'funds', 'resources.compute': 'compute',
    'player.influence': 'influence', 'player.security': 'security', 'player.trust': 'trust',
    'research.control': 'control research', 'research.evals': 'evaluation research',
    'world.coordination': 'coordination', 'world.verification': 'verification',
    'world.treatyCoverage': 'treaty coverage'
};

function getChoiceAvailability(state, selectedChoice) {
    if (!isRecord(state) || !isRecord(selectedChoice)) {
        return { available: false, reason: 'This choice is unavailable.' };
    }
    for (const field of ['requirements', 'costs']) {
        const conditions = selectedChoice[field] === undefined ? {} : selectedChoice[field];
        if (!isRecord(conditions)) return { available: false, reason: 'This choice has invalid requirements.' };
        for (const [path, amount] of Object.entries(conditions)) {
            if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || !NUMERIC_PATHS.has(path)) {
                return { available: false, reason: 'This choice has invalid requirements.' };
            }
            const current = readNumber(state, path);
            if (current === null || current < amount) {
                const label = RESOURCE_LABELS[path] || path.split('.').at(-1);
                const required = path === 'resources.funds' ? `$${amount}B` : `${amount} ${label}`;
                const value = current === null ? null : Number(current.toFixed(3));
                const available = value === null ? 'current value unavailable' :
                    `currently ${path === 'resources.funds' ? `$${value}B` : value}`;
                return { available: false, reason: `Requires ${required}; ${available}.` };
            }
        }
    }
    return { available: true, reason: '' };
}

// Validate the authored catalog independently of the engine's save validation.
function validateEventCatalog(catalog = EVENTS) {
    const errors = [];
    const ids = new Set();
    if (!Array.isArray(catalog)) return ['The event catalog must be an array.'];
    for (const item of catalog) {
        if (!isRecord(item)) { errors.push('An event is not an object.'); continue; }
        const prefix = item.id || '(missing ID)';
        if (typeof item.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(item.id) || ids.has(item.id)) errors.push(`${prefix}: invalid or duplicate event ID.`);
        ids.add(item.id);
        for (const field of ['title', 'body']) {
            if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${prefix}: missing ${field}.`);
        }
        if (!Number.isFinite(item.priority) || typeof item.eligible !== 'function' || item.once !== true) errors.push(`${prefix}: invalid selection rules.`);
        if (!Array.isArray(item.choices) || item.choices.length < 2) { errors.push(`${prefix}: requires at least two choices.`); continue; }
        const choiceIds = new Set();
        let freeFallback = false;
        for (const option of item.choices) {
            if (!isRecord(option)) { errors.push(`${prefix}: invalid choice.`); continue; }
            if (typeof option.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(option.id) || choiceIds.has(option.id)) errors.push(`${prefix}: invalid or duplicate choice ID.`);
            choiceIds.add(option.id);
            for (const field of ['label', 'description', 'result']) {
                if (typeof option[field] !== 'string' || !option[field].trim()) errors.push(`${prefix}/${option.id}: missing ${field}.`);
            }
            for (const field of ['costs', 'requirements', 'effects']) {
                if (option[field] === undefined) continue;
                if (!isRecord(option[field])) { errors.push(`${prefix}/${option.id}: invalid ${field}.`); continue; }
                for (const [path, value] of Object.entries(option[field])) {
                    if (!NUMERIC_PATHS.has(path) || typeof value !== 'number' || !Number.isFinite(value) || (field !== 'effects' && value < 0)) errors.push(`${prefix}/${option.id}: invalid ${field} at ${path}.`);
                }
            }
            if (option.sets !== undefined) {
                if (!isRecord(option.sets)) errors.push(`${prefix}/${option.id}: invalid sets.`);
                else for (const [path, value] of Object.entries(option.sets)) {
                    const validFlag = path.startsWith('flags.') && Object.prototype.hasOwnProperty.call(FLAG_EFFECTS, path.slice(6)) && typeof value === 'boolean';
                    const validPolicy = POLICY_VALUES[path]?.includes(value) === true;
                    if (!validFlag && !validPolicy) errors.push(`${prefix}/${option.id}: invalid set at ${path}.`);
                }
            }
            if (Object.values(option.costs || {}).every(value => value === 0) &&
                Object.values(option.requirements || {}).every(value => value === 0)) freeFallback = true;
        }
        if (!freeFallback) errors.push(`${prefix}: no unconditional free fallback.`);
    }
    return errors;
}

export { EVENTS, RETIRED_EVENT_IDS, FLAG_EFFECTS, POLICY_VALUES, getEvent, selectEvent, getChoiceAvailability, validateEventCatalog };
