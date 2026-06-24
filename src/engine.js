import { classicLevels, TILE_MAP } from './levels.js';

const REGEN_TIME = 6.0;

export class GameEngine {
  constructor(levelIndex, soundEngine) {
    this.levelIndex = levelIndex;
    this.sound = soundEngine;
    this.grid = []; // 16 rows of 28 cols
    this.cols = 28;
    this.rows = 16;
    
    this.player = { x: 0, y: 0, dx: 0, dy: 0, isFalling: false, spawnX: 0, spawnY: 0 };
    this.guards = [];
    this.gold = []; // Array of { x, y, collected }
    this.dugBricks = []; // Array of { x, y, timer }
    this.exitUnlocked = false;
    
    this.score = 0;
    this.lives = 5;
    this.currentLevelString = null;

    if (typeof levelIndex === 'number' && levelIndex >= 0 && levelIndex < classicLevels.length) {
      this.loadLevel(classicLevels[levelIndex]);
    }
  }

  loadLevel(levelString) {
    if (!levelString || levelString.length < this.cols * this.rows) {
      console.error("Invalid level string");
      return;
    }

    this.currentLevelString = levelString;
    this.waitingForInput = true;

    this.grid = [];
    this.guards = [];
    this.gold = [];
    this.dugBricks = [];
    this.exitUnlocked = false;
    this.player.dx = 0;
    this.player.dy = 0;
    this.player.isFalling = false;

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        const char = levelString[r * this.cols + c];
        if (char === '&') {
          this.player.x = c;
          this.player.y = r;
          this.player.spawnX = c;
          this.player.spawnY = r;
          row.push(' ');
        } else if (char === '0') {
          this.guards.push({
            x: c,
            y: r,
            targetX: c,
            targetY: r,
            isTrapped: false,
            trapTimer: 0,
            spawnX: c,
            spawnY: r,
            carriedGold: null,
            pathfindCooldown: 0,
            isSpawning: true,
            spawnTimer: 1.0
          });
          row.push(' ');
        } else if (char === '$') {
          this.gold.push({ x: c, y: r, collected: false, carriedByGuard: false });
          row.push(' ');
        } else {
          row.push(char);
        }
      }
      this.grid.push(row);
    }
  }

  isDug(x, y) {
    const rx = Math.floor(x);
    const ry = Math.floor(y);
    return this.dugBricks.some(b => b.x === rx && b.y === ry);
  }

  isSolid(x, y) {
    const rx = Math.floor(x);
    const ry = Math.floor(y);
    if (ry < 0 || ry >= this.rows || rx < 0 || rx >= this.cols) {
      return true;
    }
    if (!this.grid || !this.grid[ry]) {
      return true;
    }
    
    // Check if the brick is currently dug
    if (this.isDug(rx, ry)) {
      return false;
    }

    const tile = this.grid[ry][rx];
    return tile === '#' || tile === '@';
  }

  isLadder(x, y) {
    const rx = Math.floor(x);
    const ry = Math.floor(y);
    if (ry < 0 || ry >= this.rows || rx < 0 || rx >= this.cols) {
      return false;
    }
    if (!this.grid || !this.grid[ry]) {
      return false;
    }
    return this.grid[ry][rx] === 'H' || (this.exitUnlocked && this.grid[ry][rx] === 'S');
  }

  isRope(x, y) {
    const rx = Math.floor(x);
    const ry = Math.floor(y);
    if (ry < 0 || ry >= this.rows || rx < 0 || rx >= this.cols) {
      return false;
    }
    if (!this.grid || !this.grid[ry]) {
      return false;
    }
    return this.grid[ry][rx] === '-';
  }

  // Dig a brick at the specified grid position (tx, ty)
  dig(tx, ty) {
    // Check bounds
    if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) return false;

    // Can only dig standard brick tiles '#'
    if (this.grid[ty][tx] !== '#') return false;

    // Space directly above the brick must be empty/passable (not solid, not brick, not ladder)
    const aboveY = ty - 1;
    if (aboveY >= 0) {
      const tileAbove = this.grid[aboveY][tx];
      const isAboveDug = this.isDug(tx, aboveY);
      if (!isAboveDug && (tileAbove === '#' || tileAbove === '@' || tileAbove === 'H' || tileAbove === 'S')) {
        return false;
      }
    }

    // Must not be already dug
    if (this.dugBricks.some(b => b.x === tx && b.y === ty)) return false;

    // Add to dug bricks list with a REGEN_TIME second timer
    this.dugBricks.push({ x: tx, y: ty, timer: REGEN_TIME });

    if (this.sound && typeof this.sound.playDig === 'function') {
      this.sound.playDig();
    }

    return true;
  }

  // Dig to the player's left
  digLeft() {
    if (this.player.isFalling) return false;
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    const success = this.dig(px - 1, py + 1);
    this.player.diggingDir = 'left';
    this.player.diggingTimer = 0.3; // 0.3 seconds animation
    this.player.facingDir = 'left';
    return success;
  }

  // Dig to the player's right
  digRight() {
    if (this.player.isFalling) return false;
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    const success = this.dig(px + 1, py + 1);
    this.player.diggingDir = 'right';
    this.player.diggingTimer = 0.3; // 0.3 seconds animation
    this.player.facingDir = 'right';
    return success;
  }

  // Check if player stands on/overlaps a gold chest and collect it
  collectGold(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    for (const g of this.gold) {
      if (!g.collected && g.x === rx && g.y === ry) {
        g.collected = true;
        this.score += 250;

        if (this.sound && typeof this.sound.playCollect === 'function') {
          this.sound.playCollect();
        }

        // Check if all gold collected
        if (this.gold.every(item => item.collected && !item.carriedByGuard)) {
          this.exitUnlocked = true;
          if (this.sound && typeof this.sound.playExit === 'function') {
            this.sound.playExit();
          }
        }
        return true;
      }
    }
    return false;
  }

  // Update loop for time-dependent state like dug bricks
  update(dt) {
    // Update dug bricks timers
    for (let i = this.dugBricks.length - 1; i >= 0; i--) {
      const brick = this.dugBricks[i];
      brick.timer -= dt;
      if (brick.timer <= 0) {
        // Remove dug brick (fills back in)
        this.dugBricks.splice(i, 1);
        
        // Handle trapping/death if entities are inside the filled tile
        if (this.checkEntityTrappedInBrick(brick.x, brick.y)) {
          return;
        }
      }
    }

    this.updateGuards(dt);
  }

  // Check if player or guards are trapped in a refilled brick
  checkEntityTrappedInBrick(x, y) {
    if (Math.round(this.player.x) === x && Math.round(this.player.y) === y) {
      this.handlePlayerDeath();
      return true;
    }
    for (const guard of this.guards) {
      if (Math.round(guard.x) === x && Math.round(guard.y) === y) {
        this.handleGuardTrapped(guard);
      }
    }
    return false;
  }

  // Handle player dying and losing a life
  handlePlayerDeath() {
    this.lives--;
    if (this.sound && typeof this.sound.playDeath === 'function') {
      this.sound.playDeath();
    }
    // Reload the level to reset all guards, gold, and blocks
    if (this.currentLevelString) {
      this.loadLevel(this.currentLevelString);
    } else if (typeof this.levelIndex === 'number' && this.levelIndex >= 0 && this.levelIndex < classicLevels.length) {
      this.loadLevel(classicLevels[this.levelIndex]);
    } else {
      // Fallback
      this.player.x = this.player.spawnX;
      this.player.y = this.player.spawnY;
      this.player.dx = 0;
      this.player.dy = 0;
      this.player.isFalling = false;
    }
  }

  // Handle a guard getting trapped in a refilled brick
  handleGuardTrapped(guard) {
    if (guard.carriedGold) {
      const g = guard.carriedGold;
      g.collected = false;
      g.carriedByGuard = false;
      g.x = Math.round(guard.x);
      g.y = Math.round(guard.y) - 1;
      guard.carriedGold = null;
      this.exitUnlocked = false;
    }
    // Respawn guard at their initial spawn point
    guard.x = guard.spawnX;
    guard.y = guard.spawnY;
    guard.targetX = guard.spawnX;
    guard.targetY = guard.spawnY;
    guard.isTrapped = false;
    guard.trapTimer = 0;
    guard.pathfindCooldown = 0;
    guard.isSpawning = true;
    guard.spawnTimer = 1.0;
  }

  updateGuards(dt) {
    const guardSpeed = 1.9; // tiles per second (reduced by 5%)
    const fallSpeed = 8.0;  // tiles per second

    for (const guard of this.guards) {
      // 0. Update spawn timer
      if (guard.isSpawning) {
        guard.spawnTimer -= dt;
        if (guard.spawnTimer <= 0) {
          guard.isSpawning = false;
        }
        continue; // Lock movement and skip collision checks while spawning
      }

      if (guard.pathfindCooldown > 0) {
        guard.pathfindCooldown -= dt;
      }

      // 0.5. Collision with player check (only if not trapped)
      if (!guard.isTrapped) {
        if (Math.abs(this.player.x - guard.x) < 0.6 && Math.abs(this.player.y - guard.y) < 0.6) {
          this.handlePlayerDeath();
          return;
        }
      }

      // 1. Trap logic (Struggling to escape)
      if (guard.isTrapped) {
        guard.trapTimer -= dt;
        if (guard.trapTimer <= 0) {
          guard.isTrapped = false;
          
          // Escape logic: crawl out to left/right platform if not solid
          const currentGridX = Math.round(guard.x);
          const currentGridY = Math.round(guard.y);
          let escapeX = currentGridX;
          const escapeY = currentGridY - 1;

          // Prefer climbing towards player
          const goLeft = this.player.x < guard.x;
          const firstDir = goLeft ? -1 : 1;
          const secondDir = goLeft ? 1 : -1;

          if (currentGridX + firstDir >= 0 && currentGridX + firstDir < this.cols && !this.isSolid(currentGridX + firstDir, escapeY)) {
            escapeX = currentGridX + firstDir;
          } else if (currentGridX + secondDir >= 0 && currentGridX + secondDir < this.cols && !this.isSolid(currentGridX + secondDir, escapeY)) {
            escapeX = currentGridX + secondDir;
          }

          guard.x = escapeX;
          guard.y = escapeY;
          guard.targetX = escapeX;
          guard.targetY = escapeY;
        }
        continue;
      }

      // 2. Falling check
      const onLadder = this.isLadder(guard.x, guard.y);
      const onRope = this.isRope(guard.x, guard.y);

      const rowBelow = Math.floor(guard.y + 1.0);
      const colLeft = Math.floor(guard.x + 0.1);
      const colRight = Math.floor(guard.x + 0.9);
      let supportBelow = (this.isSolid(colLeft, rowBelow) || this.isLadder(colLeft, rowBelow)) ||
                         (this.isSolid(colRight, rowBelow) || this.isLadder(colRight, rowBelow));

      // Support from other trapped guards underneath this guard (walking on their heads)
      if (!supportBelow) {
        for (const other of this.guards) {
          if (other !== guard && other.isTrapped && Math.round(other.y) === rowBelow) {
            if (Math.abs(guard.x - other.x) < 0.8) {
              supportBelow = true;
              break;
            }
          }
        }
      }

      const isFalling = !onLadder && !onRope && !supportBelow;

      if (isFalling) {
        const fallDist = fallSpeed * dt;
        const targetY = guard.y + fallDist;
        const col = Math.round(guard.x);
        const r = Math.floor(targetY + 1.0);
        
        // Land on solid floor OR on a trapped guard's head
        const hasTrappedGuardBelow = this.guards.some(g => g !== guard && g.isTrapped && Math.round(g.x) === col && Math.round(g.y) === r);

        if (this.isSolid(col, r) || hasTrappedGuardBelow) {
          guard.y = r - 1;
          guard.targetY = guard.y;
          guard.targetX = col; // snap X to column
        } else {
          guard.y = targetY;
          if (this.isLadder(col, guard.y) || this.isRope(col, guard.y)) {
            guard.y = Math.round(guard.y);
            guard.targetY = guard.y;
            guard.targetX = col;
          }
        }
        this.checkGuardTrapped(guard);
        continue;
      }

      // 3. Gold collection check
      if (!guard.carriedGold) {
        const rx = Math.round(guard.x);
        const ry = Math.round(guard.y);
        for (const g of this.gold) {
          if (!g.collected && g.x === rx && g.y === ry) {
            g.collected = true;
            g.carriedByGuard = true;
            guard.carriedGold = g;
            break;
          }
        }
      }

      // 4. Movement AI (Player Chase)
      if (guard.x === guard.targetX && guard.y === guard.targetY) {
        if (!(guard.pathfindCooldown > 0)) {
          const path = this.findPath(guard.x, guard.y, this.player.x, this.player.y);
          if (path && path.length > 1) {
            guard.targetX = path[1].x;
            guard.targetY = path[1].y;
          } else {
            guard.targetX = guard.x;
            guard.targetY = guard.y;
            guard.pathfindCooldown = 1.0;
          }
        }
      }

      // Interpolate towards target
      const step = guardSpeed * dt;
      if (guard.x !== guard.targetX) {
        if (guard.x < guard.targetX) {
          guard.x = Math.min(guard.targetX, guard.x + step);
        } else {
          guard.x = Math.max(guard.targetX, guard.x - step);
        }
      } else if (guard.y !== guard.targetY) {
        if (guard.y < guard.targetY) {
          guard.y = Math.min(guard.targetY, guard.y + step);
        } else {
          guard.y = Math.max(guard.targetY, guard.y - step);
        }
      }

      // 5. Post-movement trapping check
      this.checkGuardTrapped(guard);
    }
  }

  findPath(sx, sy, tx, ty) {
    const startX = Math.round(sx);
    const startY = Math.round(sy);
    const targetX = Math.round(tx);
    const targetY = Math.round(ty);

    if (startX === targetX && startY === targetY) {
      return [{ x: startX, y: startY }];
    }

    const queue = [[{ x: startX, y: startY }]];
    const visited = new Set();
    visited.add(`${startX},${startY}`);

    let bestPath = [{ x: startX, y: startY }];
    let minDistance = Math.abs(startX - targetX) + Math.abs(startY - targetY);

    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];

      // Track the path that gets closest to the target
      const dist = Math.abs(curr.x - targetX) + Math.abs(curr.y - targetY);
      if (dist < minDistance) {
        minDistance = dist;
        bestPath = path;
      }

      if (curr.x === targetX && curr.y === targetY) {
        return path;
      }

      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 }
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.cols && n.y >= 0 && n.y < this.rows) {
          if (!visited.has(`${n.x},${n.y}`) && this.isValidMove(curr.x, curr.y, n.x, n.y)) {
            visited.add(`${n.x},${n.y}`);
            queue.push([...path, n]);
          }
        }
      }
    }
    
    // Fallback: return path to the closest reachable tile
    return bestPath.length > 1 ? bestPath : null;
  }

  isValidMove(fromX, fromY, toX, toY) {
    if (toX < 0 || toX >= this.cols || toY < 0 || toY >= this.rows) return false;
    if (this.isSolid(toX, toY)) return false;

    // A cell occupied by a trapped guard is impassable
    const isTargetOccupiedByTrappedGuard = this.guards.some(g => g.isTrapped && Math.round(g.x) === toX && Math.round(g.y) === toY);
    if (isTargetOccupiedByTrappedGuard) return false;

    const dx = toX - fromX;
    const dy = toY - fromY;

    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

    const onLadder = this.isLadder(fromX, fromY);
    const onRope = this.isRope(fromX, fromY);
    
    // Check if there is a trapped guard below fromX, fromY
    const hasTrappedGuardBelow = this.guards.some(g => g.isTrapped && Math.round(g.x) === fromX && Math.round(g.y) === fromY + 1);
    const supportBelow = this.isSolid(fromX, fromY + 1) || this.isLadder(fromX, fromY + 1) || hasTrappedGuardBelow;

    const isFalling = !onLadder && !onRope && !supportBelow;

    if (isFalling) {
      return dx === 0 && dy === 1;
    }

    if (dx !== 0) {
      return onLadder || onRope || supportBelow;
    }

    if (dy < 0) {
      return onLadder;
    }

    if (dy > 0) {
      return onLadder || this.isLadder(toX, toY) || onRope;
    }

    return false;
  }

  checkGuardTrapped(guard) {
    const currentGridX = Math.round(guard.x);
    const currentGridY = Math.round(guard.y);
    const isDug = this.isDug(currentGridX, currentGridY);
    
    // Check if another guard is already trapped in this exact cell
    const cellOccupied = this.guards.some(other => other !== guard && other.isTrapped && 
                                           Math.round(other.x) === currentGridX && 
                                           Math.round(other.y) === currentGridY);

    if (isDug && !guard.isTrapped && !cellOccupied) {
      guard.isTrapped = true;
      guard.trapTimer = 4.0;
      guard.x = currentGridX;
      guard.y = currentGridY;
      guard.targetX = currentGridX;
      guard.targetY = currentGridY;

      if (guard.carriedGold) {
        const g = guard.carriedGold;
        guard.carriedGold = null;

        let dropX = currentGridX;
        let dropY = currentGridY - 1;
        if (dropY < 0 || this.isSolid(dropX, dropY)) {
          dropY = currentGridY;
        }

        g.x = dropX;
        g.y = dropY;
        g.collected = false;
        g.carriedByGuard = false;
        this.exitUnlocked = false;
      }

      if (this.sound && typeof this.sound.playTrap === 'function') {
        this.sound.playTrap();
      }
    }
  }
}
