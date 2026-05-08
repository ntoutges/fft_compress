/**
 * @file api.ts
 * @description API to easily interact with data panels
 */

import { _Complex, from_cart } from "../src/complex";
import { _Curve, curve_save_t } from "../src/curve";

// Types of mappings
type map_t = "horizontal" | "vertical" | "snake" | "spiral";

export type ui_t = {
    input: ImageBitmap | null;

    map: map_t; // Desired map type
    downsample: number; // Desired downsample value (positive integer)
    quality: number; // Quality factor/threshold (_AFTER_ computation)

    curves: curve_save_t[]; // Curves to render

    dft: {
        r: _Complex[];
        g: _Complex[];
        b: _Complex[];
    } | null;

    // Length from `dft` list of elements to use
    dft_cutoff: {
        r: number;
        g: number;
        b: number;
    } | null;

    artifact: {
        compressed: ReturnType<ui_comp_t>;
        decompressed: ReturnType<ui_decomp_t>;
    } | null;

    output: ImageBitmap | null;
};

export type full_ui_t = ui_t & {
    // Computed width/height of ui_t
    width: number;
    height: number;
};

export type decompress_t = {
    width: number;
    height: number;
    dft: {
        r: _Complex[];
        g: _Complex[];
        b: _Complex[];
    };
};

type ui_cb_t = (data: full_ui_t, changes: keyof ui_t | "*") => void;
type ui_comp_t = (data: full_ui_t) => ArrayBuffer;
type ui_decomp_t = (data: ArrayBuffer) => decompress_t;

const inputCBs = new Set<ui_cb_t>();
const ui_state: ui_t = {
    input: null,
    map: "horizontal",
    downsample: 1,
    quality: 0,

    curves: [],
    dft: null,
    dft_cutoff: null,

    artifact: null,
    output: null,
};

let compressor: ui_comp_t | null = null;
let decompressor: ui_decomp_t | null = null;

/**
 * Subscribe to user interactions
 * @param cb    The callback function called on UI changes
 * - data: The UI input data state
 * - changes: The type of change
 */
export function onInput(cb: ui_cb_t): void {
    inputCBs.add(cb);

    // Trigger with initial state
    doUpdateListeners("*");
}

/**
 * Unsubscribe from user interactions
 * @param cb    The callback function called on UI changes
 * @returns     Whether the callback was removed
 */
export function offInput(cb: ui_cb_t): boolean {
    return inputCBs.delete(cb);
}

// Map from (x,y) index to number
const mapping = new Map<number, Map<number, number>>();
let mapWorker: Worker | null = null;

type loading = `loading${"" | `:${number}`}`;

/**
 * Update map information
 * @param output    The info to update the map image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading:<>": Indicate that data is still processing
 * - data: The curve to render
 */
export function updateMap(
    output:
        | { curves: _Curve[]; width: number; height: number }
        | "uninitialized"
        | loading,
) {
    if (typeof output === "string") {
        update("map", output);

        // Stop map worker
        if (mapWorker) {
            mapWorker.terminate();
            mapWorker = null;
        }
        ui_state.curves.splice(0);
        return;
    }

    // Indicate loading while we wait
    update("map", "loading");

    // Create new worker
    if (!mapWorker) {
        mapWorker = new Worker(
            new URL("../src/workers/curve_render.ts", import.meta.url),
            {
                type: "module",
            },
        );

        mapWorker.onmessage = onMapMessage;
    }

    ui_state.curves = output.curves.map((x) => x.save());

    // Halt current worker
    mapWorker.postMessage({
        type: "init",
        curves: ui_state.curves,
        width: output.width,
        height: output.height,
    });
    mapWorker.postMessage({ type: "run" });

    // Indicate that curves updated
    doUpdateListeners("curves");
}

function onMapMessage(ev: MessageEvent) {
    switch (ev.data.type) {
        case "fin":
            const bmp = ev.data.bmp as ImageBitmap;

            const canvas = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(bmp, 0, 0);

            canvas.convertToBlob().then((blob) => {
                update("map", blob);
            });

            mapWorker?.terminate();
            mapWorker = null;
            break;

        case "progress":
            update("map", `loading:${ev.data.progress}`);
            break;
    }
}

