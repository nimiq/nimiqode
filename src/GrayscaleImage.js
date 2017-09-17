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