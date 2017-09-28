class ScannerDemoRenderUtils {
    static renderPolygon(points, canvasContext) {
        canvasContext.beginPath();
        canvasContext.moveTo(points[0], points[1]);
        canvasContext.fillRect(points[0]-2, points[1]-2, 4, 4);
        for (let i=2; i<points.length; i+=2) {
            canvasContext.lineTo(points[i], points[i+1]);
            canvasContext.fillRect(points[i]-2, points[i+1]-2, 4, 4);
        }
        canvasContext.closePath();
        canvasContext.stroke();
    }


    static renderPoints(points, canvasContext) {
        for (let i=0; i<points.length; i+=2) {
            canvasContext.fillRect(points[i]-1, points[i+1]-1, 2, 2);
        }
    }


    static renderLines(lines, canvasContext) {
        // lines defined by startX, startY, endX, endY
        canvasContext.beginPath();
        for (let i=0; i<lines.length; i += 4) {
            const startX = lines[i], startY = lines[i+1], endX = lines[i+2], endY = lines[i+3];
            canvasContext.moveTo(startX, startY);
            canvasContext.lineTo(endX, endY);
            canvasContext.fillRect(startX-2, startY-2, 4, 4);
            canvasContext.fillRect(endX-2, endY-2, 4, 4);
        }
        canvasContext.stroke();
    }


    static renderBoundingRect(boundingRect, context) {
        context.beginPath();
        // add / subtract 1 to not draw over the interior of the bounding rect
        context.moveTo(boundingRect.left - 1, boundingRect.top - 1);
        context.lineTo(boundingRect.right + 1, boundingRect.top - 1);
        context.lineTo(boundingRect.right + 1, boundingRect.bottom + 1);
        context.lineTo(boundingRect.left - 1, boundingRect.bottom + 1);
        context.closePath();
        context.stroke();
    }


    static renderBoundingHexagon(boundingHexagon, canvasContext) {
        const corners = boundingHexagon.corners;
        canvasContext.beginPath();
        // render diagonals
        for (let i=0; i<3; ++i) {
            const oppositeCorner = i + 3;
            canvasContext.moveTo(corners[i].x, corners[i].y);
            canvasContext.lineTo(corners[oppositeCorner].x, corners[oppositeCorner].y);
        }
        canvasContext.stroke();
        // render hexagon sides and corners
        canvasContext.beginPath();
        canvasContext.moveTo(corners[0].x, corners[0].y);
        canvasContext.fillRect(corners[0].x-2, corners[0].y-2, 4, 4);
        for (let i=1; i<corners.length; ++i) {
            canvasContext.lineTo(corners[i].x, corners[i].y);
            canvasContext.fillRect(corners[i].x-2, corners[i].y-2, 4, 4);
        }
        canvasContext.closePath();
        canvasContext.stroke();
        // render center
        canvasContext.fillRect(boundingHexagon.center.x - 2, boundingHexagon.center.y - 2, 4, 4);
    }


    static renderFinderPattern(finderPattern, canvasContext) {
        canvasContext.beginPath();
        for (const direction of ['counterclockwise', 'clockwise']) {
            const points = finderPattern[direction];
            let prev;
            for (const point of points) {
                if (!prev) {
                    canvasContext.moveTo(point.x, point.y);
                } else {
                    canvasContext.lineTo(point.x, point.y);
                }
            }
            for (const point of points) {
                canvasContext.fillRect(point.x-2, point.y-2, 4, 4);
            }
        }
        canvasContext.stroke();
    }


    static renderHexagonRingSlots(hexagonRings, transformationMatrix, canvasContext) {
        for (const hexRing of hexagonRings) {
            for (let slot=0; slot<hexRing.bitCount; ++slot) {
                const [slotLocation,] = hexRing.getSlotLocation(slot);
                transformationMatrix.transform(slotLocation);
                canvasContext.fillRect(slotLocation.x-1, slotLocation.y-1, 2, 2);
            }
        }
    }
}