import { _Complex, from_cart } from "./complex.js";

export interface _Curve {
    /**
     * Get the next value in the curve.
     * Note that the returned value is garunteed to have integer coordinates
     * @returns A complex number representing the x (re) and y (im) coordinates of the curve, or `null` if the curve is finished
     */
    next(): _Complex | null;

    /**
     * Get the index of the last point along the curve. Returns -1 once finished
     */
    index(): number;

    /**
     * Reset the curve internal index counter to 0
     */
    reset(): void;
}

abstract class CurveBase implements _Curve {
    private _index: number = -1;
    private _done: boolean = false;
    private readonly _length: number;

    /**
     * @param length    The maximum index to reach up to. Set to -1 to disable auto-cutoff
     */
    constructor(length: number) {
        this._length = length;
    }

    index(): number {
        return this._done ? -1 : this._index;
    }

    reset(): void {
        this._index = -1;
        this._done = false;
        this._reset();
    }

    next(): _Complex | null {
        this._index++;
        if (this._done || this._index === this._length) {
            this._done = true;
            return null;
        }

        const value = this._next(this._index);

        if (value === null) this._done = true; // Finished!
        return value;
    }

    /**
     * Compute the next point on the curve
     * @param index The current index. Garunteed to be one more than the previous (unless after a reset)
     * @returns The point on the curve, or `null` to indicate the curve has completed
     */
    protected abstract _next(index: number): _Complex | null;

    /**
     * Indicate to derived class that a reset occurred
     * Overload this function to trigger events on reset
     */
    protected _reset(): void {}
}

/**
 * Curve that produces a horizontal line
 */
export class CurveH extends CurveBase {
    private readonly x1: number; // Starting `x`
    private readonly x2: number; // Ending `x`
    private readonly y: number; // Shared `y` level

    private readonly step: number; // +/-1, indicating direction of travel

    /**
     * @param x1    The starting `x` position
     * @param x2    The ending `x` position
     * @param y     The shared `y` position between all output points
     */
    constructor(x1: number, x2: number, y: number) {
        super(Math.abs(x2 - x1) + 1);

        this.x1 = Math.floor(x1);
        this.x2 = Math.ceil(x2);
        this.y = Math.round(y);

        this.step = Math.sign(x2 - x1);
    }

    protected _next(index: number): _Complex | null {
        // Rely on auto-cutoff to stop
        return from_cart(this.x1 + index * this.step, this.y);
    }
}

/**
 * Curve that produces a vertical line
 */
export class CurveV extends CurveBase {
    private readonly y1: number; // Starting `y`
    private readonly y2: number; // Ending `y`
    private readonly x: number; // Shared `x` level

    private readonly step: number; // +/-1, indicating direction of travel

    /**
     * @param x     The shared `x` position between all output points
     * @param y1    The starting `y` position
     * @param y2    The ending `y` position
     */
    constructor(x: number, y1: number, y2: number) {
        super(Math.abs(y2 - y1) + 1);

        this.y1 = Math.floor(y1);
        this.y2 = Math.ceil(y2);
        this.x = Math.round(x);

        this.step = Math.sign(y2 - y1);
    }

    protected _next(index: number): _Complex | null {
        // Rely on auto-cutoff to stop
        return from_cart(this.x, this.y1 + index * this.step);
    }
}

/**
 * Curve that follows a snake path
 * Fills in from (x1, y2) to either (x2, y2) or (x1, y2) (depending on parity)
 * /---END
 * \-----\
 * START-/
 */
export class CurveSnake extends CurveBase {
    private readonly x1: number;
    private readonly x2: number;
    private readonly y1: number;
    private readonly y2: number;

    // Cursors to keep track of snake's current position
    private x: number;
    private y: number;

    // Keep track of directions (+/-1)
    private x_dir: number;
    private y_dir: number;

    constructor(x1: number, y1: number, x2: number, y2: number) {
        const width = Math.abs(x2 - x1) + 1;
        const height = Math.abs(y2 - y1) + 1;

        super(width * height);

        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;

        // Initialize cursor
        this.x = this.x1;
        this.y = this.y1;

        // Compute initial directions
        this.x_dir = Math.sign(this.x2 - this.x1);
        this.y_dir = Math.sign(this.y2 - this.y1);
    }

    protected _next(index: number): _Complex | null {
        // Save current position
        const x = this.x;
        const y = this.y;

        // Compute new position
        // Reached x-boundary; Move to next y-level
        if (
            (this.x_dir >= 0 && this.x === this.x2) ||
            (this.x_dir < 0 && this.x === this.x1)
        ) {
            this.x_dir *= -1;
            this.y += this.y_dir;
        }

        // Default: Continue to next x-position
        else {
            this.x += this.x_dir;
        }

        // Return saved position
        return from_cart(x, y);
    }

