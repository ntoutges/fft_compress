/**
 * @file api.ts
 * @description API to easily interact with data panels
 */

import { _Complex } from "./complex";
import { _Curve, curve_save_t } from "./curve";

// Types of mappings
type map_t = "horizontal" | "vertical" | "snake" | "spiral";

type ui_t = {
    input: ImageBitmap | null;

    map: map_t; // Desired map type
    downsample: number; // Desired downsample value (positive integer)
    quality: number; // Quality factor/threshold (_AFTER_ computation)

    curves: curve_save_t[]; // Curves to render
};

export type full_ui_t = ui_t & {
    // Computed width/height of ui_t
    width: number;
    height: number;
};

type ui_cb_t = (data: full_ui_t, changes: keyof ui_t | "*") => void;

const inputCBs = new Set<ui_cb_t>();
const ui_state: ui_t = {
    input: null,
    map: "horizontal",
    downsample: 1,
    quality: 0,

    curves: [],
};

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

/**
 * Update map information
 * @param output    The info to update the map image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - data: The curve to render
 */
export function updateMap(
    output:
        | { curves: _Curve[]; width: number; height: number }
        | "uninitialized"
        | "loading",
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
            // @ts-ignore
            new URL("./workers/curve_render.ts", import.meta.url),
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
    }
}

/**
 * Update output information
 * @param output    The info to update the output image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - data: The raw data to show the user
 */
export function updateOutput(output: Blob | "uninitialized" | "loading") {
    update("output", output);
}

/**
 * Update diff information
 * @param output    The info to update the diff image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - data: The raw data to show the user
 */
export function updateDiff(output: Blob | "uninitialized" | "loading") {
    update("diff", output);
}

/**
 * Update image panel information
 * @param output    The info to update the image
 * - "uninitialized": Indicate that input is not yet ready
 * - "loading": Indicate that data is still processing
 * - data: The raw data to show the user
 */
function update(
    panel: "output" | "diff" | "map",
    output: Blob | URL | "uninitialized" | "loading",
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
        output !== "loading",
    );

    if (typeof output === "string") return; // Ignore output

    const img = root.querySelector<HTMLImageElement>(".preview");
    if (!img) {
        console.warn(
            `Unable to find output image element #panel-${panel} .preview`,
        );
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

    fileSel.addEventListener("change", ctrlChange.bind(null, "input", true));
    mapSel.addEventListener("change", ctrlChange.bind(null, "map", true));
    sampleSel.addEventListener(
        "change",
        ctrlChange.bind(null, "downsample", true),
    );
    qualitySel.addEventListener(
        "change",
        ctrlChange.bind(null, "quality", true),
    );

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
        ctrlChange("input", true);
    });

    // Initialize input state
    ctrlChange("input", false);
    ctrlChange("map", false);
    ctrlChange("downsample", false);
    ctrlChange("quality", false);
}

let ctrlToken: symbol | null = null;
function ctrlChange(mode: keyof ui_t, updateListeners: boolean) {
    const currTok = Symbol();
    ctrlToken = currTok;

    switch (mode) {
        case "input": {
            const file = fileSel.files?.[0];
            if (file && file.type.startsWith("image/")) {
                const doUpdate = updateListeners;
                updateListeners = false; // Inhibit update

                createImageBitmap(file)
                    .then((bitmap) => {
                        if (currTok !== ctrlToken) return; // Invalidated!

                        ui_state.input = bitmap;
                        if (doUpdate) {
                            doUpdateListeners(mode);
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
    }

    if (updateListeners) {
        doUpdateListeners(mode);
    }
}

function doUpdateListeners(mode: keyof ui_t | "*") {
    const fullState: full_ui_t = {
        ...structuredClone(ui_state),
        width: Math.ceil((ui_state.input?.width ?? 0) / ui_state.downsample),
        height: Math.ceil((ui_state.input?.height ?? 0) / ui_state.downsample),
    };

    for (const cb of inputCBs) {
        cb(structuredClone(fullState), mode);
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

main();
