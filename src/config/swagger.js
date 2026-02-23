const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AI Pronunciation Backend API',
            version: '1.0.0',
            description: 'API documentation for the AI Pronunciation Backend',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: (process.env.BACKEND_URL || 'http://localhost:5000') + '/api/v1',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: [
        path.join(__dirname, '../routes/*.js'),
        path.join(__dirname, '../models/*.js'),
    ],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
