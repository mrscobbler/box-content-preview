export const DXF_ENGINE_VIEWER = 'dxf-viewer';
export const DXF_ENGINE_RENDER = 'dxf-render';

/**
 * Experimental DXF client-render gate.
 * ?dxfReview=1 / true forces it on. ?dxfReview=0 / false forces it off.
 * Otherwise the DXF viewer option enableDxfReviewPoc wins, then the dev server
 * default (on outside production and test), matching the DWG review POC.
 *
 * @param {Object} [viewerOptions] - Preview options.viewers
 * @param {string} [search] - location.search override for tests
 * @param {string} [nodeEnv] - process.env.NODE_ENV override for tests
 * @return {boolean}
 */
export function isDxfReviewPocEnabled(viewerOptions, search, nodeEnv) {
    let query = search;
    if (query == null) {
        query = typeof window !== 'undefined' ? window.location.search : '';
    }

    let param;
    try {
        param = new URLSearchParams(query).get('dxfReview');
    } catch (err) {
        param = null;
    }

    if (param === '0' || param === 'false') {
        return false;
    }
    if (param === '1' || param === 'true') {
        return true;
    }

    const dxfOptions = viewerOptions && (viewerOptions.DXF || viewerOptions.Dxf);
    const option = dxfOptions ? dxfOptions.enableDxfReviewPoc : undefined;
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

/**
 * Which library draws the DXF. `?dxfRenderer=dxf-render` switches from the default
 * dxf-viewer so both can be compared on the same file.
 *
 * @param {Object} [viewerOptions] - Preview options.viewers
 * @param {string} [search] - location.search override for tests
 * @return {string}
 */
export function getDxfEngine(viewerOptions, search) {
    let query = search;
    if (query == null) {
        query = typeof window !== 'undefined' ? window.location.search : '';
    }

    let param;
    try {
        param = new URLSearchParams(query).get('dxfRenderer');
    } catch (err) {
        param = null;
    }

    const dxfOptions = viewerOptions && (viewerOptions.DXF || viewerOptions.Dxf);
    const value = param || (dxfOptions && dxfOptions.renderer) || DXF_ENGINE_VIEWER;
    return value === DXF_ENGINE_RENDER ? DXF_ENGINE_RENDER : DXF_ENGINE_VIEWER;
}
