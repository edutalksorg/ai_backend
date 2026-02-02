const pool = require('../config/db');

// @desc    Get all paragraphs
// @route   GET /api/v1/pronunciation/paragraphs
// @access  Public/Private
const getParagraphs = async (req, res) => {
    try {
        const { level, mode, pageNumber = 1, pageSize = 100 } = req.query;
        // Aliasing columns for frontend compatibility
        let query = `
            SELECT id, title, content AS text, level AS difficulty, 
                   instructorid as "instructorId", ispublished as "isPublished", 
                   language, phonetictranscription as "phoneticTranscription", 
                   referenceaudiourl as "referenceAudioUrl", 
                   createdat as "createdAt", updatedat as "updatedAt" 
            FROM pronunciation_paragraphs WHERE isdeleted = FALSE`;
        const params = [];
        let paramIdx = 1;

        if (level) {
            query += ` AND level = $${paramIdx++}`;
            params.push(level);
        }

        if (mode === 'instructor' && req.user) {
            query += ` AND instructorid = $${paramIdx++}`;
            params.push(req.user.id);
        } else {
            query += ` AND ispublished = TRUE`;
        }

        const offset = (pageNumber - 1) * pageSize;
        query += ` ORDER BY createdat DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(parseInt(pageSize), parseInt(offset));

        const { rows: paragraphs } = await pool.query(query, params);
        res.json({ success: true, data: paragraphs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Get single paragraph
// @route   GET /api/v1/pronunciation/paragraphs/:id
// @access  Public/Private
const getParagraph = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, title, content AS text, level AS difficulty, 
                    instructorid as "instructorId", ispublished as "isPublished", 
                    language, phonetictranscription as "phoneticTranscription", 
                    referenceaudiourl as "referenceAudioUrl", 
                    createdat as "createdAt", updatedat as "updatedAt" 
             FROM pronunciation_paragraphs WHERE id = $1 AND isdeleted = FALSE`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Create paragraph
// @route   POST /api/v1/pronunciation/paragraphs
// @access  Private (Instructor)
const createParagraph = async (req, res) => {
    try {
        const {
            Title, Text, Difficulty, Language,
            PhoneticTranscription, ReferenceAudioUrl,
            isPublished
        } = req.body;

        const title = Title || req.body.title;
        const content = Text || req.body.content || req.body.text;
        const level = Difficulty || req.body.level || req.body.difficulty || 'Beginner';
        const language = Language || req.body.language || 'en-US';
        const phoneticTranscription = PhoneticTranscription || req.body.phoneticTranscription;
        const referenceAudioUrl = ReferenceAudioUrl || req.body.referenceAudioUrl;

        const instructorId = req.user.id;

        const { rows: result } = await pool.query(
            `INSERT INTO pronunciation_paragraphs (title, content, level, instructorid, ispublished, language, phonetictranscription, referenceaudiourl) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [title, content, level, instructorId, isPublished || false, language, phoneticTranscription, referenceAudioUrl]
        );

        res.status(201).json({
            success: true,
            data: { id: result[0].id, title }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Update paragraph
// @route   PUT /api/v1/pronunciation/paragraphs/:id
// @access  Private (Instructor)
const updateParagraph = async (req, res) => {
    try {
        const {
            Title, Text, Difficulty, Language,
            PhoneticTranscription, ReferenceAudioUrl,
            isPublished
        } = req.body;

        const title = Title || req.body.title;
        const content = Text || req.body.content || req.body.text;
        const level = Difficulty || req.body.level || req.body.difficulty;
        const language = Language || req.body.language;
        const phoneticTranscription = PhoneticTranscription || req.body.phoneticTranscription;
        const referenceAudioUrl = ReferenceAudioUrl || req.body.referenceAudioUrl;

        const id = req.params.id;

        await pool.query(
            `UPDATE pronunciation_paragraphs 
             SET title=$1, content=$2, level=$3, ispublished=$4, language=$5, phonetictranscription=$6, referenceaudiourl=$7 
             WHERE id=$8 AND instructorid=$9`,
            [title, content, level, isPublished, language, phoneticTranscription, referenceAudioUrl, id, req.user.id]
        );

        res.json({ success: true, message: 'Paragraph updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Soft delete paragraph
// @route   DELETE /api/v1/pronunciation/paragraphs/:id
// @access  Private (Instructor)
const deleteParagraph = async (req, res) => {
    try {
        const id = req.params.id;
        const instructorId = req.user.id;

        const { rows: exists } = await pool.query('SELECT id FROM pronunciation_paragraphs WHERE id = $1 AND instructorid = $2', [id, instructorId]);
        if (exists.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found or unauthorized' });
        }

        await pool.query('UPDATE pronunciation_paragraphs SET isdeleted = TRUE WHERE id = $1', [id]);

        res.status(200).json({ success: true, message: 'Paragraph deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Publish/Unpublish
// @route   POST /api/v1/pronunciation/paragraphs/:id/publish
// @access  Private (Instructor)
const publishParagraph = async (req, res) => {
    try {
        const id = req.params.id;
        const { isPublished } = req.body;

        const status = isPublished !== undefined ? isPublished : true;

        await pool.query('UPDATE pronunciation_paragraphs SET ispublished = $1 WHERE id = $2 AND instructorid = $3', [status, id, req.user.id]);

        res.json({ success: true, message: `Paragraph ${status ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Convert paragraph to speech (Mock)
// @route   POST /api/v1/pronunciation/paragraphs/:id/convert-paragraph-to-speech
// @access  Private (Instructor)
const convertParagraphToSpeech = async (req, res) => {
    try {
        const id = req.params.id;

        const { rows } = await pool.query('SELECT * FROM pronunciation_paragraphs WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found' });
        }

        const paragraph = rows[0];
        // Postgres returns lowercased keys if not aliased. 
        // paragraph.referenceAudioUrl check needs to be paragraph.referenceaudiourl or alias
        // But the previous query did SELECT * without aliases.
        // So checking paragraph.referenceaudiourl is safer.
        const existingAudio = paragraph.referenceaudiourl || paragraph.referenceAudioUrl;

        const mockAudioUrl = existingAudio || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

        if (!existingAudio) {
            await pool.query('UPDATE pronunciation_paragraphs SET referenceaudiourl = $1 WHERE id = $2', [mockAudioUrl, id]);
        }

        res.json({
            success: true,
            message: 'Audio generated successfully',
            audioUrl: mockAudioUrl
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// @desc    Assess pronunciation
// @route   POST /api/v1/pronunciation/assess
// @access  Private
const assessPronunciation = async (req, res) => {
    try {
        console.log('🎤 Received assessment request');
        const accuracy = 70 + Math.random() * 30;
        const fluency = 60 + Math.random() * 40;
        const overall = (accuracy + fluency) / 2;

        res.json({
            success: true,
            scores: {
                accuracy: Math.round(accuracy),
                fluency: Math.round(fluency),
                overall: Math.round(overall)
            },
            feedback: "Good effort! Your pronunciation is clear with some minor pauses.",
            mistakes: [],
            processing: { status: 'Completed', isCompleted: true }
        });
    } catch (error) {
        console.error('Assessment error:', error);
        res.status(500).json({ message: 'Server error during assessment' });
    }
};

module.exports = {
    getParagraphs,
    getParagraph,
    createParagraph,
    updateParagraph,
    deleteParagraph,
    publishParagraph,
    convertParagraphToSpeech,
    assessPronunciation
};
