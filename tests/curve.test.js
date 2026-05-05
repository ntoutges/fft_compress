const {
    CurveH,
    CurveV,
    CurveSnake,
    CurveSpiral,
    load,
    UnCurve,
} = require("./dist/curve.js");

test("UnCurve", () => {
    const curve = new UnCurve();

    expect(curve.length()).toBe(0);
    expect(curve.next() === null).toBe(true);

    // Basic test of saving
    const save = curve.save();
    const ld = load(save);
    expect(ld.length()).toBe(0);
});

test("CurveH", () => {
    const x1 = 0;
    const x2 = 100;
    const y = 2;

    // Fill set with all desired points
    const points = new Set();
    for (let x = x1; x <= x2; x++) {
        points.add(`${x}:${y}`);
    }

    const curve = new CurveH(x1, x2, y);
    expect(curve.length()).toBe(x2 - x1 + 1);

    const MAX = 1000;
    let i, pt;
    for (i = 0; i < MAX && (pt = curve.next()); i++) {
        expect(curve.index()).toBe(i); // Ensure indices work

        // Construct point string
        const point = `${pt.re()}:${pt.im()}`;
        expect(points.has(point)).toBe(true); // Ensure point exists
        points.delete(point); // Mark point as used
    }

    expect(i).toBe(Math.abs(x2 - x1) + 1); // Ensure number of iterations is correct
    expect(curve.index()).toBe(-1); // Ensure index ends properly
    expect(curve.next()).toBe(null);

    // Ensure all points used up
    expect(points.size).toBe(0);

    // Ensure resetting works
    curve.reset();
    expect(curve.next() === null).toBe(false);

    // Basic test of saving
    const save = curve.save();
    const ld = load(save);
    expect(ld.length()).toBe(x2 - x1 + 1);
});

test("CurveV", () => {
    const y1 = 0;
    const y2 = 100;
    const x = 2;

    // Fill set with all desired points
    const points = new Set();
    for (let y = y1; y <= y2; y++) {
        points.add(`${x}:${y}`);
    }

    const curve = new CurveV(x, y1, y2);
    expect(curve.length()).toBe(y2 - y1 + 1);

    const MAX = 1000;
    let i, pt;
    for (i = 0; i < MAX && (pt = curve.next()); i++) {
        expect(curve.index()).toBe(i); // Ensure indices work

        // Construct point string
        const point = `${pt.re()}:${pt.im()}`;
        expect(points.has(point)).toBe(true); // Ensure point exists
        points.delete(point); // Mark point as used
    }

    expect(i).toBe(Math.abs(y2 - y1) + 1); // Ensure number of iterations is correct
    expect(curve.index()).toBe(-1); // Ensure index ends properly
    expect(curve.next()).toBe(null);

    // Ensure all points used up
    expect(points.size).toBe(0);

    // Ensure resetting works
    curve.reset();
    expect(curve.next() === null).toBe(false);

    // Basic test of saving
    const save = curve.save();
    const ld = load(save);
    expect(ld.length()).toBe(y2 - y1 + 1);
});

test("CurveSnake", () => {
    const x1 = 10;
    const x2 = 15;
    const y1 = 2;
    const y2 = 100;

    // Fill set with all desired points
    const points = new Set();
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            points.add(`${x}:${y}`);
        }
    }

    const curve = new CurveSnake(x1, y1, x2, y2);
    expect(curve.length()).toBe((x2 - x1 + 1) * (y2 - y1 + 1));

    const MAX = 1000;
    let i,
        pt,
        old_pt = null;
    for (i = 0; i < MAX && (pt = curve.next()); i++) {
        expect(curve.index()).toBe(i); // Ensure indices work

        // Construct point string
        const point = `${pt.re()}:${pt.im()}`;
        expect(points.has(point)).toBe(true); // Ensure point exists
        points.delete(point); // Mark point as used

        // Ensure old point is within distance of 1 of new point
        if (old_pt != null) {
            expect(old_pt.sub(pt).abs()).toBe(1);
        }

        old_pt = pt;
    }

    expect(i).toBe((Math.abs(y2 - y1) + 1) * (Math.abs(x2 - x1) + 1)); // Ensure number of iterations is correct
    expect(curve.index()).toBe(-1); // Ensure index ends properly
    expect(curve.next()).toBe(null);

    // Ensure all points used up
    expect(points.size).toBe(0);

    // Ensure resetting works
    curve.reset();
    expect(curve.next() === null).toBe(false);

    // Basic test of saving
    const save = curve.save();
    const ld = load(save);
    expect(ld.length()).toBe((x2 - x1 + 1) * (y2 - y1 + 1));
});

test("CurveSpiral", () => {
    const x1 = 0;
    const x2 = 10;
    const y1 = 0;
    const y2 = 10;

    // Fill set with all desired points
    const points = new Set();
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            points.add(`${x}:${y}`);
        }
    }

    const curve = new CurveSpiral(x1, y1, x2, y2);
    expect(curve.length()).toBe((x2 - x1 + 1) * (y2 - y1 + 1));

    const MAX = 1000;
    let i,
        pt,
        old_pt = null;
    for (i = 0; i < MAX && (pt = curve.next()); i++) {
        expect(curve.index()).toBe(i); // Ensure indices work

        // Construct point string
        const point = `${pt.re()}:${pt.im()}`;
        expect(points.has(point)).toBe(true); // Ensure point exists
        points.delete(point); // Mark point as used

        // Ensure old point is within distance of 1 of new point
        if (old_pt != null) {
            expect(old_pt.sub(pt).abs()).toBe(1);
        }

        old_pt = pt;
    }

    expect(i).toBe((Math.abs(y2 - y1) + 1) * (Math.abs(x2 - x1) + 1)); // Ensure number of iterations is correct
    expect(curve.index()).toBe(-1); // Ensure index ends properly
    expect(curve.next()).toBe(null);

    // Ensure all points used up
    expect(points.size).toBe(0);

    // Ensure resetting works
    curve.reset();
    expect(curve.next() === null).toBe(false);

    // Basic test of saving
    const save = curve.save();
    const ld = load(save);
    expect(ld.length()).toBe((x2 - x1 + 1) * (y2 - y1 + 1));
});