/**
 * Update output information
 * @param output    The info to update the output image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - data: The raw data to show the user
 */
export function updateOutput(output: Blob | "uninitialized" | loading) {
    update("output", output);
}

/**
 * Update diff information
 * @param output    The info to update the diff image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - data: The raw data to show the user
 */
export function updateDiff(output: Blob | "uninitialized" | loading) {
    update("diff", output);
}

/**
 * Update image panel information
 * @param output    The info to update the image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - "ready": Hide loading indicators, but don't attempt to modify any image preview
 * - data: The raw data to show the user
 */
function update(
    panel: "output" | "diff" | "map" | "data",
    output: Blob | URL | "uninitialized" | loading | "ready",
) {
    const root = document.getElementById(`panel-${panel}`);
    if (!root) {
        console.warn(`Unable to find root element #panel-${panel}`);
        return;
    }

    root.querySelector(".empty")?.classList.toggle(
        "hidden",
        output !== "uninitialized",
    );
    root.querySelector(".loading")?.classList.toggle(
        "hidden",
        typeof output !== "string" || !output.startsWith("loading"),
    );

    if (typeof output === "string") {
        if (output.startsWith("loading")) {
            let progress = parseFloat(output.split(":")[1] ?? "0");
            if (isNaN(progress)) progress = 0;

            const circle = root.querySelector(
                ".progress-bar",
            ) as SVGCircleElement;
            const text = root.querySelector(".progress-text") as HTMLElement;

            // Clamp to [0, 1]
            const p = Math.max(0, Math.min(1, progress));

            const radius = 42;
            const circumference = 2 * Math.PI * radius;

            // Update ring
            const offset = circumference * (1 - p);
            circle.style.strokeDashoffset = `${offset}`;

            // Update text
            text.textContent = `${Math.round(p * 100)}%`;
        }

        return; // Ignore output
    }

    const img = root.querySelector<HTMLImageElement>(".preview");
    if (!img) {
        return;
    }

    // Prevent memory leaks
    if (img.dataset.old_url) {
        URL.revokeObjectURL(img.dataset.old_url);
    }

    const url =
        output instanceof URL ? output.toString() : URL.createObjectURL(output);
    img.src = url;
    img.dataset.old_url = url;
}

let fileSel: HTMLInputElement;
let mapSel: HTMLInputElement;
let sampleSel: HTMLInputElement;
let qualitySel: HTMLInputElement;
let dftCanvas: HTMLCanvasElement;

/**
 * Setup event listeners
 */
function main() {
    fileSel = document.getElementById("panel-source-input") as HTMLInputElement;
    mapSel = document.getElementById(
        "panel-controls-map-sel",
    ) as HTMLInputElement;
    sampleSel = document.getElementById(
        "panel-controls-sample-sel",
    ) as HTMLInputElement;
    qualitySel = document.getElementById(
        "panel-controls-threshold-sel",
    ) as HTMLInputElement;

    fileSel.addEventListener("change", ctrlChange.bind(null, "input:+", true));
    mapSel.addEventListener("change", ctrlChange.bind(null, "map", true));
    sampleSel.addEventListener(
        "change",
        ctrlChange.bind(null, "downsample", true),
    );
    qualitySel.addEventListener(
        "change",
        ctrlChange.bind(null, "quality", true),
    );
    dftCanvas = document.getElementById(
        "panel-dft-canvas",
    ) as HTMLCanvasElement;

    // Don't update to allow for immediate fedback
    qualitySel.addEventListener(
        "input",
        ctrlChange.bind(null, "quality", false),
    );

    const sourcePanel = document.getElementById("panel-source")!;

    // Allow drag/drop
    sourcePanel.addEventListener("dragover", (e) => {
        e.preventDefault();
        document
            .getElementById("panel-source-drop")
            ?.classList.add("droppable");
    });
    sourcePanel.addEventListener("dragleave", (e) => {
        document
            .getElementById("panel-source-drop")
            ?.classList.remove("droppable");
    });
    sourcePanel.addEventListener("drop", (e) => {
        e.preventDefault();
        document
            .getElementById("panel-source-drop")
            ?.classList.remove("droppable");

        fileSel.files = e.dataTransfer?.files ?? null;
        ctrlChange("input:+", true);
    });

    // Allow hovering over data panel canvas
    dftCanvas.addEventListener("pointermove", handleDFTMove);

    // Initialize input state
    ctrlChange("input:+", false);
    ctrlChange("map", false);
    ctrlChange("downsample", false);
    ctrlChange("quality", false);

    // Register internal event listeners
    onInput((state, change) => {
        if (change === "*" || change === "curves" || change === "input")
            updateDFT();

        if (change === "*" || change === "dft" || change === "quality")
            updateDFTCutoffs();

        if (
            change === "*" ||
            change === "downsample" ||
            change === "dft_cutoff"
        )
            performCompression();

        if (change === "*" || change === "artifact") computeOutput();
        if (change === "*" || change === "output") computeDiff();
    });
}

