"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dft = dft;
const complex_js_1 = require("./complex.js");
/**
 * Compute the Discrete Fourier Transform of some series of data
 * This features no optimizations, and attempts to adhere to the math as closely as possible
 * @param series    The set of samples to run DFT on
 * @returns         The phase and amplitude output of the the DFT
 */
function dft(series) {
    const freqs = []; // Output frequencies
    // Compute each frequency's phase/amplitude
    // Each DOF in the series requires a DOF in the output
    for (let k = 0; k < series.length; k++) {
        // Accumulate summation value
        const accumulator = (0, complex_js_1.from_cart)(0, 0);
        // Iterate over all entries in the series
        for (let n = 0; n < series.length; n++) {
            // Setup working value with phase shift
            const value = (0, complex_js_1.from_polar)(1, -(2 * Math.PI * k * n) / series.length);
            // Multiply sries value by the phase shift
            value.mul(series[n]);
            // Add working value to accumulator
            accumulator.add(value);
        }
        freqs.push(accumulator);
    }
    return freqs;
}
