const cron = require('node-cron');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');

// Run every minute
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        // Find assignments where dueDate is in the past
        const expiredAssignments = await Assignment.find({ dueDate: { $lt: now } });

        if (expiredAssignments.length > 0) {
            console.log(`[Cron] Found ${expiredAssignments.length} expired assignments.`);

            for (const assignment of expiredAssignments) {
                // Delete associated submissions
                await Submission.deleteMany({ assignmentId: assignment._id });
                // Delete the assignment itself
                await Assignment.findByIdAndDelete(assignment._id);

                console.log(`[Cron] Deleted expired assignment: ${assignment.title} (${assignment._id})`);

            }
        }
    } catch (err) {
        console.error('[Cron] Error in cleanup job:', err);
    }
});
