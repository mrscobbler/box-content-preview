import DxfViewer from './DxfViewer';
import { DXF_ENGINE_RENDER } from './dxfReviewUtils';

/**
 * Same POC as DxfViewer, but drawn with dxf-render (MIT) instead of dxf-viewer (MPL-2.0).
 * Selected with ?dxfRenderer=dxf-render so both can be compared on the same file.
 */
class DxfRenderViewer extends DxfViewer {
    /**
     * @inheritdoc
     */
    getEngineName() {
        return DXF_ENGINE_RENDER;
    }

    /**
     * @inheritdoc
     */
    renderDxf(blobUrl, { buffer, encoding }) {
        const { width, height } = this.measureContentBox();
        // Decode here: dxf-render takes text, so the encoding picked from the header applies directly.
        const text = new TextDecoder(encoding).decode(buffer);

        return import(/* webpackChunkName: "dxf-render-engine" */ './dxfRenderEngine').then(
            ({ default: createDxfRenderScene }) => {
                if (this.isDestroyed()) {
                    return undefined;
                }
                return createDxfRenderScene({
                    container: this.wrapperEl,
                    fontUrl: this.getFontUrl(),
                    height,
                    text,
                    width,
                }).then(engine => {
                    if (this.isDestroyed()) {
                        engine.destroy();
                        return;
                    }
                    this.engine = engine;
                    const { unsupportedEntities, wideFont } = engine.summary;
                    if (unsupportedEntities && unsupportedEntities.length) {
                        // eslint-disable-next-line no-console
                        console.info('[dxf-render] unsupported entities:', unsupportedEntities);
                    }
                    if (wideFont) {
                        this.appendBadge('Noto Sans JP');
                    }
                });
            },
        );
    }

    /**
     * @inheritdoc
     */
    resizeEngine(width, height) {
        if (this.engine) {
            this.engine.resize(width, height);
        }
    }

    /**
     * @inheritdoc
     */
    destroyEngine() {
        if (this.engine) {
            this.engine.destroy();
            this.engine = null;
        }
    }
}

export default DxfRenderViewer;
