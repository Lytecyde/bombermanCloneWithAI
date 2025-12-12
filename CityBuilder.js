// City Builder: 128 Blue Houses with Sidewalks and Car Lanes
export default class City {
    // noinspection DuplicatedCode
    static houseMap = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 1, 2, 2, 2, 2, 1, 0],
        [0, 1, 2, 2, 2, 2, 1, 0],
        [0, 1, 2, 2, 2, 2, 1, 0],
        [0, 1, 2, 3, 3, 2, 1, 0],
        [0, 1, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ];

    static tileColors = ['black', 'gray', 'blue', 'brown'];

    constructor() {
        this.grid = [];
        this.houses = [];
        this.gridSizeI = 8; // Adjust size to fit the houses
        this.gridSizeJ = 16;
        this.tilesPerHouse = 8;
        this.initGrid();
        this.buildCity();
    }

    // Create an empty city grid initialized with null
    initGrid() {
        this.grid = Array(this.gridSizeI * this.tilesPerHouse).fill(null).map(() =>
            Array(this.gridSizeJ * this.tilesPerHouse).fill(null)
        );
    }

    // Add a house to the grid
    addHouse(startX, startY) {
        for (let i = 0; i < City.houseMap.length; i++) {
            for (let j = 0; j < City.houseMap[i].length; j++) {
                const tileType = City.houseMap[i][j];
                this.grid[startX + i][startY + j] = City.tileColors[tileType];
            }
        }
    }

    // Build the city with houses surrounded by sidewalks and 2-block car lanes
    buildCity() {
        const houseSize = 4;
        const sidewalkSize = 2;
        const laneSize = 2;
        const spaceForHouses = houseSize + sidewalkSize + laneSize;

        for (let row = 0; row < this.gridSizeI; row += 1) {
            for (let col = 0; col < this.gridSizeJ; col += 1) {
                const houseX = col * spaceForHouses;
                const houseY = row * spaceForHouses;
                this.addHouse(houseY, houseX);
                this.houses.push({
                    x: houseX,
                    y: houseY,
                    allegiance: Math.random() < 0.5 ? 'black' : 'white',
                    isDestroyed: false
                });
            }
        }
    }
}
