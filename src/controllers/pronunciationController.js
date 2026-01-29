const pool = require('../config/db');

// @desc    Get all paragraphs (public/student view) or instructor view
// @route   GET /api/v1/pronunciation/paragraphs
// @access  Public/Private
const getParagraphs = async (req, res) => {
    try {
        const { level, mode, pageNumber = 1, pageSize = 100 } = req.query;
        let query = 'SELECT * FROM pronunciation_paragraphs WHERE isDeleted = FALSE';
        const params = [];

        // Filter by level if provided
        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }

        // Instructor mode: Show only their own paragraphs (even unpublished, but NOT deleted)
        // Note: Use 'isDeleted' to hide deleted items globally unless we have a 'trash' view
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
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get single paragraph
// @route   GET /api/v1/pronunciation/paragraphs/:id
// @access  Public/Private
const getParagraph = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM pronunciation_paragraphs WHERE id = ? AND isDeleted = FALSE',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Paragraph not found' });
        }

        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create paragraph
// @route   POST /api/v1/pronunciation/paragraphs
// @access  Private (Instructor)
const createParagraph = async (req, res) => {
    try {
        const { title, content, level, isPublished } = req.body;
        const instructorId = req.user.id;

        const [result] = await pool.query(
            'INSERT INTO pronunciation_paragraphs (title, content, level, instructorId, isPublished) VALUES (?, ?, ?, ?, ?)',
            [title, content, level || 'Beginner', instructorId, isPublished || false]
        );

        res.status(201).json({
            success: true,
            data: { id: result.insertId, title }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update paragraph
// @route   PUT /api/v1/pronunciation/paragraphs/:id
// @access  Private (Instructor)
const updateParagraph = async (req, res) => {
    try {
        const { title, content, level, isPublished } = req.body;
        const id = req.params.id;

        await pool.query(
            'UPDATE pronunciation_paragraphs SET title=?, content=?, level=?, isPublished=? WHERE id=? AND instructorId=?',
            [title, content, level, isPublished, id, req.user.id]
        );

        res.json({ success: true, message: 'Paragraph updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
        await pool.query('UPDATE pronunciation_paragraphs SET isPublished = TRUE WHERE id = ? AND instructorId = ?', [id, req.user.id]);
        res.json({ success: true, message: 'Paragraph published' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getParagraphs,
    getParagraph,
    createParagraph,
    updateParagraph,
    deleteParagraph,
    publishParagraph
};
