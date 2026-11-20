import { TextDecoder, TextEncoder } from 'util';
import { decodeDxf, getDxfHeaderInfo, getDxfTextEncoding, needsWideFont } from '../dxfEncoding';

// jsdom does not provide these.
Object.assign(global, { TextDecoder, TextEncoder });

const header = (version, codePage) =>
    [
        '0',
        'SECTION',
        '2',
        'HEADER',
        '9',
        '$ACADVER',
        '1',
        version,
        '9',
        '$DWGCODEPAGE',
        '3',
        codePage,
        '0',
        'ENDSEC',
    ].join('\r\n');

const toBytes = text => Uint8Array.from(Array.from(text).map(char => char.charCodeAt(0)));

describe('lib/viewers/dxf/dxfEncoding', () => {
    describe('getDxfHeaderInfo()', () => {
        test('should read version and code page', () => {
            expect(getDxfHeaderInfo(toBytes(header('AC1015', 'ansi_932')))).toEqual({
                codePage: 'ANSI_932',
                isBinary: false,
                version: 'AC1015',
            });
        });

        test('should return nulls when the header variables are missing', () => {
            expect(getDxfHeaderInfo(toBytes('0\r\nEOF\r\n'))).toEqual({
                codePage: null,
                isBinary: false,
                version: null,
            });
        });

        test('should detect binary DXF', () => {
            expect(getDxfHeaderInfo(toBytes('AutoCAD Binary DXF\r\n\x1a\x00')).isBinary).toBe(true);
        });
    });

    describe('getDxfTextEncoding()', () => {
        test('should use the code page for pre-2007 files', () => {
            expect(getDxfTextEncoding({ codePage: 'ANSI_932', version: 'AC1015' })).toBe('shift_jis');
            expect(getDxfTextEncoding({ codePage: 'ANSI_1251', version: 'AC1009' })).toBe('windows-1251');
        });

        test('should default old files to windows-1252', () => {
            expect(getDxfTextEncoding({ codePage: null, version: 'AC1015' })).toBe('windows-1252');
            expect(getDxfTextEncoding({ codePage: 'UNKNOWN', version: 'AC1015' })).toBe('windows-1252');
        });

        test('should use utf-8 for 2007+ files and when the version is unknown', () => {
            expect(getDxfTextEncoding({ codePage: 'ANSI_932', version: 'AC1021' })).toBe('utf-8');
            expect(getDxfTextEncoding({ codePage: 'ANSI_932', version: 'AC1032' })).toBe('utf-8');
            expect(getDxfTextEncoding({ codePage: null, version: null })).toBe('utf-8');
        });
    });

    describe('decodeDxf()', () => {
        test('should decode an ANSI_1252 file with accented text', () => {
            const bytes = toBytes(`${header('AC1015', 'ANSI_1252')}\r\ncaf\xe9`);
            const result = decodeDxf(bytes);
            expect(result.encoding).toBe('windows-1252');
            expect(result.text).toContain('café');
        });

        test('should decode a utf-8 file', () => {
            const bytes = new TextEncoder().encode(`${header('AC1032', 'ANSI_1252')}\r\n図面`);
            expect(decodeDxf(bytes).text).toContain('図面');
        });
    });

    describe('needsWideFont()', () => {
        test('should be false for Latin text and true for CJK or unicode escapes', () => {
            expect(needsWideFont('Café 12 mm — 3°')).toBe(false);
            expect(needsWideFont('平面図')).toBe(true);
            expect(needsWideFont('\\U+5E73\\U+9762')).toBe(true);
            expect(needsWideFont('\\U+00B0')).toBe(false);
        });
    });
});
