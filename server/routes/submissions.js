const express = require('express');
const multer = require('multer');
const router = express.Router();
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');

const upload = require('../middleware/upload');

// Submit Assignment (Student)
// POST /api/submissions/:assignmentId
router.post('/:assignmentId', (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File size should be less than 5 MB' });
            }
            return res.status(400).json({ message: err.message });
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(400).json({ message: err.message || 'Upload error' });
        }
        // Everything went fine.
        next();
    });
}, async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { studentId, content } = req.body;
        // For local uploads, construct the URL
        const fileUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;

        if (!studentId) {
            return res.status(400).json({ message: 'Missing studentId' });
        }

        // Check if already submitted
        let submission = await Submission.findOne({ assignmentId, studentId });
        if (submission) {
            return res.status(400).json({ message: 'You have already submitted this assignment.' });
        }

        // Check if deadline passed
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        if (new Date() > new Date(assignment.dueDate)) {
            return res.status(400).json({ message: 'Deadline has passed. Submission rejected.' });
        }

        submission = new Submission({
            assignmentId,
            studentId,
            content: content || '',
            fileUrl
        });

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
