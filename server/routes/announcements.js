const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// Create Announcement
router.post('/:classroomId', async (req, res) => {
    try {
        const { classroomId } = req.params;
        const { teacherId, content } = req.body;

        if (!content || !teacherId) return res.status(400).json({ message: 'Missing fields' });

        const announcement = new Announcement({
            classroomId,
            teacherId,
            content
        });

        await announcement.save();
        // Populate teacher name immediately for the UI
        await announcement.populate('teacherId', 'name');

        res.status(201).json(announcement);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get Announcements
router.get('/:classroomId', async (req, res) => {
    try {
        const announcements = await Announcement.find({ classroomId: req.params.classroomId })
            .populate('teacherId', 'name')
            .sort({ createdAt: -1 });
        res.json(announcements);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
