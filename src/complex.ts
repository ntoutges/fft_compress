/**
 * @file complex.ts
 * @description Used to perform math easily with complex numbers * @author Nicholas T.  * @copyright 2026 PiCO */

export interface _Complex {
    // +---------------------+
    // | GETTERS AND SETTERS |
    // +---------------------+

    /**
     * Set the real portion of the complex number
     * @param value The real portion to set
     * @returns This object instance for operator chaining
     */
    re(value: number): _Complex;

    /**
     * Get the real portion of the complex number
     */
    re(): number;

    /**
     * Set the imaginary portion of the complex number
     * @param value The imaginary portion to set
     * @returns This object instance for operator chaining
     */
    im(value: number): _Complex;

    /**
     * Get the imaginary portion of the complex number
     */
    im(): number;

    /**
     * Get the length of this complex number as a vector
     * This value is garunteed to be non-negative
     */
    abs(): number;

    /**
     * Get the angle of this complex number (in rads) as a vector, clockwise, from the +X axis
     * This is a value in the range [-PI/2, PI/2]
     */
    phi(): number;

    // +-------+
    // | MATHS |
    // +-------+

    /**
     * Add some value to this complex number, modifying this object IN PLACE
     * @param other The other value to add
     * @returns This instance for operator chaining
     */
    add(other: _Complex | number): _Complex;

    /**
     * Subtract some value from this complex number, modifying this object IN PLACE
     * @param other The other value to subtract
     * @returns This instance for operator chaining
     */
    sub(other: _Complex | number): _Complex;

    /**
     * Multiply some value by this complex number, modifying this object IN PLACE
     * @param other The other value to multiply
     * @returns This instance for operator chaining
     */
    mul(other: _Complex | number): _Complex;

    /**
     * Divide this complex number by some value, modifying this object IN PLACE
     * @param other The other value to divide by
     * @returns This instance for operator chaining
     */
    div(other: _Complex | number): _Complex;

    /**
     * Negate this complex number's real component, modifying this object IN PLACE
     * @returns This instance for operator chaining
     */
    neg(): _Complex;

    /**
     * Negate this number's complex component, modifying this object IN PLACE
     * This effectively obtains the conjugate of this value
     * @returns This instance for operator chaining
     */
    conj(): _Complex;

    /**
     * Get the multiplicative inverse of this complex number, modifying this object IN PLACE
     * @returns This instance for operator chaining
     */
    inv(): _Complex;

    // +-------------------------+
    // | BASIC UTILITY FUNCTIONS |
    // +-------------------------+

    /**
     * Clone this complex number
     * Creates a new object with the same information
     */
    clone(): _Complex;

    /**
     * Copy the contents of some other complex number into this object
     * Used to help minimize the amount of new objects being created
     * @param c The complex number to copy values from
     */
    copy(c: _Complex): void;

    /**
     * Check if some complex number is equal to this complex number
     * @param other The complex number to check against
     * @returns `true` if the two values match
     */
    equals(other: _Complex): boolean;

    /**
     * Obtain a string-representation of this number
     */
    toString(): string;

    /**
     * Allow this value to _also_ be stored within a valid JSON string
     */
    toJSON(): { re: number; im: number };
}

export class Complex implements _Complex {
    private _re: number;
    private _im: number;

    /**
     * Initialize the complex number with real and imaginary components
     * @param re    The initial real component
     * @param im    The initial imaginary component
     */
    constructor(re: number, im: number) {
        this._re = re;
        this._im = im;
    }

    re(value: number): _Complex;
    re(): number;
    re(value?: number): number | _Complex {
        if (value === undefined) return this._re; // Getter; Return value

        // Setter: Update value and return self
        this._re = value;
        return this;
    }

    im(value: number): _Complex;
    im(): number;
    im(value?: number): number | _Complex {
        if (value === undefined) return this._im; // Getter; Return value

        // Setter: Update value and return self
        this._im = value;
        return this;
    }

    abs(): number {
        return Math.sqrt(this._im * this._im + this._re * this._re);
    }

    phi(): number {
        return Math.atan2(this._im, this._re);
    }

    add(other: _Complex | number): _Complex {
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

    sub(other: _Complex | number): _Complex {
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

    mul(other: _Complex | number): _Complex {
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

    div(other: _Complex | number): _Complex {
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

    neg(): _Complex {
        this._re = -this._re;
        return this;
    }

    conj(): _Complex {
        this._im = -this._im;
        return this;
    }

    inv(): _Complex {
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

    clone(): _Complex {
        return new Complex(this._re, this._im);
    }

    copy(c: _Complex): void {
        this._re = c.re();
        this._im = c.im();
    }

    equals(other: _Complex): boolean {
        return other.re() == this._re && other.im() == this._im;
    }

    toString(): string {
        const sign = this._im >= 0 ? "+" : "-";

        // Print in format (a +/- bj)
        return `(${this._re} ${sign} j${Math.abs(this._im)})`;
    }

    toJSON(): { re: number; im: number } {
        return {
            re: this._re,
            im: this._im,
        };
    }
}

/**
 * Construct a new complex number representing a point on the cartesian coordinate plane
 * @param x The real component of the complex value
 * @param y The imaginary component of the complex value
 * @returns The complex number
 */
export function from_cart(x: number, y: number) {
    return new Complex(x, y);
}

/**
 * Construct a new complex number representing a point on the polar coordinate plane
 * @param a The distnace from the center of the grid
 * @param y The angle relative to the +x axis, in radians
 * @returns The complex number
 */
export function from_polar(a: number, p: number) {
    // Calculate x/y from a,p
    const x = a * Math.cos(p);
    const y = a * Math.sin(p);

    return new Complex(x, y);
}
