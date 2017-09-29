class PerspectiveTransformationMatrix {
    // The overall implementation follows pages 52-56 in the book "Digital Image Warping" by George Wolberg.
    // Alternatively see https://math.stackexchange.com/q/339033 which follows the same overall idea.

    constructor(a11, a12, a13,
                a21, a22, a23,
                a31, a32, a33) {
        this.a11 = a11;
        this.a12 = a12;
        this.a13 = a13;
        this.a21 = a21;
        this.a22 = a22;
        this.a23 = a23;
        this.a31 = a31;
        this.a32 = a32;
        this.a33 = a33;
    }


    copy() {
        return new PerspectiveTransformationMatrix(this.a11, this.a12, this.a13, this.a21, this.a22, this.a23,
            this.a31, this.a32, this.a33);
    }


    static fromScalingFactor(scaleX, scaleY=scaleX) {
        return new PerspectiveTransformationMatrix(scaleX, 0, 0,
                                                    0, scaleY, 0,
                                                    0, 0, 1);
    }


    static fromCorrespondingPoints(srcPoint0, srcPoint1, srcPoint2, srcPoint3,
                                   dstPoint0, dstPoint1, dstPoint2, dstPoint3) {
        // Create a transformation matrix from four source points that get mapped to four destination points.
        // We do this by combining a transformation from source coordinates to base the base square and the from the
        // base square to the destination points. (See page 56 in the book "Digital Image Warping").
        // This is the same as step 5 in the stackexchange answer.
        const toDest = PerspectiveTransformationMatrix._fromBaseToPoints(dstPoint0, dstPoint1, dstPoint2, dstPoint3);
        const fromSrc = PerspectiveTransformationMatrix._fromPointsToBase(srcPoint0, srcPoint1, srcPoint2, srcPoint3);
        return fromSrc.multiplyWithMatrix(toDest);
    }


    transform(point) {
        // Apply the transformation matrix to the point.
        // This is step 6 and 7 from the stackexchange solution. Note that in stackexchange in step 2 the transformation
        // matrix was implicitly defined to be multiplied to the left, in the book the multiplication is from the right.
        // (See page 52)
        const x = point.x, y = point.y;
        const homogeneousFactor = this.a13 * x + this.a23 * y + this.a33;
        point.x = (this.a11 * x + this.a21 * y + this.a31) / homogeneousFactor;
        point.y = (this.a12 * x + this.a22 * y + this.a32) / homogeneousFactor;
    }


    static _fromBaseToPoints(dstPoint0, dstPoint1, dstPoint2, dstPoint3) {
        // Case from base square defined by points (0,0), (0,1), (1,0), (1,1) to arbitrary destination points.
        // For the derivation of these formulas see the "Digital Image Warping" book (page 52 - 56).
        // The result we get is essentially the same as steps 1 and 2 from the stackexchange solution, just that we
        // don't have have to solve the equation system ourselves.
        const deltaX3 = dstPoint0.x - dstPoint1.x + dstPoint2.x - dstPoint3.x;
        const deltaY3 = dstPoint0.y - dstPoint1.y + dstPoint2.y - dstPoint3.y;
        if (deltaX3 === 0 && deltaY3 === 0) {
            // It's a parallelogram and the transformation affine (orthographic projection, limited to translation,
            // rotation, scale, shear). The last column for an affine transformation is 0, 0, 1.
            return new PerspectiveTransformationMatrix(
                dstPoint1.x - dstPoint0.x, dstPoint1.y - dstPoint0.y, 0,
                dstPoint2.x - dstPoint1.x, dstPoint2.y - dstPoint1.y, 0,
                dstPoint0.x, dstPoint2.y, 1);
        } else {
            // It's a perspective transform
            const deltaX1 = dstPoint1.x - dstPoint2.x,
                deltaX2 = dstPoint3.x - dstPoint2.x,
                deltaY1 = dstPoint1.y - dstPoint2.y,
                deltaY2 = dstPoint3.y - dstPoint2.y;
            const denominatorDeterminant = deltaX1 * deltaY2 - deltaX2 * deltaY1;
            const a13 = (deltaX3 * deltaY2 - deltaX2 * deltaY3) / denominatorDeterminant;
            const a23 = (deltaX1 * deltaY3 - deltaX3 * deltaY1) / denominatorDeterminant;
            return new PerspectiveTransformationMatrix(
                dstPoint1.x - dstPoint0.x + a13 * dstPoint1.x, dstPoint1.y - dstPoint0.y + a13 * dstPoint1.y, a13,
                dstPoint3.x - dstPoint0.x + a23 * dstPoint3.x, dstPoint3.y - dstPoint0.y + a23 * dstPoint3.y, a23,
                dstPoint0.x, dstPoint0.y, 1);
        }
    }


    static _fromPointsToBase(srcPoint0, srcPoint1, srcPoint2, srcPoint3) {
        // This is simply the inverse transformation matrix to _fromBaseToPoints.
        // The result is the same as from step 4 in the stackexchange answer.
        return PerspectiveTransformationMatrix._fromBaseToPoints(srcPoint0, srcPoint1, srcPoint2, srcPoint3)
            .invert();
    }


    invert() {
        // The inverse can be computed as adjugate divided by determinant. As homogeneous coordinates don't care about
        // scalar multiplications and the the determinant is a scalar, we can simply ignore it and use the adjugate.
        // (See "Digital Image Warping", page 52).
        // So here, we are actually computing the adjugate, not the inverse.
        const a11 = this.a11, a12 = this.a12, a13 = this.a13, a21 = this.a21, a22 = this.a22, a23 = this.a23,
            a31 = this.a31, a32 = this.a32, a33 = this.a33;
        this.a11 = a22 * a33 - a23 * a32;
        this.a12 = a13 * a32 - a12 * a33;
        this.a13 = a12 * a23 - a13 * a22;
        this.a21 = a23 * a31 - a21 * a33;
        this.a22 = a11 * a33 - a13 * a31;
        this.a23 = a13 * a21 - a11 * a23;
        this.a31 = a21 * a32 - a22 * a31;
        this.a32 = a12 * a31 - a11 * a32;
        this.a33 = a11 * a22 - a12 * a21;
        return this;
    }


    multiplyWithMatrix(other) {
        const a11 = this.a11, a12 = this.a12, a13 = this.a13, a21 = this.a21, a22 = this.a22, a23 = this.a23,
            a31 = this.a31, a32 = this.a32, a33 = this.a33;
        this.a11 = other.a11 * a11 + other.a21 * a12 + other.a31 * a13;
        this.a12 = other.a12 * a11 + other.a22 * a12 + other.a32 * a13;
        this.a13 = other.a13 * a11 + other.a23 * a12 + other.a33 * a13;
        this.a21 = other.a11 * a21 + other.a21 * a22 + other.a31 * a23;
        this.a22 = other.a12 * a21 + other.a22 * a22 + other.a32 * a23;
        this.a23 = other.a13 * a21 + other.a23 * a22 + other.a33 * a23;
        this.a31 = other.a11 * a31 + other.a21 * a32 + other.a31 * a33;
        this.a32 = other.a12 * a31 + other.a22 * a32 + other.a32 * a33;
        this.a33 = other.a13 * a31 + other.a23 * a32 + other.a33 * a33;
        return this;
    }
}