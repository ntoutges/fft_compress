"use strict";
/**
 * @file complex.ts
 * @description Used to perform math easily with complex numbers * @author Nicholas T.  * @copyright 2026 PiCO */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Complex = void 0;
exports.from_cart = from_cart;
exports.from_polar = from_polar;
class Complex {
    _re;
    _im;
    /**
     * Initialize the complex number with real and imaginary components
     * @param re    The initial real component
     * @param im    The initial imaginary component
     */
    constructor(re, im) {
        this._re = re;
        this._im = im;
    }
    re(value) {
        if (value === undefined)
            return this._re; // Getter; Return value
        // Setter: Update value and return self
        this._re = value;
        return this;
    }
    im(value) {
        if (value === undefined)
            return this._im; // Getter; Return value
        // Setter: Update value and return self
        this._im = value;
        return this;
    }
    abs() {
        return Math.sqrt(this._im * this._im + this._re * this._re);
    }
    phi() {
        return Math.atan2(this._im, this._re);
    }
    add(other) {
        // Raw number given
        // Only modify real portion
        if (typeof other === "number") {
            this._re += other;
            return this;
        }
        // Full complex value given
        // Modify both real _and_ complex portions
        this._re += other.re();
        this._im += other.im();
        return this;
    }
    sub(other) {
        // Raw number given
        // Only modify real portion
        if (typeof other === "number") {
            this._re -= other;
            return this;
        }
        // Full complex value given
        // Modify both real _and_ complex portions
        this._re -= other.re();
        this._im -= other.im();
        return this;
    }
    mul(other) {
        // Raw number given
        // Treat as simple scalar
        if (typeof other === "number") {
            this._re *= other;
            this._im *= other;
            return this;
        }
        // Fetch real/imaginary values from other instance
        const other_re = other.re();
        const other_im = other.im();
        // Modify components
        // (a + jb) * (c + jd)
        // ac + j(ad + bc) - bd
        // (ac - bd) + j(ad + bc)
        this._re = this._re * other_re - this._im * other_im;
        this._im = this._re * other_im + this._im * other_re;
        return this;
    }
    div(other) {
        // Raw number given
        // Treat as simple scalar
        if (typeof other === "number") {
            this._re /= other;
            this._im /= other;
            return this;
        }
        // Fetch real/imaginary values from other instance
        const this_re = this._re;
        const this_im = this._im;
        const other_re = other.re();
        const other_im = other.im();
        // Modify components
        // (a + jb) / (c + jd)
        // (a + jb) * (1 / (c + jd))
        // (a + jb) * ((c - jd) / (c**2 - d**2))
        // (ac + j(bc - ad) + bd) / (c**2 - d**2)
        // ((ac + bd) + j(bc - ad)) / (c**2 - d**2)
        const divisor = other_re * other_re + other_im * other_im; // Common divisor shared between both `im` and `re`
        // Comes from inverting `other`
        this._re = this_re * other_re + this_im * other_im;
        this._im = this_im * other_re - this_re * other_im;
        return this;
    }
    neg() {
        this._re = -this._re;
        return this;
    }
    conj() {
        this._im = -this._im;
        return this;
    }
    inv() {
        const re = this._re;
        const im = this._im;
        // 1 / (a + jb)
        // (a - jb) / (a + jb)(a - jb)
        // (a - jb) / (a**2 - b**2)
        const divisor = re * re + im * im; // Common divisor shared between both `im` and `re`
        this._re = re / divisor;
        this._im = -im / divisor;
        return this;
    }
    clone() {
        return new Complex(this._re, this._im);
    }
    copy(c) {
        this._re = c.re();
        this._im = c.im();
    }
    equals(other) {
        return other.re() == this._re && other.im() == this._im;
    }
    toString() {
        const sign = this._im >= 0 ? "+" : "-";
        // Print in format (a +/- bj)
        return `(${this._re} ${sign} j${Math.abs(this._im)})`;
    }
    toJSON() {
        return {
            re: this._re,
            im: this._im,
        };
    }
}
exports.Complex = Complex;
/**
 * Construct a new complex number representing a point on the cartesian coordinate plane
 * @param x The real component of the complex value
 * @param y The imaginary component of the complex value
 * @returns The complex number
 */
function from_cart(x, y) {
    return new Complex(x, y);
}
/**
 * Construct a new complex number representing a point on the polar coordinate plane
 * @param a The distnace from the center of the grid
 * @param y The angle relative to the +x axis, in radians
 * @returns The complex number
 */
function from_polar(a, p) {
    // Calculate x/y from a,p
    const x = a * Math.cos(p);
    const y = a * Math.sin(p);
    return new Complex(x, y);
}
