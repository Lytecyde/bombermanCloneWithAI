
// A Phaser.js game that flips the classic Bomberman concept
import City from '/CityBuilder.js';
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {y: 0},
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let bombersTeamA = [];
let bombersTeamB = [];
let peaceTeam = [];
const totalBombers = 20;
let cursors;
let redDot;
let scoreTeamA = 0;
let scoreTeamB = 0;
let scoreTeamPeace = 0;
let scoreTextTeamA;
let scoreTextTeamB;
let scoreTextTeamPeace;



function preload() {
    this.load.image('player', 'assets/player.png'); // Placeholder for the player sprite
    this.load.image('bomber', 'assets/bomber.png'); // Placeholder for bomberman sprite
    this.load.image('bomb', 'assets/bomb.png'); // Placeholder for bomb sprite
    
}

function create() {

    //create a city
    const city = this.add.group();
    const houseTiles = this.physics.add.staticGroup();
    let cityBuilder = new City();
    let cityGrid;
    cityGrid = cityBuilder.grid;
    cityGrid.forEach((row, i) => {
        row.forEach((cell, j) => {
            if (cell === 'gray') {
                const rect = this.add.rectangle(j * 32 , i * 32 , 32, 32, 0x808080);
                city.add(rect);
            } else if (cell === 'black') {
                const rect = this.add.rectangle(j * 32 , i * 32 , 32, 32, 0x000000);
                city.add(rect);
            } else if (cell === 'blue') {
                const rect = this.add.rectangle(j * 32 , i * 32 , 32, 32, 0x0000FF);
                city.add(rect);
                houseTiles.add(rect);
            }
            else if (cell ===  'brown') {
                const rect = this.add.rectangle(j * 32 , i * 32 , 32, 32, 0x8B4513);
                city.add(rect);
                houseTiles.add(rect);
            }
        });
    });
    // Add the player at the center of the map
    player = this.physics.add.sprite(400, 280, 'player');
    player.setCollideWorldBounds(true);

    redDot = this.add.circle(100, 100, 4, 0xff0000); // Red, 4px radius
    houseTiles.setDepth(1);
    player.setDepth(1);  // Ensure player is on top
    redDot.setDepth(2); // Ensure red dot is on top of

    this.physics.add.collider(player, houseTiles);

    scoreTextTeamA = this.add.text(16, 16, 'Team A: 0', {fontSize: '32px', fill: '#ffffff'});
    scoreTextTeamB = this.add.text(600, 16, 'Team B: 0', {fontSize: '32px', fill: '#ffffff'});
    scoreTextTeamPeace = this.add.text(300, 16, 'Team Peace: 0', {fontSize: '32px', fill: '#ffffff', bg: '#000000'});
    // Create bomber teams
    const randomStreetY = [7*32, 15*32, 23*32];
    const randomStreetX = [32, 17*32, 25*32, 33*32];

    for (let i = 0; i < totalBombers; i++) {
        const randomIndexY = Phaser.Math.Between(0,2);
        const randomIndexX = Phaser.Math.Between(0,3);
        const bomberA = this.physics.add.sprite(randomStreetX[randomIndexX], randomStreetY[randomIndexY], 'bomber');
        bomberA.team = 'A'; // Assign team
        bomberA.converted = false;
        bombersTeamA.push(bomberA);

        const bomberB = this.physics.add.sprite(randomStreetX[randomIndexX], randomStreetY[randomIndexY], 'bomber');
        bomberB.team = 'B'; // Assign team
        bomberB.converted = false;
        bombersTeamB.push(bomberB);
    }

    this.physics.add.collider(bombersTeamA, houseTiles);
    this.physics.add.collider(bombersTeamB, houseTiles);

    this.physics.add.collider(player, houseTiles);

    this.physics.add.overlap(player, [...bombersTeamA, ...bombersTeamB], convertToPlayer, null, this);
    // Set player collision and camera controls
    this.physics.add.overlap(player, [...bombersTeamA, ...bombersTeamB], convertToPlayer, null, this);

    cursors = this.input.keyboard.createCursorKeys();

    // Make NPCs drop bombs
    this.time.addEvent({
        delay: 2000,
        callback: dropBombs,
        callbackScope: this,
        loop: true
    });

}

