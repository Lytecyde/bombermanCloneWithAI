export default class Bomb {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.timer = 180; // 3 seconds at 60fps
        this.state = 'planted'; // 'planted', 'exploding'
        this.explosionRadius = 0;
        this.explosionDuration = 90; // 1.5 seconds at 60fps
        this.explosionTimer = this.explosionDuration;
    }

    update() {
        if (this.state === 'planted') {
            this.timer--;
            if (this.timer <= 0) {
                this.state = 'exploding';
            }
        } else if (this.state === 'exploding') {
            this.explosionTimer--;
            const progress = 1 - (this.explosionTimer / this.explosionDuration);
            this.explosionRadius = progress * 4; // Expand to cover the house (8x8 tiles)
        }
    }
}
