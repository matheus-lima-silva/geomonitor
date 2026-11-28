const { calcular_criticidade, METODOLOGIA_VERSAO } = require('../utils/criticality_dist');

// V3.1: erosao em via de acesso usa escala de caminhonete.
function via(overrides = {}, impactoVia = {}) {
    return calcular_criticidade({
        tipo_erosao: 'sulco',
        declividade_graus: 5,
        tipo_solo: 'argiloso',
        sinais_avanco: false,
        vegetacao_interior: true,
        local_tipo: 'via_acesso_exclusiva',
        impactoVia: { posicaoRelativaVia: 'talude_jusante', ...impactoVia },
        ...overrides,
    });
}

describe('Criticidade V3.1 — escala de via de acesso', () => {
    it('marca a versao da metodologia e a escala usada', () => {
        expect(METODOLOGIA_VERSAO).toBe('V3.1');
        const out = via({ profundidade_m: 0.2 });
        expect(out.metodologia_versao).toBe('V3.1');
        expect(out.escala_via).toBe(true);
    });

    it.each([
        [0.08, 'P1'], [0.1, 'P1'], [0.2, 'P2'], [0.25, 'P2'], [0.4, 'P3'], [0.5, 'P3'], [0.6, 'P4'],
    ])('profundidade %s m em acesso -> %s', (depth, classe) => {
        expect(via({ profundidade_m: depth }).profundidade_classe).toBe(classe);
    });

    it('fora de acesso a escala continua em metros (0,6 m = P1)', () => {
        const out = calcular_criticidade({ tipo_erosao: 'sulco', profundidade_m: 0.6, local_tipo: 'faixa_servidao' });
        expect(out.profundidade_classe).toBe('P1');
        expect(out.escala_via).toBe(false);
    });

    it.each([
        [0.5, 'E4'], [2, 'E3'], [4, 'E2'], [8, 'E1'],
    ])('distancia %s m da borda da via -> %s', (distance, classe) => {
        expect(via({ profundidade_m: 0.2, distancia_estrutura_m: distance }).exposicao_classe).toBe(classe);
    });

    it('sem profundidade, infere a classe pela resposta da caminhonete', () => {
        expect(via({}, { caminhonetePassa: 'nao_passa' })).toMatchObject({ profundidade_classe: 'P4', profundidade_inferida: true });
        expect(via({}, { caminhonetePassa: 'dificuldade' }).profundidade_classe).toBe('P3');
        expect(via({}, { caminhonetePassa: 'passa' }).profundidade_classe).toBe('P1');
        // medida tem prioridade sobre a inferencia
        expect(via({ profundidade_m: 0.2 }, { caminhonetePassa: 'nao_passa' })).toMatchObject({ profundidade_classe: 'P2', profundidade_inferida: false });
    });

    it('piso C3 quando a caminhonete nao passa; C4 sem desvio e sem outro acesso', () => {
        const base = via({ profundidade_m: 0.05 }, { caminhonetePassa: 'nao_passa' });
        expect(base.codigo).toBe('C3');
        expect(base.piso_trafegabilidade).toBe('C3');

        const semSaida = via({ profundidade_m: 0.05 }, { caminhonetePassa: 'nao_passa', possibilidadeDesvio: false, rotaAlternativaDisponivel: false });
        expect(semSaida.codigo).toBe('C4');
        expect(semSaida.piso_trafegabilidade).toBe('C4');

        // desvio nao informado nao conta como "sem saida"
        expect(via({ profundidade_m: 0.05 }, { caminhonetePassa: 'nao_passa', rotaAlternativaDisponivel: false }).codigo).toBe('C3');
        // passa com dificuldade nao tem piso
        expect(via({ profundidade_m: 0.05 }, { caminhonetePassa: 'dificuldade' }).piso_trafegabilidade).toBe('');
    });

    it('sulco longitudinal soma 1 no modificador de via (teto 4)', () => {
        const transversal = via({ profundidade_m: 0.2 }, { orientacaoSulco: 'transversal' });
        const longitudinal = via({ profundidade_m: 0.2 }, { orientacaoSulco: 'longitudinal' });
        expect(transversal.pontos.V).toBe(0);
        expect(longitudinal.pontos.V).toBe(1);
        const capped = via({ profundidade_m: 0.2 }, { orientacaoSulco: 'longitudinal', grauObstrucao: 'total', estadoVia: 'terra' });
        expect(capped.pontos.V).toBe(4);
    });

    it('alerta resposta incoerente com a medida e falta da resposta', () => {
        expect(via({ profundidade_m: 0.8 }, { caminhonetePassa: 'passa' }).alertas_validacao.join(' ')).toContain('caminhonete passa');
        expect(via({ profundidade_m: 0.05 }, { caminhonetePassa: 'nao_passa' }).alertas_validacao.join(' ')).toContain('não passa');
        expect(via({ profundidade_m: 0.2 }).alertas_validacao.join(' ')).toContain('A caminhonete passa?');
    });
});
