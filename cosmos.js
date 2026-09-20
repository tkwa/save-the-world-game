import {
    AU_PER_LIGHT_YEAR, SOLAR_RADIUS_AU, OBSERVABLE_RADIUS_LY, SUN_GALACTIC_RADIUS_LY,
    clamp, smoothstep, formatDistance, createCosmosGeometry, createIndustryModel, ORBITAL_TIME_SCALE,
    cosmosFrame, projectPoint, collectorPosition, probePosition, canvasResolution
} from './cosmos-math.js';

const TAU = Math.PI * 2;
const PLANETS = [
    ['Mercury', 0.387, 0.8, '#bcb2a6', 1.9],
    ['Venus', 0.723, 2.35, '#e0cba5', 2.7],
    ['Earth', 1, 4.5, '#8cbccc', 2.9],
    ['Mars', 1.524, 5.6, '#be896d', 2.4],
    ['Jupiter', 5.203, 3.3, '#c4ac8c', 4.8],
    ['Saturn', 9.537, 0.48, '#d6c59b', 4.2],
    ['Uranus', 19.19, 4.9, '#9ababb', 3],
    ['Neptune', 30.07, 2, '#718fad', 3]
];

function paletteFor(frame) {
    if (frame.kind === 'extinction') return {
        metal: ['#39474d', '#68757a', '#bcc1b7'],
        probe: '#a0afb8', alien: '#d1ab8d', glow: '#b7a597', brightness: 1
    };
    return {
        metal: ['#44545d', '#9a967f', '#edd4a0'],
        probe: '#a6e2e2', alien: '#bba3cb', glow: '#90d2d7',
        brightness: 1
    };
}

/**
 * A deterministic, illustrative sequence; no campaign state is changed.
 * onProgress(progress, metadata) also reports year, phase and playing state.
 * Reduced-motion playback reveals the final still; seeking remains available.
 */
