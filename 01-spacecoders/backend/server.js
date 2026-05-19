const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enables CORS for standard web requests
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

//Listens for players connecting to the game
io.on('connection', (socket) => {
  console.log(`New player connected: ${socket.id}`);

  // Listen for players disconnecting from the game
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Starts the server on port 5000
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Game Server is running on http://localhost:${PORT}`);
});