const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');

const upload = require('../middleware/upload');

// Submit Assignment (Student)
// POST /api/submissions/:assignmentId
router.post('/:assignmentId', upload, async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { studentId, content } = req.body;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (!studentId) {
            return res.status(400).json({ message: 'Missing studentId' });
        }

        // Check if already submitted, update if so
        let submission = await Submission.findOne({ assignmentId, studentId });

        if (submission) {
            return res.status(400).json({ message: 'You have already submitted this assignment.' });
        } else {
            submission = new Submission({
                assignmentId,
                studentId,
                content: content || '',
                fileUrl
            });
        }

        await submission.save();
        res.status(201).json(submission);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get My Submission (Student)
// GET /api/submissions/:assignmentId/my-submission?studentId=XYZ
router.get('/:assignmentId/my-submission', async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { studentId } = req.query;

        const submission = await Submission.findOne({ assignmentId, studentId });
        if (!submission) return res.json(null); // Not 404, just null

        res.json(submission);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get All Submissions for Assignment (Teacher)
// GET /api/submissions/:assignmentId/all
router.get('/:assignmentId/all', async (req, res) => {
    try {
        const { assignmentId } = req.params;
        // Ideally verify teacher role here

        const submissions = await Submission.find({ assignmentId })
            .populate('studentId', 'name email')
            .sort({ submittedAt: -1 });

        res.json(submissions);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
