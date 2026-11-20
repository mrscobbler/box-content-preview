import React from 'react';
import { createRoot } from 'react-dom/client';
import Thumbnail from '../../Thumbnail';
import DocumentViewer from './DocumentViewer';
import AutoCADExplodedView from './AutoCADExplodedView';
import AutoCADReviewPanel from './AutoCADReviewPanel';
import { METADATA } from '../../constants';
import { MISSING_EXTERNAL_REFS } from '../../events';
import { releaseCanvas, renderLayerCanvases } from './autocadExplodeRender';
import {
    createScaleFromCalibration,
    formatMeasureDistance,
    getLayerItems,
    getPdfDistance,
    getSheetLabels,
    groupLayersForExplode,
    isDwgReviewPocEnabled,
} from './autocadReviewUtils';
import './AutoCADReviewPanel.scss';
import './AutoCADReviewToggle.scss';

const { FIELD_HASXREFS, TEMPLATE_AUTOCAD } = METADATA;
const SVG_NS = 'http://www.w3.org/2000/svg';

class AutoCADViewer extends DocumentViewer {
    constructor(options) {
        super(options);
        this.api = options.api;

        this.calibrateMeasure = this.calibrateMeasure.bind(this);
        this.clearMeasureScale = this.clearMeasureScale.bind(this);
        this.closeExplodedView = this.closeExplodedView.bind(this);
        this.handleExplodeAutoRotate = this.handleExplodeAutoRotate.bind(this);
        this.handleExplodeFocus = this.handleExplodeFocus.bind(this);
        this.handleExplodeHover = this.handleExplodeHover.bind(this);
        this.handleExplodeReset = this.handleExplodeReset.bind(this);
        this.handleExplodeSpread = this.handleExplodeSpread.bind(this);
        this.handleExplodeStageRef = this.handleExplodeStageRef.bind(this);
        this.openExplodedView = this.openExplodedView.bind(this);
        this.handleLayerToggle = this.handleLayerToggle.bind(this);
        this.handleMeasureClick = this.handleMeasureClick.bind(this);
        this.toggleMeasure = this.toggleMeasure.bind(this);
        this.toggleReviewPanel = this.toggleReviewPanel.bind(this);
    }

    /**
     * @inheritdoc
     */
    setup() {
        const wasSetup = this.isSetup;
        super.setup();

        if (wasSetup || !this.isReviewPocEnabled()) {
            return;
        }

        this.isReviewPanelOpen = true;
        this.isMeasureActive = false;
        this.measureHint = 'Click Measure, then two points on the same sheet.';
        this.measurePoints = [];
        this.measureResult = null;
        this.measureScale = null;
        this.reviewLayers = [];
        this.reviewSheets = [];
        this.reviewOcConfig = null;

        this.reviewPanelHostEl = document.createElement('div');
        this.reviewPanelHostEl.className = 'bp-AutoCADReviewPanelHost';
        this.containerEl.appendChild(this.reviewPanelHostEl);
        this.reviewPanelRoot = createRoot(this.reviewPanelHostEl);

        this.docEl.addEventListener('click', this.handleMeasureClick, true);
    }

    /**
     * @inheritdoc
     */
    load() {
        super.load();

        this.checkForXrefs();
    }

    /**
     * @inheritdoc
     */
    destroy() {
        this.teardownReviewPoc();
        super.destroy();
    }

    /**
     * Checks for xrefs, depending on file extension
     * @return {void}
     */
    checkForXrefs() {
        const { extension, id } = this.options.file;

        this.api.metadata
            .getXrefsMetadata(id, TEMPLATE_AUTOCAD, this.options)
            .then(({ [FIELD_HASXREFS]: hasxrefsValue }) => {
                if (hasxrefsValue) {
                    this.options.ui.showNotification(__('has_x_refs'), null, true, 'warning');

                    this.emitMetric({
                        name: MISSING_EXTERNAL_REFS,
                        data: extension,
                    });
                }
            });
    }

