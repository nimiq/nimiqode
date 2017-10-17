class NimiqodeDetector {

    /**
     * @callback debugCallback
     * @param {string} eventType
     * @param {*} data
     */

    /**
     * Detect a nimiqode.
     * The rgbaImage gets changed in the process.
     * @param {ImageData} rgbaImage
     * @param {debugCallback} debugCallback
     */
    static async detect(rgbaImage, debugCallback = null) {
        const imageWidth = rgbaImage.width, imageHeight = rgbaImage.height;
        // we allocate the buffers for luma and the binary image and other arrays within the buffer of the original rgb
        // image data to reduce the required heap memory. We can do this, as we won't need the rgb anymore after
        // grayscale conversion.
        // Note that the rgba buffer has 4 bytes per pixel, thus size 4 * imageWidth * imageHeight.
        const imageBufferSize = GrayscaleImage.calculateRequiredBufferSize(imageWidth, imageHeight);
        const grayscaleImage = GrayscaleImage.fromRgba(rgbaImage,
            new Uint8ClampedArray(rgbaImage.data.buffer, 0, imageBufferSize));
        const binaryImage = new GrayscaleImage(imageWidth, imageHeight,
            new Uint8ClampedArray(rgbaImage.data.buffer, imageBufferSize, imageBufferSize));

        // try to scan the inverted and not inverted image
        for (let i=0; i<2; ++i) {
            grayscaleImage.invert();
            if (debugCallback) {
                debugCallback('grayscale-image', grayscaleImage);
            }
            try {
                // binarize
                const binarizerBufferSize = Binarizer.calculateRequiredBufferSize(imageWidth, imageHeight);
                const binarizerBuffer = new Uint8ClampedArray(rgbaImage.data.buffer, 2*imageBufferSize,
                    binarizerBufferSize);
                Binarizer.binarize(grayscaleImage, binaryImage, binarizerBuffer);
                if (debugCallback) {
                    debugCallback('binary-image', binaryImage);
                }
                // detect bounding rect
                const boundingRect = BoundingRectDetector.detectBoundingRect(binaryImage);
                if (debugCallback) {
                    debugCallback('bounding-rect', boundingRect);
                }
                // detect bounding hexagon
                const hexRingDetectorBufferSize = BoundingHexagonDetector.calculateRequiredBufferSize(boundingRect);
                const hexRingDetectorBuffer = new Uint8ClampedArray(rgbaImage.data.buffer,
                    2*imageBufferSize + binarizerBufferSize, hexRingDetectorBufferSize);
                const boundingHexagon = BoundingHexagonDetector.detectBoundingHexagon(boundingRect, binaryImage,
                    hexRingDetectorBuffer, debugCallback);
                if (debugCallback) {
                    debugCallback('bounding-hexagon', boundingHexagon);
                }
                // detect hexagon rings
                const [hexagonRings, perspectiveTransform] = HexagonRingDetector.detectHexagonRings(boundingHexagon,
                    binaryImage, debugCallback);
                // read the data bits
                const totalBits = hexagonRings.reduce((count, hexRing) => count + hexRing.bitCount, 0);
                const data = new BitArray(totalBits);
                Nimiqode.assignHexagonRingData(hexagonRings, data);
                for (const hexRing of hexagonRings) {
                    HexagonRingDetector.readDataSlots(hexRing, perspectiveTransform, binaryImage);
                }
                if (debugCallback) {
                    debugCallback('hexagon-rings', [hexagonRings, perspectiveTransform]);
                    debugCallback('data', data);
                }
                const nimiqode = await new Nimiqode(hexagonRings, data);
                if (debugCallback) {
                    debugCallback('nimiqode', nimiqode);
                }
                return nimiqode;
            } catch(e) {
                if (i === 1) {
                    // we tried the inverted and not inverted image and both failed
                    throw e;
                }
            }
            // we just want to see the debug info for the first try
            //debugCallback = null;
        }

    }
}