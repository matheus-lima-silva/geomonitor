const request = require('supertest');
const app = require('../server');

describe('Health endpoint', () => {
    it('GET /health returns service status', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'ok',
            service: 'geomonitor-api',
        });
    });
});