let inputImageToken: symbol | null = null;

/**
 * Update the input image based on some URL
 * @param src
 */
export function uploadInput(src: URL) {
    const img = new Image();

    // Important if the image is from another origin
    img.crossOrigin = "anonymous";
    const localTok = Symbol();
    inputImageToken = localTok;

    img.onload = async () => {
        try {
            if ("decode" in img) {
                await img.decode();
            }

            if (inputImageToken !== localTok) return;

            // Draw to canvas
            const canvas = new OffscreenCanvas(
                img.naturalWidth,
                img.naturalHeight,
            );
            const ctx = canvas.getContext("2d")!;

            ctx.drawImage(img, 0, 0);

            // Convert to ImageBitmap
            const bitmap = await createImageBitmap(canvas);

            // Overwritten
            if (inputImageToken !== localTok) return;
            inputImageToken = null;

            ui_state.input = bitmap;
            setTimeout(() => {
                ctrlChange("input", true);
            });
        } catch (err) {
            console.error("Failed to convert image to bitmap");
        }
    };

    img.onerror = () => {
        console.error("Invalid iamge data");
    };

    img.src = src.href;
}

let ctrlToken: symbol | null = null;
function ctrlChange(
    mode: `${keyof ui_t}${"" | `:${string}`}`,
    updateListeners: boolean,
) {
    const currTok = Symbol();
    ctrlToken = currTok;

    const uiMode = mode.split(":")[0] as keyof ui_t;

    switch (mode) {
        case "input:+": {
            inputImageToken = currTok;
            const file = fileSel.files?.[0];
            if (file && file.type.startsWith("image/")) {
                const doUpdate = updateListeners;
                updateListeners = false; // Inhibit update

                createImageBitmap(file)
                    .then((bitmap) => {
                        if (currTok !== ctrlToken) return; // Invalidated!

                        ui_state.input = bitmap;
                        if (doUpdate) {
                            doUpdateListeners(uiMode);
                        }
                    })
                    .catch((err) => {
                        if (currTok !== ctrlToken) return; // Invalidated!
                        if (ui_state.input === null) return; // No difference!

                        ui_state.input = null;
                    })
                    .finally(() => {
                        updateInputPreview();
                    });
            } else {
                // No/invalid file
                ui_state.input = null;
                updateInputPreview();
            }
            break;
        }
        case "input":
            updateInputPreview();
            break;

        case "map":
            ui_state.map = mapSel.value as ui_t["map"];
            break;
        case "downsample":
            ui_state.downsample = +sampleSel.value;

            // Reset if invalid
            if (isNaN(ui_state.downsample)) {
                ui_state.downsample = 1;
                sampleSel.value = "1";
            }
            break;

        case "quality":
            // TODO: IMPLEMENT MAPPING FN
            ui_state.quality = qualitySel.valueAsNumber;

            // Update label with value
            document.getElementById(
                "panel-controls-threshold-value",
            )!.innerText = `${(ui_state.quality * 100).toFixed(0)}%`;

            break;

        case "dft":
            updateDFTPlot();
            break;
    }

    if (updateListeners) {
        doUpdateListeners(uiMode);
    }
}

