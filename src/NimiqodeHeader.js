class NimiqodeHeader {

    static calculateMaskCount(hexRings) {
        // Check how many hexagon rings need masking where rings that are completely filled with
        // the header don't get a mask as the header doesn't get masked.
        let maskCount = hexRings.length;
        let handledHeaderBits = 0;
        for (let i=0; i<hexRings.length; ++i) {
            if (hexRings[i].bitCount <= NimiqodeHeader.calculateLength(maskCount) - handledHeaderBits) {
                // The ring gets completely filled with header data only, thus we don't need a mask for this ring.
                // Note that by lowering the maskCount, the header gets shorter and we might get into the corner
                // case that then the ring doesn't get completely filled anymore. However, we just leave this case
                // as it is and don't define a mask for the few excess bits and leave them unmasked.
                --maskCount;
                handledHeaderBits += hexRings[i].bitCount;
            } else {
                break;
            }
        }
        return maskCount;
    }


    static calculateLength(maskCount) {
        const headerDataLength = NimiqodeHeader._calculateDataLength(maskCount);
        const headerErrorCorrectionLength =
            Math.ceil(headerDataLength * NimiqodeSpecification.HEADER_FACTOR_ERROR_CORRECTION_HEADER);
        return headerDataLength + headerErrorCorrectionLength;
    }


    static _calculateDataLength(maskCount) {
        return NimiqodeSpecification.HEADER_LENGTH_VERSION +
            NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH +
            NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH +
            NimiqodeSpecification.HEADER_LENGTH_CHECKSUM +
            NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK * maskCount;
    }


    static async write(bitArray, version, payloadLength, errorCorrectionLength, checksum, hexRingMasks) {
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
        // write the checksum
        bitArray.writeUnsignedInteger(writeIndex, checksum,
            NimiqodeSpecification.HEADER_LENGTH_CHECKSUM);
        writeIndex += NimiqodeSpecification.HEADER_LENGTH_CHECKSUM;
        // write the hex ring masks
        for (const hexRingMask of hexRingMasks) {
            bitArray.writeUnsignedInteger(writeIndex, hexRingMask, NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK);
            writeIndex += NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK;
        }
        // extract the header data bits that should be encoded
        const headerDataLength = writeIndex;
        const headerDataBits = new Uint8Array(headerDataLength);
        for (let i=0; i<headerDataLength; ++i) {
            headerDataBits[i] = bitArray.getBit(i);
        }
        // write the encoded header
        const headerErrorCorrectionLength =
            Math.ceil(headerDataLength * NimiqodeSpecification.HEADER_FACTOR_ERROR_CORRECTION_HEADER);
        const encodedHeaderData = await LDPC.encode(headerDataBits, headerErrorCorrectionLength);
        // copy the whole encoded data. We have to do that because while the encoded data usually includes the uncoded
        // header data we already wrote in plain, this is not guaranteed, e.g. the order might have changed.
        for (let i=0; i<encodedHeaderData.length; ++i) {
            bitArray.setValue(i, encodedHeaderData[i]);
        }
    }


    static async read(data, hexRings) {
        const maskCount = NimiqodeHeader.calculateMaskCount(hexRings);
        const headerLength = NimiqodeHeader.calculateLength(maskCount);
        if (data.length !== headerLength) {
            throw Error('Illegal nimiqode: Wrong header length');
        }
        const headerDataLength = NimiqodeHeader._calculateDataLength(maskCount);
        // decode the header
        let decoded;
        try {
            decoded = await LDPC.decode(data.toArray(), headerDataLength, headerLength - headerDataLength);
        } catch(e) {
            throw Error('Illegal nimiqode: Failed to decode header.');
        }
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
        // read the checksum
        const checksum = NimiqodeHeader._readUnsignedInteger(decoded, readIndex,
            NimiqodeSpecification.HEADER_LENGTH_CHECKSUM);
        readIndex += NimiqodeSpecification.HEADER_LENGTH_CHECKSUM;
        // read the hex ring masks
        const hexRingMasks = [];
        for (let i=0; i<maskCount; ++i) {
            hexRingMasks.push(NimiqodeHeader._readUnsignedInteger(decoded, readIndex,
                NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK));
            readIndex += NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK;
        }
        return [version, payloadLength, errorCorrectionLength, checksum, hexRingMasks];
    }


    static _readUnsignedInteger(array, index, numBits=8) {
        let result = 0;
        for (let i=0; i<numBits; ++i) {
            result = (result << 1) + array[index+i];
        }
        return result;
    }
}