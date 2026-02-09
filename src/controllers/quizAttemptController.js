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

        // 1. Get Quiz Questions and Passing Score
        const { rows: quizData } = await pool.query('SELECT questions, passingScore FROM quizzes WHERE id = $1', [quizId]);

        if (quizData.length === 0) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        let quizQuestions = quizData[0].questions;
        const passingScore = quizData[0].passingscore || 60; // Default to 60 if not set

        if (typeof quizQuestions === 'string') {
            try { quizQuestions = JSON.parse(quizQuestions); } catch (e) { }
        }

        // 2. Calculate Score
        let correctCount = 0;
        let totalQuestions = quizQuestions.length;

        console.log(`[Quiz Scoring] Quiz ID: ${quizId}, User ID: ${userId}, Total Questions: ${totalQuestions}`);

        quizQuestions.forEach((question, index) => {
            let userAnswer = answers.find(a => a.questionId === (question.id || question._id || String(index)));

            // Fallback: match by index if ID match failed
            if (!userAnswer) {
                userAnswer = answers.find(a => String(a.questionId) === String(index));
            }

            if (userAnswer) {
                const submitted = String(userAnswer.selectedOption);
                const correctRef = question.correctAnswer;

                let isCorrect = false;

                // If correctAnswer is an index (number or numeric string) and options exist
                if (Array.isArray(question.options) &&
                    (typeof correctRef === 'number' || (!isNaN(Number(correctRef)) && String(Number(correctRef)) === String(correctRef)))) {
                    const correctOptionValue = String(question.options[Number(correctRef)]);
                    isCorrect = submitted === correctOptionValue;
                    console.log(`  Q${index + 1}: Index-based. Correct: "${correctOptionValue}", Submitted: "${submitted}" -> ${isCorrect ? '✓' : '✗'}`);
                } else {
                    // Fallback to direct string comparison if it's not an index
                    isCorrect = submitted === String(correctRef);
                    console.log(`  Q${index + 1}: Text-based. Correct: "${correctRef}", Submitted: "${submitted}" -> ${isCorrect ? '✓' : '✗'}`);
                }

                if (isCorrect) {
                    correctCount++;
                }
            } else {
                console.log(`  Q${index + 1}: No answer submitted`);
            }
        });

        console.log(`[Quiz Scoring] Result: ${correctCount}/${totalQuestions} correct (${Math.round((correctCount / totalQuestions) * 100)}%)`);


        const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        const passed = score >= passingScore;

        // 3. Update Attempt or Create New (if simple submit without start)
        let finalAttemptId = attemptId;
        if (attemptId) {
            await pool.query(
                'UPDATE quiz_attempts SET score = $1, answers = $2, completedat = NOW() WHERE id = $3',
                [score, JSON.stringify(answers), attemptId]
            );
        } else {
            // Standalone submit
            const { rows: newAttempt } = await pool.query(
                'INSERT INTO quiz_attempts (quizid, userid, score, answers, startedat, completedat) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id',
                [quizId, userId, score, JSON.stringify(answers)]
            );
            finalAttemptId = newAttempt[0].id;
        }

        // 4. Update User Progress if passed and topic exists
        const topicId = quizData[0].topicid;
        if (passed && topicId) {
            try {
                // Check if progress exists
                const { rows: progress } = await pool.query(
                    'SELECT id FROM user_progress WHERE userId = $1 AND topicId = $2',
                    [userId, topicId]
                );

                if (progress.length > 0) {
                    await pool.query(
                        'UPDATE user_progress SET status = $1, completedAt = NOW(), progressPercentage = 100 WHERE id = $2',
                        ['completed', progress[0].id]
                    );
                } else {
                    await pool.query(
                        'INSERT INTO user_progress (userId, topicId, status, completedAt, progressPercentage) VALUES ($1, $2, $3, NOW(), 100)',
                        [userId, topicId, 'completed']
                    );
                }
            } catch (err) {
                console.error('Failed to update user progress:', err);
                // Non-fatal, continue response
            }
        }

        res.json({
            success: true,
            data: {
                id: finalAttemptId,
                score,
                passed,
                passingScore,
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
            `SELECT qa.id, qa.score, qa.answers, qa.completedat as "completedAt", 
                    q.title as "quizTitle", q.questions, q.passingscore as "passingScore"
             FROM quiz_attempts qa
             JOIN quizzes q ON qa.quizid = q.id
             WHERE qa.id = $1 AND qa.userid = $2`,
            [attemptId, userId]
        );

        if (attempts.length === 0) {
            return res.status(404).json({ message: 'Attempt not found' });
        }

        const attempt = attempts[0];
        // Ensure CamelCase keys for logic
        attempt.passed = attempt.score >= (attempt.passingScore || 60);

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
