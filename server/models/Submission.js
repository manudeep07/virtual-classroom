const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        required: true,
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String, // Text or URL
        required: false, // Not required if file is uploaded
    },
    fileUrl: {
        type: String, // Path to uploaded file
    },
    grade: {
        type: Number,
        default: null,
    },
    feedback: {
        type: String,
        default: '',
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Submission', submissionSchema);
