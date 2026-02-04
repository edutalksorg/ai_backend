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
        let paramIdx = 1;

        if (role === 'Instructor') {
            query += ` WHERE instructorid = $${paramIdx++}`;
            params.push(userId);
        } else if (role !== 'Admin' && role !== 'SuperAdmin') {
            // For Learners/Users, show only published topics
            query += ` WHERE status = $${paramIdx++}`;
            params.push('published');
        }

        const { rows: topics } = await pool.query(query, params);
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
        const { rows: topics } = await pool.query('SELECT * FROM topics WHERE id = $1', [req.params.id]);
        if (topics.length === 0) {
            return res.status(404).json({ message: 'Topic not found' });
        }

        const topic = topics[0];
        // JSONB columns are automatically parsed by pg
        // But if they are string (e.g. TEXT), parse. 
        // Safer to check type.
        if (topic.vocabularyList && typeof topic.vocabularyList === 'string') {
            try { topic.vocabularyList = JSON.parse(topic.vocabularyList); } catch (e) { }
        }
        // Actually, vocabularyList is aliased to vocabularyList in PG? No.
        // Casing check: vocabularyList int model -> vocabularylist in db.
        // So topic.vocabularylist.
        // I should stick to mapping or alias.
        // Given I used SELECT *, I get lowercase.
        // I will map manually for consistency.
        const mappedTopic = {
            ...topic,
            vocabularyList: topic.vocabularylist || topic.vocabularyList,
            discussionPoints: topic.discussionpoints || topic.discussionPoints,
            instructorId: topic.instructorid || topic.instructorId,
            imageUrl: topic.imageurl || topic.imageUrl,
            estimatedTime: topic.estimatedtime || topic.estimatedTime,
            createdAt: topic.createdat || topic.createdAt,
            updatedAt: topic.updatedat || topic.updatedAt,
            grammarData: topic.grammardata || topic.grammarData
        };

        if (typeof mappedTopic.vocabularyList === 'string') try { mappedTopic.vocabularyList = JSON.parse(mappedTopic.vocabularyList); } catch (e) { }
        if (typeof mappedTopic.discussionPoints === 'string') try { mappedTopic.discussionPoints = JSON.parse(mappedTopic.discussionPoints); } catch (e) { }
        if (typeof mappedTopic.grammarData === 'string') try { mappedTopic.grammarData = JSON.parse(mappedTopic.grammarData); } catch (e) { }

        res.json({ success: true, data: mappedTopic });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

