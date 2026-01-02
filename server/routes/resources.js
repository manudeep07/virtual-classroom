const express = require('express');
const multer = require('multer');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Material = require('../models/Material');
const Classroom = require('../models/Classroom'); // Optional check for existence

const upload = require('../middleware/upload');

// --- Assignments ---

// Create Assignment (Teacher)
router.post('/classrooms/:classroomId/assignments', (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File size should be less than 5 MB' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message || 'Upload error' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { title, description, dueDate } = req.body;
        const { classroomId } = req.params;
        const fileUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;

        if (!dueDate) {
            return res.status(400).json({ message: 'Due date is required' });
        }

        // Validation: Prevent past due dates
        if (new Date(dueDate) < new Date()) {
            return res.status(400).json({ message: 'Due date cannot be in the past' });
        }

        const assignment = new Assignment({
            title,
            description,
            dueDate,
            classroomId,
            fileUrl
        });

        await assignment.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`dashboard-${classroomId}`).emit('assignment-created', assignment);
        }

        res.status(201).json(assignment);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Delete Assignment (Teacher)
router.delete('/classrooms/:classroomId/assignments/:id', async (req, res) => {
    try {
        const { id, classroomId } = req.params;
        // Ideally verify teacher ownership here
        const assignment = await Assignment.findByIdAndDelete(id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        // Also delete associated submissions (Cleanup)
        const Submission = require('../models/Submission');
        await Submission.deleteMany({ assignmentId: id });

        const io = req.app.get('io');
        if (io) {
            io.to(`dashboard-${classroomId}`).emit('assignment-deleted', id);
        }

        res.json({ message: 'Assignment deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get Assignments for a Classroom
router.get('/classrooms/:classroomId/assignments', async (req, res) => {
    try {
        const assignments = await Assignment.find({ classroomId: req.params.classroomId }).sort({ createdAt: -1 });
        res.json(assignments);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// --- Materials ---

// Create Material (Teacher)

router.post('/classrooms/:classroomId/materials', (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File size should be less than 5 MB' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message || 'Upload error' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { title, description, link } = req.body;
        const { classroomId } = req.params;
        const fileUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;

        const material = new Material({
            title,
            description,
            link,
            classroomId,
            fileUrl
        });

        await material.save();

        const io = req.app.get('io');
        if (io) {
            // Emit to the dashboard room for notifications (if desired) and the specific classroom room if actively viewing
            // For simplicity and matching the plan, we emit to the dashboard room which handles broadly, 
            // OR we can emit to the classroom room.
            // The plan said: emit `material-created` to `dashboard-{classroomId}`. 
            // NOTE: ClassroomView joins `dashboard-{classroomId}` in the current code (see ClassroomView.jsx:109). 
            // So this single emission covers both the list update in ClassroomView AND the dash notification.
            io.to(`dashboard-${classroomId}`).emit('material-created', material);
        }

        res.status(201).json(material);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get Materials for a Classroom
router.get('/classrooms/:classroomId/materials', async (req, res) => {
    try {
        const { classroomId } = req.params;
        if (!classroomId) return res.status(400).json({ message: 'Missing classroomId' });

        const materials = await Material.find({ classroomId }).sort({ createdAt: -1 });
        res.json(materials);
    } catch (err) {
        console.error('Error in GET materials:', err);
        res.status(500).json({ message: 'Server Error', error: err.message });
    }
});

module.exports = router;
