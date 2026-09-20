import {
    LABS, SECTORS, createCampaign, setAllocation, setPlan, getForecast,
    advanceQuarter, getCurrentEvent, getChoiceAvailability, resolveDecision,
    getTransitionDecision, resolveTransition, serializeCampaign, restoreCampaign,
    startResearchTrial, completeResearchTrial, cancelResearchTrial
} from './campaign.js';
import { createCosmos } from './cosmos.js';
import { mountResearchGame, RESEARCH_TYPES } from './research-games.js';

const SAVE_KEY = 'critical-path-campaign-v1';
const ARCHIVE_KEY = 'critical-path-previous-campaign-v1';
const app = document.getElementById('app');
const announcer = document.getElementById('announcer');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const presets = {
    Balanced: { capabilities:30, safety:20, security:15, products:15, diplomacy:10, infrastructure:10 },
    Research: { capabilities:50, safety:15, security:10, products:10, diplomacy:5, infrastructure:10 },
    Safety: { capabilities:15, safety:40, security:20, products:10, diplomacy:10, infrastructure:5 },
    Coordination: { capabilities:10, safety:20, security:15, products:10, diplomacy:35, infrastructure:10 }
};
const researchCopy = {
    alignment: ['Alignment', 'Research into what systems learn to pursue. Better training objectives help, but a convincing evaluation is not proof of safe behavior.'],
    control: ['Control', 'Limits on access, permissions, and autonomy. These reduce the damage an unreliable system can cause while other safety work continues.'],
    evals: ['Evaluations', 'Tests and independent checks that make dangerous capabilities and misleading behavior easier to detect. Better evidence narrows uncertainty.'],
    interpretability: ['Interpretability', 'Methods for examining what happens inside a model. This complements behavioral tests and gives investigators another source of evidence.']
};
let campaign = null;
let savedCampaign = null;
let screen = 'welcome';
let activeTab = 'overview';
let modal = null;
let notice = '';
let noticeError = false;
let saveFailed = false;
let saveConflict = false;
const locks = new Set();
let cosmos = null;
let cosmosPlaying = false;
let cosmosProgress = 0;
let cosmosCampaignId = null;
let researchGame = null;
let modalOpener = null;
let modalResumeCosmos = false;
let saveTimer = null;
let selectedLab = 'openai';
let seedInput = makeSeed();
let onboardingDismissed = false;

function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
function number(value, digits = 0) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
}
function percent(value, digits = 0) { return `${number(Number(value) * 100, digits)}%`; }
function date(turn = campaign?.turn || 0) { return `Q${turn % 4 + 1} ${2026 + Math.floor(turn / 4)}`; }
function money(value) { return `$${number(value, 1)}B`; }
function signed(value, digits = 1) { return `${value >= 0 ? '+' : ''}${number(value, digits)}`; }
function makeSeed() {
    const words = ['cedar','orbit','dawn','harbor','solstice','juniper','meridian','signal'];
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${words[values[0] % words.length]}-${String(values[1] % 10000).padStart(4, '0')}`;
}
function marker() {
    return '<span class="ai-marker" role="img" aria-label="AI-written title or heading" title="This title or heading was written by AI. Sparkles mark AI-written titles and headings.">✨</span>';
}
function heading(text, level = 2, id = '') { return `<h${level}${id ? ` id="${id}" tabindex="-1"` : ''}>${marker()}${escape(text)}</h${level}>`; }
function button(label, action, extra = '', type = 'secondary') {
    return `<button type="button" class="button ${type}" data-action="${action}" ${extra}>${label}</button>`;
}
function announce(text) { announcer.textContent = text; }
function setNotice(text, error = false) { notice = text; noticeError = error; }

function readSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return restoreCampaign(raw);
    } catch (error) {
        setNotice(`The saved campaign could not be opened. You can import a backup or start a new campaign. ${error.message}`, true);
        return null;
    }
}
function persist() {
    clearTimeout(saveTimer);
    if (!campaign || screen !== 'campaign' || saveConflict) return;
    savedCampaign = campaign;
    try {
        localStorage.setItem(SAVE_KEY, serializeCampaign(campaign));
        saveFailed = false;
    } catch {
        saveFailed = true;
        announce('This browser could not save the campaign. Export a save to keep your progress.');
    }
    updateSaveIndicator();
}
function updateSaveIndicator() {
    const indicator = document.getElementById('save-status');
    if (indicator) indicator.innerHTML = saveConflict ? 'Save changed in another tab' : saveFailed ? 'Export to keep progress' : '<span class="save-dot"></span>Saved in this browser';
}
function exportSave() {
    const exported = campaign || savedCampaign;
    if (!exported) return;
    const blob = new Blob([serializeCampaign(exported)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `critical-path-${exported.seed.replace(/[^a-z0-9-]/gi, '-').slice(0,50)}-${exported.turn}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Campaign save exported.');
}

