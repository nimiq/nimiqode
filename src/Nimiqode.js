class Nimiqode {
    /**
     * @param {Uint8Array|Array.<HexagonRing>} payloadOrHexRings
     * @param {number|BitArray} [errorCorrectionFactorOrData]
     * @param {number} [version]
     * @return {Promise.<Nimiqode>|null} instance or in case of error null
     */
    constructor(payloadOrHexRings, errorCorrectionFactorOrData=NimiqodeSpecification.DEFAULT_FACTOR_ERROR_CORRECTION_DATA,
                version=0) {
        if (Array.isArray(payloadOrHexRings)) {
            return this._constructFromScan(payloadOrHexRings, errorCorrectionFactorOrData);
        } else {
            return this._constructFromPayload(payloadOrHexRings, errorCorrectionFactorOrData, version);
        }
    }

    async _constructFromPayload(payload, errorCorrectionFactor, version) {
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
        const payloadBitArray = new BitArray(payload);
        this._payload = payload;
        const preliminaryErrorCorrectionLength = Math.ceil(payloadBitArray.length * errorCorrectionFactor);
        this._hexagonRings = [];
        const dataLength = this._createHexagonRings(payloadBitArray.length, preliminaryErrorCorrectionLength);
        const checksum = CRC16.crc16(payload);

        // create bit arrays
        this._data = new BitArray(dataLength);
        const headerLength = NimiqodeHeader.calculateLength(this._hexagonRings.length);
        const header = new BitArray(this._data, 0, headerLength);
        // Use all of the remaining bits which can be more than the preliminaryErrorCorrectionLength bits by filling up
        // empty leftover space in the last hexagon ring.
        const errorCorrectionLength = dataLength - headerLength - payloadBitArray.length;
        const encodedPayload = new BitArray(this._data, headerLength, headerLength + payloadBitArray.length +
            errorCorrectionLength);

        // assemble data
        await NimiqodeHeader.write(header, version, payloadBitArray.length, errorCorrectionLength, checksum,
            new Array(this._hexagonRings.length).fill(0));
        const encodedPayloadBits = await LDPC.encode(payloadBitArray.toArray(), errorCorrectionLength);
        for (let i=0; i<encodedPayload.length; ++i) {
            encodedPayload.setValue(i, encodedPayloadBits[i]);
        }
        Nimiqode.assignHexagonRingData(this._hexagonRings, this._data);
        return this;
    }

    async _constructFromScan(hexagonRings, data) {
        this._hexagonRings = hexagonRings;
        this._data = data;
        const headerLength = NimiqodeHeader.calculateLength(this._hexagonRings.length);
        const header = new BitArray(this._data, 0, headerLength);
        const [version, payloadLength, errorCorrectionLength, checksum, hexRingMasks] =
            await NimiqodeHeader.read(header, hexagonRings.length);
        if (version !== 0) {
            throw Error('Illegal nimiqode: Unsupported version.');
        }
        if (headerLength + payloadLength + errorCorrectionLength !== data.length) {
            throw Error('Illegal nimiqode: Wrong data length.'); // Probably recognized wrong number of hexagon rings.
        }
        // decode payload
        const encodedPayloadBitArray = new BitArray(this._data, headerLength);
        const payloadBits = await LDPC.decode(encodedPayloadBitArray.toArray(), payloadLength, errorCorrectionLength);
        this._payload = new Uint8Array(payloadLength / 8); // in byte
        const payloadBitArray = new BitArray(this._payload);
        for (let i=0; i<payloadLength; ++i) {
            payloadBitArray.setValue(i, payloadBits[i]);
        }
        if (CRC16.crc16(this._payload) !== checksum) {
            throw Error('Illegal nimiqode: Checksum mismatch.');
        }
        return this;
    }

    get payload() {
        return this._payload;
    }

    get hexagonRings() {
        return this._hexagonRings;
    }

    static calculateLength(numHexRings, lengthPayload, lengthErrorCorrection) {
         return NimiqodeHeader.calculateLength(numHexRings) + lengthPayload + lengthErrorCorrection;
    }

    static createHexagonRing(index) {
        // all the rings have the counterclockwise and clockwise finder pattern set, just the innermost ring has the
        // clockwise finder pattern unset.
        return new HexagonRing(NimiqodeSpecification.HEXRING_INNERMOST_RADIUS
            + index * NimiqodeSpecification.HEXRING_RING_DISTANCE, NimiqodeSpecification.HEXRING_BORDER_RADIUS,
            NimiqodeSpecification.HEXRING_START_END_OFFSET, NimiqodeSpecification.HEXRING_SLOT_DISTANCE,
            NimiqodeSpecification.HEXRING_SLOT_LENGTH, index===0?
                NimiqodeSpecification.HEXRING_FINDER_PATTERN_LENGTH_UNSET :
                NimiqodeSpecification.HEXRING_FINDER_PATTERN_LENGTH_SET,
            NimiqodeSpecification.HEXRING_FINDER_PATTERN_LENGTH_SET, index!==0, true);
    }

    _createHexagonRings(payloadLength, errorCorrectionLength) {
        let totalBits = 0;
        let hexagonRingCount = 0;
        do {
            const hexRing = Nimiqode.createHexagonRing(hexagonRingCount);
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
}