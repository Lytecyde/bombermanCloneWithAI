import City from './CityBuilder.js';
import Agent from './Agent.js';
import Bomb from './Bomb.js';
import Dialogue from './Dialogue.js';
import DialogueBehavior from './DialogueBehavior.js';
import AgentBehavior from './AgentBehavior.js';
import './lib/easystar.js';

export default class Game {
    constructor() {
        this.city = new City();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = 10;
        this.camera = {
            x: 0,
            y: 0
        };
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.agents = [];
        this.bombs = [];
        this.thoughtBubbles = [];
        this.player = new Agent(this.city.grid[0].length / 2, this.city.grid.length / 2, '#cccccc');
        this.dialogue = new Dialogue();
        this.dialogueBehavior = new DialogueBehavior(this.dialogue);
        this.easystar = new window.EasyStar();
        const grid = this.city.grid.map(row => row.map(tile => (tile === 'blue' ? 1 : 0)));
        this.easystar.setGrid(grid);
        this.easystar.setAcceptableTiles([0]);
        this.blackDoorTiles = [];
        this.whiteDoorTiles = [];
        this.agentBehavior = new AgentBehavior(this.agents, this.city, this.easystar, this.blackDoorTiles, this.whiteDoorTiles);
        this.isGameOver = false;
        this.blackHousesDestroyed = 0;
        this.whiteHousesDestroyed = 0;

        this.initGame();
    }

    async initGame() {
        this.findDoorTiles();
        await this.createAgentsAndPaths();
        this.addEventListeners();
        this.gameLoop();
    }

