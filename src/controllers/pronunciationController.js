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
        query += ` ORDER BY createdat ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(parseInt(pageSize), parseInt(offset));

        const { rows: paragraphs } = await pool.query(query, params);
        console.log(`[DEBUG] getParagraphs found ${paragraphs.length} items:`, paragraphs.map(p => ({ id: p.id, title: p.title, published: p.isPublished })));
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

// Helper: Levenshtein Distance for words
const levenshteinDistance = (arr1, arr2) => {
    const matrix = [];
    for (let i = 0; i <= arr1.length; i++) matrix[i] = [i];
    for (let j = 0; j <= arr2.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= arr1.length; i++) {
        for (let j = 1; j <= arr2.length; j++) {
            if (arr1[i - 1] === arr2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[arr1.length][arr2.length];
};

const calculateAccuracy = (original, transcript) => {
    if (!original || !transcript) return 0;

    // Normalize: lowercase, remove punctuation, split by space
    const clean = (str) => str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim().split(" ");

    const originalWords = clean(original);
    const transcriptWords = clean(transcript);

    if (originalWords.length === 0) return 0;

    const distance = levenshteinDistance(originalWords, transcriptWords);
    const maxLength = Math.max(originalWords.length, transcriptWords.length);

    // Accuracy = (1 - distance / max length) * 100
    const accuracy = Math.max(0, (1 - distance / maxLength) * 100);
    return accuracy;
};

// @desc    Assess pronunciation
// @route   POST /api/v1/pronunciation/assess
// @access  Private
const assessPronunciation = async (req, res) => {
    try {
        console.log('🎤 Received assessment request');
        // Handle both JSON (transcript) and FormData (if we were parsing it, which we aren't, but let's be safe)
        // Since we switched to JSON in frontend, req.body should have values.
        // Capital P or small p handling
        const paragraphId = req.body.paragraphId || req.body.ParagraphId;
        const transcript = req.body.transcript || req.body.Transcript || "";

        console.log('Assessment Params:', { paragraphId, transcriptPreview: transcript.substring(0, 50) });

        if (!paragraphId) {
            return res.status(400).json({ message: 'Paragraph ID is required' });
        }

        // Fetch original text
        const { rows } = await pool.query('SELECT content FROM pronunciation_paragraphs WHERE id = $1', [paragraphId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found' });
        }

        const originalText = rows[0].content;

        // Calculate Score
        // If no transcript provided (e.g. microphone error or silent), score is 0
        let accuracy = 0;
        let fluency = 0;

        if (transcript && transcript.length > 0) {
            accuracy = calculateAccuracy(originalText, transcript);
            // Fluency is harder to estimate from text alone, but we can approximate it 
            // by assuming high accuracy correlates with high fluency, with some random variation or length penalty
            // For now, let's make fluency correlated with accuracy but slightly higher to be encouraging
            fluency = Math.min(100, accuracy + 5 + Math.random() * 10);
        }

        const overall = (accuracy + fluency) / 2;

        res.json({
            success: true,
            scores: {
                accuracy: Math.round(accuracy),
                fluency: Math.round(fluency),
                overall: Math.round(overall)
            },
            feedback: accuracy > 80 ? "Excellent pronunciation! Very clear." :
                accuracy > 60 ? "Good effort. Try to articulate words more clearly." :
                    "Keep practicing. Listen to the reference audio and try again.",
            mistakes: [], // We could implement diffing later to populate this
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
