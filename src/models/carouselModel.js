const pool = require('../config/db');

const createCarouselTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS carousel_items (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      description TEXT,
      image_url TEXT NOT NULL,
      redirect_url TEXT,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
    await pool.query(query);
};

module.exports = createCarouselTable;