    findDoorTiles() {
        this.city.houses.forEach(house => {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const tileX = house.x + j;
                    const tileY = house.y + i;
                    if (this.city.grid[tileY] && this.city.grid[tileY][tileX] === 'brown') {
                        if (house.allegiance === 'black') {
                            this.blackDoorTiles.push({ x: tileX, y: tileY });
                        } else {
                            this.whiteDoorTiles.push({ x: tileX, y: tileY });
                        }
                    }
                }
            }
        });
    }

    createAgentsAndPaths() {
        const numberOfAgents = 128;
        const pathPromises = [];

        for (let i = 0; i < numberOfAgents * 2; i++) {
            const color = i < numberOfAgents ? 'black' : 'white';
            const startDoors = color === 'black' ? this.blackDoorTiles : this.whiteDoorTiles;
            const endDoors = color === 'black' ? this.whiteDoorTiles : this.blackDoorTiles;

            const startDoor = startDoors[Math.floor(Math.random() * startDoors.length)];
            const endDoor = endDoors[Math.floor(Math.random() * endDoors.length)];

            const agent = new Agent(startDoor.x, startDoor.y, color, { x: endDoor.x, y: endDoor.y });
            this.agents.push(agent);

            const forwardPathPromise = new Promise(resolve => {
                this.easystar.findPath(startDoor.x, startDoor.y, endDoor.x, endDoor.y, (path) => {
                    agent.pathForward = path || [];
                    agent.currentPath = agent.pathForward.slice();
                    resolve();
                });
            });

            const backwardPathPromise = new Promise(resolve => {
                this.easystar.findPath(endDoor.x, endDoor.y, startDoor.x, startDoor.y, (path) => {
                    agent.pathBackward = path || [];
                    resolve();
                });
            });

            pathPromises.push(forwardPathPromise, backwardPathPromise);
        }

        this.easystar.calculate();
        return Promise.all(pathPromises);
    }

    addEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.isGameOver || this.dialogue.isActive) return;

            const playerSpeed = 1;
            const cameraSpeed = 10;

            let nextX = this.player.x;
            let nextY = this.player.y;

            // Player movement
            if (e.key === 'ArrowUp') {
                nextY -= playerSpeed;
            } else if (e.key === 'ArrowDown') {
                nextY += playerSpeed;
            } else if (e.key === 'ArrowLeft') {
                nextX -= playerSpeed;
            } else if (e.key === 'ArrowRight') {
                nextX += playerSpeed;
            }

            if (this.city.grid[nextY] && this.city.grid[nextY][nextX] !== 'blue') {
                this.player.x = nextX;
                this.player.y = nextY;
            }

            // Camera movement
            if (e.key === 'i') {
                this.camera.y -= cameraSpeed;
            } else if (e.key === 'k') {
                this.camera.y += cameraSpeed;
            } else if (e.key === 'j') {
                this.camera.x -= cameraSpeed;
            } else if (e.key === 'l') {
                this.camera.x += cameraSpeed;
            }

            // Bomb defusal
            if (e.key === 'd') {
                this.defuseBomb();
            }

            // Center camera
            if (e.key === 'c') {
                this.camera.x = this.player.x * this.tileSize - this.canvas.width / 2;
                this.camera.y = this.player.y * this.tileSize - this.canvas.height / 2;
            }
        });
    }

    defuseBomb() {
        const playerX = Math.round(this.player.x);
        const playerY = Math.round(this.player.y);
        const bombIndex = this.bombs.findIndex(bomb => bomb.x === playerX && bomb.y === playerY);

        if (bombIndex > -1) {
            this.bombs.splice(bombIndex, 1);
        }
    }

    handlePlayerAgentCollisions() {
        if (this.dialogue.isActive) return;
        const playerX = Math.round(this.player.x);
        const playerY = Math.round(this.player.y);

        const collidedAgent = this.agents.find(agent => agent.x === playerX && agent.y === playerY);
        if (collidedAgent && (collidedAgent.color === 'black' || collidedAgent.color === 'white')) {
            this.dialogueBehavior.start(collidedAgent, (agent, shouldConvert) => {
                if (shouldConvert) {
                    agent.color = 'gray';
                }
            });
        }
    }

    updateScoresAndCheckWinCondition() {
        const blackScore = this.agents.filter(agent => agent.color === 'black').length;
        const whiteScore = this.agents.filter(agent => agent.color === 'white').length;
        const grayScore = this.agents.filter(agent => agent.color === 'gray').length;

        document.getElementById('black-score').textContent = blackScore;
        document.getElementById('white-score').textContent = whiteScore;
        document.getElementById('gray-score').textContent = grayScore;
        document.getElementById('black-destroyed-score').textContent = this.blackHousesDestroyed;
        document.getElementById('white-destroyed-score').textContent = this.whiteHousesDestroyed;

        const gameOverOverlay = document.getElementById('game-over-overlay');

        if (grayScore > blackScore + whiteScore) {
            this.isGameOver = true;
            gameOverOverlay.textContent = 'Victory!';
            gameOverOverlay.style.display = 'flex';
        } else if (blackScore === 0 || whiteScore === 0) {
            this.isGameOver = true;
            gameOverOverlay.textContent = 'Defeat!';
            gameOverOverlay.style.display = 'flex';
        }
    }

    update() {
        this.handlePlayerAgentCollisions();

        if (this.isGameOver || this.dialogue.isActive) return;

        this.agentBehavior.update(this.thoughtBubbles);
        this.updateScoresAndCheckWinCondition();

        this.thoughtBubbles.forEach(bubble => bubble.timer--);
        this.thoughtBubbles = this.thoughtBubbles.filter(bubble => bubble.timer > 0);

        this.agents.forEach(agent => {
            if (agent.isPaused) {
                agent.pauseCooldown--;
                if (agent.pauseCooldown <= 0) {
                    agent.isPaused = false;
                    agent.isMovingForward = !agent.isMovingForward;
                    agent.currentPath = (agent.isMovingForward ? agent.pathForward : agent.pathBackward).slice();
                }
                return;
            }

            if (agent.elicitCooldown > 0) {
                agent.elicitCooldown--;
                if (agent.elicitCooldown <= 0) {
                    agent.isEliciting = false;
                }
            }

            agent.moveCooldown--;
            if (agent.moveCooldown > 0) {
                return;
            }

            if (agent.isPersuadedToBomb && agent.persuadedBombTarget) {
                this.agentBehavior.assignPathToTarget(agent, agent.persuadedBombTarget.x, agent.persuadedBombTarget.y);
                agent.isPersuadedToBomb = false; // One-time persuasion
            }

            if (agent.currentPath && agent.currentPath.length > 0) {
                const nextStep = agent.currentPath.shift();
                agent.x = nextStep.x;
                agent.y = nextStep.y;
            } else {
                agent.isPaused = true;
                if (agent.isMovingForward) {
                    agent.pauseCooldown = agent.destinationPause;
                    agent.tripsCompleted++;
                    if (agent.mission === 'bomb' && agent.tripsCompleted % 3 === 0 && agent.color !== 'pink' && agent.color !== 'gray') {
                        this.bombs.push(new Bomb(agent.x, agent.y));
                    }
                    if (agent.persuadedBombTarget && agent.x === agent.persuadedBombTarget.x && agent.y === agent.persuadedBombTarget.y) {
                        this.bombs.push(new Bomb(agent.x, agent.y));
                        agent.persuadedBombTarget = null;
                    }
                } else {
                    agent.pauseCooldown = agent.maxPause;
                }
            }
            agent.moveCooldown = agent.speed;
        });

        this.bombs.forEach(bomb => {
            bomb.update();
            if (bomb.explosionTimer <= 0) {
                this.agentBehavior.handleExplosion(bomb, this);
            }
        });
        this.bombs = this.bombs.filter(bomb => bomb.explosionTimer > 0);
    }

    gameLoop() {
        if (this.isGameOver) {
            this.render(); // Render one last time to show final state
            return;
        }
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const startX = Math.floor(this.camera.x / this.tileSize);
        const startY = Math.floor(this.camera.y / this.tileSize);
        const endX = startX + Math.ceil(this.canvas.width / this.tileSize);
        const endY = startY + Math.ceil(this.canvas.height / this.tileSize);

        for (let i = startY; i < endY; i++) {
            for (let j = startX; j < endX; j++) {
                if (this.city.grid[i] && this.city.grid[i][j]) {
                    this.ctx.fillStyle = this.city.grid[i][j];
                    this.ctx.fillRect(
                        (j - startX) * this.tileSize,
                        (i - startY) * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }

        this.city.houses.forEach(house => {
            this.ctx.font = `${this.tileSize * 2}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const screenX = (house.x + 4 - startX) * this.tileSize;
            const screenY = (house.y + 4 - startY) * this.tileSize;
            this.ctx.fillText(house.allegiance === 'black' ? '🏴' : '🏳️', screenX, screenY);
        });

        this.agents.forEach(agent => {
            if (!agent.isPaused) {
                this.ctx.fillStyle = agent.isEliciting ? 'yellow' : agent.color;
                this.ctx.fillRect(
                    (agent.x - startX) * this.tileSize,
                    (agent.y - startY) * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
            }
        });

        this.bombs.forEach(bomb => {
            this.ctx.font = `${this.tileSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const screenX = (bomb.x - startX) * this.tileSize + this.tileSize / 2;
            const screenY = (bomb.y - startY) * this.tileSize + this.tileSize / 2;

            if (bomb.state === 'planted') {
                this.ctx.fillText('💣', screenX, screenY);
            } else if (bomb.state === 'exploding') {
                this.ctx.globalAlpha = bomb.explosionTimer / bomb.explosionDuration;
                this.ctx.fillStyle = 'orange';
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, bomb.explosionRadius * this.tileSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1.0;
            }
        });

        this.thoughtBubbles.forEach(bubble => {
            this.ctx.font = `${this.tileSize * 2}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const screenX = (bubble.x - startX) * this.tileSize + this.tileSize / 2;
            const screenY = (bubble.y - startY) * this.tileSize - this.tileSize;
            this.ctx.fillText('💬', screenX, screenY);
        });

        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(
            (this.player.x - startX) * this.tileSize,
            (this.player.y - startY) * this.tileSize,
            this.tileSize,
            this.tileSize
        );

        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(
            (this.player.x - startX) * this.tileSize + this.tileSize / 2 - 1,
            (this.player.y - startY) * this.tileSize + this.tileSize / 2 - 1,
            2,
            2
        );
    }
}
