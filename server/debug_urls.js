const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Submission = require('./models/Submission');
const Assignment = require('./models/Assignment');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        console.log('--- Recent Submissions ---');
        const submissions = await Submission.find().sort({ submittedAt: -1 }).limit(3);
        submissions.forEach(sub => {
            console.log(`ID: ${sub._id}`);
            console.log(`File URL: ${sub.fileUrl}`);
        });

        console.log('\n--- Recent Assignments ---');
        const assignments = await Assignment.find().sort({ createdAt: -1 }).limit(3);
        assignments.forEach(assign => {
            console.log(`ID: ${assign._id}`);
            console.log(`File URL: ${assign.fileUrl}`);
        });

        process.exit();
    })
    .catch(err => console.error(err));