function renderHeader() {
    const playing = screen === 'campaign';
    return `<header class="site-header">
      <a class="brand" href="#" data-action="home">Critical Path</a>
      <nav class="header-actions" aria-label="Game controls">
        ${playing ? button('Export save','export','','ghost') : button('Import save','import','','ghost')}
        ${button('How to play','help','id="help-button"','ghost')}
        ${button('Model notes','model','id="model-button"','ghost')}
      </nav>
    </header>`;
}
function renderNotice() {
    let html = notice ? `<div class="notice ${noticeError ? 'error' : ''}" role="status">${escape(notice)} ${button('Dismiss','dismiss-notice','','ghost')}</div>` : '';
    if (saveConflict) html += `<div class="notice error" role="alert">Another tab changed this campaign. Load that save before continuing.${button('Load latest save','reload-save')}</div>`;
    if (saveFailed) html += `<div class="notice error" role="alert">Saving is unavailable in this browser. Export a copy to keep your progress.${button('Export save','export')}</div>`;
    return html;
}
function renderWelcome() {
    return `<main id="main" class="welcome">
      ${renderNotice()}
      <section class="welcome-hero" aria-labelledby="game-title">
        <div class="welcome-copy"><h1 id="game-title">Critical Path</h1>
          <p class="lede">Lead an AI lab from 2026 through the arrival of superintelligence. Allocate research, respond to events, and decide how powerful AI is used.</p>
          <p class="muted small">Turn-based · About 20 minutes · Autosaves locally</p>
          ${savedCampaign ? `<div class="setup-controls" style="margin-top:12px">${button(`Continue · ${escape(date(savedCampaign.turn))}`, 'continue', '', '')}<span class="small muted">${escape(LABS.find(l => l.id === savedCampaign.labId)?.name || savedCampaign.labId)}</span></div>` : ''}
        </div>
      </section>
      <section class="setup" aria-labelledby="lab-heading"><div class="section-top"><h3 id="lab-heading">Choose your lab</h3></div>
        <fieldset style="border:0;padding:0;margin:0"><legend class="sr-only">Starting lab</legend><div class="lab-options">${LABS.map(lab => `<label class="lab-option"><input type="radio" name="lab" value="${escape(lab.id)}" ${selectedLab === lab.id ? 'checked' : ''}><span class="lab-card"><strong>${escape(lab.name)}</strong><small>${escape(lab.description)}</small></span></label>`).join('')}</div></fieldset>
        <div class="setup-footer"><div class="setup-controls"><label class="seed-label" for="campaign-seed">World seed <input class="text-input mono" id="campaign-seed" maxlength="80" value="${escape(seedInput)}" autocomplete="off" spellcheck="false"></label>${button('Shuffle','shuffle-seed','','ghost')}</div>${button('Begin campaign','new-campaign','','')}</div>
        <p class="small muted" style="margin-top:12px">Fictional scenarios using real lab names. Events are possibilities viewed from the start of 2026, not claims about later events.</p>
      </section>
      ${renderFooterLinks()}
    </main>`;
}
function renderFooterLinks() {
    return '<footer class="footer-links"><a href="/projects/">← Projects</a><a href="https://github.com/tkwa/save-the-world-game" target="_blank" rel="noopener">Source code</a><span>0.6.0-beta.1</span></footer>';
}
function renderMetrics(forecast) {
    const rivals = Math.max(...campaign.rivals.map(r => r.capability), 1);
    const lead = campaign.player.capability / rivals;
    const position = lead === 0 ? 'Research capacity must be rebuilt' : lead >= 1 ? `${number(lead,1)}× ahead of nearest rival` : `${number(1/lead,1)}× behind the leader`;
    return `<div class="metrics" aria-label="Campaign indicators">
      <div class="metric"><span class="metric-label">Capability index</span><span class="metric-value number">${number(campaign.player.capability,1)}</span><span class="metric-detail">${position}</span></div>
      <div class="metric"><span class="metric-label">Transition risk estimate</span><span class="metric-value number ${forecast.risk > .35 ? 'negative' : ''}">${percent(forecast.riskLow)}–${percent(forecast.riskHigh)}</span><span class="metric-detail">World-level risk if ASI arrived now</span></div>
      <div class="metric"><span class="metric-label">Available funds</span><span class="metric-value number">${money(campaign.resources.funds)}</span><span id="forecast-net" class="metric-detail">${signed(forecast.quarterlyRevenue - forecast.quarterlyCost)}B expected next quarter</span></div>
      <div class="metric coordination-metric"><span class="metric-label">International coordination</span><span class="metric-value">${escape(forecast.treatyStatus)}</span><span class="metric-detail">${escape(coordinationObstacle())}</span></div>
    </div>`;
}
function renderChoices(event, transition = false) {
    return `<div class="choice-grid">${event.choices.map(choice => {
        const availability = getChoiceAvailability(campaign, choice);
        const costLabels = Object.entries(choice.costs || {}).map(([key,value]) => key === 'resources.funds' ? money(value) : `${number(value)} ${key.split('.').pop()}`);
        return `<button type="button" class="choice" data-action="${transition ? 'transition-choice' : 'event-choice'}" data-choice="${escape(choice.id)}" ${!availability.available || saveConflict ? 'disabled' : ''}><strong>${escape(choice.label)}</strong><span class="choice-description">${escape(choice.description || '')}</span>${costLabels.length ? `<span class="choice-cost">Cost: ${escape(costLabels.join(' · '))}</span>` : ''}${!availability.available ? `<span class="choice-unavailable">${escape(availability.reason)}</span>` : ''}</button>`;
    }).join('')}</div>`;
}
function renderDecision() {
    const transition = campaign.phase === 'transition';
    const event = transition ? getTransitionDecision(campaign) : getCurrentEvent(campaign);
    if (!event) return '';
    return `<section class="decision" aria-labelledby="decision-title"><div class="eyebrow">${transition ? 'The transition' : 'Decision required'}</div>${heading(event.title,2,'decision-title')}<p class="decision-body">${escape(event.body)}</p>${renderChoices(event,transition)}</section>`;
}
function renderReport() {
    if (!campaign.latestReport?.length) return '';
    return `<section class="report" aria-label="Last quarter"><h3>Quarterly report</h3><ul>${campaign.latestReport.slice(0,5).map(text => `<li>${escape(text)}</li>`).join('')}</ul></section>`;
}
function renderPlan(forecast) {
    const disabled = campaign.phase !== 'planning' || saveConflict;
    const activePreset = Object.entries(presets).find(([,plan]) => Object.keys(plan).every(key => plan[key] === campaign.allocations[key]))?.[0];
    return `<section class="section" aria-labelledby="plan-heading"><div class="section-heading"><h3 id="plan-heading">AI labor allocation</h3><span class="small muted">100%</span></div>
      <div class="plan-presets" aria-label="Allocation presets">${Object.keys(presets).map(name => button(name,'preset',`data-preset="${name}" aria-pressed="${activePreset === name}" ${disabled ? 'disabled' : ''}`)).join('')}</div>
      <div id="allocation-sliders">${SECTORS.map(sector => `<div class="allocation-row"><label for="allocation-${sector.id}" title="${escape(sector.description)}">${escape(sector.label)}</label><input type="range" id="allocation-${sector.id}" data-sector="${sector.id}" min="0" max="100" step="1" value="${campaign.allocations[sector.id]}" style="--fill:${campaign.allocations[sector.id]}%" aria-describedby="description-${sector.id}" ${disabled || locks.has(sector.id) ? 'disabled' : ''}><output id="value-${sector.id}" class="allocation-value mono" for="allocation-${sector.id}">${campaign.allocations[sector.id]}%</output><button type="button" class="lock-button" id="lock-${sector.id}" data-action="lock" data-sector="${sector.id}" aria-label="${locks.has(sector.id) ? 'Unlock' : 'Lock'} ${escape(sector.label)} allocation" aria-pressed="${locks.has(sector.id)}" ${disabled ? 'disabled' : ''}>${locks.has(sector.id) ? '●' : '○'}</button><span id="description-${sector.id}" class="sr-only">${escape(sector.description)}</span></div>`).join('')}</div>
      <p class="plan-note">Plan persists each quarter. ○ locks a share. <span id="diversity-readout">${percent(forecast.diversityBonus)} diversity bonus</span>.</p>
      <details class="allocation-help"><summary>What each allocation does</summary><dl>${SECTORS.map(sector => `<div><dt>${escape(sector.label)}</dt><dd>${escape(sector.description)}</dd></div>`).join('')}</dl></details>
    </section>`;
}
function renderStandingPlan() {
    return `<details class="standing-plan"><summary>Standing plan</summary><p class="muted small">${SECTORS.map(sector => `${escape(sector.label)} ${campaign.allocations[sector.id]}%`).join(' · ')}</p></details>`;
}
function renderRace() {
    const labs = [{ id:campaign.labId, name:LABS.find(l => l.id === campaign.labId)?.name || campaign.labId, capability:campaign.player.capability }, ...campaign.rivals].sort((a,b) => b.capability-a.capability);
    return `<section class="section" aria-labelledby="race-heading"><div class="section-heading"><h3 id="race-heading">The frontier</h3><span class="small muted">ASI at 1,000</span></div>${labs.map(lab => `<div class="race-row ${lab.id === campaign.labId ? 'player' : ''}"><div class="race-label"><strong>${escape(lab.name)}${lab.id === campaign.labId ? ' · you' : ''}</strong><span class="mono">${number(lab.capability,1)}</span></div><div class="race-track"><div class="race-fill" style="width:${Math.min(100,Math.log(Math.max(1,lab.capability))/Math.log(1000)*100)}%"></div></div></div>`).join('')}<p class="small muted">Bars use a logarithmic scale.</p></section>`;
}
function coordinationObstacle() {
    if (!campaign.flags.computeRegistry) return 'No shared registry of frontier compute';
    if (!campaign.flags.inspections) return 'Registry in place; inspections needed';
    if (!campaign.flags.treatyRatified) return 'Inspections in place; limits not agreed';
    const weakest = [['treatyCoverage','Participation'],['verification','Verification'],['treatyStability','Continued cooperation']].sort(([a],[b]) => campaign.world[a]-campaign.world[b])[0];
    return `${weakest[1]} is the limiting factor`;
}
function renderProducts(forecast) {
    return `<section class="section product-forecast"><div class="section-heading"><h3>Product receipts</h3><span class="small muted">9-month lifecycle</span></div><div id="product-cashflow">${renderProductCashflow(forecast)}</div><p class="small muted">Active products and this quarter’s launches. Future launches add to these receipts.</p></section>`;
}
function renderProductCashflow(forecast) {
    return (forecast.productCashflow || []).map(item => `<div class="cashflow-row"><span>${date(item.turn)}</span><span>${money(item.revenue)}</span></div>`).join('');
}
function renderResearchTrials() {
    return `<section class="research-trials"><div class="section-heading"><h3>Technical research</h3><span class="small muted">Optional · 1–2 minutes each</span></div>${Object.entries(RESEARCH_TYPES).map(([type,info]) => {
        const completed = campaign.researchTrials.completed[type];
        return `<div class="trial-row"><span>${escape(info.title)}</span><span class="muted small">${completed ? `${percent(completed.score)} · complete` : info.name}</span>${button(completed ? 'Complete' : 'Investigate','start-trial',`id="trial-${type}" data-trial="${type}" aria-label="${escape(info.title)}: ${completed ? 'complete' : 'investigate'}" ${completed || campaign.phase !== 'planning' || saveConflict ? 'disabled' : ''}`)}</div>`;
    }).join('')}</section>`;
}
function renderResearch() {
    return `${renderResearchTrials()}<section><div class="section-top"><h3>Research</h3><span class="muted small">These are research indices, not probabilities.</span></div><div class="research-cards">${Object.entries(researchCopy).map(([key,[label,description]]) => `<article class="research-card"><span class="number">${number(campaign.research[key])}<span class="small muted">/100</span></span><h3>${label}</h3><p>${description}</p><progress max="100" value="${campaign.research[key]}" aria-label="${label}"></progress></article>`).join('')}<article class="research-card"><span class="number">${number(campaign.player.security)}<span class="small muted">/100</span></span><h3>Security</h3><p>Protection against weight theft, compromised infrastructure, and unauthorized access. A safe model can still be dangerous in another actor's hands.</p><progress max="100" value="${campaign.player.security}" aria-label="Security"></progress></article><article class="research-card"><span class="number">${number(campaign.player.legitimacy)}<span class="small muted">/100</span></span><h3>Legitimacy</h3><p>Whether people can inspect, contest, and influence the institutions directing powerful systems. Concentrated capability and broad human control are separate outcomes.</p><progress max="100" value="${campaign.player.legitimacy}" aria-label="Legitimacy"></progress></article></div></section>`;
}
function renderHistory() {
    const entries = [...campaign.history].reverse();
    return `<section aria-label="Campaign history">${entries.length ? `<ol class="history-list">${entries.map(entry => `<li><time>${escape(date(entry.turn || 0))}</time><div>${heading(entry.title || 'Quarterly update',3)}<p>${escape(entry.text || '')}</p></div></li>`).join('')}</ol>` : '<p class="empty-state">Your first quarterly report will appear here. Important decisions and their consequences remain in the campaign log.</p>'}</section>`;
}
function renderCampaign() {
    if (campaign.phase === 'complete') return renderEnding();
    const forecast = getForecast(campaign);
    const lab = LABS.find(item => item.id === campaign.labId);
    const pending = campaign.phase === 'decision' || campaign.phase === 'transition';
    return `<main id="main" class="shell">${renderNotice()}<div class="campaign-heading"><div><h1>${escape(forecast.date || date())}</h1><span class="context">${escape(lab?.name)}</span></div><span id="save-status" class="save-indicator"></span></div>${renderMetrics(forecast)}
      ${!onboardingDismissed && campaign.turn === 0 ? `<div class="notice onboarding">Set a standing plan, then advance a quarter. Moving a slider redistributes the budget.${button('Got it','dismiss-onboarding','','ghost')}</div>` : ''}
      <nav class="tab-bar" role="tablist" aria-label="Campaign views">${[['overview','Overview'],['research','Research'],['history','Log']].map(([id,label]) => `<button type="button" role="tab" id="tab-${id}" tabindex="${activeTab === id ? '0' : '-1'}" aria-selected="${activeTab === id}" aria-controls="campaign-view" data-action="tab" data-tab="${id}">${label}${id === 'overview' && pending ? ' · decision' : ''}</button>`).join('')}</nav>
      <div id="campaign-view" role="tabpanel" aria-labelledby="tab-${activeTab}">${activeTab === 'overview' ? `<div class="dashboard"><div class="primary-column">${pending ? renderDecision()+renderStandingPlan() : renderPlan(forecast)+renderReport()}</div><aside class="sidebar" aria-label="World and research">${renderRace()}${renderProducts(forecast)}</aside></div>` : activeTab === 'research' ? renderResearch() : renderHistory()}</div>
    </main><div class="footer-bar"><div class="footer-inner"><div class="footer-summary"><span>Next quarter: <strong id="forecast-capability">${signed(forecast.capabilityGain,1)} capability</strong></span><span>Receipts <strong id="forecast-income">${money(forecast.quarterlyRevenue)}</strong> − costs <strong id="forecast-cost">${money(forecast.quarterlyCost)}</strong></span></div>${button(pending ? 'Decision required' : 'Advance quarter →', pending ? 'show-decision' : 'advance', `id="advance-button" ${saveConflict ? 'disabled' : ''}`, '')}</div></div>`;
}
function renderEnding() {
    const outcome = campaign.outcome;
    const titles = { flourishing:'A future to inhabit', fragile:'The work is not over', captured:'Power without permission', extinction:'No one left to inherit it' };
    return `<main id="main" class="ending-shell">${renderNotice()}<header class="ending-heading"><div class="eyebrow">${escape(String(outcome.year))} · ${escape(outcome.winner || 'The transition')}</div>${heading(titles[outcome.kind] || 'Beyond the transition',1,'ending-title')}<p>${escape(outcome.summary)}</p></header>
      <section aria-label="Your future"><div class="cosmos-stage"><canvas id="cosmos-canvas" aria-label="Animated projection from the Sun to nearby stars. A text summary of the milestones follows." role="img"></canvas></div><div class="cosmos-caption"><span id="cosmos-year" class="number">${escape(String(outcome.year))}</span><p id="cosmos-phase">${outcome.survival ? 'The first collectors' : 'An empty inheritance'}</p><p id="cosmos-scale"></p><p id="cosmos-reach"></p></div><div class="cosmos-control-bar">${button('Play','cosmos-toggle','id="cosmos-toggle"','secondary')}<label class="sr-only" for="cosmos-seek">Ending animation progress</label><input id="cosmos-seek" type="range" min="0" max="1000" step="1" value="0">${button('Replay','cosmos-replay','','ghost')}<span class="small muted">${reducedMotion.matches ? 'Reduced motion' : 'Projection'}</span></div></section>
      <div class="ending-metrics"><div class="ending-metric"><span class="metric-label">Human flourishing</span><strong class="number">${number(outcome.flourishing)}<span class="small muted">/100</span></strong><span>Health, access, and room to live</span></div><div class="ending-metric"><span class="metric-label">Human control</span><strong class="number">${number(outcome.humanControl)}%</strong><span>Authority people can retain and contest</span></div><div class="ending-metric"><span class="metric-label">Your ownership</span><strong class="number">${number(outcome.personalOwnership,1)}%</strong><span>Personal share of the emerging economy</span></div></div>
      <div class="ending-details"><section>${heading('What shaped this outcome',3)}<ul class="cause-list">${(outcome.causes || []).map(cause => `<li>${escape(cause)}</li>`).join('')}</ul><p class="small muted" style="margin-top:20px">Estimated existential risk at the transition: ${percent(outcome.transitionRisk,1)}. This is one realized future, not a guarantee or an overall score.</p></section><section>${heading('Beyond the transition',3)}<div class="milestones">${[
        ['First-year economy',outcome.survival ? `${number(outcome.economyYearOne,1)}× pre-ASI output` : 'Human economy lost'],
        ['Aging treatments',outcome.survival && outcome.agingSolvedYear ? String(outcome.agingSolvedYear) : 'Not reached for humanity'],
        ['Mature nanotechnology',outcome.nanotechYear ? String(outcome.nanotechYear) : 'Not reached'],
        ['Dyson swarm begins',outcome.dysonStartYear ? String(outcome.dysonStartYear) : 'Not reached'],
        ['Swarm construction',outcome.dysonCompletionYears ? `${number(outcome.dysonCompletionYears,1)} years` : 'Not reached'],
        ['Interstellar probes',outcome.probeLaunchYear ? String(outcome.probeLaunchYear) : 'Not reached']
      ].map(([label,value]) => `<div class="milestone"><span>${label}</span><span class="mono">${escape(value)}</span></div>`).join('')}</div></section></div>
      <div class="ending-actions">${button('Another campaign','home','','')}${button('Export this run','export')}${button('Read the campaign log','ending-history')}${button('Model notes','model')}</div>${renderFooterLinks()}
    </main>`;
}
function renderModal() {
    if (!modal) return '';
    let content;
    if (modal === 'research') return '<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal research-modal" role="dialog" aria-modal="true" aria-label="Technical research"><div id="research-game"></div></section></div>';
    if (modal === 'help') content = `${heading('How to play',2,'dialog-title')}<ol class="help-list"><li>Choose a lab and set the standing allocation of AI labor. Moving a slider redistributes the remaining budget; lock a share to protect it.</li><li>Advance one quarter. Research, income, rivals, and negotiations develop together. Respond to decisions when they arrive.</li><li>Watch what your lead is buying. Safety evidence, security, international agreements, and legitimate authority address different problems.</li><li>When a lab reaches superintelligence, make a few final choices about control, access, and expansion. Human flourishing and your ownership are reported separately.</li></ol><p class="small muted">Progress saves automatically in this browser. Export a save before switching devices. Keyboard: Tab between controls, arrow keys adjust sliders, N advances a quarter, ? opens this guide.</p>`;
    else if (modal === 'history') content = `${heading('Campaign log',2,'dialog-title')}${renderHistory()}`;
    else content = `${heading('Model notes',2,'dialog-title')}<div class="text-block"><p>This game explores a worldview; it is not a forecasting tool. Its default trajectory starts in January 2026 and reaches superintelligence between late 2027 and 2034. Strong, sustained coordination can push that date later.</p><details><summary>Campaign indices</summary><p>Capability is an abstract game index, starting at 10 for your lab; 1,000 triggers the transition. It is not a measured multiplier of intelligence. Research and institutional indices likewise summarize mechanisms rather than measuring them directly.</p></details><details open><summary>Risk and uncertainty</summary><p>The reference worldview assigns roughly 20% probability to existential catastrophe. A campaign's risk changes with safety research, deployment, security, and institutions. The displayed range reflects limited evidence; the ending resolves uncertainty once and preserves that result in the save.</p></details><details><summary>Research and international coordination</summary><p>Alignment, control, evaluations, interpretability, and security do different work. Agreements depend on incentives and verification. Diplomacy without enforcement does not stop hidden development; public safety work can help rival labs as well as your own.</p></details><details><summary>After superintelligence</summary><p>Successful transitions can double economic output in the first year and accelerate thereafter. Aging and nanotechnology can be solved within two years. Dyson-swarm construction begins in the ASI year and can take 3.5–80 years, depending on industrial expansion and institutions.</p></details><details><summary>Outcomes and values</summary><p>Human flourishing, human control, and personal ownership are separate. The game does not collapse them into a combined score. A company's market lead is not a measure of human welfare.</p></details><details><summary>Sources and scenario framing</summary><p>Critical Path draws primarily on Thomas Kwa's worldview and the original game, with mechanisms inspired by <a href="https://ai-2027.com/" target="_blank" rel="noopener">AI 2027</a> and <a href="https://ai-2040.com/" target="_blank" rel="noopener">AI 2040</a>. The latter is a proposed coordination path, not the default timeline. Future events involving real labs are fictional possibilities, viewed from January 2026.</p></details><p class="small muted">${campaign ? `World seed: ${escape(campaign.seed)} · ${escape(date())}` : 'The same lab, seed, and decisions reproduce the same campaign.'}</p></div>`;
    return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${content}<div class="close-row">${button('Close','close-modal','id="close-modal"','')}</div></section></div>`;
}

function render({ focus = null } = {}) {
    const wasPlaying = cosmosPlaying;
    cosmos?.dispose();
    cosmos = null;
    researchGame?.dispose();
    researchGame = null;
    const previousId = document.activeElement?.id;
    app.innerHTML = renderHeader() + (screen === 'campaign' && campaign ? renderCampaign() : renderWelcome()) + renderModal();
    updateSaveIndicator();
    if (screen === 'campaign' && campaign?.phase !== 'complete') updatePlanReadouts();
    if (screen === 'campaign' && campaign?.phase === 'complete') setupCosmos(wasPlaying);
    const focusTarget = focus || previousId;
    if (focusTarget) document.getElementById(focusTarget)?.focus({ preventScroll:!focus });
    if (modal) activateModal();
}
function openModal(type, opener = document.activeElement) {
    if (modal) closeModal();
    modalOpener = opener;
    modal = type;
    modalResumeCosmos = cosmosPlaying;
    cosmos?.pause();
    app.insertAdjacentHTML('beforeend',renderModal());
    activateModal();
}
function activateModal() {
    for (const child of app.children) child.inert = !child.classList.contains('modal-backdrop');
    if (modal === 'research') setupResearchTrial();
    const first = app.querySelector('.modal button,.modal summary,.modal a');
    first?.focus({preventScroll:true});
}
function closeModal() {
    if (modal === 'research' && campaign?.researchTrials.active) { cancelResearchTrial(campaign); persist(); }
    researchGame?.dispose();
    researchGame = null;
    app.querySelector('.modal-backdrop')?.remove();
    for (const child of app.children) child.inert = false;
    modal = null;
    if (modalOpener?.isConnected) modalOpener.focus({preventScroll:true});
    else if (modalOpener?.id) document.getElementById(modalOpener.id)?.focus({preventScroll:true});
    modalOpener = null;
    if (modalResumeCosmos && screen === 'campaign' && !saveConflict) cosmos?.play();
    modalResumeCosmos = false;
}
function setupResearchTrial() {
    const owner = campaign;
    const trial = owner?.researchTrials.active;
    const container = document.getElementById('research-game');
    if (!trial || !container) return;
    researchGame = mountResearchGame(container, { type:trial.type, seed:trial.seed, reducedMotion:reducedMotion.matches,
        onComplete(score) {
            if (campaign !== owner || saveConflict || owner.researchTrials.active?.id !== trial.id) return;
            const result = completeResearchTrial(owner,trial.id,score);
            closeModal();
            applyResult(result,'tab-research');
            announce('Research recorded.');
        },
        onCancel() { closeModal(); render({focus:`trial-${trial.type}`}); }
    });
}
function updatePlanReadouts() {
    for (const sector of SECTORS) {
        const input = document.getElementById(`allocation-${sector.id}`);
        if (!input) continue;
        input.max = 100 - [...locks].filter(key => key !== sector.id).reduce((sum,key) => sum + campaign.allocations[key],0);
        input.value = campaign.allocations[sector.id];
        input.style.setProperty('--fill',`${Number(input.max) ? Number(input.value)/Number(input.max)*100 : 0}%`);
        document.getElementById(`value-${sector.id}`).textContent = `${input.value}%`;
    }
    const forecast = getForecast(campaign);
    const products = document.getElementById('product-cashflow');
    if (products) products.innerHTML = renderProductCashflow(forecast);
    const updates = { 'diversity-readout':`${percent(forecast.diversityBonus)} diversity bonus`, 'forecast-capability':`${signed(forecast.capabilityGain,1)} capability`, 'forecast-income':money(forecast.quarterlyRevenue), 'forecast-cost':money(forecast.quarterlyCost), 'forecast-net':`${signed(forecast.quarterlyRevenue - forecast.quarterlyCost)}B expected next quarter` };
    for (const [id,text] of Object.entries(updates)) { const node = document.getElementById(id); if (node) node.textContent = text; }
    for (const control of document.querySelectorAll('[data-preset]')) {
        control.setAttribute('aria-pressed',Object.entries(presets[control.dataset.preset]).every(([key,value]) => campaign.allocations[key] === value));
    }
}
function setupCosmos(resume = false) {
    const canvas = document.getElementById('cosmos-canvas');
    if (!canvas) return;
    if (cosmosCampaignId !== campaign.id) { cosmosCampaignId = campaign.id; cosmosProgress = reducedMotion.matches ? 1 : 0; resume = false; }
    const savedProgress = cosmosProgress;
    cosmos = createCosmos(canvas, { outcome:campaign.outcome, reducedMotion:reducedMotion.matches, onProgress(progress, metadata = {}) {
        cosmosProgress = progress;
        const slider = document.getElementById('cosmos-seek');
        if (slider && document.activeElement !== slider) slider.value = Math.round(progress*1000);
        const phase = document.getElementById('cosmos-phase');
        const year = document.getElementById('cosmos-year');
        const scale = document.getElementById('cosmos-scale');
        const reach = document.getElementById('cosmos-reach');
        if (scale) scale.textContent = `${metadata.scaleLabel || ''}${metadata.timeHeld ? ' · time held during zoom' : ''}`;
        if (reach) reach.textContent = metadata.maxProbeReachLightYears > 0 ? `Probe reach ≤ ${number(metadata.maxProbeReachLightYears,1)} light-years · time-compressed schematic` : 'Time-compressed schematic';
        if (phase) phase.textContent = ({construction:'Dyson swarm construction','solar-system':'The Solar System','nearby-stars':'Nearby stars','milky-way':'The Milky Way','local-group':'The Local Group','observable-universe':'The observable universe'})[metadata.phase] || metadata.phase || (progress < .55 ? 'Collector orbits multiply' : progress < .8 ? 'The Solar System becomes a launch site' : 'The first journeys to other stars');
        if (year) year.textContent = String(Math.round(metadata.year || campaign.outcome.year + progress*(campaign.outcome.dysonCompletionYears || 25)));
        if (typeof metadata.playing === 'boolean') cosmosPlaying = metadata.playing;
        if (progress >= 1) cosmosPlaying = false;
        const control = document.getElementById('cosmos-toggle');
        if (control) control.textContent = cosmosPlaying ? 'Pause' : 'Play';
    } });
    cosmos.seek(savedProgress);
    if (resume && !modal && !reducedMotion.matches) cosmos.play();
}
function applyResult(result, focus = null) {
    if (result?.ok === false) { setNotice(result.reason || 'That action is not available.',true); render(); return; }
    notice = '';
    persist();
    render({focus});
}
function showCampaign(state) {
    notice = '';
    campaign = state;
    screen = 'campaign';
    activeTab = 'overview';
    locks.clear();
    modal = null;
    cosmosProgress = 0;
    cosmosCampaignId = null;
    cosmosPlaying = false;
    saveConflict = false;
    persist();
    render();
    if (campaign.researchTrials.active) openModal('research');
    window.scrollTo({top:0,behavior:'instant'});
}

app.addEventListener('input', event => {
    const target = event.target;
    if (target.id === 'campaign-seed') seedInput = target.value;
    if (target.matches('input[type="radio"][name="lab"]')) selectedLab = target.value;
    if (target.matches('input[type="range"][data-sector]') && campaign && !saveConflict) {
        setAllocation(campaign,target.dataset.sector,Number(target.value),[...locks]);
        updatePlanReadouts();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist,250);
    }
    if (target.id === 'cosmos-seek') { cosmos?.pause(); cosmosPlaying = false; cosmos?.seek(Number(target.value)/1000); }
});
app.addEventListener('change', event => {
    if (event.target.matches('input[type="range"][data-sector]')) persist();
});
app.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'modal-backdrop' && event.target !== target) return;
    event.preventDefault();
    try {
        if (action === 'home') { if (saveConflict) savedCampaign = readSave(); else persist(); screen = 'welcome'; campaign = null; saveConflict = false; modal = null; render(); window.scrollTo({top:0,behavior:'instant'}); }
        else if (action === 'new-campaign') {
            if (savedCampaign) { try { localStorage.setItem(ARCHIVE_KEY,serializeCampaign(savedCampaign)); } catch { /* Current save is still preserved until the new one succeeds. */ } }
            onboardingDismissed = false;
            showCampaign(createCampaign({seed:seedInput.trim() || makeSeed(),labId:selectedLab}));
        }
        else if (action === 'continue') { if (savedCampaign) showCampaign(restoreCampaign(serializeCampaign(savedCampaign))); }
        else if (action === 'shuffle-seed') { seedInput = makeSeed(); document.getElementById('campaign-seed').value = seedInput; }
        else if (action === 'export') exportSave();
        else if (action === 'import') document.getElementById('save-file').click();
        else if (action === 'help' || action === 'model') { openModal(action,target); }
        else if (action === 'close-modal' || action === 'modal-backdrop') { closeModal(); }
        else if (action === 'dismiss-notice') { notice = ''; render(); }
        else if (action === 'dismiss-onboarding') { onboardingDismissed = true; render(); }
        else if (action === 'reload-save') { const latest = readSave(); if (latest) showCampaign(latest); }
        else if (action === 'tab' || action === 'tab-research') { activeTab = target.dataset.tab || 'research'; render({focus:`tab-${activeTab}`}); }
        else if (action === 'ending-history') { openModal('history',target); }
        else if (action === 'start-trial' && !saveConflict) {
            const result = startResearchTrial(campaign,target.dataset.trial);
            if (result.ok) { persist(); openModal('research',target); } else applyResult(result);
        }
        else if (action === 'lock') { const key = target.dataset.sector; locks.has(key) ? locks.delete(key) : locks.add(key); render({focus:`lock-${key}`}); }
        else if (action === 'preset' && !saveConflict) { if (setPlan(campaign,presets[target.dataset.preset])) { locks.clear(); persist(); render(); } }
        else if (action === 'show-decision') { activeTab = 'overview'; render({focus:'decision-title'}); }
        else if (action === 'advance' && !saveConflict) {
            const result = advanceQuarter(campaign);
            if (campaign.phase === 'decision' || campaign.phase === 'transition') activeTab = 'overview';
            applyResult(result,campaign.phase === 'decision' || campaign.phase === 'transition' ? 'decision-title' : 'advance-button');
            announce(`${date()}. ${campaign.phase === 'planning' ? 'Quarter complete.' : 'A decision is ready.'}`);
        }
        else if (action === 'event-choice' && !saveConflict) { applyResult(resolveDecision(campaign,target.dataset.choice),'advance-button'); announce('Decision recorded.'); }
        else if (action === 'transition-choice' && !saveConflict) {
            applyResult(resolveTransition(campaign,target.dataset.choice),campaign.phase === 'complete' ? 'ending-title' : 'decision-title');
            if (campaign.phase === 'complete') { announce(campaign.outcome.summary); if (!reducedMotion.matches) cosmos?.play(); }
        }
        else if (action === 'cosmos-toggle') { cosmosPlaying ? cosmos?.pause() : cosmos?.play(); }
        else if (action === 'cosmos-replay') { cosmos?.seek(0); cosmos?.play(); }
    } catch (error) {
        setNotice(`The action could not be completed. ${error.message}`,true);
        render();
        console.error(error);
    }
});
document.getElementById('save-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        if (file.size > 2_000_000) throw new Error('The save file is too large.');
        const restored = restoreCampaign(await file.text());
        notice = '';
        showCampaign(restored);
        announce('Campaign restored.');
    } catch (error) { setNotice(`Could not import this save. ${error.message}`,true); render(); }
    event.target.value = '';
});
document.addEventListener('keydown', event => {
    if (modal) {
        if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
        if (event.key === 'Tab') {
            const controls = [...document.querySelectorAll('.modal button,.modal a,.modal summary,.modal input')].filter(node => !node.disabled);
            if (!controls.length) return;
            if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
        }
        return;
    }
    if (event.target.matches('[role=tab]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();
        const tabs = ['overview','research','history'];
        const index = tabs.indexOf(activeTab);
        activeTab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index+(event.key === 'ArrowRight' ? 1 : -1)+tabs.length)%tabs.length];
        render({focus:`tab-${activeTab}`});
        return;
    }
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target.isContentEditable || ['INPUT','TEXTAREA','SELECT','BUTTON','A','SUMMARY'].includes(event.target.tagName)) return;
    if (event.key.toLowerCase() === 'n' && campaign?.phase === 'planning' && screen === 'campaign') { event.preventDefault(); document.getElementById('advance-button')?.click(); }
    if (event.key === '?') { event.preventDefault(); openModal('help'); }
});
window.addEventListener('storage', event => {
    if (event.key === SAVE_KEY && campaign && screen === 'campaign') { saveConflict = true; if (modal) closeModal(); render(); }
    else if (event.key === SAVE_KEY) { savedCampaign = readSave(); render(); }
});
window.addEventListener('pagehide', () => { persist(); cosmos?.dispose(); cosmos = null; });
window.addEventListener('pageshow', event => { if (event.persisted && screen === 'campaign' && campaign?.phase === 'complete') setupCosmos(cosmosPlaying); });
reducedMotion.addEventListener('change', () => { if (campaign?.phase === 'complete') render(); });
savedCampaign = readSave();
render();
