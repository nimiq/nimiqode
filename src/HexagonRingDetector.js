class HexagonRingDetector {
    static detectHexagonRings(boundingHexagon, image, debugCallback) {
        const startCorner = HexagonRingDetector._findStartCorner(boundingHexagon, image, debugCallback);
        // reorder the corners such that the start corner is corner 0
        const originalOrder = boundingHexagon.corners;
        boundingHexagon.corners = [];
        for (let i=0; i<6; ++i) {
            boundingHexagon.corners[i] = originalOrder[(i + startCorner) % 6];
        }
    }


    static _findStartCorner(boundingHexagon, image, debugCallback) {
        // the orientation finder is a straight line from corner 0 directed to the center. Thus, we search at which
        // corner we encounter the longest line to the center.
        let startCorner = -1,
            bestLineLength = -1,
            bestLineStartX, bestLineStartY, bestLineEndX, bestLineEndY;
        for (let corner=0; corner<6; ++corner) {
            let lineStartX = -1, lineStartY  = -1;
            let lineEndX = -1, lineEndY = -1;
            HexagonRingDetector._executeFunctionAlongLineAndLineWidth(
                boundingHexagon.corners[corner].x, boundingHexagon.corners[corner].y,
                boundingHexagon.center.x, boundingHexagon.center.y, HexagonRingDetector.SEARCH_LINE_WIDTH,
                (x, y) => image.getPixel(x, y) === 0, // is the pixel black ?
                (x, y, blackFound) => {
                    if (lineStartX === -1) {
                        // still searching for the line start
                        if (blackFound) {
                            lineStartX = x;
                            lineStartY = y;
                        }
                    } else {
                        // searching for the line end
                        if (!blackFound) {
                            lineEndX = x;
                            lineEndY = y;
                            return true; // we found start and end of the line. Stop the search.
                        }
                    }
                    return false; // continue the search
                });

            // calculate the line length
            if (lineStartX === -1 || lineEndX === -1) {
                // Didn't find a line for this corner. Continue with next corner.
                continue;
            }
            const lineDeltaX = lineEndX - lineStartX;
            const lineDeltaY = lineEndY - lineStartY;
            const lineLength = lineDeltaX * lineDeltaX + lineDeltaY * lineDeltaY; // no need to take the actual sqrt
            if (lineLength > bestLineLength) {
                startCorner = corner;
                bestLineLength = lineLength;
                bestLineStartX = lineStartX;
                bestLineStartY = lineStartY;
                bestLineEndX = lineEndX;
                bestLineEndY = lineEndY;
            }
        }

        if (startCorner === -1) {
            throw Error('Not found. Failed at: Finding orientation finder.');
        }
        if (debugCallback) {
            debugCallback('orientation-finder', [bestLineStartX, bestLineStartY, bestLineEndX, bestLineEndY]);
        }
        return startCorner;
    }


    static _executeFunctionAlongLineAndLineWidth(startX, startY, endX, endY, lineWidth, fnAlongLineWidth, fnAlongLine) {
        // Note that this is not an exact method that covers all the pixels that are theoretically on a line between
        // start and end of given width. Cue to the discrete image pixels, the line width can differ by +/- 2, single
        // pixels can be skipped in the inner of the line and same pixels can be handled more than once. The method does
        // not try to avoid these cases as they are not relevant in our use case.
        // execute along the line width by executing along the perpendicular of the line.
        let perpendicularVecX = endY - startY;
        let perpendicularVecY = -(endX - startX);
        // normalize the perpendicular vector
        const perpendicularLength = Math.sqrt(perpendicularVecX*perpendicularVecX+perpendicularVecY*perpendicularVecY);
        perpendicularVecX /= perpendicularLength;
        perpendicularVecY /= perpendicularLength;
        const perpendicularOffsetX = Math.round(perpendicularVecX * lineWidth / 2);
        const perpendicularOffsetY = Math.round(perpendicularVecY * lineWidth / 2);

        // iterate over the line and at each position iterate over the perpendicular
        return HexagonRingDetector._executeFunctionAlongLine(startX, startY, endX, endY, (x, y) => {
            const fnAlongWidthReturnedTrue = HexagonRingDetector._executeFunctionAlongLine(
                x - perpendicularOffsetX, y - perpendicularOffsetY,
                x + perpendicularOffsetX, y + perpendicularOffsetY,
                fnAlongLineWidth
            );
            return fnAlongLine(x, y, fnAlongWidthReturnedTrue);
        });
    }


    static _executeFunctionAlongLine(startX, startY, endX, endY, fn) {
        // Bresenham algorithm (see https://de.wikipedia.org/wiki/Bresenham-Algorithmus#Kompakte_Variante)
        startX = Math.round(startX);
        startY = Math.round(startY);
        endX = Math.round(endX);
        endY = Math.round(endY);
        const deltaX = Math.abs(endX - startX), signX = startX < endX? 1 : -1;
        const deltaY = -Math.abs(endY - startY), signY = startY < endY? 1 : -1;
        let error = deltaX + deltaY, error2;
        let x = startX, y = startY;

        while (true) {
            if (fn(x, y)) {
                return true;
            }
            if (x === endX && y === endY) {
                return false;
            }
            error2 = 2 * error;
            if (error2 > deltaY) {
                error += deltaY;
                x += signX;
            }
            if (error2 < deltaX) {
                error += deltaX;
                y += signY;
            }
        }
    }
}
HexagonRingDetector.SEARCH_LINE_WIDTH = 20;