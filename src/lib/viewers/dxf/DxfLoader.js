import AssetLoader from '../AssetLoader';
import DxfRenderViewer from './DxfRenderViewer';
import DxfViewer from './DxfViewer';
import { ORIGINAL_REP_NAME } from '../../constants';
import { appendQueryParams } from '../../util';
import { DXF_ENGINE_RENDER, getDxfEngine, isDxfReviewPocEnabled } from './dxfReviewUtils';

const getViewers = engine => [
    {
        NAME: 'DXF',
        CONSTRUCTOR: engine === DXF_ENGINE_RENDER ? DxfRenderViewer : DxfViewer,
        REP: ORIGINAL_REP_NAME,
        EXT: ['dxf'],
    },
];

/**
 * The API does not return an ORIGINAL representation for DXF. Preview normally
 * fakes one while caching, and skips that for watermarked files. The POC needs
 * the original bytes either way.
 *
 * @param {Object} file
 * @return {void}
 */
function ensureOriginalRepresentation(file) {
    if (!file.authenticated_download_url) {
        return;
    }
    if (!file.representations) {
        file.representations = { entries: [] };
    }
    if (!Array.isArray(file.representations.entries)) {
        file.representations.entries = [];
    }
    if (file.representations.entries.some(entry => entry.representation === ORIGINAL_REP_NAME)) {
        return;
    }

    file.representations.entries.push({
        content: {
            url_template: appendQueryParams(file.authenticated_download_url, {
                preview: 'true',
                _cache_buster: Date.now().toString(36),
            }),
        },
        representation: ORIGINAL_REP_NAME,
        status: { state: 'success' },
    });
}

class DxfLoader extends AssetLoader {
    /**
     * @inheritdoc
     */
    constructor() {
        super();
        this.viewers = getViewers(getDxfEngine());
    }

    /**
     * Hide the extension unless the POC is on. Advertising dxf and then
     * refusing it makes Preview show the account-limitation error.
     *
     * @inheritdoc
     */
    getViewers() {
        return isDxfReviewPocEnabled() ? this.viewers : [];
    }

    /**
     * @inheritdoc
     */
    determineViewer(file, disabledViewers = [], viewerOptions = {}) {
        if (!isDxfReviewPocEnabled(viewerOptions)) {
            return undefined;
        }
        if (!file || String(file.extension || '').toLowerCase() !== 'dxf') {
            return undefined;
        }

        ensureOriginalRepresentation(file);
        if (!file.representations || !Array.isArray(file.representations.entries)) {
            return undefined;
        }

        // Re-read ?dxfRenderer on each file so the library can be switched without a code change.
        this.viewers = getViewers(getDxfEngine(viewerOptions));
        return super.determineViewer({ ...file, extension: 'dxf' }, disabledViewers, viewerOptions);
    }
}

export default new DxfLoader();
