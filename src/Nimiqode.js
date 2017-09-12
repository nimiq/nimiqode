class Nimiqode {
    /**
     * @param {Uint8Array} payload
     * @param {number} errorCorrectionFactor
     * @param {number} version
     */
    constructor(payload, errorCorrectionFactor=NimiqodeSpecification.DEFAULT_FACTOR_ERROR_CORRECTION_DATA, version=0) {
        if (!(payload instanceof Uint8Array) || version !== NimiqodeSpecification.CURRENT_VERSION) {
            throw Error('Invalid argument.');
        }
        if (errorCorrectionFactor<0 || errorCorrectionFactor>NimiqodeSpecification.MAX_FACTOR_ERROR_CORRECTION_DATA) {
            throw Error('Illegal error correction factor.');
        }
        const payloadBitArray = new BitArray(payload);
        if (payloadBitArray.length > Math.pow(2, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH)) {
            throw Error(`Your data is too long. Supported are up to
                ${Math.pow(2, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH)} bits.`);
        }
        this._version = version;
        const preliminaryErrorCorrectionLength = Math.ceil(payloadBitArray.length * errorCorrectionFactor);
        this._hexagonRings = [];
        const dataLength = this._createHexagonRings(payloadBitArray.length, preliminaryErrorCorrectionLength);

        // create bit arrays
        this._data = new BitArray(dataLength);
        const headerLength = NimiqodeHeader.calculateLength(this._hexagonRings.length);
        this._header = new BitArray(this._data, 0, headerLength);
        this._payload = new BitArray(this._data, headerLength, headerLength + payloadBitArray.length);
        // assign sub bit array for error correction. This uses all of the remaining available bits which can be more
        // than the preliminaryErrorCorrectionLength by filling up empty leftover space in the last hexagon ring.
        this._errorCorrectionData = new BitArray(this._data, headerLength + this._payload.length, dataLength);

        // assemble data
        NimiqodeHeader.write(this._header, version, this._payload.length, this._errorCorrectionData.length,
            new Array(this._hexagonRings.length).fill(0));
        this._payload.writeBitArray(payloadBitArray);
        this._writeErrorCorrectionData();

        this._assignHexagonRingData();
    }

    static get payload() {
        return this._payload;
    }

    static get version() {
        return this._version;
    }

    static calculateLength(numHexRings, lengthPayload, lengthErrorCorrection) {
         return NimiqodeHeader.calculateLength(numHexRings) + lengthPayload + lengthErrorCorrection;
    }

    _createHexagonRings(payloadLength, errorCorrectionLength) {
        let nextHexagonRadius = NimiqodeSpecification.HEXRING_INNERMOST_RADIUS;
        let totalBits = 0;
        do {
            const hexRing = new HexagonRing(nextHexagonRadius, NimiqodeSpecification.HEXRING_BORDER_RADIUS,
                NimiqodeSpecification.HEXRING_START_END_OFFSET, NimiqodeSpecification.HEXRING_ADDITIONAL_SLOT_DISTANCE,
                NimiqodeSpecification.HEXRING_SLOT_LENGTH);
            this._hexagonRings.push(hexRing);
            totalBits += hexRing.numSlots;
            nextHexagonRadius += NimiqodeSpecification.HEXRING_RING_DISTANCE;
        } while (totalBits < Nimiqode.calculateLength(this._hexagonRings.length, payloadLength, errorCorrectionLength));
        return totalBits;
    }

    _assignHexagonRingData() {
        let handledBits = 0;
        for (const hexRing of this._hexagonRings) {
            hexRing.data = new BitArray(this._data, handledBits, handledBits + hexRing.numSlots);
            handledBits += hexRing.numSlots;
        }
    }

    _writeErrorCorrectionData() {
        // TODO creation of the LDPC matrices is super slow. Either replace low density parity check by reed solomon or
        // cache the ldpc object (which is just a workaround though as different n or k need a different instantiation)
        const errorCorrectionEncoder = new LDPC({
           n: this._payload.length + this._errorCorrectionData.length,
           k: this._payload.length,
           modulo: 2,
           randomSeed: 42
        });
        const encoded = errorCorrectionEncoder.encode(this._payload.toArray());
        for (let i=0; i<this._errorCorrectionData.length; ++i) {
            this._errorCorrectionData.setValue(i, encoded[i + this._payload.length]);
        }
    }
}