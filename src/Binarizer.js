class Binarizer {
    // This implementation follows the idea of
    // https://github.com/zxing/zxing/blob/master/core/src/main/java/com/google/zxing/common/HybridBinarizer.java

    static calculateRequiredBufferSize(width, height) {
        // memory for threshold for every block
        const blockCountX = Math.ceil(width / Binarizer.BLOCK_SIZE);
        const blockCountY = Math.ceil(height / Binarizer.BLOCK_SIZE);
        return blockCountX * blockCountY;
    }

    static binarize(inputGrayscaleImage, outputBinaryImage = inputGrayscaleImage, buffer = null) {
        const blockCountX = Math.ceil(inputGrayscaleImage.width / Binarizer.BLOCK_SIZE);
        const blockCountY = Math.ceil(inputGrayscaleImage.height / Binarizer.BLOCK_SIZE);
        let blockThresholds;
        if (buffer) {
            if (!(buffer instanceof Uint8ClampedArray) || buffer.byteLength !== blockCountX * blockCountY) {
                throw Error('Illegal Buffer.');
            }
            blockThresholds = buffer;
        } else {
            blockThresholds = new Uint8ClampedArray(blockCountX * blockCountY);
        }
        // calculate the thresholds for the blocks
        for (let blockIndexY=0; blockIndexY < blockCountY; ++blockIndexY) {
            for (let blockIndexX=0; blockIndexX < blockCountX; ++blockIndexX) {
                const threshold = Binarizer._calculateBlockThreshold(inputGrayscaleImage, blockIndexX, blockIndexY,
                    blockThresholds, blockCountX);
                blockThresholds[blockIndexY * blockCountX + blockIndexX] = threshold;
            }
        }
        for (let blockIndexY=2; blockIndexY < blockCountY-2; ++blockIndexY) {
            for (let blockIndexX=2; blockIndexX < blockCountX-2; ++blockIndexX) {
                let sum = 0;
                for (let i = -2; i<=2; ++i) {
                    for (let j = -2; j<=2; ++j) {
                        sum += blockThresholds[(blockIndexY + i) * blockCountX + (blockIndexX + j)];
                    }
                }
                Binarizer._applyThresholdToBlock(inputGrayscaleImage, blockIndexX, blockIndexY, sum / 25,
                    outputBinaryImage);
            }
        }
    }

    static _calculateBlockThreshold(inputGrayscaleImage, blockIndexX, blockIndexY, blockThresholds, blockCountX) {
        const imageWidth = inputGrayscaleImage.width;
        const pixels = inputGrayscaleImage.pixels;
        let min = 0xFF, max = 0;
        const left = Math.min(blockIndexX * Binarizer.BLOCK_SIZE, imageWidth - Binarizer.BLOCK_SIZE);
        const top = Math.min(blockIndexY * Binarizer.BLOCK_SIZE, inputGrayscaleImage.height - Binarizer.BLOCK_SIZE);
        let rowStart = top * imageWidth + left;
        for (let y=0; y<Binarizer.BLOCK_SIZE; ++y) {
            for (let x=0; x<Binarizer.BLOCK_SIZE; ++x) {
                const pixel = pixels[rowStart + x];
                if (pixel < min) {
                    min = pixel;
                }
                if (pixel > max) {
                    max = pixel;
                }
            }
            rowStart += imageWidth;
        }
        if (max - min > Binarizer.MIN_DYNAMIC_RANGE) {
            // The values span a minimum dynamic range, so we can assume we have bright and dark pixels. Return the
            // average of min and max as threshold. We could also compute the real average of all pixel but following
            // the assumption that the nimiqode consists of bright and dark pixels and essentially not much in between
            // then by (min + max)/2 we make the cut really between those two classes. If using the average over all
            // pixel then in a block of mostly bright pixels and few dark pixels, the avg would tend to the bright side
            // and darker bright pixels could be interpreted as dark.
            return (min + max) / 2;
        } else {
            // We have a low dynamic range and assume the block is of solid bright or dark color.
            if (blockIndexX === 0 || blockIndexY === 0) {
                // cant compare to the neighbours. Assume it's a light background
                return min / 2;
            } else {
                const myIndex = blockIndexY * blockCountX + blockIndexX;
                const leftBlockThreshold = blockThresholds[myIndex - 1];
                const topBlockThreshold = blockThresholds[myIndex - blockCountX];
                const topLeftBlockThreshold = blockCountX[myIndex - blockCountX - 1];
                const neighbourAverage = (leftBlockThreshold + topBlockThreshold + topLeftBlockThreshold) / 3;
                if (neighbourAverage > min) {
                    return neighbourAverage;
                } else {
                    return min / 2;
                }
            }
        }
    }


    static _applyThresholdToBlock(inputGrayscaleImage, blockIndexX, blockIndexY, threshold,
                                 outputBinaryImage = inputGrayscaleImage) {
        const imageWidth = inputGrayscaleImage.width;
        const inputPixels = inputGrayscaleImage.pixels;
        const outputPixels = outputBinaryImage.pixels;
        const left = Math.min(blockIndexX * Binarizer.BLOCK_SIZE, imageWidth - Binarizer.BLOCK_SIZE);
        const top = Math.min(blockIndexY * Binarizer.BLOCK_SIZE, inputGrayscaleImage.height - Binarizer.BLOCK_SIZE);
        let rowStart = top * imageWidth + left;
        for (let y=0; y<Binarizer.BLOCK_SIZE; ++y) {
            for (let x=0; x<Binarizer.BLOCK_SIZE; ++x) {
                const index = rowStart + x;
                outputPixels[index] = inputPixels[index] <= threshold? 0 : 255;
            }
            rowStart += imageWidth;
        }
    }
}
Binarizer.BLOCK_SIZE = 8; // compute threshold for every 8x8 block
Binarizer.AVERAGING_GRID_SIZE = 5; // determine final threshold for a block by averaging over 5x5 neighboring blocks
Binarizer.MIN_DYNAMIC_RANGE = 6; // if the dynamic range in a block is below this value it's assumed to be single color