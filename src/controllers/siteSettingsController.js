const pool = require('../config/db');

// @desc    Get site settings
// @route   GET /api/v1/settings/site
// @access  Public
const getSiteSettings = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM settings WHERE setting_key LIKE 'footer_%'");

        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error fetching site settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update site settings
// @route   POST /api/v1/settings/site
// @access  Private (Admin/SuperAdmin)
const updateSiteSettings = async (req, res) => {
    try {
        const updates = req.body; // Expecting { key: value }
        const queries = [];

        for (const [key, value] of Object.entries(updates)) {
            if (key.startsWith('footer_')) {
                queries.push(
                    pool.query(
                        `INSERT INTO settings (setting_key, setting_value, updated_at) 
                         VALUES ($1, $2, NOW()) 
                         ON CONFLICT (setting_key) DO UPDATE 
                         SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
                        [key, typeof value === 'object' ? JSON.stringify(value) : String(value)]
                    )
                );
            }
        }

        if (queries.length > 0) {
            await Promise.all(queries);
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating site settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getSiteSettings,
    updateSiteSettings
};
