// Garante que campos sensiveis sao removidos de respostas de usuario.
const { sanitizeUser, sanitizeUsers, isSensitiveKey } = require('../../utils/sanitizeUser');

describe('sanitizeUser', () => {
    it('remove passwordHash, resetToken, refreshToken, accessToken, secret', () => {
        const input = {
            id: 'U-1',
            nome: 'Alice',
            email: 'alice@test.local',
            passwordHash: 'hashed-secret',
            password_hash: 'legacy',
            resetToken: 'tok-123',
            reset_token: 'tok-legacy',
            resetTokenExpiresAt: '2026-01-01',
            refreshToken: 'refresh-123',
            refresh_token: 'refresh-legacy',
            accessToken: 'access-123',
            access_token: 'access-legacy',
            migrationPendingHash: 'MIGRATION_PENDING',
            migration_pending_hash: 'MIGRATION_PENDING',
            clientSecret: 'super-secret',
            perfil: 'Administrador',
            status: 'Ativo',
        };

        const clean = sanitizeUser(input);

        expect(clean.id).toBe('U-1');
        expect(clean.nome).toBe('Alice');
        expect(clean.email).toBe('alice@test.local');
        expect(clean.perfil).toBe('Administrador');
        expect(clean.status).toBe('Ativo');

        expect(clean.passwordHash).toBeUndefined();
        expect(clean.password_hash).toBeUndefined();
        expect(clean.resetToken).toBeUndefined();
        expect(clean.reset_token).toBeUndefined();
        expect(clean.resetTokenExpiresAt).toBeUndefined();
        expect(clean.refreshToken).toBeUndefined();
        expect(clean.refresh_token).toBeUndefined();
        expect(clean.accessToken).toBeUndefined();
        expect(clean.access_token).toBeUndefined();
        expect(clean.migrationPendingHash).toBeUndefined();
        expect(clean.migration_pending_hash).toBeUndefined();
        expect(clean.clientSecret).toBeUndefined();
    });

    it('nao muta o objeto original', () => {
        const input = { id: 'U-1', passwordHash: 'hash' };
        const clean = sanitizeUser(input);
        expect(input.passwordHash).toBe('hash'); // original intacto
        expect(clean.passwordHash).toBeUndefined();
    });

    it('aceita null/undefined sem lancar', () => {
        expect(sanitizeUser(null)).toBeNull();
        expect(sanitizeUser(undefined)).toBeUndefined();
    });

    it('sanitizeUsers processa arrays e retorna [] para nao-array', () => {
        const arr = [{ id: 'U-1', passwordHash: 'x' }, { id: 'U-2', password: 'y' }];
        const clean = sanitizeUsers(arr);
        expect(clean).toHaveLength(2);
        expect(clean[0].passwordHash).toBeUndefined();
        expect(clean[1].password).toBeUndefined();
        expect(sanitizeUsers(null)).toEqual([]);
        expect(sanitizeUsers('nao array')).toEqual([]);
    });

    it('isSensitiveKey detecta variacoes comuns', () => {
        expect(isSensitiveKey('password')).toBe(true);
        expect(isSensitiveKey('passwordHash')).toBe(true);
        expect(isSensitiveKey('password_hash')).toBe(true);
        expect(isSensitiveKey('resetToken')).toBe(true);
        expect(isSensitiveKey('reset_token')).toBe(true);
        expect(isSensitiveKey('refresh_token')).toBe(true);
        expect(isSensitiveKey('accessToken')).toBe(true);
        expect(isSensitiveKey('clientSecret')).toBe(true);
        expect(isSensitiveKey('email')).toBe(false);
        expect(isSensitiveKey('nome')).toBe(false);
        expect(isSensitiveKey('perfil')).toBe(false);
    });
});
