class NimiqodeHeader {

    static calculateLength(numHexRings) {
        const headerDataLength = NimiqodeHeader.calculateDataLength(numHexRings);
        const headerErrorCorrectionLength =
            Math.ceil(headerDataLength * NimiqodeSpecification.HEADER_FACTOR_ERROR_CORRECTION_HEADER);
        return headerDataLength + headerErrorCorrectionLength;
    }


    static calculateDataLength(numHexRings) {
        return NimiqodeSpecification.HEADER_LENGTH_VERSION +
            NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH +
            NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH +
            NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK * numHexRings;
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


    static async read(data, hexRingCount) {
        const headerLength = NimiqodeHeader.calculateLength(hexRingCount);
        if (data.length !== headerLength) {
            throw Error('Wrong header length');
        }
        const headerDataLength = NimiqodeHeader.calculateDataLength(hexRingCount);
        // decode the header
        const decoded = await LDPC.decode(data.toArray(), headerDataLength, headerLength - headerDataLength);
        let readIndex = 0;
        // version
        const version = NimiqodeHeader._readUnsignedInteger(decoded, readIndex,
            NimiqodeSpecification.HEADER_LENGTH_VERSION);
        readIndex += NimiqodeSpecification.HEADER_LENGTH_VERSION;
        // read the payload length in byte (adding one to map [0..255] back to [1..256]). Times 8 to get bit count.
        const payloadLength = 8 * (NimiqodeHeader._readUnsignedInteger(decoded, readIndex,
            NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH) + 1);
        readIndex += NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH;
        // read the error correction length in bit
        const errorCorrectionLength = NimiqodeHeader._readUnsignedInteger(decoded, readIndex,
            NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH);
        readIndex += NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH;
        // read the hex ring masks
        const hexRingMasks = [];
        for (let i=0; i<hexRingCount; ++i) {
            hexRingMasks.push(NimiqodeHeader._readUnsignedInteger(decoded, readIndex,
                NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK));
            readIndex += NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK;
        }
        return [version, payloadLength, errorCorrectionLength, hexRingMasks];
    }


    static _readUnsignedInteger(array, index, numBits=8) {
        let result = 0;
        for (let i=0; i<numBits; ++i) {
            result = (result << 1) + array[index+i];
        }
        return result;
    }
}