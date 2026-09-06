// Swirling Winds Canvas 2D renderer — BP047 Phase 1.
// Dependency-free low-resolution noise bands for the Mnemosyne ambience easter egg.
export const TIER_CONFIG = {
    OFF: null,
    WHISPER: {
        opacityMin: 0.015,
        opacityMax: 0.03,
        layers: 1,
        speed: 0.15,
        colorA: '#6ee7b7',
        colorB: '#0a0f1a',
    },
    BREEZE: {
        opacityMin: 0.03,
        opacityMax: 0.06,
        layers: 2,
        speed: 0.35,
        colorA: '#6ee7b7',
        colorB: '#1e293b',
    },
    GUST: {
        opacityMin: 0.06,
        opacityMax: 0.10,
        layers: 3,
        speed: 0.65,
        colorA: '#6ee7b7',
        colorB: '#312e81',
        colorC: '#facc15',
    },
    STORM: {
        opacityMin: 0.10,
        opacityMax: 0.16,
        layers: 4,
        speed: 1.0,
        colorA: '#6ee7b7',
        colorB: '#312e81',
        colorC: '#facc15',
    },
};
export class WindRenderer {
    constructor(canvas) {
        this.tier = 'OFF';
        this.rafId = null;
        this.t = 0;
        this.bgInterval = null;
        this.paused = false;
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Swirling Winds requires a 2D canvas context');
        }
        this.ctx = ctx;
    }
    resize(width, height) {
        const nextWidth = Math.max(1, Math.floor(width * 0.25));
        const nextHeight = Math.max(1, Math.floor(height * 0.25));
        if (this.canvas.width !== nextWidth)
            this.canvas.width = nextWidth;
        if (this.canvas.height !== nextHeight)
            this.canvas.height = nextHeight;
    }
    setTier(tier) {
        this.tier = tier;
        if (tier === 'OFF') {
            this.stop();
            this.clear();
            return;
        }
        this.start();
    }
    pauseOnBlur() {
        this.paused = true;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.tier !== 'OFF' && !this.bgInterval) {
            this.bgInterval = setInterval(() => this.drawFrame(), 100);
        }
    }
    resumeOnFocus() {
        this.paused = false;
        if (this.bgInterval) {
            clearInterval(this.bgInterval);
            this.bgInterval = null;
        }
        if (this.tier !== 'OFF')
            this.start();
    }
    destroy() {
        this.stop();
        this.clear();
    }
    start() {
        if (this.rafId !== null || this.paused)
            return;
        const loop = () => {
            this.drawFrame();
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }
    stop() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.bgInterval) {
            clearInterval(this.bgInterval);
            this.bgInterval = null;
        }
    }
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    drawFrame() {
        const config = TIER_CONFIG[this.tier];
        if (!config) {
            this.clear();
            return;
        }
        const width = this.canvas.width;
        const height = this.canvas.height;
        this.t += config.speed * 0.003;
        this.ctx.clearRect(0, 0, width, height);
        for (let layer = 0; layer < config.layers; layer += 1) {
            const offset = layer * 1.7;
            const opacity = config.opacityMin + (config.opacityMax - config.opacityMin) * ((layer + 1) / config.layers);
            let color = config.colorA;
            if (layer === 1)
                color = config.colorB;
            if (layer >= 2 && config.colorC)
                color = config.colorC;
            this.ctx.globalAlpha = opacity;
            const bandCount = 6 + layer * 2;
            for (let i = 0; i < bandCount; i += 1) {
                const y0 = ((i / bandCount) + this.fbm(offset, this.t + i * 0.3) * 0.3) * height;
                const y1 = y0 + height * (0.08 + 0.05 * this.fbm(offset + 0.5, this.t + i * 0.4));
                const xShift = config.layers >= 3 ? this.fbm(offset + 1.0, this.t + i * 0.2) * width * 0.15 : 0;
                const grad = this.ctx.createLinearGradient(xShift, y0, width * 0.7 + xShift, y1);
                grad.addColorStop(0, 'transparent');
                grad.addColorStop(0.3, color);
                grad.addColorStop(0.7, color);
                grad.addColorStop(1, 'transparent');
                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.moveTo(xShift * 0.5, y0);
                this.ctx.lineTo(width + xShift, y0);
                this.ctx.lineTo(width + xShift, y1);
                this.ctx.lineTo(xShift * 0.5, y1);
                this.ctx.closePath();
                this.ctx.fill();
            }
        }
        this.ctx.globalAlpha = 1;
    }
    fbm(x, y) {
        let value = 0;
        let amplitude = 0.5;
        let fx = x;
        let fy = y;
        for (let i = 0; i < 5; i += 1) {
            value += amplitude * this.noise2(fx, fy);
            fx *= 2.0;
            fy *= 2.0;
            amplitude *= 0.5;
        }
        return (value + 1) / 2;
    }
    noise2(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        const a = this.hash(ix, iy);
        const b = this.hash(ix + 1, iy);
        const c = this.hash(ix, iy + 1);
        const d = this.hash(ix + 1, iy + 1);
        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }
    hash(x, y) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
    }
}