function doUpdateListeners(mode: keyof ui_t | "*") {
    const fullState: full_ui_t = {
        ...ui_state,
        width: Math.ceil((ui_state.input?.width ?? 0) / ui_state.downsample),
        height: Math.ceil((ui_state.input?.height ?? 0) / ui_state.downsample),
    };

    for (const cb of inputCBs) {
        cb(fullState, mode);
    }
}

let inputTok: symbol | null = null;
function updateInputPreview() {
    const currTok = Symbol();
    inputTok = currTok;

    const preview = document.getElementById(
        "panel-source-preview",
    ) as HTMLImageElement;
    if (!preview) return;

    if (preview) {
        if (preview.dataset.old_url) {
            URL.revokeObjectURL(preview.dataset.old_url);
        }

        // No image available
        if (ui_state.input === null) {
            preview.src = "";
            preview.dataset.old_url = "";
            return;
        }

        const canvas = new OffscreenCanvas(
            ui_state.input.width,
            ui_state.input.height,
        );
        const ctx = canvas.getContext("2d")!;

        ctx.drawImage(ui_state.input, 0, 0);

        canvas.convertToBlob().then((blob) => {
            if (currTok !== inputTok) return; // Invalidated

            // Show new preview
            const url = URL.createObjectURL(blob);
            preview.src = url;
            preview.dataset.old_url = url;
        });
    }
}

let dftWorker: Worker | null = null;

function updateDFT() {
    update("data", "loading");

    // Clear out dft data
    ui_state.dft = null;
    ctrlChange("dft", true);

    // Stop map worker
    if (dftWorker) {
        dftWorker.terminate();
        dftWorker = null;
    }

    // No work to do!
    if (!ui_state.curves || !ui_state.input) return;

    // Create new worker
    dftWorker = new Worker(
        new URL("../src/workers/dft_compress.ts", import.meta.url),
        {
            type: "module",
        },
    );

    // Start worker funning DFT
    dftWorker.postMessage({
        type: "init",
        curves: ui_state.curves,
        image: ui_state.input,
        downsample: ui_state.downsample,
    });
    dftWorker.postMessage({
        type: "run",
    });

    // Listen for worker to finish
    dftWorker.onmessage = onDFTMessage;
}

function onDFTMessage(ev: MessageEvent) {
    switch (ev.data.type) {
        case "fin": {
            // Decode DFT info from message
            const rx = new Float32Array(ev.data.rx);
            const ry = new Float32Array(ev.data.ry);
            const gx = new Float32Array(ev.data.gx);
            const gy = new Float32Array(ev.data.gy);
            const bx = new Float32Array(ev.data.bx);
            const by = new Float32Array(ev.data.by);

            const r: _Complex[] = [];
            const g: _Complex[] = [];
            const b: _Complex[] = [];

            // Convert from dual arrays of x/y to complex values
            for (const i in rx) {
                r.push(from_cart(rx[i], ry[i] ?? 0));
                g.push(from_cart(gx[i] ?? 0, gy[i] ?? 0));
                b.push(from_cart(bx[i] ?? 0, by[i] ?? 0));
            }

            ui_state.dft = {
                r,
                g,
                b,
            };

            // Indicate that DFT value has both been computed and set
            ctrlChange("dft", true);
            break;
        }

        case "progress":
            update("data", `loading:${ev.data.progress}`);
            break;
    }
}