    /**
     * Experimental drawing-review panel — AutoCAD/DWG only.
     * Default on for local/dev; `?dwgReview=0` or viewers.AutoCAD.enableDwgReviewPoc=false disables.
     *
     * @return {boolean}
     */
    isReviewPocEnabled() {
        return isDwgReviewPocEnabled(this.options, option => this.getViewerOption(option));
    }

    /**
     * @inheritdoc
     */
    pagesinitHandler() {
        super.pagesinitHandler();
        this.loadReviewCatalog();
    }

    /**
     * @inheritdoc
     */
    pagerenderedHandler(event) {
        super.pagerenderedHandler(event);
        this.drawMeasureOverlay();
    }

    /**
     * @inheritdoc
     */
    renderUI(extraProps) {
        if (!this.isReviewPocEnabled()) {
            super.renderUI(extraProps);
            return;
        }

        super.renderUI({
            ...(extraProps || {}),
            isDwgReviewOpen: this.isReviewPanelOpen,
            onDwgReviewToggle: this.toggleReviewPanel,
        });
        this.renderReviewPanel();
    }

    toggleReviewPanel() {
        this.isReviewPanelOpen = !this.isReviewPanelOpen;
        if (!this.isReviewPanelOpen && this.isMeasureActive) {
            this.toggleMeasure();
        }
        this.renderUI();
    }

    async loadReviewCatalog() {
        if (!this.isReviewPocEnabled()) {
            return;
        }

        const pdfDocument = this.pdfViewer && this.pdfViewer.pdfDocument;
        if (!pdfDocument) {
            return;
        }

        const pageCount = this.pdfViewer.pagesCount || pdfDocument.numPages || 0;
        let pageLabels = null;
        let ocConfig = null;

        try {
            pageLabels = await pdfDocument.getPageLabels();
        } catch (err) {
            pageLabels = null;
        }

        try {
            ocConfig = await pdfDocument.getOptionalContentConfig();
        } catch (err) {
            ocConfig = null;
        }

        this.reviewSheets = getSheetLabels(pageLabels, pageCount);
        this.reviewOcConfig = ocConfig;
        this.reviewLayers = getLayerItems(ocConfig);
        this.renderReviewPanel();
        this.loadSheetThumbnails();
    }

    /**
     * Render each layout page as a thumbnail, same renderer as the left rail.
     *
     * @return {Promise<void>}
     */
    async loadSheetThumbnails() {
        if (!this.isReviewPocEnabled() || !this.pdfViewer || !this.reviewSheets.length) {
            return;
        }

        if (!this.sheetThumbnailer) {
            this.sheetThumbnailer = new Thumbnail(this.pdfViewer, this.preloader);
        }

        try {
            await this.sheetThumbnailer.init();
        } catch (err) {
            return;
        }

        const sheets = this.reviewSheets;
        await Promise.all(
            sheets.map(async (sheet, index) => {
                try {
                    const thumbnailSrc = await this.sheetThumbnailer.getThumbnailDataURL(sheet.pageNumber, {
                        thumbMaxWidth: 240,
                    });
                    if (this.reviewSheets[index]) {
                        this.reviewSheets[index] = { ...this.reviewSheets[index], thumbnailSrc };
                    }
                } catch (err) {
                    // Leave the sheet as a labeled placeholder if render fails.
                }
            }),
        );

        this.renderReviewPanel();
    }

    handleLayerToggle(id, visible) {
        if (!this.reviewOcConfig || typeof this.reviewOcConfig.setVisibility !== 'function' || !this.pdfViewer) {
            return;
        }

        this.reviewOcConfig.setVisibility(id, visible);
        this.pdfViewer.optionalContentConfigPromise = Promise.resolve(this.reviewOcConfig);
        this.reviewLayers = getLayerItems(this.reviewOcConfig);
        this.renderReviewPanel();
    }

    toggleMeasure() {
        this.isMeasureActive = !this.isMeasureActive;
        this.measurePoints = [];
        this.measureResult = null;
        this.measureHint = this.isMeasureActive
            ? 'Click the first point on the sheet.'
            : 'Click Measure, then two points on the same sheet.';
        this.docEl.classList.toggle('bp-AutoCADReview-measuring', this.isMeasureActive);
        this.clearMeasureOverlay();
        this.renderReviewPanel();
    }

