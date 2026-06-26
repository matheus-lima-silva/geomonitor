'use strict';

// Reconciliacao IABTPR2 / variante ITATPR_C2: mapeia as tags de torre antigas (curadoria do
// alinhamento original, numeracao base) para os nomes da variante importada.
//
// Decisao do usuario (confirmada): a vistoria/fotos de maio sao do alinhamento da variante,
// logo "605" == torre "605A". Ambiguos resolvidos: 637 -> 637B, 638 -> 638A. 604 -> 604 (a
// variante tem 604 plain; nao ha 604A), portanto e no-op e nao entra no mapa.
//
// Sem cadeias (nenhuma chave e tambem valor) => aplicar 2x e idempotente.
const TAG_MAP = Object.freeze({
  '605': '605A',
  '607': '607A',
  '610': '610A',
  '615': '615A',
  '623': '623A',
  '624': '624A',
  '628': '628A',
  '630': '630A',
  '631': '631A',
  '633': '633A',
  '635': '635A',
  '637': '637B',
  '638': '638A',
  '640': '640A',
  '641': '641A',
  '642': '642A',
});

// Remapeia uma tag de torre. Tags fora do mapa (ex.: "604", torres fora do trecho) voltam
// inalteradas — o backfill nunca toca torre que nao esteja explicitamente no mapa.
function remapTag(tag) {
  const key = String(tag == null ? '' : tag).trim();
  if (!key) return key;
  return Object.prototype.hasOwnProperty.call(TAG_MAP, key) ? TAG_MAP[key] : key;
}

// Remapeia uma string de entrada "607, 610, 615" preservando o formato (", ").
function remapTorresInput(input) {
  if (typeof input !== 'string' || !input.trim()) return input;
  return input
    .split(',')
    .map((token) => {
      const trimmed = token.trim();
      return trimmed ? remapTag(trimmed) : trimmed;
    })
    .join(', ');
}

// Remapeia, de forma imutavel, todas as referencias de torre no payload de uma vistoria:
// detalhesDias[].torres[] (array de strings), .torresInput (texto), .torresDetalhadas[].numero
// e .hotelTorreBase. Retorna { payload, changes } onde changes lista o que mudou (auditoria).
function remapInspectionPayload(payload) {
  const changes = [];
  const dias = payload && Array.isArray(payload.detalhesDias) ? payload.detalhesDias : null;
  if (!dias) return { payload, changes };

  const note = (label, from, to) => {
    if (String(from).trim() !== String(to).trim()) changes.push(`${label}: ${from} -> ${to}`);
  };

  const nextDias = dias.map((dia, idx) => {
    if (!dia || typeof dia !== 'object') return dia;
    const next = { ...dia };

    if (Array.isArray(dia.torres)) {
      next.torres = dia.torres.map((t) => {
        const r = remapTag(t);
        note(`dia${idx}.torres`, t, r);
        return r;
      });
    }

    if (typeof dia.torresInput === 'string') {
      const r = remapTorresInput(dia.torresInput);
      if (r !== dia.torresInput) changes.push(`dia${idx}.torresInput reescrito`);
      next.torresInput = r;
    }

    if (Array.isArray(dia.torresDetalhadas)) {
      next.torresDetalhadas = dia.torresDetalhadas.map((td) => {
        if (!td || typeof td !== 'object') return td;
        const r = remapTag(td.numero);
        note(`dia${idx}.torresDetalhadas.numero`, td.numero, r);
        return { ...td, numero: r };
      });
    }

    if (dia.hotelTorreBase != null && String(dia.hotelTorreBase).trim()) {
      const r = remapTag(dia.hotelTorreBase);
      note(`dia${idx}.hotelTorreBase`, dia.hotelTorreBase, r);
      next.hotelTorreBase = r;
    }

    return next;
  });

  return { payload: { ...payload, detalhesDias: nextDias }, changes };
}

module.exports = { TAG_MAP, remapTag, remapTorresInput, remapInspectionPayload };
