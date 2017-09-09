class Arc {
    /**
     * Create a new arc. If created from angles, the angles must be provided in radians.
     * The angles in the arc grow counter clockwise.
     * @param {Point} center
     * @param {number} radius
     * @param {number|Point} startAngleOrStartPoint
     * @param {number|Point} angleOrEndPoint
     */
    constructor(center, radius, startAngleOrStartPoint, angleOrEndPoint) {
        if (!(center instanceof Point) || typeof(radius)!=='number') {
            throw Error('Illegal arguments.');
        }
        this._center = center;
        this._radius = radius;
        if (startAngleOrStartPoint instanceof Point) {
            this._startAngle = this.pointToAngle(startAngleOrStartPoint, false);
        } else if (typeof(startAngleOrStartPoint) === 'number') {
            this._startAngle = startAngleOrStartPoint;
        } else {
            throw Error('Illegal arguments.');
        }
        if (angleOrEndPoint instanceof Point) {
            this._angle = this.pointToAngle(angleOrEndPoint);
        } else if (typeof(angleOrEndPoint) === 'number') {
            this._angle = angleOrEndPoint;
        } else {
            throw Error('Illegal arguments.');
        }
        this._length = this._angle * radius;
    }


    /**
     * The length of the arc.
     * @returns {number}
     */
    get length() {
        return this._length;
    }


    /**
     * The radius of the arc.
     * @returns {number}
     */
    get radius() {
        return this._radius;
    }


    /**
     * The angle where the arc starts.
     * @returns {number}
     */
    get startAngle() {
        return this._startAngle;
    }


    /**
     * The angle that spans the arc.
     * @returns {number}
     */
    get angle() {
        return this._angle;
    }


    /**
     * The center of the arc.
     * @returns {Point}
     */
    get center() {
        return this._center.copy();
    }


    /**
     * Calculate the angle at which a point is located on the circle.
     * @param {Point} point on the circumference of the arc
     * @param {boolean} relative to the start angle
     * @returns {number} angle in radians
     */
    pointToAngle(point, relative=true) {
        let angle = Math.acos((point.x - this._center.x) / this._radius);
        // Note that the solution is not unique (e.g. points (3,2) and (3,-2) have same x and thus the same solution).
        // Also due to the symmetry of cos, multiple angles have the same cos value and thus acos is not unique.
        // We have to interpret the angles dependent on the quadrant.
        // Note that the y axis grows from top to bottom and the angles grow counter clockwise.
        if (point.y > 0) {
            // bottom
            angle = -angle;
        }
        if (relative) {
            angle -= this._startAngle;
            if (angle < 0) { // this can occur where the angle switches from 180 to -180
                angle += 2 * Math.PI;
            }
        }
        return angle;
    }


    /**
     * Get the point on the arc at a particular angle.
     * @param {number} angle in radians
     * @param {boolean} relative
     * @returns {Point}
     */
    angleToPoint(angle, relative=true) {
        if (typeof(angle)!=='number') {
            throw Error('Illegal argument.');
        }
        if (relative) {
            angle += this._startAngle;
        }
        const point = new Point(this._center.x + this._radius * Math.cos(angle),
            this._center.y - this._radius * Math.sin(angle)); // we do minus here as our y axis grows from top to bottom
        return point;
    }


    /**
     * Calculate the coordinates of a position on a line.
     * @param {number} position Absolute position on the line. If negative, it will be taken from the end.
     * @returns {Point}
     */
    positionToPoint(position) {
        if (typeof(position) !== 'number' || Math.abs(position)>this._length) {
            throw Error('Illegal position.');
        }
        if (position < 0) {
            // take the position from the end
            position += this._length;
        }
        const relativePosition = position / this._length;
        const angle = relativePosition * this._angle;
        return this.angleToPoint(angle);
    }
}