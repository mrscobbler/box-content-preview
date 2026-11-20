/**
 * Renders one transparent, tinted canvas per layer group of a PDF page for the
 * experimental exploded DWG view. Each pass gets its own OptionalContentConfig
 * so the visible drawing in the viewer is not affected.
 */

export const EXPLODE_COLORS = ['#3ee0ff', '#4f9dff', '#7af5c8', '#ffb547', '#c38bff', '#ff6f91', '#9be15d', '#ffd166'];
export const BASE_LAYER_COLOR = '#6f8ba8';

const TRANSPARENT = 'rgba(0,0,0,0)';

/**
 * @param {HTMLCanvasElement} canvas
 * @return {boolean}
 */
export function hasInk(canvas) {
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8) {
            return true;
        }
    }
    return false;
}

/**
 * Recolor every drawn pixel, keeping its alpha, so black linework glows on a dark stage.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} color
 * @return {void}
 */
export function tintCanvas(canvas, color) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

/**
 * @param {HTMLCanvasElement} canvas
 * @return {void}
 */
export function releaseCanvas(canvas) {
    if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * @param {Object} params
 * @param {Object} params.pdfDocument - PDFDocumentProxy
 * @param {number} params.pageNumber
 * @param {Array<{key: string, name: string, layerIds: string[]}>} params.groups
 * @param {number} [params.maxSize] - longest texture edge in px
 * @param {function(): boolean} [params.isCancelled]
 * @param {function(number, number): void} [params.onProgress] - (done, total)
 * @return {Promise<{aspect: number, layers: Array<{key: string, name: string, color: string, canvas: HTMLCanvasElement, isBase?: boolean}>}|null>}
 *   null when cancelled
 */
export async function renderLayerCanvases({
    pdfDocument,
    pageNumber,
    groups,
    maxSize = 1600,
    isCancelled = () => false,
    onProgress = () => {},
}) {
    const page = await pdfDocument.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(maxSize / Math.max(unscaled.width, unscaled.height), 4);
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    const total = groups.length + 1;
    const rendered = [];

    const renderPass = async visibleIds => {
        const config = await pdfDocument.getOptionalContentConfig();
        Object.keys(config.getGroups() || {}).forEach(id => config.setVisibility(id, visibleIds.has(id)));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        await page.render({
            background: TRANSPARENT,
            canvasContext: canvas.getContext('2d'),
            optionalContentConfigPromise: Promise.resolve(config),
            viewport,
        }).promise;
        return canvas;
    };

    const cancel = () => {
        rendered.forEach(layer => releaseCanvas(layer.canvas));
        return null;
    };

    // Content outside any OCG (title block, sheet border) renders in every pass, so
    // it gets its own bottom plane and is cut out of each layer plane.
    const base = await renderPass(new Set());
    onProgress(1, total);
    if (isCancelled()) {
        releaseCanvas(base);
        return cancel();
    }

    for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        // Sequential on purpose: each pass holds a full-size canvas.
        // eslint-disable-next-line no-await-in-loop
        const canvas = await renderPass(new Set(group.layerIds));
        onProgress(index + 2, total);

        if (isCancelled()) {
            releaseCanvas(canvas);
            releaseCanvas(base);
            return cancel();
        }

        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(base, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        if (hasInk(canvas)) {
            const color = EXPLODE_COLORS[rendered.length % EXPLODE_COLORS.length];
            tintCanvas(canvas, color);
            rendered.push({ key: group.key, name: group.name, color, canvas });
        } else {
            releaseCanvas(canvas);
        }
    }

    const layers = [];
    if (hasInk(base)) {
        tintCanvas(base, BASE_LAYER_COLOR);
        layers.push({ key: '__base__', name: 'Sheet (no layer)', color: BASE_LAYER_COLOR, canvas: base, isBase: true });
    } else {
        releaseCanvas(base);
    }

    return { aspect: width / height, layers: layers.concat(rendered) };
}
