const { Server } = require('socket.io');
const env = require('./env');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io belum diinisialisasi');
  }
  return io;
}

module.exports = { initSocket, getIO };
