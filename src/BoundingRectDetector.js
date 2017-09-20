class BorderDetector {

    /**
     * Compute a bounding rect around the center.
     * The returned positions of the bounding rect are the positions of the utmost outline where each side touches a
     * black pixel.
     * @param {GrayscaleImage} binaryImage
     * @returns {{left: number, top: number, right: number, bottom: number, width: number, height: number}}
     */
    static detectBoundingRect(binaryImage) {
        // TODO we could also compute the bounding rect on the blocks from the binarizer which would be quite a speed up

        // We find the bounding rect by moving the sides towards the border until they fulfill the condition.
        // Start in the center of the image with a rectangle 20% wide and high
        const boundingRect = {
            left: Math.floor(0.4 * binaryImage.width),
            top: Math.floor(0.4 * binaryImage.height),
            right: Math.ceil(0.6 * binaryImage.width),
            bottom: Math.ceil(0.6 * binaryImage.height)
        };

        // first, extend the rectangle until it actually hits the nimiqode (any black pixels) if not already the case
        BorderDetector._extendBoundingRect(boundingRect, 1, true, binaryImage);
        // now find the bounding rect as white rectangle around the nimiqode. A thicker bounding rect border makes sure
        // that we don't cut parts of the nimiqode off if a white line crosses the nimiqode which can happen for a huge
        // ring distance. We have to guess here, what a good value would be. It's currently chosen on the rough
        // estimates that the nimiqode covers about 40% of the smaller image side, half of that size is is the empty
        // internal of the nimiqode and an average nimiqode has 7 hexagon rings. Those guesses are quite arbitrary but
        // also if this guess is really bad for the given nimiqode we should still be able to detect the nimiqode.
        const borderSize = Math.round(Math.max(Math.min(binaryImage.width, binaryImage.height) * 0.4 / 2 / 7,
            BorderDetector.BOUNDING_RECT_MIN_BORDER_WIDTH));
        BorderDetector._extendBoundingRect(boundingRect, borderSize, false, binaryImage);

        // the bounding rect position we got are the position of the first white lines of the white border. However, we
        // want the utmost outline where each side touches a black pixel, so we have to add / subtract 1
        return {
            left: boundingRect.left + 1,
            top: boundingRect.top + 1,
            right: boundingRect.right - 1,
            bottom: boundingRect.bottom - 1,
            // calculate width and height. Add 1 because right / bottom are inclusive boundaries
            width: boundingRect.right - boundingRect.left + 1,
            height: boundingRect.bottom - boundingRect.top + 1
        };
    }


    static _extendBoundingRect(boundingRect, requiredSubsequentLines, invertCondition, image) {
        const sides = ['left', 'top', 'right', 'bottom'];
        let sideNeedsToBeChecked = [true, true, true, true];
        let sideIndex = 0;
        // check repeatedly through all the sides until they are all okay
        while (sideNeedsToBeChecked[0] || sideNeedsToBeChecked[1]
        || sideNeedsToBeChecked[2] || sideNeedsToBeChecked[3]) {
            if (sideNeedsToBeChecked[sideIndex]) {
                if (BorderDetector._extendBoundingRectBySide(boundingRect, sides[sideIndex], requiredSubsequentLines,
                        invertCondition, image)) {
                    // if the side position changed the neighbouring sides got longer and need to be checked again
                    sideNeedsToBeChecked[(sideIndex + 1) % 4] = true; // the side clockwise from me
                    sideNeedsToBeChecked[(sideIndex + 3) % 4] = true; // the side counter clockwise from me
                }
                sideNeedsToBeChecked[sideIndex] = false;
            }
            sideIndex = (sideIndex + 1) % 4;
        }
    }


    static _extendBoundingRectBySide(boundingRect, side, requiredSubsequentLines, invertCondition, image) {
        let linePosition = boundingRect[side];
        const initialLinePosition = linePosition;
        let lineStart, lineEnd, lineCheck, step, border;
        if (side === 'top' || side === 'bottom') {
            lineStart = boundingRect['left'];
            lineEnd = boundingRect['right'];
            lineCheck = BorderDetector._isHorizontalLineWhite;
            if (side === 'top') {
                step = -1;
                border = 0;
            } else { // bottom
                step = 1;
                border = image.height - 1;
            }
        } else { // left or right
            lineStart = boundingRect['top'];
            lineEnd = boundingRect['bottom'];
            lineCheck = BorderDetector._isVerticalLineWhite;
            if (side === 'left') {
                step = -1;
                border = 0;
            } else {
                step = 1;
                border = image.width - 1;
            }
        }

        let subsequentLines = 0;
        while (subsequentLines < requiredSubsequentLines) {
            if (linePosition === border) {
                throw Error('Not found. Failed at: bounding rect detection.');
            }
            if (lineCheck(linePosition, lineStart, lineEnd, image) ^ invertCondition) {
                subsequentLines++;
            } else {
                subsequentLines = 0;
            }
            linePosition += step;
        }

        // we found a border of requiredSubsequentLines many lines that fulfill the condition, now we need to remove it
        // again from the position.
        linePosition -= requiredSubsequentLines * step;
        boundingRect[side] = linePosition;
        // return whether the position has changed.
        return linePosition !== initialLinePosition;
    }


    static _isHorizontalLineWhite(y, left, right, image) {
        const pixels = image.pixels;
        const lineEnd = y * image.width + right;
        for (let pos = y * image.width + left; pos <= lineEnd; ++pos) { // "<=" because right is included
            if (!pixels[pos]) {
                // it's a black pixel
                return false;
            }
        }
        return true;
    }


    static _isVerticalLineWhite(x, top, bottom, image) {
        const imageWidth = image.width;
        const pixels = image.pixels;
        const lineEnd = bottom * imageWidth + x;
        for (let pos = top * imageWidth + x; pos <= lineEnd; pos += imageWidth) { // "<=" because bottom is included
            if (!pixels[pos]) {
                // it's a black pixel
                return false;
            }
        }
        return true;
    }


    static calculateRequiredBufferSize(borderRect) {
        // we have the upper side and lower side of the convex hull, at most borderRect.width points per side
        const candidateCount = 2 * borderRect.width;
        // The current convex hull candidate point search positions, one int16 (2 byte) entry per candidate
        const candidateSearchPositionsBufferLength = candidateCount * 2;
        // The candidate points / after in-place convex hull detection the convex hull. x and y per candidate, each
        // an uint16 (2 byte).
        const hullBufferLength = candidateCount * 2 * 2;
        return candidateSearchPositionsBufferLength + hullBufferLength;
    }
}
BorderDetector.BOUNDING_RECT_MIN_BORDER_WIDTH = 5;