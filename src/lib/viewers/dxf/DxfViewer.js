import { DxfViewer as DxfWebViewer } from 'dxf-viewer';
import BaseViewer from '../BaseViewer';
import { DXF_STATIC_ASSETS_VERSION } from '../../constants';
import { VIEWER_EVENT } from '../../events';
import { createAssetUrlCreator } from '../../util';
import { getDxfHeaderInfo, getDxfTextEncoding } from './dxfEncoding';
import { DXF_ENGINE_VIEWER } from './dxfReviewUtils';
import './DxfViewer.scss';

export const DXF_FONT_PATH = `third-party/dxf/${DXF_STATIC_ASSETS_VERSION}/NotoSansJP_400Regular.ttf`;

/**
 * Messy POC: parse the original DXF in the browser with dxf-viewer (WebGL).
 * No conversion service. Text uses Noto Sans JP, and pre-2007 files are decoded
 * with the code page named in their header.
 *
 * DxfRenderViewer extends this and swaps the drawing engine (renderDxf, resizeEngine,
 * destroyEngine) so both libraries can be compared on the same file.
 */
class DxfViewer extends BaseViewer {
    /**
     * Engine label shown in the corner badge.
     * @return {string}
     */
    getEngineName() {
        return DXF_ENGINE_VIEWER;
    }

    /**
     * @inheritdoc
     */
    setup() {
        if (this.isSetup) {
            return;
        }

        super.setup();
        this.wrapperEl = this.createViewer(document.createElement('div'));
        this.wrapperEl.className = 'bp-DxfViewer';

        this.badgeEl = document.createElement('div');
        this.badgeEl.className = 'bp-DxfViewer-badge';
        this.badgeEl.textContent = this.getEngineName();
        this.wrapperEl.appendChild(this.badgeEl);
    }

    /**
     * @inheritdoc
     * @return {Promise}
     */
    load() {
        super.load();
        this.setup();

        const content = this.options.representation && this.options.representation.content;
        const template = content ? content.url_template : null;
        if (!template) {
            return Promise.reject(new Error('DXF preview POC needs an original file URL')).catch(this.handleAssetError);
        }

        this.startLoadTimer();
        const contentUrl = this.createContentUrlV2(template);

        return this.fetchContentAsBlobUrl(contentUrl)
            .then(blobUrl => {
                if (this.isDestroyed()) {
                    URL.revokeObjectURL(blobUrl);
                    return undefined;
                }

                this.blobUrl = blobUrl;
                this.onResize = () => this.resizeToContentBox();
                window.addEventListener('resize', this.onResize);

                return this.inspectDxf(blobUrl).then(file => this.renderDxf(blobUrl, file));
            })
            .then(() => {
                if (this.isDestroyed()) {
                    return;
                }
                this.resizeToContentBox();
                this.hidePreviewMask();
                this.loaded = true;
                this.emit(VIEWER_EVENT.load);
            })
            .catch(error => {
                this.revokeBlob();
                return this.handleAssetError(error);
            });
    }

    /**
     * Read the file and work out which text encoding it uses.
     *
     * @protected
     * @param {string} blobUrl
     * @return {Promise<{buffer: ArrayBuffer, info: Object, encoding: string}>}
     */
    inspectDxf(blobUrl) {
        return fetch(blobUrl)
            .then(response => response.arrayBuffer())
            .then(buffer => {
                const info = getDxfHeaderInfo(buffer);
                if (info.isBinary) {
                    throw new Error('Binary DXF is not supported by the preview POC');
                }
                const encoding = getDxfTextEncoding(info);
                this.setBadge([info.version, encoding]);
                return { buffer, info, encoding };
            });
    }

    /**
     * @protected
     * @return {string}
     */
    getFontUrl() {
        return createAssetUrlCreator(this.options.location)(DXF_FONT_PATH);
    }

    /**
     * Draw the file. Overridden by subclasses that use another library.
     *
     * @protected
     * @param {string} blobUrl
     * @param {{encoding: string}} file
     * @return {Promise}
     */
    renderDxf(blobUrl, { encoding }) {
        // Size from the preview content box. autoResize marks the canvas position:absolute,
        // which collapses this wrapper to 0px and FitView then frames an empty viewport.
        const { width, height } = this.measureContentBox();

        this.dxfViewer = new DxfWebViewer(this.wrapperEl, {
            autoResize: false,
            canvasWidth: width,
            canvasHeight: height,
            blackWhiteInversion: true,
            colorCorrection: true,
            // Must be set before parsing; pre-2007 files are in a regional code page.
            fileEncoding: encoding,
        });
        // clearColor must be a THREE.Color. The constructor option rejects a hex string.
        this.dxfViewer.SetClearColor('#ffffff');

        // workerFactory omitted: parse on the main thread so webpack does not need a worker bundle.
        // Fonts are fetched lazily, only when the drawing has text.
        return this.dxfViewer.Load({ url: blobUrl, fonts: [this.getFontUrl()] });
    }

    /**
     * @inheritdoc
     * @return {void}
     */
    destroy() {
        if (this.onResize) {
            window.removeEventListener('resize', this.onResize);
            this.onResize = null;
        }
        this.destroyEngine();
        this.revokeBlob();
        super.destroy();
    }

    /**
     * @protected
     * @return {void}
     */
    destroyEngine() {
        if (this.dxfViewer) {
            this.dxfViewer.Destroy();
            this.dxfViewer = null;
        }
    }

    /**
     * Pixel size of the preview content area. Falls back to the window so the
     * WebGL buffer is never 0×0.
     *
     * @protected
     * @return {{width: number, height: number}}
     */
    measureContentBox() {
        const host = this.containerEl || this.wrapperEl;
        const width = Math.floor(host.clientWidth) || Math.floor(window.innerWidth) || 800;
        const height = Math.floor(host.clientHeight) || Math.floor(window.innerHeight) || 600;
        return {
            width: Math.max(width, 2),
            height: Math.max(height, 2),
        };
    }

    /**
     * @private
     * @return {void}
     */
    resizeToContentBox() {
        if (this.isDestroyed()) {
            return;
        }
        const { width, height } = this.measureContentBox();
        this.resizeEngine(width, height);
    }

    /**
     * @protected
     * @param {number} width
     * @param {number} height
     * @return {void}
     */
    resizeEngine(width, height) {
        if (!this.dxfViewer || (width === this.dxfViewer.canvasWidth && height === this.dxfViewer.canvasHeight)) {
            return;
        }
        this.dxfViewer.SetSize(width, height);
    }

    /**
     * Corner badge for comparing engines: "dxf-render · AC1015 · shift_jis".
     *
     * @protected
     * @param {Array<string|null>} parts
     * @return {void}
     */
    setBadge(parts) {
        this.badgeParts = parts.filter(Boolean);
        if (this.badgeEl) {
            this.badgeEl.textContent = [this.getEngineName(), ...this.badgeParts].join(' · ');
        }
    }

    /**
     * @protected
     * @param {string} part
     * @return {void}
     */
    appendBadge(part) {
        this.setBadge([...(this.badgeParts || []), part]);
    }

    /**
     * @private
     * @return {void}
     */
    revokeBlob() {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
    }
}

export default DxfViewer;
