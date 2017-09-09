class Point {
    /**
     * Construct a new Point.
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
        if (typeof(x) !== 'number' || typeof(y) !== 'number') {
            throw Error('Illegal coordinates.');
        }
        this._x = x;
        this._y = y;
    }


    /**
     * x coordinate of the point
     * @returns {number}
     */
    get x() {
        return this._x;
    }


    /**
     * y coordinate of the point
     * @returns {number}
     */
    get y() {
        return this._y;
    }


    /**
     * Creates a copy of this point
     * @returns {Point}
     */
    copy() {
        return new Point(this._x, this._y);
    }


    /**
     * Rotate a point around the origin of the coordinate system. Changes the original point.
     * @param {number} angle in radians.
     * @returns {Point}
     */
    rotate(angle) {
        if (typeof(angle)!=='number') {
            throw Error('Illegal angle.');
        }
        const cos = Math.cos(-angle), sin = Math.sin(-angle);
        const newX = this._x * cos - this._y * sin;
        this._y = this._y * cos + this._x * sin;
        this._x = newX;
        return this;
    }


    /**
     * Scale a point with respect to the origin. Changes the original point.
     * @param {number} factor
     * @returns {Point}
     */
    scale(factor) {
        if (typeof(factor) !== 'number') {
            throw Error('Illegal factor');
        }
        this._x *= factor;
        this._y *= factor;
        return this;
    }


    /**
     * Translate the point by an offset. Changes the original point.
     * @param {number} xOffset
     * @param {number} yOffset
     * @returns {Point}
     */
    translate(xOffset, yOffset) {
        if (typeof(xOffset) !== 'number' || typeof(yOffset) !== 'number') {
            throw Error('Illegal offset.');
        }
        this._x += xOffset;
        this._y += yOffset;
        return this;
    }


    transform(rotation=0, scale=1, xOffset=0, yOffset=0) {
        return this.rotate(rotation).scale(scale).translate(xOffset, yOffset);
    }
}