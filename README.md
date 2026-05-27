Space Coders

## Project Overview
This project is a real-time, 1v1 multiplayer web application where users control spacecrafts not by using a keyboard or mouse, but by programming their behavior using JavaScript. Players write tactical scripts to navigate the arena, dodge incoming fire, and destroy the enemy spacecraft. 

The game features server-side physics, safe code execution, real-time replication, and a strict match state machine (Standard Time, Overtime, and Draws).

## Features Implemented

* **Real-Time Multiplayer:** Handled via Socket.io with a server-authoritative architecture. 
* **Safe Code Execution:** User code is strictly evaluated on the backend within a safe function loop. Keyboard and mouse exploits are entirely mitigated.
* **Match State Machine:** * 5-Minute Standard Match Timer.
  * 1-Minute Overtime if health is tied at the end of regulation.
  * Draw resolution if both ships die simultaneously or time expires.
* **Arena Physics:** Powered by `matter-js`. Ships possess inertia, take permanent damage, and are confined within an 800x600 invisible static boundary. Projectiles are automatically cleared upon collision or exiting the bounds.
* **Dynamic UI Syncing:** The Monaco Editor dynamically locks (read-only mode) during active gameplay. Players can explicitly pause the match to change code, updating the UI for the opponent.
* **Complete Spacecraft API:** Fully exposed `spacecraft` object with properties (`allied`, `enemy`, `health`, `position`, `velocity`) and methods (`moveTo`, `shootAt`, `circleAround`, `getProjectiles`, etc.).

## Tech Stack
* **Backend:** Node.js, Express, Socket.io, Matter.js (Physics Engine)
* **Frontend:** React, Next.js, HTML5 Canvas API (Rendering)
* **Code Editor:** `@monaco-editor/react`

## Installation & Setup Instructions

To run this project locally, you will need to start both the server and the client. Ensure you have Node.js installed.

### 1. Start the Backend Server
1. Open a terminal and navigate to the backend directory (or wherever `server.js` is located).
2. Install the required dependencies:
   ```bash
   npm install express socket.io matter-js
   ```
3. Run the server:
   ```bash
   node server.js
   ```
   The server will open on http://localhost:3001

### 2. Start the Frontend Client
1. Open a second terminal and navigate to your frontend directory (Next.js project).

2. Install the required dependencies:
   ```bash
   npm install socket.io-client @monaco-editor/react
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   
4. Open two browser windows and navigate to http://localhost:3000. The first connection will be assigned Player 1 (Blue), and the second will be Player 2 (Red). Any subsequent connections will join as Spectators.


## How to Play
1. Write your script: Use the built-in API (referenced on the left panel) to script your ship's logic.

2. Ready Up: Click Start Match. The match will only begin once both Player 1 and Player 2 have clicked start.

3. Change Code Mid-Game: Click Change Code to pause the simulation. The opponent will see a "Waiting" screen. Write your new logic and click Implement Changes to instantly resume the fight.

4. Win Condition: Reduce the enemy's health to 0 before the 5-minute timer (or 1-minute overtime) expires!

## Spacecraft API Reference Quick-Look
1. Properties: position, velocity, direction, health, allied, enemy

2. Movement: moveTo(target), face(degrees), lookAt(target), circleAround(radius)

3. Combat: shoot(), shootAt(target)

4. Radar/Sensors: distanceTo(obj), getProjectiles()
