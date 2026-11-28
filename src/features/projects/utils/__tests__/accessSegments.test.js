import { describe, expect, it } from 'vitest';
import { describeSegments, nextSegmentType, repaintSegment, summarizeSegments } from '../accessSegments';

describe('accessSegments', () => {
  it('cicla o tipo do trecho asfalto -> terra -> acesso -> asfalto', () => {
    expect(nextSegmentType('asfalto')).toBe('terra');
    expect(nextSegmentType('terra')).toBe('acesso');
    expect(nextSegmentType('acesso')).toBe('asfalto');
  });

  it('repinta so o trecho clicado e marca como manual', () => {
    const segments = [{ tipo: 'terra', inferido: true, comprimentoM: 10 }, { tipo: 'acesso', comprimentoM: 5 }];
    const next = repaintSegment(segments, 0);
    expect(next[0]).toMatchObject({ tipo: 'acesso', manual: true, inferido: false });
    expect(next[1]).toBe(segments[1]);
  });

  it('resume e descreve os trechos', () => {
    const segments = [{ tipo: 'asfalto', comprimentoM: 2500 }, { tipo: 'terra', comprimentoM: 1200 }, { tipo: 'acesso', comprimentoM: 290 }, { tipo: 'terra', comprimentoM: 300 }];
    expect(summarizeSegments(segments)).toEqual({ asfalto: 2500, terra: 1500, acesso: 290 });
    expect(describeSegments(segments)).toBe('2,5 km de asfalto + 1,5 km de estrada de terra + 290 m de acesso');
  });
});
