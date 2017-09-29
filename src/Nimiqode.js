class Nimiqode {
    /**
     * @param {Uint8Array} payload
     * @param {number} errorCorrectionFactor
     * @param {number} version
     */
    constructor(payload, errorCorrectionFactor=NimiqodeSpecification.DEFAULT_FACTOR_ERROR_CORRECTION_DATA, version=0) {
        if (!(payload instanceof Uint8Array) || version !== NimiqodeSpecification.CURRENT_VERSION ||
            payload.byteLength === 0) {
            throw Error('Invalid argument.');
        }
        if (errorCorrectionFactor<0 || errorCorrectionFactor>NimiqodeSpecification.MAX_FACTOR_ERROR_CORRECTION_DATA) {
            throw Error('Illegal error correction factor.');
        }
        const payloadBitArray = new BitArray(payload);
        if (payloadBitArray.length > Math.pow(2, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH) * 8) {
            throw Error(`Your data is too long. Supported are up to
                ${Math.pow(2, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH)} bytes.`);
        }
        this._version = version;
        const preliminaryErrorCorrectionLength = Math.ceil(payloadBitArray.length / 8 * errorCorrectionFactor) * 8;
        this._hexagonRings = [];
        const dataLength = this._createHexagonRings(payloadBitArray.length, preliminaryErrorCorrectionLength);

        // create bit arrays
        this._data = new BitArray(dataLength);
        const headerLength = NimiqodeHeader.calculateLength(this._hexagonRings.length);
        this._header = new BitArray(this._data, 0, headerLength);
        this._payload = new BitArray(this._data, headerLength, headerLength + payloadBitArray.length);
        // assign sub bit array for error correction. This uses all of the remaining full bytes which can be more
        // than the preliminaryErrorCorrectionLength bits by filling up empty leftover space in the last hexagon ring.
        const errorCorrectionLength = Math.floor((dataLength - headerLength - this._payload.length) / 8) * 8;
        this._errorCorrectionData = new BitArray(this._data, headerLength + this._payload.length,
            headerLength + this._payload.length + errorCorrectionLength);
        // TODO the <8 leftover bits might be used for parity

        // assemble data
        NimiqodeHeader.write(this._header, version, this._payload.length, this._errorCorrectionData.length,
            new Array(this._hexagonRings.length).fill(0));
        this._payload.writeBitArray(payloadBitArray);
        this._writeErrorCorrectionData(payload);

        Nimiqode.assignHexagonRingData(this._hexagonRings, this._data);
    }

    get payload() {
        return this._payload;
    }

    get version() {
        return this._version;
    }

    get hexagonRings() {
        return this._hexagonRings;
    }

    static calculateLength(numHexRings, lengthPayload, lengthErrorCorrection) {
         return NimiqodeHeader.calculateLength(numHexRings) + lengthPayload + lengthErrorCorrection;
    }

    static createHexagonRing(index, setFinderPattern=false) {
        const hexRing = new HexagonRing(NimiqodeSpecification.HEXRING_INNERMOST_RADIUS
            + index * NimiqodeSpecification.HEXRING_RING_DISTANCE, NimiqodeSpecification.HEXRING_BORDER_RADIUS,
            NimiqodeSpecification.HEXRING_START_END_OFFSET, NimiqodeSpecification.HEXRING_SLOT_DISTANCE,
            NimiqodeSpecification.HEXRING_SLOT_LENGTH);
        if (setFinderPattern) {
            // all the rings have the counterclockwise and clockwise finder pattern set, just the innermost ring has the
            // clockwise finder pattern unset.
            hexRing.setFinderPattern(true, index!==0);
        }
        return hexRing;
    }

    _createHexagonRings(payloadLength, errorCorrectionLength) {
        let totalBits = 0;
        let hexagonRingCount = 0;
        do {
            const hexRing = Nimiqode.createHexagonRing(hexagonRingCount, true);
            this._hexagonRings.push(hexRing);
            totalBits += hexRing.bitCount;
            ++hexagonRingCount;
        } while (totalBits < Nimiqode.calculateLength(this._hexagonRings.length, payloadLength, errorCorrectionLength));
        return totalBits;
    }

    static assignHexagonRingData(hexagonRings, data) {
        let handledBits = 0;
        for (const hexRing of hexagonRings) {
            hexRing.data = new BitArray(data, handledBits, handledBits + hexRing.bitCount);
            handledBits += hexRing.bitCount;
        }
    }

    _writeErrorCorrectionData(payloadBytes) {
        // TODO creation of the LDPC matrices is super slow for high n, therefore we try to reduce the n by collecting
        // multiple bits into larger numbers. Here we currently use bytes (8 bit) but if the plan is to keep using LDPC
        // this could be generalized to any number of bits with payload.length % numBits === 0 &&
        // errorCorrectionData.length % numBits === 0 and then also be used in the header.
        const payloadByteLength = payloadBytes.byteLength;
        const errorCorrectionByteLength = this._errorCorrectionData.length / 8;
        const errorCorrectionEncoder = new LDPC({
           n: payloadByteLength + errorCorrectionByteLength,
           k: payloadByteLength,
           modulo: Math.pow(2, 8), // whole bytes
           randomSeed: 42
        });
        const encoded = errorCorrectionEncoder.encode(Array.from(payloadBytes));
        for (let i=0; i<errorCorrectionByteLength; ++i) {
            this._errorCorrectionData.writeUnsignedInteger(i*8, encoded[payloadByteLength + i], 8);
        }
    }
}