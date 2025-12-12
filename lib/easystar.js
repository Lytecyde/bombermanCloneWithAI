// easystar.js
// https://github.com/prettymuchbryce/easystarjs
// License MIT

// findPath(startX, startY, endX, endY, callback)
// setGrid(grid)
// setAcceptableTiles(tiles)
// setIterationsPerCalculation(iterations)
// calculate()
// 1 bug fixed with ai

var EasyStar = (function() {
var EasyStar = function() {
    var STRAIGHT_COST = 1.0;
    var DIAGONAL_COST = 1.4;
    var syncEnabled = false;
    var pointsToAvoid = {};
    var collisionGrid;
    var costMap = {};
    var pointsToCost = {};
    var directionalConditions = {};
    var iterationsPerCalculation = Number.MAX_VALUE;
    var instances = {};
    var instanceQueue = [];
    var iterations = 0;
    var acceptableTiles;
    var diagonalsEnabled = false;

    var getTileCost = function(x,y) {
        return pointsToCost[x + '_' + y] || costMap[collisionGrid[y][x]];
    }

    var addInstance = function(instance) {
        instances[instance.id] = instance;
        instanceQueue.push(instance);
    }

    var removeInstance = function(instanceId) {
        var instance = instances[instanceId];
        if (!instance) return;
        var index = instanceQueue.indexOf(instance);
        if (index !== -1) {
            instanceQueue.splice(index,1);
        }
        delete instances[instanceId];
    }

    var calculate = function() {
        if (instanceQueue.length === 0 || collisionGrid === undefined) {
            return;
        }
        for (iterations = 0; iterations < iterationsPerCalculation; iterations++) {
            if (instanceQueue.length === 0) {
                return;
            }

            if (syncEnabled) {
                // If sync is enabled, calculations will be executed synchronously
                var instance = instanceQueue[0];
                var result = instance.compute();
                if (result === true) {
                    removeInstance(instance.id);
                }
            } else {
                // If sync is disabled, calculations will be executed asynchronously
                var instance = instanceQueue.shift();
                var result = instance.compute();
                if (result !== true) {
                    instanceQueue.push(instance);
                }
            }
        }
    }

    var Instance = function(startX, startY, endX, endY) {
        this.pointsToAvoid = pointsToAvoid;
        this.startX = startX;
        this.startY = startY;
        this.endX = endX;
        this.endY = endY;
        this.id = 'instance_' + Math.random().toString(36).substr(2, 9);
        this.openList = new Heap(function(nodeA, nodeB) {
            return nodeA.bestGuessDistance() - nodeB.bestGuessDistance();
        });
        this.isDoneCalculating = false;
        this.nodeHash = {};
        this.startNode = new Node(startX, startY, null, 0);
        this.startNode.bestGuessDistance = function() {
            return this.getDistance(endX, endY);
        }
        this.openList.push(this.startNode);
        this.nodeHash[this.startNode.id] = this.startNode;
    }

    Instance.prototype.compute = function() {
        var endX = this.endX;
        var endY = this.endY;
        while(this.openList.size() > 0) {
            var currentNode = this.openList.pop();
            if (currentNode.x === endX && currentNode.y === endY) {
                var path = [];
                var curr = currentNode;
                while(curr.parent) {
                    path.push({x:curr.x, y:curr.y});
                    curr = curr.parent;
                }
                path.reverse();
                this.callback(path);
                this.isDoneCalculating = true;
                return true;
            } else {
                var neighbors = this.getNeighbors(currentNode.x, currentNode.y);
                for (var i = 0; i < neighbors.length; i++) {
                    var neighbor = neighbors[i];
                    var cost = currentNode.cost + getTileCost(neighbor.x, neighbor.y);
                    var neighborNode = this.nodeHash[neighbor.id];
                    if (neighborNode) {
                        if (cost < neighborNode.cost) {
                            neighborNode.cost = cost;
                            neighborNode.parent = currentNode;
                            this.openList.updateItem(neighborNode);
                        }
                    } else {
                        var newNode = new Node(neighbor.x, neighbor.y, currentNode, cost);
                        newNode.bestGuessDistance = function() {
                            return this.getDistance(endX, endY);
                        }
                        this.nodeHash[newNode.id] = newNode;
                        this.openList.push(newNode);
                    }
                }
            }
        }
        this.callback(null);
        return true;
    }

    Instance.prototype.getNeighbors = function(x, y) {
        var neighbors = [];
        //
        // ↑
        //
        if (this.isWalkable(x, y - 1)) {
            neighbors.push({x:x, y:y-1, id: (x) + '_' + (y-1)});
        }
        //
        // ↓
        //
        if (this.isWalkable(x, y + 1)) {
            neighbors.push({x:x, y:y+1, id: (x) + '_' + (y+1)});
        }
        //
        // ←
        //
        if (this.isWalkable(x - 1, y)) {
            neighbors.push({x:x-1, y:y, id: (x-1) + '_' + (y)});
        }
        //
        // →
        //
        if (this.isWalkable(x + 1, y)) {
            neighbors.push({x:x+1, y:y, id: (x+1) + '_' + (y)});
        }

        if (diagonalsEnabled) {
            //
            // ↖
            //
            if (this.isWalkable(x - 1, y - 1)) {
                neighbors.push({x:x-1, y:y-1, id: (x-1) + '_' + (y-1)});
            }
            //
            // ↗
            //
            if (this.isWalkable(x + 1, y - 1)) {
                neighbors.push({x:x+1, y:y-1, id: (x+1) + '_' + (y-1)});
            }
            //
            // ↙
            //
            if (this.isWalkable(x - 1, y + 1)) {
                neighbors.push({x:x-1, y:y+1, id: (x-1) + '_' + (y+1)});
            }
            //
            // ↘
            //
            if (this.isWalkable(x + 1, y + 1)) {
                neighbors.push({x:x+1, y:y+1, id: (x+1) + '_' + (y+1)});
            }
        }

        return neighbors;
    }

    Instance.prototype.isWalkable = function(x, y) {
        if (this.pointsToAvoid[x + '_' + y]) {
            return false;
        }
        if (pointsToAvoid[x + '_' + y]) {
            return false;
        }
        if (y < 0 || y >= collisionGrid.length || x < 0 || x >= collisionGrid[0].length) {
            return false;
        }
        if (acceptableTiles) {
            var tile = collisionGrid[y][x];
            var acceptable = false;
            for (var i = 0; i < acceptableTiles.length; i++) {
                if (tile === acceptableTiles[i]) {
                    acceptable = true;
                    break;
                }
            }
            if (!acceptable) {
                return false;
            }
        }
        return true;
    }

    var Node = function(x, y, parent, cost) {
        this.x = x;
        this.y = y;
        this.parent = parent;
        this.cost = cost;
        this.id = x + '_' + y;
    }

    Node.prototype.getDistance = function(x, y) {
        var dx = Math.abs(x - this.x);
        var dy = Math.abs(y - this.y);
        if (diagonalsEnabled) {
            return Math.sqrt(dx*dx + dy*dy);
        } else {
            return dx + dy;
        }
    }

    var Heap = (function() {
        function Heap(comparator) {
            this.content = [];
            this.comparator = comparator;
        }

        Heap.prototype.push = function(element) {
            this.content.push(element);
            this.bubbleUp(this.content.length - 1);
        }

        Heap.prototype.pop = function() {
            var result = this.content[0];
            var end = this.content.pop();
            if (this.content.length > 0) {
                this.content[0] = end;
                this.sinkDown(0);
            }
            return result;
        }

        Heap.prototype.size = function() {
            return this.content.length;
        }

        Heap.prototype.updateItem = function(item) {
            var pos = this.content.indexOf(item);
            if (pos === -1) return;
            this.bubbleUp(pos);
        }

        Heap.prototype.bubbleUp = function(n) {
            var element = this.content[n];
            while (n > 0) {
                var parentN = Math.floor((n + 1) / 2) - 1,
                parent = this.content[parentN];
                if (this.comparator(element, parent) >= 0) break;
                this.content[parentN] = element;
                this.content[n] = parent;
                n = parentN;
            }
        }

        Heap.prototype.sinkDown = function(n) {
            var length = this.content.length,
            element = this.content[n],
            elemScore = this.comparator(element, element);

            while(true) {
                var child2N = (n + 1) * 2, child1N = child2N - 1;
                var swap = null;
                if (child1N < length) {
                    var child1 = this.content[child1N],
                    child1Score = this.comparator(child1, element);
                    if (child1Score < 0)
                        swap = child1N;
                }
                if (child2N < length) {
                    var child2 = this.content[child2N],
                    child2Score = this.comparator(child2, element);
                    if (child2Score < (swap === null ? elemScore : child1Score))
                        swap = child2N;
                }

                if (swap === null) break;

                this.content[n] = this.content[swap];
                this.content[swap] = element;
                n = swap;
            }
        }
        return Heap;
    })();

    return {
        findPath: function(startX, startY, endX, endY, callback) {
            var instance = new Instance(startX, startY, endX, endY);
            instance.callback = callback;
            addInstance(instance);
        },
        setGrid: function(grid) {
            collisionGrid = grid;
            costMap = {};
            pointsToCost = {};
            for (var y = 0; y < collisionGrid.length; y++) {
                for (var x = 0; x < collisionGrid[0].length; x++) {
                    if (!costMap[collisionGrid[y][x]]) {
                        costMap[collisionGrid[y][x]] = 1;
                    }
                }
            }
        },
        setAcceptableTiles: function(tiles) {
            acceptableTiles = tiles;
        },
        enableDiagonals: function() {
            diagonalsEnabled = true;
        },
        disableDiagonals: function() {
            diagonalsEnabled = false;
        },
        setTileCost: function(tileType, cost) {
            costMap[tileType] = cost;
        },
        setAdditionalPointCost: function(x, y, cost) {
            pointsToCost[x + '_' + y] = cost;
        },
        removeAdditionalPointCost: function(x, y) {
            delete pointsToCost[x + '_' + y];
        },
        removeAllAdditionalPointCosts: function() {
            pointsToCost = {};
        },
        setIterationsPerCalculation: function(iterations) {
            iterationsPerCalculation = iterations;
        },
        avoidAdditionalPoint: function(x, y) {
            pointsToAvoid[x + '_' + y] = 1;
        },
        stopAvoidingAdditionalPoint: function(x, y) {
            delete pointsToAvoid[x + '_' + y];
        },
        stopAvoidingAllAdditionalPoints: function() {
            pointsToAvoid = {};
        },
        calculate: calculate,
        enableSync: function() {
            syncEnabled = true;
        },
        disableSync: function() {
            syncEnabled = false;
        }
    }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = EasyStar;
} else if (typeof define === 'function' && define.amd) {
    define(EasyStar);
} else {
    window.EasyStar = EasyStar;
}

})();