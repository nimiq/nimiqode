class HexagonRingDetector {
    static detectHexagonRings(boundingHexagon, image, debugCallback) {
        const startCorner = HexagonRingDetector._findStartCorner(boundingHexagon, image, debugCallback);
        // reorder the corners such that the start corner is corner 0
        const boundingHexCorners = [];
        for (let i=0; i<6; ++i) {
            boundingHexCorners[i] = boundingHexagon.corners[(i + startCorner) % 6];
        }
        boundingHexagon.corners = boundingHexCorners;
        // create the innermost hexagon ring as we always have at least one hexagon ring
        const hexagonRings = [];
        hexagonRings.push(Nimiqode.createHexagonRing(0));
        // From that one hexagon ring calculate a preliminary transformation matrix. We can take any 4 of the 6 points
        // in correspondence.
        const innerCorners = hexagonRings[0].virtualCorners;
        const preliminaryTransformationMatrix = PerspectiveTransformationMatrix.fromCorrespondingPoints(
            innerCorners[1], innerCorners[2], innerCorners[4], innerCorners[5],
            boundingHexCorners[1], boundingHexCorners[2], boundingHexCorners[4], boundingHexCorners[5]);
        const preliminaryInverseTransform = preliminaryTransformationMatrix.copy().invert();
        // find the number of hexagon rings
        const hexagonRingCount = HexagonRingDetector._findHexagonRingCount(boundingHexagon, preliminaryInverseTransform,
            image, debugCallback);
        // create the remaining hexagon rings
        for (let i=1; i<hexagonRingCount; ++i) {
            hexagonRings.push(Nimiqode.createHexagonRing(i));
        }
        // calculate the actual transformation matrix. The preliminary one mapped the innermost hex ring to the bounding
        // hex in the image, thus scaling up. We correct the transformation now by first scaling down and in this
        // process also take the line width into account such that the points get mapped to the line middle instead of
        // the outer side of the lines. We divide the line width by 3 instead of 2 as the lines we get in the binarized
        // image are a little thinner.
        const scalingFactor = hexagonRings[0].outerRadius /
            (hexagonRings[hexagonRingCount-1].outerRadius + NimiqodeSpecification.HEXRING_LINE_WIDTH/3);
        const transformationMatrix = PerspectiveTransformationMatrix.fromScalingFactor(scalingFactor)
            .multiplyWithMatrix(preliminaryTransformationMatrix);
        // TODO check innermost finder pattern and swap if needed
        return [hexagonRings, transformationMatrix];
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


    static _findHexagonRingCount(boundingHexagon, inversePerspectiveTransform, image, debugCallback) {
        // We find the count of hex rings by traversing the clockwise and counterclockwise finder pattern.
        // First find the finder pattern.
        const finderPatternStartCCW =
            HexagonRingDetector._findFinderPatternStart(boundingHexagon, 'counterclockwise', image);
        const finderPatternStartCW =
            HexagonRingDetector._findFinderPatternStart(boundingHexagon, 'clockwise', image);
        // Now traverse the pattern (do this before checking single hex ring case to use not transformed points)
        const [marksFoundCCW, markDistancesCCW, debugOriginalMarkPointsCCW] =
            HexagonRingDetector._traverseFinderPattern(boundingHexagon, finderPatternStartCCW,
                inversePerspectiveTransform, image, debugCallback);
        const [marksFoundCW, markDistancesCW, debugOriginalMarkPointsCW] =
            HexagonRingDetector._traverseFinderPattern(boundingHexagon, finderPatternStartCW,
                inversePerspectiveTransform, image, debugCallback);

        // check for special case of just one hexagon ring in nimiqode. In this case the only hexagon ring we have is
        // the one with index 0 in which one of the finder patterns is empty, i.e. not existent.
        // TODO remove support for single ring nimiqode
        inversePerspectiveTransform.transform(finderPatternStartCCW);
        inversePerspectiveTransform.transform(finderPatternStartCW);
        const distanceFinderPatternCCW = finderPatternStartCCW.distanceTo(boundingHexagon.corners[0]);
        const distanceFinderPatternCW = finderPatternStartCW.distanceTo(boundingHexagon.corners[0]);
        // on shorter distance we encountered the pattern, on larger distance only when > 1 hex ring.
        const shorterDistanceFinderPattern = Math.min(distanceFinderPatternCCW, distanceFinderPatternCW);
        const longerDistanceFinderPattern = Math.max(distanceFinderPatternCCW, distanceFinderPatternCW);
        const scaleFactor = shorterDistanceFinderPattern / NimiqodeSpecification.HEXRING_START_END_OFFSET;
        const assumedSlotLength = scaleFactor * NimiqodeSpecification.HEXRING_SLOT_LENGTH;
        const assumedSlotDistance = scaleFactor * NimiqodeSpecification.HEXRING_SLOT_DISTANCE;
        const assumedDistanceNextSlot = shorterDistanceFinderPattern + assumedSlotLength + assumedSlotDistance;
        if (longerDistanceFinderPattern >= assumedDistanceNextSlot) {
            // seems like the finder pattern is empty and the slot we saw was the second or later. So assume we have
            // only one ring.
            if (debugCallback) {
                const shorterCCW = distanceFinderPatternCCW < distanceFinderPatternCW;
                debugCallback('finder-pattern', {
                    counterclockwise: shorterCCW? [finderPatternStartCCW] : [],
                    clockwise: shorterCCW? [] : [finderPatternStartCW]
                });
            }
            return 1;
        }

        // Okay, we have more than one hex ring, so the results we got by traversing the pattern is valid.
        if (debugCallback) {
            debugCallback('finder-pattern', {
                counterclockwise: debugOriginalMarkPointsCCW,
                clockwise: debugOriginalMarkPointsCW
            });
        }
        if (marksFoundCCW === marksFoundCW) {
            throw Error('Not found. Finder patterns have same length.');
        }
        // Check whether the distances we got on both sides are about the same.
        for (let i=0; i<Math.min(markDistancesCCW.length, markDistancesCW.length); ++i) {
            if (Math.max(markDistancesCCW[i], markDistancesCW[i]) / Math.min(markDistancesCCW[i], markDistancesCW[i]) >
                HexagonRingDetector.FINDER_PATTERN_MARK_DISTANCE_TOLERANCE)
                throw Error('Not found. Mark distance mismatch between counterclockwise and clockwise finder pattern.');
        }

        // The number of hex rings can be retrieved as the smaller of the counts of marks found on the finder
        // patterns plus one. Plus one because the slot of the innermost hex ring is empty on the shorter finder.
        // Note that we can't make any conclusions of the mark count of the longer pattern as it might have matched
        // additional marks from the inside of the nimiqode / nimiqon. So the longer pattern is just needed for
        // recognizing on which side the shorter pattern is.
        return Math.min(marksFoundCCW, marksFoundCW) + 1;
    }


    static _findFinderPatternStart(boundingHexagon, direction, image) {
        // Find the finder pattern by searching from corner 0 to the clockwise/counterclockwise neighbor corner.
        const neighbour = direction==='counterclockwise'? 1 : 5;
        let searchStartX = boundingHexagon.corners[0].x,
            searchStartY = boundingHexagon.corners[0].y;
        const searchEndX = boundingHexagon.corners[neighbour].x,
            searchEndY = boundingHexagon.corners[neighbour].y;
        // First be sure to actually get into the empty white zone between orientation finder and finder pattern to not
        // confuse the orientation finder as the finder pattern. Here we use a square stencil along the line instead of
        // _executeFunctionAlongLineAndLineWidth (a perpendicular line stencil) because it might happen that we are
        // in the white zone behind the orientation finder, so we wanna use a square to also search ahead.
        let found = HexagonRingDetector._executeFunctionAlongLine(searchStartX, searchStartY, searchEndX, searchEndY,
            (x, y) => {
                if (!HexagonRingDetector._containsBlackInNeighbourhood(x, y, image)) {
                    searchStartX = x;
                    searchStartY = y;
                    return true;
                }
                return false;
            });
        if (!found) {
            // this can happen e.g. if the scan is so small that the empty zone is smaller than the search neighbourhood
            throw Error('Not found. Couldn\'t find empty zone between orientation finder and finder pattern.');
        }
        // From here search until we hit the finder pattern
        let patternStartX = -1, patternStartY = -1;
        found = HexagonRingDetector._executeFunctionAlongLineAndLineWidth(searchStartX, searchStartY,
            searchEndX, searchEndY, HexagonRingDetector.SEARCH_LINE_WIDTH,
            (x, y) => image.getPixel(x, y) === 0, // is the pixel black ?
            (x, y, blackFound) => {
                if (blackFound) {
                    patternStartX = x;
                    patternStartY = y;
                    return true;
                }
                return false;
            });
        if (!found) {
            // No black pixel found. Should not actually happen, as we retrieved the bounding hexagon from black pixels.
            throw Error('Not found. Couldn\'t find finder pattern.');
        }
        return new Point(patternStartX, patternStartY);
    }


    static _traverseFinderPattern(boundingHexagon, finderStart, inversePerspectiveTransform, image, debug) {
        // Find the line on which the finder pattern is located. This is a parallel to the orientation finder (line
        // between corner 0 and center) and starts at finderStart
        const offsetX = finderStart.x - boundingHexagon.corners[0].x,
            offsetY = finderStart.y - boundingHexagon.corners[0].y;
        const searchEndX = boundingHexagon.center.x + offsetX,
            searchEndY = boundingHexagon.center.y + offsetY;
        // Traverse the finder pattern and look for marks as changes from white to black
        let marksFound = 0;
        const markDistances = []; // distances between found marks starts, projected to reference coordinate system
        let lastPositionWasWhite = true;
        let lastMarkStart;
        const debugOriginalMarkPoints = debug? [] : null;
        HexagonRingDetector._executeFunctionAlongLineAndLineWidth(finderStart.x, finderStart.y, searchEndX, searchEndY,
            HexagonRingDetector.SEARCH_LINE_WIDTH,
            (x, y) => image.getPixel(x, y) === 0, // is the pixel black ?
            (x, y, blackFound) => {
                if (blackFound && lastPositionWasWhite) {
                    // change from white to black, thus we've found a new mark
                    const mark = new Point(x, y);
                    if (debug) {
                        debugOriginalMarkPoints.push(mark.copy());
                    }
                    // Transform the mark to a reference coordinate system where distances are directly comparable
                    // without perspective.
                    inversePerspectiveTransform.transform(mark);
                    if (marksFound) {
                        // already found a black mark before
                        const distance = mark.distanceTo(lastMarkStart);
                        // check whether distance is out of range
                        for (const prevDist of markDistances) {
                            if (Math.max(distance, prevDist) / Math.min(distance, prevDist) >
                                HexagonRingDetector.FINDER_PATTERN_MARK_DISTANCE_TOLERANCE) {
                                // More than 20% difference in length. We'll not consider this another object along the
                                // finder pattern anymore.
                                if (debug) {
                                    // pop that invalid point
                                    debugOriginalMarkPoints.pop();
                                }
                                return true; // stop the search
                            }
                        }
                        markDistances.push(distance);
                    }
                    ++marksFound;
                    lastMarkStart = mark;
                }
                lastPositionWasWhite = !blackFound;
                return false; // continue the search
            });

        return [marksFound, markDistances, debugOriginalMarkPoints];
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


    static _containsBlackInNeighbourhood(x, y, image, neighbourSize = HexagonRingDetector.SEARCH_NEIGHBOURHOOD_SIZE) {
        const pixels = image.pixels;
        // no need to test whether out of image bounds as the pixels will just give undefined for pixels out of range
        const left = Math.round(x - neighbourSize / 2),
            top = Math.round(y - neighbourSize / 2);
        let rowStart = top * image.width + left;
        for (let yIndex = 0; yIndex < neighbourSize; ++yIndex) {
            for (let xIndex = 0; xIndex < neighbourSize; ++xIndex) {
                if (pixels[rowStart + xIndex] === 0) {
                    // it's a black pixel
                    return true;
                }
            }
            rowStart += image.width;
        }
        return false;
    }


    static _readFinderPatternSlots(hexagonRing, transformationMatrix, image) {
        const [counterclockwiseLocation,] = hexagonRing.getFinderPatternSlotLocation('counterclockwise');
        transformationMatrix.transform(counterclockwiseLocation);
        const counterclockwiseSet = HexagonRingDetector._containsBlackInNeighbourhood(counterclockwiseLocation.x,
            counterclockwiseLocation.y, image, 2);
        const [clockwiseLocation,] = hexagonRing.getFinderPatternSlotLocation('clockwise');
        transformationMatrix.transform(clockwiseLocation);
        const clockwiseSet = HexagonRingDetector._containsBlackInNeighbourhood(clockwiseLocation.x,
            clockwiseLocation.y, image, 2);
        hexagonRing.setFinderPattern(counterclockwiseSet, clockwiseSet);
    }


    static readDataSlots(hexagonRing, transformationMatrix, image) {
        for (let i=0; i < hexagonRing.bitCount; ++i) {
            const [slotLocation,] = hexagonRing.getDataSlotLocation(i);
            transformationMatrix.transform(slotLocation);
            hexagonRing.data.setValue(i, HexagonRingDetector._containsBlackInNeighbourhood(slotLocation.x,
                slotLocation.y, image, 2));
        }
    }
}
HexagonRingDetector.SEARCH_LINE_WIDTH = 6;
HexagonRingDetector.SEARCH_NEIGHBOURHOOD_SIZE = 6;
HexagonRingDetector.FINDER_PATTERN_MARK_DISTANCE_TOLERANCE = 1.2;