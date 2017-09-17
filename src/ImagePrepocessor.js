class ImagePreprocessor {

    /**
     * Convert to luma grayscale, binarize and find the bounding rect.
     * The rgbaImageData gets changed in the process.
     * @param {ImageData} rgbaImageData
     */
    static preprocess(rgbaImageData) {
        const imageSize = rgbaImageData.width * rgbaImageData.height;
        // we allocate the buffers for luma and the binary image within the buffer of the original rgb image data
        // to reduce the required memory. We can do this, as we won't need the rgb anymore after grayscale calculation.
        // Note that the rgba buffer has 4 bytes per pixel, thus size 4 * this._imageSize.
        const lumaImage = new GrayscaleImage(rgbaImageData.width, rgbaImageData.height,
            new Uint8ClampedArray(rgbaImageData.data.buffer, 0, imageSize));
        const binaryImage = new GrayscaleImage(rgbaImageData.width, rgbaImageData.height,
            new Uint8ClampedArray(rgbaImageData.data.buffer, imageSize, imageSize));
        ImagePreprocessor._calculateLumaGrayscale(rgbaImageData, lumaImage);
        ImagePreprocessor._binarize(lumaImage, binaryImage);
        return [lumaImage, binaryImage];
    }


    static _calculateLumaGrayscale(inputRgba, outputGrayScaleImage) {
        // convert the image to grayscale based on luma. We use luma instead of simply averaging rgb as
        // gray = (r+g+b)/3 as the luma better resembles the physical brightness and human perception. Thus,
        // perceived high contrast between a dark and bright pixel get better preserved in the gray image and no
        // artificial high contrasts get created which reduces noise.
        // See https://en.wikipedia.org/wiki/Grayscale#Converting_color_to_grayscale
        // Note that the rgb data of the canvas is gamma compressed (non-linearly encoded, for more background info see
        // http://blog.johnnovak.net/2016/09/21/what-every-coder-should-know-about-gamma/). Therefore we use the luma
        // coding coefficients and not the coefficients for luminance calculation on gamma decoded rgb. The luma values
        // we get are gamma compressed as well but that's just fine as we want to make the distinction between dark /
        // bright pixels on human perception (rgb(255,255,255) is not physically twice as bright as rgb(128,128,128) but
        // perceived as twice as bright.)
        const inputData = inputRgba.data, outputData = outputGrayScaleImage.pixels;
        for (let i = 0; i<outputData.length; ++i) {
            const inputPosition = 4 * i;
            const r = inputData[inputPosition], g = inputData[inputPosition + 1], b = inputData[inputPosition + 2];
            // quick integer approximation (https://en.wikipedia.org/wiki/YUV#Full_swing_for_BT.601)
            outputData[i] = (77 * r + 150 * g + 29 * b + 128) >> 8;
        }
    }


    static _binarize(inputGrayscaleImage, outputBinaryImage = inputGrayscaleImage) {
        // a simple binarizer that compares each pixel to a median value. To account to some extend for local changes
        // in the overall brightness (e.g. shadows / gradients over the screen) the median is computed over an area
        // of the image. It's important to note that this approach generates noise if an area includes exclusively
        // bright or dark because it then determines white and black in the area although it should have been
        // interpreted as a single color. Therefore it's important that the area includes bright and dark pixels.
        // For this reason we select rather big areas which all reach to the center of the image following the
        // assumption that the nimiqode is more or less centered.
        let blockCountX, blockCountY;
        if (inputGrayscaleImage.width > inputGrayscaleImage.height) {
            blockCountX = 3;
            blockCountY = 2;
        } else {
            blockCountY = 3;
            blockCountX = 2;
        }
        const blockWidth = inputGrayscaleImage.width / blockCountX;
        const blockHeight = inputGrayscaleImage.height / blockCountY;
        for (let blockIndexX=0; blockIndexX < blockCountX; ++blockIndexX) {
            for (let blockIndexY=0; blockIndexY < blockCountY; ++blockIndexY) {
                const left = Math.round(blockIndexX * blockWidth);
                const top = Math.round(blockIndexY * blockHeight);
                const width = Math.round((blockIndexX + 1) * blockWidth) - left;
                const height = Math.round((blockIndexY + 1) * blockHeight) - top;
                const [min, max] = ImagePreprocessor._getAreaMinMax(inputGrayscaleImage, left, top, width, height);
                const threshold = (min + max) / 2;
                ImagePreprocessor._applyThresholdToArea(inputGrayscaleImage, left, top, width, height, threshold,
                    outputBinaryImage);
            }
        }
    }


    static _getAreaMinMax(inputGrayscaleImage, left, top, width, height) {
        let min = 0xFF, max = 0;
        for (let x=left; x<left+width; ++x) {
            for (let y=top; y<top+height; ++y) {
                const pixel = inputGrayscaleImage.getPixel(x, y);
                if (pixel < min) {
                    min = pixel;
                }
                if (pixel > max) {
                    max = pixel;
                }
            }
        }
        return [min, max];
    }


    static _applyThresholdToArea(inputGrayscaleImage, left, top, width, height, threshold,
                                 outputBinaryImage = inputGrayscaleImage) {
        for (let x=left; x<left+width; ++x) {
            for (let y=top; y<top+height; ++y) {
                outputBinaryImage.setPixel(x, y, inputGrayscaleImage.getPixel(x, y) > threshold? 255 : 0);
            }
        }
    }
}