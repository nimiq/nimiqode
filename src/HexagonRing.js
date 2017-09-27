class HexagonRing {
    /**
     * Geometry of a flat topped hexagon with rounded borders. The circumference can be divided into slots of given
     * length and distance. The circumference line starts/ends at the lower right corner where an additional
     * offset can be applied.
     * The origin of the hexagon is the middle of the hexagon and the y axis grows to the bottom.
     * @param {number} innerRadius
     * @param {number} borderRadius
     * @param {number} startEndOffset
     * @param {number} slotDistance
     * @param {number} slotLength
     */
    constructor(innerRadius, borderRadius, startEndOffset, slotDistance, slotLength) {
        if (typeof(innerRadius)!=='number' || typeof(borderRadius)!=='number' || typeof(startEndOffset)!=='number' ||
            typeof(slotDistance)!=='number' || typeof(slotLength)!=='number' || startEndOffset<1 || borderRadius<1 ||
            slotLength < 1) {
            throw('Illegal arguments');
        }
        this._innerRadius = innerRadius;
        this._outerRadius = this._fullSideLength = innerRadius * 2 / Math.sqrt(3);
        this._height = 2 * this._innerRadius;
        this._width = 2 * this._outerRadius;
        this._borderRadius = borderRadius;
        this._startEndOffset = startEndOffset;

        this._calculateSegments();

        this._length = this._segments.reduce((length, segment) => length + segment.length, 0);
        this._slotDistance = slotDistance;
        // number of data slots distributed over the full length (num slots and num-1 spaces between):
        // num * slotLength + (num-1) * slotDistance = length
        // num * slotLength + num * slotDistance - slotDistance = length
        // num = (length + slotDistance) / (slotLength + slotDistance)
        this._slotCount = Math.floor((this._length + slotDistance) / (slotLength + slotDistance));
        // pick the slot length in a way that there is no remainder
        // slotLength = (length - (num-1) * slotDistance) / num
        this._slotLength = (this._length - (this._slotCount-1) * slotDistance) / this._slotCount;

        this._finderPattern = {
            counterclockwise: false,
            clockwise: false
        };
    }


    /**
     * Total length of the hexagon ring which is the sum over the lengths of all its segments.
     * @returns {number}
     */
    get length() {
        return this._length;
    }


    /**
     * How many bits of data fit into this HexagonRing for the given slotDistance and slotLength.
     * @returns {number}
     */
    get bitCount() {
        return this._slotCount - 2; // -2 for the finder pattern at start and end of the ring
    }


    /**
     * How many slots fit into this HexagonRing for the given slotDistance and slotLength.
     * @returns {number}
     */
    get slotCount() {
        return this._slotCount;
    }


    /**
     * The lines and arcs that form this hexagon ring in counter clockwise order.
     * @returns {Array.<Line|Arc>}
     */
    get segments() {
        return this._segments;
    }


    /**
     * The corners of the hexagon if it wouldn't be rounded.
     * @returns {Array.<Point>}
     */
    get virtualCorners() {
        return this._virtualCorners;
    }


    /**
     * Set the data associated with this HexagonRing. Its length must exactly match the number of slots of this ring.
     * @param {BitArray} data
     */
    set data(data) {
        if (!(data instanceof BitArray) || data.length !== this.bitCount) {
            throw Error('Illegal data.');
        }
        this._data = data;
    }


    /**
     * The data associated with this HexagonRing.
     * @returns {BitArray}
     */
    get data() {
        return this._data;
    }


    setFinderPattern(counterclockwise, clockwise) {
        this._finderPattern['counterclockwise'] = counterclockwise;
        this._finderPattern['clockwise'] = clockwise;
    }


    getFinderPattern(direction='counterclockwise') {
        return this._finderPattern[direction];
    }


    isSlotSet(slotIndex) {
        if (slotIndex === 0) {
            return this._finderPattern['counterclockwise'];
        } else if (slotIndex === this._slotCount-1) {
            return this._finderPattern['clockwise'];
        } else {
            return !!this._data.getBit(slotIndex-1); // -1 to account for the counterclockwise finder pattern slot
        }
    }


    _calculateSegments() {
        const origin = new Point(0, 0);
        // corners of the hexagon if it wouldn't be rounded and wouldn't have an offset
        this._virtualCorners = [
            new Point(this._fullSideLength/2, this._innerRadius), // right bottom
            new Point(this._outerRadius, 0), // right center
            new Point(this._fullSideLength/2, -this._innerRadius), // right top
            new Point(-this._fullSideLength/2, -this._innerRadius), // left top
            new Point(-this._outerRadius, 0), // left center
            new Point(-this._fullSideLength/2, this._innerRadius) // left bottom
        ];
        // The corners of the hexagon are rounded therefore there is an offset until where the sides are straight and
        // then change into an arc. Calculate the side offset and arc center by a right triangle formed by the
        // virtual corner, the center of the arc and one arc end point. This is a right triangle as the arc smoothly
        // joins into the hexagon side by design und thus at the arc end point we have a right angle between the
        // hexagon side and the perpendicular to the arc center.
        // The center point of the arc is located on the straight line through the hexagon center (origin) and the
        // virtual corner as this line is exactly between the two arc end points (perpendicular bisect).
        // The angle of the arc is 60 degrees (a sixth of a full circle, 2*PI/6), thus the angle in the triangle at
        // the perpendicular bisect that halves the arc is 2*PI/12 = PI/6.
        // With this, we can compute the sides of the right triangle from the known angle and know distance between
        // center point and arc end point (the radius).
        const sideOffset = Math.tan(Math.PI / 6) * this._borderRadius; // line from virtual corner to arc end point
        const cornerArcOffset = this._borderRadius / Math.cos(Math.PI / 6); // line from virtual corner to arc center

        // calculate the hexagon sides (we traverse the hexagon counter clockwise)
        this._hexagonSides = [
            new Line(this._virtualCorners[0], this._virtualCorners[1]).subLine(this._startEndOffset, sideOffset),
            new Line(this._virtualCorners[1], this._virtualCorners[2]).subLine(sideOffset, sideOffset),
            new Line(this._virtualCorners[2], this._virtualCorners[3]).subLine(sideOffset, sideOffset),
            new Line(this._virtualCorners[3], this._virtualCorners[4]).subLine(sideOffset, sideOffset),
            new Line(this._virtualCorners[4], this._virtualCorners[5]).subLine(sideOffset, sideOffset),
            new Line(this._virtualCorners[5], this._virtualCorners[0]).subLine(sideOffset, this._startEndOffset)
        ];
        // calculate the arcs in the corners
        this._hexagonCornerArcs = [
            new Arc(new Line(origin, this._virtualCorners[1]).positionToPoint(-cornerArcOffset),
                this._borderRadius, this._hexagonSides[0].end, this._hexagonSides[1].start),
            new Arc(new Line(origin, this._virtualCorners[2]).positionToPoint(-cornerArcOffset),
                this._borderRadius, this._hexagonSides[1].end, this._hexagonSides[2].start),
            new Arc(new Line(origin, this._virtualCorners[3]).positionToPoint(-cornerArcOffset),
                this._borderRadius, this._hexagonSides[2].end, this._hexagonSides[3].start),
            new Arc(new Line(origin, this._virtualCorners[4]).positionToPoint(-cornerArcOffset),
                this._borderRadius, this._hexagonSides[3].end, this._hexagonSides[4].start),
            new Arc(new Line(origin, this._virtualCorners[5]).positionToPoint(-cornerArcOffset),
                this._borderRadius, this._hexagonSides[4].end, this._hexagonSides[5].start)
        ];
        this._segments = [
            this._hexagonSides[0], this._hexagonCornerArcs[0], this._hexagonSides[1], this._hexagonCornerArcs[1],
            this._hexagonSides[2], this._hexagonCornerArcs[2], this._hexagonSides[3], this._hexagonCornerArcs[3],
            this._hexagonSides[4], this._hexagonCornerArcs[4], this._hexagonSides[5]
        ];
    }


    getDataSlotLocation(dataSlotIndex, type='center') {
        return this.getSlotLocation(dataSlotIndex+1, type); // +1 for the finder pattern at the start of the ring
    }


    getFinderPatternSlotLocation(direction='counterclockwise', type='center') {
        if (direction === 'counterclockwise') {
            return this.getSlotLocation(0, type);
        } else {
            return this.getSlotLocation(this._slotCount - 1, type);
        }
    }


    /**
     * Get the coordinates and segment for a slot on the hexagon ring.
     * @param {number} slotIndex
     * @param {string} [type] can be 'center', 'start' or 'end'. Default is 'center'.
     * @returns {[Point,Line|Arc]}
     */
    getSlotLocation(slotIndex, type='center') {
        if (typeof(slotIndex)!=='number' || slotIndex < 0 || slotIndex >= this._slotCount) {
            throw Error('Illegal index.');
        }
        let position = slotIndex * (this._slotLength + this._slotDistance) +
            (type==='start'? 0 : type==='center'? 0.5 : 1) * this._slotLength;
        let segment;
        for (let i=0; i<this._segments.length; ++i) {
            if (position - 1e-10 <= this._segments[i].length) { // we subtract a small epsilon as due to floating point
                // precision it can happen at the very last position that the position overflows the last segment
                segment = this._segments[i];
                break;
            } else {
                position -= this._segments[i].length;
            }
        }
        if (!segment) {
            throw Error('Illegal index.'); // this shouldn't happen as we already check for bitCount
        }
        const coordinates = segment.positionToPoint(position);
        return [coordinates, segment];
    }
}