const { dft } = require("../dist/fourier.js");

test("3 * cos(2*pi*t * 2/20)", () => {
    // Generate a single 2Hz frequency with magnitude 3
    // Use `n` points, and ensure point 19 will cleanly lead back to point 0 (clean cyclic)
    // thus avoiding unwanted high-frequency components

    const points = 100;

    const x = [];
    for (let t = 0; t < points; t++) {
        x.push(3 * Math.cos(2 * Math.PI * t * (2 / points)));
    }

    const y = dft(x);

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
