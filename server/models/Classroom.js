const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    studentIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    code: {
        type: String,
        unique: true,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    sessionEndTime: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Classroom', classroomSchema);