    _reset() {
        this.x = this.x1;
        this.y = this.y1;

        this.x_dir = Math.sign(this.x2 - this.x1);
        this.y_dir = Math.sign(this.y2 - this.y1);
    }
}

/**
 * Curve that follows a spiral
 * Fills in from (x1, y2) to the center of the spiral
 * Always rotate in a CCW direction
 * /---------\
 * |/-------\|
 * |\----END||
 * \--------/|
 * START-----/
 */
export class CurveSpiral extends CurveBase {
    private readonly x1: number;
    private readonly x2: number;
    private readonly y1: number;
    private readonly y2: number;

    // Movable walls surrounding spiral
    private x1_wall: number;
    private x2_wall: number;
    private y1_wall: number;
    private y2_wall: number;

    // Initial x/y positions
    private readonly xi: number;
    private readonly yi: number;

    // Cursors to keep track of spiral's current position
    private x: number;
    private y: number;

    // Keep track of directions (+/-1)
    // Note that only _ONE_ should be non-0 at a time
    private x_dir: number;
    private y_dir: number;

    constructor(x1: number, y1: number, x2: number, y2: number) {
        const width = Math.abs(x2 - x1) + 1;
        const height = Math.abs(y2 - y1) + 1;

        super(width * height);

        this.x1 = Math.min(x1, x2);
        this.y1 = Math.min(y1, y2);
        this.x2 = Math.max(x1, x2);
        this.y2 = Math.max(y1, y2);

        this.xi = this.x1;
        this.yi = this.y1;

        this._reset();
    }

    protected _next(index: number): _Complex | null {
        // Save current position
        const x = this.x;
        const y = this.y;

        // Compute new position
        // Reached x/y boundary; Rotate and continue journey!
        if (
            (this.x_dir > 0 && this.x === this.x2_wall) ||
            (this.x_dir < 0 && this.x === this.x1_wall)
        ) {
            // Horizontal flip; No room along y-axis
            if (
                this.y1_wall === this.y2_wall &&
                this.y >= this.y2_wall &&
                this.y <= this.y2_wall
            ) {
                this.x_dir *= -1;
            }

            // Rotate CCW by 90deg
            else {
                if (this.x_dir > 0) this.x2_wall--;
                else this.x1_wall++;

                this.y_dir = -this.x_dir;
                this.x_dir = 0;
            }
        } else if (
            (this.y_dir > 0 && this.y === this.y2_wall) ||
            (this.y_dir < 0 && this.y === this.y1_wall)
        ) {
            // Horizontal flip; No room along x-axis
            if (
                this.x1_wall === this.x2_wall &&
                this.x >= this.x2_wall &&
                this.x <= this.x2_wall
            ) {
                this.y_dir *= -1;
            }

            // Rotate CCW by 90deg
            else {
                if (this.y_dir > 0) this.y2_wall--;
                else this.y1_wall++;

                this.x_dir = this.y_dir;
                this.y_dir = 0;
            }
        }

        // Update position based on dirs
        this.x += this.x_dir;
        this.y += this.y_dir;

        // Return saved position
        return from_cart(x, y);
    }

    _reset() {
        // Initialize cursor
        this.x = this.xi;
        this.y = this.yi;

        this.x1_wall = this.x1 + 1;
        this.x2_wall = this.x2;
        this.y1_wall = this.y1;
        this.y2_wall = this.y2;

        // Compute initial directions
        // Find desired movement vectors, and pick that which creates CCW movement
        // Assumes xi = x1
        let x_desired = Math.sign(this.x2 - this.x1);
        let y_desired = Math.sign(this.y2 - this.y1);

        // Account for xi = x2
        if (this.xi !== this.x1) x_desired *= -1;
        if (this.yi !== this.y1) y_desired *= -1;

        const initial_y = y_desired != 0 && x_desired * y_desired >= 0;

        this.x_dir = initial_y ? 0 : x_desired;
        this.y_dir = initial_y ? y_desired : 0;
    }
}

/**
 * Curve that follows the generalized Hilbert curve
 */
// export class curvehilbert extends curvebase {
//     constructor(x1: number, y1: number, x2: number, y2: number) {
//         const width = math.abs(x2 - x1) + 1;
//         const height = math.abs(y2 - y1) + 1;

//         super(width * height);
//     }

//     protected _next(index: number): _complex | null {}
// }
