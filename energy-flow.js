/* ==========================================================================
   Ray2Volt Solar - Energy flow scenes
   An isometric home or business, drawn in SVG, that shows where solar power
   goes in sun, cloud, evening, night and a power cut.

   <div class="energy-flow" data-energy-flow data-segment="home"
        data-system="ongrid" data-choices="segment system"></div>

   data-segment  home | business      the scene shown first
   data-system   ongrid | hybrid      the system shown first
   data-choices  the switches to show: "segment", "system", both or neither
   data-scenario noon | cloudy | evening | night | holiday | outage
                 the condition shown first (optional)
   Styles are in solar-visuals.css. Every figure is illustrative.
   ========================================================================== */
(function () {
    'use strict';

    const roots = document.querySelectorAll('[data-energy-flow]');
    if (!roots.length || !document.createElementNS) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
    // A 2:1 projection, a little wider than true isometric, so scenes fit a wide stage
    const SPREAD = 1;
    const UNIT = 14;
    const AUTOPLAY_MS = 7000;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let uid = 0;

    // ──────────────────────────────────────────────────────────
    // 1. Scenarios
    //    Power is in kW. grid > 0 exports and grid < 0 imports;
    //    battery > 0 charges and battery < 0 discharges. Each one balances:
    //    solar + diesel = load + battery + grid.
    // ──────────────────────────────────────────────────────────
    const SCENARIOS = {
        home: {
            ongrid: [
                {
                    id: 'noon', chip: 'Sunny noon', clock: '12:30 pm', sky: 'noon',
                    solar: 2.8, load: 0.8, grid: 2.0, lights: 'day',
                    title: 'The sun runs your home and the surplus is exported',
                    text: 'Your home uses solar first. The 2 kW it does not need flows out through the net meter, which records it as export units for your bill.'
                },
                {
                    id: 'cloudy', chip: 'Cloudy', clock: '11:00 am', sky: 'cloudy',
                    solar: 0.9, load: 1.4, grid: -0.5, lights: 'day',
                    title: 'Clouds cut the output and the grid tops it up',
                    text: 'Thick cloud can bring output down to about a third of a clear day. Every solar unit is still used at home, and the grid supplies the rest with no switching.'
                },
                {
                    id: 'evening', chip: 'Evening', clock: '6:15 pm', sky: 'evening',
                    solar: 0.3, load: 1.9, grid: -1.6, lights: 'on',
                    title: 'As the sun sets, the grid takes over',
                    text: 'Output fades just as the lights, fans and TV come on. The grid supplies the difference, and the units you exported at noon are set off against it.'
                },
                {
                    id: 'night', chip: 'Night', clock: '10:00 pm', sky: 'night',
                    solar: 0, load: 1.2, grid: -1.2, lights: 'on',
                    title: 'At night the grid runs the home',
                    text: 'The inverter sleeps after dark. Units you import now are netted against the units you exported in the day, so you pay for the difference.'
                },
                {
                    id: 'outage', chip: 'Power cut', clock: '1:00 pm', sky: 'noon', gridDown: true,
                    solar: 0, load: 0, grid: 0, lights: 'off', inverterOff: true,
                    title: 'In a power cut, an on-grid system switches off',
                    text: 'Even in bright sun, the inverter disconnects within milliseconds when the grid fails, to protect line workers. It restarts by itself when the supply returns.'
                }
            ],
            hybrid: [
                {
                    id: 'noon', chip: 'Sunny noon', clock: '12:30 pm', sky: 'noon',
                    solar: 2.8, load: 0.8, battery: 1.2, grid: 0.8, soc: 64, lights: 'day',
                    title: 'Solar runs the home, charges the battery, then exports',
                    text: 'Spare power charges the battery first. Only what is left after that goes out through the net meter.'
                },
                {
                    id: 'cloudy', chip: 'Cloudy', clock: '11:00 am', sky: 'cloudy',
                    solar: 0.9, load: 1.4, battery: -0.5, grid: 0, soc: 56, lights: 'day',
                    title: 'The battery covers what the clouds take away',
                    text: 'With output down, the battery can make up the shortfall, so the home draws little from the grid. How much it gives depends on how the system is set to run.'
                },
                {
                    id: 'evening', chip: 'Evening', clock: '6:15 pm', sky: 'evening',
                    solar: 0.3, load: 1.9, battery: -1.6, grid: 0, soc: 78, lights: 'on',
                    title: 'After sunset, the battery takes over',
                    text: 'The energy stored at noon now runs the evening load, so you draw less from the grid when everyone is at home.'
                },
                {
                    id: 'night', chip: 'Night', clock: '10:00 pm', sky: 'night',
                    solar: 0, load: 1.2, battery: 0, grid: -1.2, soc: 30, lights: 'on',
                    title: 'Overnight, the battery keeps a reserve for power cuts',
                    text: 'Once the battery reaches its reserve level, it stops discharging and holds that charge for an outage. The grid runs the home until morning.'
                },
                {
                    id: 'outage', chip: 'Power cut', clock: '1:00 pm', sky: 'noon', gridDown: true,
                    solar: 2.6, load: 0.9, battery: 1.7, grid: 0, soc: 58, lights: 'essential',
                    title: 'In a power cut, your essential loads keep running',
                    text: 'A changeover switch separates the home from the grid in milliseconds. Solar and the battery run the backup circuits for lights, fans, the fridge and Wi-Fi, while the AC waits for the grid.'
                }
            ]
        },
        business: {
            ongrid: [
                {
                    id: 'noon', chip: 'Working day', clock: '12:30 pm', sky: 'noon',
                    solar: 84, load: 70, grid: 14, lights: 'day',
                    title: 'On a working day, most solar is used on site',
                    text: 'Machines run while the sun is up, so most of the units the panels make replace units bought at the full tariff. A small surplus is exported.'
                },
                {
                    id: 'cloudy', chip: 'Cloudy', clock: '11:00 am', sky: 'cloudy',
                    solar: 30, load: 70, grid: -40, lights: 'day',
                    title: 'On a cloudy day, the grid carries more of the load',
                    text: 'Output drops with the light, and the grid makes up the balance. Each solar unit still cuts the energy charge on your bill.'
                },
                {
                    id: 'holiday', chip: 'Sunday', clock: '12:30 pm', sky: 'noon',
                    solar: 84, load: 12, grid: 72, lights: 'idle',
                    title: 'On a Sunday, most of the output is exported',
                    text: 'With most machines off, the spare output goes to the grid and is credited on your bill, usually at less than you pay for a unit. Solar is worth most when it is used on site.'
                },
                {
                    id: 'evening', chip: 'Evening peak', clock: '7:00 pm', sky: 'evening',
                    solar: 0, load: 60, grid: -60, lights: 'on',
                    title: 'In the evening peak, every unit comes from the grid',
                    text: 'From 6 to 10 pm, time-of-day billing charges more for each unit. Panels cannot help after sunset. A battery can.'
                },
                {
                    id: 'outage', chip: 'Power cut', clock: '2:00 pm', sky: 'noon', gridDown: true,
                    solar: 0, diesel: 40, load: 40, grid: 0, lights: 'essential', inverterOff: true,
                    title: 'In a power cut, the solar plant stops and the generator starts',
                    text: 'An on-grid solar plant switches off for the safety of line workers, so the diesel generator carries your critical loads. A solar and generator controller can let the panels share that load.'
                }
            ],
            hybrid: [
                {
                    id: 'noon', chip: 'Working day', clock: '12:30 pm', sky: 'noon',
                    solar: 84, load: 70, battery: 14, grid: 0, soc: 60, lights: 'day',
                    title: 'Solar runs the factory and tops up the battery',
                    text: 'The machines use most of the output. What they do not need charges the battery for the evening, instead of being exported.'
                },
                {
                    id: 'cloudy', chip: 'Cloudy', clock: '11:00 am', sky: 'cloudy',
                    solar: 30, load: 70, battery: 0, grid: -40, soc: 82, lights: 'day',
                    title: 'The battery holds its charge for the evening peak',
                    text: 'The grid covers the cloudy-day shortfall at the normal rate. The stored energy is kept for the hours when units cost more.'
                },
                {
                    id: 'holiday', chip: 'Sunday', clock: '12:30 pm', sky: 'noon',
                    solar: 84, load: 12, battery: 40, grid: 32, soc: 72, lights: 'idle',
                    title: 'On a Sunday, the battery takes the spare output first',
                    text: 'With most machines off, the battery charges as fast as it can and only the rest is exported, so less of the output is credited at the lower export value.'
                },
                {
                    id: 'evening', chip: 'Evening peak', clock: '7:00 pm', sky: 'evening',
                    solar: 0, load: 60, battery: -45, grid: -15, soc: 52, lights: 'on',
                    title: 'The battery shaves the evening peak',
                    text: 'From 6 to 10 pm, time-of-day billing charges more for each unit. The battery supplies most of the load, so far fewer units are bought at the peak rate.'
                },
                {
                    id: 'outage', chip: 'Power cut', clock: '2:00 pm', sky: 'noon', gridDown: true,
                    solar: 70, diesel: 0, load: 40, battery: 30, grid: 0, soc: 66, lights: 'essential',
                    title: 'In a power cut, solar and the battery carry critical loads',
                    text: 'The hybrid inverter separates the site from the grid and keeps the panels working. Critical loads stay on and the generator can stay off through shorter outages.'
                }
            ]
        }
    };

    const LABELS = {
        home: { load: 'Home', size: '3 kW' },
        business: { load: 'Factory', size: '100 kW' }
    };

    // ──────────────────────────────────────────────────────────
    // 2. Drawing helpers: isometric projection and SVG primitives.
    //    x runs down to the right, y down to the left, z up. The camera
    //    sees the top, the left face (+y) and the right face (+x) of a box.
    // ──────────────────────────────────────────────────────────
    let bounds = null;

    function project(x, y, z) {
        const sx = (x - y) * SPREAD * UNIT;
        const sy = ((x + y) / 2 - z) * UNIT;
        if (bounds) {
            if (sx < bounds.minX) bounds.minX = sx;
            if (sx > bounds.maxX) bounds.maxX = sx;
            if (sy < bounds.minY) bounds.minY = sy;
            if (sy > bounds.maxY) bounds.maxY = sy;
        }
        return [sx, sy];
    }

    const round = n => Math.round(n * 100) / 100;
    const xy = p => round(p[0]) + ',' + round(p[1]);
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

    function svgEl(tag, attrs, parent) {
        const node = document.createElementNS(SVG_NS, tag);
        if (attrs) Object.keys(attrs).forEach(key => node.setAttribute(key, attrs[key]));
        if (parent) parent.appendChild(node);
        return node;
    }

    function group(parent, cls) {
        return svgEl('g', cls ? { class: cls } : null, parent);
    }

    function quad(parent, cls, corners) {
        const points = corners.map(c => xy(project(c[0], c[1], c[2]))).join(' ');
        return svgEl('polygon', { class: cls, points: points }, parent);
    }

    function box(parent, cls, x, y, z, w, d, h) {
        const g = group(parent, cls);
        const X = x + w, Y = y + d, Z = z + h;
        quad(g, 'ef-r', [[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]]);
        quad(g, 'ef-l', [[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]]);
        quad(g, 'ef-t', [[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]]);
        return g;
    }

    // Flat shapes drawn on a wall that faces +y (left) or +x (right), or on a top
    function onLeft(parent, cls, y, x0, x1, z0, z1) {
        return quad(parent, cls, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
    }

    function onRight(parent, cls, x, y0, y1, z0, z1) {
        return quad(parent, cls, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
    }

    function onTop(parent, cls, z, x0, x1, y0, y1) {
        return quad(parent, cls, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
    }

    function line(parent, cls, a, b) {
        const p = project(a[0], a[1], a[2]);
        const q = project(b[0], b[1], b[2]);
        return svgEl('line', { class: cls, x1: round(p[0]), y1: round(p[1]), x2: round(q[0]), y2: round(q[1]) }, parent);
    }

    // A smooth path through 3D points, with rounded corners, for cables and flows
    function route(points, radius) {
        const p = points.map(c => project(c[0], c[1], c[2]));
        const r = radius === undefined ? 7 : radius;
        let d = 'M' + xy(p[0]);
        for (let i = 1; i < p.length - 1; i++) {
            const a = p[i - 1], b = p[i], c = p[i + 1];
            const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
            const r1 = Math.min(r, ab / 2), r2 = Math.min(r, bc / 2);
            const s = [b[0] + (a[0] - b[0]) * r1 / ab, b[1] + (a[1] - b[1]) * r1 / ab];
            const e = [b[0] + (c[0] - b[0]) * r2 / bc, b[1] + (c[1] - b[1]) * r2 / bc];
            d += ' L' + xy(s) + ' Q' + xy(b) + ' ' + xy(e);
        }
        return d + ' L' + xy(p[p.length - 1]);
    }

    // An upright cylinder: water tanks, poles and the moon-white insulators
    function cylinder(parent, cls, cx, cy, z, r, h) {
        const g = group(parent, cls);
        const b = project(cx, cy, z);
        const t = project(cx, cy, z + h);
        project(cx + r, cy - r, z); project(cx - r, cy + r, z + h);
        const rx = round(Math.SQRT2 * r * SPREAD * UNIT);
        const ry = round(Math.SQRT2 * r * 0.5 * UNIT);
        const bx = round(b[0]), by = round(b[1]), ty = round(t[1]);
        svgEl('path', { class: 'ef-l', d: `M${bx - rx},${ty} L${bx - rx},${by} A${rx} ${ry} 0 0 0 ${bx + rx},${by} L${bx + rx},${ty} Z` }, g);
        svgEl('path', { class: 'ef-r', d: `M${bx},${ty + ry} L${bx},${by + ry} A${rx} ${ry} 0 0 0 ${bx + rx},${by} L${bx + rx},${ty} A${rx} ${ry} 0 0 1 ${bx},${ty + ry} Z` }, g);
        svgEl('ellipse', { class: 'ef-t', cx: bx, cy: ty, rx: rx, ry: ry }, g);
        return g;
    }

    // A solar module: frame, cell grid and a glow layer that brightens with output
    function module(parent, corners, cols, rows) {
        const g = group(parent, 'ef-module');
        const bl = corners[0], br = corners[1], fr = corners[2], fl = corners[3];
        quad(g, 'ef-pv', corners);
        for (let i = 1; i < cols; i++) line(g, 'ef-pv-line', lerp(bl, br, i / cols), lerp(fl, fr, i / cols));
        for (let j = 1; j < rows; j++) line(g, 'ef-pv-line', lerp(bl, fl, j / rows), lerp(br, fr, j / rows));
        quad(g, 'ef-pv-glow', corners);
        return corners;
    }

    // A light band that sweeps across the modules while they generate
    function sheen(scene, parent, panels) {
        const id = 'ef-clip-' + (++uid);
        const clip = svgEl('clipPath', { id: id }, scene.defs);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        panels.forEach(corners => {
            const pts = corners.map(c => project(c[0], c[1], c[2]));
            pts.forEach(p => {
                minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
                minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
            });
            svgEl('polygon', { points: pts.map(xy).join(' ') }, clip);
        });
        const g = svgEl('g', { class: 'ef-sheen', 'clip-path': `url(#${id})` }, parent);
        const width = (maxX - minX) * 0.22;
        const band = svgEl('rect', {
            class: 'ef-sheen__band',
            x: round(minX - width * 2), y: round(minY - 10), width: round(width), height: round(maxY - minY + 20)
        }, g);
        band.style.setProperty('--ef-travel', round(maxX - minX + width * 3) + 'px');
    }

    // A small fan drawn on a right-facing wall, spinning in that wall's plane
    function fanOnRight(parent, x, y, z, r) {
        const o = project(x, y, z);
        const g = svgEl('g', {
            class: 'ef-fan',
            transform: `matrix(${round(-SPREAD * UNIT)} ${round(0.5 * UNIT)} 0 ${-UNIT} ${round(o[0])} ${round(o[1])})`
        }, parent);
        svgEl('circle', { class: 'ef-fan__ring', r: r, cx: 0, cy: 0 }, g);
        const blades = svgEl('g', { class: 'ef-fan__blades' }, g);
        for (let i = 0; i < 3; i++) {
            svgEl('ellipse', {
                class: 'ef-fan__blade', cx: 0, cy: round(-r * 0.45), rx: round(r * 0.2), ry: round(r * 0.42),
                transform: `rotate(${i * 120})`
            }, blades);
        }
        return g;
    }

    // Where a tag points, and which side of that point it sits on
    function anchor(scene, name, x, y, z, side) {
        const p = project(x, y, z);
        scene.anchors[name] = { x: p[0], y: p[1], side: side || 'up' };
    }

    function flow(scene, name, kind, points) {
        scene.flows[name] = { kind: kind, d: route(points) };
    }

    function windowOn(parent, face, at, a0, a1, z0, z1, extra) {
        const cls = 'ef-window' + (extra ? ' ' + extra : '');
        const pane = face === 'left' ? onLeft(parent, cls, at, a0, a1, z0, z1) : onRight(parent, cls, at, a0, a1, z0, z1);
        if (face === 'left') line(parent, 'ef-mullion', [(a0 + a1) / 2, at, z0], [(a0 + a1) / 2, at, z1]);
        else line(parent, 'ef-mullion', [at, (a0 + a1) / 2, z0], [at, (a0 + a1) / 2, z1]);
        return pane;
    }

    function tree(parent, x, y, scale) {
        const s = scale || 1;
        const g = group(parent, 'ef-tree');
        box(g, 'ef-m-trunk', x - 0.12 * s, y - 0.12 * s, 0, 0.24 * s, 0.24 * s, 1.1 * s);
        box(g, 'ef-m-leaf', x - 0.8 * s, y - 0.8 * s, 1.0 * s, 1.6 * s, 1.6 * s, 1.5 * s);
        box(g, 'ef-m-leaf ef-leaf-top', x - 0.5 * s, y - 0.5 * s, 2.5 * s, 1.0 * s, 1.0 * s, 0.7 * s);
        return g;
    }

    function slab(parent, w, d, step) {
        const g = group(parent, 'ef-slab');
        box(g, 'ef-m-ground', 0, 0, -0.7, w, d, 0.7);
        const lines = group(g, 'ef-slab__grid');
        for (let x = step; x < w; x += step) line(lines, 'ef-gridline', [x, 0, 0], [x, d, 0]);
        for (let y = step; y < d; y += step) line(lines, 'ef-gridline', [0, y, 0], [w, y, 0]);
        return g;
    }

    function shadow(parent, x0, x1, y0, y1, reach) {
        return quad(parent, 'ef-shadow', [[x1, y0, 0], [x1 + reach, y0 + reach * 0.35, 0], [x1 + reach, y1 + reach * 0.35, 0], [x1, y1, 0]]);
    }

    // Overhead lines leaving a pole. Their far ends do not count towards the
    // frame, so the lines run off the edge of the picture.
    function wires(parent, from, to, sag) {
        const g = group(parent, 'ef-wires');
        const tracking = bounds;
        bounds = null;
        for (let i = 0; i < from.length; i++) {
            const a = project(from[i][0], from[i][1], from[i][2]);
            const b = project(to[i][0], to[i][1], to[i][2]);
            const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag];
            svgEl('path', { class: 'ef-wire', d: `M${xy(a)} Q${xy(mid)} ${xy(b)}` }, g);
        }
        bounds = tracking;
        return g;
    }

    function sky(scene) {
        const g = scene.sky;
        const sun = group(g, 'ef-sun');
        const gid = 'ef-sun-' + (++uid);
        const grad = svgEl('radialGradient', { id: gid }, scene.defs);
        svgEl('stop', { offset: '0', class: 'ef-sun__stop-in' }, grad);
        svgEl('stop', { offset: '1', class: 'ef-sun__stop-out' }, grad);
        svgEl('circle', { class: 'ef-sun__halo', r: 46, fill: `url(#${gid})` }, sun);
        svgEl('circle', { class: 'ef-sun__core', r: 13 }, sun);
        const moon = group(g, 'ef-moon');
        svgEl('path', { class: 'ef-moon__disc', d: 'M0,-11 A11,11 0 1 0 0,11 A7,11 0 1 1 0,-11 Z' }, moon);
        const stars = group(g, 'ef-stars');
        let seed = 7;
        const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < 26; i++) {
            const star = svgEl('circle', {
                class: 'ef-star', r: round(0.6 + rand() * 0.9),
                cx: round(scene.box.x + rand() * scene.box.w), cy: round(scene.box.y + rand() * scene.box.h * 0.42)
            }, stars);
            star.style.animationDelay = round(rand() * 4) + 's';
        }
        const clouds = group(g, 'ef-clouds');
        [[0.3, 0.13, 1.1], [0.62, 0.22, 0.8], [0.1, 0.3, 0.7], [0.82, 0.08, 0.9]].forEach((c, i) => {
            const cloud = group(clouds, 'ef-cloud');
            const cx = scene.box.x + scene.box.w * c[0], cy = scene.box.y + scene.box.h * c[1], s = c[2] * 1.2;
            const shape = group(cloud, 'ef-cloud__shape');
            shape.setAttribute('transform', `translate(${round(cx)} ${round(cy)}) scale(${round(s)})`);
            svgEl('rect', { x: -26, y: -6, width: 52, height: 14, rx: 7 }, shape);
            svgEl('circle', { cx: -10, cy: -6, r: 10 }, shape);
            svgEl('circle', { cx: 6, cy: -9, r: 13 }, shape);
            svgEl('circle', { cx: 19, cy: -2, r: 8 }, shape);
            cloud.style.animationDelay = (-i * 9) + 's';
        });
        scene.sun = sun;
        scene.moon = moon;
    }

    function newScene() {
        uid++;
        const svg = svgEl('svg', { class: 'ef-svg', 'aria-hidden': 'true', focusable: 'false' });
        const scene = {
            svg: svg,
            defs: svgEl('defs', null, svg),
            sky: group(svg, 'ef-sky'),
            world: group(svg, 'ef-world'),
            flowLayer: null,
            anchors: {},
            flows: {},
            parts: {}
        };
        bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        return scene;
    }

    // Fit the viewBox to what was drawn and leave room above for the sky
    function frame(scene) {
        const pad = 18;
        const skyRoom = (bounds.maxY - bounds.minY) * 0.1;
        const x = bounds.minX - pad;
        const y = bounds.minY - pad - skyRoom;
        const w = bounds.maxX - bounds.minX + pad * 2;
        const h = bounds.maxY - bounds.minY + pad * 2 + skyRoom;
        scene.box = { x: x, y: y, w: w, h: h };
        scene.svg.setAttribute('viewBox', [x, y, w, h].map(round).join(' '));
        bounds = null;
        sky(scene);
        scene.flowLayer = group(scene.svg, 'ef-flows');
        Object.keys(scene.flows).forEach(name => {
            const f = scene.flows[name];
            const g = group(scene.flowLayer, 'ef-flow');
            g.setAttribute('data-flow', name);
            g.setAttribute('data-kind', f.kind);
            svgEl('path', { class: 'ef-flow__track', d: f.d }, g);
            svgEl('path', { class: 'ef-flow__glow', d: f.d }, g);
            svgEl('path', { class: 'ef-flow__dots', d: f.d }, g);
            f.node = g;
        });
    }

    // ──────────────────────────────────────────────────────────
    // 3. The home: a two-storey house with a flat roof, raised panels,
    //    an inverter by the side wall and a pole for the grid.
    // ──────────────────────────────────────────────────────────
    function buildHome(hybrid) {
        const s = newScene();
        const w = s.world;
        slab(w, 16, 12, 1.6);

        const X0 = 1.6, X1 = 9.2, Y0 = 1.6, Y1 = 7.6, H = 6.2;
        shadow(w, X0, X1, Y0, Y1, 2.2);
        // Walkway from the front door
        onTop(w, 'ef-walk', 0.01, 2.5, 3.7, Y1, 13);

        tree(w, 14.4, 9.6, 1.0);
        tree(w, 0.9, 11.4, 0.8);

        // Grid pole behind the house on the right, its lines leaving the scene
        const PX = 13.0, PY = 1.8, PH = 8.4;
        const pole = group(w, 'ef-pole');
        box(pole, 'ef-m-pole', PX - 0.17, PY - 0.17, 0, 0.34, 0.34, PH);
        box(pole, 'ef-m-pole', PX - 1.3, PY - 0.12, PH - 0.7, 2.6, 0.24, 0.22);
        const arm = [[PX - 1.1, PY, PH - 0.42], [PX, PY, PH - 0.42], [PX + 1.1, PY, PH - 0.42]];
        arm.forEach(p => cylinder(pole, 'ef-m-insulator', p[0], p[1], p[2], 0.1, 0.28));
        s.parts.wires = wires(w, arm.map(p => [p[0], p[1], p[2] + 0.28]), arm.map(p => [p[0] + 0.8, p[1] - 9, p[2] + 1.2]), 5);
        s.parts.gridDown = group(w, 'ef-griddown');
        const gd = project(PX + 0.5, PY - 4.6, PH + 0.75);
        svgEl('circle', { class: 'ef-griddown__badge', cx: round(gd[0]), cy: round(gd[1]), r: 7 }, s.parts.gridDown);
        svgEl('path', { class: 'ef-griddown__cross', d: `M${round(gd[0] - 2.6)},${round(gd[1] - 2.6)} l5.2,5.2 m0,-5.2 l-5.2,5.2` }, s.parts.gridDown);
        // Service cable from the pole down to the meter on the side wall
        const MY = 3.3;
        const service = [[PX - 1.1, PY, PH - 0.14], [(PX - 1.1 + X1) / 2, (PY + MY + 0.3) / 2, PH - 1.7], [X1 + 0.05, MY + 0.3, 5.6]];
        svgEl('path', { class: 'ef-wire ef-wire--service', d: route(service, 40) }, w);

        // House body
        const house = group(w, 'ef-house');
        box(house, 'ef-m-wall', X0, Y0, 0, X1 - X0, Y1 - Y0, H);
        // Plinth and floor band
        box(house, 'ef-m-trim', X0 - 0.08, Y0 - 0.08, 0, X1 - X0 + 0.16, Y1 - Y0 + 0.16, 0.35);
        box(house, 'ef-m-trim', X0 - 0.06, Y0 - 0.06, 3.0, X1 - X0 + 0.12, Y1 - Y0 + 0.12, 0.22);

        // Front (left) face: door, windows and their sunshades
        onLeft(house, 'ef-door', Y1, 2.6, 3.6, 0.35, 2.55);
        windowOn(house, 'left', Y1, 4.4, 5.8, 1.0, 2.3, 'ef-window--essential');
        windowOn(house, 'left', Y1, 2.2, 3.6, 3.7, 5.1, 'ef-window--essential');
        windowOn(house, 'left', Y1, 4.4, 5.8, 3.7, 5.1);
        windowOn(house, 'left', Y1, 6.6, 8.0, 3.7, 5.1);
        [[2.0, 3.8, 5.25], [4.2, 6.0, 5.25], [6.4, 8.2, 5.25], [4.2, 6.0, 2.45], [2.4, 3.8, 2.7]].forEach(c => {
            box(house, 'ef-m-trim', c[0], Y1, c[2], c[1] - c[0], 0.45, 0.12);
        });
        // Side (right) face: windows and the AC unit
        windowOn(house, 'right', X1, 1.9, 3.1, 3.7, 5.1);
        windowOn(house, 'right', X1, 2.1, 3.3, 1.0, 2.1);
        box(house, 'ef-m-trim', X1, 1.7, 5.25, 0.45, 1.6, 0.12);

        // AC outdoor unit, upper floor, with a fan that turns while the home has power
        const ac = group(house, 'ef-ac');
        box(ac, 'ef-m-device', X1, 4.0, 3.75, 0.5, 1.5, 1.05);
        s.parts.fan = fanOnRight(ac, X1 + 0.5, 4.72, 4.27, 0.36);

        // Meter, and the inverter (with the battery below it on a hybrid)
        box(house, 'ef-m-meter', X1, MY, 1.8, 0.22, 0.6, 0.8);
        onRight(house, 'ef-meter-face', X1 + 0.23, MY + 0.12, MY + 0.48, 2.15, 2.42);
        const inv = group(house, 'ef-inverter');
        const IY0 = 5.0, IY1 = 6.4;
        box(inv, 'ef-m-device', X1, IY0, hybrid ? 2.0 : 1.5, 0.42, IY1 - IY0, 1.35);
        s.parts.led = svgEl('circle', { class: 'ef-led', r: 1.4 }, inv);
        const led = project(X1 + 0.43, IY0 + 0.3, (hybrid ? 2.0 : 1.5) + 1.0);
        s.parts.led.setAttribute('cx', round(led[0]));
        s.parts.led.setAttribute('cy', round(led[1]));
        onRight(inv, 'ef-device-screen', X1 + 0.43, IY0 + 0.55, IY1 - 0.25, (hybrid ? 2.0 : 1.5) + 0.75, (hybrid ? 2.0 : 1.5) + 1.1);

        if (hybrid) {
            const bat = group(house, 'ef-battery');
            box(bat, 'ef-m-battery', X1, IY0 + 0.1, 0.12, 0.5, IY1 - IY0 - 0.2, 1.62);
            s.parts.cells = [];
            for (let i = 0; i < 5; i++) {
                const z0 = 0.3 + i * 0.26;
                s.parts.cells.push(onRight(bat, 'ef-cell', X1 + 0.51, IY0 + 0.35, IY1 - 0.65, z0, z0 + 0.18));
            }
        }

        // Roof: slab, parapet behind, raised panels, water tank, parapet in front
        const R = H;
        const roof = group(w, 'ef-roof');
        onTop(roof, 'ef-roof-top', R, X0, X1, Y0, Y1);
        box(roof, 'ef-m-trim', X0, Y0, R, X1 - X0, 0.2, 0.5);
        box(roof, 'ef-m-trim', X0, Y0, R, 0.2, Y1 - Y0, 0.5);

        const panels = [];
        const tilt = 15 * Math.PI / 180;
        const len = 2.15, pw = 1.12, gap = 0.08;
        const cols = 4;
        const startX = 2.25;
        [2.1, 4.75].forEach(yb => {
            const yf = yb + len * Math.cos(tilt);
            const zf = R + 1.0, zb = zf + len * Math.sin(tilt);
            const endX = startX + cols * pw + (cols - 1) * gap;
            // Back legs, then the modules, then the front legs
            for (let i = 0; i <= cols; i += 2) {
                const lx = startX + 0.15 + i * (pw + gap) - (i === cols ? 0.3 + gap : 0);
                line(roof, 'ef-leg', [lx, yb + 0.1, R], [lx, yb + 0.1, zb - 0.05]);
            }
            line(roof, 'ef-rail', [startX, yb + 0.15, zb - 0.06], [endX, yb + 0.15, zb - 0.06]);
            for (let i = 0; i < cols; i++) {
                const xa = startX + i * (pw + gap), xb = xa + pw;
                panels.push(module(roof, [[xa, yb, zb], [xb, yb, zb], [xb, yf, zf], [xa, yf, zf]], 2, 4));
            }
            for (let i = 0; i <= cols; i += 2) {
                const lx = startX + 0.15 + i * (pw + gap) - (i === cols ? 0.3 + gap : 0);
                line(roof, 'ef-leg', [lx, yf - 0.1, R], [lx, yf - 0.1, zf]);
            }
        });
        sheen(s, roof, panels);
        cylinder(roof, 'ef-m-tank', 8.2, 2.7, R + 0.05, 0.55, 1.15);

        box(roof, 'ef-m-trim', X0, Y1 - 0.2, R, X1 - X0, 0.2, 0.5);
        box(roof, 'ef-m-trim', X1 - 0.2, Y0, R, 0.2, Y1 - Y0, 0.5);

        // Anchors for the tags
        anchor(s, 'solar', 4.6, 3.2, R + 2.6);
        anchor(s, 'load', X0, Y1, 3.4, 'left');
        anchor(s, 'grid', PX, PY, PH + 2.0);
        if (hybrid) anchor(s, 'battery', X1 + 0.5, IY1 - 0.1, 0.9, 'right');

        // Energy routes
        const IZ = hybrid ? 2.0 : 1.5;
        const invTop = IZ + 1.35;
        flow(s, 'pv', 'solar', [[6.8, 6.9, R + 1.1], [8.9, 6.9, R + 0.55], [X1 + 0.06, 6.0, R - 0.2], [X1 + 0.06, 6.0, invTop]]);
        flow(s, 'load', 'mixed', [[X1 + 0.06, IY1, IZ + 0.68], [X1 + 0.06, 7.0, IZ + 0.68], [X1 + 0.06, 7.0, 3.11], [X1 + 0.06, Y1 + 0.06, 3.11], [X0 + 0.2, Y1 + 0.06, 3.11]]);
        flow(s, 'grid', 'grid', [[X1 + 0.06, IY0, 2.2], [X1 + 0.06, MY + 0.3, 2.2], [X1 + 0.06, MY + 0.3, 5.0]].concat(service.slice().reverse()));
        if (hybrid) flow(s, 'batt', 'battery', [[X1 + 0.44, IY1 - 0.3, IZ + 0.35], [X1 + 0.56, IY1 - 0.3, 1.6], [X1 + 0.56, IY1 - 0.3, 0.4]]);

        frame(s);
        return s;
    }

    // ──────────────────────────────────────────────────────────
    // 4. The business: a factory shed with a covered roof, a row of
    //    inverters, the transformer yard, a generator and, on a hybrid,
    //    a battery container.
    // ──────────────────────────────────────────────────────────
    function buildBusiness(hybrid) {
        const s = newScene();
        const w = s.world;
        slab(w, 25, 16, 2);

        const X0 = 1.5, X1 = 15.5, Y0 = 1.5, Y1 = 9.5, H = 4.6, RISE = 1.5;
        const YC = (Y0 + Y1) / 2;
        shadow(w, X0, X1, Y0, Y1, 2.6);
        onTop(w, 'ef-walk', 0.01, 3.0, 12.8, Y1, Y1 + 2.2);

        // Transformer yard and HT pole behind on the right
        const yard = group(w, 'ef-yard');
        onTop(yard, 'ef-yard-base', 0.02, 18.2, 22.6, 1.4, 5.2);
        const PX = 23.2, PY = 3.3, PH = 8.2;
        box(yard, 'ef-m-pole', PX - 0.18, PY - 1.4, 0, 0.36, 0.36, PH);
        box(yard, 'ef-m-pole', PX - 0.18, PY + 1.1, 0, 0.36, 0.36, PH);
        box(yard, 'ef-m-pole', PX - 0.14, PY - 1.9, PH - 0.8, 0.28, 3.8, 0.25);
        const arm = [[PX, PY - 1.6, PH - 0.5], [PX, PY + 0.15, PH - 0.5], [PX, PY + 1.6, PH - 0.5]];
        arm.forEach(p => cylinder(yard, 'ef-m-insulator', p[0], p[1], p[2], 0.11, 0.32));
        s.parts.wires = wires(w, arm.map(p => [p[0], p[1], p[2] + 0.32]), arm.map(p => [p[0] + 2.0, p[1] - 7.5, p[2] + 0.8]), 6);
        const tx = group(yard, 'ef-transformer');
        box(tx, 'ef-m-device', 19.0, 2.2, 0.02, 2.4, 2.0, 2.2);
        for (let i = 0; i < 6; i++) onLeft(tx, 'ef-fin', 4.21, 19.25 + i * 0.36, 19.4 + i * 0.36, 0.3, 1.9);
        [19.6, 20.2, 20.8].forEach(x => cylinder(tx, 'ef-m-insulator', x, 2.9, 2.22, 0.1, 0.45));
        s.parts.gridDown = group(w, 'ef-griddown');
        const gd = project(PX + 1.1, PY - 4.0, PH + 0.5);
        svgEl('circle', { class: 'ef-griddown__badge', cx: round(gd[0]), cy: round(gd[1]), r: 7 }, s.parts.gridDown);
        svgEl('path', { class: 'ef-griddown__cross', d: `M${round(gd[0] - 2.6)},${round(gd[1] - 2.6)} l5.2,5.2 m0,-5.2 l-5.2,5.2` }, s.parts.gridDown);

        // Factory shed
        const shed = group(w, 'ef-shed');
        box(shed, 'ef-m-shed', X0, Y0, 0, X1 - X0, Y1 - Y0, H);
        // Gable end on the right wall
        quad(shed, 'ef-r ef-gable', [[X1, Y0, H], [X1, Y1, H], [X1, YC, H + RISE], [X1, YC, H + RISE]]);
        onRight(shed, 'ef-louvre', X1, YC - 0.9, YC + 0.9, H + 0.15, H + 0.75);
        // Front wall: shutters, a strip of high windows and a door
        [[3.0, 5.6], [6.8, 9.4]].forEach(c => {
            onLeft(shed, 'ef-shutter-bay', Y1, c[0], c[1], 0, 3.0);
            onLeft(shed, 'ef-shutter', Y1, c[0] + 0.12, c[1] - 0.12, 1.15, 2.88);
            for (let z = 1.35; z < 2.85; z += 0.3) line(shed, 'ef-shutter-line', [c[0] + 0.12, Y1, z], [c[1] - 0.12, Y1, z]);
        });
        onLeft(shed, 'ef-door', Y1, 11.0, 12.1, 0, 2.3);
        for (let i = 0; i < 8; i++) {
            const x = 2.2 + i * 1.6;
            onLeft(shed, 'ef-window ef-window--strip' + (i % 3 === 0 ? ' ef-window--essential' : ''), Y1, x, x + 1.1, 3.5, 4.15);
        }
        // Right wall windows
        for (let i = 0; i < 3; i++) {
            const y = 2.4 + i * 2.3;
            onRight(shed, 'ef-window ef-window--strip' + (i === 1 ? ' ef-window--essential' : ''), X1, y, y + 1.4, 3.5, 4.15);
        }

        // Pitched roof: back slope, then the front slope covered with modules
        const roof = group(w, 'ef-roof');
        quad(roof, 'ef-roof-back', [[X0, Y0, H], [X1, Y0, H], [X1, YC, H + RISE], [X0, YC, H + RISE]]);
        quad(roof, 'ef-roof-front', [[X0, YC, H + RISE], [X1, YC, H + RISE], [X1, Y1, H], [X0, Y1, H]]);
        const slope = t => [YC + (Y1 - YC) * t, H + RISE - RISE * t + 0.06];
        const panels = [];
        const COLS = 11, ROWS = 3;
        const mx0 = X0 + 0.5, mx1 = X1 - 0.5;
        const mw = (mx1 - mx0) / COLS;
        for (let r = 0; r < ROWS; r++) {
            const t0 = 0.08 + r * 0.3, t1 = t0 + 0.27;
            const a = slope(t0), b = slope(t1);
            for (let c = 0; c < COLS; c++) {
                const xa = mx0 + c * mw + 0.05, xb = xa + mw - 0.1;
                panels.push(module(roof, [[xa, a[0], a[1]], [xb, a[0], a[1]], [xb, b[0], b[1]], [xa, b[0], b[1]]], 2, 2));
            }
        }
        sheen(s, roof, panels);
        line(roof, 'ef-ridge', [X0, YC, H + RISE], [X1, YC, H + RISE]);

        // Inverter rack beside the right wall
        const rack = group(w, 'ef-inverter');
        box(rack, 'ef-m-trim', 16.6, 7.4, 0, 3.6, 0.3, 0.25);
        line(rack, 'ef-leg', [16.8, 7.55, 0.25], [16.8, 7.55, 2.9]);
        line(rack, 'ef-leg', [20.0, 7.55, 0.25], [20.0, 7.55, 2.9]);
        s.parts.leds = [];
        [16.9, 18.05, 19.2].forEach(x => {
            box(rack, 'ef-m-device', x, 7.55, 1.1, 0.95, 0.32, 1.35);
            onLeft(rack, 'ef-device-screen', 7.88, x + 0.2, x + 0.75, 1.95, 2.25);
            const p = project(x + 0.2, 7.88, 1.45);
            s.parts.leds.push(svgEl('circle', { class: 'ef-led', cx: round(p[0]), cy: round(p[1]), r: 1.3 }, rack));
        });
        s.parts.led = s.parts.leds[0];

        // Generator at the front right
        const dg = group(w, 'ef-dg');
        const DX = 17.3, DY = 11.4;
        box(dg, 'ef-m-dg', DX, DY, 0, 2.8, 1.3, 1.45);
        for (let i = 0; i < 4; i++) onLeft(dg, 'ef-vent', DY + 1.3, DX + 0.3 + i * 0.32, DX + 0.48 + i * 0.32, 0.35, 1.1);
        cylinder(dg, 'ef-m-pole', DX + 2.3, DY + 0.4, 1.45, 0.12, 0.7);
        s.parts.smoke = group(dg, 'ef-smoke');
        const sp = project(DX + 2.3, DY + 0.4, 2.3);
        for (let i = 0; i < 3; i++) {
            const puff = svgEl('circle', { class: 'ef-puff', cx: round(sp[0]), cy: round(sp[1]), r: 2.4 }, s.parts.smoke);
            puff.style.animationDelay = (i * 0.8) + 's';
        }

        if (hybrid) {
            const bess = group(w, 'ef-battery');
            const BX = 21.0, BY = 8.8;
            box(bess, 'ef-m-battery', BX, BY, 0, 3.4, 1.6, 1.9);
            onLeft(bess, 'ef-bess-band', BY + 1.6, BX, BX + 3.4, 1.45, 1.6);
            for (let i = 0; i < 3; i++) onLeft(bess, 'ef-vent', BY + 1.6, BX + 0.4 + i * 0.45, BX + 0.7 + i * 0.45, 0.4, 1.2);
            s.parts.cells = [];
            for (let i = 0; i < 5; i++) {
                const x0 = BX + 1.9 + i * 0.27;
                s.parts.cells.push(onLeft(bess, 'ef-cell', BY + 1.61, x0, x0 + 0.2, 0.45, 1.2));
            }
        }

        tree(w, 1.2, 13.6, 1.2);
        tree(w, 3.2, 14.6, 0.9);

        // Far enough apart that the two tags do not touch on a small phone
        anchor(s, 'solar', 12, 6.8, H + RISE + 2.2);
        anchor(s, 'load', 3.2, Y1, H + 1.9);
        anchor(s, 'grid', PX, PY, PH + 2.4);
        anchor(s, 'diesel', DX + 1.4, DY + 1.3, 0.2, 'down');
        if (hybrid) anchor(s, 'battery', 24.4, 9.6, 1.2, 'right');

        // Solar comes down the gable end, then along the ground to the inverters
        const GY = YC + 0.8;
        const gableZ = H + RISE * (1 - (GY - YC) / (Y1 - YC)) - 0.15;
        flow(s, 'pv', 'solar', [[X1 - 0.6, GY + 0.3, gableZ + 0.2], [X1 + 0.06, GY, gableZ], [X1 + 0.06, GY, 0.04], [17.3, GY, 0.04], [17.3, 7.6, 0.04], [17.3, 7.6, 1.1]]);
        // Power for the factory runs along the side wall, round the corner and along the front
        flow(s, 'load', 'mixed', [[16.7, 7.72, 1.6], [X1 + 0.06, 7.72, 1.6], [X1 + 0.06, Y1 + 0.06, 1.6], [14.4, Y1 + 0.06, 1.6], [14.4, Y1 + 0.06, 3.3], [X0 + 0.3, Y1 + 0.06, 3.3]]);
        flow(s, 'grid', 'grid', [[19.6, 7.55, 0.04], [19.6, 4.4, 0.04], [20.2, 4.2, 0.04], [20.2, 4.2, 1.6]]);
        flow(s, 'grid2', 'grid', [[21.1, 2.7, 2.6], [22.2, 1.9, 5.0], [PX - 0.1, PY - 1.5, PH - 0.2]]);
        flow(s, 'dg', 'diesel', [[18.5, DY, 0.04], [18.5, 7.9, 0.04], [18.5, 7.9, 1.1]]);
        if (hybrid) flow(s, 'batt', 'battery', [[20.15, 7.72, 1.6], [20.6, 7.72, 1.6], [20.6, 7.72, 0.04], [21.8, 7.72, 0.04], [21.8, 8.8, 0.04]]);

        frame(s);
        return s;
    }

    // ──────────────────────────────────────────────────────────
    // 5. Small inline icons for the controls
    // ──────────────────────────────────────────────────────────
    const ICONS = {
        noon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        cloudy: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
        evening: '<path d="M12 10V2M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0"/>',
        night: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        holiday: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
        outage: '<path d="M10.5 4.9 13.1 2.2a.5.5 0 0 1 .9.5l-1.4 4.3M15.7 10H20a1 1 0 0 1 .8 1.6l-1.7 1.8M16.3 16.3l-5.1 5.1a.5.5 0 0 1-.9-.5l1.9-6A1 1 0 0 0 11.3 13.5H4a1 1 0 0 1-.8-1.6l4.5-4.7M2 2l20 20"/>',
        play: '<path d="M7 4.5v15l12-7.5Z"/>',
        pause: '<path d="M8 5v14M16 5v14"/>'
    };

    const icon = name => `<svg class="ef-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

    // ──────────────────────────────────────────────────────────
    // 6. One widget per [data-energy-flow] element
    // ──────────────────────────────────────────────────────────
    const fmtPower = (kw, segment) => {
        const v = Math.abs(kw);
        if (segment === 'home') return (v === 0 ? '0' : v.toFixed(1)) + ' kW';
        return Math.round(v) + ' kW';
    };

    function EnergyFlow(root) {
        this.root = root;
        this.segment = root.getAttribute('data-segment') === 'business' ? 'business' : 'home';
        this.system = root.getAttribute('data-system') === 'hybrid' ? 'hybrid' : 'ongrid';
        const choices = (root.getAttribute('data-choices') || '').split(/\s+/);
        this.choices = { segment: choices.indexOf('segment') !== -1, system: choices.indexOf('system') !== -1 };
        this.index = 0;
        // The tour steps through the scenarios; paused also freezes the
        // moving lines, so the button stops all motion
        this.playing = !reduceMotion;
        this.paused = false;
        this.visible = false;
        this.timer = null;
        this.build();
        this.render();
        this.observe();
    }

    EnergyFlow.prototype.build = function () {
        const root = this.root;
        root.textContent = '';
        root.classList.add('is-ready');
        const id = 'ef-' + (++uid);
        const switches = [];
        if (this.choices.segment) {
            switches.push(`<div class="ef-switch" role="group" aria-label="Building">
                <button type="button" data-segment-choice="home">Home</button>
                <button type="button" data-segment-choice="business">Business</button>
            </div>`);
        }
        if (this.choices.system) {
            switches.push(`<div class="ef-switch" role="group" aria-label="System type">
                <button type="button" data-system-choice="ongrid">On-grid</button>
                <button type="button" data-system-choice="hybrid">Hybrid with battery</button>
            </div>`);
        }
        root.innerHTML = `
            ${switches.length ? `<div class="ef-bar">${switches.join('')}</div>` : ''}
            <div class="ef-body">
                <div class="ef-stage">
                    <div class="ef-backdrop" aria-hidden="true"></div>
                    <div class="ef-canvas"></div>
                    <div class="ef-tags" aria-hidden="true"></div>
                    <p class="ef-clock" aria-hidden="true"><span class="ef-clock__time"></span><span class="ef-clock__sep"></span><span class="ef-clock__system"></span></p>
                    <div class="ef-scenes" role="group" aria-label="Conditions">
                        <div class="ef-chips"></div>
                        <button type="button" class="ef-play" aria-label="Pause animation">${icon('pause')}</button>
                    </div>
                </div>
                <div class="ef-panel" id="${id}-panel">
                    <p class="ef-panel__label"></p>
                    <h3 class="ef-panel__title" aria-live="${this.playing ? 'off' : 'polite'}"></h3>
                    <p class="ef-panel__text"></p>
                    <ul class="ef-stats"></ul>
                    <p class="ef-panel__note">Illustrative figures for a typical <span class="ef-size"></span> system. Your site audit sets the real numbers.</p>
                </div>
            </div>`;
        this.stage = root.querySelector('.ef-stage');
        this.canvas = root.querySelector('.ef-canvas');
        this.tags = root.querySelector('.ef-tags');
        this.chips = root.querySelector('.ef-chips');
        this.playBtn = root.querySelector('.ef-play');
        this.panel = root.querySelector('.ef-panel');
        this.title = root.querySelector('.ef-panel__title');

        root.addEventListener('click', event => {
            const seg = event.target.closest('[data-segment-choice]');
            const sys = event.target.closest('[data-system-choice]');
            // Match the chip by class: the root carries data-scenario too
            const chip = event.target.closest('.ef-chip');
            if (seg && seg.getAttribute('data-segment-choice') !== this.segment) {
                this.segment = seg.getAttribute('data-segment-choice');
                this.stop();
                this.render();
            } else if (sys && sys.getAttribute('data-system-choice') !== this.system) {
                this.system = sys.getAttribute('data-system-choice');
                this.stop();
                this.render();
            } else if (chip) {
                this.stop();
                this.show(Number(chip.getAttribute('data-scenario')));
            } else if (event.target.closest('.ef-play')) {
                if (this.paused) this.resume(); else this.pause();
            }
        });
        // Someone moving through the controls by keyboard should not have the
        // scenario change under them
        root.addEventListener('focusin', () => {
            if (this.playing) this.stop();
        });
        this.chips.addEventListener('keydown', event => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            const list = this.list();
            const next = (this.index + (event.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length;
            this.stop();
            this.show(next);
            this.chips.children[next].focus();
            event.preventDefault();
        });
        // When the chips are too wide for the row they scroll; fade whichever
        // end of the row still has chips out of view
        this.edge = () => {
            const row = this.chips;
            row.classList.toggle('is-clipped', row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
            row.classList.toggle('is-clipped-start', row.scrollLeft > 2);
        };
        this.chips.addEventListener('scroll', this.edge, { passive: true });
        window.addEventListener('resize', this.edge);
        // A chip reached with Tab can sit half under the fade; bring it to the middle
        this.chips.addEventListener('focusin', event => {
            const chip = event.target.closest('.ef-chip');
            if (chip) this.centre(chip, false);
        });
        if (reduceMotion) this.playBtn.hidden = true;
    };

    EnergyFlow.prototype.list = function () {
        return SCENARIOS[this.segment][this.system];
    };

    // Draw the scene for the current building and system, then show a scenario
    EnergyFlow.prototype.render = function () {
        const keep = this.current ? this.current.id : this.root.getAttribute('data-scenario');
        const scene = this.segment === 'business' ? buildBusiness(this.system === 'hybrid') : buildHome(this.system === 'hybrid');
        this.scene = scene;
        this.canvas.textContent = '';
        this.canvas.appendChild(scene.svg);
        this.root.setAttribute('data-scene', this.segment);
        this.root.setAttribute('data-system', this.system);
        this.stage.style.setProperty('--ef-aspect', round(scene.box.w / scene.box.h));

        this.root.querySelectorAll('[data-segment-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-segment-choice') === this.segment)));
        this.root.querySelectorAll('[data-system-choice]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-system-choice') === this.system)));
        this.root.querySelector('.ef-size').textContent = LABELS[this.segment].size + (this.system === 'hybrid' ? ' solar and battery' : ' on-grid');
        this.root.querySelector('.ef-clock__system').textContent = (this.segment === 'home' ? 'Home' : 'Business') + ', ' + (this.system === 'hybrid' ? 'hybrid' : 'on-grid');

        const list = this.list();
        this.chips.innerHTML = list.map((sc, i) =>
            `<button type="button" class="ef-chip" data-scenario="${i}" aria-pressed="false">${icon(sc.id)}<span>${sc.chip}</span></button>`).join('');
        this.edge();

        this.tags.innerHTML = '';
        this.tagEls = {};
        const names = ['solar', 'load', 'battery', 'grid', 'diesel'].filter(n => scene.anchors[n]);
        names.forEach(name => {
            const p = scene.anchors[name];
            const tag = document.createElement('div');
            tag.className = 'ef-tag ef-tag--' + name;
            tag.style.setProperty('--x', round((p.x - scene.box.x) / scene.box.w * 100) + '%');
            tag.style.setProperty('--y', round((p.y - scene.box.y) / scene.box.h * 100) + '%');
            tag.setAttribute('data-side', p.side);
            tag.innerHTML = '<span class="ef-tag__name"></span><strong class="ef-tag__value"></strong>';
            this.tags.appendChild(tag);
            this.tagEls[name] = tag;
        });

        const statNames = ['solar', 'load'].concat(this.system === 'hybrid' ? ['battery'] : [], ['grid'], scene.anchors.diesel ? ['diesel'] : []);
        this.root.querySelector('.ef-stats').innerHTML = statNames.map(name =>
            `<li class="ef-stat ef-stat--${name}" data-stat="${name}">
                <span class="ef-stat__name"></span>
                <span class="ef-stat__bar"><span></span></span>
                <strong class="ef-stat__value"></strong>
                <span class="ef-stat__note"></span>
            </li>`).join('');

        let index = list.findIndex(sc => sc.id === keep);
        if (index < 0) index = 0;
        this.show(index, true);
        if (this.playing) this.schedule();
    };

    EnergyFlow.prototype.show = function (index, instant) {
        const list = this.list();
        const sc = list[index];
        const seg = this.segment;
        const scene = this.scene;
        const root = this.root;
        this.index = index;
        this.current = sc;
        const peak = Math.max.apply(null, list.map(x => Math.max(x.solar, x.load, Math.abs(x.grid), Math.abs(x.battery || 0), x.diesel || 0)));

        root.setAttribute('data-sky', sc.sky);
        root.setAttribute('data-grid', sc.gridDown ? 'down' : 'up');
        root.setAttribute('data-lights', sc.lights);
        root.setAttribute('data-inverter', sc.inverterOff ? 'off' : (sc.solar > 0 || (sc.battery || 0) !== 0 ? 'on' : 'idle'));
        root.setAttribute('data-diesel', sc.diesel ? 'on' : 'off');
        root.classList.toggle('is-instant', !!instant);
        scene.svg.style.setProperty('--pv', round(Math.min(1, sc.solar / (seg === 'home' ? 2.8 : 84))));

        // Sun and moon positions for this time of day
        const b = scene.box;
        // The light falls from the upper left, so the sun stays on that side
        const spots = {
            noon: [0.16, 0.17],
            cloudy: [0.3, 0.15],
            evening: [0.06, 0.4],
            night: [0.04, 0.62]
        };
        const sunAt = spots[sc.sky];
        scene.sun.style.transform = `translate(${round(b.x + b.w * sunAt[0])}px, ${round(b.y + b.h * sunAt[1])}px)`;
        scene.moon.style.transform = `translate(${round(b.x + b.w * 0.16)}px, ${round(b.y + b.h * (sc.sky === 'night' ? 0.17 : 0.27))}px)`;

        // Flow directions, widths and speeds
        // Grid and battery routes are drawn from the hub outwards, so export
        // and charging run forwards along them
        const states = {
            pv: sc.solar,
            load: sc.load,
            grid: sc.grid,
            grid2: sc.grid,
            batt: sc.battery || 0,
            dg: sc.diesel || 0
        };
        const source = sc.solar >= Math.max(-sc.grid, -(sc.battery || 0), sc.diesel || 0) && sc.solar > 0 ? 'solar'
            : (sc.diesel || 0) > 0 ? 'diesel'
                : -(sc.battery || 0) >= -sc.grid ? 'battery' : 'grid';
        Object.keys(scene.flows).forEach(name => {
            const f = scene.flows[name];
            const value = states[name] || 0;
            const share = Math.min(1, Math.abs(value) / peak);
            f.node.setAttribute('data-state', value > 0.001 ? 'fwd' : value < -0.001 ? 'rev' : 'off');
            if (name === 'load') f.node.setAttribute('data-kind', source);
            f.node.style.setProperty('--ef-w', round(0.55 + share * 0.9));
            f.node.style.setProperty('--ef-dur', round(1.5 - share * 0.85) + 's');
        });

        // Battery charge bars
        if (scene.parts.cells) {
            const lit = Math.max(1, Math.round((sc.soc || 0) / 20));
            scene.parts.cells.forEach((cell, i) => cell.classList.toggle('is-lit', i < lit));
            root.setAttribute('data-battery', (sc.battery || 0) > 0 ? 'charging' : (sc.battery || 0) < 0 ? 'discharging' : 'idle');
        }

        // Tags on the scene
        const L = LABELS[seg];
        const setTag = (name, label, value, state) => {
            const tag = this.tagEls[name];
            if (!tag) return;
            tag.querySelector('.ef-tag__name').textContent = label;
            tag.querySelector('.ef-tag__value').textContent = value;
            tag.setAttribute('data-state', state);
        };
        setTag('solar', 'Solar', sc.inverterOff ? 'Off' : fmtPower(sc.solar, seg), sc.solar > 0 ? 'on' : 'off');
        setTag('load', L.load, sc.load > 0 ? fmtPower(sc.load, seg) : 'Off', sc.load > 0 ? 'on' : 'off');
        setTag('grid', 'Grid', sc.gridDown ? 'Down' : sc.grid > 0 ? 'Export ' + fmtPower(sc.grid, seg) : sc.grid < 0 ? 'Import ' + fmtPower(sc.grid, seg) : 'Idle', sc.gridDown ? 'down' : sc.grid !== 0 ? 'on' : 'off');
        setTag('battery', 'Battery', sc.soc + '%', (sc.battery || 0) !== 0 ? 'on' : 'off');
        setTag('diesel', 'Generator', sc.diesel ? fmtPower(sc.diesel, seg) : 'Off', sc.diesel ? 'on' : 'off');

        // The side panel
        const panel = this.panel;
        root.querySelector('.ef-clock__time').textContent = sc.clock;
        panel.querySelector('.ef-panel__label').textContent = sc.chip + ' · ' + sc.clock;
        panel.querySelector('.ef-panel__title').textContent = sc.title;
        panel.querySelector('.ef-panel__text').textContent = sc.text;
        const bat = sc.battery || 0;
        const stats = {
            solar: ['Solar', sc.inverterOff ? 'Off' : fmtPower(sc.solar, seg), sc.inverterOff ? 'Inverter stopped for safety' : sc.solar > 0 ? 'Generating' : 'No sunlight', sc.solar],
            load: [L.load + ' uses', fmtPower(sc.load, seg), sc.load === 0 ? 'No supply' : sc.lights === 'essential' ? 'Essential loads only' : 'Mostly from ' + ({ solar: 'solar', battery: 'the battery', grid: 'the grid', diesel: 'the generator' })[source], sc.load],
            battery: ['Battery', fmtPower(bat, seg), (bat > 0 ? 'Charging' : bat < 0 ? 'Supplying' : 'Holding') + ', ' + (sc.soc || 0) + '% full', Math.abs(bat)],
            grid: ['Grid', sc.gridDown ? 'Down' : fmtPower(sc.grid, seg), sc.gridDown ? 'Power cut' : sc.grid > 0 ? 'Exporting, banked as credit' : sc.grid < 0 ? 'Importing' : 'Not used', Math.abs(sc.grid)],
            diesel: ['Generator', sc.diesel ? fmtPower(sc.diesel, seg) : 'Off', sc.diesel ? 'Running on diesel' : 'Standing by', sc.diesel || 0]
        };
        panel.querySelectorAll('[data-stat]').forEach(li => {
            const v = stats[li.getAttribute('data-stat')];
            li.querySelector('.ef-stat__name').textContent = v[0];
            li.querySelector('.ef-stat__value').textContent = v[1];
            li.querySelector('.ef-stat__note').textContent = v[2];
            li.querySelector('.ef-stat__bar span').style.transform = `scaleX(${round(Math.min(1, v[3] / peak))})`;
            li.setAttribute('data-state', v[3] > 0 ? 'on' : 'off');
        });

        this.chips.querySelectorAll('[data-scenario]').forEach((chip, i) => {
            chip.setAttribute('aria-pressed', String(i === index));
            chip.classList.toggle('is-active', i === index);
        });
        // On a narrow screen the chips scroll sideways; keep the active one in view
        if (this.chips.children[index]) this.centre(this.chips.children[index], instant);
        if (instant) {
            // Let the first paint skip the transitions, then turn them back on
            requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-instant')));
        }
    };

    // Scroll the chip row so a chip sits in the middle, when the row overflows
    EnergyFlow.prototype.centre = function (chip, instant) {
        const row = this.chips;
        if (row.scrollWidth <= row.clientWidth) return;
        const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
        row.scrollTo({ left: Math.max(0, left), behavior: instant || reduceMotion ? 'auto' : 'smooth' });
    };

    // The tour moves through the scenarios on its own until someone picks one
    EnergyFlow.prototype.schedule = function () {
        clearTimeout(this.timer);
        this.root.classList.remove('is-ticking');
        if (!this.playing || !this.visible) return;
        void this.root.offsetWidth;
        this.root.classList.add('is-ticking');
        this.root.style.setProperty('--ef-tick', AUTOPLAY_MS + 'ms');
        this.timer = setTimeout(() => {
            this.show((this.index + 1) % this.list().length);
            this.schedule();
        }, AUTOPLAY_MS);
    };

    // Picking a scenario or a system ends the tour, while the lines keep
    // moving. From then on a new scenario is read out when it is picked.
    EnergyFlow.prototype.stop = function () {
        this.playing = false;
        clearTimeout(this.timer);
        this.root.classList.remove('is-ticking');
        this.title.setAttribute('aria-live', 'polite');
    };

    // The play button: pause freezes every animation as well as the tour
    EnergyFlow.prototype.pause = function () {
        this.stop();
        this.paused = true;
        this.root.classList.add('is-paused');
        this.playBtn.innerHTML = icon('play');
        this.playBtn.setAttribute('aria-label', 'Play animation');
    };

    // Play starts the motion again and moves the tour on to the next scenario
    EnergyFlow.prototype.resume = function () {
        this.paused = false;
        this.playing = true;
        this.root.classList.remove('is-paused');
        this.playBtn.innerHTML = icon('pause');
        this.playBtn.setAttribute('aria-label', 'Pause animation');
        this.title.setAttribute('aria-live', 'off');
        this.show((this.index + 1) % this.list().length);
        this.schedule();
    };

    // Pause the motion and the tour while the widget is off screen
    EnergyFlow.prototype.observe = function () {
        if (!('IntersectionObserver' in window)) {
            this.visible = true;
            this.schedule();
            return;
        }
        new IntersectionObserver(entries => {
            entries.forEach(entry => {
                this.visible = entry.isIntersecting;
                this.root.classList.toggle('is-offscreen', !entry.isIntersecting);
                if (this.visible) {
                    this.edge();
                    this.schedule();
                } else {
                    clearTimeout(this.timer);
                }
            });
        }, { threshold: 0.25 }).observe(this.root);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearTimeout(this.timer);
            else this.schedule();
        });
    };

    roots.forEach(root => new EnergyFlow(root));
})();
