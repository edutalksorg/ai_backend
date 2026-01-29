const pool = require('../config/db');

// @desc    Get all paragraphs (public/student view) or instructor view
// @route   GET /api/v1/pronunciation/paragraphs
// @access  Public/Private
const getParagraphs = async (req, res) => {
    try {
        const { level, mode, pageNumber = 1, pageSize = 100 } = req.query;
        // Alias content as text and level as difficulty to match frontend naming
        let query = 'SELECT id, title, content AS text, level AS difficulty, instructorId, isPublished, language, phoneticTranscription, referenceAudioUrl, createdAt, updatedAt FROM pronunciation_paragraphs WHERE isDeleted = FALSE';
        const params = [];

        // Filter by level if provided
        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }

        // Instructor mode: Show only their own paragraphs (even unpublished, but NOT deleted)
        if (mode === 'instructor' && req.user) {
            query += ' AND instructorId = ?';
            params.push(req.user.id);
        } else {
            // Student/Public: Show only published
            query += ' AND isPublished = TRUE';
        }

        // Pagination
        const offset = (pageNumber - 1) * pageSize;
        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(pageSize), parseInt(offset));

        const [paragraphs] = await pool.query(query, params);
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
        const [rows] = await pool.query(
            'SELECT id, title, content AS text, level AS difficulty, instructorId, isPublished, language, phoneticTranscription, referenceAudioUrl, createdAt, updatedAt FROM pronunciation_paragraphs WHERE id = ? AND isDeleted = FALSE',
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

        // Handle both camelCase (internal) and PascalCase (frontend payload)
        const title = Title || req.body.title;
        const content = Text || req.body.content || req.body.text;
        const level = Difficulty || req.body.level || req.body.difficulty || 'Beginner';
        const language = Language || req.body.language || 'en-US';
        const phoneticTranscription = PhoneticTranscription || req.body.phoneticTranscription;
        const referenceAudioUrl = ReferenceAudioUrl || req.body.referenceAudioUrl;

        const instructorId = req.user.id;

        const [result] = await pool.query(
            'INSERT INTO pronunciation_paragraphs (title, content, level, instructorId, isPublished, language, phoneticTranscription, referenceAudioUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, content, level, instructorId, isPublished || false, language, phoneticTranscription, referenceAudioUrl]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, title }
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
            'UPDATE pronunciation_paragraphs SET title=?, content=?, level=?, isPublished=?, language=?, phoneticTranscription=?, referenceAudioUrl=? WHERE id=? AND instructorId=?',
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

        // Verify ownership first
        const [exists] = await pool.query('SELECT id FROM pronunciation_paragraphs WHERE id = ? AND instructorId = ?', [id, instructorId]);
        if (exists.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found or unauthorized' });
        }

        // PERFORM SOFT DELETE
        await pool.query('UPDATE pronunciation_paragraphs SET isDeleted = TRUE WHERE id = ?', [id]);

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
        const { isPublished } = req.body; // Expect boolean from body

        // Use provided status, default to true if not provided (backward compatibility)
        const status = isPublished !== undefined ? isPublished : true;

        await pool.query('UPDATE pronunciation_paragraphs SET isPublished = ? WHERE id = ? AND instructorId = ?', [status, id, req.user.id]);

        res.json({ success: true, message: `Paragraph ${status ? 'published' : 'unpublished'} successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Convert paragraph to speech (Mock/Placeholder)
// @route   POST /api/v1/pronunciation/paragraphs/:id/convert-paragraph-to-speech
// @access  Private (Instructor)
const convertParagraphToSpeech = async (req, res) => {
    try {
        const id = req.params.id;

        // Check if paragraph exists
        const [rows] = await pool.query('SELECT * FROM pronunciation_paragraphs WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found' });
        }

        const paragraph = rows[0];

        // MOCK TTS: In a real app, this would call Google/AWS/Azure TTS API
        // For now, we return a success with a placeholder URL or the referenced one
        const mockAudioUrl = paragraph.referenceAudioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

        // Update with mock URL if none exists
        if (!paragraph.referenceAudioUrl) {
            await pool.query('UPDATE pronunciation_paragraphs SET referenceAudioUrl = ? WHERE id = ?', [mockAudioUrl, id]);
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
        // Mock assessment logic
        // In a real app, this would send the audio to a speech assessment API

        // Randomly generate scores for demo purposes
        const accuracy = 70 + Math.random() * 30; // 70-100
        const fluency = 60 + Math.random() * 40;  // 60-100
        const overall = (accuracy + fluency) / 2;

        res.json({
            success: true,
            scores: {
                accuracy: Math.round(accuracy),
                fluency: Math.round(fluency),
                overall: Math.round(overall)
            },
            feedback: "Good effort! Your pronunciation is clear with some minor pauses.",
            mistakes: [], // Can populate with mock words if needed
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
