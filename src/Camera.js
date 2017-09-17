class Camera {

    constructor(videoOutput) {
        if (videoOutput && !(videoOutput instanceof HTMLVideoElement)) {
            throw Error('Video output must be a html 5 video element.');
        }
        this._videoOutput = videoOutput || document.createElement('video');
        this._snapshotCanvas = document.createElement('canvas');
        this._snapshotCanvasContext = this._snapshotCanvas.getContext('2d', {
            alpha: false // speeds up drawing
        });
        this._isFilming = false;
        this._shouldResumeCamera = false;
        // deactivate the camera on tab change
        document.addEventListener('visibilitychange', () => {
            if(document.visibilityState === 'hidden') {
                // Disconnect the camera.
                this._shouldResumeCamera = this._isFilming;
                this.stop();
            } else if (this._shouldResumeCamera) {
                this.start();
            }
        });
    }


    get isFilming() {
        return this._isFilming;
    }


    get dimensions() {
        return {
            width: this._videoOutput.videoWidth,
            height: this._videoOutput.videoHeight
        };
    }


    async start() {
        if (this._isFilming) {
            return;
        }
        this._stream = await Camera._getUserMedia({
            audio: false,
            video: { facingMode: 'environment' } // if no environment facing camera available, a best match is selected
        });
        if ("srcObject" in this._videoOutput) {
            this._videoOutput.srcObject = this._stream;
        } else {
            // for older browsers
            this._videoOutput.src = URL.createObjectURL(this._stream);
        }
        await new Promise((resolve, reject) => {
            this._videoOutput.oncanplay = resolve; // the video can play, so we know have the dimension and pixel data
            this._videoOutput.onloadedmetadata = () => this._videoOutput.play();
            setTimeout(reject, 3000);
        });
        this._isFilming = true;
    }


    stop() {
        this._stream.getTracks().forEach(track => track.stop());
        this._isFilming = false;
    }


    takeSnapshot(offsetLeft=0, offsetTop=0, offsetRight=0, offsetBottom=0) {
        if (!this._isFilming) {
            throw Error('Camera not running.');
        }
        const width = this.dimensions.width - offsetLeft - offsetRight;
        const height = this.dimensions.height - offsetTop - offsetBottom;
        if (this._snapshotCanvas.width !== width || this._snapshotCanvas.height !== height) {
            // the canvas does additional computations when setting width or height (e.g. erasing the canvas) even
            // when set to the old value, that's why we check whether the value actually changed
            this._snapshotCanvas.width = width;
            this._snapshotCanvas.height = height;
        }
        this._snapshotCanvasContext.drawImage(this._videoOutput, offsetLeft, offsetTop, width, height,
            0, 0, width, height);
        return this._snapshotCanvasContext.getImageData(0, 0, width, height);
    }


    static _getUserMedia(constraints) {
        if ('getUserMedia' in navigator.mediaDevices) {
            // new promise based API
            return navigator.mediaDevices.getUserMedia(constraints);
        } else {
            return new Promise((resolve, reject) => {
                const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                    navigator.mozGetUserMedia || navigator.msGetUserMedia;
                if (!getUserMedia) {
                    reject('getUserMedia not supported by browser.');
                }
                getUserMedia.call(navigator, constraints, resolve, reject);
            });
        }
    }
}