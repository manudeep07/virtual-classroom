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

        const io = req.app.get('io');
        if (io) {
            console.log(`[DEBUG] Emitting announcement-created to dashboard-${classroomId}`);
            io.to(`dashboard-${classroomId}`).emit('announcement-created', announcement);
        } else {
            console.error('[DEBUG] Socket.io instance not found on request object');
        }

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

// Delete Announcement
router.delete('/:id', async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ message: 'Announcement deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Update Announcement
router.put('/:id', async (req, res) => {
    try {
        const { content } = req.body;
        const announcement = await Announcement.findByIdAndUpdate(
            req.params.id,
            { content },
            { new: true }
        ).populate('teacherId', 'name');
        res.json(announcement);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
