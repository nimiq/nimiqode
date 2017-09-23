class BoundingHexagonDetector {
    // Note: Instead of finding the outermost hexagon ring from the outside as convex hull, we could also find the
    // innermost hexagon ring, by adapting the idea: we need to start with a point in the inside of the hexagon ring.
    // Now, we could turn the picture inside out and search for the outer convex hull again. Or we adapt the convex hull
    // algorithm and search for the convex inner of the hexagon. The candidate points are the points in direct sight to
    // the start point inside the hexagon ring.
    // By searching from the inside, no bounding rect needs to be detected and no quiet zone around the code is required

    static calculateRequiredBufferSize(boundingRect) {
        // The convex hull candidate point search initializations, top and bottom entry per column, each entry an uint16
        const candidateSearchInitializationBufferByteLength = boundingRect.width * 2 * 2;
        // Point buffer for the candidate points / after in-place convex hull detection the convex hull.
        // Top and bottom candidates, x and y per point, each an uint16 (2 byte).
        const pointBufferByteLength = boundingRect.width * 2 * 2 * 2;
        // Buffer for the 6 sides of the hexagon, for each the length, start and end point, for each point x and y,
        // all numbers Uint16
        const hexagonSidesBufferByteLength = 6 * (1 + 2 * 2) * 2;
        return candidateSearchInitializationBufferByteLength + pointBufferByteLength + hexagonSidesBufferByteLength;
    }


    static detectBoundingHexagon(boundingRect, image, buffer = null, debugCallback) {
        // reasoning for the calculations see calculateRequiredBufferSize
        const candidateSearchInitBufferByteLength = boundingRect.width * 2 * 2;
        const pointBufferByteLength = boundingRect.width * 2 * 2 * 2;
        const hexagonSidesBufferByteLength = 6 * (1 + 2 * 2) * 2;
        let candidateSearchInitialization, pointBuffer, hexagonSidesBuffer;
        if (buffer) {
            if (buffer.byteLength !== candidateSearchInitBufferByteLength + pointBufferByteLength
                + hexagonSidesBufferByteLength) {
                throw Error('Illegal Buffer.');
            }
            candidateSearchInitialization = new Uint16Array(buffer.buffer, buffer.byteOffset,
                candidateSearchInitBufferByteLength / 2); // /2 because of Uint16
            pointBuffer = new Uint16Array(buffer.buffer, buffer.byteOffset + candidateSearchInitBufferByteLength,
                pointBufferByteLength / 2);
            hexagonSidesBuffer = new Uint16Array(buffer.buffer, pointBuffer.byteOffset + pointBufferByteLength,
                hexagonSidesBufferByteLength / 2);
        } else {
            candidateSearchInitialization = new Uint16Array(candidateSearchInitBufferByteLength / 2);
            pointBuffer = new Uint16Array(pointBufferByteLength / 2);
            hexagonSidesBuffer = new Uint16Array(hexagonSidesBufferByteLength / 2);
        }

        // TODO if one would like to call this method again to find inner hexagons (after the outer one has been
        // removed), one could use the previous candidate points as initialization for the candidate search
        const convexHullCandidates = BoundingHexagonDetector._findCandidatePoints(boundingRect, image, pointBuffer, null);
        if (debugCallback) {
            debugCallback('convex-hull-candidates', convexHullCandidates);
        }
        const convexHull = BoundingHexagonDetector._calculateConvexHull(convexHullCandidates);
        if (debugCallback) {
            debugCallback('convex-hull', convexHull);
        }
        const hexagonSides = BoundingHexagonDetector._extractHexagonSides(convexHull, hexagonSidesBuffer);
        if (debugCallback) {
            debugCallback('hexagon-sides', hexagonSides);
        }
    }


    static _findCandidatePoints(boundingRect, image, pointBuffer, searchInitialization = null) {
        // Candidate points for the convex hull are the topmost and bottommost points in every column. The points that
        // are not the topmost or bottommost are by nature inside the convex hull. At the left and and right end a not
        // topmost or bottommost point can be exactly on the convex hull outline but can be skipped as that line is
        // already defined by the topmost and bottommost points at the left / right end.
        // We find the topmost and bottommost points by searching from the bounding rect top and bottom.

        const pixels = image.pixels, imageWidth = image.width, boundingRectWidth = boundingRect.width,
            pointBufferLength = pointBuffer.length;
        let columnsWithCandidatesCount = 0;
        for (let column = boundingRectWidth-1; column >= 0; --column) {
            const x = boundingRect.left + column;
            let positionTop, positionBottom;
            if (searchInitialization) {
                positionTop = searchInitialization[column * 2];
                positionBottom =searchInitialization[column * 2 + 1];
            } else {
                positionTop = boundingRect.top;
                positionBottom = boundingRect.bottom; // the bottom is included
            }

            // search the top
            let pixelIndex = positionTop * imageWidth + x;
            while (positionTop <= positionBottom && pixels[pixelIndex]) {
                // pixel is white, go one row down
                ++positionTop;
                pixelIndex += imageWidth;
            }
            if (positionTop > positionBottom) {
                // in this column are no black pixel
                continue;
            }

            // search the bottom
            pixelIndex = positionBottom * imageWidth + x;
            while (pixels[pixelIndex]) { // no need here to compare to positionTop, we know there will be a black pixel
                // pixel is white, go one row up
                --positionBottom;
                pixelIndex -= imageWidth;
            }

            // save all the (x,top) in the first half of the array in order we traverse the columns (right to left)
            const writeIndex = columnsWithCandidatesCount * 2;
            pointBuffer[writeIndex] = x;
            pointBuffer[writeIndex + 1] = positionTop;
            // save the (x,bottom) temporarily in the second half, writing from the end in reversed order
            pointBuffer[pointBufferLength - 1 - writeIndex - 1] = x;
            pointBuffer[pointBufferLength - 1 - writeIndex] = positionBottom;
            ++columnsWithCandidatesCount;
        }

        // We found all the candidates. Now append the bottom candidate points to the list of top candidate points.
        // We then have the top points from right to left and the bottom points in reversed order from left to right
        // which means we store the points in a counter clockwise manner.
        // The copyWithin handles overlapping memory correctly.
        pointBuffer.copyWithin(columnsWithCandidatesCount * 2, -columnsWithCandidatesCount * 2);
        const resultBufferLength = columnsWithCandidatesCount * 4; // *2 for top and bottom points, again *2 for x and y
        return new Uint16Array(pointBuffer.buffer, pointBuffer.byteOffset, resultBufferLength);
    }


    static _calculateConvexHull(points) {
        // Our candidate points are the topmost and bottommost points in every column, arranged in a counter clockwise
        // manner starting at the right. These candidate points form a sequential polygon on which we can determine the
        // convex hull in O(n) (https://en.wikipedia.org/wiki/Convex_hull_algorithms#Simple_polygon).
        // The idea follows Andrew's monotone chain convex hull algorithm
        // (https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain) which reduces
        // for a given polygon essentially to the polygon algorithm stated in the first link. however, the
        // implementation follows more the Graham Scan (https://en.wikipedia.org/wiki/Graham_scan) which is also
        // essentially the same.
        // We calculate the convex hull in-place just like in the Graham scan algorithm, overwriting the candidates.
        const pointCount = points.length / 2; // for every point we have x and y
        // We already know that the candidate at index 0 is for sure in the convex hull as it's the rightmost topmost
        // point. Therefore we can already set the convexHullPointCount to 1 and start the loop at index 1.
        let convexHullPointCount = 1;
        // the points are already ordered in counterclockwise order so we can simply traverse the whole array
        for (let pointIndex = 1; pointIndex < pointCount; ++pointIndex) {

            while (convexHullPointCount > 1 && BoundingHexagonDetector._crossProduct(points,
                    convexHullPointCount - 2, convexHullPointCount - 1, pointIndex, false) <= 0) {
                // We check for convexHullPointCount > 1 to never delete the first point from which we know for sure
                // that it is on the hull and because for the cross product computation we need at least 2 points from
                // the hull. We check whether the current point and the two last points from the hull form a clockwise
                // turn or are collinear in which case the last point we added to the hull can't be actually in the
                // hull, as in the convex hull (that we traverse counter clockwise) all turns must be counter clockwise.
                // In this case, we remove the last point again from the hull.
                --convexHullPointCount;
            }
            // Add the current point to the hull. We can simply overwrite the point at position convexHullPointCount
            // in-place because always convexHullPointCount <= pointIndex and we never need the already checked
            // candidates anymore (pointIndex never goes back).
            points[convexHullPointCount * 2] = points[pointIndex * 2];
            points[convexHullPointCount * 2 + 1] = points[pointIndex * 2 + 1];
            ++convexHullPointCount;
        }

        // Test whether the start and end point are the same (Note that all other duplicate points get recognized
        // and removed already by the cross product == 0 check)
        if (points[0] === points[2*(convexHullPointCount-1)] && points[1] === points[2*(convexHullPointCount-1) + 1]) {
            // remove the end point
            --convexHullPointCount;
        }

        if (convexHullPointCount <= 2) {
            // If we only got two points, that is not a valid convex hull. This happens if there is actually no convex
            // hull because all points are collinear.
            throw Error('Not found. Failed at: Hexagon ring convex hull detection.');
        }
        return new Uint16Array(points.buffer, points.byteOffset, convexHullPointCount * 2);
    }


    /**
     * Calculate the z component of the cross product of two vectors BA and BC.
     * @param {Uint16Array} points
     * @param {number} pointAIndex
     * @param {number} pointBIndex
     * @param {number} pointCIndex
     * @param {boolean} normalizeVectors
     * @return {number} >0 if counter clockwise, <0 if clockwise, 0 if collinear. If chosen to normalize the vectors,
     *  the result is equal to the sin of the angle between the vectors.
     * @private
     */
    static _crossProduct(points, pointAIndex, pointBIndex, pointCIndex, normalizeVectors) {
        // Note that the cross product operates on 3d vectors and returns a vector in 3d that is perpendicular to the
        // two multiplied vectors. Thus, the cross product of BA and BC (expanded to 3d by setting z to 0) is parallel
        // to the z axis such that x and y of the cross product are 0 and it's enough to compute the z component.
        // We use the cross the cross product to determine the direction of an angle (left or right).
        // See https://en.wikipedia.org/wiki/Graham_scan
        // multiply the indices with 2 because for every point, we have x and y values.
        pointAIndex *= 2;
        pointBIndex *= 2;
        pointCIndex *= 2;
        const baVecX = points[pointAIndex] - points[pointBIndex],
            baVecY = points[pointAIndex + 1] - points[pointBIndex + 1],
            bcVecX = points[pointCIndex] - points[pointBIndex],
            bcVecY = points[pointCIndex + 1] - points[pointBIndex + 1];
        const crossProductZ = baVecX * bcVecY - baVecY * bcVecX;
        if (!normalizeVectors) {
            return crossProductZ;
        } else {
            // Return the cross product of normalized vectors BA and BC. The cross product of two vectors that are
            // multiplied by some scalar respectively, is the same as multiplying the the cross product with the scalars
            // (the scalars can me moved out of the cross product).
            // Thus we can simply do the normalization now after the cross product is already computed.
            const lengthBA = Math.sqrt(baVecX * baVecX + baVecY * baVecY),
                lengthBC = Math.sqrt(bcVecX * bcVecX + bcVecY * bcVecY);
            return crossProductZ / (lengthBA * lengthBC);
        }
    }


    static _extractHexagonSides(convexHull, buffer) {
        // Find the 6 longest straight lines in the convex hull.
        // Note that the line parts of the hexagon ring that should be completely straight (index.e. should be in the convex
        // hull a single line segment defined by start and end point) are in reality in the scanned image often times
        // combined of several minimally crooked line parts (because of discrete pixel positions, anti aliasing during
        // render, thresholding in the binarizer combined with out of focus/motion blur, ...). So we have to search for
        // line parts that differ only very little in angle and thus effectively form a straight line.
        const convexHullPointCount = convexHull.length / 2; // /2 because of x and y for every point
        const lines = new Uint16Array(buffer.buffer, buffer.byteOffset, 6*2*2); // x, y for start, end of 6 lines
        const lineLengths = new Uint16Array(buffer.buffer, buffer.byteOffset + lines.byteLength, 6);
        let lineCount = 0;
        // Start the search in a corner, to avoid that we start in the middle of a line (the latter can happen if the
        // straight lines are not perfectly straight but minimally crooked as already mentioned).
        // So first, proceed until we reach a corner. It doesn't matter what corner we start at.
        let searchStartIndex = 1;
        while (BoundingHexagonDetector._crossProduct(convexHull, searchStartIndex-1, searchStartIndex,
            searchStartIndex+1, true) < BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION_SIN) {
            // Note that this loop will always end, as a valid convex hull has at least three corners
            ++searchStartIndex;
        }

        let lineStartIndex = searchStartIndex; // we know there was a corner at searchStartIndex, so a line starts there
        let prev = searchStartIndex, index = (prev + 1) % convexHullPointCount;
        for (let i=0; i<convexHullPointCount; ++i) {
            const next = (index + 1) % convexHullPointCount;
            if (BoundingHexagonDetector._crossProduct(convexHull, prev, index, next, true)
                >= BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION_SIN) {
                // we have a corner at index. Note that < MAX_STRAIGHT_LINE_ANGLE_DEVIATION_SIN means that two lines
                // meet at an almost 0 degree angle (in which case we consider them as a continuous straight line) or at
                // almost 180 degree (this case however is very unlikely in a convex hull and if we have this case the
                // hull will for sure fail the hexagon sanity test, so we don't need to extra check for this case).
                // At index is a corner which means the straight line ends at index.
                const lineEndIndex = index;
                const lineStartX = convexHull[lineStartIndex * 2], lineStartY = convexHull[lineStartIndex * 2 + 1],
                    lineEndX = convexHull[lineEndIndex * 2], lineEndY = convexHull[lineEndIndex * 2 + 1];
                const lineLength = Math.sqrt((lineEndX - lineStartX) * (lineEndX - lineStartX) +
                    (lineEndY - lineStartY) * (lineEndY - lineStartY));
                // insert the lines ordered by length with index 0 being the longest line
                let lineIndex;
                for (lineIndex = lineCount; lineIndex > 0; --lineIndex) {
                    if (lineLength < lineLengths[lineIndex - 1]) {
                        break;
                    }
                }
                if (lineIndex < 6) {
                    // We wanna keep this line, it's longer then one of the 6 longest lines or we don't have 6 yet.
                    // Shift the shorter lines to the right to make space for the new line. Note that the
                    // copyWithin method handles the bounds silently, e.g. does nothing if the source or target
                    // index is out of bounds ignores or copies only till the end of the buffer if the source region
                    // is larger than the target region. So we don't have to check anything ourselves.
                    lineLengths.copyWithin(lineIndex + 1, lineIndex);
                    lines.copyWithin(4 * (lineIndex + 1), 4 * lineIndex); // * 4 because of x and y of start and end
                    lineLengths[lineIndex] = lineLength;
                    lines[4 * lineIndex] = lineStartX;
                    lines[4 * lineIndex + 1] = lineStartY;
                    lines[4 * lineIndex + 2] = lineEndX;
                    lines[4 * lineIndex + 3] = lineEndY;
                    if (lineCount < 6) {
                        lineCount++;
                    }
                }
                // the end of the current line forms the start of the next line
                lineStartIndex = index;
            }
            prev = index;
            index = next;
        }
        if (lineCount < 6) {
            throw Error('Not found. Failed at: Hexagon side extraction.');
        }
        return lines;
    }


    static renderConvexHull(convexHull, canvasContext) {
        canvasContext.beginPath();
        canvasContext.moveTo(convexHull[0], convexHull[1]);
        canvasContext.fillRect(convexHull[0]-2, convexHull[1]-2, 4, 4);
        for (let i=2; i<convexHull.length; i+=2) {
            canvasContext.lineTo(convexHull[i], convexHull[i+1]);
            canvasContext.fillRect(convexHull[i]-2, convexHull[i+1]-2, 4, 4);
        }
        canvasContext.closePath();
        canvasContext.stroke();
    }


    static renderConvexHullCandidates(convexHullCandidates, canvasContext) {
        for (let i=0; i<convexHullCandidates.length; i+=2) {
            canvasContext.fillRect(convexHullCandidates[i]-1, convexHullCandidates[i+1]-1, 2, 2);
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
}

/**
 * Max allowed angle in degree between two line segments to be considered a straight line.
 * @type {number}
 */
BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION = 0.005;
BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION_SIN =
    Math.sin(BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION * Math.PI);