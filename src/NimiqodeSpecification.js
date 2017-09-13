let NimiqodeSpecification = {};

NimiqodeSpecification.CURRENT_VERSION = 0;
NimiqodeSpecification.DEFAULT_FACTOR_ERROR_CORRECTION_DATA = 1; // this is just a default value and can be changed
NimiqodeSpecification.MAX_FACTOR_ERROR_CORRECTION_DATA = 2;

// hexagon rings
NimiqodeSpecification.HEXRING_INNERMOST_RADIUS = 150;
NimiqodeSpecification.HEXRING_BORDER_RADIUS = 50;
NimiqodeSpecification.HEXRING_RING_DISTANCE = 50;
NimiqodeSpecification.HEXRING_LINE_WIDTH = 10;
NimiqodeSpecification.HEXRING_SLOT_LENGTH = 10;
NimiqodeSpecification.HEXRING_ADDITIONAL_SLOT_DISTANCE = 0;
NimiqodeSpecification.HEXRING_START_END_OFFSET = 35;

// header
NimiqodeSpecification.HEADER_LENGTH_VERSION = 4;
NimiqodeSpecification.HEADER_LENGTH_PAYLOAD_LENGTH = 8; // specified in bytes, interpreted as values [1..256]
NimiqodeSpecification.HEADER_LENGTH_ERROR_CORRECTION_LENGTH = 10; // length can be 4 times as high as data length (two
// bits more) to account for error correction factors > 1 and extra error correction data to fill up the last hex ring
NimiqodeSpecification.HEADER_LENGTH_HEXRING_MASK = 2; // times the number of hexagon rings
NimiqodeSpecification.HEADER_FACTOR_ERROR_CORRECTION_HEADER = 1; // this is a fixed number and part of the specification

