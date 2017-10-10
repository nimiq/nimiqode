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


    static async write(bitArray, version, payloadLength, errorCorrectionLength, hexRingMasks) {
        if (payloadLength % 8 !== 0) {
            throw Error('Only whole bytes allowed for payload.');
        }
        let writeIndex = 0;
        // version
        bitArray.writeUnsignedInteger(writeIndex, version, NimiqodeSpecification.HEADER_LENGTH_VERSION);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_VERSION;
        // write the payload length in byte (subtracting one to map allowed lengths [1..256] to [0..255])
        bitArray.writeUnsignedInteger(writeIndex, payloadLength / 8 - 1,
            NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH;
        // write the error correction length in bit
        bitArray.writeUnsignedInteger(writeIndex, errorCorrectionLength,
            NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH;
        // write the hex ring masks
        for (const hexRingMask of hexRingMasks) {
            bitArray.writeUnsignedInteger(writeIndex, hexRingMask, NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK);
            writeIndex += NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK;
        }
        // extract the data bits that should be encoded
        const headerDataLength = writeIndex;
        const headerDataBits = new Array(headerDataLength);
        for (let i=0; i<headerDataLength; ++i) {
            headerDataBits[i] = bitArray.getBit(i);
        }
        // write the header error correction
        const headerErrorCorrectionLength =
            Math.ceil(headerDataLength * NimiqodeSpecification.HEADER_FACTOR_ERROR_CORRECTION_HEADER);
        const encodedHeaderData = await LDPC.encode(headerDataBits, headerErrorCorrectionLength);
        // copy the whole encoded data. We have to do that because while the encoded data usually includes the uncoded
        // header data we already wrote in plain, this is not guaranteed, e.g. the order might have changed.
        for (let i=0; i<encodedHeaderData.length; ++i) {
            bitArray.setValue(i, encodedHeaderData[i]);
        }
    }
}