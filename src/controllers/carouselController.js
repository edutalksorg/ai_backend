const pool = require('../config/db');

// @desc    Get all active carousel items (Public/User)
// @route   GET /api/v1/carousel
// @access  Public / Protected
const getCarouselItems = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM carousel_items WHERE is_active = TRUE ORDER BY display_order ASC, created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching carousel items' });
    }
};

// @desc    Get all carousel items (Admin)
// @route   GET /api/v1/carousel/admin
// @access  Admin
const getAllCarouselItemsAdmin = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM carousel_items ORDER BY display_order ASC, created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching admin carousel items' });
    }
};

// @desc    Create carousel item
// @route   POST /api/v1/carousel
// @access  Admin
const createCarouselItem = async (req, res) => {
    try {
        const { title, description, redirectUrl, displayOrder, isActive } = req.body;

        // Image URL from file upload or body
        let imageUrl = req.body.imageUrl;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        if (!imageUrl) {
            return res.status(400).json({ message: 'Image is required' });
        }

        // Parse numeric and boolean values from FormData (which sends strings)
        const order = parseInt(displayOrder) || 0;
        const active = isActive === 'true' || isActive === true || isActive === undefined;

        const { rows } = await pool.query(
            'INSERT INTO carousel_items (title, description, image_url, redirect_url, display_order, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, description, imageUrl, redirectUrl, order, active]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error creating carousel item' });
    }
};

// @desc    Update carousel item
// @route   PUT /api/v1/carousel/:id
// @access  Admin
const updateCarouselItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, redirectUrl, displayOrder, isActive, imageUrl: bodyImageUrl } = req.body;

        let imageUrl = bodyImageUrl;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        // Check if item exists
        const { rows: existing } = await pool.query('SELECT * FROM carousel_items WHERE id = $1', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Carousel item not found' });
        }

        const current = existing[0];

        // Parse numeric and boolean values
        const order = displayOrder !== undefined ? parseInt(displayOrder) : current.display_order;
        const active = isActive !== undefined ? (isActive === 'true' || isActive === true) : current.is_active;

        const { rows } = await pool.query(
            `UPDATE carousel_items 
       SET title = $1, description = $2, image_url = $3, redirect_url = $4, display_order = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
            [
                title !== undefined ? title : current.title,
                description !== undefined ? description : current.description,
                imageUrl || current.image_url,
                redirectUrl !== undefined ? redirectUrl : current.redirect_url,
                isNaN(order) ? current.display_order : order,
                active,
                id
            ]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating carousel item' });
    }
};

// @desc    Delete carousel item
// @route   DELETE /api/v1/carousel/:id
// @access  Admin
const deleteCarouselItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { rowCount } = await pool.query('DELETE FROM carousel_items WHERE id = $1', [id]);

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Carousel item not found' });
        }

        res.json({ message: 'Carousel item deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting carousel item' });
    }
};

module.exports = {
    getCarouselItems,
    getAllCarouselItemsAdmin,
    createCarouselItem,
    updateCarouselItem,
    deleteCarouselItem
};
