class Nimiqode {
    /**
     * @param {Uint8Array} payload
     * @param {number} version
     */
    constructor(payload, version = 0) {
        if (!(payload instanceof Uint8Array) || version !== NimiqodeSpecification.CURRENT_VERSION) {
            throw Error('Invalid argument.');
        }
        this._version = version;
        this._payload = payload;
        this._data = new BitArray(this._payload);
        this._dataLength = this._data.length;
        this._hexagonRings = [];
        this._assignHexagonRings();
    }

    static get payload() {
        return this._payload;
    }

    static get version() {
        return this._version;
    }

    _assignHexagonRings() {
        let remainingBits = this._dataLength, handledBits = 0;
        let hexagonRadius = NimiqodeSpecification.HEXRING_INNERMOST_RADIUS;
        while (remainingBits > 0) {
            const hexRing = new HexagonRing(hexagonRadius, NimiqodeSpecification.HEXRING_BORDER_RADIUS,
                NimiqodeSpecification.HEXRING_START_END_OFFSET, NimiqodeSpecification.HEXRING_ADDITIONAL_SLOT_DISTANCE,
                NimiqodeSpecification.HEXRING_SLOT_LENGTH);
            const bitsInRing = hexRing.numSlots;
            if (bitsInRing < remainingBits) {
                hexRing.data = new BitArray(this._data, handledBits, handledBits + bitsInRing);
            } else {
                hexRing.data = new BitArray(bitsInRing);
                hexRing.data.write(this._data, 0, handledBits, remainingBits);
                for (let i=remainingBits; i<bitsInRing; ++i) {
                    hexRing.data.setValue(i, i % 2);
                }
            }
            handledBits += bitsInRing;
            remainingBits -= bitsInRing;
            hexagonRadius += NimiqodeSpecification.HEXRING_RING_DISTANCE;
            this._hexagonRings.push(hexRing);
        }
    }


    render(canvas, color, center, scaleFactor=1, rotation=0) {
        for (const hexRing of this._hexagonRings) {
            HexagonRingRenderer.renderHexagonRing(canvas, hexRing, color, NimiqodeSpecification.HEXRING_LINE_WIDTH,
                center, scaleFactor, rotation);
        }
    }
}