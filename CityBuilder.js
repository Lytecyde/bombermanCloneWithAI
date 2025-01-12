// City Builder: 12 Blue Houses with Sidewalks and Car Lanes
export default class City {
    constructor() {
        this.grid = [];
        this.gridSizeI = 3; // Adjust size to fit the houses
        this.gridSizeJ = 4;
        this.tilesPerHouse = 8;
        this.initGrid();
        this.buildCity();
    }

    // Create an empty city grid initialized with null
    initGrid() {
        this.grid = Array(this.gridSizeI * this.tilesPerHouse).fill(null).map(() =>
            Array(this.gridSizeJ * this.tilesPerHouse).fill(null)
        );
        for (let i = 0; i < this.grid.length; i++) {
            for (let j = 0; j < this.grid[i].length; j++) this.grid[i][j] = null;
        }
    }

    // Add a house to the grid
    addHouse(startX, startY) {
        const houseMap = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 2, 2, 2, 2, 1, 0],
            [0, 1, 2, 2, 2, 2, 1, 0],
            [0, 1, 2, 2, 2, 2, 1, 0],
            [0, 1, 2, 3, 3, 2, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ];
        for (let i = 0; i < houseMap.length; i++) {
            for (let j = 0; j < houseMap[i].length; j++) {
                const tileType = houseMap[i][j];
                //Add tile based on tileType
                if (tileType === 0) {
                    this.grid[startX + i][startY + j] = 'black';
                } else if (tileType === 1) {
                    this.grid[startX + i][startY + j] = 'gray';
                } else if (tileType === 2) {
                    this.grid[startX + i][startY + j] = 'blue';
                } else if (tileType === 3) {
                    this.grid[startX + i][startY + j] = 'brown';
                }
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
                this.addHouse(row * spaceForHouses, col * spaceForHouses);
            }
        }
    }

}
