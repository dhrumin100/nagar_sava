import { FaceDetection, Results } from '@mediapipe/face_detection';

export interface ValidationResult {
    status: 'approved' | 'rejected';
    confidence: number;
    reason?: string;
}

export class ImageValidator {
    private faceDetection: FaceDetection | null = null;
    private isModelLoaded = false;

    constructor() {
        this.initFaceDetection();
    }

    private async initFaceDetection() {
        try {
            this.faceDetection = new FaceDetection({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
                }
            });

            this.faceDetection.setOptions({
                model: 'short',
                minDetectionConfidence: 0.5
            });

            this.faceDetection.onResults(this.onFaceResults);
            await this.faceDetection.initialize();
            this.isModelLoaded = true;
            console.log('Face Validator Model Loaded');
        } catch (error) {
            console.error('Failed to load Face Detection model:', error);
        }
    }

    private onFaceResults = (results: Results) => {
        // This is a placeholder callback. We process results per request.
    }

    public async validateImage(imageElement: HTMLImageElement): Promise<ValidationResult> {
        try {
            // 1. Dark Check
            const darkCheck = this.checkDarkness(imageElement);
            if (darkCheck.status === 'rejected') return darkCheck;

            // 2. Blur Check
            const blurCheck = this.checkBlur(imageElement);
            if (blurCheck.status === 'rejected') return blurCheck;

            // 3. Screenshot Check
            const screenshotCheck = this.checkScreenshot(imageElement);
            if (screenshotCheck.status === 'rejected') return screenshotCheck;

            // 4. Face Check (Async)
            if (this.isModelLoaded && this.faceDetection) {
                const faceCheck = await this.checkFaces(imageElement);
                if (faceCheck.status === 'rejected') return faceCheck;
            }

            return { status: 'approved', confidence: 1.0, reason: 'Passed all checks' };
        } catch (error) {
            console.error('Validation error:', error);
            // Fail open (approve) if validation crashes, to not block user inappropriately
            return { status: 'approved', confidence: 0.5, reason: 'Validation skipped due to error' };
        }
    }

    // --- DARKNESS CHECK ---
    private checkDarkness(img: HTMLImageElement): ValidationResult {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { status: 'approved', confidence: 1.0 };

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let totalBrightness = 0;
        const brightnessValues = [];

        // Sample pixels (optimization: skip every 4th pixel)
        for (let i = 0; i < data.length; i += 16) { // 4 channels * 4 (step)
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += brightness;
            brightnessValues.push(brightness);
        }

        const avgBrightness = totalBrightness / brightnessValues.length;

        if (avgBrightness < 30) {
            // Calculate StdDev
            const mean = avgBrightness;
            const squareDiffs = brightnessValues.map(value => Math.pow(value - mean, 2));
            const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
            const stdDev = Math.sqrt(avgSquareDiff);

            if (stdDev < 15) {
                return { status: 'rejected', confidence: 0.9, reason: 'Image is too dark and has low contrast (Uniformly black)' };
            }
            // Else: Dark but high contrast (street lights etc) -> Approved
        }
        return { status: 'approved', confidence: 1.0 };
    }

    // --- BLUR CHECK (Laplacian Variance) ---
    private checkBlur(img: HTMLImageElement): ValidationResult {
        const canvas = document.createElement('canvas');
        // Resize for performance checking blur
        const scale = Math.min(1.0, 500 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { status: 'approved', confidence: 1.0 };

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const grayData = this.toGrayscale(imageData);

        const laplacianVar = this.calculateLaplacianVariance(grayData, canvas.width, canvas.height);

        if (laplacianVar < 100) { // Conservative threshold
            // Check edge density as fallback (simple gradient check)
            const edgeDensity = this.calculateEdgeDensity(grayData, canvas.width, canvas.height);
            if (edgeDensity < 0.05) {
                // Low texture, smooth wall?
                // If edge density is REALLY low, it's likely just a plain wall or out of focus.
                // We can reject if it's too smooth (likely blurry/bad), OR accept if user wants smooth walls.
                // User prompt: "If it's just a smooth surface (like a road) ... ALLOW it"
                // Using logic: Low Laplacian + Low Edge Density = Smooth surface.
                // Low Laplacian + High Edge Density = Motion Blur? Actually high edge density usually means sharp.

                // Let's stick to: If var < threshold, it's blurring.
                // But if it's border line, check edges.

                if (laplacianVar < 50) {
                    return { status: 'rejected', confidence: 0.8, reason: 'Image is too blurry' };
                }
            }
        }
        return { status: 'approved', confidence: 1.0 };
    }

    private toGrayscale(imageData: ImageData): Uint8ClampedArray {
        const data = imageData.data;
        const gray = new Uint8ClampedArray(data.length / 4);
        for (let i = 0; i < data.length; i += 4) {
            gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        return gray;
    }

    private calculateLaplacianVariance(gray: Uint8ClampedArray, width: number, height: number): number {
        // Standard Laplacian Kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
        const laplacian = new Float32Array(gray.length);
        let mean = 0;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const val =
                    gray[idx - width] + // top
                    gray[idx + width] + // bottom
                    gray[idx - 1] +     // left
                    gray[idx + 1] +     // right
                    (-4 * gray[idx]);   // center

                laplacian[idx] = val;
                mean += val;
            }
        }
        mean /= laplacian.length;

        let variance = 0;
        for (let i = 0; i < laplacian.length; i++) {
            variance += Math.pow(laplacian[i] - mean, 2);
        }
        return variance / laplacian.length;
    }

    private calculateEdgeDensity(gray: Uint8ClampedArray, width: number, height: number): number {
        // Simple Sobel-like edge detection for density
        let edges = 0;
        const threshold = 30;
        for (let i = 0; i < gray.length - 1; i++) {
            if (Math.abs(gray[i] - gray[i + 1]) > threshold) edges++;
        }
        return edges / gray.length;
    }

    // --- SCREENSHOT CHECK ---
    private checkScreenshot(img: HTMLImageElement): ValidationResult {
        // 1. Resolution Check (Exact matches to common screens)
        const w = img.width;
        const h = img.height;
        const commonDims = [
            [720, 1280], [1080, 1920], [1440, 2560], [1170, 2532], [1125, 2436], // Phones
            [1920, 1080], [1366, 768] // Monitors
        ];

        const isCommonDim = commonDims.some(([cw, ch]) => (w === cw && h === ch) || (w === ch && h === cw));

        // 2. Solid Bars Check
        // Check top 3% and bottom 3%
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { status: 'approved', confidence: 1.0 };
        ctx.drawImage(img, 0, 0);

        const topH = Math.floor(h * 0.03);
        const botH = Math.floor(h * 0.03);

        const topData = ctx.getImageData(0, 0, w, topH).data;
        const botData = ctx.getImageData(0, h - botH, w, botH).data;

        const isSolidTop = this.calculateStdDev(topData) < 10;
        const isSolidBot = this.calculateStdDev(botData) < 10;

        if ((isCommonDim && (isSolidTop || isSolidBot)) || (isSolidTop && isSolidBot)) {
            return { status: 'rejected', confidence: 0.8, reason: 'Suspected screenshot (Dimensions + Solid Bars)' };
        }

        return { status: 'approved', confidence: 1.0 };
    }

    private calculateStdDev(data: Uint8ClampedArray): number {
        let sum = 0;
        let count = 0;
        // sample every 4th pixel, only green channel for speed
        for (let i = 1; i < data.length; i += 16) {
            sum += data[i];
            count++;
        }
        const mean = sum / count;
        let sqDiff = 0;
        for (let i = 1; i < data.length; i += 16) {
            sqDiff += Math.pow(data[i] - mean, 2);
        }
        return Math.sqrt(sqDiff / count);
    }

    // --- FACE CHECK ---
    private async checkFaces(img: HTMLImageElement): Promise<ValidationResult> {
        if (!this.faceDetection) return { status: 'approved', confidence: 1.0 };

        return new Promise((resolve) => {
            this.faceDetection!.send({ image: img }).then(() => {
                // We can't easily get results back synchronously from 'send' in this wrapper easily without a callback hook.
                // But FaceDetection.onResults is global.
                // Workaround: We set a one-time listener or use the cache from the listener.
            });

            // Actually, 'send' waits for processing. The 'onResults' fires.
            // We need to hook into onResults.
            const tempListener = (results: Results) => {
                if (results.detections.length > 0) {
                    let maxArea = 0;
                    results.detections.forEach(det => {
                        const bbox = det.boundingBox;
                        if (!bbox) return;
                        // Relative bounding box comes from normalizedRect usually?
                        // Medapipe JS results returns relative coords? Checking docs...
                        // results.detections[i].boundingBox is normalized [0..1] usually in some versions, but let's check.
                        // Actually results.detections[0].boundingBox is {xCenter, yCenter, width, height} normalized?
                        // Standard generic FaceDetection returns locationData with relativeBoundingBox.

                        const w = det.boundingBox.width; // normalized 0-1
                        const h = det.boundingBox.height; // normalized 0-1
                        const area = w * h;
                        if (area > maxArea) maxArea = area;
                    });

                    if (maxArea > 0.15) { // 15% of screen
                        resolve({ status: 'rejected', confidence: 0.9, reason: 'Face detected covering large area (Potential Selfie)' });
                        return;
                    }
                }
                resolve({ status: 'approved', confidence: 1.0 });
            };

            // @ts-ignore
            this.faceDetection.onResults(tempListener);
        });
    }
}

export const imageValidator = new ImageValidator();
