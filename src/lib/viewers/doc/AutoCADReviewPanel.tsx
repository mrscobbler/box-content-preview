import React from 'react';
import './AutoCADReviewPanel.scss';

export type SheetItem = {
    label: string;
    pageNumber: number;
};

export type LayerItem = {
    id: string;
    name: string;
    visible: boolean;
};

export type Props = {
    currentPage: number;
    hasScale: boolean;
    isMeasureActive: boolean;
    layers: LayerItem[];
    measureDistanceLabel?: string | null;
    measureHint?: string | null;
    onCalibrate: (knownLength: string, unit: string) => void;
    onClearScale?: () => void;
    onClose: () => void;
    onLayerToggle: (id: string, visible: boolean) => void;
    onMeasureToggle: () => void;
    onSheetSelect: (pageNumber: number) => void;
    scaleLabel?: string | null;
    sheets: SheetItem[];
};

const UNITS = ['ft', 'in', 'm', 'mm', 'yd'];

export default function AutoCADReviewPanel({
    currentPage,
    hasScale,
    isMeasureActive,
    layers,
    measureDistanceLabel,
    measureHint,
    onCalibrate,
    onClearScale,
    onClose,
    onLayerToggle,
    onMeasureToggle,
    onSheetSelect,
    scaleLabel,
    sheets,
}: Props): JSX.Element {
    const [knownLength, setKnownLength] = React.useState('');
    const [unit, setUnit] = React.useState('ft');

    const handleCalibrate = (event: React.FormEvent): void => {
        event.preventDefault();
        onCalibrate(knownLength, unit);
    };

    return (
        <aside className="bp-AutoCADReviewPanel" data-testid="bp-AutoCADReviewPanel">
            <header className="bp-AutoCADReviewPanel-header">
                <div>
                    <h2 className="bp-AutoCADReviewPanel-title">Drawing review</h2>
                    <p className="bp-AutoCADReviewPanel-badge">Experimental POC</p>
                </div>
                <button
                    className="bp-AutoCADReviewPanel-close"
                    onClick={onClose}
                    title="Hide drawing review"
                    type="button"
                >
                    ×
                </button>
            </header>

            <section className="bp-AutoCADReviewPanel-section">
                <h3 className="bp-AutoCADReviewPanel-heading">Sheets</h3>
                {sheets.length === 0 ? (
                    <p className="bp-AutoCADReviewPanel-empty">No pages in this PDF yet.</p>
                ) : (
                    <ul className="bp-AutoCADReviewPanel-list">
                        {sheets.map(sheet => (
                            <li key={sheet.pageNumber}>
                                <button
                                    aria-current={sheet.pageNumber === currentPage ? 'page' : undefined}
                                    className={`bp-AutoCADReviewPanel-sheet${
                                        sheet.pageNumber === currentPage ? ' bp-is-current' : ''
                                    }`}
                                    onClick={(): void => onSheetSelect(sheet.pageNumber)}
                                    type="button"
                                >
                                    <span className="bp-AutoCADReviewPanel-sheetIndex">{sheet.pageNumber}</span>
                                    <span className="bp-AutoCADReviewPanel-sheetLabel">{sheet.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="bp-AutoCADReviewPanel-section">
                <h3 className="bp-AutoCADReviewPanel-heading">Layers</h3>
                {layers.length === 0 ? (
                    <p className="bp-AutoCADReviewPanel-empty" data-testid="bp-AutoCADReviewPanel-layersEmpty">
                        This PDF has no optional content groups. CAD layers were not exported, so none can be toggled.
                    </p>
                ) : (
                    <ul className="bp-AutoCADReviewPanel-list">
                        {layers.map(layer => (
                            <li key={layer.id}>
                                <label className="bp-AutoCADReviewPanel-layer" htmlFor={`bp-dwg-layer-${layer.id}`}>
                                    <input
                                        checked={layer.visible}
                                        id={`bp-dwg-layer-${layer.id}`}
                                        onChange={(event): void => onLayerToggle(layer.id, event.target.checked)}
                                        type="checkbox"
                                    />
                                    <span>{layer.name}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="bp-AutoCADReviewPanel-section">
                <h3 className="bp-AutoCADReviewPanel-heading">Measure</h3>
                <p className="bp-AutoCADReviewPanel-help">
                    Click two points on the current sheet. pdf.js has no ruler — this overlay is local to the POC.
                </p>
                <button
                    aria-pressed={isMeasureActive}
                    className={`bp-AutoCADReviewPanel-measureBtn${isMeasureActive ? ' bp-is-active' : ''}`}
                    onClick={onMeasureToggle}
                    type="button"
                >
                    {isMeasureActive ? 'Cancel measure' : 'Measure distance'}
                </button>
                {measureHint && <p className="bp-AutoCADReviewPanel-hint">{measureHint}</p>}
                {measureDistanceLabel && (
                    <p className="bp-AutoCADReviewPanel-distance" data-testid="bp-AutoCADReviewPanel-distance">
                        {measureDistanceLabel}
                    </p>
                )}
                {hasScale && scaleLabel && <p className="bp-AutoCADReviewPanel-scale">Scale: {scaleLabel}</p>}
                {!hasScale && measureDistanceLabel && (
                    <form className="bp-AutoCADReviewPanel-calibrate" onSubmit={handleCalibrate}>
                        <p className="bp-AutoCADReviewPanel-help">
                            Scale is unknown. Enter the known length of this segment to calibrate.
                        </p>
                        <div className="bp-AutoCADReviewPanel-calibrateRow">
                            <input
                                aria-label="Known length"
                                min="0"
                                onChange={(event): void => setKnownLength(event.target.value)}
                                placeholder="Length"
                                step="any"
                                type="number"
                                value={knownLength}
                            />
                            <select
                                aria-label="Unit"
                                onChange={(event): void => setUnit(event.target.value)}
                                value={unit}
                            >
                                {UNITS.map(item => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                            <button type="submit">Calibrate</button>
                        </div>
                    </form>
                )}
                {hasScale && onClearScale && (
                    <button className="bp-AutoCADReviewPanel-textBtn" onClick={onClearScale} type="button">
                        Clear scale
                    </button>
                )}
            </section>
        </aside>
    );
}
