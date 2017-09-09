class BufferUtils {
    static getBitLength(data) {
        return data.byteLength * 8;
    }

    static getBit(data, index) {
        if (index < 0 || index >= BufferUtils.getBitLength(data)) {
            throw Error('Invalid index.');
        }
        if (!(data instanceof Uint8Array)) {
            // if not already an Uint8 view, make it an Uint8 view.
            data = new Uint8Array(data.buffer);
        }
        const entry = data[Math.floor(index / 8)];
        return !!(entry & (1 << index % 8));
    }
}