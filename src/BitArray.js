// TODO calculations based on Uint32 might be faster then on Uint8, so replace _bytes by a Uint32Array _words

class BitArray {
    /**
     * Create a new BitArray either by a length or from another BitArray or ArrayBuffer.
     * @param {number|BitArray|ArrayBuffer|Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|
     *  Uint32Array|Float32Array|Float64Array} lengthOrBitArrayOrTypedArrayOrArrayBuffer
     * @param {number} [start] index of the first bit to take from the source (included)
     * @param {number} [end] index of the end of the bit sequence in the source (excluded)
     * @param {boolean} [copy] whether to create a copy of the bits. Defaults to false.
     */
    constructor(lengthOrBitArrayOrTypedArrayOrArrayBuffer, start, end, copy) {
        if (typeof(lengthOrBitArrayOrTypedArrayOrArrayBuffer) === 'number') {
            this._createFromLength(lengthOrBitArrayOrTypedArrayOrArrayBuffer);
        } else if (lengthOrBitArrayOrTypedArrayOrArrayBuffer instanceof BitArray) {
            this._createFromBitArray(lengthOrBitArrayOrTypedArrayOrArrayBuffer, start, end, copy);
        } else if (lengthOrBitArrayOrTypedArrayOrArrayBuffer instanceof ArrayBuffer) {
            const typedArray = new Uint8Array(lengthOrBitArrayOrTypedArrayOrArrayBuffer); // Uint8 view without copying
            this._createFromTypedArray(typedArray, start, end, copy);
        } else if (lengthOrBitArrayOrTypedArrayOrArrayBuffer.buffer instanceof ArrayBuffer) {
            this._createFromTypedArray(lengthOrBitArrayOrTypedArrayOrArrayBuffer, start, end, copy)
        } else {
            throw Error('Illegal arguments');
        }
    }

    /**
     * Creates a new BitArray of specified length with entries initialized to 0.
     * Not for direct use, use the constructor instead.
     * @param {number} length
     * @private
     */
    _createFromLength(length) {
        if (typeof(length) !== 'number') {
            throw Error('Illegal Argument');
        }
        this._length = length;
        this._offset = 0;
        this._bytes = new Uint8Array(Math.ceil(length / 8));
    }


    /**
     * Creates a new BitArray from a given BitArray.
     * Not for direct use, use the constructor instead.
     * @param {BitArray} bitArray
     * @param {number} [start] index of the first bit to take from the source bit array (included)
     * @param {number} [end] index of the end of the bit sequence in the source bit array (excluded)
     * @param {boolean} [copy] whether to create a copy of the bits
     * @private
     */
    _createFromBitArray(bitArray, start=0, end=bitArray.length, copy=false) {
        if (!(bitArray instanceof BitArray) || start >= bitArray.length || end > bitArray.length) {
            // although there is also a check in the call to _createFromBuffer, we check the length here as well because
            // the length of the source BitArray might have been restricted to less then the full length of the buffer
            throw Error('Illegal arguments');
        }
        this._createFromTypedArray(bitArray._bytes, bitArray._offset+start, bitArray._offset+end, copy);
    }


    /**
     * Create a new BitArray from a TypedArray.
     * Not for direct use, use the constructor instead.
     * @param {Int8Array|Uint8Array|Uint8ClampedArray|Int16Array|Uint16Array|Int32Array|Uint32Array|Float32Array|
     *  Float64Array} typedArray
     * @param {number} [start] index of the first bit to take from the source (included)
     * @param {number} [end] index of the end of the bit sequence in the source (excluded)
     * @param {boolean} [copy] whether to create a copy of the bits
     * @private
     */
    _createFromTypedArray(typedArray, start=0, end=typedArray.byteLength*8, copy=false) {
        const sourceLength = typedArray.byteLength * 8;
        if (!(typedArray.buffer instanceof ArrayBuffer) || start >= end || start >= sourceLength || end > sourceLength){
            throw Error('Illegal arguments');
        }
        this._length = end - start;

        if (copy) {
            // TODO have to mind byteOffset?
            const startByte = Math.floor(start / 8);
            const byteLength = Math.ceil(this._length / 8);
            const sourceView = new Uint8Array(typedArray.buffer, startByte, byteLength); // a view without copying
            this._bytes = new Uint8Array(sourceView); // copies the bytes
            this._offset = start % 8;
        } else {
            if (!(typedArray instanceof Uint8Array)) {
                typedArray = new Uint8Array(typedArray.buffer); // create an Uint8 view without copying
            }
            this._bytes = typedArray;
            this._offset = start;
        }
    }


