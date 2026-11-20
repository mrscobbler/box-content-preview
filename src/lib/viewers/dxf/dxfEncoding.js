/**
 * DXF text-encoding helpers for the experimental client DXF viewers.
 *
 * DXF R2007 (AC1021) and later are UTF-8. Older files use the code page named by the
 * $DWGCODEPAGE header variable (e.g. ANSI_932 = Shift-JIS), so decoding them as UTF-8
 * garbles any non-ASCII text.
 */

const HEADER_SNIFF_BYTES = 65536;
const FIRST_UTF8_VERSION = 1021; // AC1021 = AutoCAD 2007
const BINARY_DXF_SIGNATURE = 'AutoCAD Binary DXF';

const CODE_PAGE_ENCODINGS = {
    ANSI_874: 'windows-874',
    ANSI_932: 'shift_jis',
    ANSI_936: 'gbk',
    ANSI_949: 'euc-kr',
    ANSI_950: 'big5',
    ANSI_1250: 'windows-1250',
    ANSI_1251: 'windows-1251',
    ANSI_1252: 'windows-1252',
    ANSI_1253: 'windows-1253',
    ANSI_1254: 'windows-1254',
    ANSI_1255: 'windows-1255',
    ANSI_1256: 'windows-1256',
    ANSI_1257: 'windows-1257',
    ANSI_1258: 'windows-1258',
    DOS866: 'ibm866',
    DOS932: 'shift_jis',
    DOS936: 'gbk',
    DOS949: 'euc-kr',
    DOS950: 'big5',
    MACINTOSH: 'macintosh',
};

/**
 * Read $ACADVER and $DWGCODEPAGE from the start of a DXF file.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @return {{isBinary: boolean, version: string|null, codePage: string|null}}
 */
export function getDxfHeaderInfo(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, HEADER_SNIFF_BYTES));
    const version = head.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/i);
    const codePage = head.match(/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([^\r\n]+)/i);

    return {
        isBinary: head.startsWith(BINARY_DXF_SIGNATURE),
        version: version ? version[1].toUpperCase() : null,
        codePage: codePage ? codePage[1].trim().toUpperCase() : null,
    };
}

/**
 * Pick a TextDecoder label for a DXF file.
 *
 * @param {{version: string|null, codePage: string|null}} info
 * @return {string}
 */
export function getDxfTextEncoding(info) {
    const versionNumber = info && info.version ? parseInt(info.version.slice(2), 10) : NaN;

    // Unknown version: modern exporters write UTF-8, and ASCII decodes the same either way.
    if (Number.isNaN(versionNumber) || versionNumber >= FIRST_UTF8_VERSION) {
        return 'utf-8';
    }

    // The DXF spec default code page for older files is ANSI_1252.
    return (info.codePage && CODE_PAGE_ENCODINGS[info.codePage]) || 'windows-1252';
}

/**
 * Decode DXF bytes with the encoding implied by their header.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @return {{text: string, encoding: string, version: string|null, codePage: string|null, isBinary: boolean}}
 */
export function decodeDxf(buffer) {
    const info = getDxfHeaderInfo(buffer);
    let encoding = getDxfTextEncoding(info);
    let decoder;
    try {
        decoder = new TextDecoder(encoding);
    } catch (err) {
        // Runtime without this legacy encoding compiled in.
        encoding = 'utf-8';
        decoder = new TextDecoder(encoding);
    }

    return { ...info, encoding, text: info.isBinary ? '' : decoder.decode(buffer) };
}

/**
 * True when text needs glyphs beyond ASCII/Latin-1 (CJK, Cyrillic, Greek, ...).
 * Used to decide whether the large Japanese-capable font is worth loading.
 *
 * @param {string} text
 * @return {boolean}
 */
export function needsWideFont(text) {
    const value = String(text || '');
    // Characters outside Latin + general punctuation, or \U+XXXX escapes for them.
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u024F\u2000-\u206F]/.test(value) || /\\U\+(?!00[0-9A-F]{2})[0-9A-F]{4}/i.test(value);
}
