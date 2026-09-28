import './lib/easystar.js';

// "Reverse Bomberman": the player never plants a bomb. Twelve computer-controlled
// bombers wander the map, drop bombs on their own schedule, and the player's only
// job is to read the blast lines and run.

const TS = 32;
const COLS = 17;
const ROWS = 13;
const NUM_BOMBERS = 12;
const WOOD_PROB = 0.55;
const SURVIVAL_TARGET = 90; // seconds
const BOMB_FUSE = 2.2; // seconds
const BOMB_RADIUS = 2; // tiles
const EXPLOSION_DURATION = 0.5; // seconds a blast tile stays lethal
const PLAYER_SPEED = 132; // px/s
const NPC_SPEED = 66; // px/s
const PLAYER_HALF = 11; // collision half-size, px

const PLAYER_FRAME_W = 27;
const PLAYER_FRAME_H = 40;
const BOMB_FRAME_W = 28;
const BOMB_FRAME_H = 28;
const BOMB_FRAME_COUNT = 5;
const FIRE_H = 38;
const FIRE_FRAMES = [
    { x: 0, w: 38 },
    { x: 42, w: 32 },
    { x: 81, w: 26 },
    { x: 121, w: 22 },
    { x: 156, w: 22 },
    { x: 196, w: 18 }
];

// Sprite sheet rows, confirmed by inspecting bomberman.png: down, left, up, right.
const DIR_ROW = { down: 0, left: 1, up: 2, right: 3 };

function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img); // don't block the game on a missing asset
        img.src = src;
    });
}

export default class ReverseBomberman {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = COLS * TS;
        this.canvas.height = ROWS * TS;

        this.grid = [];
        this.bombs = [];
        this.explosions = [];
        this.bombers = [];
        this.keys = {};
        this.elapsed = 0;
        this.state = 'loading'; // loading -> playing -> won | lost
        this.easystar = new window.EasyStar();
        this.easystar.setAcceptableTiles([0]);
        this.easystar.setIterationsPerCalculation(1000);

        this.player = {
            x: 0, y: 0, dir: 'down', moving: false,
            animFrame: 0, animTimer: 0
        };

