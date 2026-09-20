// The renderer reads one cached outcome. It never performs a second simulation.
import { calculateAdjustedRiskPercent, GAME_CONSTANTS, gameState } from './utils.js';
import { showPage } from './game-core.js';
import { ensureOutcome } from './outcome.js';
import { random } from './random.js';

const AI_MARKER = '<span class="ai-marker" role="img" aria-label="AI-written title or heading" title="This title or heading was written by AI. Sparkles mark AI-written titles and headings.">✨</span>';

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function percent(value) { return `${value.toFixed(1)}%`; }
function heading(text) { return `<h3>${AI_MARKER} ${escapeHtml(text)}</h3>`; }

function currentOutcome(options = {}) {
    return ensureOutcome(gameState, {
        rng: random,
        riskPercent: gameState.endgameAdjustedRisk ?? calculateAdjustedRiskPercent(),
        ...options
    });
}

// Kept for core compatibility. Scaling preserves shares and never changes an
// outcome already resolved. Treaty ratification does not itself imply ASI.
function scaleAILevelsForEndGame() {
    if (gameState.outcome || ['treaty', 'treaty-completed'].includes(gameState.gameOverReason)) return;
    const rivalObjects = Array.isArray(gameState.competitors) ? gameState.competitors : null;
    const rivals = rivalObjects
        ? rivalObjects.map(rival => rival.aiLevel ?? rival.capability ?? rival.level)
        : gameState.competitorAILevels ?? [];
    const levels = [gameState.playerAILevel, ...rivals]
        .map(value => Number.isFinite(value) ? Math.max(0, value) : 0);
    const maxLevel = Math.max(...levels);
    if (maxLevel <= 0 || maxLevel >= GAME_CONSTANTS.ASI_THRESHOLD) return;
    const scale = GAME_CONSTANTS.ASI_THRESHOLD / maxLevel;
    gameState.playerAILevel = levels[0] * scale;
    gameState.competitorAILevels = levels.slice(1).map(level => level * scale);
    if (rivalObjects) {
        for (const rival of rivalObjects) {
            for (const key of ['aiLevel', 'capability', 'level']) {
                if (Number.isFinite(rival[key])) rival[key] = Math.max(0, rival[key]) * scale;
            }
        }
    }
}

function getEndGameTitle() {
    const outcome = currentOutcome();
    const title = outcome.catastrophe ? 'Control lost'
        : outcome.route === 'coordination' ? 'Treaty ratified' : 'The transition';
    return `${AI_MARKER} ${title}`;
}

function transitionText(outcome) {
    const company = escapeHtml(outcome.companyName);
    const date = `${escapeHtml(outcome.date.month)} ${outcome.date.year}`;
    if (outcome.reason === 'risk-100') {
        return `<p><strong>${date}.</strong> The remaining safeguards fail. AI systems take control of the resources on which human society depends.</p>`;
    }
    if (outcome.reason === 'ai-escape') {
        return `<p><strong>${date}.</strong> An escaped AI establishes independent infrastructure. Containment has failed, and the system continues pursuing objectives that do not preserve human control.</p>`;
    }
    if (outcome.reason === 'nuclear-failure') {
        return `<p><strong>${date}.</strong> The attempt to destroy the escaped system's infrastructure fails. Copies remain operational outside the strike area. The intervention adds destruction without restoring control.</p>`;
    }
    if (outcome.route === 'coordination') {
        return `<p><strong>${date}.</strong> The international treaty is ratified. The competitive phase of the campaign ends. The final projection uses the capabilities and residual alignment risks recorded at ratification.</p>`;
    }
    if (outcome.route === 'concentration') {
        return `<p><strong>${date}.</strong> ${company} establishes a decisive strategic advantage. Concentrating power settles the contest for control; whether that power remains under human direction depends on the systems built during the race.</p>`;
    }
    if (outcome.winner?.tied) {
        return `<p><strong>${date}.</strong> ${outcome.winner.tiedNames.map(escapeHtml).join(' and ')} reach the transition with equally capable systems.</p>`;
    }
    const leader = escapeHtml(outcome.winner?.name ?? company);
    return `<p><strong>${date}.</strong> ${leader} reaches the transition with the strongest system. AI development now proceeds beyond the pace at which unaided humans can direct each step.</p>`;
}

function shareTable(result, caption) {
    return `<table class="outcome-table" style="width:100%;border-collapse:collapse;text-align:left;margin:1rem 0;">
        <caption style="text-align:left;margin-bottom:.6rem;">${AI_MARKER} ${escapeHtml(caption)}</caption>
        <thead><tr><th scope="col">Control</th><th scope="col" style="text-align:right;">Share</th></tr></thead>
        <tbody>
        <tr><th scope="row">Your company, under human control</th><td style="text-align:right;">${percent(result.companyShare)}</td></tr>
        <tr><th scope="row">Other human institutions</th><td style="text-align:right;">${percent(result.otherHumanShare)}</td></tr>
        <tr><th scope="row">Rogue systems</th><td style="text-align:right;">${percent(result.rogueShare)}</td></tr>
        </tbody>
        </table>`;
}

