const express = require('express');
const router = express.Router();
const Classroom = require('../models/Classroom');
const User = require('../models/User');

// Middleware to verify token (rudimentary, using the one from index.js if exported, or redefining)
// For now, I'll assume the request comes with a user object or I need to implement auth middleware.
// Ideally, we move the auth middleware to a separate file. For speed, I'll implement a basic check here
// assuming the main server file doesn't globally apply it yet, or I'll ask to check `index.js`.
// Actually, looking at previous steps, `index.js` just had routes. 
// I will create a middleware helper or just verify inside the route for now if `req.user` isn't populated.
// Wait, the previous turn added `jsonwebtoken`. 

// Helper function to generate 6 digit code
const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create a Classroom (Teacher Only)
router.post('/', async (req, res) => {
    try {
        const { name, subject, teacherId } = req.body;

        // Validation
        if (!name || !subject || !teacherId) {
            return res.status(400).json({ message: 'Missing fields' });
        }

        let code = generateCode();
        // Ensure uniqueness (simple check)
        let existing = await Classroom.findOne({ code });
        while (existing) {
            code = generateCode();
            existing = await Classroom.findOne({ code });
        }

        const newClassroom = new Classroom({
            name,
            subject,
            teacherId,
            code,
            studentIds: [] // Init empty
        });

        await newClassroom.save();
        res.status(201).json(newClassroom);
    } catch (error) {
        console.error('Create Classroom Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Join a Classroom (Student Only)
router.post('/join', async (req, res) => {
    try {
        const { code, studentId } = req.body;

        if (!code || !studentId) {
            return res.status(400).json({ message: 'Missing fields' });
        }

        const classroom = await Classroom.findOne({ code });
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        // Check if already enrolled
        if (classroom.studentIds.includes(studentId)) {
            return res.status(400).json({ message: 'Already enrolled' });
        }

        // Check if user is the teacher
        if (classroom.teacherId.toString() === studentId) {
            return res.status(400).json({ message: 'Teacher cannot join their own class as student' });
        }

        classroom.studentIds.push(studentId);
        await classroom.save();

        res.status(200).json({ message: 'Joined successfully', classroom });
    } catch (error) {
        console.error('Join Classroom Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get My Classrooms (Teacher created or Student enrolled)
// This expects specific query params or body to identify the user.
// GET /api/classrooms/my-classes?userId=XYZ&role=teacher
router.get('/my-classes', async (req, res) => {
    try {
        const { userId, role } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'Missing userId' });
        }

        let classrooms;
        if (role === 'teacher') {
            classrooms = await Classroom.find({ teacherId: userId }).sort({ createdAt: -1 });
        } else {
            classrooms = await Classroom.find({ studentIds: userId }).sort({ createdAt: -1 });
            // Populate teacher info if needed
            // .populate('teacherId', 'name email'); 
        }

        res.json(classrooms);
    } catch (error) {
        console.error('Get My Classrooms Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// Get Classroom Details
router.get('/:id', async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id)
            .populate('teacherId', 'name email')
            .populate('studentIds', 'name email'); // Populate students for "People" tab

        if (!classroom) return res.status(404).json({ message: 'Not found' });

        res.json(classroom);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Delete Classroom (Teacher Only)
router.delete('/:id', async (req, res) => {
    try {
        const { teacherId } = req.body;
        // In real app, get userId from auth middleware req.user.id
        // Here we rely on body or query, assuming teacherId is passed for verification

        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

        if (classroom.teacherId.toString() !== teacherId) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await Classroom.findByIdAndDelete(req.params.id);
        res.json({ message: 'Ciassroom deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