function updateDFTCutoffs() {
    if (ui_state.dft === null) {
        ui_state.dft_cutoff = null;
        ctrlChange("dft_cutoff", true);
        return;
    }

    // Transform values into a more understandable space
    const transform = (x: number): number => {
        return x < 1 ? 0 : Math.log(x);
    };

    // Use quality slider to determine max freq + min amplitude
    // This will determine cutoff frequencies

    const min_amp_thresh = 0.05;
    const max_amp_thresh = 1;

    const min_freq_thresh = 0.2;
    const max_freq_thresh = 1;

    // Normalized amplitude threshold relative to maximum amplitude value
    const amp_threshn =
        min_amp_thresh + ui_state.quality * (max_amp_thresh - min_amp_thresh);

    // Normalized frequency threshold relative to maximum frequency
    const freq_threshn =
        min_freq_thresh +
        ui_state.quality * (max_freq_thresh - min_freq_thresh);

    ui_state.dft_cutoff = { r: 0, g: 0, b: 0 };

    // Get maximum value, per-axis
    let max_amp: Record<keyof typeof ui_state.dft, number> = {
        r: 0,
        g: 0,
        b: 0,
    };
    for (const [c, component] of Object.entries(ui_state.dft)) {
        for (const val of component) {
            max_amp[c as keyof typeof max_amp] = Math.max(
                max_amp[c as keyof typeof max_amp],
                transform(val.abs()),
            );
        }
    }

    // Search for first element below amplitude threshold with no following element above threshold
    for (const component in ui_state.dft_cutoff) {
        const amp_thresh =
            (1 - amp_threshn) * max_amp[component as keyof typeof max_amp];

        const axis = ui_state.dft[component as keyof typeof ui_state.dft];
        for (let i = axis.length - 1; i >= 0; i--) {
            // Found first non-threshold-removed value
            if (transform(axis[i].abs()) >= amp_thresh) {
                ui_state.dft_cutoff[
                    component as keyof typeof ui_state.dft_cutoff
                ] = i + 1;
                break;
            }
        }
    }

    // Remove any elements below `freq_threshn`
    for (const c in ui_state.dft_cutoff) {
        const component = c as keyof typeof ui_state.dft_cutoff;
        const max_freq = ui_state.dft[component].length - 1;

        const thresh_freq = Math.round(max_freq * freq_threshn);

        // max_amp[component] = Math.min(max_amp[component], thresh_freq);
        ui_state.dft_cutoff[component] = thresh_freq;
    }

    ctrlChange("dft_cutoff", true);
}

function updateDFTPlot() {
    const ctx = dftCanvas.getContext("2d")!;

    // Clear canvas
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, dftCanvas.width, dftCanvas.height);

    // Render iff data available
    if (!ui_state.dft) return;

    // Update canvas dimensions
    const bounds = dftCanvas.getBoundingClientRect();
    dftCanvas.width = bounds.width;
    dftCanvas.height = bounds.height;

    // Transform values into a more understandable space
    const transform = (x: number): number => {
        return x < 1 ? 0 : Math.log(x);
    };

    // Get max amplitude of all r/g/b components for proper scaling
    let max_amp: number = 0;
    for (const [_, component] of Object.entries(ui_state.dft)) {
        for (const value of component) {
            max_amp = Math.max(max_amp, transform(value.abs()));
        }
    }

    // Determine useful attributes for FFT
    const bar_width = 0.8; // Percent of area allocated to bar (slot) to use to actually render bar
    const slot_width = dftCanvas.width / ui_state.dft.r.length; // Assume lengths of all ui_state.dft.<x> are the same
    const slot_height = dftCanvas.height / max_amp; // Convert from arbitrary DFT output units to canvas pixels

    // Size of buckets
    // Use if bar_width * slot_width gets to be too small
    const min_bucket = 2;
    let bucket_size =
        bar_width * slot_width >= min_bucket
            ? 1
            : Math.ceil(min_bucket / (bar_width * slot_width));

    // --- Plot amplitudes onto graph ---

    // Allow R/G/B compoennts to add
    ctx.globalCompositeOperation = "lighter";

    loop: for (const [c, component] of Object.entries(ui_state.dft)) {
        // Determine fill color based on component
        switch (c) {
            case "r":
                ctx.fillStyle = "#FF0000";
                break;
            case "g":
                ctx.fillStyle = "#00FF00";
                break;
            case "b":
                ctx.fillStyle = "#0000FF";
                break;

            // How did you get here!? Skip!
            default:
                continue loop;
        }

        // for (const [i, v] of component.entries()) {
        for (let i = 0; i < component.length; i += bucket_size) {
            // Get total within bucket

            let v = 0;
            let c = 0;
            for (let j = 0; j < bucket_size; j++) {
                if (i + j >= component.length) break;

                v += component[i + j].abs();
                c++;
            }

            const value = transform(v / c);
            const height = value * slot_height - 5;

            ctx.fillRect(
                (i + (bucket_size * (1 - bar_width)) / 2) * slot_width,
                dftCanvas.height - height,
                bar_width * slot_width * bucket_size,
                height,
            );
        }
    }

    update("data", "ready");
}

