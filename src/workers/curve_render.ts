/**
 * Render a curve to some bitmap graphics
 */

import { _Complex } from "../complex.js";
import { _Curve, curve_save_t, load } from "../curve.js";

let curves: _Curve[] = [];
let active: number = 0;
let working: symbol | null = null;

let ptIndex: number = 0;
let ptLength: number = 0;

let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let interval: ReturnType<typeof setInterval> | null = null;

function handleEvent(ev: MessageEvent) {
    switch (ev.data.type) {
        case "init": // { curves, width, height }
            init(ev.data);
            break;

        case "run":
            run();

        case "done":
            self.postMessage({ type: "done", done: !working });
    }
}

function init(data: { curves: curve_save_t[]; width: number; height: number }) {
    curves = data.curves.map((x) => load(x));
    active = 0;

    canvas = new OffscreenCanvas(data.width, data.height);
    ctx = canvas.getContext("2d");

    working = null;
    ptLength = 0;
    ptIndex = 0;

    // Get total number of points
    for (const curve of curves) {
        ptLength += curve.length();
    }

    if (interval !== null) clearInterval(interval);
    interval = null;
}

function run() {
    if (interval !== null) clearInterval(interval);

    let localWorking = Symbol();
    working = localWorking;

    // Run in steps to allow event handler to still run
    interval = setInterval(() => {
        const done = step(performance.now() + 10);

        if (done) {
            clearInterval(interval);
            if (working !== localWorking) return; // Some other process started; Discard results

            const bitmap = canvas.transferToImageBitmap();
            postMessage(
                {
                    type: "fin",
                    bmp: bitmap,
                },
                // @ts-ignore
                [bitmap],
            );
            working = null;
        }
    }, 0);
}

/**
 * Run through some number of steps before halting
 * @param stop  The time (in ms) to stop
 * @returns     Whether we have finished
 */
function step(stop: number): boolean {
    // Generate points and write to canvas
    for (let i = active; i < curves.length; i++) {
        const curve = curves[i];
        let point: _Complex;

        while ((point = curve.next())) {
            const x = point.re();
            const y = point.im();

            // Render point to canvas
            ctx.fillStyle = rainbow(ptIndex++, ptLength);
            ctx.fillRect(x, y, 1, 1);

            // Halt!
            if (performance.now() > stop) return false;
        }
    }

    curves.splice(0); // Clear curves; No longer needed
    return true;
}

/**
 * Generate some color from an index
 * Colors generated from similar indices will be similar
 * @param index The index to generate the color
 */
function rainbow(index: number, period: number): string {
    // Normalize index into [0, 1)
    const t = (index % period) / period;

    // Hue cycles around color wheel
    const h = t * 360;

    // Keep saturation/value fixed for consistency
    const s = 0.5;
    const v = 0.5;

    return `hsl(${h}, ${Math.round(100 * s)}%, ${Math.round(v * 100)}%)`;
}

self.onmessage = handleEvent;
