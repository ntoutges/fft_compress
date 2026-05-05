/**
 * Run Inverse DFT on image data
 */

import { _Complex, from_cart } from "../complex.js";
import { _Curve, curve_save_t, load } from "../curve.js";
import { dft_invert_single, dft_single } from "../fourier.js";

let curves: _Curve[] = [];
let active: number = 0;
let working: symbol | null = null;

let ptIndex: number = 0;
let ptLength: number = 0;

// Output frequencies from DFT
const freqs: {
    r: _Complex[];
    g: _Complex[];
    b: _Complex[];
} = { r: [], g: [], b: [] };

let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let interval: ReturnType<typeof setInterval> | null = null;

function handleEvent(ev: MessageEvent) {
    switch (ev.data.type) {
        case "init": // { curves, freqs, width, height }
            init(ev.data);
            break;

        case "run":
            run();

        case "done":
            self.postMessage({ type: "done", done: !working });
    }
}

function init(data: {
    curves: curve_save_t[];
    freqs: Record<"rx" | "ry" | "gx" | "gy" | "bx" | "by", ArrayBuffer>;
    width: number;
    height: number;
}) {
    curves = data.curves.map((x) => load(x));
    active = 0;

    ptLength = 0;
    ptIndex = 0;

    working = null;

    freqs.r.splice(0);
    freqs.g.splice(0);
    freqs.b.splice(0);

    // Extract frequency data from `data.freqs`
    const rx = new Float32Array(data.freqs.rx);
    const ry = new Float32Array(data.freqs.ry);
    const gx = new Float32Array(data.freqs.gx);
    const gy = new Float32Array(data.freqs.gy);
    const bx = new Float32Array(data.freqs.bx);
    const by = new Float32Array(data.freqs.by);

    for (const i in rx) {
        freqs.r.push(from_cart(rx[i], ry[i] ?? 0));
        freqs.g.push(from_cart(gx[i] ?? 0, gy[i] ?? 0));
        freqs.b.push(from_cart(bx[i] ?? 0, by[i] ?? 0));
    }

    // Setup render canvas
    canvas = new OffscreenCanvas(data.width, data.height);
    ctx = canvas.getContext("2d")!;

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
        const done = step(performance.now() + 500);

        if (done && interval !== null) {
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
        } else {
            self.postMessage(
                {
                    type: "progress",
                    progress: ptIndex / ptLength,
                },
                // @ts-ignore
                // [bitmap],
            );
        }
    }, 0);
}

/**
 * Run through some number of dft steps before halting
 * @param stop  The time (in ms) to stop
 * @returns     Whether we have finished
 */
function step(stop: number): boolean {
    const length =
        ptLength % 2 === 0 ? 2 * freqs.r.length - 2 : 2 * freqs.r.length - 1; // Account for overlapping point

    // Generate points and write to canvas
    for (let i = active; i < curves.length; i++) {
        const curve = curves[i];
        let point: _Complex | null;

        while ((point = curve.next())) {
            const x = point.re();
            const y = point.im();
            const n = ptIndex++;

            // Invalid curve point; Skip!
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
                continue;
            }

            // Compute R/G/B values, and add to canvas
            // Compute IDFT in the proper channel
            let r = dft_invert_single(freqs.r, ptLength % 2 === 0, n) * length;
            let g = dft_invert_single(freqs.g, ptLength % 2 === 0, n) * length;
            let b = dft_invert_single(freqs.b, ptLength % 2 === 0, n) * length;

            // Clamp+Round components
            r = Math.round(Math.min(Math.max(r, 0), 255));
            g = Math.round(Math.min(Math.max(g, 0), 255));
            b = Math.round(Math.min(Math.max(b, 0), 255));

            // Get fill style from raw RGB values
            ctx.fillStyle = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            ctx.fillRect(x, y, 1, 1);

            // Halt!
            if (performance.now() > stop) return false;
        }

        // Halt!
        if (performance.now() > stop) return false;
    }

    curves.splice(0); // Clear curves; No longer needed
    return true; // Done!
}

self.onmessage = handleEvent;
