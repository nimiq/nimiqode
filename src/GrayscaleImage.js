class GrayscaleImage {
    constructor(width, height, buffer=null) {
        this._width = width;
        this._height = height;
        this._size = width * height;
        if (buffer) {
            if (!(buffer instanceof Uint8ClampedArray) || buffer.byteLength !== this._size) {
                throw Error('Illegal buffer.');
            }
            this._pixels = buffer;
        } else {
            this._pixels = new Uint8ClampedArray(this._size);
        }
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get pixels() {
        return this._pixels;
    }

    getPixel(x,y) {
        // no error checking done here as this method gets called very often
        return this._pixels[y * this._width + x];
    }

    setPixel(x, y, value) {
        this._pixels[y * this._width + x] = value;
    }

    static calculateRequiredBufferSize(width, height) {
        return width * height;
    }

    static fromRgba(inputRgba, buffer=null) {
        // convert the rgba image to grayscale based on luma. We use luma instead of simply averaging rgb as
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
        const result = new GrayscaleImage(inputRgba.width, inputRgba.height, buffer);
        const inputData = inputRgba.data, outputData = result.pixels;
        for (let i = 0; i<outputData.length; ++i) {
            const inputPosition = 4 * i;
            const r = inputData[inputPosition], g = inputData[inputPosition + 1], b = inputData[inputPosition + 2];
            // quick integer approximation (https://en.wikipedia.org/wiki/YUV#Full_swing_for_BT.601)
            outputData[i] = (77 * r + 150 * g + 29 * b + 128) >> 8;
        }
        return result;
    }

    exportToRgba(buffer = null) {
        if (buffer && buffer.byteLength !== this._size * 4) {
            throw Error('Buffer has wrong size. Needed are 4 byte per pixel.');
        }
        buffer = buffer || new Uint8ClampedArray(this._size * 4);
        const rgbaImage = new ImageData(buffer, this._width, this._height);
        for (let i=0; i<this._pixels.length; ++i) {
            const writeIndex = i * 4;
            buffer[writeIndex] = buffer[writeIndex+1] = buffer[writeIndex+2] = this._pixels[i];
            buffer[writeIndex+3] = 255;
        }
        return rgbaImage;
    }
}