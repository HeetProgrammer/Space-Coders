const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Matter = require("matter-js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });


const Engine = Matter.Engine, World = Matter.World, Bodies = Matter.Bodies, Vector = Matter.Vector;
const engine = Engine.create();
engine.gravity.y = 0; 

const ship1Body = Bodies.rectangle(200, 300, 30, 30, { frictionAir: 0.05, density: 0.01 });
const ship2Body = Bodies.rectangle(600, 300, 30, 30, { frictionAir: 0.05, density: 0.01 });
Matter.Body.setAngle(ship2Body, Math.PI); 

// Walls around the map
const walls = [
  Bodies.rectangle(400, -10, 820, 20, { isStatic: true }), // Top
  Bodies.rectangle(400, 610, 820, 20, { isStatic: true }), // Bottom
  Bodies.rectangle(-10, 300, 20, 620, { isStatic: true }), // Left
  Bodies.rectangle(810, 300, 20, 620, { isStatic: true })  // Right
];
World.add(engine.world, [ship1Body, ship2Body, ...walls]);

let player1Id = null;
let player2Id = null;
let playerCodes = { player1: "", player2: "" };
let projectiles = []; 

let matchState = "WAITING"; // 'WAITING' | 'RUNNING' | 'PAUSED' | 'ENDED'
let pauseInitiator = null;  
let playerReady = { player1: false, player2: false };

const MATCH_DURATION = 300;    
const OVERTIME_DURATION = 60;
let matchTimer = MATCH_DURATION; 
let isOvertime = false;


class ServerSpacecraftAPI {
  constructor(body, enemyBody, isPlayer1) {
    this.body = body;
    this.enemyBody = enemyBody;
    this.isPlayer1 = isPlayer1;
    this.health = 100;
    this.maxHealth = 100;
    this.lastShotTime = 0;
    this.shotCooldown = 300;
    this.maxSpeed = 3.5;
    this.currentPath = [];
  }

  // These properties can't directly be modified
  get position() { return { x: this.body.position.x, y: this.body.position.y }; }
  get velocity() { return { x: this.body.velocity.x, y: this.body.velocity.y }; }
  get direction() { return (this.body.angle * 180) / Math.PI; }
  get enemy() {
    const enemyAPI = this.isPlayer1 ? api2 : api1;
    return {
      position: { x: this.enemyBody.position.x, y: this.enemyBody.position.y },
      velocity: { x: this.enemyBody.velocity.x, y: this.enemyBody.velocity.y },
      direction: (this.enemyBody.angle * 180) / Math.PI,
      health: enemyAPI.health,
      maxHealth: enemyAPI.maxHealth,
    };
  }
  distanceTo(object) {
    if (!object || !object.position) return 9999;
    return Vector.magnitude(Vector.sub(object.position, this.position));
  }
  lookAt(target) {
    const t = target || this.enemy?.position;
    if (!t) return;
    Matter.Body.setAngle(this.body, Math.atan2(t.y - this.position.y, t.x - this.position.x));
  }
  moveTo(vec) {
    if (!vec) return;
    const targetVector = Vector.sub(vec, this.position);
    if (Vector.magnitude(targetVector) > 5) {
      Matter.Body.setVelocity(this.body, Vector.mult(Vector.normalise(targetVector), this.maxSpeed));
    } else {
      Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    }
  }
  shoot(directionDegrees) {
    const now = Date.now();
    if (now - this.lastShotTime < this.shotCooldown) return;
    this.lastShotTime = now;
    let radians = directionDegrees !== undefined ? (directionDegrees * Math.PI) / 180 : this.body.angle;
    const spawnX = this.position.x + Math.cos(radians) * 22;
    const spawnY = this.position.y + Math.sin(radians) * 22;
    const laser = Bodies.circle(spawnX, spawnY, 4, { label: this.isPlayer1 ? "p1-laser" : "p2-laser", frictionAir: 0, isSensor: true });
    Matter.Body.setVelocity(laser, { x: Math.cos(radians) * 8, y: Math.sin(radians) * 8 });
    projectiles.push(laser);
    World.add(engine.world, laser);
  }
  shootAt(target) {
    if (!target) return;
    this.shoot(Math.atan2(target.y - this.position.y, target.x - this.position.x) * (180 / Math.PI));
  }
  face(direction) {
    if (direction !== undefined && direction !== null) Matter.Body.setAngle(this.body, (direction * Math.PI) / 180);
  }
  getProjectiles() {
    const targetLabel = this.isPlayer1 ? "p2-laser" : "p1-laser";
    return projectiles.filter(b => b.label === targetLabel).filter(laser => {
      const toShip = Vector.sub(this.position, laser.position);
      return Vector.dot(Vector.normalise(laser.velocity), Vector.normalise(toShip)) > 0;
    }).map(laser => ({ position: { x: laser.position.x, y: laser.position.y }, velocity: { x: laser.velocity.x, y: laser.velocity.y } }));
  }
  circleAround(pointOrRadius, optionalRadius) {
    let targetPoint = this.enemy?.position;
    let radius = pointOrRadius;
    if (optionalRadius !== undefined) { targetPoint = pointOrRadius; radius = optionalRadius; }
    if (!targetPoint) return;
    const toTarget = Vector.sub(targetPoint, this.position);
    const distance = Matter.Vector.magnitude(toTarget);
    let radialCorrection = distance > radius + 5 ? 0.25 : distance < radius - 5 ? -0.25 : 0;
    const finalDirection = Vector.add(Vector.normalise({ x: -toTarget.y, y: toTarget.x }), Vector.mult(Vector.normalise(toTarget), radialCorrection));
    Matter.Body.setVelocity(this.body, Vector.mult(Vector.normalise(finalDirection), this.maxSpeed));
  }
}

const api1 = new ServerSpacecraftAPI(ship1Body, ship2Body, true);
const api2 = new ServerSpacecraftAPI(ship2Body, ship1Body, false);

function executeGlobalReset() {
  matchState = "WAITING";
  pauseInitiator = null;
  playerReady = { player1: false, player2: false };
  
  matchTimer = MATCH_DURATION; 
  isOvertime = false;
  
  api1.health = 100;
  api2.health = 100;
  projectiles.forEach((laser) => World.remove(engine.world, laser));
  projectiles = [];

  Matter.Body.setPosition(ship1Body, { x: 200, y: 300 });
  Matter.Body.setVelocity(ship1Body, { x: 0, y: 0 });
  Matter.Body.setAngle(ship1Body, 0);

  Matter.Body.setPosition(ship2Body, { x: 600, y: 300 });
  Matter.Body.setVelocity(ship2Body, { x: 0, y: 0 });
  Matter.Body.setAngle(ship2Body, Math.PI);

  io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
}

io.on("connection", (socket) => {
  let role = "spectator";
  if (!player1Id) { player1Id = socket.id; role = "player1"; } 
  else if (!player2Id) { player2Id = socket.id; role = "player2"; }

  socket.emit("role_assigned", role);
  socket.emit("match_state_change", { matchState, pauseInitiator, playerReady });

  socket.on("submit_code", (codeString) => {
    if (socket.id === player1Id) playerCodes.player1 = codeString;
    if (socket.id === player2Id) playerCodes.player2 = codeString;

    if (matchState === "PAUSED") {
      const isInitiator = (socket.id === player1Id && pauseInitiator === "player1") || 
                          (socket.id === player2Id && pauseInitiator === "player2");
      if (isInitiator) {
        matchState = "RUNNING";
        pauseInitiator = null;
        io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
      }
    }
  });

  socket.on("trigger_pause", () => {
    if ((socket.id === player1Id || socket.id === player2Id) && matchState === "RUNNING") {
      matchState = "PAUSED";
      pauseInitiator = socket.id === player1Id ? "player1" : "player2";
      Matter.Body.setVelocity(ship1Body, { x: 0, y: 0 });
      Matter.Body.setVelocity(ship2Body, { x: 0, y: 0 });
      io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
    }
  });

  socket.on("trigger_start", () => {
    if (socket.id === player1Id) playerReady.player1 = true;
    if (socket.id === player2Id) playerReady.player2 = true;

    if (playerReady.player1 && playerReady.player2 && matchState === "WAITING") {
      matchState = "RUNNING";
    }
    io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
  });

  socket.on("trigger_reset", () => {
    if (socket.id === player1Id || socket.id === player2Id) executeGlobalReset();
  });

  socket.on("disconnect", () => {
    if (socket.id === player1Id) { player1Id = null; playerCodes.player1 = ""; playerReady.player1 = false; }
    if (socket.id === player2Id) { player2Id = null; playerCodes.player2 = ""; playerReady.player2 = false; }
    io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
  });
});

setInterval(() => {
  if (matchState === "RUNNING") {
    
    matchTimer -= (1 / 60);
    if (matchTimer <= 0) {
      if (!isOvertime) {
        if (api1.health > api2.health) {
          api2.health = 0; // Forces Player 1 Win
          matchState = "ENDED";
        } else if (api2.health > api1.health) {
          api1.health = 0; // Forces Player 2 Win
          matchState = "ENDED";
        } else {
          isOvertime = true;
          matchTimer = OVERTIME_DURATION;
        }
      } else {
        matchTimer = 0;
        matchState = "ENDED";
        
        if (api1.health > api2.health) {
          api2.health = 0; 
        } else if (api2.health > api1.health) {
          api1.health = 0;
        } 
        
        io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
      }
    }

    // Executes Code Scripts
    if (player1Id && playerCodes.player1 && api1.health > 0) {
      try { new Function("spacecraft", playerCodes.player1)(api1); } catch (e) {}
    }
    if (player2Id && playerCodes.player2 && api2.health > 0) {
      try { new Function("spacecraft", playerCodes.player2)(api2); } catch (e) {}
    }

    Engine.update(engine, 1000 / 60);

    projectiles = projectiles.filter((laser) => {
      const lx = laser.position.x; const ly = laser.position.y;
      if (laser.label === "p2-laser" && Vector.magnitude(Vector.sub(laser.position, ship1Body.position)) < 20) {
        api1.health = Math.max(0, api1.health - 10); World.remove(engine.world, laser); return false;
      }
      if (laser.label === "p1-laser" && Vector.magnitude(Vector.sub(laser.position, ship2Body.position)) < 20) {
        api2.health = Math.max(0, api2.health - 10); World.remove(engine.world, laser); return false;
      }
      if (lx < 0 || lx > 800 || ly < 0 || ly > 600) { World.remove(engine.world, laser); return false; }
      return true;
    });

    if (api1.health <= 0 || api2.health <= 0) {
      matchState = "ENDED";
      io.emit("match_state_change", { matchState, pauseInitiator, playerReady });
    }
  }

  const statePayload = {
    timeLeft: Math.max(0, matchTimer),
    isOvertime: isOvertime,
    player1: { x: ship1Body.position.x, y: ship1Body.position.y, angle: ship1Body.angle, health: api1.health },
    player2: { x: ship2Body.position.x, y: ship2Body.position.y, angle: ship2Body.angle, health: api2.health },
    lasers: projectiles.map(l => ({ x: l.position.x, y: l.position.y }))
  };

  io.emit("game_state_update", statePayload);
}, 1000 / 60);

server.listen(3001, () => console.log("🔥 Engine Running safely on Port 3001"));