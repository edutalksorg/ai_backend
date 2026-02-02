const pool = require('../config/db');

// @desc    Start a quiz attempt
// @route   POST /api/v1/quizzes/:id/start
// @access  Private
const startQuiz = async (req, res) => {
    try {
        const quizId = req.params.id;
        const userId = req.user.id;

        const { rows: result } = await pool.query(
            'INSERT INTO quiz_attempts (quizid, userid, startedat) VALUES ($1, $2, NOW()) RETURNING id',
            [quizId, userId]
        );

        res.status(201).json({
            success: true,
            data: {
                attemptId: result[0].id
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Submit quiz answers and calculate score
// @route   POST /api/v1/quizzes/:id/submit
// @access  Private
const submitQuiz = async (req, res) => {
    try {
        const quizId = req.params.id;
        const userId = req.user.id;
        const { answers, attemptId } = req.body; // answers: [{ questionId, selectedOption }]

        // 1. Get Quiz Questions (Correct Answers)
        // questions is JSONB
        const { rows: quizData } = await pool.query('SELECT questions FROM quizzes WHERE id = $1', [quizId]);

        if (quizData.length === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Postgres returns parsed JSON/Object for JSONB columns automatically
        let quizQuestions = quizData[0].questions;
        // If for some reason it's a string (e.g. TEXT column), parse it.
        // But for JSONB it is object.
        if (typeof quizQuestions === 'string') {
            try { quizQuestions = JSON.parse(quizQuestions); } catch (e) { }
        }

        // 2. Calculate Score
        let correctCount = 0;
        let totalQuestions = quizQuestions.length;

        quizQuestions.forEach(question => {
            const userAnswer = answers.find(a => a.questionId === question.id);
            if (userAnswer && userAnswer.selectedOption === question.correctAnswer) {
                correctCount++;
            }
        });

        const score = Math.round((correctCount / totalQuestions) * 100);
        const passed = score >= 70; // Pass mark 70%

        // 3. Update Attempt or Create New (if simple submit without start)
        if (attemptId) {
            await pool.query(
                'UPDATE quiz_attempts SET score = $1, answers = $2, completedat = NOW() WHERE id = $3',
                [score, JSON.stringify(answers), attemptId]
            );
        } else {
            // Standalone submit
            await pool.query(
                'INSERT INTO quiz_attempts (quizid, userid, score, answers, startedat, completedat) VALUES ($1, $2, $3, $4, NOW(), NOW())',
                [quizId, userId, score, JSON.stringify(answers)]
            );
        }

        res.json({
            success: true,
            data: {
                score,
                passed,
                correctCount,
                totalQuestions
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attempt history
// @route   GET /api/v1/quizzes/attempts
// @access  Private
const getAttempts = async (req, res) => {
    try {
        const userId = req.user.id;
        // Aliasing camelCase columns
        const { rows: attempts } = await pool.query(`
            SELECT qa.id, qa.score, qa.completedat as "completedAt", q.title as "quizTitle"
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quizid = q.id
            WHERE qa.userid = $1 AND qa.completedat IS NOT NULL
            ORDER BY qa.completedat DESC
        `, [userId]);

        res.json({ success: true, data: attempts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attempts for a specific quiz
// @route   GET /api/v1/quizzes/:id/attempts
// @access  Private
const getQuizAttempts = async (req, res) => {
    try {
        const userId = req.user.id;
        const quizId = req.params.id;

        const { rows: attempts } = await pool.query(
            `SELECT qa.id, qa.score, qa.completedat as "completedAt", q.title as "quizTitle"
             FROM quiz_attempts qa
             JOIN quizzes q ON qa.quizid = q.id
             WHERE qa.userid = $1 AND qa.quizid = $2 AND qa.completedat IS NOT NULL
             ORDER BY qa.completedat DESC`,
            [userId, quizId]
        );

        res.json({ success: true, data: attempts });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get attempt details
// @route   GET /api/v1/quizzes/:id/attempts/:attemptId
// @access  Private
const getAttemptDetails = async (req, res) => {
    try {
        const attemptId = req.params.attemptId;
        const userId = req.user.id; // Optional security check: ensure user owns attempt

        const { rows: attempts } = await pool.query(
            `SELECT qa.*, q.title as "quizTitle", q.questions
             FROM quiz_attempts qa
             JOIN quizzes q ON qa.quizid = q.id
             WHERE qa.id = $1 AND qa.userid = $2`,
            [attemptId, userId]
        );

        if (attempts.length === 0) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        const attempt = attempts[0];
        // Parse answers if string (JSONB is object)
        if (typeof attempt.answers === 'string') {
            try { attempt.answers = JSON.parse(attempt.answers); } catch (e) { }
        }
        // questions is JSONB
        if (typeof attempt.questions === 'string') {
            try { attempt.questions = JSON.parse(attempt.questions); } catch (e) { }
        }

        res.json({ success: true, data: attempt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    startQuiz,
    submitQuiz,
    getAttempts,
    getQuizAttempts,
    getAttemptDetails
};
