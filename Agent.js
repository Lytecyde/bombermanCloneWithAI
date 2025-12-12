const behaviourReactionTypes = ['rabbit', 'monkey', 'puppy', 'wolf', 'fox', 'owl', 'bear', 'hyena'];
const negotiationTypes = ['avoider', 'actor', 'assertive', 'accommodator', 'analyst'];
const missions = ['bomb', 'persuade', 'elicit', 'influence'];

let agentIdCounter = 0;

export default class Agent {
    constructor(x, y, color, destination) {
        this.id = agentIdCounter++;
        this.spawnPoint = { x, y };
        this.destinationPoint = destination;
        this.x = x;
        this.y = y;
        this.originalColor = color;
        this.color = color;

        this.behaviourReactionCharacterType = behaviourReactionTypes[Math.floor(Math.random() * behaviourReactionTypes.length)];
        this.negotiationCharacterType = negotiationTypes[Math.floor(Math.random() * negotiationTypes.length)];
        this.mission = missions[Math.floor(Math.random() * missions.length)];

        this.pathForward = [];
        this.pathBackward = [];
        this.currentPath = [];
        this.isMovingForward = true;

        this.speed = Math.floor(Math.random() * 10) + 5;
        this.moveCooldown = this.speed;

        this.isPaused = false;
        this.pauseCooldown = 0;
        this.maxPause = Math.random() * 420;
        this.destinationPause = Math.random() * 180;

        this.tripsCompleted = 0;

        // Mission-specific properties
        this.isPersuadedToBomb = false;
        this.persuadedBombTarget = null;
        this.isEliciting = false;
        this.elicitCooldown = 0;
    }
}
