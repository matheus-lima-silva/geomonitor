const request = require('supertest');
const app = require('../server');
const { getDocRef } = require('../utils/firebaseSetup');

const AUTH_HEADER = { Authorization: 'Bearer fake-token-for-test' };

describe('Users API Integration Tests (Mocked DB)', () => {
    async function seedManagerProfile() {
        await getDocRef('users', 'test-admin-123').set({
            id: 'test-admin-123',
            nome: 'Admin Tester',
            email: 'admin@test.com',
            perfil: 'Administrador',
            status: 'Ativo',
        });
    }

    async function seedViewerProfile() {
        await getDocRef('users', 'test-admin-123').set({
            id: 'test-admin-123',
            nome: 'Viewer Tester',
            email: 'admin@test.com',
            perfil: 'Utilizador',
            status: 'Ativo',
        });
    }

    it('permite bootstrap do perfil autenticado', async () => {
        const response = await request(app)
            .post('/api/users/bootstrap')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Novo Utilizador',
                    cargo: 'Campo',
                },
            });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('success');
        expect(response.body.data.nome).toBe('Novo Utilizador');
        expect(response.body.data.perfil).toBe('Utilizador');
        expect(response.body.data.status).toBe('Pendente');
    });

    it('GET /api/users/me retorna o proprio perfil', async () => {
        await seedViewerProfile();

        const response = await request(app)
            .get('/api/users/me')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
            expect.objectContaining({
                id: 'test-admin-123',
                nome: 'Viewer Tester',
            }),
        );
    });

    it('permite autoatualizacao do proprio perfil e preserva perfil/status quando o utilizador nao pode se gerenciar', async () => {
        await seedViewerProfile();

        const putResponse = await request(app)
            .put('/api/users/test-admin-123')
            .set(AUTH_HEADER)
            .send({
                data: {
                    nome: 'Admin Atualizado',
                    cargo: 'Coordenador',
                    perfil: 'Utilizador',
                    status: 'Pendente',
                },
            });

        expect(putResponse.status).toBe(200);
        expect(putResponse.body.data.nome).toBe('Admin Atualizado');
        expect(putResponse.body.data.perfil).toBe('Utilizador');
        expect(putResponse.body.data.status).toBe('Ativo');
        expect(putResponse.body.data._links.self.href).toContain('/api/users/test-admin-123');
    });

    it('GET /api/users lista utilizadores para gestor ativo', async () => {
        await seedManagerProfile();
        await request(app)
            .post('/api/users')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'U-200',
                    nome: 'Ana',
                    email: 'ana@empresa.com',
                    perfil: 'Utilizador',
                    status: 'Pendente',
                },
            });

        const response = await request(app)
            .get('/api/users')
            .set(AUTH_HEADER);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
        expect(response.body.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'test-admin-123' }),
                expect.objectContaining({ id: 'U-200' }),
            ]),
        );
    });

    it('DELETE /api/users/:id remove utilizador', async () => {
        await seedManagerProfile();
        await request(app)
            .post('/api/users')
            .set(AUTH_HEADER)
            .send({
                data: {
                    id: 'U-DEL',
                    nome: 'Excluir',
                    email: 'del@empresa.com',
                },
            });

        const deleteResponse = await request(app)
            .delete('/api/users/U-DEL')
            .set(AUTH_HEADER);

        expect(deleteResponse.status).toBe(200);
        expect(deleteResponse.body.status).toBe('success');

        const getResponse = await request(app)
            .get('/api/users/U-DEL')
            .set(AUTH_HEADER);

        expect(getResponse.status).toBe(404);
    });
});
