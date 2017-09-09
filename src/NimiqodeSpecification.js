let NimiqodeSpecification = {};

NimiqodeSpecification.CURRENT_VERSION = 0;

// lengths in bits
// header
NimiqodeSpecification.LENGTH_VERSION = 4;
NimiqodeSpecification.LENGTH_NIMIQODE_LENGTH = 8;
NimiqodeSpecification.LENGTH_ERROR_CORRECTION_LENGTH = 8;
NimiqodeSpecification.LENGTH_MASK = 3; // times the number of hexagon rings
// and the same number of bits again for error correction


// hexagon rings
NimiqodeSpecification.HEXRING_INNERMOST_RADIUS = 150;
NimiqodeSpecification.HEXRING_BORDER_RADIUS = 50;
NimiqodeSpecification.HEXRING_RING_DISTANCE = 50;
NimiqodeSpecification.HEXRING_LINE_WIDTH = 10;
NimiqodeSpecification.HEXRING_SLOT_LENGTH = 10;
NimiqodeSpecification.HEXRING_ADDITIONAL_SLOT_DISTANCE = 0;
NimiqodeSpecification.HEXRING_START_END_OFFSET = 20;