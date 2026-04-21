import { _Complex, from_cart, from_polar } from "./complex.js";

/**
 * Compute the Discrete Fourier Transform of some series of data
 * This features no optimizations, and attempts to adhere to the math as closely as possible
 * @param series    The set of samples to run DFT on
 * @returns         The phase and amplitude output of the the DFT
 */
export function dft(series: number[]): _Complex[] {
    const freqs = []; // Output frequencies

    // Compute each frequency's phase/amplitude
    // Each DOF in the series requires a DOF in the output
    for (let k = 0; k < series.length; k++) {
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

        freqs.push(accumulator);
    }

    return freqs;
}
