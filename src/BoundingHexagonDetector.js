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
        // Buffer for lengths of 6 sides, each an uint16
        const sideLengthsBufferByteLength = 6 * 2;
        // Buffer for the 6 longest sides of the convex hull, for each start and end point, for each x and y, all
        // numbers Uint16
        const longestSidesBufferByteLength = 6 * 2 * 2 * 2;
        // Buffer for 6 corner points, for each x and y, each a float32
        const boundingHexagonBufferByteLength = 6 * 2 * 4;
        return candidateSearchInitializationBufferByteLength + pointBufferByteLength + sideLengthsBufferByteLength
            + longestSidesBufferByteLength + boundingHexagonBufferByteLength;
    }


    static detectBoundingHexagon(boundingRect, image, buffer = null, debugCallback = null) {
        // reasoning for the calculations see calculateRequiredBufferSize
        const candidateSearchInitBufferByteLength = boundingRect.width * 2 * 2;
        const pointBufferByteLength = boundingRect.width * 2 * 2 * 2;
        const sideLengthsBufferByteLength = 6 * 2;
        const longestSidesBufferByteLength = 6 * 2 * 2 * 2;
        const boundingHexagonBufferByteLength = 6 * 2 * 4;
        let candidateSearchInitialization, pointBuffer, sideLengthsBuffer, longestSidesBuffer, boundingHexagonBuffer;
        if (buffer) {
            if (buffer.byteLength !== candidateSearchInitBufferByteLength + pointBufferByteLength
                + sideLengthsBufferByteLength + longestSidesBufferByteLength + boundingHexagonBufferByteLength) {
                throw Error('Illegal Buffer.');
            }
            candidateSearchInitialization = new Uint16Array(buffer.buffer, buffer.byteOffset,
                candidateSearchInitBufferByteLength / 2); // /2 because of Uint16
            pointBuffer = new Uint16Array(buffer.buffer, buffer.byteOffset + candidateSearchInitBufferByteLength,
                pointBufferByteLength / 2);
            sideLengthsBuffer = new Uint16Array(buffer.buffer, pointBuffer.byteOffset + pointBufferByteLength,
                sideLengthsBufferByteLength / 2);
            longestSidesBuffer = new Uint16Array(buffer.buffer, sideLengthsBuffer.byteOffset +
                sideLengthsBufferByteLength, longestSidesBufferByteLength / 2);
            boundingHexagonBuffer = new Float32Array(buffer.buffer, longestSidesBuffer.byteOffset +
                longestSidesBufferByteLength, longestSidesBufferByteLength / 4); // /4 because of Float32
        } else {
            candidateSearchInitialization = new Uint16Array(candidateSearchInitBufferByteLength / 2);
            pointBuffer = new Uint16Array(pointBufferByteLength / 2);
            sideLengthsBuffer = new Uint16Array(sideLengthsBufferByteLength / 2);
            longestSidesBuffer = new Uint16Array(longestSidesBufferByteLength / 2);
            boundingHexagonBuffer = new Float32Array(boundingHexagonBufferByteLength / 4);
        }

        // TODO if one would like to call this method again to find inner hexagons (after the outer one has been
        // removed), one could use the previous candidate points as initialization for the candidate search
        const convexHullCandidates = BoundingHexagonDetector._findConvexHullCandidatePoints(boundingRect, image,
            pointBuffer, null);
        if (debugCallback) {
            debugCallback('convex-hull-candidates', convexHullCandidates);
        }
        const convexHull = BoundingHexagonDetector._calculateConvexHull(convexHullCandidates);
        if (debugCallback) {
            debugCallback('convex-hull', convexHull);
        }
        const longestConvexHullSides = BoundingHexagonDetector._findLongestSides(convexHull, 6, longestSidesBuffer,
            sideLengthsBuffer);
        if (debugCallback) {
            debugCallback('longest-convex-hull-sides', longestConvexHullSides);
        }

        return BoundingHexagonDetector._boundingHexagonFromConvexHullSides(longestConvexHullSides,
            boundingHexagonBuffer, sideLengthsBuffer);
    }


    static _findConvexHullCandidatePoints(boundingRect, image, pointBuffer, searchInitialization = null) {
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


    static _findLongestSides(convexHull, count, sidesBuffer, lengthsBuffer) {
        // Find the count longest straight lines in the convex hull.
        // Note that the line parts of the hexagon ring that should be completely straight (index.e. should be in the convex
        // hull a single line segment defined by start and end point) are in reality in the scanned image often times
        // combined of several minimally crooked line parts (because of discrete pixel positions, anti aliasing during
        // render, thresholding in the binarizer combined with out of focus/motion blur, ...). So we have to search for
        // line parts that differ only very little in angle and thus effectively form a straight line.
        const convexHullPointCount = convexHull.length / 2; // /2 because of x and y for every point
        const lines = new Uint16Array(sidesBuffer.buffer, sidesBuffer.byteOffset, count * 2); // index of start and end.
        // Note that this buffer is allocated within sidesBuffer as the point indices get later translated into the
        // coordinates and we don't need the indices anymore then.
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
                let lineRank;
                for (lineRank = lineCount; lineRank > 0; --lineRank) {
                    if (lineLength < lengthsBuffer[lineRank - 1]) {
                        break;
                    }
                }
                if (lineRank < count) {
                    // We wanna keep this line, it's longer then one of the count longest lines or don't have count yet.
                    // Shift the shorter lines to the right to make space for the new line. Note that the
                    // copyWithin method handles the bounds silently, e.g. does nothing if the source or target
                    // index is out of bounds ignores or copies only till the end of the buffer if the source region
                    // is larger than the target region. So we don't have to check anything ourselves.
                    lengthsBuffer.copyWithin(lineRank + 1, lineRank);
                    lines.copyWithin(2 * (lineRank + 1), 2 * lineRank); // * 2 because of index of start and end
                    lengthsBuffer[lineRank] = lineLength; // gets rounded to int
                    lines[2 * lineRank] = lineStartIndex;
                    // When looping over index 0 the last line can have a smaller end index than start index due to the
                    // modulo computation of indices. However, for later sorting, we want end indices to be always
                    // larger than start indices.
                    lines[2 * lineRank + 1] = lineEndIndex < lineStartIndex?
                        lineEndIndex + convexHullPointCount : lineEndIndex;
                    if (lineCount < count) {
                        lineCount++;
                    }
                }
                // the end of the current line forms the start of the next line
                lineStartIndex = index;
            }
            prev = index;
            index = next;
        }
        if (lineCount < count) {
            throw Error('Not found. Failed at: Longest side extraction.');
        }
        // We now have the lines ordered by length. We wanna bring them back to counterclockwise order starting at the
        // right, just like the points. Therefore we can simply sort the points by their start or end indices. Note that
        // no two lines overlap, i.e. there is no line which has a start index within the start / end index range of
        // another line and as we made sure that the end index is always larger than the start index, we can just sort
        // the whole array.
        lines.sort();
        // translate the start / end point indices into coordinates
        for (let i=count-1; i>=0; --i) { //loop from end to start to not overwrite entries in lines buffer we still need
            const startIndex = lines[2 * i], endIndex = lines[2 * i + 1] % convexHullPointCount;
            const startX = convexHull[2 * startIndex], startY = convexHull[2 * startIndex + 1],
                endX = convexHull[2 * endIndex], endY = convexHull[2 * endIndex + 1];
            sidesBuffer[i * 4] = startX;
            sidesBuffer[i * 4 + 1] = startY;
            sidesBuffer[i * 4 + 2] = endX;
            sidesBuffer[i * 4 + 3] = endY;
        }
        return sidesBuffer;
    }


    static _boundingHexagonFromConvexHullSides(sides, boundingHexagonBuffer, lengthsBuffer) {
        // calculate the intersections of the sides
        for (let i=0; i<6; ++i) {
            // see https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line
            const neighbour = (i + 1) % 6;
            const line1StartX = sides[4 * i], line1StartY = sides[4 * i + 1],
                line1EndX = sides[4 * i + 2], line1EndY = sides[4 * i + 3],
                line2StartX = sides[4 * neighbour], line2StartY = sides[4 * neighbour + 1],
                line2EndX = sides[4 * neighbour + 2], line2EndY = sides[4 * neighbour + 3];
            if (!BoundingHexagonDetector._calculateLineIntersection(line1StartX, line1StartY, line1EndX, line1EndY,
                    line2StartX, line2StartY, line2EndX, line2EndY, boundingHexagonBuffer, i * 2)) {
                throw Error('Not found. Convex hull is not a hexagon.');
            }
        }

        // calculate the side lengths
        let averageLength = 0;
        for (let i=0; i<6; ++i) {
            const neighbour = (i + 1) % 6;
            const deltaX = boundingHexagonBuffer[2 * i] - boundingHexagonBuffer[neighbour * 2],
                deltaY = boundingHexagonBuffer[2 * i + 1] - boundingHexagonBuffer[neighbour * 2 + 1];
            const sideLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            averageLength += sideLength / 6;
            lengthsBuffer[i] = sideLength; // gets rounded to int
        }

        // check whether sides are similarly long. Note that if the sides are similarly long, then the angles between
        // them are also similar (not true in general, but in our case as we got the lines based on the convex hull)
        const maxSideLengthDeviation = averageLength * BoundingHexagonDetector.MAX_SIDE_LENGTH_DEVIATION_PERCENT;
        for (let i=0; i<6; ++i) {
            if (Math.abs(lengthsBuffer[i] - averageLength) > maxSideLengthDeviation) {
                throw Error('Not found. Convex hull is not a regular hexagon.');
            }
        }

        // find the center
        // don't need the lengths anymore and reuse the buffer
        let centerCoords = new Float32Array(lengthsBuffer.buffer, lengthsBuffer.byteOffset, 2);
        let centerX = 0, centerY = 0;
        for (let i=0; i<3; ++i) {
            const oppositeCorner = (i + 3) % 6;
            const neighbor = i + 1;
            const neighborOppositeCorner = (neighbor + 3) % 6;
            BoundingHexagonDetector._calculateLineIntersection(
                boundingHexagonBuffer[i * 2], boundingHexagonBuffer[i * 2 + 1],
                boundingHexagonBuffer[oppositeCorner * 2], boundingHexagonBuffer[oppositeCorner * 2 + 1],
                boundingHexagonBuffer[neighbor * 2], boundingHexagonBuffer[neighbor * 2 + 1],
                boundingHexagonBuffer[neighborOppositeCorner * 2], boundingHexagonBuffer[neighborOppositeCorner * 2 +1],
                centerCoords, 0);
            centerX += centerCoords[0] / 3;
            centerY += centerCoords[1] / 3;
        }

        return {
            corners: boundingHexagonBuffer,
            center: new Point(centerX, centerY)
        };
    }


    static _calculateLineIntersection(line1StartX, line1StartY, line1EndX, line1EndY,
                                      line2StartX, line2StartY, line2EndX, line2EndY,
                                      outputBuffer, outputWriteIndex) {
        const line1DeltaX = line1StartX - line1EndX, line1DeltaY = line1StartY - line1EndY,
            line2DeltaX = line2StartX - line2EndX, line2DeltaY = line2StartY - line2EndY;
        const denominator = line1DeltaX * line2DeltaY - line1DeltaY * line2DeltaX;
        if (denominator === 0) {
            // lines are parallel or collinear
            return false;
        }
        const factor1 = line1StartX * line1EndY - line1StartY * line1EndX,
            factor2 = line2StartX * line2EndY - line2StartY * line2EndX;
        outputBuffer[outputWriteIndex] = (factor1 * line2DeltaX - factor2 * line1DeltaX) / denominator;
        outputBuffer[outputWriteIndex + 1] = (factor1 * line2DeltaY - factor2 * line1DeltaY) / denominator;
        return true;
    }


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


    static renderBoundingHexagon(boundingHexagon, canvasContext) {
        // render diagonals
        const corners = boundingHexagon.corners;
        canvasContext.beginPath();
        for (let i=0; i<3; ++i) {
            const oppositeCorner = (i + 3) % 6;
            canvasContext.moveTo(corners[2 * i], corners[2 * i + 1]);
            canvasContext.lineTo(corners[2 * oppositeCorner], corners[2 * oppositeCorner + 1]);
        }
        canvasContext.stroke();
        canvasContext.fillRect(boundingHexagon.center.x - 2, boundingHexagon.center.y - 2, 4, 4);
        BoundingHexagonDetector.renderPolygon(corners, canvasContext);
    }
}

/**
 * Max allowed angle in degree between two line segments to be considered a straight line.
 * @type {number}
 */
BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION = 0.005;
BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION_SIN =
    Math.sin(BoundingHexagonDetector.MAX_STRAIGHT_LINE_ANGLE_DEVIATION * Math.PI);
BoundingHexagonDetector.MAX_SIDE_LENGTH_DEVIATION_PERCENT = 0.25;