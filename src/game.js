import { classicLevels } from './levels.js';
import { GameEngine } from './engine.js';
import { SoundEffects } from './audio.js';

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error("Canvas element not found.");
    return;
  }
  const ctx = canvas.getContext('2d');
  const sound = new SoundEffects();
  const engine = new GameEngine(0, sound);

  // Handle canvas sizing
  function resizeCanvas() {
    canvas.width = 28 * 32; // 28 tiles * 32px = 896
    canvas.height = 16 * 32; // 16 tiles * 32px = 512
  }
  resizeCanvas();

  // Keyboard controls state
  const keys = {};
  let gameStarted = false;
  let isPaused = true; // Paused initially on splash screen

  // Iris transition state
  let transitionState = 'none'; // 'none', 'iris-out', 'iris-in'
  let transitionProgress = 1.0;
  const transitionSpeed = 1.5; // full cycle in ~0.66s
  let pendingLevelIndex = null;

  // Particle System
  const particles = [];
  function createSparks(x, y, color) {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: x * 32 + 16,
        y: y * 32 + 16,
        vx: (Math.random() - 0.5) * 100, // pixels per sec
        vy: (Math.random() - 0.7) * 140, // push upwards
        life: 0.4 + Math.random() * 0.4, // duration in seconds
        maxLife: 0.8,
        color: color
      });
    }
  }

  function updateParticles(dtSec) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 260 * dtSec; // gravity
      p.life -= dtSec;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  const splashScreen = document.getElementById('splash-screen');
  const splashPrompt = document.getElementById('splash-prompt');
  const splashHelpBtn = document.getElementById('splash-help-btn');

  // Setup sound init on first interaction
  const initAudioOnInteraction = () => {
    sound.init();
    window.removeEventListener('keydown', initAudioOnInteraction);
    window.removeEventListener('touchstart', initAudioOnInteraction);
    window.removeEventListener('mousedown', initAudioOnInteraction);
  };
  window.addEventListener('keydown', initAudioOnInteraction);
  window.addEventListener('touchstart', initAudioOnInteraction);
  window.addEventListener('mousedown', initAudioOnInteraction);

  // Window key listeners
  window.addEventListener('keydown', (e) => {
    // Prevent scrolling/default actions for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    if (!gameStarted) {
      startGame();
      return;
    }

    // Ignore game controls during pause
    if (isPaused) {
      return;
    }

    keys[e.key] = true;

    const moveKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
    if (moveKeys.includes(e.key)) {
      engine.waitingForInput = false;
    }

    // Trigger dig on keydown to prevent continuous digging
    if (!engine.waitingForInput) {
      if (e.key === 'z' || e.key === 'Z') {
        const px = Math.round(engine.player.x);
        const py = Math.round(engine.player.y);
        if (engine.digLeft()) {
          createSparks(px - 1, py + 1, '#ff5500');
        }
      }
      if (e.key === 'x' || e.key === 'X') {
        const px = Math.round(engine.player.x);
        const py = Math.round(engine.player.y);
        if (engine.digRight()) {
          createSparks(px + 1, py + 1, '#ff5500');
        }
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  // Populate level-select
  const levelSelect = document.getElementById('level-select');
  if (levelSelect) {
    levelSelect.innerHTML = '';
    for (let i = 0; i < classicLevels.length; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = String(i + 1).padStart(3, '0');
      levelSelect.appendChild(opt);
    }
    levelSelect.value = 0;
    levelSelect.addEventListener('change', (e) => {
      const lvlIdx = parseInt(e.target.value);
      if (gameStarted) {
        triggerLevelTransition(lvlIdx);
      } else {
        engine.levelIndex = lvlIdx;
        engine.loadLevel(classicLevels[lvlIdx]);
        draw();
        if (splashScreen) {
          splashScreen.classList.remove('full-splash');
          splashScreen.classList.add('preview-splash');
        }
        if (splashPrompt) {
          splashPrompt.textContent = `LEVEL ${String(lvlIdx + 1).padStart(3, '0')} PREVIEW - PRESS ANY KEY TO PLAY`;
        }
      }
    });
  }

  // Virtual control bindings
  const bindTouchButton = (id, keyName) => {
    const btn = document.getElementById(id);
    if (btn) {
      // Mouse fallback
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!gameStarted) {
          startGame();
        } else if (!isPaused) {
          engine.waitingForInput = false;
          keys[keyName] = true;
        }
      });
      btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        keys[keyName] = false;
      });
      btn.addEventListener('mouseleave', (e) => {
        e.preventDefault();
        keys[keyName] = false;
      });

      // Touch events
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!gameStarted) {
          startGame();
        } else if (!isPaused) {
          engine.waitingForInput = false;
          keys[keyName] = true;
        }
      }, { passive: false });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[keyName] = false;
      }, { passive: false });
      btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys[keyName] = false;
      }, { passive: false });
    }
  };

  bindTouchButton('btn-up', 'ArrowUp');
  bindTouchButton('btn-down', 'ArrowDown');
  bindTouchButton('btn-left', 'ArrowLeft');
  bindTouchButton('btn-right', 'ArrowRight');

  const btnDigLeft = document.getElementById('btn-dig-left');
  if (btnDigLeft) {
    const triggerDigLeft = (e) => {
      e?.preventDefault();
      if (!gameStarted) {
        startGame();
      } else if (!isPaused && !engine.waitingForInput) {
        const px = Math.round(engine.player.x);
        const py = Math.round(engine.player.y);
        if (engine.digLeft()) {
          createSparks(px - 1, py + 1, '#ff5500');
        }
      }
    };
    btnDigLeft.addEventListener('mousedown', triggerDigLeft);
    btnDigLeft.addEventListener('touchstart', triggerDigLeft, { passive: false });
  }

  const btnDigRight = document.getElementById('btn-dig-right');
  if (btnDigRight) {
    const triggerDigRight = (e) => {
      e?.preventDefault();
      if (!gameStarted) {
        startGame();
      } else if (!isPaused && !engine.waitingForInput) {
        const px = Math.round(engine.player.x);
        const py = Math.round(engine.player.y);
        if (engine.digRight()) {
          createSparks(px + 1, py + 1, '#ff5500');
        }
      }
    };
    btnDigRight.addEventListener('mousedown', triggerDigRight);
    btnDigRight.addEventListener('touchstart', triggerDigRight, { passive: false });
  }

  const startGame = () => {
    if (gameStarted) return;
    gameStarted = true;
    isPaused = false;
    if (splashScreen) {
      splashScreen.classList.add('hidden');
    }
    sound.init(); // Play sound and unlock audio context
    if (pauseBtn) pauseBtn.textContent = 'PAUSE';
  };

  // Close splash on screen click
  if (splashScreen) {
    splashScreen.addEventListener('click', (e) => {
      if (e.target !== splashHelpBtn) {
        startGame();
      }
    });
  }

  if (splashHelpBtn) {
    splashHelpBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't trigger startGame
      const helpModal = document.getElementById('help-modal');
      if (helpModal) {
        helpModal.classList.remove('hidden');
      }
    });
  }

  // Game Pause handling
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (!gameStarted) return;
      isPaused = !isPaused;
      if (isPaused) {
        for (const k in keys) {
          keys[k] = false;
        }
      }
      pauseBtn.textContent = isPaused ? 'RESUME' : 'PAUSE';
    });
  }

  // Help Modal handling
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const helpCloseBtn = document.getElementById('help-close-btn');
  if (helpBtn && helpModal && helpCloseBtn) {
    helpBtn.addEventListener('click', () => {
      isPaused = true;
      for (const k in keys) {
        keys[k] = false;
      }
      if (pauseBtn) pauseBtn.textContent = 'RESUME';
      helpModal.classList.remove('hidden');
    });

    const closeHelp = () => {
      helpModal.classList.add('hidden');
      if (gameStarted) {
        isPaused = false;
        if (pauseBtn) pauseBtn.textContent = 'PAUSE';
      }
    };

    helpCloseBtn.addEventListener('click', closeHelp);
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        closeHelp();
      }
    });
  }

  // Sound toggle handling
  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      soundBtn.textContent = sound.enabled ? 'SOUND: ON' : 'SOUND: OFF';
    });
  }

  const PLAYER_SPEED = 4.0; // grid tiles per second
  const FALL_SPEED = 8.0;   // grid tiles per second

  function triggerLevelTransition(nextLvlIdx) {
    transitionState = 'iris-out';
    transitionProgress = 1.0;
    pendingLevelIndex = nextLvlIdx;
    isPaused = true; // lock physics updates
    for (const k in keys) {
      keys[k] = false;
    }
  }

  function completeLevel() {
    const nextLvlIdx = (engine.levelIndex + 1) % classicLevels.length;
    triggerLevelTransition(nextLvlIdx);
  }

  function updatePlayer(dtSec) {
    // 1. Check if player is falling
    const onLadder = engine.isLadder(engine.player.x, engine.player.y);
    const pressingDown = keys['ArrowDown'] || keys['s'] || keys['S'];
    const onRope = engine.isRope(engine.player.x, engine.player.y) && !pressingDown;

    // Check support below: player overlaps any solid or ladder tile below
    const rowBelow = Math.floor(engine.player.y + 1.0);
    const colLeft = Math.floor(engine.player.x + 0.1);
    const colRight = Math.floor(engine.player.x + 0.9);
    let supportBelow = (engine.isSolid(colLeft, rowBelow) || engine.isLadder(colLeft, rowBelow)) ||
                       (engine.isSolid(colRight, rowBelow) || engine.isLadder(colRight, rowBelow));

    // Support check from trapped guards below the player (walking on their heads)
    if (!supportBelow) {
      const playerGridX = engine.player.x;
      for (const guard of engine.guards) {
        if (guard.isTrapped && Math.round(guard.y) === rowBelow) {
          if (Math.abs(playerGridX - guard.x) < 0.8) {
            supportBelow = true;
            break;
          }
        }
      }
    }

    if (!onLadder && !onRope && !supportBelow) {
      engine.player.isFalling = true;
    } else {
      engine.player.isFalling = false;
    }

    if (engine.player.isFalling) {
      const fallDist = FALL_SPEED * dtSec;
      const targetY = engine.player.y + fallDist;
      const col = Math.round(engine.player.x);

      const r = Math.floor(targetY + 1.0);
      const hasTrappedGuardBelow = engine.guards.some(g => g.isTrapped && Math.round(g.x) === col && Math.round(g.y) === r);
      if (engine.isSolid(col, r) || hasTrappedGuardBelow) {
        engine.player.y = r - 1;
        engine.player.isFalling = false;
      } else {
        engine.player.y = targetY;
        const grabRope = engine.isRope(col, engine.player.y) && !pressingDown;
        if (engine.isLadder(col, engine.player.y) || grabRope) {
          engine.player.isFalling = false;
          engine.player.y = Math.round(engine.player.y);
        }
      }
      return;
    }

    // 2. Horizontal/Vertical Controls
    let dx = 0;
    let dy = 0;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      dx = -1;
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      dx = 1;
    }

    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
      dy = -1;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
      dy = 1;
    }

    const isVerticallyAligned = Math.abs(engine.player.y - Math.round(engine.player.y)) < 0.25;

    // Auto-align vertical position if pressing horizontal keys on a ladder
    const isLadder = engine.isLadder(engine.player.x, engine.player.y) || 
                     engine.isLadder(engine.player.x, engine.player.y + 0.9);
    if (dx !== 0 && dy === 0 && isLadder && !isVerticallyAligned) {
      const nearestY = Math.round(engine.player.y);
      dy = nearestY < engine.player.y ? -1 : 1;
    }

    // Prioritize climbing: check if vertical movement is valid first
    const isHorizontallyAligned = Math.abs(engine.player.x - Math.round(engine.player.x)) < 0.25;
    let verticalPriorityActive = false;

    if (dy !== 0 && isHorizontallyAligned) {
      const targetX = Math.round(engine.player.x);

      let canMoveVertically = false;
      if (dy < 0) {
        canMoveVertically = engine.isLadder(targetX, engine.player.y) || 
                            engine.isLadder(targetX, engine.player.y + 0.95);
      } else if (dy > 0) {
        // Can climb down if ladder exists directly at or below player position (rope is not vertical climbing support)
        canMoveVertically = engine.isLadder(targetX, engine.player.y) || 
                            engine.isLadder(targetX, engine.player.y + 1.0);
      }

      if (canMoveVertically) {
        verticalPriorityActive = true;
        
        // If player is also pressing horizontal keys and is aligned with a platform row center,
        // check if stepping off is valid (not blocked by a solid tile). If so, allow stepping off.
        if (dx !== 0 && isVerticallyAligned) {
          const targetY = Math.round(engine.player.y);
          const destCol = Math.round(engine.player.x) + dx;
          if (!engine.isSolid(destCol, targetY)) {
            verticalPriorityActive = false; // Step-off has priority
          } else {
            dx = 0; // Stepping off is blocked, continue climbing
          }
        } else {
          dx = 0; // Lock horizontal movement while climbing
        }
      }
    }

    // Execute horizontal movement
    if (dx !== 0 && isVerticallyAligned) {
      engine.player.y = Math.round(engine.player.y); // Snap to row center
      const moveDist = PLAYER_SPEED * dtSec;
      const nextX = engine.player.x + dx * moveDist;
      const targetY = engine.player.y;

      if (dx < 0) {
        const leftCol = Math.floor(nextX);
        if (engine.isSolid(leftCol, targetY)) {
          engine.player.x = leftCol + 1.0;
        } else {
          engine.player.x = nextX;
        }
      } else if (dx > 0) {
        const rightCol = Math.floor(nextX + 0.999);
        if (engine.isSolid(rightCol, targetY)) {
          engine.player.x = rightCol - 1.0;
        } else {
          engine.player.x = nextX;
        }
      }
      
      // Update facing direction and animation state
      engine.player.facingDir = dx < 0 ? 'left' : 'right';
      engine.player.animTime = (engine.player.animTime || 0) + dtSec;
      
      engine.collectGold(engine.player.x, engine.player.y);
    }

    // Execute vertical movement (only if prioritizing vertical movement)
    if (dy !== 0 && verticalPriorityActive) {
      const targetX = Math.round(engine.player.x);
      engine.player.x = targetX; // Snap to column center
      const moveDist = PLAYER_SPEED * dtSec;
      const nextY = engine.player.y + dy * moveDist;

      if (dy < 0) {
        // Climbing up
        let targetY = nextY;
        const currentLadderRow = Math.ceil(engine.player.y);
        const rowAbove = currentLadderRow - 1;
        const hasLadderAbove = engine.isLadder(targetX, rowAbove) || 
                               (currentLadderRow === 1 && engine.exitUnlocked && engine.isLadder(targetX, 0));
        
        if (!hasLadderAbove) {
          if (targetY < rowAbove) {
            targetY = rowAbove;
          }
        }

        let nextYSolid = engine.isSolid(targetX, targetY);
        if (targetY < 0 && engine.exitUnlocked && engine.isLadder(targetX, 0)) {
          nextYSolid = false;
        }

        if (!nextYSolid) {
          engine.player.y = targetY;
          engine.collectGold(engine.player.x, engine.player.y);
        }
      } else if (dy > 0) {
        // Climbing down
        let targetY = nextY;
        if (engine.isSolid(targetX, targetY + 1.0)) {
          targetY = Math.floor(targetY);
        }

        if (!engine.isSolid(targetX, targetY)) {
          engine.player.y = targetY;
          engine.collectGold(engine.player.x, engine.player.y);
        }
      }
      
      engine.player.animTime = (engine.player.animTime || 0) + dtSec;
    }
  }

  function update(dt) {
    const dtSec = dt / 1000;

    // Handle transition even if isPaused is true
    if (transitionState === 'iris-out') {
      transitionProgress -= transitionSpeed * dtSec;
      if (transitionProgress <= 0) {
        transitionProgress = 0;
        transitionState = 'iris-in';
        if (pendingLevelIndex !== null) {
          engine.levelIndex = pendingLevelIndex;
          engine.loadLevel(classicLevels[pendingLevelIndex]);
          if (levelSelect) {
            levelSelect.value = pendingLevelIndex;
          }
          pendingLevelIndex = null;
        }
      }
      return; // Skip standard physics updates
    } else if (transitionState === 'iris-in') {
      transitionProgress += transitionSpeed * dtSec;
      if (transitionProgress >= 1.0) {
        transitionProgress = 1.0;
        transitionState = 'none';
        isPaused = false; // resume play
      }
      return; // Skip standard physics updates
    }

    if (isPaused) return;

    if (engine.waitingForInput) {
      updateParticles(dtSec);
      return;
    }

    // Call engine update (updates regeneration timers, etc.)
    engine.update(dtSec);

    // Tick digging animation timer
    if (engine.player.diggingTimer > 0) {
      engine.player.diggingTimer -= dtSec;
      if (engine.player.diggingTimer <= 0) {
        engine.player.diggingDir = null;
      }
    }
    
    // Tick particles
    updateParticles(dtSec);

    // Update player controls/physics
    updatePlayer(dtSec);

    // Accumulate guard animation times when they are moving or trapped
    for (const guard of engine.guards) {
      if (guard.isTrapped) {
        guard.animTime = (guard.animTime || 0) + dtSec;
      } else if (Math.abs(guard.x - guard.targetX) > 0.01 || Math.abs(guard.y - guard.targetY) > 0.01) {
        guard.animTime = (guard.animTime || 0) + dtSec;
      } else {
        guard.animTime = 0; // Reset animation when stopped
      }
    }

    // Level progression check (climb off top of screen when exit unlocked)
    if (engine.exitUnlocked && engine.player.y <= -0.5) {
      completeLevel();
    }

    // Update HUD elements
    const scoreVal = document.getElementById('score-val');
    const livesVal = document.getElementById('lives-val');
    if (scoreVal) {
      scoreVal.textContent = String(engine.score).padStart(6, '0');
    }
    if (livesVal) {
      livesVal.textContent = String(engine.lives);
    }

    // Check game over
    if (engine.lives < 0) {
      engine.score = 0;
      engine.lives = 5;
      engine.loadLevel(classicLevels[engine.levelIndex]);
    }
  }

  function drawStickman(ctx, x, y, color, animTime, action, facingDir) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.shadowBlur = 6;
    ctx.shadowColor = color;

    const headRadius = 4.5;
    const hx = x + 16;
    const hy = y + 9;

    // 1. Draw Head
    ctx.beginPath();
    ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Body Line
    const neckY = hy + headRadius;
    const hipY = neckY + 10;
    ctx.beginPath();
    ctx.moveTo(hx, neckY);
    ctx.lineTo(hx, hipY);
    ctx.stroke();

    let leftArmOffset = { x: -8, y: 4 };
    let rightArmOffset = { x: 8, y: 4 };
    let leftLegOffset = { x: -6, y: 10 };
    let rightLegOffset = { x: 6, y: 10 };

    if (action === 'running') {
      const frame = Math.floor(animTime * 14) % 4;
      const angle = (facingDir === 'left') ? -1 : 1;
      
      if (frame === 0) {
        leftArmOffset = { x: -6 * angle, y: 1 };
        rightArmOffset = { x: 5 * angle, y: 6 };
        leftLegOffset = { x: -7 * angle, y: 10 };
        rightLegOffset = { x: 5 * angle, y: 8 };
      } else if (frame === 1) {
        leftArmOffset = { x: -2 * angle, y: 4 };
        rightArmOffset = { x: 2 * angle, y: 4 };
        leftLegOffset = { x: -3 * angle, y: 10 };
        rightLegOffset = { x: 3 * angle, y: 10 };
      } else if (frame === 2) {
        leftArmOffset = { x: 5 * angle, y: 6 };
        rightArmOffset = { x: -6 * angle, y: 1 };
        leftLegOffset = { x: 5 * angle, y: 8 };
        rightLegOffset = { x: -7 * angle, y: 10 };
      } else {
        leftArmOffset = { x: -2 * angle, y: 4 };
        rightArmOffset = { x: 2 * angle, y: 4 };
        leftLegOffset = { x: -3 * angle, y: 10 };
        rightLegOffset = { x: 3 * angle, y: 10 };
      }
    } else if (action === 'climbing') {
      const frame = Math.floor(animTime * 10) % 2;
      const swing = frame === 0 ? 1 : -1;
      leftArmOffset = { x: -8, y: -6 + swing * 3 };
      rightArmOffset = { x: 8, y: -6 - swing * 3 };
      leftLegOffset = { x: -5 - swing * 2, y: 10 };
      rightLegOffset = { x: 5 + swing * 2, y: 10 };
    } else if (action === 'trapped') {
      const frame = Math.floor(animTime * 16.8) % 2; // 1.2x frequency struggle (14 * 1.2 = 16.8)
      if (frame === 0) {
        leftArmOffset = { x: -6, y: -8 };
        rightArmOffset = { x: 6, y: -4 };
        leftLegOffset = { x: -4, y: 7 };
        rightLegOffset = { x: 4, y: 10 };
      } else {
        leftArmOffset = { x: -6, y: -4 };
        rightArmOffset = { x: 6, y: -8 };
        leftLegOffset = { x: -4, y: 10 };
        rightLegOffset = { x: 7, y: 7 };
      }
    } else if (action === 'climbing-out') {
      const frame = Math.floor(animTime * 12) % 2;
      const angle = (facingDir === 'left') ? -1 : 1;
      if (frame === 0) {
        leftArmOffset = { x: -7 * angle, y: -9 };
        rightArmOffset = { x: 7 * angle, y: -6 };
        leftLegOffset = { x: -4 * angle, y: 6 };
        rightLegOffset = { x: 4 * angle, y: 9 };
      } else {
        leftArmOffset = { x: -7 * angle, y: -6 };
        rightArmOffset = { x: 7 * angle, y: -9 };
        leftLegOffset = { x: -4 * angle, y: 9 };
        rightLegOffset = { x: 4 * angle, y: 6 };
      }
    } else if (action === 'rope') {
      const frame = Math.floor(animTime * 8) % 2;
      const angle = (facingDir === 'left') ? -1 : 1;
      leftArmOffset = { x: -6 * angle, y: -6 };
      rightArmOffset = { x: 6 * angle, y: -6 };
      if (frame === 0) {
        leftLegOffset = { x: -3 * angle, y: 10 };
        rightLegOffset = { x: 5 * angle, y: 9 };
      } else {
        leftLegOffset = { x: -5 * angle, y: 9 };
        rightLegOffset = { x: 3 * angle, y: 10 };
      }
    } else if (action === 'digging') {
      const angle = (facingDir === 'left') ? -1 : 1;
      // Front arm holding blaster
      rightArmOffset = { x: 10 * angle, y: 2 };
      leftArmOffset = { x: -4 * angle, y: 6 };
      // Leaning body
      leftLegOffset = { x: -4 * angle, y: 10 };
      rightLegOffset = { x: 4 * angle, y: 10 };
    }

    // Helper to draw a bent limb
    const drawBendingLimb = (x1, y1, x2, y2, bendDirection) => {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      // Offset the joint outwards and slightly upwards
      const jx = midX + bendDirection * 3.5;
      const jy = midY - 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(jx, jy);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // Draw Arms
    if (action === 'climbing' || action === 'climbing-out') {
      drawBendingLimb(hx, neckY + 2, hx + leftArmOffset.x, neckY + 2 + leftArmOffset.y, -1);
      drawBendingLimb(hx, neckY + 2, hx + rightArmOffset.x, neckY + 2 + rightArmOffset.y, 1);
    } else {
      ctx.beginPath();
      ctx.moveTo(hx, neckY + 2);
      ctx.lineTo(hx + leftArmOffset.x, neckY + 2 + leftArmOffset.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx, neckY + 2);
      ctx.lineTo(hx + rightArmOffset.x, neckY + 2 + rightArmOffset.y);
      ctx.stroke();
    }

    // Draw Legs
    if (action === 'climbing' || action === 'climbing-out') {
      drawBendingLimb(hx, hipY, hx + leftLegOffset.x, hipY + leftLegOffset.y, -1);
      drawBendingLimb(hx, hipY, hx + rightLegOffset.x, hipY + rightLegOffset.y, 1);
    } else {
      ctx.beginPath();
      ctx.moveTo(hx, hipY);
      ctx.lineTo(hx + leftLegOffset.x, hipY + leftLegOffset.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(hx, hipY);
      ctx.lineTo(hx + rightLegOffset.x, hipY + rightLegOffset.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Default black screen outside iris
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    if (transitionState !== 'none') {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxRadius = Math.sqrt(cx * cx + cy * cy);
      const currentRadius = maxRadius * transitionProgress;

      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.clip();
    }

    // Background style inside iris
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw static grid tiles
    for (let r = 0; r < engine.rows; r++) {
      for (let c = 0; c < engine.cols; c++) {
        const tile = engine.grid[r][c];
        const dugBrick = engine.dugBricks.find(b => b.x === c && b.y === r);

        if (dugBrick) {
          // Draw empty hole background
          ctx.fillStyle = '#020204';
          ctx.fillRect(c * 32, r * 32, 32, 32);
          ctx.strokeStyle = '#2d1808';
          ctx.lineWidth = 2;
          ctx.strokeRect(c * 32 + 2, r * 32 + 2, 28, 28);

          // Slowly regenerating brick visuals (when timer < 1.0s)
          if (dugBrick.timer < 1.0) {
            const ratio = (1.0 - dugBrick.timer); // 0.0 to 1.0
            const h = 32 * ratio;
            const sy = r * 32 + (32 - h);

            ctx.save();
            ctx.beginPath();
            ctx.rect(c * 32, sy, 32, h);
            ctx.clip();

            // Draw brick sprite
            ctx.fillStyle = '#a0522d';
            ctx.fillRect(c * 32, r * 32, 32, 32);
            
            ctx.strokeStyle = '#4a2511';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(c * 32, r * 32, 32, 32);
            
            ctx.beginPath();
            // Horizontal divider
            ctx.moveTo(c * 32, r * 32 + 16);
            ctx.lineTo(c * 32 + 32, r * 32 + 16);
            // Vertical lines
            ctx.moveTo(c * 32 + 16, r * 32);
            ctx.lineTo(c * 32 + 16, r * 32 + 16);
            ctx.moveTo(c * 32 + 8, r * 32 + 16);
            ctx.lineTo(c * 32 + 8, r * 32 + 32);
            ctx.moveTo(c * 32 + 24, r * 32 + 16);
            ctx.lineTo(c * 32 + 24, r * 32 + 32);
            ctx.stroke();

            // Glowing regeneration border
            ctx.strokeStyle = '#ff9900';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ff9900';
            ctx.beginPath();
            ctx.moveTo(c * 32, sy);
            ctx.lineTo(c * 32 + 32, sy);
            ctx.stroke();

            ctx.restore();
          }
          continue;
        }

        if (tile === '#' || tile === 'X') {
          // Brick tile (Normal or False)
          ctx.fillStyle = '#a0522d';
          ctx.fillRect(c * 32, r * 32, 32, 32);
          
          ctx.strokeStyle = '#4a2511';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(c * 32, r * 32, 32, 32);
          
          ctx.beginPath();
          // Horizontal divider
          ctx.moveTo(c * 32, r * 32 + 16);
          ctx.lineTo(c * 32 + 32, r * 32 + 16);
          // Vertical lines
          ctx.moveTo(c * 32 + 16, r * 32);
          ctx.lineTo(c * 32 + 16, r * 32 + 16);
          ctx.moveTo(c * 32 + 8, r * 32 + 16);
          ctx.lineTo(c * 32 + 8, r * 32 + 32);
          ctx.moveTo(c * 32 + 24, r * 32 + 16);
          ctx.lineTo(c * 32 + 24, r * 32 + 32);
          ctx.stroke();

        } else if (tile === '@') {
          // Solid block
          ctx.fillStyle = '#3a3d40';
          ctx.fillRect(c * 32, r * 32, 32, 32);
          
          ctx.strokeStyle = '#5a5d60';
          ctx.lineWidth = 2;
          ctx.strokeRect(c * 32 + 2, r * 32 + 2, 28, 28);
          
          ctx.strokeStyle = '#1e2022';
          ctx.strokeRect(c * 32 + 1, r * 32 + 1, 30, 30);
          
          // Rivets
          ctx.fillStyle = '#7a7d80';
          ctx.fillRect(c * 32 + 5, r * 32 + 5, 3, 3);
          ctx.fillRect(c * 32 + 24, r * 32 + 5, 3, 3);
          ctx.fillRect(c * 32 + 5, r * 32 + 24, 3, 3);
          ctx.fillRect(c * 32 + 24, r * 32 + 24, 3, 3);

        } else if (tile === 'H' || (tile === 'S' && engine.exitUnlocked)) {
          // Ladder
          const isExit = tile === 'S';
          ctx.strokeStyle = isExit ? '#45f3ff' : '#b0b5bc';
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          // Rails
          ctx.moveTo(c * 32 + 6, r * 32);
          ctx.lineTo(c * 32 + 6, r * 32 + 32);
          ctx.moveTo(c * 32 + 26, r * 32);
          ctx.lineTo(c * 32 + 26, r * 32 + 32);
          // Rungs
          for (let i = 4; i < 32; i += 8) {
            ctx.moveTo(c * 32 + 6, r * 32 + i);
            ctx.lineTo(c * 32 + 26, r * 32 + i);
          }
          ctx.stroke();

        } else if (tile === '-') {
          // Rope
          ctx.strokeStyle = '#c0c0c0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(c * 32, r * 32 + 8);
          ctx.lineTo(c * 32 + 32, r * 32 + 8);
          ctx.stroke();
          
          ctx.strokeStyle = '#808080';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 2; i < 32; i += 6) {
            ctx.moveTo(c * 32 + i, r * 32 + 6);
            ctx.lineTo(c * 32 + i + 3, r * 32 + 10);
          }
          ctx.stroke();
        }
      }
    }

    // 2. Draw Gold
    for (const g of engine.gold) {
      if (!g.collected) {
        const cx = g.x * 32;
        const cy = g.y * 32;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';

        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(cx + 6, cy + 10, 20, 16);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(cx + 6, cy + 6, 20, 4);
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx + 14, cy + 11, 4, 4);

        ctx.shadowBlur = 0;
      }
    }

    // 3. Draw Guards
    for (const guard of engine.guards) {
      let gx = guard.x * 32;
      let gy = guard.y * 32;

      if (guard.isSpawning) {
        // Draw spawning animation: concentric pulsing rings
        const radius1 = 4 + (1.0 - guard.spawnTimer) * 20; // shrinking/expanding rings
        const radius2 = Math.max(2, radius1 - 6);
        
        ctx.save();
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2.0;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff4d4d';
        
        // Inner ring
        ctx.beginPath();
        ctx.arc(gx + 16, gy + 16, radius1, 0, Math.PI * 2);
        ctx.stroke();

        // Outer ring
        ctx.strokeStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.beginPath();
        ctx.arc(gx + 16, gy + 16, radius2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Flash transparent/wireframe stickman
        const showStickman = Math.floor(guard.spawnTimer * 12) % 2 === 0;
        if (showStickman) {
          ctx.globalAlpha = 0.55;
          drawStickman(ctx, gx, gy, '#ff4d4d', 0, 'idle', 'left');
        }
        
        ctx.restore();
        continue;
      }

      let action = 'idle';
      let facingDir = 'left';

      if (guard.isTrapped) {
        if (guard.trapTimer < 0.5) {
          action = 'climbing-out';
          const climbProgress = (0.5 - guard.trapTimer) / 0.5; // 0.0 to 1.0
          
          const currentGridX = Math.round(guard.x);
          const currentGridY = Math.round(guard.y);
          let escapeX = currentGridX;
          const escapeY = currentGridY - 1;

          const goLeft = engine.player.x < guard.x;
          const firstDir = goLeft ? -1 : 1;
          const secondDir = goLeft ? 1 : -1;

          if (currentGridX + firstDir >= 0 && currentGridX + firstDir < engine.cols && !engine.isSolid(currentGridX + firstDir, escapeY)) {
            escapeX = currentGridX + firstDir;
          } else if (currentGridX + secondDir >= 0 && currentGridX + secondDir < engine.cols && !engine.isSolid(currentGridX + secondDir, escapeY)) {
            escapeX = currentGridX + secondDir;
          }

          gx = currentGridX * 32 + (escapeX - currentGridX) * 32 * climbProgress;
          gy = currentGridY * 32 - climbProgress * 32;
          facingDir = escapeX < currentGridX ? 'left' : 'right';
        } else {
          action = 'trapped';
        }
      } else {
        const onLadder = engine.isLadder(guard.x, guard.y);
        const onRope = engine.isRope(guard.x, guard.y);

        if (onLadder) {
          action = 'climbing';
        } else if (onRope) {
          action = 'rope';
          facingDir = guard.targetX < guard.x ? 'left' : 'right';
        } else if (Math.abs(guard.x - guard.targetX) > 0.01) {
          action = 'running';
          facingDir = guard.targetX < guard.x ? 'left' : 'right';
        }
      }

      drawStickman(ctx, gx, gy, '#ff4d4d', (guard.animTime || 0), action, facingDir);
    }

    // 4. Draw Player
    const px = engine.player.x * 32;
    const py = engine.player.y * 32;

    let playerAction = 'idle';
    let pFacingDir = engine.player.facingDir || 'right';

    if (engine.player.diggingDir) {
      playerAction = 'digging';
      pFacingDir = engine.player.diggingDir;
    } else {
      const onLadder = engine.isLadder(engine.player.x, engine.player.y);
      const onRope = engine.isRope(engine.player.x, engine.player.y);

      if (onLadder) {
        playerAction = 'climbing';
      } else if (onRope) {
        playerAction = 'rope';
        if (!(isPaused || engine.waitingForInput)) {
          if (keys['ArrowLeft'] || keys['a'] || keys['A']) pFacingDir = 'left';
          if (keys['ArrowRight'] || keys['d'] || keys['D']) pFacingDir = 'right';
        }
      } else if (!(isPaused || engine.waitingForInput) && (keys['ArrowLeft'] || keys['ArrowRight'] || keys['a'] || keys['d'] || keys['A'] || keys['D'])) {
        playerAction = 'running';
      }
    }

    drawStickman(ctx, px, py, '#45f3ff', (engine.player.animTime || 0), playerAction, pFacingDir);

    // 5. Draw Laser Blast Effect if digging
    if (engine.player.diggingDir) {
      const dxDir = engine.player.diggingDir === 'left' ? -1 : 1;
      const startLx = px + 16 + (10 * dxDir);
      const startLy = py + 11;

      // Laser targets the brick center diagonally below
      const txGrid = Math.round(engine.player.x) + dxDir;
      const tyGrid = Math.round(engine.player.y) + 1;
      const endLx = txGrid * 32 + 16;
      const endLy = tyGrid * 32 + 16;

      ctx.strokeStyle = '#ff3300';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff5500';

      ctx.beginPath();
      ctx.moveTo(startLx, startLy);
      ctx.lineTo(endLx, endLy);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startLx, startLy);
      ctx.lineTo(endLx, endLy);
      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    // 6. Draw Sparks
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.shadowBlur = 0;

    // 7. Draw waiting for input message overlay
    if (engine.waitingForInput && gameStarted && transitionState === 'none') {
      ctx.save();
      // Draw a subtle translucent dark background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#45f3ff';
      ctx.font = 'bold 20px "Courier New", Courier, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#45f3ff';
      ctx.fillText("PRESS ANY MOVEMENT KEY TO START", canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }

    ctx.restore(); // Restore transition clip mask
  }

  let lastTime = 0;
  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    
    // Clamp dt to avoid extreme physics jumps if browser tab loses focus
    const clampedDt = Math.min(dt, 100);
    
    update(clampedDt);
    draw();
    requestAnimationFrame(loop);
  }

  // Load first level automatically
  engine.loadLevel(classicLevels[0]);
  requestAnimationFrame(loop);
});
