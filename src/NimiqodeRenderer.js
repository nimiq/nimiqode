class NimiqodeRenderer {
    static render(canvas, nimiqode, color, center, scaleFactor=1, rotation=0) {
        for (const hexRing of nimiqode._hexagonRings) {
            HexagonRingRenderer.render(canvas, hexRing, color, NimiqodeSpecification.HEXRING_LINE_WIDTH,
                center, scaleFactor, rotation);
        }
    }
}