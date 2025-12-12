export default class AgentBehavior {
    constructor(agents, city, easystar, blackDoorTiles, whiteDoorTiles) {
        this.agents = agents;
        this.city = city;
        this.easystar = easystar;
        this.blackDoorTiles = blackDoorTiles;
        this.whiteDoorTiles = whiteDoorTiles;
    }

    update(thoughtBubbles) {
        this.handleAgentCollisions(thoughtBubbles);
    }

    handleAgentCollisions(thoughtBubbles) {
        const agentPositions = {};
        this.agents.forEach(agent => {
            const key = `${agent.x},${agent.y}`;
            if (!agentPositions[key]) {
                agentPositions[key] = [];
            }
            agentPositions[key].push(agent);
        });

        for (const key in agentPositions) {
            const agentsOnTile = agentPositions[key];
            if (agentsOnTile.length > 1) {
                const grayAgent = agentsOnTile.find(a => a.color === 'gray');
                if (grayAgent) {
                    agentsOnTile.forEach(a => {
                        if (a.color !== 'gray') {
                            a.color = 'gray';
                            thoughtBubbles.push({ x: a.x, y: a.y, timer: 60 });
                        }
                    });
                }

                const influencer = agentsOnTile.find(a => a.mission === 'influence' && a.color !== 'pink' && a.color !== 'gray');
                if (influencer) {
                    agentsOnTile.forEach(a => {
                        if (a.color !== influencer.color) {
                            a.color = influencer.color;
                            a.originalColor = influencer.color;
                        }
                    });
                }

                const persuader = agentsOnTile.find(a => a.mission === 'persuade' && a.color !== 'pink' && a.color !== 'gray');
                if (persuader) {
                    const target = agentsOnTile.find(a => a.id !== persuader.id && a.color !== persuader.color);
                    if (target) {
                        target.isPersuadedToBomb = true;
                        const enemyDoors = persuader.color === 'black' ? this.whiteDoorTiles : this.blackDoorTiles;
                        if (enemyDoors.length > 0) {
                            target.persuadedBombTarget = enemyDoors[Math.floor(Math.random() * enemyDoors.length)];
                        }
                    }
                }

                const elicitor = agentsOnTile.find(a => a.mission === 'elicit' && a.color !== 'pink' && a.color !== 'gray');
                if (elicitor) {
                    const target = agentsOnTile.find(a => a.id !== elicitor.id);
                    if (target) {
                        elicitor.isEliciting = true;
                        elicitor.elicitCooldown = 30;
                    }
                }
            }
        }
    }

    handleExplosion(bomb, game) {
        const houseX = Math.floor(bomb.x / 8) * 8;
        const houseY = Math.floor(bomb.y / 8) * 8;

        const house = this.city.houses.find(h => h.x === houseX && h.y === houseY);
        if (house && !house.isDestroyed) {
            house.isDestroyed = true;
            if (house.allegiance === 'black') {
                game.blackHousesDestroyed++;
            } else {
                game.whiteHousesDestroyed++;
            }
        }

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const tileX = houseX + j;
                const tileY = houseY + i;
                if (this.city.grid[tileY] && this.city.grid[tileY][tileX] === 'blue') {
                    this.city.grid[tileY][tileX] = 'brown';
                }
            }
        }

        this.agents.forEach(agent => {
            const dx = agent.x - bomb.x;
            const dy = agent.y - bomb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 4) { // 4 is the final explosion radius
                switch (agent.behaviourReactionCharacterType) {
                    case 'rabbit':
                        this.assignNewRandomPath(agent);
                        break;
                    case 'puppy':
                        agent.color = 'pink';
                        break;
                    case 'owl':
                        agent.isPaused = true;
                        agent.pauseCooldown = 120; // 2 seconds
                        break;
                    case 'hyena':
                        this.assignPathToTarget(agent, bomb.x, bomb.y);
                        break;
                    default:
                        agent.color = 'pink';
                        break;
                }
            }
        });
    }

    assignNewRandomPath(agent) {
        const toX = Math.floor(Math.random() * this.city.grid[0].length);
        const toY = Math.floor(Math.random() * this.city.grid.length);
        this.easystar.findPath(agent.x, agent.y, toX, toY, (path) => {
            if (path) {
                agent.currentPath = path;
            }
        });
        this.easystar.calculate();
    }

    assignPathToTarget(agent, x, y) {
        this.easystar.findPath(agent.x, agent.y, x, y, (path) => {
            if (path) {
                agent.currentPath = path;
            }
        });
        this.easystar.calculate();
    }
}
