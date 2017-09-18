class ImagePreprocessor {

    /**
     * Convert to luma grayscale, binarize and find the bounding rect.
     * The rgbaImage gets changed in the process.
     * @param {ImageData} rgbaImage
     */
    static preprocess(rgbaImage) {
        const imageWidth = rgbaImage.width, imageHeight = rgbaImage.height;
        // we allocate the buffers for luma and the binary image within the buffer of the original rgb image data
        // to reduce the required memory. We can do this, as we won't need the rgb anymore after grayscale calculation.
        // Note that the rgba buffer has 4 bytes per pixel, thus size 4 * this._imageSize.
        const grayscaleImageBufferSize = GrayscaleImage.calculateRequiredBufferSize(imageWidth, imageHeight);
        const grayscaleImage = GrayscaleImage.fromRgba(rgbaImage,
            new Uint8ClampedArray(rgbaImage.data.buffer, 0, grayscaleImageBufferSize));
        const binaryImage = new GrayscaleImage(imageWidth, imageHeight,
            new Uint8ClampedArray(rgbaImage.data.buffer, grayscaleImageBufferSize, grayscaleImageBufferSize));
        const binarizerBufferSize = Binarizer.calculateRequiredBufferSize(imageWidth, imageHeight);
        const binarizerBuffer = new Uint8ClampedArray(rgbaImage.data.buffer, 2 * grayscaleImageBufferSize,
            binarizerBufferSize);
        Binarizer.binarize(grayscaleImage, binaryImage, binarizerBuffer);
        return [grayscaleImage, binaryImage];
    }



}