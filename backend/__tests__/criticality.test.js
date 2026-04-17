const {
    buildCriticalityTrend,
    calcular_criticidade,
    inferCriticalityInputFromLegacyErosion,
} = require('../utils/criticality_dist');

describe('Criticality V3 engine', () => {
    describe('basic dimension mapping', () => {
        it('maps 6 dimensions correctly for a standard case', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 0.2,
                declividade_graus: 12,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 30,
                sinais_avanco: false,
                vegetacao_interior: false,
            });

            expect(out.tipo_erosao_classe).toBe('T2');
            expect(out.profundidade_classe).toBe('P1');
            expect(out.declividade_classe).toBe('D2');
            expect(out.solo_classe).toBe('S2');
            expect(out.exposicao_classe).toBe('E2');
            expect(out.atividade_classe).toBe('A2');
            // T2=2, P1=0, D2=2, S2=2, E2=2, A2=2 = 10
            expect(out.criticidade_score).toBe(10);
            expect(out.codigo).toBe('C2');
            expect(out.pontos.A).toBe(2);
            expect(out.pontos.V).toBe(0);
        });

        it('classifies depth boundaries at 1, 10 and 30 meters', () => {
            expect(calcular_criticidade({ profundidade_m: 1 }).profundidade_classe).toBe('P1');
            expect(calcular_criticidade({ profundidade_m: 10 }).profundidade_classe).toBe('P2');
            expect(calcular_criticidade({ profundidade_m: 30 }).profundidade_classe).toBe('P3');
            expect(calcular_criticidade({ profundidade_m: 30.1 }).profundidade_classe).toBe('P4');
        });
    });

    describe('D4 slope class', () => {
        it('classifies >45 as D4 with 6 pts', () => {
            const out = calcular_criticidade({ declividade_graus: 46 });
            expect(out.declividade_classe).toBe('D4');
            expect(out.pontos.D).toBe(6);
        });

        it('classifies 45 as D3', () => {
            const out = calcular_criticidade({ declividade_graus: 45 });
            expect(out.declividade_classe).toBe('D3');
            expect(out.pontos.D).toBe(4);
        });

        it('classifies 25 as D2', () => {
            const out = calcular_criticidade({ declividade_graus: 25 });
            expect(out.declividade_classe).toBe('D2');
            expect(out.pontos.D).toBe(2);
        });
    });

    describe('S4 soil class', () => {
        it('classifies arenoso as S4 with 6 pts', () => {
            const out = calcular_criticidade({ tipo_solo: 'arenoso' });
            expect(out.solo_classe).toBe('S4');
            expect(out.pontos.S).toBe(6);
        });

        it('classifies solos_rasos as S3 with 4 pts', () => {
            const out = calcular_criticidade({ tipo_solo: 'solos_rasos' });
            expect(out.solo_classe).toBe('S3');
            expect(out.pontos.S).toBe(4);
        });
    });

    describe('activity dimension (A)', () => {
        it('A1: vegetacao=true, avanco=false -> 0 pts', () => {
            const out = calcular_criticidade({ sinais_avanco: false, vegetacao_interior: true });
            expect(out.atividade_classe).toBe('A1');
            expect(out.pontos.A).toBe(0);
        });

        it('A2: vegetacao=false, avanco=false -> 2 pts', () => {
            const out = calcular_criticidade({ sinais_avanco: false, vegetacao_interior: false });
            expect(out.atividade_classe).toBe('A2');
            expect(out.pontos.A).toBe(2);
        });

        it('A3: avanco=true, vegetacao=true -> 4 pts', () => {
            const out = calcular_criticidade({ sinais_avanco: true, vegetacao_interior: true });
            expect(out.atividade_classe).toBe('A3');
            expect(out.pontos.A).toBe(4);
        });

        it('A4: avanco=true, vegetacao=false -> 6 pts', () => {
            const out = calcular_criticidade({ sinais_avanco: true, vegetacao_interior: false });
            expect(out.atividade_classe).toBe('A4');
            expect(out.pontos.A).toBe(6);
        });
    });

    describe('criticality bands (C1-C4)', () => {
        it('score 9 -> C1', () => {
            // T2=2 + P1=0 + D1=0 + S2=2 + E1=0 + A3=4 = 8 -> C1
            const out = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 0.5,
                declividade_graus: 5,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 60,
                sinais_avanco: true,
                vegetacao_interior: true,
            });
            expect(out.criticidade_score).toBeLessThanOrEqual(9);
            expect(out.codigo).toBe('C1');
        });

        it('score 10 -> C2', () => {
            // T2=2 + P1=0 + D2=2 + S2=2 + E2=2 + A2=2 = 10
            const out = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 0.5,
                declividade_graus: 12,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 30,
                sinais_avanco: false,
                vegetacao_interior: false,
            });
            expect(out.criticidade_score).toBe(10);
            expect(out.codigo).toBe('C2');
        });

        it('score 19 -> C3', () => {
            // T3=4 + P2=2 + D2=2 + S3=4 + E3=4 + A3=4 = 20
            const out = calcular_criticidade({
                tipo_erosao: 'ravina',
                profundidade_m: 5,
                declividade_graus: 15,
                tipo_solo: 'solos_rasos',
                distancia_estrutura_m: 10,
                sinais_avanco: true,
                vegetacao_interior: true,
            });
            expect(out.criticidade_score).toBeGreaterThanOrEqual(19);
            expect(out.codigo).toBe('C3');
        });

        it('score >= 28 -> C4', () => {
            // T4=6 + P4=6 + D4=6 + S4=6 + E4=6 + A4=6 = 36
            const out = calcular_criticidade({
                tipo_erosao: 'vocoroca',
                profundidade_m: 35,
                declividade_graus: 50,
                tipo_solo: 'arenoso',
                distancia_estrutura_m: 2,
                sinais_avanco: true,
                vegetacao_interior: false,
            });
            expect(out.criticidade_score).toBe(36);
            expect(out.codigo).toBe('C4');
        });
    });

    describe('via de acesso modifier', () => {
        it('adds modifier for obstruction total on via', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'ravina',
                profundidade_m: 5,
                declividade_graus: 15,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 10,
                localTipo: 'via_acesso_exclusiva',
                impactoVia: {
                    grauObstrucao: 'total',
                    estadoVia: 'terra',
                },
            });
            // grauObstrucao=total(+3) + terra(+1) = 4 (capped)
            expect(out.pontos.V).toBe(4);
        });

        it('caps modifier at 4', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'vocoroca',
                profundidade_m: 10,
                declividade_graus: 30,
                tipo_solo: 'solos_rasos',
                distancia_estrutura_m: 5,
                localTipo: 'via_acesso_exclusiva',
                impactoVia: {
                    grauObstrucao: 'total',
                    tipoImpactoVia: 'ruptura_plataforma',
                    estadoVia: 'terra',
                },
            });
            // total(3) + ruptura(2) + terra(1) = 6 -> capped at 4
            expect(out.pontos.V).toBe(4);
        });

        it('does not apply modifier for non-via context', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 2,
                localTipo: 'faixa_servidao',
                impactoVia: { grauObstrucao: 'total' },
            });
            expect(out.pontos.V).toBe(0);
        });

        it('forces distancia 0 when leito on via de acesso', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 2,
                distancia_estrutura_m: 30,
                localTipo: 'via_acesso_exclusiva',
                impactoVia: { posicaoRelativaVia: 'leito' },
            });
            expect(out.exposicao_classe).toBe('E4');
        });
    });

    describe('contextual modifiers', () => {
        it('piso C3: base_torre + vocoroca + close -> forces C3', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'vocoroca',
                profundidade_m: 0.5,
                declividade_graus: 5,
                tipo_solo: 'lateritico',
                distancia_estrutura_m: 3,
                localTipo: 'base_torre',
                sinais_avanco: false,
                vegetacao_interior: true,
            });
            // T4=6 + P1=0 + D1=0 + S1=0 + E4=6 + A1=0 = 12 -> C2, but piso forces C3
            expect(out.codigo).toBe('C3');
        });

        it('teto C2: fora_faixa + area_terceiros caps C3/C4 to C2', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'movimento_massa',
                profundidade_m: 11,
                declividade_graus: 30,
                tipo_solo: 'arenoso',
                distancia_estrutura_m: 3,
                localTipo: 'fora_faixa_servidao',
                localizacao_exposicao: 'area_terceiros',
                sinais_avanco: true,
                vegetacao_interior: false,
            });
            expect(out.codigo).toBe('C2');
        });

        it('nao rebaixa para C2 quando ha area_terceiros sem local fora_faixa', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'movimento_massa',
                profundidade_m: 11,
                declividade_graus: 30,
                tipo_solo: 'arenoso',
                distancia_estrutura_m: 3,
                localTipo: 'faixa_servidao',
                localizacao_exposicao: 'area_terceiros',
                sinais_avanco: true,
                vegetacao_interior: false,
            });
            expect(out.codigo).toBe('C4');
        });

        it('fora_faixa: only monitoring solutions', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'vocoroca',
                profundidade_m: 35,
                declividade_graus: 50,
                tipo_solo: 'arenoso',
                distancia_estrutura_m: 2,
                localTipo: 'fora_faixa_servidao',
                localizacao_exposicao: 'area_terceiros',
                sinais_avanco: true,
                vegetacao_interior: false,
            });
            expect(out.codigo).toBe('C2');
            expect(out.tipo_medida_recomendada).toBe('monitoramento');
            expect(out.lista_solucoes_sugeridas).toContain('Monitoramento visual periodico');
            expect(out.lista_solucoes_sugeridas).toContain('Notificacao ao proprietario');
        });
    });

    describe('tagged solutions (SOLUCOES_DATABASE)', () => {
        it('filters solutions by local and tipo', () => {
            const outVia = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 5,
                declividade_graus: 15,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 10,
                localTipo: 'via_acesso_exclusiva',
            });
            expect(outVia.lista_solucoes_sugeridas.some((s) => s.includes('estrada') || s.includes('acesso'))).toBe(true);

            const outTorre = calcular_criticidade({
                tipo_erosao: 'vocoroca',
                profundidade_m: 15,
                declividade_graus: 30,
                tipo_solo: 'solos_rasos',
                distancia_estrutura_m: 3,
                localTipo: 'base_torre',
            });
            expect(outTorre.lista_solucoes_sugeridas.some((s) => s.includes('torre') || s.includes('anel'))).toBe(true);
        });

        it('removes tower-specific solutions when access context far from tower', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'movimento_massa',
                profundidade_m: 35,
                declividade_graus: 30,
                tipo_solo: 'arenoso',
                distancia_estrutura_m: 60,
                estrutura_proxima: 'acesso',
                localTipo: 'via_acesso_exclusiva',
            });

            expect(out.lista_solucoes_sugeridas.join(' | ')).not.toContain('base de torres');
        });
    });

    describe('validation alerts', () => {
        it('generates alerts for vocoroca with low depth', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'vocoroca',
                profundidade_m: 0.5,
                declividade_graus: 26,
                tipo_solo: 'arenoso',
                distancia_estrutura_m: 4,
            });
            expect(out.alertas_validacao.length).toBeGreaterThan(0);
        });
    });

    describe('legacy inference', () => {
        it('infers legacy payload and marks estimated', () => {
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

        it('maps >45 slope to D4 range (50)', () => {
            const inferred = inferCriticalityInputFromLegacyErosion({
                tipo: 'sulco',
                declividade: '>45',
            });
            expect(inferred.input.declividade_graus).toBe(50);
        });

        it('defaults sinais_avanco=false for legacy without field -> A2', () => {
            const inferred = inferCriticalityInputFromLegacyErosion({ tipo: 'sulco' });
            expect(inferred.input.sinais_avanco).toBe(false);
            expect(inferred.input.vegetacao_interior).toBe(false);
            const out = calcular_criticidade(inferred.input);
            expect(out.atividade_classe).toBe('A2');
        });
    });

    describe('trend labels', () => {
        it('builds trend labels', () => {
            expect(buildCriticalityTrend(10, 12)).toBe('agravando');
            expect(buildCriticalityTrend(12, 10)).toBe('recuperando');
            expect(buildCriticalityTrend(10, 10)).toBe('estavel');
        });
    });

    describe('monitoring cap for C1/C2 contextual', () => {
        it('caps to monitoring for area_terceiros + C2', () => {
            const out = calcular_criticidade({
                tipo_erosao: 'sulco',
                profundidade_m: 6,
                declividade_graus: 12,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 25,
                localizacao_exposicao: 'area_terceiros',
            });
            expect(['C1', 'C2']).toContain(out.codigo);
            expect(out.tipo_medida_recomendada).toBe('monitoramento');
            expect(Array.isArray(out.lista_solucoes_possiveis_intervencao)).toBe(true);
        });
    });

    describe('null max serialization', () => {
        it('resolves C4 when faixas have null max (JSON/Postgres cannot store Infinity)', () => {
            const configComMaxNulo = {
                faixas: [
                    { codigo: 'C1', classe: 'Baixo', min: 0, max: 9 },
                    { codigo: 'C2', classe: 'Médio', min: 10, max: 18 },
                    { codigo: 'C3', classe: 'Alto', min: 19, max: 27 },
                    { codigo: 'C4', classe: 'Muito Alto', min: 28, max: null },
                ],
            };

            const out = calcular_criticidade({
                tipo_erosao: 'ravina',
                profundidade_m: 5,
                declividade_graus: 30,
                tipo_solo: 'argiloso',
                distancia_estrutura_m: 3,
                sinais_avanco: true,
                vegetacao_interior: false,
                localTipo: 'via_acesso_exclusiva',
                impactoVia: {
                    grauObstrucao: 'total',
                    estadoVia: 'terra',
                },
            }, configComMaxNulo);

            // T3=4, P2=2, D3=4, S2=2, E4=6, A4=6 = 24, via modifier capped at 4 = 28
            expect(out.criticidade_score).toBe(28);
            expect(out.codigo).toBe('C4');
            expect(out.criticidade_classe).toBe('Muito Alto');
        });
    });
});
