class Masking {

    static findBestMask(data) {
        let bestMask = 0;
        let bestBitChanges = data.length;
        for (let maskIndex=0; maskIndex<NimiqodeSpecification.DATA_MASKS.length; ++maskIndex) {
            const bitChanges = Masking._countBitChanges(data, maskIndex);
            if (bitChanges < bestBitChanges) {
                bestBitChanges = bitChanges;
                bestMask = maskIndex;
            }
        }
        return bestMask;
    }

    static applyMask(maskIndex, inputData, outputData=inputData) {
        const mask = NimiqodeSpecification.DATA_MASKS[maskIndex];
        for (let i=0; i<inputData.length; ++i) {
            outputData.setValue(i, inputData.getBit(i) ^ mask[i % mask.length]);
        }
    }

    // count changes where a 0 follows a 1 or a 1 a 0 in the data.
    static _countBitChanges(data, maskIndex) {
        let bitChanges = 0;
        const mask = NimiqodeSpecification.DATA_MASKS[maskIndex];
        let previous = data.getBit(0) ^ mask[0];
        for (let i=1; i<data.length; ++i) {
            const maskedBit = data.getBit(i) ^ mask[i % mask.length];
            if (maskedBit !== previous) {
                ++bitChanges;
            }
            previous = maskedBit;
        }
        return bitChanges;
    }
}