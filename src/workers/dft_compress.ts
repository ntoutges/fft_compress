/**
 * Run DFT on image data
 */

import { _Complex, from_cart } from "../complex.js";
import { _Curve, curve_save_t, load } from "../curve.js";
import { dft_single } from "../fourier.js";

enum state_t {
    DECURVE, // Convert image bitmap into set of 3 R/G/B series
    DFT, // Run DFT on extracted R/G/B series
}

enum dft_state_t {
    R,
    G,
    B,
}

let curves: _Curve[] = [];
let active: number = 0;
let working: symbol | null = null;
let state: state_t = state_t.DECURVE;
let dft_state: dft_state_t = dft_state_t.R;
let downsample: number;

let dft_k: number;

const series: {
    r: number[];
    g: number[];
    b: number[];
} = { r: [], g: [], b: [] };

// Output frequencies from DFT
const freqs: {
    r: _Complex[];
    g: _Complex[];
    b: _Complex[];
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

function init(data: {
    curves: curve_save_t[];
    image: ImageBitmap;
    downsample: number;
}) {
    curves = data.curves.map((x) => load(x));
    active = 0;
    state = state_t.DECURVE;
    dft_state = dft_state_t.R;
    downsample = data.downsample;

    const canvas = new OffscreenCanvas(data.image.width, data.image.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(data.image, 0, 0);

    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    working = null;
    ptLength = 0;
    ptIndex = 0;
    dft_k = 0;

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
        const done = step(performance.now() + 500);

        if (done && interval !== null) {
            clearInterval(interval);
            if (working !== localWorking) return; // Some other process started; Discard results

            // Push data into r/g/b buffers to minimize data transfer
            const rx = new Float32Array(
                freqs.r.map((x) => x.re() / freqs.r.length),
            ).buffer;
            const gx = new Float32Array(
                freqs.g.map((x) => x.re() / freqs.r.length),
            ).buffer;
            const bx = new Float32Array(
                freqs.b.map((x) => x.re() / freqs.r.length),
            ).buffer;
            const ry = new Float32Array(
                freqs.r.map((x) => x.im() / freqs.r.length),
            ).buffer;
            const gy = new Float32Array(
                freqs.g.map((x) => x.im() / freqs.r.length),
            ).buffer;
            const by = new Float32Array(
                freqs.b.map((x) => x.im() / freqs.r.length),
            ).buffer;

            postMessage(
                {
                    type: "fin",
                    rx,
                    ry,
                    gx,
                    gy,
                    bx,
                    by,
                },
                // @ts-ignore
                [rx, gx, ry, gy, bx, by],
            );
            working = null;
        } else {
            self.postMessage({
                type: "progress",
                progress: (dft_k / series.r.length) * 2,
            });
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
    // Generate points
    for (let i = active; i < curves.length; i++) {
        const curve = curves[i];
        let point: _Complex | null;

        while ((point = curve.next())) {
            const x = point.re() * downsample;
            const y = point.im() * downsample;

            // Invalid curve point; Skip!
            if (
                x < 0 ||
                x >= imageData.width ||
                y < 0 ||
                y >= imageData.height
            ) {
                continue;
            }

            const i_base = 4 * (x + y * imageData.width);
            const i_r = i_base;
            const i_g = i_base + 1; // __DEV__
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
    while (dft_k <= series.r.length / 2) {
        switch (dft_state) {
            case dft_state_t.R:
                freqs.r.push(dft_single(series.r, dft_k));
                dft_state = dft_state_t.G;
                break;

            case dft_state_t.G:
                freqs.g.push(dft_single(series.g, dft_k));
                dft_state = dft_state_t.B;
                break;
            case dft_state_t.B:
                freqs.b.push(dft_single(series.b, dft_k));
                dft_state = dft_state_t.R;

                // Done within frequency; Move to next frequency
                dft_k++;
                break;
        }

        // Halt!
        if (performance.now() > stop) return false;
    }

    return true;
}

self.onmessage = handleEvent;
