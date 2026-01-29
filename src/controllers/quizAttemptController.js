const pool = require('../config/db');

// @desc    Submit a quiz attempt
// @route   POST /api/v1/quizzes/:id/submit
// @access  Private (Student)
const submitQuiz = async (req, res) => {
    try {
        const userId = req.user.id;
        const quizId = req.params.id;
        const { answers, startedAt } = req.body; // answers: { "0": 1, "1": 3 } (questionIndex: answerIndex) or array

        // 1. Fetch Quiz Questions
        const [quizRows] = await pool.query('SELECT questions FROM quizzes WHERE id = ?', [quizId]);
        if (quizRows.length === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const questions = quizRows[0].questions; // MySQL JSON type is automatically parsed by mysql2 usually, or might need JSON.parse
        const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;

        let correctCount = 0;
        let totalQuestions = parsedQuestions.length;

        // 2. Calculate Score
        // Assume answers is an object where key is question index and value is selected option index
        // Or answers is an array matching questions

        parsedQuestions.forEach((q, index) => {
            const userAns = answers[index] || answers[index.toString()];
            // Compare loose or strict? Assuming 0-based index for options
            if (userAns !== undefined && userAns == q.correctAnswer) {
                correctCount++;
            }
        });

        const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

        // 3. Save Attempt
        const [result] = await pool.query(
            'INSERT INTO quiz_attempts (userId, quizId, score, totalQuestions, correctAnswers, answers, startedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, quizId, score, totalQuestions, correctCount, JSON.stringify(answers), startedAt || new Date()]
        );

        // 4. Update User Progress (Optional, but good for logic)
        // await pool.query('INSERT INTO user_progress ... ON DUPLICATE KEY UPDATE ...');

        res.json({
            success: true,
            data: {
                attemptId: result.insertId,
                score,
                totalQuestions,
                correctAnswers: correctCount,
                passed: score >= 60 // Threshold example
            }
        });

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
        const { id: quizId, attemptId } = req.params;
        const userId = req.user.id;

        const [rows] = await pool.query(
            'SELECT * FROM quiz_attempts WHERE id = ? AND quizId = ?',
            [attemptId, quizId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        const attempt = rows[0];

        // Security check: only own attempts or instructor/admin
        if (attempt.userId !== userId && req.user.role === 'Student') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json({ success: true, data: attempt });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get all attempts for a quiz (History)
// @route   GET /api/v1/quizzes/:id/attempts
// @access  Private
const getQuizAttempts = async (req, res) => {
    try {
        const quizId = req.params.id;
        const userId = req.user.id;

        const [rows] = await pool.query(
            'SELECT * FROM quiz_attempts WHERE quizId = ? AND userId = ? ORDER BY completedAt DESC',
            [quizId, userId]
        );

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    submitQuiz,
    getAttemptDetails,
    getQuizAttempts
};
