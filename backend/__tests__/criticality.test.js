const {
    buildCriticalityTrend,
    calcular_criticidade,
    inferCriticalityInputFromLegacyErosion,
} = require('../utils/criticality_dist');

describe('Legacy criticalityV2 tests adapted for Backend', () => {
    it('maps thresholds correctly', () => {
        const out = calcular_criticidade({
            tipo_erosao: 'sulco',
            profundidade_m: 0.2,
            declividade_graus: 12,
            tipo_solo: 'argiloso',
            distancia_estrutura_m: 30,
        });

        expect(out.tipo_erosao_classe).toBe('T2');
        expect(out.profundidade_classe).toBe('P1');
        expect(out.declividade_classe).toBe('D2');
        expect(out.solo_classe).toBe('S2');
        expect(out.exposicao_classe).toBe('E2');
        expect(out.criticidade_score).toBe(8);
        expect(out.codigo).toBe('C2');
    });

    it('classifies depth boundaries at 1, 10 and 30 meters', () => {
        expect(calcular_criticidade({ profundidade_m: 1 }).profundidade_classe).toBe('P1');
        expect(calcular_criticidade({ profundidade_m: 10 }).profundidade_classe).toBe('P2');
        expect(calcular_criticidade({ profundidade_m: 30 }).profundidade_classe).toBe('P3');
        expect(calcular_criticidade({ profundidade_m: 30.1 }).profundidade_classe).toBe('P4');
    });

    it('generates validation alerts', () => {
        const out = calcular_criticidade({
            tipo_erosao: 'vocoroca',
            profundidade_m: 0.5,
            declividade_graus: 26,
            tipo_solo: 'arenoso',
            distancia_estrutura_m: 4,
        });

        expect(out.alertas_validacao.length).toBeGreaterThan(0);
    });

    it('infers legacy payload and marks estimated fields', () => {
        const inferred = inferCriticalityInputFromLegacyErosion({
            tipo: 'ravina',
            profundidade: '0.5-1.5',
            declividade: '15-30',
            faixaServidao: 'sim',
        });

        expect(inferred.estimado).toBe(true);
        expect(inferred.input.tipo_erosao).toBe('ravina');
        expect(inferred.input.profundidade_m).toBe(1.0);
    });

    it('builds trend labels', () => {
        expect(buildCriticalityTrend(10, 12)).toBe('agravando');
        expect(buildCriticalityTrend(12, 10)).toBe('recuperando');
        expect(buildCriticalityTrend(10, 10)).toBe('estavel');
    });

    it('caps recommendation to monitoring for contextual C1/C2 cases and keeps interventions optional', () => {
        const out = calcular_criticidade({
            tipo_erosao: 'sulco',
            profundidade_m: 6,
            declividade_graus: 12,
            tipo_solo: 'argiloso',
            distancia_estrutura_m: 25,
            localizacao_exposicao: 'area_terceiros',
        });

        expect(out.codigo).toBe('C2');
        expect(out.tipo_medida_recomendada).toBe('monitoramento');
        expect(Array.isArray(out.lista_solucoes_sugeridas)).toBe(true);
        expect(Array.isArray(out.lista_solucoes_possiveis_intervencao)).toBe(true);
        expect(out.lista_solucoes_possiveis_intervencao.length).toBeGreaterThan(0);
        expect(out.recomendacao_contextual).not.toBe('');
    });

    it('keeps a single recommendation list for C3/C4 even with contextual flags', () => {
        const out = calcular_criticidade({
            tipo_erosao: 'movimento_massa',
            profundidade_m: 11,
            declividade_graus: 12,
            tipo_solo: 'arenoso',
            distancia_estrutura_m: 25,
            localizacao_exposicao: 'area_terceiros',
        });

        expect(out.codigo).toBe('C3');
        expect(out.tipo_medida_recomendada).toBe('corretiva_estrutural');
        expect(out.lista_solucoes_sugeridas.length).toBeGreaterThan(0);
        expect(out.lista_solucoes_possiveis_intervencao).toEqual([]);
        expect(out.recomendacao_contextual).toBe('');
    });

    it('removes tower-specific solutions when context is access far from tower', () => {
        const out = calcular_criticidade({
            tipo_erosao: 'movimento_massa',
            profundidade_m: 35,
            declividade_graus: 30,
            tipo_solo: 'arenoso',
            distancia_estrutura_m: 60,
            estrutura_proxima: 'acesso',
            localTipo: 'Na via de acesso exclusiva',
        });

        expect(out.codigo).toBe('C3');
        expect(out.lista_solucoes_sugeridas.join(' | ')).not.toContain('Protecao de base de torres');
        expect(out.recomendacao_contextual).toContain('protecao de torre removidas');
    });
});
