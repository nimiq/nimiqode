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
        this.x = x;
        this.y = y;
    }

    /**
     * Creates a copy of this point
     * @returns {Point}
     */
    copy() {
        return new Point(this.x, this.y);
    }


    /**
     * Calculate the distance to another point.
     * @param {Point} otherPoint
     * @returns {number}
     */
    distanceTo(otherPoint) {
        const deltaX = this.x - otherPoint.x;
        const deltaY = this.y - otherPoint.y;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }


    // TODO refactor these transformations to use the transformation matrix ?

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
        const newX = this.x * cos - this.y * sin;
        this.y = this.y * cos + this.x * sin;
        this.x = newX;
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
        this.x *= factor;
        this.y *= factor;
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
        this.x += xOffset;
        this.y += yOffset;
        return this;
    }


    transform(rotation=0, scale=1, xOffset=0, yOffset=0) {
        return this.rotate(rotation).scale(scale).translate(xOffset, yOffset);
    }
}