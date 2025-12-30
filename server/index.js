const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Classroom = require('./models/Classroom');

// ... (previous imports)

// Middleware to verify Token (optional for now, but good to have)
const auth = (req, res, next) => {
  // ...
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
      if (err) throw err;
      res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


const classroomRoutes = require('./routes/classrooms');
const resourceRoutes = require('./routes/resources');

app.use('/api/classrooms', classroomRoutes);
app.use('/api', resourceRoutes);
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/announcements', require('./routes/announcements'));

// Socket.io handlers
// In-memory store for room participants (for demo purposes)
// In production, use Redis or database
const roomUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', async ({ roomId, userId, name }) => {
    try {
      console.log(`[DEBUG] Join Request: Room ${roomId}, User ${userId}, Name ${name}`);

      const classroom = await Classroom.findById(roomId);

      if (!classroom) {
        socket.emit('error', 'Classroom not found');
        return;
      }

      const isTeacher = classroom.teacherId.toString() === userId;
      const isStudent = classroom.studentIds.includes(userId);

      if (!isTeacher && !isStudent) {
        socket.emit('error', 'You are not a member of this class');
        return;
      }

      if (isTeacher) {
        if (!classroom.isActive) {
          classroom.isActive = true;
          await classroom.save();
        }
      } else {
        if (!classroom.isActive) {
          socket.emit('error', 'Class is not live yet');
          return;
        }
      }

      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);

      // Track user
      if (!roomUsers[roomId]) roomUsers[roomId] = [];

      // Check if this specific socket user is already in the room
      const existingUserSession = roomUsers[roomId].find(u => u.userId === userId && u.socketId === socket.id);
      if (existingUserSession) {
        console.log(`[DEBUG] Duplicate join detected for User ${userId}`);
        // Already joined, just send current users list to be safe, but NO broadcast
        socket.emit('all-users', roomUsers[roomId].filter(u => u.userId !== userId));
        return;
      }

      // Remove if already exists (re-join with new socket or zombie)
      roomUsers[roomId] = roomUsers[roomId].filter(u => u.userId !== userId);
      roomUsers[roomId].push({ userId, name, socketId: socket.id });

      // Send existing users to new user
      socket.emit('all-users', roomUsers[roomId].filter(u => u.userId !== userId));

      // Broadcast to others
      socket.to(roomId).emit('user-connected', { userId, name });

      socket.on('disconnect', () => {
        console.log('User disconnected:', userId);
        if (roomUsers[roomId]) {
          roomUsers[roomId] = roomUsers[roomId].filter(u => u.userId !== userId);
        }
        socket.to(roomId).emit('user-disconnected', { userId, socketId: socket.id });
      });



    } catch (err) {
      console.error("Socket Join Error:", err);
      socket.emit('error', 'Server error joining room');
    }
  });

  // Dashboard/Classroom View Socket Logic
  socket.on('join-classroom-dashboard', ({ roomId }) => {
    socket.join(`dashboard-${roomId}`);
  });

  socket.on('start-class', async ({ roomId, userId, duration }) => {
    // Basic check, ideally verify teacher role from DB again or JWT
    console.log(`[DEBUG] Starting class ${roomId} with duration ${duration} mins`);

    // Save duration if needed, or just set timeout in memory
    if (duration > 0) {
      const timeoutMs = duration * 60 * 1000;
      setTimeout(async () => {
        console.log(`[Timer] Auto-ending class ${roomId} after ${duration} mins`);
        const classroom = await Classroom.findById(roomId);
        if (classroom && classroom.isActive) {
          classroom.isActive = false;
          await classroom.save();
          io.to(roomId).emit('class-ended');
          io.to(`dashboard-${roomId}`).emit('class-status-changed', { isActive: false });
          delete roomUsers[roomId];
        }
      }, timeoutMs);
    }

    io.to(`dashboard-${roomId}`).emit('class-status-changed', { isActive: true });
  });

  socket.on('raise-hand', ({ roomId, userId }) => {
    io.to(roomId).emit('user-raised-hand', userId);
  });

  socket.on('lower-hand', ({ roomId, userId }) => {
    io.to(roomId).emit('user-lowered-hand', userId);
  });

  socket.on('end-class', async ({ roomId, userId }) => {
    try {
      const classroom = await Classroom.findById(roomId);
      if (classroom && classroom.teacherId.toString() === userId) {
        classroom.isActive = false;
        await classroom.save();
        io.to(roomId).emit('class-ended');
        io.to(`dashboard-${roomId}`).emit('class-status-changed', { isActive: false });
        delete roomUsers[roomId];
      }
    } catch (err) {
      console.error("Error ending class:", err);
    }
  });

  // WebRTC Signaling
  socket.on('sending-signal', (payload) => {
    io.to(payload.userToSignal).emit('user-joined', { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on('returning-signal', (data) => {
    io.to(data.callerID).emit('receiving-returned-signal', { signal: data.signal, id: socket.id });
  });

  // Chat
  socket.on('send-message', (data) => {
    io.to(data.roomId).emit('receive-message', data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
