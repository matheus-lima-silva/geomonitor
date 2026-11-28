const { parseAnademTowerCsv, ANADEM_SOURCE } = require('../utils/anademTerrain');

const HEADER = 'projeto,torre,latitude,longitude,anadem_decl_media,anadem_decl_max,anadem_elev,cop_decl_media,cop_decl_max,cop_elev';

describe('parseAnademTowerCsv', () => {
    it('le o CSV do Earth Engine, arredonda e separa ANADEM e Copernicus', () => {
        const csv = `﻿${HEADER}\r\nadrbfl,388,,,7.396756109453022,8.715592626504364,48.95829414707354,8.267456281775532,12.04141616821289,49.389662259337065\r\n`;
        const [row] = parseAnademTowerCsv(csv);
        expect(row.projeto).toBe('ADRBFL');
        expect(row.torre).toBe('388');
        expect(row.anadem).toEqual({ declividadeMediaGraus: 7.4, declividadeMaxGraus: 8.7, elevacaoM: 49 });
        expect(row.copernicusGee).toEqual({ declividadeMediaGraus: 8.3, declividadeMaxGraus: 12, elevacaoM: 49 });
    });

    it('descarta linhas sem declividade do ANADEM ou sem torre', () => {
        const csv = [HEADER, 'ARAPCA,10,,,,,,5,6,700', 'ARAPCA,,,,3,4,700,3,4,700', 'ARAPCA,11,,,0,0,701,,,'].join('\n');
        const rows = parseAnademTowerCsv(csv);
        expect(rows).toHaveLength(1);
        expect(rows[0].torre).toBe('11');
        expect(rows[0].anadem.declividadeMediaGraus).toBe(0);
        expect(rows[0].copernicusGee).toBeNull();
    });

    it('exige as colunas principais', () => {
        expect(() => parseAnademTowerCsv('projeto,torre\nA,1')).toThrow('anadem_decl_media');
        expect(parseAnademTowerCsv('')).toEqual([]);
    });
});

describe('ANADEM_SOURCE', () => {
    it('cita a fonte com o asset do Earth Engine', () => {
        expect(ANADEM_SOURCE.asset).toBe('projects/et-brasil/assets/anadem/v1');
    });
});
