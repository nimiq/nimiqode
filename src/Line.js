class Line {
    /**
     * Construct a new line between two points
     * @param {Point} start
     * @param {Point} end
     */
    constructor(start, end) {
        if (!(start instanceof Point && end instanceof Point)) {
            throw Error('Illegal end points');
        }
        this._start = start;
        this._end = end;
        this._length = Math.sqrt((end.x-start.x)*(end.x-start.x) + (end.y-start.y)*(end.y-start.y));
    }


    /**
     * Length of the line.
     * @returns {number}
     */
    get length() {
        return this._length;
    }


    /**
     * The start point.
     * @returns {Point}
     */
    get start() {
        return this._start.copy();
    }


    /**
     * The end point.
     * @returns {Point}
     */
    get end() {
        return this._end.copy();
    }


    /**
     * Calculate the coordinates of a position on a line.
     * @param {number} position Absolute position on the line. If negative, it will be taken from the end.
     * @returns {Point}
     */
    positionToPoint(position) {
        const xDelta = this._end.x - this._start.x, yDelta = this._end.y - this._start.y;
        if (typeof(position) !== 'number' || Math.abs(position) - 1e-10 > this._length) { // substract a small epsilon
            // for floating point precision
            throw Error('Illegal position');
        }
        if (position < 0) {
            // take the position from the end
            position += this._length;
        }
        const relativePosition = position / this._length;
        return new Point(this._start.x + relativePosition*xDelta, this._start.y + relativePosition*yDelta);
    }


    /**
     * Create a new line that is a possibly shorter version of this line.
     * @param {number} offsetStart
     * @param {number} offsetEnd
     * @returns {Line}
     */
    subLine(offsetStart=0, offsetEnd=0) {
        return new Line(this.positionToPoint(offsetStart), this.positionToPoint(-offsetEnd));
    }
}