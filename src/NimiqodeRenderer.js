class NimiqodeRenderer {
    static render(canvasContext, nimiqode, color, center, scaleFactor=1, rotation=0) {
        for (const hexRing of nimiqode.hexagonRings) {
            HexagonRingRenderer.render(canvasContext, hexRing, color, NimiqodeSpecification.HEXRING_LINE_WIDTH,
                center, scaleFactor, rotation);
        }
        // draw the orientation finder line
        canvasContext.save();
        canvasContext.strokeStyle = color;
        canvasContext.lineCap = 'round';
        canvasContext.lineWidth = NimiqodeSpecification.HEXRING_LINE_WIDTH * scaleFactor;
        canvasContext.beginPath();
        const orientationFinderStart = nimiqode.hexagonRings[0].virtualCorners[0].copy()
            .transform(rotation, scaleFactor, center.x, center.y);
        const orientationFinderEnd = nimiqode.hexagonRings[nimiqode.hexagonRings.length-1].virtualCorners[0].copy()
            .transform(rotation, scaleFactor, center.x, center.y);
        canvasContext.moveTo(orientationFinderStart.x, orientationFinderStart.y);
        canvasContext.lineTo(orientationFinderEnd.x, orientationFinderEnd.y);
        canvasContext.stroke();
        canvasContext.restore();
    }
}