let compressTok: symbol | null = null;
function performCompression() {
    const oSizeEl = document.getElementById("data-original")!;
    const nSizeEl = document.getElementById("data-new")!;
    const compressionEl = document.getElementById("data-ratio")!;

    // Assume 4-byte dimensions + 24-bit raw bitmap
    // Account for downsampling
    const oldSize =
        (ui_state.input
            ? 4 +
              (ui_state.input.width * ui_state.input.height) /
                  ui_state.downsample ** 2
            : 0) * 3;

    // Prepare artifact
    let change = ui_state.artifact !== null;
    ui_state.artifact = null;

    if (compressor && decompressor) {
        try {
            // Attempt to compress
            const compressed =
                compressor({
                    ...ui_state,
                    width: Math.ceil(
                        (ui_state.input?.width ?? 0) / ui_state.downsample,
                    ),
                    height: Math.ceil(
                        (ui_state.input?.height ?? 0) / ui_state.downsample,
                    ),
                }) ?? null;

            // Only attempt to decomperss if didn't fail to compress
            if (compressed !== null && compressed.byteLength !== 0) {
                const decompressed = decompressor(compressed) ?? null;
                if (decompressed.width !== 0 && decompressed.height !== 0) {
                    ui_state.artifact = {
                        compressed,
                        decompressed,
                    };
                    change = true;
                }
                // // __DEV__
                // ui_state.artifact = {
                //     compressed,
                //     decompressed: {
                //         width: ui_state.input!.width,
                //         height: ui_state.input!.height,
                //         dft: {
                //             r: ui_state.dft!.r,
                //             g: ui_state.dft!.g,
                //             b: ui_state.dft!.b,
                //         },
                //     },
                // };

                change = true;
            }
        } catch (err) {
            console.error("Failed to decomperss", err);
        }
    }

    if (change) {
        const localTok = Symbol();
        compressTok = localTok;
        setTimeout(() => {
            if (localTok !== compressTok) return;
            compressTok = null;

            ctrlChange("artifact", true);
        });
    }

    // Perform compression/decompression step

    const newSize = ui_state.artifact?.compressed.byteLength ?? 0;

    // Render new/old size
    oSizeEl.textContent = oldSize ? formatSize(oldSize) : "-";
    nSizeEl.textContent = newSize ? formatSize(newSize) : "-";
    compressionEl.textContent =
        newSize && oldSize ? `${((oldSize / newSize) * 100).toFixed(1)}%` : "-";
}

/**
 * Format size in human-readable chunks (B, KiB, MiB, GiB, ...)
 * @param bytes
 */
function formatSize(bytes: number) {
    const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];

    const unitIndex = Math.min(
        Math.max(Math.floor(Math.log10(bytes) / 3), 0),
        units.length - 1,
    );

    const numeric = Math.round((bytes / Math.pow(10, unitIndex * 3)) * 10) / 10;
    const unit = units[unitIndex];

    return `${numeric} ${unit}`;
}

