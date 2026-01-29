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
        } else if (role !== 'Admin' && role !== 'SuperAdmin') {
            // For Learners/Users, show only published topics
            query += ' WHERE status = ?';
            params.push('published');
        }

        const [topics] = await pool.query(query, params);
        res.json({ success: true, data: topics });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get topic by id
// @route   GET /api/v1/topics/:id
// @access  Private
const getTopicById = async (req, res) => {
    try {
        const [topics] = await pool.query('SELECT * FROM topics WHERE id = ?', [req.params.id]);
        if (topics.length === 0) {
            return res.status(404).json({ message: 'Topic not found' });
        }

        // Parse JSON fields
        const topic = topics[0];
        if (topic.vocabularyList && typeof topic.vocabularyList === 'string') {
            topic.vocabularyList = JSON.parse(topic.vocabularyList);
        }
        if (topic.discussionPoints && typeof topic.discussionPoints === 'string') {
            topic.discussionPoints = JSON.parse(topic.discussionPoints);
        }

        res.json({ success: true, data: topic });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Get all categories
// @route   GET /api/v1/topics/categories
// @access  Private
const getCategories = async (req, res) => {
    try {
        // Since there is no categories table yet, return some defaults
        const categories = [
            { id: 'General Conversation', name: 'General Conversation' },
            { id: 'Business English', name: 'Business English' },
            { id: 'Travel', name: 'Travel' }
        ];
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createTopic = async (req, res) => {
    try {
        const { title, description, content, category, difficulty, estimatedTime, status, imageUrl, vocabularyList, discussionPoints } = req.body;
        const instructorId = req.user.id;

        const [result] = await pool.query(
            'INSERT INTO topics (title, description, content, category, difficulty, estimatedTime, status, imageUrl, vocabularyList, discussionPoints, instructorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, content || '', category || 'General', difficulty || 'Beginner', estimatedTime || 15, status || 'draft', imageUrl || null, JSON.stringify(vocabularyList || []), JSON.stringify(discussionPoints || []), instructorId]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, title },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Update a topic
// @route   PUT /api/v1/topics/:id
// @access  Private (Instructor/Admin)
const updateTopic = async (req, res) => {
    try {
        const { title, description, content, category, difficulty, estimatedTime, status, imageUrl, vocabularyList, discussionPoints } = req.body;
        const topicId = req.params.id;

        await pool.query(
            'UPDATE topics SET title=?, description=?, content=?, category=?, difficulty=?, estimatedTime=?, status=?, imageUrl=?, vocabularyList=?, discussionPoints=? WHERE id=?',
            [title, description, content, category, difficulty, estimatedTime, status, imageUrl, JSON.stringify(vocabularyList || []), JSON.stringify(discussionPoints || []), topicId]
        );

        res.json({ success: true, message: 'Topic updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
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

        let query = 'SELECT * FROM quizzes WHERE isDeleted = FALSE';
        let params = [];

        if (role === 'Instructor') {
            query += ' AND instructorId = ?';
            params.push(userId);
        } else if (role !== 'Admin' && role !== 'SuperAdmin') {
            // For Learners/Users, show only published quizzes
            query += ' AND isPublished = TRUE';
        }

        const [quizzes] = await pool.query(query, params);
        res.json({ success: true, data: quizzes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get quiz by ID
// @route   GET /api/v1/quizzes/:id
// @access  Private
const getQuizById = async (req, res) => {
    try {
        const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ? AND isDeleted = FALSE', [req.params.id]);
        if (quizzes.length === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const quiz = quizzes[0];
        if (quiz.questions && typeof quiz.questions === 'string') {
            quiz.questions = JSON.parse(quiz.questions);
        }

        res.json({ success: true, data: quiz });
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
        const {
            title, description, topicId, questions, duration, difficulty,
            isPublished, categoryId, passingScore, timeLimitMinutes,
            randomizeQuestions, maxAttempts, showCorrectAnswers
        } = req.body;
        const instructorId = req.user.id;

        const [result] = await pool.query(
            `INSERT INTO quizzes (
                title, description, topicId, questions, duration, difficulty, 
                isPublished, instructorId, categoryId, passingScore, 
                timeLimitMinutes, randomizeQuestions, maxAttempts, showCorrectAnswers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title, description, topicId || null, JSON.stringify(questions || []),
                duration || 30, difficulty || 'Beginner', isPublished || false,
                instructorId, categoryId || null, passingScore || 60,
                timeLimitMinutes || duration || 20, randomizeQuestions ?? true,
                maxAttempts || 2, showCorrectAnswers ?? true
            ]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, title },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Update quiz
// @route   PUT /api/v1/quizzes/:id
// @access  Private (Instructor)
const updateQuiz = async (req, res) => {
    try {
        const {
            title, description, questions, duration, difficulty,
            isPublished, isDeleted, categoryId, passingScore,
            timeLimitMinutes, randomizeQuestions, maxAttempts, showCorrectAnswers
        } = req.body;
        const quizId = req.params.id;

        await pool.query(
            `UPDATE quizzes SET 
                title=?, description=?, questions=?, duration=?, difficulty=?, 
                isPublished=?, isDeleted=?, categoryId=?, passingScore=?, 
                timeLimitMinutes=?, randomizeQuestions=?, maxAttempts=?, showCorrectAnswers=? 
            WHERE id=?`,
            [
                title, description, JSON.stringify(questions), duration, difficulty,
                isPublished, isDeleted || false, categoryId, passingScore,
                timeLimitMinutes, randomizeQuestions, maxAttempts, showCorrectAnswers,
                quizId
            ]
        );

        res.json({ success: true, message: 'Quiz updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
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

// @desc    Delete quiz (soft delete)
// @route   DELETE /api/v1/quizzes/:id
// @access  Private (Instructor)
const deleteQuiz = async (req, res) => {
    try {
        const quizId = req.params.id;
        await pool.query('UPDATE quizzes SET isDeleted = TRUE WHERE id = ?', [quizId]);
        res.json({ success: true, message: 'Quiz deleted successfully' });
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
    getTopicById,
    getCategories,
    createTopic,
    updateTopic,
    updateTopicStatus,
    deleteTopic,
    getQuizzes,
    getQuizById,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    toggleQuizPublish,
    getInstructorStats,
};