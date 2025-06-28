const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

const payRoute = require('./routes/pay'); // ✅ Only declare once

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/api/pay', payRoute); // ✅ Use the single pay route

const games = {};  // active games
let waitingRandomPlayer = null;

// Socket.io logic
io.on('connection', (socket) => {
  socket.on('joinGame', ({ room, isPrivateRoom, stake }) => {
    const parsedStake = parseInt(stake || 20);
    const validStake = parsedStake >= 10 && parsedStake % 10 === 0;

    if (!validStake) {
      socket.emit('error', { message: 'Invalid stake amount.' });
      return;
    }

    if (isPrivateRoom && room) {
      socket.join(room);
      if (!games[room]) {
        games[room] = {
          players: {},
          turn: 'white',
          stake: parsedStake
        };
        games[room].players[socket.id] = 'white';
        socket.emit('waitingForPlayer');
      } else {
        games[room].players[socket.id] = 'black';
        startGame(room);
      }
    } else {
      if (waitingRandomPlayer) {
        const newRoom = `room-${waitingRandomPlayer.id}-${socket.id}`;
        socket.join(newRoom);
        waitingRandomPlayer.join(newRoom);

        games[newRoom] = {
          players: {
            [waitingRandomPlayer.id]: 'white',
            [socket.id]: 'black'
          },
          turn: 'white',
          stake: parsedStake
        };

        startGame(newRoom);
        waitingRandomPlayer = null;
      } else {
        waitingRandomPlayer = socket;
        socket.emit('waitingForPlayer');
      }
    }
  });

  function startGame(room) {
    const players = games[room].players;
    const stake = games[room].stake;
    for (const [id, color] of Object.entries(players)) {
      io.to(id).emit('startGame', { room, color, stake });
    }
  }

  socket.on('move', (data) => {
    socket.to(data.room).emit('move', data);
  });

  socket.on('gameOver', ({ room, winner }) => {
    if (games[room]) {
      const stake = games[room].stake;
      const prize = Math.floor(stake * 2 * 0.9); // 10% commission

      for (const id of Object.keys(games[room].players)) {
        io.to(id).emit('gameOver', { winner, prize });
      }
      delete games[room];
    }
  });

  socket.on('timeout', ({ room, loser }) => {
    if (games[room]) {
      const stake = games[room].stake;
      const winner = loser === 'white' ? 'black' : 'white';
      const prize = Math.floor(stake * 2 * 0.9);
      io.to(room).emit('gameOver', { winner, prize });
      delete games[room];
    }
  });

  socket.on('forfeit', ({ room, loser }) => {
    if (games[room]) {
      const stake = games[room].stake;
      const winner = loser === 'white' ? 'black' : 'white';
      const prize = Math.floor(stake * 2 * 0.9);
      io.to(room).emit('gameOver', { winner, prize });
      delete games[room];
    }
  });

  socket.on('disconnect', () => {
    if (waitingRandomPlayer?.id === socket.id) {
      waitingRandomPlayer = null;
      return;
    }

    for (const [room, game] of Object.entries(games)) {
      if (socket.id in game.players) {
        const loserColor = game.players[socket.id];
        const winnerColor = loserColor === 'white' ? 'black' : 'white';
        const prize = Math.floor(game.stake * 2 * 0.9);

        io.to(room).emit('gameOver', { winner: winnerColor, prize });
        delete games[room];
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
