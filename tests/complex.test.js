const { Complex, from_cart, from_polar } = require("../dist/complex.js");

test("Getters", () => {
    const complex = new Complex(1, 2);

    expect(complex.re()).toBe(1);
    expect(complex.im()).toBe(2);
    expect(complex.abs()).toBe(Math.sqrt(1 ** 2 + 2 ** 2));
    expect(complex.phi()).toBe(Math.atan2(2, 1));
});

test("Setters", () => {
    const complex = new Complex(1, 2);

    complex.re(5);
    complex.im(6);
    expect(complex.re()).toBe(5);
    expect(complex.im()).toBe(6);
});

test("Binary Operations", () => {
    const a = new Complex(1, 2);
    const b = new Complex(3, 4);

    a.add(b);
    expect(a.equals(new Complex(4, 6)));

    b.mul(2);
    expect(b.equals(new Complex(6, 8)));

    a.sub(b);
    expect(a.equals(new Complex(-2, -2)));

    a.add(10);
    expect(a.equals(new Complex(8, -2)));
});

test("Unary Operations", () => {
    const complex = new Complex(1, 2);

    complex.conj();
    expect(complex.equals(new Complex(1, -2))).toBeTruthy();

    complex.neg();
    expect(complex.equals(new Complex(-1, -2))).toBeTruthy();

    complex.conj().neg(); // Undo previous operations
    complex.inv();
    expect(complex.equals(new Complex(0.2, -0.4))).toBeTruthy();
});

test("Move", () => {
    const a = new Complex(1, 2);
    const b = new Complex(0, 0);

    b.copy(a);
    a.add(10);

    expect(a.equals(new Complex(11, 2))).toBeTruthy();
    expect(b.equals(new Complex(1, 2))).toBeTruthy();

    const c = a.clone();
    a.mul(2);

    expect(a.equals(new Complex(22, 4))).toBeTruthy();
    expect(b.equals(new Complex(1, 2))).toBeTruthy();
    expect(c.equals(new Complex(11, 2))).toBeTruthy();
});

test("Utilities", () => {
    const complex = new Complex(1, 2);

    expect(complex.toString()).toEqual("(1 + j2)");

    complex.conj();
    expect(complex.toString()).toEqual("(1 - j2)");

    expect(JSON.stringify(complex.toJSON())).toEqual(
        JSON.stringify({ re: 1, im: -2 }),
    );
});

test("Builders", () => {
    const a = from_cart(10, 20);
    const b = from_polar(5, 0.5 * Math.PI);

    expect(a.equals(new Complex(10, 20)));
    expect(b.equals(new Complex(0, 5)));
});
