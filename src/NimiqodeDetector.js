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
    static detect(rgbaImage, debugCallback = null) {
        const imageWidth = rgbaImage.width, imageHeight = rgbaImage.height;
        // we allocate the buffers for luma and the binary image and other arrays within the buffer of the original rgb
        // image data to reduce the required heap memory. We can do this, as we won't need the rgb anymore after
        // grayscale conversion.
        // Note that the rgba buffer has 4 bytes per pixel, thus size 4 * imageWidth * imageHeight.
        const imageBufferSize = GrayscaleImage.calculateRequiredBufferSize(imageWidth, imageHeight);
        const image = GrayscaleImage.fromRgba(rgbaImage,
            new Uint8ClampedArray(rgbaImage.data.buffer, 0, imageBufferSize));
        if (debugCallback) {
            debugCallback('grayscale-image', image);
        }
        // binarize
        const binarizerBufferSize = Binarizer.calculateRequiredBufferSize(imageWidth, imageHeight);
        const binarizerBuffer = new Uint8ClampedArray(rgbaImage.data.buffer, imageBufferSize, binarizerBufferSize);
        Binarizer.binarize(image, image, binarizerBuffer); // this overwrites the grayscale image
        if (debugCallback) {
            debugCallback('binary-image', image);
        }
        // detect bounding rect
        const boundingRect = BoundingRectDetector.detectBoundingRect(image);
        if (debugCallback) {
            debugCallback('bounding-rect', boundingRect);
        }
        // detect hexagon ring
        const hexRingDetectorBufferSize = BoundingHexagonDetector.calculateRequiredBufferSize(boundingRect);
        const hexRingDetectorBuffer = new Uint8ClampedArray(rgbaImage.data.buffer,
            imageBufferSize + binarizerBufferSize, hexRingDetectorBufferSize);
        BoundingHexagonDetector.detectBoundingHexagon(boundingRect, image, hexRingDetectorBuffer, debugCallback);
    }



}