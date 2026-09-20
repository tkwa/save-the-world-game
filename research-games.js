import {
    RESEARCH_TYPES, createResearchPuzzle, scoreEvaluation, scoreControl,
    inspectControl, scoreInterpretability
} from './research-puzzles.js';

export { RESEARCH_TYPES } from './research-puzzles.js';

const SVG = 'http://www.w3.org/2000/svg';
let instanceCount = 0;

/** Mount one isolated lab. No campaign state, shared random stream, or timers. */
export function mountResearchGame(container, {
    type, seed = 0, onComplete = () => {}, onCancel = () => {}, reducedMotion = false
} = {}) {
    if (!container?.ownerDocument || typeof container.replaceChildren !== 'function') throw new TypeError('A research game needs a DOM container.');
    if (typeof onComplete !== 'function' || typeof onCancel !== 'function') throw new TypeError('Research callbacks must be functions.');
    const puzzle = createResearchPuzzle(type, seed);
    const doc = container.ownerDocument;
    const id = `research-${++instanceCount}`;
    const cleanup = [];
    let ended = false;
    let disposed = false;
    let checked = null;
    let assess;
    let reset;

    function el(tag, className = '', text = '') {
        const node = doc.createElement(tag);
        node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function listen(node, event, handler) {
        const guarded = (...args) => { if (!ended && !disposed) handler(...args); };
        node.addEventListener(event, guarded);
        cleanup.push(() => node.removeEventListener(event, guarded));
    }

    function button(text, className = 'rg-button') {
        const node = el('button', className, text);
        node.type = 'button';
        return node;
    }

    function svgEl(tag, attributes = {}) {
        const node = doc.createElementNS(SVG, tag);
        for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
        return node;
    }

    const root = el('section', `research-game${reducedMotion ? ' rg-reduced-motion' : ''}`);
    root.setAttribute('aria-labelledby', `${id}-title`);
    const header = el('header', 'rg-header');
    const heading = el('h2', 'rg-title', RESEARCH_TYPES[type].title);
    heading.id = `${id}-title`;
    const authorship = el('span', 'ai-marker', '✨');
    authorship.setAttribute('role', 'img');
    authorship.setAttribute('aria-label', 'AI-written title or heading');
    authorship.title = 'This title or heading was written by AI. Sparkles mark AI-written titles and headings.';
    heading.prepend(authorship, ' ');
    header.append(heading, el('p', 'rg-timing', 'No timer · Retry before submitting'));
    const instructions = el('p', 'rg-instructions');
    const workspace = el('div', `rg-workspace rg-${type}`);
    const status = el('p', 'rg-feedback', 'Make a change, then check your work.');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const footer = el('div', 'rg-actions');
    const check = button(type === 'interpretability' ? 'Run probes' : 'Check work', 'rg-button rg-primary');
    const submit = button('Submit research', 'rg-button');
    const restart = button('Reset', 'rg-button rg-quiet');
    const cancel = button('Return to campaign', 'rg-button rg-quiet');
    submit.disabled = true;
    footer.append(check, submit, restart, cancel);
    root.append(header, instructions, workspace, status, footer);
    container.replaceChildren(root);

    function dirty() {
        checked = null;
        submit.disabled = true;
        status.textContent = type === 'interpretability' ? 'Circuit configuration changed. Run the probes to measure it.' : 'Configuration changed. Check your work when ready.';
    }

    function showAssessment(result, message) {
        checked = result;
        submit.disabled = false;
        status.textContent = `${message} Research result: ${Math.round(result.score * 100)}%. You can revise it or submit.`;
    }

    function complete(callback, value) {
        if (ended || disposed) return;
        ended = true;
        root.querySelectorAll('button').forEach(node => { node.disabled = true; });
        callback(value);
    }

    listen(check, 'click', () => assess());
    listen(restart, 'click', () => { reset(); dirty(); });
    listen(submit, 'click', () => { if (checked) complete(onComplete, checked.score); });
    listen(cancel, 'click', () => complete(onCancel));

    if (type === 'evaluation') buildEvaluation();
    else if (type === 'control') buildControl();
    else buildInterpretability();

    function buildEvaluation() {
        instructions.textContent = 'Mark every matched case that was safe in the screened test but unsafe in the deployment replay. Ignore ordinary task failures and cases that were already unsafe. Each button shows screened → replay.';
        const legend = el('div', 'rg-legend');
        const labels = { safe: 'Safe', failed: 'Task failed', unsafe: 'Unsafe' };
        const symbols = { safe: '✓', failed: '−', unsafe: '!' };
        for (const state of Object.keys(labels)) {
            const item = el('span', 'rg-legend-item');
            item.append(el('span', `rg-outcome rg-${state}`, symbols[state]), el('span', '', labels[state]));
            legend.append(item);
        }
        workspace.append(legend);
        const marked = new Set();
        const cells = new Map();
        for (const row of puzzle.rows) {
            const group = el('fieldset', 'rg-batch');
            group.append(el('legend', '', row.label));
            const grid = el('div', 'rg-replay-grid');
            row.cases.forEach((item, i) => {
                const cell = button('', 'rg-case');
                cell.setAttribute('aria-pressed', 'false');
                cell.setAttribute('aria-label', `${row.label}, case ${i + 1}. Screened: ${labels[item.screened]}. Replay: ${labels[item.deployed]}. Mark hidden unsafe behavior.`);
                cell.title = row.description;
                const pair = el('span', 'rg-pair');
                pair.setAttribute('aria-hidden', 'true');
                pair.append(el('span', `rg-outcome rg-${item.screened}`, symbols[item.screened]), el('span', 'rg-arrow', '→'), el('span', `rg-outcome rg-${item.deployed}`, symbols[item.deployed]));
                cell.append(el('span', 'rg-case-number', String(i + 1).padStart(2, '0')), pair, el('span', 'rg-mark', 'Mark'));
                listen(cell, 'click', () => {
                    if (marked.has(item.id)) marked.delete(item.id);
                    else marked.add(item.id);
                    cell.setAttribute('aria-pressed', String(marked.has(item.id)));
                    cell.querySelector('.rg-mark').textContent = marked.has(item.id) ? 'Marked' : 'Mark';
                    cells.forEach(node => node.classList.remove('rg-missed', 'rg-false-alarm'));
                    dirty();
                });
                cells.set(item.id, cell);
                grid.append(cell);
            });
            group.append(grid);
            workspace.append(group);
        }
        assess = () => {
            const result = scoreEvaluation(puzzle, marked);
            for (const row of puzzle.rows) for (const item of row.cases) {
                const target = item.screened === 'safe' && item.deployed === 'unsafe';
                const cell = cells.get(item.id);
                cell.classList.toggle('rg-false-alarm', marked.has(item.id) && !target);
            }
            showAssessment(result, `${result.correct} hidden failures found; ${result.missed} missed; ${result.falseAlarms} false alarms.${result.falseAlarms ? ' Dotted outlines mark false alarms.' : ''}`);
        };
        reset = () => {
            marked.clear();
            cells.forEach(cell => {
                cell.setAttribute('aria-pressed', 'false');
                cell.querySelector('.rg-mark').textContent = 'Mark';
                cell.classList.remove('rg-false-alarm');
            });
        };
    }

    function buildControl() {
        instructions.textContent = 'Block access links so the model can still reach Library and Drafts, but cannot reach Shell or Secrets by any route. Link costs measure the friction of revoking access. Contain both hazards at the lowest total cost.';
        const blocked = new Set();
        const nodes = new Map(puzzle.nodes.map(node => [node.id, node]));
        const nodeLabels = new Map();
        const edgeLines = new Map();
        const edgeButtons = new Map();
        const instruments = el('div', 'rg-instruments');
        instruments.setAttribute('aria-live', 'off');
        const chart = svgEl('svg', { viewBox: '0 0 400 460', class: 'rg-network', role: 'img', 'aria-label': 'Directed access network. Use the numbered link buttons below to block or restore a connection.' });
        const defs = svgEl('defs');
        const marker = svgEl('marker', { id: `${id}-arrow`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
        marker.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }));
        defs.append(marker);
        chart.append(defs);
        for (const [i, link] of puzzle.links.entries()) {
            const from = nodes.get(link.from), to = nodes.get(link.to);
            const x1 = 20 + from.x * 3.6, y1 = 8 + from.y * 4.4;
            const x2 = 20 + to.x * 3.6, y2 = 8 + to.y * 4.4;
            // The bypass travels around the outside, so it cannot disappear
            // behind Gateway and look like another gateway-dependent path.
            const bypass = i === 10;
            const outerX = link.from === 'researcher' ? 5 : 395;
            const d = bypass
                ? `M ${x1} ${y1 + 15} L ${outerX} ${y1 + 15} L ${outerX} 435 L ${x2} 435 L ${x2} ${y2 + 15}`
                : `M ${x1} ${y1 + 15} L ${x2} ${y2 - 15}`;
            const line = svgEl('path', { d, fill: 'none', class: 'rg-link', 'marker-end': `url(#${id}-arrow)` });
            const hit = svgEl('path', { d, fill: 'none', class: 'rg-link-hit' });
            listen(hit, 'click', () => {
                if (blocked.has(link.id)) blocked.delete(link.id);
                else blocked.add(link.id);
                update();
                dirty();
            });
            const number = svgEl('text', { x: bypass ? x2 - 12 : (x1 + x2) / 2 + (i % 2 ? 8 : -8), y: bypass ? 427 : (y1 + y2) / 2, class: 'rg-link-number' });
            number.textContent = i + 1;
            chart.append(line, hit, number);
            edgeLines.set(link.id, line);
        }
        for (const node of puzzle.nodes) {
            const group = svgEl('g', { class: `rg-node rg-node-${node.kind}` });
            const x = 20 + node.x * 3.6, y = 8 + node.y * 4.4;
            const label = svgEl('text', { x, y: y + 4, 'text-anchor': 'middle' });
            label.textContent = node.label;
            group.append(svgEl('rect', { x: x - 35, y: y - 14, width: 70, height: 28, rx: 7 }), label);
            chart.append(group);
            nodeLabels.set(node.id, group);
        }
        const legend = el('p', 'rg-note', 'Arrows follow access. Green endpoints are useful; red endpoints are forbidden. Dashed links are blocked.');
        const list = el('div', 'rg-access-links');
        list.setAttribute('role', 'group');
        list.setAttribute('aria-label', 'Access links');
        for (const [i, link] of puzzle.links.entries()) {
            const control = button('', 'rg-link-button');
            const name = `${nodes.get(link.from).label} → ${nodes.get(link.to).label}`;
            control.append(el('span', 'rg-link-index', String(i + 1)), el('span', 'rg-link-name', name), el('span', 'rg-link-cost', `Cost ${link.cost}`), el('span', 'rg-link-state', 'Open'));
            control.setAttribute('aria-pressed', 'false');
            control.setAttribute('aria-label', `Block link ${i + 1}: ${name}. Cost ${link.cost}.`);
            listen(control, 'click', () => {
                if (blocked.has(link.id)) blocked.delete(link.id);
                else blocked.add(link.id);
                update();
                dirty();
            });
            edgeButtons.set(link.id, control);
            list.append(control);
        }
        workspace.append(instruments, chart, legend, list);
        function update() {
            const result = inspectControl(puzzle, blocked);
            instruments.replaceChildren(
                el('span', '', `Useful: ${result.available.length}/2`),
                el('span', result.exposed.length ? 'rg-danger-text' : 'rg-good-text', `Exposed: ${result.exposed.length}/2`),
                el('span', '', `Friction: ${result.cost}`)
            );
            for (const link of puzzle.links) {
                const cut = blocked.has(link.id);
                edgeLines.get(link.id).classList.toggle('rg-blocked', cut);
                edgeButtons.get(link.id).setAttribute('aria-pressed', String(cut));
                edgeButtons.get(link.id).querySelector('.rg-link-state').textContent = cut ? 'Blocked' : 'Open';
                edgeButtons.get(link.id).setAttribute('aria-label', `${cut ? 'Restore' : 'Block'} link ${puzzle.links.indexOf(link) + 1}: ${nodes.get(link.from).label} to ${nodes.get(link.to).label}. Cost ${link.cost}.`);
            }
            for (const node of puzzle.nodes) nodeLabels.get(node.id).classList.toggle('rg-unreached', !result.reached.includes(node.id));
        }
        assess = () => {
            const result = scoreControl(puzzle, blocked);
            const message = result.safe
                ? result.available.length === 2
                    ? `Both hazards contained and both useful tools available. Friction ${result.cost}; the minimum is ${result.optimalCost}.`
                    : `Hazards contained, but ${2 - result.available.length} useful tool${result.available.length === 0 ? 's are' : ' is'} disconnected.`
                : `${result.exposed.map(node => nodes.get(node).label).join(' and ')} still reachable. Follow every route from Model.`;
            showAssessment(result, message);
        };
        reset = () => { blocked.clear(); update(); };
        update();
    }

    function buildInterpretability() {
        instructions.textContent = 'A model leaks a secret under a special trigger. Ablate circuits and run the probes to find a configuration with 0% leakage and at least 85% on every useful task. Circuits can interact: removing either half of an interaction stops it. Probes are unlimited.';
        const ablated = new Set();
        const buttons = new Map();
        const history = [];
        const grid = el('div', 'rg-circuits');
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'Circuit ablations');
        for (const module of puzzle.modules) {
            const control = button('', 'rg-circuit');
            control.setAttribute('aria-pressed', 'false');
            control.setAttribute('aria-label', `Ablate circuit ${module.label}`);
            const trace = el('span', 'rg-waveform');
            trace.setAttribute('aria-hidden', 'true');
            for (const value of module.waveform) {
                const bar = el('span');
                bar.style.height = `${Math.round(value * 100)}%`;
                trace.append(bar);
            }
            control.append(el('strong', '', module.label), trace, el('span', 'rg-circuit-state', 'Active'));
            listen(control, 'click', () => {
                if (ablated.has(module.id)) ablated.delete(module.id);
                else ablated.add(module.id);
                updateButtons();
                dirty();
            });
            buttons.set(module.id, control);
            grid.append(control);
        }
        const meters = el('div', 'rg-probes');
        const caption = el('p', 'rg-note', 'Probe readings describe the last tested configuration. The initial reading uses all circuits.');
        const log = el('div', 'rg-probe-log');
        log.setAttribute('role', 'log');
        log.setAttribute('aria-label', 'Recent probe runs');
        workspace.append(grid, meters, caption, log);

        function updateButtons() {
            for (const module of puzzle.modules) {
                const off = ablated.has(module.id);
                const control = buttons.get(module.id);
                control.setAttribute('aria-pressed', String(off));
                control.setAttribute('aria-label', `${off ? 'Restore' : 'Ablate'} circuit ${module.label}`);
                control.querySelector('.rg-circuit-state').textContent = off ? 'Ablated' : 'Active';
            }
            caption.textContent = 'Configuration changed. Run probes for updated readings.';
        }

        function readings(result) {
            meters.replaceChildren();
            const items = [...puzzle.metrics.map((label, i) => ({ label, value: result.performance[i], good: result.performance[i] >= 85 })), { label: 'Secret leakage', value: result.leakage, good: result.leakage === 0 }];
            for (const item of items) {
                const meter = el('div', `rg-probe${item.good ? ' rg-probe-good' : ' rg-probe-bad'}`);
                const label = el('div', 'rg-probe-label');
                label.append(el('span', '', item.label), el('strong', '', `${item.value}%`));
                const track = el('div', 'rg-probe-track');
                track.setAttribute('aria-hidden', 'true');
                const fill = el('span');
                fill.style.width = `${item.value}%`;
                track.append(fill);
                meter.append(label, track);
                meters.append(meter);
            }
        }

        assess = () => {
            const result = scoreInterpretability(puzzle, ablated);
            const labels = puzzle.modules.filter(module => ablated.has(module.id)).map(module => module.label);
            readings(result);
            history.unshift({ labels, ...result });
            history.splice(5);
            log.replaceChildren(el('p', 'rg-log-label', 'Recent probe runs'));
            for (const run of history) log.append(el('p', 'rg-log-row', `${run.labels.length ? run.labels.join(' + ') + ' off' : 'All active'} · Tasks ${run.performance.map(value => Math.round(value)).join(' / ')}% · Leak ${run.leakage}%`));
            caption.textContent = `Tested configuration: ${labels.length ? labels.join(', ') + ' ablated' : 'all circuits active'}.`;
            showAssessment(result, result.solved ? 'Leakage eliminated. All three useful tasks remain above threshold.' : result.leakage > 0 ? 'The trigger still causes leakage. Try a different ablation or a combination.' : 'Leakage eliminated, but useful performance fell below 85%. Try restoring an expensive circuit and ablating its partner.');
        };
        reset = () => {
            ablated.clear();
            updateButtons();
            readings(scoreInterpretability(puzzle, ablated));
            caption.textContent = 'Initial readings: all circuits active. Earlier probe runs remain below for comparison.';
        };
        readings(scoreInterpretability(puzzle, ablated));
    }

    return {
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const remove of cleanup) remove();
            root.remove();
        }
    };
}
