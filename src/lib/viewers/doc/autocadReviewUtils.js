/**
 * Experimental DWG drawing-review helpers (sheets, OCG layers, measure scale).
 * Kept pure so the AutoCADViewer POC can be unit-tested without pdf.js.
 */

/**
 * Build sheet rows from pdf.js page labels, falling back to "Page N".
 *
 * @param {Array<string>|null|undefined} pageLabels - Result of PDFDocumentProxy.getPageLabels()
 * @param {number} pageCount
 * @return {Array<{pageNumber: number, label: string}>}
 */
export function getSheetLabels(pageLabels, pageCount) {
    const count = Number(pageCount) || 0;
    const labels = Array.isArray(pageLabels) ? pageLabels : null;

    return Array.from({ length: count }, (_, index) => {
        const pageNumber = index + 1;
        const raw = labels && labels[index];
        const trimmed = raw == null ? '' : String(raw).trim();
        return {
            pageNumber,
            label: trimmed || `Page ${pageNumber}`,
        };
    });
}

/**
 * Flatten pdf.js OptionalContentConfig.getOrder() which may nest radio-button groups.
 *
 * @param {Array<*>|null|undefined} order
 * @return {string[]}
 */
export function flattenOptionalContentOrder(order) {
    if (!Array.isArray(order)) {
        return [];
    }

    const ids = [];
    order.forEach(item => {
        if (typeof item === 'string') {
            ids.push(item);
        } else if (Array.isArray(item)) {
            ids.push(...flattenOptionalContentOrder(item));
        } else if (item && Array.isArray(item.order)) {
            ids.push(...flattenOptionalContentOrder(item.order));
        }
    });
    return ids;
}

/**
 * Read OCG layers from a pdf.js OptionalContentConfig. Returns [] when the PDF has none.
 * Does not invent CAD names — uses group.name from the PDF, else the OCG id.
 *
 * @param {Object|null|undefined} ocConfig - OptionalContentConfig
 * @return {Array<{id: string, name: string, visible: boolean}>}
 */
export function getLayerItems(ocConfig) {
    if (!ocConfig || typeof ocConfig.getGroups !== 'function') {
        return [];
    }

    const groups = ocConfig.getGroups();
    if (!groups || typeof groups !== 'object') {
        return [];
    }

    const order = typeof ocConfig.getOrder === 'function' ? flattenOptionalContentOrder(ocConfig.getOrder()) : [];
    const ids = order.length ? order : Object.keys(groups);
    const seen = new Set();
    const items = [];

    ids.forEach(id => {
        if (typeof id !== 'string' || seen.has(id) || !groups[id]) {
            return;
        }
        seen.add(id);
        const group = groups[id];
        const name = group.name == null || String(group.name).trim() === '' ? id : String(group.name);
        items.push({
            id,
            name,
            visible: group.visible !== false,
        });
    });

    Object.keys(groups).forEach(id => {
        if (seen.has(id)) {
            return;
        }
        const group = groups[id];
        const name = group.name == null || String(group.name).trim() === '' ? id : String(group.name);
        items.push({
            id,
            name,
            visible: group.visible !== false,
        });
    });

    return items;
}

/**
 * Euclidean distance in PDF user space.
 *
 * @param {{pdfX: number, pdfY: number}} a
 * @param {{pdfX: number, pdfY: number}} b
 * @return {number}
 */
export function getPdfDistance(a, b) {
    if (!a || !b) {
        return 0;
    }
    return Math.hypot(b.pdfX - a.pdfX, b.pdfY - a.pdfY);
}

/**
 * @param {number} pdfDistance
 * @param {number|string} knownLength
 * @param {string} unit
 * @return {{unitsPerPdfUnit: number, unit: string}|null}
 */
export function createScaleFromCalibration(pdfDistance, knownLength, unit) {
    const distance = Number(pdfDistance);
    const length = Number(knownLength);
    if (
        !distance ||
        !length ||
        distance <= 0 ||
        length <= 0 ||
        !Number.isFinite(distance) ||
        !Number.isFinite(length)
    ) {
        return null;
    }
    return {
        unitsPerPdfUnit: length / distance,
        unit: unit ? String(unit) : '',
    };
}

/**
 * @param {number} pdfDistance
 * @param {{unitsPerPdfUnit: number, unit: string}|null|undefined} scale
 * @return {string}
 */
export function formatMeasureDistance(pdfDistance, scale) {
    const distance = Number(pdfDistance);
    if (!Number.isFinite(distance)) {
        return '';
    }
    if (scale && scale.unitsPerPdfUnit) {
        const value = distance * scale.unitsPerPdfUnit;
        const unit = scale.unit ? ` ${scale.unit}` : '';
        return `${value.toFixed(2)}${unit}`;
    }
    return `${distance.toFixed(2)} PDF units`;
}

/**
 * Query param `dwgReview` wins, then viewer option enableDwgReviewPoc,
 * then default on outside production/test so local `yarn start:dev` is playable.
 *
 * @param {Object} options - viewer options
 * @param {function(string): *} getOption - getViewerOption bound to the viewer
 * @param {string} [nodeEnv]
 * @param {string} [search] - location.search
 * @return {boolean}
 */
export function isDwgReviewPocEnabled(_options, getOption, nodeEnv, search) {
    let query = search;
    if (query == null) {
        query = typeof window !== 'undefined' ? window.location.search : '';
    }
    let param;
    try {
        param = new URLSearchParams(query).get('dwgReview');
    } catch (err) {
        param = null;
    }

    if (param === '0' || param === 'false') {
        return false;
    }
    if (param === '1' || param === 'true') {
        return true;
    }

    const option = typeof getOption === 'function' ? getOption('enableDwgReviewPoc') : undefined;
    if (option === false) {
        return false;
    }
    if (option === true) {
        return true;
    }

    let env = nodeEnv;
    if (env == null) {
        env = typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : '';
    }
    return env !== 'production' && env !== 'test';
}
