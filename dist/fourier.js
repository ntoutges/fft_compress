"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dft = dft;
exports.dft_half = dft_half;
exports.realias = realias;
const complex_js_1 = require("./complex.js");
/**
 * Compute the Discrete Fourier Transform of some series of data
 * @param series    The set of samples to run DFT on
 * @returns         The phase and amplitude output of the the DFT
 */
function dft(series) {
    return realias(dft_half(series), series.length % 2 === 0);
}
/**
 * Compute the Discrete Fourier Transform of some series of data
 * This only computes the non-aliased portion of the data
 * @param series    The set of samples to run DFT on
 * @returns         The phase and amplitude output of the the DFT.
 * Note that this will be an array of length `Math.ceil(series.length / 2)` to avoid redundant alias processing
 */
function dft_half(series) {
    const freqs = []; // Output frequencies
    const freq_len = Math.ceil(series.length / 2);
    // Compute each frequency's phase/amplitude
    // Each DOF in the series requires a DOF in the output
    for (let k = 0; k <= freq_len; k++) {
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
/**
 * Add in aliased frequencies to the first half of a computed DFT
 * @param hdft  The computed half-length DFT
 * @param even  The parity of the length of the original data series
 */
function realias(hdft, even) {
    const full_len = even ? 2 * hdft.length - 2 : 2 * hdft.length - 1; // Account for overlapping point
    const dft = [];
    // Fill `dft` with computed complex values
    for (const pt of hdft) {
        dft.push(pt.clone());
    }
    // Account for overlapping points
    if (!even)
        dft[dft.length - 1].mul(2);
    // Fill `dft` with aliased complex values
    for (let i = hdft.length; i < full_len; i++) {
        dft.push(hdft[full_len - i].clone().conj());
    }
    return dft;
}