function update() {
    // Player movement
    player.setVelocity(0);
    if (cursors.left.isDown) {
        player.setVelocityX(-200);
    } else if (cursors.right.isDown) {
        player.setVelocityX(200);
    }
    if (cursors.up.isDown) {
        player.setVelocityY(-200);
    } else if (cursors.down.isDown) {
        player.setVelocityY(200);
    }

    redDot.setPosition(player.x, player.y);
    // NPC random movement
    moveBombermen(bombersTeamA);
    moveBombermen(bombersTeamB);

    const activeTeamA = numActiveBombers(bombersTeamA);
    const activeTeamB = numActiveBombers(bombersTeamB);

    scoreTextTeamA.setText('Team A: ' + activeTeamA);
    scoreTextTeamB.setText('Team B: ' + activeTeamB);
    scoreTextTeamPeace.setText('Team Peace: ' + scoreTeamPeace);

    if (activeTeamA === 0 || activeTeamB === 0) {
        gameOver(this);
    }
}

function dropBombs() {
    // Randomly drop bombs around NPCs
    bombersTeamA.forEach(bomber => {
        if (bomber.active) {
            const bomb = this.physics.add.sprite(bomber.x, bomber.y, 'bomb');
            this.physics.add.overlap(bomb, bombersTeamB, bombCollision, null, this);// player to list of targets
            this.tweens.add({
                targets: bomb,
                alpha: 0,
                duration: 2000,
                onComplete: () => bomb.destroy()
            });
        }
    });
    bombersTeamB.forEach(bomber => {
        if (bomber.active) {
            const bomb = this.physics.add.sprite(bomber.x, bomber.y, 'bomb');
            this.physics.add.overlap(bomb, bombersTeamA, bombCollision, null, this);
            this.tweens.add({
                targets: bomb,
                alpha: 0,
                duration: 2000,
                onComplete: () => bomb.destroy()
            });
        }
    });
}

function bombCollision(bomb, target) {
    const distance = Phaser.Math.Distance.Between(bomb.x, bomb.y, target.x, target.y);
    if (distance <= 48 && target.active) {  // Check if target is active!

        let bomberIndex;
        if (target.team === 'A') {
            bomberIndex = bombersTeamA.indexOf(target);
            if (bomberIndex > -1) {
                bombersTeamA.splice(bomberIndex, 1);
                scoreTeamB++;
                scoreTextTeamB.setText('Team B: ' + scoreTeamB);
            }
        } else if (target.team === 'B') {
            bomberIndex = bombersTeamB.indexOf(target);
            if (bomberIndex > -1) {
                bombersTeamB.splice(bomberIndex, 1);
                scoreTeamA++;
                scoreTextTeamA.setText('Team A: ' + scoreTeamA);
            }
        }
        const explosionPerimeter = this.add.circle(target.x, target.y, 32, 0xff0000);
        this.tweens.add({
            targets: explosionPerimeter,
            alpha: 0,
            duration: 2000,
            onComplete: () => explosionPerimeter.destroy()
        });

        target.destroy();
        bomb.destroy();
    }
}

function moveBombermen(bombers) {
    bombers.forEach(bomber => {
        if (bomber.active) {
            if (!bomber.stepCount || bomber.stepCount <= 0) {
                const randomDirection = Phaser.Math.Between(0, 3); // 0: up, 1: down, 2: left, 3: right
                switch (randomDirection) {
                    case 0:
                        bomber.setVelocity(0, -100);
                        break;
                    case 1:
                        bomber.setVelocity(0, 100);
                        break;
                    case 2:
                        bomber.setVelocity(-100, 0);
                        break;
                    case 3:
                        bomber.setVelocity(100, 0);
                        break;
                }
                bomber.stepCount = 32; // Set minimum steps to 32
            } else {
                bomber.stepCount -= 1; // Decrement step count
            }

            // Reset to avoid walking through walls
            bomber.setCollideWorldBounds(true);
        }
    });
}

