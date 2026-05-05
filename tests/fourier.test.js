const { dft, dft_half, dft_invert } = require("./dist/fourier.js");

test("3 * cos(2*pi*t * 2/20)", () => {
    // Generate a single 2Hz frequency with magnitude 3
    // Use `n` points, and ensure point 19 will cleanly lead back to point 0 (clean cyclic)
    // thus avoiding unwanted high-frequency components

    const points = 100;

    const x = [];
    for (let t = 0; t < points; t++) {
        x.push(3 * Math.cos(2 * Math.PI * t * (2 / points)));
    }

    console.time("DFT");
    const y = dft(x);
    console.time("FFT");

    expect(y.length).toBe(points);

    for (const i in y) {
        // Ensure all but 2Hz frequency (and alias) are ~0
        if (i != 2 && i != y.length - 2) {
            expect(3 * y[i].abs()).toBeCloseTo(0);
            continue;
        }

        expect(y[i].clone().div(y.length).abs()).toBeCloseTo(
            y.length == 4 ? 3 : 3 / 2,
        );
    }
});

test("Inverse DFT", () => {
    const points = 10;

    const x = [];
    for (let t = 0; t < points; t++) {
        x.push(1 * Math.cos((2 * Math.PI * t) / points));
    }

    // Create DFT
    const y = dft_half(x);
    expect(y.length).toBe(Math.ceil(points / 2) + 1);

    // Inverse DFT
    const x2 = dft_invert(y, points % 2 === 0);
    expect(x2.length).toBe(x.length);

    // Ensure values match up
    for (let i = 0; i < x.length; i++) {
        expect(x2[i]).toBeCloseTo(x[i]);
    }
});