    handleMeasureClick(event) {
        if (!this.isMeasureActive || !this.pdfViewer) {
            return;
        }

        const pageEl = event.target && event.target.closest && event.target.closest('.page');
        if (!pageEl || !this.docEl.contains(pageEl)) {
            return;
        }

        const pageNumber = parseInt(pageEl.dataset.pageNumber, 10);
        const pageView = this.pdfViewer.getPageView(pageNumber - 1);
        if (!pageNumber || !pageView || !pageView.viewport) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rect = pageEl.getBoundingClientRect();
        const pdfPoint = pageView.viewport.convertToPdfPoint(event.clientX - rect.left, event.clientY - rect.top);
        const point = {
            pageNumber,
            pdfX: pdfPoint[0],
            pdfY: pdfPoint[1],
        };

        if (this.measurePoints.length === 1 && this.measurePoints[0].pageNumber !== pageNumber) {
            this.measureHint = 'Pick the second point on the same sheet.';
            this.renderReviewPanel();
            return;
        }

        this.measurePoints = this.measurePoints.concat(point);

        if (this.measurePoints.length === 1) {
            this.measureHint = 'Click the second point.';
            this.drawMeasureOverlay();
            this.renderReviewPanel();
            return;
        }

        const pdfDistance = getPdfDistance(this.measurePoints[0], this.measurePoints[1]);
        this.measureResult = { pdfDistance };
        this.isMeasureActive = false;
        this.docEl.classList.remove('bp-AutoCADReview-measuring');
        this.measureHint = this.measureScale
            ? null
            : 'Scale is unknown — PDF-unit distance is shown. Calibrate with a known length.';
        this.drawMeasureOverlay();
        this.renderReviewPanel();
    }

    calibrateMeasure(knownLength, unit) {
        if (!this.measureResult) {
            return;
        }
        const scale = createScaleFromCalibration(this.measureResult.pdfDistance, knownLength, unit);
        if (!scale) {
            return;
        }
        this.measureScale = scale;
        this.measureHint = 'Scale saved. Measure again to use it.';
        this.renderReviewPanel();
    }

    clearMeasureScale() {
        this.measureScale = null;
        this.measureHint = 'Scale cleared. Measure a known length to calibrate.';
        this.renderReviewPanel();
    }

    drawMeasureOverlay() {
        this.clearMeasureOverlay();
        if (!this.measurePoints.length || !this.pdfViewer) {
            return;
        }

        const { pageNumber } = this.measurePoints[0];
        const pageEl = this.docEl.querySelector(`.page[data-page-number="${pageNumber}"]`);
        const pageView = this.pdfViewer.getPageView(pageNumber - 1);
        if (!pageEl || !pageView || !pageView.viewport) {
            return;
        }

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'bp-AutoCADMeasure-svg');
        svg.setAttribute('viewBox', `0 0 ${pageView.viewport.width} ${pageView.viewport.height}`);
        svg.setAttribute('preserveAspectRatio', 'none');

        const toViewport = point => pageView.viewport.convertToViewportPoint(point.pdfX, point.pdfY);

        const addDot = point => {
            const [x, y] = toViewport(point);
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', String(x));
            circle.setAttribute('cy', String(y));
            circle.setAttribute('r', '5');
            circle.setAttribute('fill', '#f5c518');
            circle.setAttribute('stroke', '#111');
            circle.setAttribute('stroke-width', '1');
            svg.appendChild(circle);
        };

        this.measurePoints.forEach(addDot);

        if (this.measurePoints.length === 2) {
            const [x1, y1] = toViewport(this.measurePoints[0]);
            const [x2, y2] = toViewport(this.measurePoints[1]);
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', String(x1));
            line.setAttribute('y1', String(y1));
            line.setAttribute('x2', String(x2));
            line.setAttribute('y2', String(y2));
            line.setAttribute('stroke', '#f5c518');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }

