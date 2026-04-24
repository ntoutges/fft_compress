/**
 * Run DFT on image data
 */

import { _Complex } from "../complex.js";
import { _Curve, curve_save_t, load } from "../curve.js";
import { dft_half } from "../fourier.js";

enum state_t {
    DECURVE, // Convert image bitmap into set of 3 R/G/B series
    DFT, // Run DFT on extracted R/G/B series
}

let curves: _Curve[] = [];
let active: number = 0;
let working: symbol | null = null;
let state: state_t = state_t.DECURVE;

const series: {
    r: number[];
    g: number[];
    b: number[];
} = { r: [], g: [], b: [] };

// Output frequencies from DFT
const freqs: {
    r: number[];
    g: number[];
    b: number[];
} = { r: [], g: [], b: [] };

let ptIndex: number = 0;
let ptLength: number = 0;

let imageData: ImageData;
let interval: ReturnType<typeof setInterval> | null = null;

function handleEvent(ev: MessageEvent) {
    switch (ev.data.type) {
        case "init": // { curves, image }
            init(ev.data);
            break;

        case "run":
            run();

        case "done":
            self.postMessage({ type: "done", done: !working });
    }
}

function init(data: { curves: curve_save_t[]; image: ImageBitmap }) {
    curves = data.curves.map((x) => load(x));
    active = 0;
    state = state_t.DECURVE;

    const canvas = new OffscreenCanvas(data.image.width, data.image.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(data.image, 0, 0);

    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    working = null;
    ptLength = 0;
    ptIndex = 0;

    series.r.splice(0);
    series.g.splice(0);
    series.b.splice(0);

    freqs.r.splice(0);
    freqs.g.splice(0);
    freqs.b.splice(0);

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

        if (done && interval !== null) {
            clearInterval(interval);
            if (working !== localWorking) return; // Some other process started; Discard results

            // Push data into r/g/b buffers to minimize data transfer
            const r = new Float32Array(freqs.r);
            const g = new Float32Array(freqs.g);
            const b = new Float32Array(freqs.b);

            postMessage(
                {
                    type: "fin",
                    r,
                    g,
                    b,
                },

                // @ts-ignore
                [r, g, b],
            );
            working = null;
        }
    }, 0);
}

/**
 * Run through some number of dft steps before halting
 * @param stop  The time (in ms) to stop
 * @returns     Whether we have finished
 */
function step(stop: number): boolean {
    switch (state) {
        case state_t.DECURVE:
            if (!_step_decurve(stop)) return false;

            state = state_t.DFT;
        // nobreak

        case state_t.DFT:
            return _step_dft(stop);
    }

    // How did you get here!?
    return true;
}

function _step_decurve(stop: number): boolean {
    // Generate points and write to canvas
    for (let i = active; i < curves.length; i++) {
        const curve = curves[i];
        let point: _Complex | null;

        while ((point = curve.next())) {
            const x = point.re();
            const y = point.im();

            // Invalid curve point; Skip!
            if (
                x < 0 ||
                x >= imageData.width ||
                y < 0 ||
                y >= imageData.height
            ) {
                continue;
            }

            const i_base = x + y * imageData.width;
            const i_r = i_base;
            const i_g = i_base + 1;
            const i_b = i_base + 2;

            series.r.push(imageData.data[i_r]);
            series.g.push(imageData.data[i_g]);
            series.b.push(imageData.data[i_b]);
        }

        // Halt!
        if (performance.now() > stop) return false;
    }

    curves.splice(0); // Clear curves; No longer needed
    return true; // Done!
}

function _step_dft(stop: number): boolean {
    console.log(series);

    return true;
}

self.onmessage = handleEvent;
