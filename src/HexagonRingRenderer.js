class HexagonRingRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {HexagonRing} hexagonRing
     * @param {string} strokeColor
     * @param {number} strokeWidth
     * @param {Point} center
     * @param {number} scaleFactor
     * @param {number} rotation in radians
     */
    static render(canvas, hexagonRing, strokeColor, strokeWidth, center, scaleFactor=1, rotation=0) {
        if (!(canvas instanceof HTMLCanvasElement) || !(hexagonRing instanceof HexagonRing) ||
            typeof(strokeColor)!=='string' || typeof(strokeWidth)!=='number' || !(center instanceof Point) ||
            typeof(scaleFactor)!=='number' || typeof(rotation)!=='number') {
            throw Error('Illegal arguments.');
        }
        if (!hexagonRing.data) {
            throw Error('HexagonRing data not set.');
        }
        const context = canvas.getContext('2d');
        context.save();
        context.strokeStyle = strokeColor;
        context.lineCap = 'butt';
        context.lineWidth = strokeWidth * scaleFactor;

        let index = 0;
        while (index < hexagonRing.numSlots) {
            // search for sequences of consecutive set bits
            if (hexagonRing.data.getBit(index)) {
                const sequenceStart = index;
                do {
                    index++;
                } while(index < hexagonRing.numSlots && hexagonRing.data.getBit(index));
                const sequenceEnd = index; // excluded
                HexagonRingRenderer._renderBitSequence(context, hexagonRing, center, scaleFactor, rotation,
                    sequenceStart, sequenceEnd);
            }
            index++;
        }

        context.restore();
    }


    static _renderBitSequence(context, hexagonRing, center, scaleFactor, rotation, startIndex, endIndex) {
        const [startPoint, startSegment] = hexagonRing.getSlotLocation(startIndex, 'start');
        const [endPoint, endSegment] = hexagonRing.getSlotLocation(endIndex-1, 'end');
        const segments = hexagonRing.segments;
        const startSegmentIndex = segments.indexOf(startSegment);
        const endSegmentIndex = segments.indexOf(endSegment);
        context.beginPath();
        const startPointTransformed = startPoint.copy().transform(rotation, scaleFactor, center.x, center.y);
        context.moveTo(startPointTransformed.x, startPointTransformed.y);
        for (let i=startSegmentIndex; i<=endSegmentIndex; ++i) {
            const segment = segments[i];
            if (segment instanceof Line) {
                let currentEndPoint;
                if (i === endSegmentIndex) {
                    // the actual end point is within this segment
                    currentEndPoint = endPoint.copy();
                } else {
                    // draw to the end of this segment
                    currentEndPoint = segment.end;
                }
                currentEndPoint.transform(rotation, scaleFactor, center.x, center.y);
                context.lineTo(currentEndPoint.x, currentEndPoint.y);
            } else {
                let currentStartPoint=null, currentEndPoint=null;
                if (i === startSegmentIndex) {
                    currentStartPoint = startPoint;
                }
                if (i === endSegmentIndex) {
                    currentEndPoint = endPoint;
                }
                // don't transform the points as the drawing is based on arcs computed from the points in original
                // coordinate system.
                HexagonRingRenderer._drawArc(context, segment, center, scaleFactor, rotation,
                    currentStartPoint, currentEndPoint);
            }
        }
        context.stroke();
    }


    static _drawArc(context, arc, hexCenter, scaleFactor, rotation, startPoint=null, endPoint=null) {
        let startAngle, endAngle;
        if (!startPoint) {
            startAngle = arc.startAngle;
        } else {
            startAngle = arc.pointToAngle(startPoint, false);
        }
        if (!endPoint) {
            endAngle = arc.startAngle + arc.angle;
        } else {
            endAngle = arc.pointToAngle(endPoint, false);
        }
        startAngle += rotation;
        endAngle += rotation;
        while (startAngle > Math.PI) {
            // move the angle by 360 degree into the [-180,180] interval
            startAngle = startAngle - 2 * Math.PI;
        }
        while (endAngle > Math.PI) {
            // move the angle by 360 degree into the [-180,180] interval
            endAngle = endAngle - 2 * Math.PI;
        }
        // while the angles in our arcs grow counter clockwise, context.arc calculates them clockwise
        startAngle = -startAngle;
        endAngle = -endAngle;
        const scaledRadius = arc.radius * scaleFactor;
        const arcCenter = arc.center.transform(rotation, scaleFactor, hexCenter.x, hexCenter.y);
        context.arc(arcCenter.x, arcCenter.y, scaledRadius, startAngle, endAngle, true);
    }
}