function convertToPlayer(player, bomber) {
    if (bomber.converted) {
        return;
    }
    this.speechBubble = this.add.text(0, 0, '💬', { fontSize: '32px' }).setVisible(true); // Create but hide initially
    this.peaceEmoji = this.add.text(0, 0, '🕊️', { fontSize: '24px' }).setVisible(true);

    // Stop the bomber from bombing and convert it to a player-controlled character
    bomber.setTexture('player');
    bomber.setVelocity(0);
    bomber.team = 'peace';
    bomber.active = false;

    let bomberIndex;

    if (bomber.team === 'A') {  // Remove only from the correct team
        bomberIndex = bombersTeamA.indexOf(bomber);
        if (bomberIndex > -1) {
            bombersTeamA.splice(bomberIndex, 1);
        }
    } else if (bomber.team === 'B') {
        bomberIndex = bombersTeamB.indexOf(bomber);
        if (bomberIndex > -1) {
            bombersTeamB.splice(bomberIndex, 1);
        }
    }
    scoreTeamPeace++;
    peaceTeam.push(bomber);
    bomber.converted = true;

    // Speech bubble and emoji
    this.speechBubble.setPosition(bomber.x + bomber.width / 2 , bomber.y - bomber.height/2); // Position relative to bomber
    this.peaceEmoji.setPosition(bomber.x + bomber.width / 2, bomber.y - bomber.height/2);
    this.speechBubble.setDepth(3);
    this.peaceEmoji.setDepth(4);
    this.speechBubble.setVisible(true);
    this.peaceEmoji.setVisible(true);
    this.tweens.add({  // Fade out the bubble and emoji
        targets: [this.speechBubble, this.peaceEmoji],
        alpha: 0,
        duration: 1000, // Adjust duration as needed
        onComplete: () => {
            this.speechBubble.destroy();
            this.peaceEmoji.destroy();
        }
    });
}

function numActiveBombers(bombers) {
    let count = 0;

    for (let i = 0; i < bombers.length; i++) {
        if (bombers[i].active) {
            count++;
        }
    }

    return count;
}

function gameOver(scene) {
    scene.physics.pause();
    let winnerText;
    const restartButton = scene.add.text(scene.cameras.main.centerX, scene.cameras.main.centerY + 50, 'Restart', { fontSize: '32px', fill: '#0f0' })
        .setOrigin(0.5)  // Center the text
        .setDepth(4)
        .setInteractive()  // Make it interactive
        .on('pointerdown', () => { // Add click event
            scene.scene.restart(); // Restart the scene
        });
    const activeTeamA = numActiveBombers(bombersTeamA);
    const activeTeamB = numActiveBombers(bombersTeamB);
    if (scoreTeamPeace > activeTeamA &&
        scoreTeamPeace > activeTeamB) {
        winnerText = scene.add.text(200, 200, "Peace Wins!", {fontSize: '62px', fill: "#0f0"});
        scoreTeamPeace = 0;
        return;
    } else if (activeTeamA === 0 && activeTeamB === 0 ) {
        winnerText = scene.add.text(200, 200, "Draw", {fontSize: '62px', fill: "#0f0"});
    } else if (activeTeamA === 0) {
        winnerText = scene.add.text(200, 200, 'Team B Wins!', {fontSize: '62px', fill: '#0f0'});
    } else if (activeTeamB === 0){
        winnerText = scene.add.text(200, 200, 'Team A Wins!', {fontSize: '62px', fill: '#0f0'});
    }
    // Optional: Add a restart button/logic here.

}