        this.init();
    }

    async init() {
        const [tileGrass, tileWall, tileWood, bombSheet, fireSheet, playerSheet] = await Promise.all([
            loadImage('assets/tile_grass.png'),
            loadImage('assets/tile_wall.png'),
            loadImage('assets/tile_wood.png'),
            loadImage('assets/bomb.png'),
            loadImage('assets/fire.png'),
            loadImage('assets/bomberman.png')
        ]);
        this.images = { tileGrass, tileWall, tileWood, bombSheet, fireSheet, playerSheet };

        this.generateGrid();
        this.updateEasystarGrid();
        this.spawnPlayerAndBombers();
        this.addEventListeners();

        this.state = 'playing';
        this.lastTime = performance.now();
        requestAnimationFrame(t => this.loop(t));
    }

    // ---- map generation ----------------------------------------------------

    generateGrid() {
        this.grid = [];
        for (let y = 0; y < ROWS; y++) {
            const row = [];
            for (let x = 0; x < COLS; x++) {
                if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
                    row.push('wall');
                } else if (x % 2 === 0 && y % 2 === 0) {
                    row.push('wall'); // classic indestructible pillar grid
                } else {
                    row.push(Math.random() < WOOD_PROB ? 'wood' : null);
                }
            }
            this.grid.push(row);
        }

        this.clearTile(1, 1);
        this.clearTile(2, 1);
        this.clearTile(1, 2);
    }

    clearTile(x, y) {
        if (this.grid[y] && this.grid[y][x] !== 'wall') {
            this.grid[y][x] = null;
        }
    }

    updateEasystarGrid() {
        const numericGrid = this.grid.map(row => row.map(tile => (tile === null ? 0 : 1)));
        this.easystar.setGrid(numericGrid);
    }

    spawnPlayerAndBombers() {
        this.player.x = 1 * TS + TS / 2;
        this.player.y = 1 * TS + TS / 2;

        const candidates = [];
        for (let y = 1; y < ROWS - 1; y++) {
            for (let x = 1; x < COLS - 1; x++) {
                if (this.grid[y][x] === 'wall') continue;
                const dist = Math.abs(x - 1) + Math.abs(y - 1);
                if (dist >= 6) candidates.push({ x, y });
            }
        }
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }

        const spawns = candidates.slice(0, NUM_BOMBERS);
        spawns.forEach((tile, i) => {
            this.clearTile(tile.x, tile.y);
            const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of neighbors) {
                const nx = tile.x + dx, ny = tile.y + dy;
                if (this.grid[ny] && this.grid[ny][nx] !== 'wall') {
                    this.clearTile(nx, ny);
                    break;
                }
            }
            this.bombers.push({
                id: i,
                x: tile.x * TS + TS / 2,
                y: tile.y * TS + TS / 2,
                gridX: tile.x,
                gridY: tile.y,
                dir: 'down',
                moving: false,
                animFrame: 0,
                animTimer: 0,
                currentPath: [],
                bombTimer: 2 + Math.random() * 3,
                alive: true
            });
        });
        this.updateEasystarGrid();
    }

    // ---- input ---------------------------------------------------------------

    addEventListeners() {
        document.addEventListener('keydown', e => { this.keys[e.key] = true; });
        document.addEventListener('keyup', e => { this.keys[e.key] = false; });
    }

    // ---- collision helpers -----------------------------------------------

    isTileBlocked(gx, gy) {
        if (!this.grid[gy] || this.grid[gy][gx] === undefined) return true;
        const tile = this.grid[gy][gx];
        if (tile === 'wall' || tile === 'wood') return true;
        return this.bombs.some(b => !b.exploded && b.tileX === gx && b.tileY === gy);
    }

    canOccupy(cx, cy, half) {
        const corners = [
            [cx - half, cy - half], [cx + half, cy - half],
            [cx - half, cy + half], [cx + half, cy + half]
        ];
        for (const [px, py] of corners) {
            const gx = Math.floor(px / TS), gy = Math.floor(py / TS);
            if (this.isTileBlocked(gx, gy)) return false;
        }
        return true;
    }

    // ---- bombers -----------------------------------------------------------

    isBlastDanger(x, y) {
        return this.bombs.some(b => {
            if (b.exploded) return false;
            if (b.tileX === x && Math.abs(b.tileY - y) <= b.radius) return true;
            if (b.tileY === y && Math.abs(b.tileX - x) <= b.radius) return true;
            return false;
        });
    }

    pickSafeTarget(bomber) {
        for (let attempt = 0; attempt < 15; attempt++) {
            const x = 1 + Math.floor(Math.random() * (COLS - 2));
            const y = 1 + Math.floor(Math.random() * (ROWS - 2));
            if (this.grid[y][x] !== null) continue;
            if (Math.abs(x - bomber.gridX) + Math.abs(y - bomber.gridY) < 3) continue;
            if (this.isBlastDanger(x, y)) continue;
            return { x, y };
        }
        for (let y = 1; y < ROWS - 1; y++) {
            for (let x = 1; x < COLS - 1; x++) {
                if (this.grid[y][x] === null && !this.isBlastDanger(x, y)) return { x, y };
            }
        }
        return { x: bomber.gridX, y: bomber.gridY };
    }

    requestBomberPath(bomber) {
        const target = this.pickSafeTarget(bomber);
        this.easystar.findPath(bomber.gridX, bomber.gridY, target.x, target.y, path => {
            bomber.currentPath = path && path.length > 1 ? path.slice(1) : [];
        });
    }

    updateBomber(bomber, dt) {
        if (!bomber.alive) return;

        bomber.gridX = Math.floor(bomber.x / TS);
        bomber.gridY = Math.floor(bomber.y / TS);

        bomber.bombTimer -= dt;
        if (bomber.bombTimer <= 0 && !this.bombs.some(b => !b.exploded && b.tileX === bomber.gridX && b.tileY === bomber.gridY)) {
            this.plantBomb(bomber.gridX, bomber.gridY);
            bomber.bombTimer = 4 + Math.random() * 4;
            bomber.currentPath = [];
        }

        if (bomber.currentPath.length === 0) {
            this.requestBomberPath(bomber);
        }

        const waypoint = bomber.currentPath[0];
        bomber.moving = false;
        if (waypoint) {
            const wx = waypoint.x * TS + TS / 2;
            const wy = waypoint.y * TS + TS / 2;
            if (this.isTileBlocked(waypoint.x, waypoint.y) && !(waypoint.x === bomber.gridX && waypoint.y === bomber.gridY)) {
                // a bomb is sitting on the next tile; wait it out
            } else {
                const dx = wx - bomber.x, dy = wy - bomber.y;
                const dist = Math.hypot(dx, dy);
                const step = NPC_SPEED * dt;
                if (dist <= step) {
                    bomber.x = wx;
                    bomber.y = wy;
                    bomber.currentPath.shift();
                } else {
                    bomber.x += (dx / dist) * step;
                    bomber.y += (dy / dist) * step;
                }
                bomber.dir = this.dirFromDelta(dx, dy, bomber.dir);
                bomber.moving = true;
            }
        }

        this.stepAnim(bomber, dt);
    }

    dirFromDelta(dx, dy, fallback) {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        if (Math.abs(dy) > 0) return dy > 0 ? 'down' : 'up';
        return fallback;
    }

    stepAnim(entity, dt) {
        if (!entity.moving) {
            entity.animFrame = 0;
            entity.animTimer = 0;
            return;
        }
        entity.animTimer += dt;
        if (entity.animTimer > 0.12) {
            entity.animTimer = 0;
            entity.animFrame = (entity.animFrame + 1) % 4;
        }
    }

    // ---- bombs & explosions --------------------------------------------------

    plantBomb(tileX, tileY) {
        this.bombs.push({ tileX, tileY, timer: BOMB_FUSE, radius: BOMB_RADIUS, exploded: false });
    }

    explodeBomb(bomb) {
        bomb.exploded = true;
        const cells = [{ x: bomb.tileX, y: bomb.tileY }];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
            for (let step = 1; step <= bomb.radius; step++) {
                const nx = bomb.tileX + dx * step;
                const ny = bomb.tileY + dy * step;
                if (!this.grid[ny] || this.grid[ny][nx] === undefined) break;
                const tile = this.grid[ny][nx];
                if (tile === 'wall') break;
                cells.push({ x: nx, y: ny });
                if (tile === 'wood') {
                    this.grid[ny][nx] = null;
                    this.updateEasystarGrid();
                    break;
                }
            }
        }
        cells.forEach(c => this.explosions.push({ x: c.x, y: c.y, timer: EXPLOSION_DURATION }));

        // chain reaction: any other live bomb caught in this blast goes off too, with a
        // brief stagger so a long line of bombs ripples visibly instead of vanishing in one frame
        this.bombs.forEach(other => {
            if (other !== bomb && !other.exploded && cells.some(c => c.x === other.tileX && c.y === other.tileY)) {
                other.timer = Math.min(other.timer, 0.12);
            }
        });
    }

    updateBombsAndExplosions(dt) {
        this.bombs.forEach(bomb => {
            if (bomb.exploded) return;
            bomb.timer -= dt;
            if (bomb.timer <= 0) this.explodeBomb(bomb);
        });
        this.bombs = this.bombs.filter(b => !b.exploded);

        this.explosions.forEach(e => { e.timer -= dt; });

        const playerGX = Math.floor(this.player.x / TS);
        const playerGY = Math.floor(this.player.y / TS);
        if (this.explosions.some(e => e.timer > 0 && e.x === playerGX && e.y === playerGY)) {
            this.endGame('lost');
        }

        this.bombers.forEach(bomber => {
            if (!bomber.alive) return;
            if (this.explosions.some(e => e.timer > 0 && e.x === bomber.gridX && e.y === bomber.gridY)) {
                bomber.alive = false;
            }
        });
        this.bombers = this.bombers.filter(b => b.alive);

        this.explosions = this.explosions.filter(e => e.timer > 0);
    }

    // ---- player --------------------------------------------------------------

    updatePlayer(dt) {
        let vx = 0, vy = 0;
        if (this.keys['ArrowLeft'] || this.keys['a']) vx -= 1;
        if (this.keys['ArrowRight'] || this.keys['d']) vx += 1;
        if (this.keys['ArrowUp'] || this.keys['w']) vy -= 1;
        if (this.keys['ArrowDown'] || this.keys['s']) vy += 1;

        this.player.moving = vx !== 0 || vy !== 0;
        if (vx !== 0 && vy !== 0) {
            vx *= Math.SQRT1_2;
            vy *= Math.SQRT1_2;
        }

        const newX = this.player.x + vx * PLAYER_SPEED * dt;
        if (this.canOccupy(newX, this.player.y, PLAYER_HALF)) this.player.x = newX;

        const newY = this.player.y + vy * PLAYER_SPEED * dt;
        if (this.canOccupy(this.player.x, newY, PLAYER_HALF)) this.player.y = newY;

        if (vx !== 0 || vy !== 0) this.player.dir = this.dirFromDelta(vx, vy, this.player.dir);
        this.stepAnim(this.player, dt);
    }

    // ---- game flow -------------------------------------------------------

    endGame(result) {
        if (this.state !== 'playing') return;
        this.state = result;
        const overlay = document.getElementById('rb-overlay');
        const seconds = Math.floor(this.elapsed);
        if (result === 'lost') {
            overlay.textContent = `Caught in the blast! Survived ${seconds}s`;
        } else if (result === 'survived') {
            overlay.textContent = `You survived the full ${SURVIVAL_TARGET}s!`;
        } else if (result === 'eliminated') {
            overlay.textContent = 'All 12 bombers blew themselves up. You win!';
        }
        overlay.style.display = 'flex';
    }

    update(dt) {
        if (this.state !== 'playing') return;
        this.elapsed += dt;

        this.updatePlayer(dt);
        this.bombers.forEach(b => this.updateBomber(b, dt));
        this.updateBombsAndExplosions(dt);
        this.easystar.calculate();

        if (this.state !== 'playing') return;
        if (this.bombers.length === 0) {
            this.endGame('eliminated');
        } else if (this.elapsed >= SURVIVAL_TARGET) {
            this.endGame('survived');
        }

        document.getElementById('rb-timer').textContent = Math.max(0, Math.ceil(SURVIVAL_TARGET - this.elapsed));
        document.getElementById('rb-bombers').textContent = this.bombers.length;
    }

    // ---- rendering -------------------------------------------------------

    drawTile(img, x, y) {
        if (img && img.complete && img.naturalWidth) {
            this.ctx.drawImage(img, x * TS, y * TS, TS, TS);
        }
    }

    drawGrid() {
        const { tileGrass, tileWall, tileWood } = this.images;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const tile = this.grid[y][x];
                if (tile === 'wall') this.drawTile(tileWall, x, y);
                else if (tile === 'wood') this.drawTile(tileWood, x, y);
                else this.drawTile(tileGrass, x, y);
            }
        }
    }

    drawBomb(bomb) {
        const img = this.images.bombSheet;
        if (!img.complete || !img.naturalWidth) return;
        const urgency = 1 - bomb.timer / BOMB_FUSE;
        const pulseRate = 220 - urgency * 140;
        const frame = Math.floor(performance.now() / pulseRate) % BOMB_FRAME_COUNT;
        const sx = frame * BOMB_FRAME_W;
        const dx = bomb.tileX * TS + (TS - BOMB_FRAME_W) / 2;
        const dy = bomb.tileY * TS + (TS - BOMB_FRAME_H) / 2;
        this.ctx.drawImage(img, sx, 0, BOMB_FRAME_W, BOMB_FRAME_H, dx, dy, BOMB_FRAME_W, BOMB_FRAME_H);
    }

    drawExplosion(e) {
        const img = this.images.fireSheet;
        if (!img.complete || !img.naturalWidth) return;
        const progress = 1 - Math.max(0, e.timer) / EXPLOSION_DURATION;
        const frame = FIRE_FRAMES[Math.min(FIRE_FRAMES.length - 1, Math.floor(progress * FIRE_FRAMES.length))];
        const dx = e.x * TS + (TS - frame.w) / 2;
        const dy = e.y * TS + (TS - FIRE_H) / 2;
        this.ctx.drawImage(img, frame.x, 0, frame.w, FIRE_H, dx, dy, frame.w, FIRE_H);
    }

    drawCharacter(entity, sheet, tint) {
        if (!sheet.complete || !sheet.naturalWidth) return;
        const row = DIR_ROW[entity.dir] ?? 0;
        const col = entity.moving ? entity.animFrame : 0;
        const drawW = TS * 0.95;
        const drawH = drawW * (PLAYER_FRAME_H / PLAYER_FRAME_W);
        const screenX = entity.x - drawW / 2;
        const screenY = entity.y + TS / 2 - drawH;

        this.ctx.save();
        if (tint) this.ctx.filter = tint;
        this.ctx.drawImage(
            sheet,
            col * PLAYER_FRAME_W, row * PLAYER_FRAME_H, PLAYER_FRAME_W, PLAYER_FRAME_H,
            screenX, screenY, drawW, drawH
        );
        this.ctx.restore();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.images) return;

        this.drawGrid();
        this.bombs.forEach(b => this.drawBomb(b));
        this.bombers.forEach(b => this.drawCharacter(b, this.images.playerSheet, 'hue-rotate(160deg) saturate(2) brightness(0.95)'));
        this.drawCharacter(this.player, this.images.playerSheet, null);
        this.explosions.forEach(e => this.drawExplosion(e));
    }

    loop(now) {
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.update(dt);
        this.render();
        requestAnimationFrame(t => this.loop(t));
    }
}
