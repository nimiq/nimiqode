class HexagonRingDetector {
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
        return candidateSearchInitializationBufferByteLength + pointBufferByteLength;
    }


    static detectHexagonRing(boundingRect, image, buffer = null) {
        // reasoning for the calculations see calculateRequiredBufferSize
        const candidateSearchInitBufferByteLength = boundingRect.width * 2 * 2;
        const pointBufferByteLength = boundingRect.width * 2 * 2 * 2;
        let candidateSearchInitialization, pointBuffer;
        if (buffer) {
            if (buffer.byteLength !== candidateSearchInitBufferByteLength + pointBufferByteLength) {
                throw Error('Illegal Buffer.');
            }
            candidateSearchInitialization = new Uint16Array(buffer.buffer, 0, candidateSearchInitBufferByteLength / 2);
            pointBuffer = new Uint16Array(buffer.buffer, candidateSearchInitBufferByteLength,
                pointBufferByteLength / 2);
        } else {
            candidateSearchInitialization = new Uint16Array(candidateSearchInitBufferByteLength / 2);
            pointBuffer = new Uint16Array(pointBufferByteLength / 2);
        }

        // TODO make use of candidateSearchInitialization
        const convexHullCandidates = HexagonRingDetector._findCandidatePoints(boundingRect, image, pointBuffer, null);
    }


    static _findCandidatePoints(boundingRect, image, pointBuffer, searchInitialization = null) {
        // Candidate points for the convex hull are the topmost and bottommost points in every column. The points that
        // are not the topmost or bottommost are by nature inside the convex hull. At the left and and right end a not
        // not topmost or bottommost point can be exactly on the convex hull outline but can be skipped as that line
        // is already defined by the topmost and bottommost points at the left / right end.
        // We find the topmost and bottommost points by searching from the bounding rect top and bottom.

        const pixels = image.pixels, imageWidth = image.width, boundingRectWidth = boundingRect.width,
            pointsBufferLength = pointBuffer.length;
        let columnsWithCandidatesCount = 0;
        for (let column = 0; column < boundingRectWidth; ++column) {
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
            while (pixels[pixelIndex]) { // need here anymore to compare to positionTop, we know there is a black pixel
                // pixel is white, go one row up
                --positionBottom;
                pixelIndex -= imageWidth;
            }

            // save all the (x,top) in the first half of the array
            const writeIndex = columnsWithCandidatesCount * 2;
            pointBuffer[writeIndex] = x;
            pointBuffer[writeIndex + 1] = positionTop;
            // save the (x,bottom) temporarily in the second half, writing from the end in reversed order
            pointBuffer[pointsBufferLength - writeIndex - 1] = x;
            pointBuffer[pointsBufferLength - writeIndex] = positionBottom;
            ++columnsWithCandidatesCount;
        }

        // We found all the candidates. Now append the bottom candidate points to the list of top candidate points.
        // We then have the top points from left to right and the bottom points in reversed order from right to left
        // which means we store the points in a clockwise manner.
        // The copyWithin handles overlapping memory correctly.
        pointBuffer.copyWithin(columnsWithCandidatesCount * 2, -columnsWithCandidatesCount * 2);
        const resultBufferLength = columnsWithCandidatesCount * 4; // *2 for top and bottom points, again *2 for x and y
        return new Uint16Array(pointBuffer.buffer, 0, resultBufferLength);
    }
}