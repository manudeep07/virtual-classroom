const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Material = require('../models/Material');
const Classroom = require('../models/Classroom'); // Optional check for existence

const upload = require('../middleware/upload');

// --- Assignments ---

// Create Assignment (Teacher)
router.post('/classrooms/:classroomId/assignments', upload, async (req, res) => {
    try {
        const { title, description, dueDate } = req.body;
        const { classroomId } = req.params;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const assignment = new Assignment({
            title,
            description,
            dueDate,
            classroomId,
            fileUrl
        });

        await assignment.save();
        res.status(201).json(assignment);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ... (Get Assignments route remains same)

// --- Materials ---

// Create Material (Teacher)
router.post('/classrooms/:classroomId/materials', upload, async (req, res) => {
    try {
        const { title, description, link } = req.body;
        const { classroomId } = req.params;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const material = new Material({
            title,
            description,
            link,
            classroomId,
            fileUrl
        });

        await material.save();
        res.status(201).json(material);
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
router.post('/classrooms/:classroomId/materials', upload, async (req, res) => {
    try {
        const { title, description, link } = req.body;
        const { classroomId } = req.params;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const material = new Material({
            title,
            description,
            link,
            classroomId,
            fileUrl
        });

        await material.save();
        res.status(201).json(material);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get Materials for a Classroom
router.get('/classrooms/:classroomId/materials', async (req, res) => {
    try {
        const materials = await Material.find({ classroomId: req.params.classroomId }).sort({ createdAt: -1 });
        res.json(materials);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