        pageEl.appendChild(svg);
        this.measureSvgEl = svg;
    }

    clearMeasureOverlay() {
        if (this.measureSvgEl && this.measureSvgEl.parentNode) {
            this.measureSvgEl.parentNode.removeChild(this.measureSvgEl);
        }
        this.measureSvgEl = null;
    }

    renderReviewPanel() {
        if (!this.reviewPanelRoot || !this.isReviewPocEnabled()) {
            return;
        }

        if (!this.isReviewPanelOpen) {
            this.reviewPanelRoot.render(null);
            return;
        }

        const pdfDistance = this.measureResult && this.measureResult.pdfDistance;
        const measureDistanceLabel = pdfDistance == null ? null : formatMeasureDistance(pdfDistance, this.measureScale);
        const scaleLabel = this.measureScale
            ? `1 PDF unit = ${this.measureScale.unitsPerPdfUnit.toFixed(6)} ${this.measureScale.unit}`.trim()
            : null;

        this.reviewPanelRoot.render(
            <AutoCADReviewPanel
                currentPage={(this.pdfViewer && this.pdfViewer.currentPageNumber) || 1}
                hasScale={Boolean(this.measureScale)}
                isMeasureActive={this.isMeasureActive}
                layers={this.reviewLayers}
                measureDistanceLabel={measureDistanceLabel}
                measureHint={this.measureHint}
                onCalibrate={this.calibrateMeasure}
                onClearScale={this.clearMeasureScale}
                onClose={this.toggleReviewPanel}
                onExplode={this.openExplodedView}
                onLayerToggle={this.handleLayerToggle}
                onMeasureToggle={this.toggleMeasure}
                onSheetSelect={this.setPage}
                scaleLabel={scaleLabel}
                sheets={this.reviewSheets}
            />,
        );
    }

    /**
     * Experimental exploded view: each visible layer group of the current sheet
     * becomes a glowing plane in a three.js stack.
     *
     * @return {Promise<void>}
     */
    async openExplodedView() {
        if (this.explodeHostEl || !this.pdfViewer || !this.pdfViewer.pdfDocument) {
            return;
        }

        const pageNumber = this.pdfViewer.currentPageNumber || 1;
        const sheet = (this.reviewSheets || []).find(item => item.pageNumber === pageNumber);
        const groups = groupLayersForExplode(this.reviewLayers);
        const token = Symbol('explode');

        this.explodeToken = token;
        this.explodeState = {
            activeIndex: null,
            autoRotate: true,
            layers: [],
            progressLabel: null,
            sheetLabel: sheet ? sheet.label : `Page ${pageNumber}`,
            spread: 0.65,
            status: 'loading',
        };
        this.explodeHostEl = document.createElement('div');
        this.explodeHostEl.className = 'bp-AutoCADExplodeHost';
        this.containerEl.appendChild(this.explodeHostEl);
        this.explodeRoot = createRoot(this.explodeHostEl);
        this.renderExplodedView();

        const isCancelled = () => this.explodeToken !== token;

        try {
            const [sceneModule, result] = await Promise.all([
                import(/* webpackChunkName: "autocad-exploded-scene" */ './AutoCADExplodedScene'),
                renderLayerCanvases({
                    groups,
                    isCancelled,
                    onProgress: (done, total) => {
                        if (!isCancelled()) {
                            this.updateExplodedView({ progressLabel: `Rendering layer ${done} of ${total}…` });
                        }
                    },
                    pageNumber,
                    pdfDocument: this.pdfViewer.pdfDocument,
                }),
            ]);

            if (isCancelled() || !result) {
                if (result) {
                    result.layers.forEach(layer => releaseCanvas(layer.canvas));
                }
                return;
            }

            this.explodeCanvases = result.layers.map(layer => layer.canvas);
            if (!result.layers.length || !this.explodeStageEl) {
                this.updateExplodedView({ status: 'empty' });
                return;
            }

            const Scene = sceneModule.default;
            this.explodeScene = new Scene(this.explodeStageEl, {
                onHover: index => this.updateExplodedView({ hoverIndex: index }),
                onSelect: index => this.updateExplodedView({ activeIndex: index }),
            });
            this.explodeScene.setLayers(result.layers, result.aspect);
            this.explodeScene.setAutoRotate(this.explodeState.autoRotate);
            this.explodeScene.setSpread(this.explodeState.spread);

            this.updateExplodedView({
                layers: result.layers.map(({ color, key, name }) => ({ color, key, name })),
                status: 'ready',
            });
        } catch (err) {
            if (!isCancelled()) {
                this.updateExplodedView({ status: 'error' });
            }
        }
    }

    closeExplodedView() {
        this.explodeToken = null;
        if (this.explodeScene) {
            this.explodeScene.destroy();
            this.explodeScene = null;
        }
        (this.explodeCanvases || []).forEach(releaseCanvas);
        this.explodeCanvases = null;
        if (this.explodeRoot) {
            this.explodeRoot.unmount();
            this.explodeRoot = null;
        }
        if (this.explodeHostEl && this.explodeHostEl.parentNode) {
            this.explodeHostEl.parentNode.removeChild(this.explodeHostEl);
        }
        this.explodeHostEl = null;
        this.explodeStageEl = null;
    }

    handleExplodeStageRef(el) {
        this.explodeStageEl = el;
    }

    handleExplodeSpread(spread) {
        if (this.explodeScene) {
            this.explodeScene.setSpread(spread);
        }
        this.updateExplodedView({ spread });
    }

    handleExplodeAutoRotate() {
        const autoRotate = !this.explodeState.autoRotate;
        if (this.explodeScene) {
            this.explodeScene.setAutoRotate(autoRotate);
        }
        this.updateExplodedView({ autoRotate });
    }

    handleExplodeFocus(index) {
        if (this.explodeScene) {
            this.explodeScene.setFocus(index);
        }
        this.updateExplodedView({ activeIndex: index });
    }

    handleExplodeHover(index) {
        if (this.explodeScene) {
            this.explodeScene.setHover(index);
        }
    }

    handleExplodeReset() {
        if (this.explodeScene) {
            this.explodeScene.resetCamera();
        }
    }

    updateExplodedView(changes) {
        if (!this.explodeState) {
            return;
        }
        const { hoverIndex, ...rest } = changes;
        this.explodeState = { ...this.explodeState, ...rest };
        if (hoverIndex !== undefined) {
            this.explodeState.hoverIndex = hoverIndex;
        }
        this.renderExplodedView();
    }

    renderExplodedView() {
        if (!this.explodeRoot) {
            return;
        }
        const { activeIndex, hoverIndex, ...state } = this.explodeState;
        this.explodeRoot.render(
            <AutoCADExplodedView
                {...state}
                activeIndex={hoverIndex != null ? hoverIndex : activeIndex}
                onAutoRotateToggle={this.handleExplodeAutoRotate}
                onClose={this.closeExplodedView}
                onLayerFocus={this.handleExplodeFocus}
                onLayerHover={this.handleExplodeHover}
                onResetCamera={this.handleExplodeReset}
                onSpreadChange={this.handleExplodeSpread}
                onStageRef={this.handleExplodeStageRef}
            />,
        );
    }

    teardownReviewPoc() {
        this.closeExplodedView();
        if (this.docEl) {
            this.docEl.removeEventListener('click', this.handleMeasureClick, true);
            this.docEl.classList.remove('bp-AutoCADReview-measuring');
        }
        this.clearMeasureOverlay();
        if (this.sheetThumbnailer) {
            this.sheetThumbnailer.destroy();
            this.sheetThumbnailer = null;
        }
        if (this.reviewPanelRoot) {
            this.reviewPanelRoot.unmount();
            this.reviewPanelRoot = null;
        }
        if (this.reviewPanelHostEl && this.reviewPanelHostEl.parentNode) {
            this.reviewPanelHostEl.parentNode.removeChild(this.reviewPanelHostEl);
        }
        this.reviewPanelHostEl = null;
    }
}

export default AutoCADViewer;