const getCategories = async (req, res) => {
    try {
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
        const { title, description, content, category, difficulty, estimatedTime, status, imageUrl, vocabularyList, discussionPoints, grammarData } = req.body;
        const instructorId = req.user.id;

        const { rows: result } = await pool.query(
            `INSERT INTO topics (title, description, content, category, difficulty, estimatedtime, status, imageurl, vocabularylist, discussionpoints, instructorid, grammardata) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [title, description, content || '', category || 'General', difficulty || 'Beginner', estimatedTime || 15, status || 'draft', imageUrl || null, JSON.stringify(vocabularyList || []), JSON.stringify(discussionPoints || []), instructorId, JSON.stringify(grammarData || {})]
        );

        res.status(201).json({
            success: true,
            data: { id: result[0].id, title },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

const updateTopic = async (req, res) => {
    try {
        const { title, description, content, category, difficulty, estimatedTime, status, imageUrl, vocabularyList, discussionPoints, grammarData } = req.body;
        const topicId = req.params.id;

        await pool.query(
            `UPDATE topics SET title=$1, description=$2, content=$3, category=$4, difficulty=$5, estimatedtime=$6, status=$7, imageurl=$8, vocabularylist=$9, discussionpoints=$10, grammardata=$11 WHERE id=$12`,
            [title, description, content, category, difficulty, estimatedTime, status, imageUrl, JSON.stringify(vocabularyList || []), JSON.stringify(discussionPoints || []), JSON.stringify(grammarData || {}), topicId]
        );

        res.json({ success: true, message: 'Topic updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

const updateTopicStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const topicId = req.params.id;

        await pool.query('UPDATE topics SET status = $1 WHERE id = $2', [status, topicId]);

        res.json({ success: true, message: `Topic status updated to ${status}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteTopic = async (req, res) => {
    try {
        await pool.query('DELETE FROM topics WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Topic deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Quiz Management ---

const getQuizzes = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let query = 'SELECT * FROM quizzes WHERE isdeleted = FALSE';
        let params = [];
        let paramIdx = 1;

        if (role === 'Instructor') {
            query += ` AND instructorid = $${paramIdx++}`;
            params.push(userId);
        } else if (role !== 'Admin' && role !== 'SuperAdmin') {
            query += ` AND ispublished = TRUE`;
        }

        const { rows: quizzes } = await pool.query(query, params);
        res.json({ success: true, data: quizzes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getQuizById = async (req, res) => {
    try {
        const { rows: quizzes } = await pool.query('SELECT * FROM quizzes WHERE id = $1 AND isdeleted = FALSE', [req.params.id]);
        if (quizzes.length === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const quiz = quizzes[0];
        // quiz.questions -> jsonb
        if (quiz.questions && typeof quiz.questions === 'string') {
            try { quiz.questions = JSON.parse(quiz.questions); } catch (e) { }
        }

        res.json({ success: true, data: quiz });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createQuiz = async (req, res) => {
    try {
        const {
            title, description, topicId, questions, duration, difficulty,
            isPublished, categoryId, passingScore, timeLimitMinutes,
            randomizeQuestions, maxAttempts, showCorrectAnswers
        } = req.body;
        const instructorId = req.user.id;

        const { rows: result } = await pool.query(
            `INSERT INTO quizzes (
                title, description, topicid, questions, duration, difficulty, 
                ispublished, instructorid, categoryid, passingscore, 
                timelimitminutes, randomizequestions, maxattempts, showcorrectanswers
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
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
            data: { id: result[0].id, title },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

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
                title=$1, description=$2, questions=$3, duration=$4, difficulty=$5, 
                ispublished=$6, isdeleted=$7, categoryid=$8, passingscore=$9, 
                timelimitminutes=$10, randomizequestions=$11, maxattempts=$12, showcorrectanswers=$13 
            WHERE id=$14`,
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

const toggleQuizPublish = async (req, res) => {
    try {
        const { isPublished } = req.body;
        const quizId = req.params.id;

        console.log(`[toggleQuizPublish] Request for Quiz ID: ${quizId}, Body:`, req.body);

        // Explicit boolean casting
        const publishedState = isPublished === true || String(isPublished) === 'true';

        console.log(`[toggleQuizPublish] Setting isPublished to: ${publishedState}`);

        await pool.query('UPDATE quizzes SET ispublished = $1 WHERE id = $2', [publishedState, quizId]);

        res.json({ success: true, message: `Quiz ${publishedState ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error('[toggleQuizPublish] Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteQuiz = async (req, res) => {
    try {
        const quizId = req.params.id;
        await pool.query('UPDATE quizzes SET isdeleted = TRUE WHERE id = $1', [quizId]);
        res.json({ success: true, message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getInstructorStats = async (req, res) => {
    try {
        const instructorId = req.user.id;

        const { rows: topics } = await pool.query(
            'SELECT COUNT(*) as count FROM topics WHERE instructorid = $1',
            [instructorId]
        );

        const { rows: enrollments } = await pool.query(
            'SELECT COUNT(DISTINCT userid as "userId") as count FROM user_progress up JOIN topics t ON up.topicid = t.id WHERE t.instructorid = $1',
            [instructorId]
        );

        res.json({
            success: true,
            data: {
                totalTopics: parseInt(topics[0].count),
                totalStudents: parseInt(enrollments[0].count),
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