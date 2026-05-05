import { _Complex, from_cart, from_polar } from "./complex.js";

/**
 * Compute the Discrete Fourier Transform of some series of data
 * @param series    The set of samples to run DFT on
 * @returns         The phase and amplitude output of the the DFT
 */
export function dft(series: number[]): _Complex[] {
    return realias(dft_half(series), series.length % 2 === 0);
}

/**
 * Compute the Discrete Fourier Transform of some series of data
 * This only computes the non-aliased portion of the data
 * @param series    The set of samples to run DFT on
 * @returns         The phase and amplitude output of the the DFT.
 * Note that this will be an array of length `Math.ceil(series.length / 2)` to avoid redundant alias processing
 */
export function dft_half(series: number[]): _Complex[] {
    const freqs = []; // Output frequencies

    const freq_len = Math.ceil(series.length / 2);

    // Compute each frequency's phase/amplitude
    // Each DOF in the series requires a DOF in the output
    for (let k = 0; k <= freq_len; k++) {
        freqs.push(dft_single(series, k));
    }

    return freqs;
}

/**
 * Compute the Discrete Fourier Transform of some series of data
 * This only computes a single frequency bucket, indicated by `k`
 * @param series    The set of samples to run DFT on
 * @param k         The frequency to compute
 * @returns         The phase and amplitude output of the the DFT.
 */
export function dft_single(series: number[], k: number): _Complex {
    // Accumulate summation value
    const accumulator = from_cart(0, 0);

    // Iterate over all entries in the series
    for (let n = 0; n < series.length; n++) {
        // Setup working value with phase shift
        const value = from_polar(1, -(2 * Math.PI * k * n) / series.length);

        // Multiply sries value by the phase shift
        value.mul(series[n]);

        // Add working value to accumulator
        accumulator.add(value);
    }

    return accumulator;
}

/**
 * Add in aliased frequencies to the first half of a computed DFT
 * @param hdft  The computed half-length DFT
 * @param even  The parity of the length of the original data series
 */
export function realias(hdft: _Complex[], even: boolean): _Complex[] {
    const full_len = even ? 2 * hdft.length - 2 : 2 * hdft.length - 1; // Account for overlapping point
    const dft: _Complex[] = [];

    // Fill `dft` with computed complex values
    for (const pt of hdft) {
        dft.push(pt.clone());
    }

    // Account for overlapping points
    if (!even) dft[dft.length - 1].mul(2);

    // Fill `dft` with aliased complex values
    for (let i = hdft.length; i < full_len; i++) {
        dft.push(hdft[full_len - i].clone().conj());
    }

    return dft;
}

/**
 * Compute the original time-domain signal from a half-dft signal
 * @param hdft  The computed half-length DFT
 * @param even  The parity of the length of the original data series
 */
export function dft_invert(hdft: _Complex[], even: boolean): number[] {
    const series: number[] = [];

    const length = even ? 2 * hdft.length - 2 : 2 * hdft.length - 1; // Account for overlapping point
    for (let n = 0; n < length; n++) {
        series.push(dft_invert_single(hdft, even, n));
    }

    return series;
}

/**
 * Compute the Inverse Discrete Fourier Transform of some series of complex numbers
 * This only computes a single time bucket, indicated by `k`
 * @param series    The set of samples to run Inverse DFT on
 * @param even  The parity of the length of the original data series
 * @param n         The time step to compute
 * @returns         The original time-domain signal
 */
export function dft_invert_single(hdft: _Complex[], even: boolean, n: number) {
    let acc = from_cart(0, 0);
    const length = even ? 2 * hdft.length - 2 : 2 * hdft.length - 1; // Account for overlapping point

    for (let k = 0; k < length; k++) {
        // Setup working value with phase shift
        const value = from_polar(1, -(2 * Math.PI * k * n) / length);

        value.mul(k < hdft.length ? hdft[k] : hdft[length - k]);

        acc.add(value);
    }

    return acc.re() / length;
}
