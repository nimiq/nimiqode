class NimiqodeHeader {

    static calculateLength(numHexRings) {
        const headerDataLength = NimiqodeSpecification.HEADER_LENGTH_VERSION +
            NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH +
            NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH +
            NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK * numHexRings;
        const headerErrorCorrectionLength =
            Math.ceil(headerDataLength * NimiqodeSpecification.HEADER_FACTOR_ERROR_CORRECTION_HEADER);
        return headerDataLength + headerErrorCorrectionLength;
    }


    static write(bitArray, version, payloadLength, errorCorrectionLength, hexRingMasks) {
        let writeIndex = 0;
        // version
        bitArray.writeUnsignedInteger(version, NimiqodeSpecification.HEADER_LENGTH_VERSION, writeIndex);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_VERSION;
        // write the payload length
        bitArray.writeUnsignedInteger(payloadLength, NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH, writeIndex);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH;
        // write the error correction length
        bitArray.writeUnsignedInteger(errorCorrectionLength,
            NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH, writeIndex);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH;
        // write the hex ring masks
        for (const hexRingMask of hexRingMasks) {
            bitArray.writeUnsignedInteger(hexRingMask, NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK, writeIndex);
            writeIndex += NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK;
        }
        // write the header error correction
        const headerLength = NimiqodeHeader.calculateLength(hexRingMasks.length);
        const headerDataLength = writeIndex;
        const errorCorrectionEncoder = new LDPC({
            n: headerLength,
            k: headerDataLength,
            modulo: 2,
            randomSeed: 42
        });
        const errorEncodedData = errorCorrectionEncoder.encode(new BitArray(bitArray, 0, headerDataLength).toArray());
        while (writeIndex < headerLength) {
            bitArray.setValue(writeIndex, errorEncodedData[writeIndex]);
            writeIndex++;
        }
    }
}