export function createCosmos(canvas, { outcome = {}, reducedMotion = false, onProgress } = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('A canvas is required.');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const document = canvas.ownerDocument;
    const view = document?.defaultView ?? globalThis;
    if (!document || typeof view.requestAnimationFrame !== 'function') throw new Error('A browser canvas is required.');
    const geometry = createCosmosGeometry();
    const snapshot = { ...outcome };
    const industryModel = createIndustryModel(snapshot);
    const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    let preferReducedMotion = Boolean(reducedMotion || media?.matches);
    let width = 1;
    let height = 1;
    let pixelScale = 1;
    let backdrop = null;
    let progress = 0;
    let playing = false;
    let disposed = false;
    let request = null;
    let lastTimestamp = null;
    let lastFrame = null;
    const sprites = new Map();

    function makeCanvas(w, h) {
        const buffer = document.createElement('canvas');
        buffer.width = Math.max(1, Math.ceil(w));
        buffer.height = Math.max(1, Math.ceil(h));
        return buffer;
    }

    function glowSprite(color) {
        if (sprites.has(color)) return sprites.get(color);
        const sprite = makeCanvas(64, 64);
        const ctx = sprite.getContext('2d');
        const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.055, color);
        glow.addColorStop(0.18, `${color}8a`);
        glow.addColorStop(0.5, `${color}18`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, 64, 64);
        sprites.set(color, sprite);
        return sprite;
    }

    function buildBackdrop() {
        if (backdrop) { backdrop.width = 1; backdrop.height = 1; }
        backdrop = makeCanvas(canvas.width, canvas.height);
        const ctx = backdrop.getContext('2d', { alpha: false });
        ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
        ctx.fillStyle = '#030710';
        ctx.fillRect(0, 0, width, height);
        const haze = ctx.createRadialGradient(width * 0.64, height * 0.3, 0, width * 0.6, height * 0.4, width * 0.75);
        haze.addColorStop(0, '#11222c');
        haze.addColorStop(0.52, '#08121e');
        haze.addColorStop(1, '#030710');
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, width, height);
        // A distant, unresolved stellar band remains a backdrop throughout the
        // pullback. It is never confused with the local probe destinations.
        for (const dust of geometry.dust) {
            const x = dust.x * width;
            const y = (0.75 - dust.x * 0.66 + dust.offset) * height;
            ctx.globalAlpha = dust.alpha;
            ctx.fillStyle = '#7d979f';
            ctx.fillRect(x, y, dust.size, dust.size);
        }
        for (const star of geometry.background) {
            ctx.globalAlpha = star.alpha;
            ctx.fillStyle = star.warmth > 0.75 ? '#dfc5ac' : '#b0c8db';
            const x = star.x * width;
            const y = star.y * height;
            ctx.beginPath();
            ctx.arc(x, y, star.size, 0, TAU);
            ctx.fill();
            if (star.size > 1.15) {
                ctx.globalAlpha = star.alpha * 0.22;
                ctx.drawImage(glowSprite('#b3ccdf'), x - 8, y - 8, 16, 16);
            }
        }
        ctx.globalAlpha = 1;
    }

    function strokeOrbit(radius, frame, alpha, color, plane = null) {
        const screenRadius = radius * frame.scale;
        if (screenRadius < 7 || screenRadius > Math.max(width, height) * 3) return;
        context.beginPath();
        for (let step = 0; step <= 80; step++) {
            const angle = step / 80 * TAU;
            const position = plane
                ? plane.u.map((value, index) => radius * (value * Math.cos(angle) + plane.v[index] * Math.sin(angle)))
                : [Math.cos(angle) * radius, Math.sin(angle) * radius, 0];
            const point = projectPoint(position, frame);
            if (step === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
        }
        context.strokeStyle = color;
        context.lineWidth = 0.65;
        context.globalAlpha = alpha;
        context.stroke();
        context.globalAlpha = 1;
    }

    function drawPlanets(frame) {
        const reveal = smoothstep(0.30, 0.42, frame.progress);
        if (reveal <= 0) return;
        for (const [name, radius, offset, color, size] of PLANETS) {
            const screenRadius = radius * frame.scale;
            const alpha = reveal * smoothstep(9, 50, screenRadius);
            if (alpha < 0.01 || screenRadius > Math.max(width, height) * 2) continue;
            strokeOrbit(radius, frame, alpha * 0.25, '#768697');
            const angle = offset + frame.elapsedYears * ORBITAL_TIME_SCALE * TAU / radius ** 1.5;
            const point = projectPoint([Math.cos(angle) * radius, Math.sin(angle) * radius, 0], frame);
            if (point.x < -20 || point.x > width + 20 || point.y < -20 || point.y > height + 20) continue;
            const r = size * clamp(screenRadius / 25, 0.35, 1);
            context.globalAlpha = alpha;
            if (name === 'Saturn') {
                context.strokeStyle = '#a9a28c';
                context.lineWidth = 1.4;
                context.beginPath();
                context.ellipse(point.x, point.y, r * 2, r * 0.64, -0.25, 0, TAU);
                context.stroke();
            }
            const sphere = context.createRadialGradient(point.x - r * 0.3, point.y - r * 0.3, 0, point.x, point.y, r);
            sphere.addColorStop(0, color);
            sphere.addColorStop(0.65, color);
            sphere.addColorStop(1, '#17212c');
            context.fillStyle = sphere;
            context.beginPath();
            context.arc(point.x, point.y, r, 0, TAU);
            context.fill();
            if (screenRadius > 48 && alpha > 0.4) {
                context.globalAlpha = alpha * 0.7;
                context.fillStyle = '#aab6c4';
                context.font = '10px system-ui, sans-serif';
                context.fillText(name, point.x + r + 6, point.y + 3);
            }
        }
        context.globalAlpha = 1;
    }

    function collectorBatches(frame) {
        const batches = Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => []));
        if (frame.scale < 28) return batches;
        const sizeScale = clamp(frame.scale / (Math.min(width, height) / 0.85), 0, 1);
        for (const collector of geometry.collectors) {
            if (collector.birth > frame.builtFraction) break;
            const position = collectorPosition(collector, geometry.planes[collector.plane], frame.elapsedYears);
            const point = projectPoint(position, frame);
            if (point.x < -5 || point.x > width + 5 || point.y < -5 || point.y > height + 5) continue;
            const age = smoothstep(collector.birth, collector.birth + 0.018, frame.builtFraction);
            if (age < 0.05) continue;
            const facing = Math.abs(point.depth) / collector.radius;
            const tone = collector.reflectance > 0.91 && facing > 0.35 ? 2 : collector.reflectance > 0.44 ? 1 : 0;
            const size = (0.65 + collector.size * 1.45) * Math.sqrt(sizeScale) * age;
            batches[point.depth > 0 ? 1 : 0][tone].push({
                ...point, size, angle: Math.atan2(point.y - frame.centerY, point.x - frame.centerX) + Math.PI / 2,
                stretch: 0.35 + facing * 0.55
            });
        }
        return batches;
    }

    function drawCollectors(batches, palette, front) {
        for (let tone = 0; tone < batches.length; tone++) {
            context.beginPath();
            for (const panel of batches[tone]) {
                const alongX = Math.cos(panel.angle) * panel.size;
                const alongY = Math.sin(panel.angle) * panel.size;
                const crossX = -Math.sin(panel.angle) * panel.size * panel.stretch;
                const crossY = Math.cos(panel.angle) * panel.size * panel.stretch;
                context.moveTo(panel.x + alongX + crossX, panel.y + alongY + crossY);
                context.lineTo(panel.x - alongX + crossX, panel.y - alongY + crossY);
                context.lineTo(panel.x - alongX - crossX, panel.y - alongY - crossY);
                context.lineTo(panel.x + alongX - crossX, panel.y + alongY - crossY);
                context.closePath();
            }
            context.fillStyle = palette.metal[tone];
            context.globalAlpha = palette.brightness * (front ? 0.94 : 0.54);
            context.fill();
        }
        context.globalAlpha = 1;
    }

    function drawSun(frame) {
        if (frame.progress > 0.735) return;
        const visibility = 1 - smoothstep(0.675, 0.735, frame.progress);
        const radius = Math.max(0.85, SOLAR_RADIUS_AU * frame.scale);
        context.save();
        context.globalAlpha = visibility;
        const x = frame.centerX;
        const y = frame.centerY;
        const flareRadius = Math.max(14, radius * 7);
        context.save();
        context.globalCompositeOperation = 'lighter';
        const corona = context.createRadialGradient(x, y, radius * 0.4, x, y, flareRadius);
        corona.addColorStop(0, '#ffd17dbb');
        corona.addColorStop(0.13, '#eda34f6b');
        corona.addColorStop(0.42, '#c8792616');
        corona.addColorStop(1, '#8d451500');
        context.fillStyle = corona;
        context.fillRect(x - flareRadius, y - flareRadius, flareRadius * 2, flareRadius * 2);
        if (radius > 4) {
            for (let ray = 0; ray < 42; ray++) {
                const angle = ray / 42 * TAU + Math.sin(ray * 13.13) * 0.09;
                const reach = radius * (1.8 + (Math.sin(ray * 7.39) + 1) * 0.95);
                const drift = Math.sin(frame.progress * 11 + ray * 1.4) * radius * 0.06;
                context.beginPath();
                context.moveTo(x + Math.cos(angle) * radius * 0.9, y + Math.sin(angle) * radius * 0.9);
                context.quadraticCurveTo(x + Math.cos(angle + 0.045) * reach * 0.62,
                    y + Math.sin(angle + 0.045) * reach * 0.62,
                    x + Math.cos(angle) * (reach + drift), y + Math.sin(angle) * (reach + drift));
                context.strokeStyle = '#f4bf6c';
                context.lineWidth = 0.5 + (ray % 3) * 0.28;
                context.globalAlpha = 0.025 + (ray % 4) * 0.008;
                context.stroke();
            }
        }
        context.restore();
        const surface = context.createRadialGradient(x - radius * 0.16, y - radius * 0.2, 0, x, y, radius);
        surface.addColorStop(0, '#fffde5');
        surface.addColorStop(0.72, '#ffe5ab');
        surface.addColorStop(0.93, '#fbc875');
        surface.addColorStop(1, '#f0a04f');
        context.fillStyle = surface;
        context.beginPath();
        context.arc(x, y, radius, 0, TAU);
        context.fill();
        if (radius > 8) {
            context.save();
            context.beginPath();
            context.arc(x, y, radius * 0.985, 0, TAU);
            context.clip();
            // Low-contrast granulation avoids a featureless white disk without
            // suggesting that the star rotates at the camera's time scale.
            for (let spot = 0; spot < 72; spot++) {
                const angle = spot * 2.399963;
                const distance = Math.sqrt(spot / 72) * radius;
                const size = radius * (0.015 + (spot % 4) * 0.006);
                context.fillStyle = spot % 3 ? '#d28536' : '#fffbe0';
                context.globalAlpha = 0.035;
                context.beginPath();
                context.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, size, 0, TAU);
                context.fill();
            }
            context.restore();
        }
        context.restore();
        if (frame.starVisibility > 0.1) {
            context.globalAlpha = frame.starVisibility * 0.9;
            context.fillStyle = '#dec69c';
            context.font = '10px system-ui, sans-serif';
            context.fillText('Sol', x + 10, y - 7);
            context.globalAlpha = 1;
        }
    }

    function drawNeighborhood(frame, palette) {
        if (frame.starVisibility <= 0) return;
        const count = Math.round(geometry.stars.length * frame.expansion);
        for (const star of geometry.stars) {
            const target = projectPoint(star.position, frame);
            const visible = target.x > -25 && target.x < width + 25 && target.y > -25 && target.y < height + 25;
            const color = star.temperature > 0.6 ? '#e9c297' : '#adcde2';
            if (visible) {
                const radius = (5 + star.luminosity * 3.6) * frame.starVisibility;
                context.globalAlpha = frame.starVisibility * 0.9;
                context.drawImage(glowSprite(color), target.x - radius, target.y - radius, radius * 2, radius * 2);
                context.fillStyle = color;
                context.beginPath();
                context.arc(target.x, target.y, 0.55 + star.luminosity * 0.48, 0, TAU);
                context.fill();
            }
            if (star.id >= count || frame.probeVisibility <= 0) continue;
            const inhabited = star.human * 100 < frame.humanControl;
            const probeColor = inhabited ? palette.probe : palette.alien;
            for (let wave = 0; wave < 2; wave++) {
                const probe = probePosition(star, frame, wave);
                if (!probe.launched) continue;
                const head = projectPoint(probe.position, frame);
                if (wave === 0) {
                    context.beginPath();
                    context.moveTo(frame.centerX, frame.centerY);
                    context.lineTo(target.x, target.y);
                    context.lineWidth = 0.55;
                    context.strokeStyle = probeColor;
                    context.globalAlpha = frame.probeVisibility * 0.09;
                    context.stroke();
                }
                if (probe.arrived) {
                    if (visible && wave === 0) {
                        context.globalAlpha = frame.probeVisibility * 0.3;
                        context.strokeStyle = probeColor;
                        context.lineWidth = 0.65;
                        context.beginPath();
                        context.arc(target.x, target.y, 4.5 + star.luminosity, 0, TAU);
                        context.stroke();
                    }
                    continue;
                }
                if (head.x < -40 || head.x > width + 40 || head.y < -40 || head.y > height + 40) continue;
                const backFraction = Math.max(0, probe.fraction - Math.min(0.095, 24 / Math.max(1, Math.hypot(target.x - frame.centerX, target.y - frame.centerY))));
                const back = projectPoint(star.position.map(value => value * backFraction), frame);
                const trail = context.createLinearGradient(back.x, back.y, head.x, head.y);
                trail.addColorStop(0, `${probeColor}00`);
                trail.addColorStop(1, probeColor);
                context.strokeStyle = trail;
                context.lineWidth = wave === 0 ? 1.25 : 0.7;
                context.globalAlpha = frame.probeVisibility * palette.brightness * (wave === 0 ? 0.8 : 0.45);
                context.beginPath();
                context.moveTo(back.x, back.y);
                context.lineTo(head.x, head.y);
                context.stroke();
                const glow = wave === 0 ? 8 : 5;
                context.drawImage(glowSprite(probeColor), head.x - glow, head.y - glow, glow * 2, glow * 2);
            }
        }
        context.globalAlpha = 1;
    }

    function drawGalaxy(frame) {
        if (frame.galaxyVisibility < 0.005) return;
        const alpha = frame.galaxyVisibility;
        const center = projectPoint([-SUN_GALACTIC_RADIUS_LY * AU_PER_LIGHT_YEAR, 0, 0], frame);
        const radius = 50000 * AU_PER_LIGHT_YEAR * frame.scale;
        if (radius < 1) return;
        context.save();
        context.globalCompositeOperation = 'lighter';
        const coreSize = Math.min(radius * 0.5, Math.max(width, height));
        if (coreSize > 1 && center.x > -coreSize && center.x < width + coreSize
            && center.y > -coreSize && center.y < height + coreSize) {
            context.globalAlpha = alpha * 0.68;
            context.drawImage(glowSprite('#e7c9a3'), center.x - coreSize, center.y - coreSize, coreSize * 2, coreSize * 2);
        }
        const colors = ['#dbc5a8', '#88a5c4', '#cbddea'];
        for (let tone = 0; tone < colors.length; tone++) {
            context.fillStyle = colors[tone];
            context.beginPath();
            for (const star of geometry.galaxy) {
                if (star.tone !== tone) continue;
                const point = projectPoint(star.position, frame);
                if (point.x < -5 || point.x > width + 5 || point.y < -5 || point.y > height + 5) continue;
                const size = clamp(star.size * (radius / 260) ** 0.2, 0.3, 1.4);
                context.rect(point.x, point.y, size, size);
            }
            context.globalAlpha = alpha * (tone === 0 ? 0.33 : 0.5);
            context.fill();
        }
        context.restore();
        if (radius > 28 && radius < Math.min(width, height) * 0.58) {
            context.fillStyle = '#a4b5c5';
            context.globalAlpha = alpha * 0.8;
            context.font = '11px system-ui, sans-serif';
            context.fillText('Milky Way', center.x - 22, center.y - radius * 0.66 - 12);
            context.globalAlpha = 1;
        }
    }

    function drawLocalGroup(frame) {
        const reveal = smoothstep(0.795, 0.835, frame.progress) * (1 - smoothstep(0.885, 0.92, frame.progress));
        if (reveal < 0.005) return;
        for (const galaxy of geometry.localGalaxies) {
            const point = projectPoint(galaxy.position, frame);
            const radius = Math.max(1, galaxy.radius * AU_PER_LIGHT_YEAR * frame.scale);
            if (point.x < -radius * 3 || point.x > width + radius * 3 || point.y < -radius * 3 || point.y > height + radius * 3) continue;
            context.save();
            context.translate(point.x, point.y);
            context.rotate(-0.45);
            context.scale(1, galaxy.tilt);
            context.globalCompositeOperation = 'lighter';
            context.globalAlpha = reveal * 0.75;
            context.drawImage(glowSprite('#c6c5d7'), -radius * 2, -radius * 2, radius * 4, radius * 4);
            context.globalAlpha = reveal;
            context.drawImage(glowSprite('#eccea6'), -radius * 0.5, -radius * 0.5, radius, radius);
            context.restore();
            if (radius > 3) {
                context.fillStyle = '#b8bdc9';
                context.globalAlpha = reveal * 0.8;
                context.font = '10px system-ui, sans-serif';
                context.fillText(galaxy.name, point.x + radius + 7, point.y + 3);
            }
        }
        context.globalAlpha = 1;
    }

    function drawCosmicWeb(frame) {
        if (frame.progress < 0.81) return;
        const logSpan = Math.log(frame.viewSpanLightYears);
        context.save();
        context.globalCompositeOperation = 'lighter';
        for (let index = 0; index < geometry.web.length; index++) {
            const layer = geometry.web[index];
            const layerLog = Math.log(layer.span);
            const previousLog = Math.log(geometry.web[Math.max(0, index - 1)].span);
            const nextLog = Math.log(geometry.web[Math.min(geometry.web.length - 1, index + 1)].span);
            const fadeIn = index === 0 ? smoothstep(0.81, 0.86, frame.progress)
                : smoothstep(previousLog - 0.25, layerLog - 0.1, logSpan);
            const fadeOut = index === geometry.web.length - 1 ? 1
                : 1 - smoothstep(layerLog, nextLog + 0.2, logSpan);
            const alpha = fadeIn * fadeOut;
            if (alpha < 0.01) continue;
            for (const sample of layer.samples) {
                const point = projectPoint(sample.position, frame);
                if (point.x < -10 || point.x > width + 10 || point.y < -10 || point.y > height + 10) continue;
                const size = clamp(sample.size * Math.sqrt(layer.span / frame.viewSpanLightYears), 0.45, 2.4);
                context.globalAlpha = alpha * (0.15 + sample.brightness * 0.55);
                context.fillStyle = sample.brightness > 0.82 ? '#ddd4cf' : '#829dc3';
                context.fillRect(point.x, point.y, size, size);
                if (sample.brightness > 0.94) {
                    const glow = size * 5;
                    context.globalAlpha = alpha * 0.20;
                    context.drawImage(glowSprite('#9aafcd'), point.x - glow, point.y - glow, glow * 2, glow * 2);
                }
            }
        }
        context.restore();
        const reveal = smoothstep(0.962, 1, frame.progress);
        if (reveal > 0) {
            const radius = OBSERVABLE_RADIUS_LY * AU_PER_LIGHT_YEAR * frame.scale;
            context.save();
            context.globalAlpha = reveal * 0.23;
            context.lineWidth = 0.8;
            context.strokeStyle = '#9badc3';
            context.setLineDash([2, 5]);
            context.beginPath();
            context.arc(frame.centerX, frame.centerY, radius, 0, TAU);
            context.stroke();
            context.restore();
        }
    }

    function drawReach(frame, palette) {
        if (frame.maxProbeReachLightYears <= 0 || frame.progress < 0.59) return;
        const radius = frame.maxProbeReachLightYears * AU_PER_LIGHT_YEAR * frame.scale;
        const alpha = smoothstep(0.59, 0.66, frame.progress);
        context.save();
        context.globalAlpha = alpha * 0.55;
        context.strokeStyle = palette.glow;
        context.lineWidth = 0.7;
        if (radius >= 2 && radius < Math.max(width, height)) {
            context.setLineDash([2, 5]);
            context.beginPath();
            context.arc(frame.centerX, frame.centerY, radius, 0, TAU);
            context.stroke();
        }
        if (radius < 8) {
            // A locator, explicitly not the radius of the settlement frontier.
            context.setLineDash([]);
            context.beginPath();
            for (const direction of [-1, 1]) {
                context.moveTo(frame.centerX + direction * 5, frame.centerY);
                context.lineTo(frame.centerX + direction * 9, frame.centerY);
                context.moveTo(frame.centerX, frame.centerY + direction * 5);
                context.lineTo(frame.centerX, frame.centerY + direction * 9);
            }
            context.stroke();
            context.fillStyle = '#b3c4d0';
            context.font = '10px system-ui, sans-serif';
            context.globalAlpha = alpha * 0.9;
            context.fillText('Sol', frame.centerX + 13, frame.centerY - 7);
            if (radius < 1) context.fillText('Probe reach < 1 px', frame.centerX + 13, frame.centerY + 8);
        }
        context.restore();
    }

    function drawReference(frame) {
        const margin = width < 500 ? 15 : 22;
        context.save();
        context.globalAlpha = 0.8;
        context.fillStyle = '#b5c3cc';
        context.font = '10px ui-monospace, SFMono-Regular, Consolas, monospace';
        context.fillText(`${Math.floor(frame.year)} · +${Math.floor(frame.elapsedYears)} years`, margin, margin + 5);
        if (frame.timeHeld) context.fillText('Time held · camera pullback', margin, margin + 21);
        const maximum = Math.min(115, width * 0.22) / frame.scale;
        const unit = maximum > AU_PER_LIGHT_YEAR * 0.1 ? AU_PER_LIGHT_YEAR : 1;
        const power = 10 ** Math.floor(Math.log10(maximum / unit));
        const distance = ([5, 2, 1].map(value => value * power).find(value => value <= maximum / unit) ?? power / 2) * unit;
        const length = distance * frame.scale;
        const x = width - margin - length;
        const y = height - margin;
        context.strokeStyle = '#81949f';
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(x, y - 3);
        context.lineTo(x, y);
        context.lineTo(x + length, y);
        context.lineTo(x + length, y - 3);
        context.stroke();
        context.textAlign = 'right';
        context.fillText(formatDistance(distance), x + length, y - 8);
        context.textAlign = 'left';
        if (frame.progress < 0.34) {
            const coverage = frame.industry.coverage * 100;
            const label = coverage < 0.01 ? '<0.01%' : `${coverage.toFixed(coverage < 1 ? 2 : 1)}%`;
            context.fillText(`${label} stellar interception · ${frame.industry.nanotechMature ? 'Mature manufacturing' : 'Seed industry'}`, margin, y - 18);
            context.fillText('Groups enlarged · orbital motion ×0.02', margin, y);
        }
        else if (frame.progress > 0.91) context.fillText('Representative large-scale structure', margin, y);
        if (frame.timeHeld && width > 430) context.fillText(`Probe travel ≤ ${Math.ceil(frame.maxProbeReachLightYears)} ly`, margin, margin + 37);
        context.restore();
    }

    function render() {
        if (disposed) return;
        const frame = cosmosFrame(progress, snapshot, width, height, industryModel);
        lastFrame = frame;
        const palette = paletteFor(frame);
        context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = 1;
        context.fillStyle = '#030710';
        context.fillRect(0, 0, width, height);
        context.globalAlpha = (0.47 + frame.starVisibility * 0.53) * (1 - smoothstep(0.67, 0.78, frame.progress));
        if (backdrop) context.drawImage(backdrop, 0, 0, width, height);
        context.globalAlpha = 1;
        drawCosmicWeb(frame);
        drawGalaxy(frame);
        drawLocalGroup(frame);
        drawPlanets(frame);
        if (frame.scale > 40) {
            for (const index of [2, 8, 14]) {
                const plane = geometry.planes[index];
                strokeOrbit(plane.radius, frame, 0.13 * (1 - frame.starVisibility), '#6a7d89', plane);
            }
        }
        const collectors = collectorBatches(frame);
        drawCollectors(collectors[0], palette, false);
        drawSun(frame);
        drawCollectors(collectors[1], palette, true);
        drawNeighborhood(frame, palette);
        const vignette = context.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.23,
            width * 0.5, height * 0.5, Math.hypot(width, height) * 0.58);
        vignette.addColorStop(0, '#00000000');
        vignette.addColorStop(1, '#01040b99');
        context.fillStyle = vignette;
        context.fillRect(0, 0, width, height);
        drawReach(frame, palette);
        drawReference(frame);
    }

    function notify() {
        if (!disposed && typeof onProgress === 'function') onProgress(progress, {
            phase: lastFrame?.phase, year: lastFrame?.year, playing,
            reducedMotion: preferReducedMotion, duration: lastFrame?.duration,
            elapsedYears: lastFrame?.elapsedYears, timeHeld: lastFrame?.timeHeld,
            viewSpanLightYears: lastFrame?.viewSpanLightYears,
            maxProbeReachLightYears: lastFrame?.maxProbeReachLightYears,
            scaleLabel: lastFrame?.scaleLabel, industry: lastFrame?.industry, schematic: true
        });
    }

    function resize() {
        if (disposed) return;
        const bounds = canvas.getBoundingClientRect();
        const nextWidth = Math.max(1, bounds.width || canvas.clientWidth || 960);
        const nextHeight = Math.max(1, bounds.height || canvas.clientHeight || nextWidth * 0.6);
        const resolution = canvasResolution(nextWidth, nextHeight, view.devicePixelRatio || 1);
        width = nextWidth;
        height = nextHeight;
        pixelScale = resolution.scale;
        if (canvas.width !== resolution.width || canvas.height !== resolution.height || !backdrop) {
            canvas.width = resolution.width;
            canvas.height = resolution.height;
            buildBackdrop();
        }
        render();
        notify();
    }

    function tick(timestamp) {
        request = null;
        if (!playing || disposed) return;
        if (document.hidden) { pause(); return; }
        if (lastTimestamp !== null) {
            // Hidden tabs and stalled frames cannot skip entire scenes.
            const seconds = clamp((timestamp - lastTimestamp) / 1000, 0, 0.1);
            progress = clamp(progress + seconds / (lastFrame?.duration || 40));
        }
        lastTimestamp = timestamp;
        if (progress >= 1) playing = false;
        render();
        notify();
        if (playing && !disposed) request = view.requestAnimationFrame(tick);
    }

    function pause() {
        playing = false;
        lastTimestamp = null;
        if (request !== null) view.cancelAnimationFrame(request);
        request = null;
        notify();
    }

    function seek(value) {
        if (disposed) return;
        progress = clamp(Number(value));
        lastTimestamp = null;
        if (progress >= 1) pause();
        render();
        notify();
    }

    function play() {
        if (disposed || playing || document.hidden) return;
        if (preferReducedMotion) { seek(1); return; }
        if (progress >= 1) seek(0);
        playing = true;
        lastTimestamp = null;
        notify();
        request = view.requestAnimationFrame(tick);
    }

    function visibilityChanged() { if (document.hidden) pause(); }
    function motionChanged(event) {
        preferReducedMotion = Boolean(reducedMotion || event.matches);
        if (preferReducedMotion) pause();
    }
    const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(resize) : null;
    if (observer) observer.observe(canvas);
    else view.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibilityChanged);
    media?.addEventListener?.('change', motionChanged);
    resize();

    function dispose() {
        if (disposed) return;
        pause();
        disposed = true;
        observer?.disconnect();
        if (!observer) view.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', visibilityChanged);
        media?.removeEventListener?.('change', motionChanged);
        if (backdrop) { backdrop.width = 1; backdrop.height = 1; backdrop = null; }
        for (const sprite of sprites.values()) { sprite.width = 1; sprite.height = 1; }
        sprites.clear();
    }

    return { play, pause, seek, dispose };
}
