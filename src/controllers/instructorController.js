const pool = require('../config/db');

// --- Topic Management ---

// @desc    Get instructor's topics
// @route   GET /api/v1/topics
// @access  Private (Instructor/Admin/SuperAdmin)
const getTopics = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = 'SELECT * FROM topics';
        let params = [];

        if (role === 'Instructor') {
            query += ' WHERE instructorId = ?';
            params.push(userId);
        }

        const [topics] = await pool.query(query, params);
        res.json({ success: true, data: topics });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a new topic
// @route   POST /api/v1/topics
// @access  Private (Instructor)
const createTopic = async (req, res) => {
    try {
        const { title, description, content, category, difficulty, estimatedTime, status } = req.body;
        const instructorId = req.user.id;

        const [result] = await pool.query(
            'INSERT INTO topics (title, description, content, category, difficulty, estimatedTime, status, instructorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, content || '', category || 'General', difficulty || 'Beginner', estimatedTime || 15, status || 'draft', instructorId]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, title },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update topic status
// @route   PATCH /api/v1/topics/:id/status
// @access  Private (Instructor/Admin)
const updateTopicStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const topicId = req.params.id;

        await pool.query('UPDATE topics SET status = ? WHERE id = ?', [status, topicId]);

        res.json({ success: true, message: `Topic status updated to ${status}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete topic
// @route   DELETE /api/v1/topics/:id
// @access  Private (Instructor/Admin)
const deleteTopic = async (req, res) => {
    try {
        await pool.query('DELETE FROM topics WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Topic deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Quiz Management ---

// @desc    Get instructor's quizzes
// @route   GET /api/v1/quizzes
// @access  Private (Instructor/Admin/SuperAdmin)
const getQuizzes = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = 'SELECT * FROM quizzes';
        let params = [];

        if (role === 'Instructor') {
            query += ' WHERE instructorId = ?';
            params.push(userId);
        }

        const [quizzes] = await pool.query(query, params);
        res.json({ success: true, data: quizzes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create a new quiz
// @route   POST /api/v1/quizzes
// @access  Private (Instructor)
const createQuiz = async (req, res) => {
    try {
        const { title, description, topicId, questions, duration, difficulty, isPublished } = req.body;
        const instructorId = req.user.id;

        const [result] = await pool.query(
            'INSERT INTO quizzes (title, description, topicId, questions, duration, difficulty, isPublished, instructorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, topicId || null, JSON.stringify(questions || []), duration || 30, difficulty || 'Beginner', isPublished || false, instructorId]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, title },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update quiz
// @route   PUT /api/v1/quizzes/:id
// @access  Private (Instructor)
const updateQuiz = async (req, res) => {
    try {
        const { title, description, questions, duration, difficulty, isPublished, isDeleted } = req.body;
        const quizId = req.params.id;

        await pool.query(
            'UPDATE quizzes SET title=?, description=?, questions=?, duration=?, difficulty=?, isPublished=?, isDeleted=? WHERE id=?',
            [title, description, JSON.stringify(questions), duration, difficulty, isPublished, isDeleted || false, quizId]
        );

        res.json({ success: true, message: 'Quiz updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Publish/Unpublish quiz
// @route   PATCH /api/v1/quizzes/:id/publish
// @access  Private (Instructor)
const toggleQuizPublish = async (req, res) => {
    try {
        const { isPublished } = req.body;
        const quizId = req.params.id;

        await pool.query('UPDATE quizzes SET isPublished = ? WHERE id = ?', [isPublished, quizId]);

        res.json({ success: true, message: `Quiz ${isPublished ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Analytics ---

// @desc    Get instructor stats
// @route   GET /api/v1/users/instructor-stats
// @access  Private (Instructor)
const getInstructorStats = async (req, res) => {
    try {
        const instructorId = req.user.id;

        const [topics] = await pool.query(
            'SELECT COUNT(*) as count FROM topics WHERE instructorId = ?',
            [instructorId]
        );

        const [enrollments] = await pool.query(
            'SELECT COUNT(DISTINCT userId) as count FROM user_progress up JOIN topics t ON up.topicId = t.id WHERE t.instructorId = ?',
            [instructorId]
        );

        res.json({
            success: true,
            data: {
                totalTopics: topics[0].count,
                totalStudents: enrollments[0].count,
                rating: 4.5,
                revenue: 0,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getTopics,
    createTopic,
    updateTopicStatus,
    deleteTopic,
    getQuizzes,
    createQuiz,
    updateQuiz,
    toggleQuizPublish,
    getInstructorStats,
};