    /**
     * The length in bits
     * @returns {number}
     */
    get length() {
        return this._length;
    }


    /**
     * Gets the bit at a specific index
     * @param {number} index
     * @returns {number} 1 or 0
     */
    getBit(index) {
        const [byteIndex, bitPosition] = this._bitIndexToBytePosition(index);
        const byte = this._bytes[byteIndex];
        return (byte >> bitPosition) & 1;
    }


    /**
     * Set the bit at a specific index to 1
     * @param {number} index
     */
    setBit(index) {
        const [byteIndex, bitPosition] = this._bitIndexToBytePosition(index);
        this._bytes[byteIndex] |= 1 << bitPosition;
    }


    /**
     * Set the bit at a specific index to 0
     * @param {number} index
     * @returns {number} 1 or 0
     */
    unsetBit(index) {
        const [byteIndex, bitPosition] = this._bitIndexToBytePosition(index);
        this._bytes[byteIndex] &= ~(1 << bitPosition);
    }


    /**
     * Toggle the bit at a specific index
     * @param {number} index
     */
    toggleBit(index) {
        const [byteIndex, bitPosition] = this._bitIndexToBytePosition(index);
        this._bytes[byteIndex] ^= 1 << bitPosition;
    }


    /**
     * Set the bit at a specific index to a specific value
     * @param {number} index
     * @returns {number} 1 or 0
     */
    setValue(index, value) {
        if (value) {
            this.setBit(index);
        } else {
            this.unsetBit(index);
        }
    }


    /**
     * Converts a bit index in the BitArray to a byte index and a bit position within the byte.
     * @param {number} index
     * @returns {Array.<number>}
     * @private
     */
    _bitIndexToBytePosition(index) {
        if (index<0 || index >= this._length) {
            throw Error('Index out of range');
        }
        index += this._offset;
        const byteIndex = Math.floor(index / 8);
        const bitPosition = 7 - (index % 8); // subtract from 7 to make index 0 the leftmost bit in byte
        return [byteIndex, bitPosition];
    }


    /**
     * Copies bits from another BitArray into this one.
     * @param {BitArray} bitArray
     * @param {number} [index] At which position in this BitArray the data should be written.
     * @param {number} [readIndex] Which position in the source BitArray the data should be read from
     * @param {number} [count]
     * @returns {number} write count
     */
    writeBitArray(bitArray, index=0, readIndex=0, count=null) {
        if (count === null) {
            count = Math.min(this.length-index, bitArray.length-readIndex);
        }
        for (let i=0; i<count; ++i) {
            this.setValue(index+i, bitArray.getBit(readIndex + i));
            // TODO performance improvement: copy whole bytes / words at once if possible
        }
        return count;
    }


    /**
     * Write an unsigned int to the BitArray into numBits bits.
     * @param {number} index
     * @param {number} value
     * @param {number} numBits
     */
    writeUnsignedInteger(index, value, numBits=8) {
        if (numBits < 1 || numBits > 32) {
            // Note that although javascript stores numbers in 64 bits, bit wise operators operate only on 32 bits
            throw Error('Unsupported number of bits');
        }
        if (!Number.isSafeInteger(value) || Number.isNaN(value) || !Number.isFinite(value)) {
            throw Error('Not an integer.');
        }
        if (value >= Math.pow(2, numBits)) {
            throw Error('Value doesn\'t fit the given bits.');
        }
        if (value < 0) {
            throw Error('Negative numbers not supported.');
        }
        for (let bitIndex=numBits-1; bitIndex>=0; --bitIndex) {
            const mask = 1 << bitIndex;
            this.setValue(index++, value & mask);
        }
    }


    /**
     * Read the whole BitArray to an array of 1s and 0s.
     * @returns {Uint8Array.<number>}
     */
    toArray() {
        let result = new Uint8Array(this._length);
        for (let i=0; i<this._length; ++i) {
            result[i] = this.getBit(i);
        }
        return result;
    }
}