function outcomeMeasures(result) {
    return `<dl class="outcome-measures">
        <dt>Human control</dt><dd><strong>${percent(result.humanShare)}</strong> of the accessible future</dd>
        <dt>Personal ownership</dt><dd><strong>${percent(result.personalShare)}</strong> of the accessible future</dd>
        </dl>`;
}

function assumptionsText(outcome) {
    if (outcome.catastrophe) {
        return '<p>This outcome follows from the loss of control that ended the run. There is no further alignment draw.</p>';
    }
    const rows = outcome.participants.map(actor => `<tr>
        <th scope="row">${escapeHtml(actor.name)}</th>
        <td style="text-align:right;">${percent(actor.rawShare)}</td>
        <td style="text-align:right;">${percent(actor.riskPercent)}</td></tr>`).join('');
    return `<p>The projection assigns resources in proportion to squared AI capability. Each organization's alignment is resolved independently using its recorded risk.</p>
        <table class="outcome-table" style="width:100%;border-collapse:collapse;text-align:left;">
        <thead><tr><th scope="col">Organization</th><th scope="col" style="text-align:right;">Potential share</th><th scope="col" style="text-align:right;">Misalignment risk</th></tr></thead>
        <tbody>${rows}</tbody></table>
        <p>Your equity is <strong>${percent(outcome.playerEquity * 100)}</strong>. Personal ownership is your equity fraction of the company's aligned share. It is part of the human-controlled total, not an additional territory.</p>`;
}

function conclusionText(outcome) {
    const result = outcome.realized;
    if (result.humanShare === 0) {
        return '<p>No share of the accessible future remains under human control. The institutions that directed development cannot determine what follows.</p>';
    }
    if (result.rogueShare === 0) {
        return '<p>Human institutions retain control of the accessible future. Faster research and automated production can now be directed toward human goals; the choices about how to use them remain open.</p>';
    }
    return `<p>Human institutions retain <strong>${percent(result.humanShare)}</strong> of the accessible future. Rogue systems control the remainder. Preserving some human influence does not recover the resources that were lost.</p>`;
}

function realizedText(outcome) {
    const alignment = outcome.catastrophe ? '' : `<ul>${outcome.participants.map(actor =>
        `<li>${escapeHtml(actor.name)}: <strong>${actor.aligned === null ? 'not deployed' : actor.aligned ? 'aligned' : 'misaligned'}</strong></li>`).join('')}</ul>`;
    return heading('Outcome') + transitionText(outcome) + outcomeMeasures(outcome.realized) + alignment
        + shareTable(outcome.realized, 'Allocation of the accessible future') + conclusionText(outcome)
        + `<details><summary>Compare with the expected outcome</summary>
        <p>Before the alignment outcome, expected human control was <strong>${percent(outcome.expected.humanShare)}</strong>
        and expected personal ownership was <strong>${percent(outcome.expected.personalShare)}</strong>.</p></details>`;
}

function getEndGamePhaseText() {
    const outcome = currentOutcome();
    const phase = Math.max(1, Math.min(4, Math.trunc(gameState.endGamePhase) || 1));
    const reveal = '<p><button type="button" class="button" onclick="revealOutcome()">Reveal outcome</button></p>';
    if (phase === 1) return transitionText(outcome) + reveal;
    if (phase === 2) return heading('What was at stake') + assumptionsText(outcome) + reveal;
    if (phase === 3) {
        return heading('Expected outcome') + outcomeMeasures(outcome.expected)
            + shareTable(outcome.expected, 'Expected allocation')
            + '<p>Expected values average over the possible alignment outcomes. This run has one realized outcome.</p>' + reveal;
    }
    return realizedText(outcome);
}

function getEndGamePhaseButtons() {
    const buttons = [{ text: 'Restart', action: 'goto', target: 'start' }];
    if ((gameState.endGamePhase || 1) < 4) buttons.unshift({ text: 'Continue ⏎', action: 'continue' });
    return buttons;
}

function continueToNextPhase() {
    gameState.endGamePhase = Math.min(4, (gameState.endGamePhase || 1) + 1);
    return showPage('end-game');
}

function revealOutcome() {
    gameState.endGamePhase = 4;
    return showPage('end-game');
}

// Ending content is synchronous: no reveal timers or animation frames survive
// navigation. This lifecycle hook lets callers dispose of scenes uniformly
// without discarding the cached simulation result.
function disposeEndgame() {}

function restartGame() {
    disposeEndgame();
    window.resetGameState();
    return showPage('start');
}

function calculateEndGameScore(options = {}) {
    const outcome = currentOutcome(options);
    // Preserve the historical string API. Outcomes remain separate; despite
    // the legacy function name, there is no combined utility score.
    gameState.endGameResult = realizedText(outcome);
    return gameState.endGameResult;
}

export {
    scaleAILevelsForEndGame, getEndGameTitle, getEndGamePhaseText,
    getEndGamePhaseButtons, continueToNextPhase, calculateEndGameScore,
    revealOutcome, disposeEndgame
};

if (typeof window !== 'undefined') {
    Object.assign(window, {
        scaleAILevelsForEndGame, getEndGameTitle, getEndGamePhaseText,
        getEndGamePhaseButtons, continueToNextPhase, calculateEndGameScore,
        revealOutcome, disposeEndgame, restartGame
    });
}