function handleDFTMove(event: PointerEvent) {
    const bounds = dftCanvas.getBoundingClientRect();

    // Get `x` in normalized canvas coordinates
    const x = (event.pageX - bounds.x) / bounds.width;

    const coords = document.getElementById("panel-dft-coords")!;
    const amp = document.getElementById("panel-dft-amp")!;

    // Invalid DFT
    if (ui_state.dft === null) {
        coords.textContent = `(/ Hz)`;
        amp.textContent = "/";
        return;
    }

    const slot_width = 1 / ui_state.dft.r.length;
    const slot_index = Math.min(
        Math.max(Math.floor(x / slot_width), 0),
        ui_state.dft.r.length - 1,
    );

    const r =
        Math.round(
            (ui_state.dft.r[slot_index].abs() / ui_state.dft.r.length) * 100,
        ) / 100;
    const g =
        Math.round(
            (ui_state.dft.g[slot_index].abs() / ui_state.dft.r.length) * 100,
        ) / 100;
    const b =
        Math.round(
            (ui_state.dft.b[slot_index].abs() / ui_state.dft.r.length) * 100,
        ) / 100;

    coords.textContent = `(${slot_index} Hz)`;
    amp.textContent = `${r}\n${g}\n${b}`;
}

export function registerCompression(
    compress: ui_comp_t,
    decompress: ui_decomp_t,
) {
    compressor = compress;
    decompressor = decompress;
}

let outputWorker: Worker | null = null;
function computeOutput() {
    updateOutput("loading");

    // Clear out dft data
    ui_state.output = null;
    ctrlChange("output", true);

    // Stop map worker
    if (outputWorker) {
        outputWorker.terminate();
        outputWorker = null;
    }

    // No work to do!
    if (!ui_state.artifact) return;

    // Create new worker
    outputWorker = new Worker(
        new URL("../src/workers/dft_uncompress.ts", import.meta.url),
        {
            type: "module",
        },
    );

    // Generate (r/g/b)(x/y) buffers from artifact
    const rx = new Float32Array(
        ui_state.artifact.decompressed.dft.r.map((x) => x.re()),
    ).buffer;
    const gx = new Float32Array(
        ui_state.artifact.decompressed.dft.g.map((x) => x.re()),
    ).buffer;
    const bx = new Float32Array(
        ui_state.artifact.decompressed.dft.b.map((x) => x.re()),
    ).buffer;
    const ry = new Float32Array(
        ui_state.artifact.decompressed.dft.r.map((x) => x.im()),
    ).buffer;
    const gy = new Float32Array(
        ui_state.artifact.decompressed.dft.g.map((x) => x.im()),
    ).buffer;
    const by = new Float32Array(
        ui_state.artifact.decompressed.dft.b.map((x) => x.im()),
    ).buffer;

    // Start worker funning DFT
    outputWorker.postMessage(
        {
            type: "init",
            curves: ui_state.curves,
            width: ui_state.artifact.decompressed.width,
            height: ui_state.artifact.decompressed.height,
            freqs: {
                rx,
                gx,
                bx,
                ry,
                gy,
                by,
            },
        },
        [rx, gx, bx, ry, gy, by],
    );
    outputWorker.postMessage({
        type: "run",
    });

    // Listen for worker to finish
    outputWorker.onmessage = onOutputMessage;
}

function onOutputMessage(ev: MessageEvent) {
    switch (ev.data.type) {
        case "fin":
            const bmp = ev.data.bmp as ImageBitmap;

            const canvas = new OffscreenCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(bmp, 0, 0);

            canvas.convertToBlob().then((blob) => {
                update("output", blob);
            });

            outputWorker?.terminate();
            outputWorker = null;

            ui_state.output = canvas.transferToImageBitmap();
            ctrlChange("output", true);
            break;

        case "progress": {
            update("output", `loading:${ev.data.progress}`);
            break;
        }
    }
}

function computeDiff() {
    updateDiff("loading");
    if (ui_state.output === null || ui_state.input === null) return;

    // Generate diff using canvas manipulation
    const canvas = new OffscreenCanvas(
        ui_state.input.width,
        ui_state.input.height,
    );
    const ctx = canvas.getContext("2d")!;

    // Draw base image
    ctx.drawImage(
        ui_state.input,
        0,
        0,
        ui_state.input.width,
        ui_state.input.height,
    );

    // Subtract output from base image
    ctx.globalCompositeOperation = "difference";
    ctx.drawImage(
        ui_state.output,
        0,
        0,
        ui_state.input.width,
        ui_state.input.height,
    );

    // Convert to (then render) blob
    canvas.convertToBlob().then((blob) => {
        update("diff", blob);
    });
}

main();
