# Lode Runner HD

A modern, high-definition client-side web remake of the classic 1983 Apple II game **Lode Runner**. Built entirely with standard web technologies (HTML5 Canvas, CSS3, and JavaScript) without bloated external gaming frameworks.

Featuring responsive controls, dynamic audio synthesis, glowing neon graphics, advanced guard AI, and all 150 original classic levels.

---

## Features

### 🎮 Gameplay & Physics
*   **Original Game Rules**: Exact level scaling (28 columns × 16 rows), coordinate snapping, and dug block timers (6-second recovery).
*   **Stacking Traps & Head-Walking**: Multiple guards can fall into traps. Characters (including the player and other guards) can walk over trapped guards' heads to traverse holes safely.
*   **Ladder & Rope Physics**: Snapped climbing alignments with an intuitive slide-off mechanism. Drop off ropes instantly by pressing the down arrow key.
*   **Multi-layer Digging**: Excavate multiple layers of brick blocks simultaneously and drop down.

### 🤖 Intelligent Guard AI
*   **BFS Pathfinder**: Guards calculate paths dynamically utilizing Breadth-First Search (BFS) for chase movements.
*   **Best-First AI Fallback**: If the player is trapped or unreachable, the pathfinder targets the closest reachable cell using Manhattan distance, creating smart surrounds instead of freezing.
*   **Guard Spawning & Visuals**: Concentric red/gold pulsing rings lock and protect guards for 1.0 second upon spawn.

### 🎨 Visual & Neon Aesthetics
*   **Glowing Stickman Skeletons**: Modern neon rendering styles for players and guards with joint-bending animations (folded elbows and knees) on ladders and ropes.
*   **Smooth Crawl-Outs**: Guards slide smoothly out of holes diagonally onto adjacent platform columns in the final 0.5s of their trap timers.
*   **Visual Regenerations**: Dug bricks grow back slowly during the last 1.0 second of recovery, decorated with animated glowing orange borders.
*   **Iris Transitions**: Viewports close/open in clean circular masks on level completion or new level load.
*   **CRTs Simulation**: Nostalgic screen scanlines, CRT borders, and pulsing title splash animations.

### 🎵 Programmable Web Audio
*   **No Media Assets**: Audio effects are dynamically synthesized on the fly using the **Web Audio API** (`OscillatorNode` and `GainNode`):
    *   *Laser Digging*: Sweeping frequency slide-downs.
    *   *Gold collection*: Chime chord sweeps.
    *   *Level Completed*: Harmonic jingles.
    *   *Crush/Trapped*: Low sweep clicks.
    *   *Player Death*: Swept sawtooth pitch slides.

---

## Controls

### Keyboard (Desktop)
*   **Move Left/Right/Up/Down**: Arrow keys or `W`/`A`/`S`/`D`
*   **Dig Left**: `Z`
*   **Dig Right**: `X`
*   **Pause/Resume**: Click on the Pause/Resume HUD button

### Touch Controls (Mobile)
*   **Responsive Virtual D-pad**: On-screen buttons to control four-way movements.
*   **Dig Action Buttons**: Action buttons mapped to the bottom right for Left/Right digs.

*Note: On level start or after player respawn, the game freezes and displays "PRESS ANY MOVEMENT KEY TO START", ensuring players have time to prepare before simulation starts.*

---

## Tech Stack
*   **Vite**: Frontend tooling and developer server.
*   **HTML5 Canvas**: Pure rendering drawing context.
*   **Vanilla CSS3**: Styling, glassmorphic HUD, CRT filters, and layout.
*   **Web Audio API**: Real-time sound synthesis.

---

## Get Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/Loderunner_HD.git
   cd Loderunner_HD
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Run Locally (Development)
Start the Vite development server:
```bash
npm run dev
```
Open the local URL (typically `http://localhost:5173`) in your web browser.

### Build (Production)
Compile the project for production deployment:
```bash
npx vite build
```
This generates optimized static files in the `dist/` directory, ready to be hosted on GitHub Pages, Netlify, Vercel, or any static file server.

---

## License

This project is open-source and available under the [MIT License](LICENSE).
