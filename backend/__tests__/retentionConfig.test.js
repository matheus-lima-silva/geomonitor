// Retencao: lixeira -> arquivo e backups de corte de rodape (rules_config.retencao).
const mockRules = { value: null };

jest.mock('../repositories', () => ({
    rulesConfigRepository: { get: jest.fn(async () => mockRules.value) },
}));

const {
    DEFAULT_TRASH_RETENTION_DAYS,
    DEFAULT_CROP_BACKUP_RETENTION_DAYS,
    clampDays,
    getCropBackupRetentionDays,
    getTrashRetentionDays,
} = require('../utils/retentionConfig');

describe('retentionConfig', () => {
    beforeEach(() => {
        mockRules.value = null;
    });

    test('clampDays aceita inteiros entre 1 e 3650', () => {
        expect(clampDays(30)).toBe(30);
        expect(clampDays('45')).toBe(45);
        expect(clampDays(0)).toBeNull();
        expect(clampDays(3651)).toBeNull();
        expect(clampDays(1.5)).toBeNull();
        expect(clampDays('abc')).toBeNull();
    });

    test('defaults quando o rules_config nao traz os campos', async () => {
        expect(await getTrashRetentionDays()).toBe(DEFAULT_TRASH_RETENTION_DAYS);
        expect(await getCropBackupRetentionDays()).toBe(DEFAULT_CROP_BACKUP_RETENTION_DAYS);
        mockRules.value = { retencao: { lixeira_para_arquivo_dias: 60 } };
        expect(await getTrashRetentionDays()).toBe(60);
        expect(await getCropBackupRetentionDays()).toBe(DEFAULT_CROP_BACKUP_RETENTION_DAYS);
    });

    test('le backup_corte_dias e ignora valor invalido', async () => {
        mockRules.value = { retencao: { backup_corte_dias: 90 } };
        expect(await getCropBackupRetentionDays()).toBe(90);
        mockRules.value = { retencao: { backup_corte_dias: 99999 } };
        expect(await getCropBackupRetentionDays()).toBe(DEFAULT_CROP_BACKUP_RETENTION_DAYS);
    });
});
