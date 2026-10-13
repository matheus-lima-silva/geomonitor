// Helper para acessar configuracoes de retencao da lixeira/arquivo.
// Centraliza fallback e validacao: evita que cada rota embute seu proprio
// valor "hardcoded 30 dias" e garante que mudancas em admin surtam efeito
// imediatamente no backend.

const { rulesConfigRepository } = require('../repositories');

const DEFAULT_TRASH_RETENTION_DAYS = 30;
// Backups `.orig-<ts>` do corte de rodape (photoFooterCrop): depois deste prazo
// o backup e apagado e o corte deixa de ser desfazivel.
const DEFAULT_CROP_BACKUP_RETENTION_DAYS = 30;
const MIN_DAYS = 1;
const MAX_DAYS = 3650;

function clampDays(value) {
    const num = Number(value);
    if (!Number.isInteger(num)) return null;
    if (num < MIN_DAYS || num > MAX_DAYS) return null;
    return num;
}

async function getTrashRetentionDays() {
    try {
        const config = await rulesConfigRepository.get();
        const value = config?.retencao?.lixeira_para_arquivo_dias;
        const clamped = clampDays(value);
        return clamped === null ? DEFAULT_TRASH_RETENTION_DAYS : clamped;
    } catch (error) {
        console.error('[retentionConfig] erro ao ler rules_config, usando default:', error?.message || error);
        return DEFAULT_TRASH_RETENTION_DAYS;
    }
}

async function getCropBackupRetentionDays() {
    try {
        const config = await rulesConfigRepository.get();
        const clamped = clampDays(config?.retencao?.backup_corte_dias);
        return clamped === null ? DEFAULT_CROP_BACKUP_RETENTION_DAYS : clamped;
    } catch (error) {
        console.error('[retentionConfig] erro ao ler rules_config (backup_corte_dias), usando default:', error?.message || error);
        return DEFAULT_CROP_BACKUP_RETENTION_DAYS;
    }
}

module.exports = {
    DEFAULT_TRASH_RETENTION_DAYS,
    DEFAULT_CROP_BACKUP_RETENTION_DAYS,
    MIN_DAYS,
    MAX_DAYS,
    getTrashRetentionDays,
    getCropBackupRetentionDays,
    clampDays,
};
