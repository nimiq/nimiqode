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
        if (payload.length * 8 > Math.pow(2, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH) * 8) {
            throw Error(`Your data is too long. Supported are up to
                ${Math.pow(2, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH)} bytes.`);
        }
        return this._constructor(payload, errorCorrectionFactor, version);
    }

    async _constructor(payload, errorCorrectionFactor, version) {
        const payloadBitArray = new BitArray(payload);
        this._version = version;
        const preliminaryErrorCorrectionLength = Math.ceil(payloadBitArray.length * errorCorrectionFactor);
        this._hexagonRings = [];
        const dataLength = this._createHexagonRings(payloadBitArray.length, preliminaryErrorCorrectionLength);

        // create bit arrays
        this._data = new BitArray(dataLength);
        const headerLength = NimiqodeHeader.calculateLength(this._hexagonRings.length);
        this._header = new BitArray(this._data, 0, headerLength);
        // Use all of the remaining bits which can be more than the preliminaryErrorCorrectionLength bits by filling up
        // empty leftover space in the last hexagon ring.
        const errorCorrectionLength = dataLength - headerLength - payloadBitArray.length;
        this._encodedPayload = new BitArray(this._data, headerLength, headerLength + payloadBitArray.length +
            errorCorrectionLength);

        // assemble data
        await NimiqodeHeader.write(this._header, version, payloadBitArray.length, errorCorrectionLength,
            new Array(this._hexagonRings.length).fill(0));
        await this._writeEncodedPayload(payloadBitArray.toArray(), errorCorrectionLength);
        Nimiqode.assignHexagonRingData(this._hexagonRings, this._data);
        return this;
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

    async _writeEncodedPayload(payloadBits, parityLength) {
        const encodedPayload = await LDPC.encode(payloadBits, parityLength);
        for (let i=0; i<encodedPayload.length; ++i) {
            this._encodedPayload.setValue(i, encodedPayload[i]);
        }
    }
}