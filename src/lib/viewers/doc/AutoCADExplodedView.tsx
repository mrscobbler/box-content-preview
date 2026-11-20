import React from 'react';
import './AutoCADExplodedView.scss';

export type ExplodedLayer = {
    color: string;
    key: string;
    name: string;
};

export type ExplodedStatus = 'loading' | 'ready' | 'empty' | 'error';

export type Props = {
    activeIndex: number | null;
    autoRotate: boolean;
    layers: ExplodedLayer[];
    onAutoRotateToggle: () => void;
    onClose: () => void;
    onLayerFocus: (index: number | null) => void;
    onLayerHover: (index: number | null) => void;
    onResetCamera: () => void;
    onSpreadChange: (spread: number) => void;
    onStageRef: (el: HTMLDivElement | null) => void;
    progressLabel?: string | null;
    sheetLabel: string;
    spread: number;
    status: ExplodedStatus;
};

const STATUS_MESSAGES: Record<Exclude<ExplodedStatus, 'loading' | 'ready'>, string> = {
    empty: 'No layer content on this sheet. Turn on layers in the review panel or switch sheets.',
    error: 'Could not build the exploded view for this sheet.',
};

export default function AutoCADExplodedView({
    activeIndex,
    autoRotate,
    layers,
    onAutoRotateToggle,
    onClose,
    onLayerFocus,
    onLayerHover,
    onResetCamera,
    onSpreadChange,
    onStageRef,
    progressLabel,
    sheetLabel,
    spread,
    status,
}: Props): JSX.Element {
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return (): void => document.removeEventListener('keydown', handleKeyDown, true);
    }, [onClose]);

    return (
        <div
            aria-label="Exploded layer view"
            className="bp-AutoCADExplode"
            data-testid="bp-AutoCADExplode"
            role="dialog"
        >
            <div ref={onStageRef} className="bp-AutoCADExplode-stage" />
            <div aria-hidden className="bp-AutoCADExplode-scanlines" />

            <header className="bp-AutoCADExplode-hud">
                <div>
                    <p className="bp-AutoCADExplode-kicker">Experimental · Layer stack</p>
                    <h2 className="bp-AutoCADExplode-title">{sheetLabel}</h2>
                    {status === 'ready' && (
                        <p className="bp-AutoCADExplode-meta">
                            {layers.length} {layers.length === 1 ? 'plane' : 'planes'} · drag to orbit · scroll to zoom
                        </p>
                    )}
                </div>
                <button
                    aria-label="Close exploded view"
                    className="bp-AutoCADExplode-close"
                    onClick={onClose}
                    type="button"
                >
                    ×
                </button>
            </header>

            {status === 'loading' && (
                <div className="bp-AutoCADExplode-status" role="status">
                    <span className="bp-AutoCADExplode-spinner" />
                    {progressLabel || 'Preparing layers…'}
                </div>
            )}
            {(status === 'empty' || status === 'error') && (
                <div className="bp-AutoCADExplode-status" role="status">
                    {STATUS_MESSAGES[status]}
                </div>
            )}

            {status === 'ready' && (
                <>
                    <ul className="bp-AutoCADExplode-legend" onMouseLeave={(): void => onLayerHover(null)}>
                        {layers
                            .map((layer, index) => ({ index, layer }))
                            .reverse()
                            .map(({ index, layer }) => (
                                <li key={layer.key}>
                                    <button
                                        aria-pressed={activeIndex === index}
                                        className={`bp-AutoCADExplode-legendItem${
                                            activeIndex === index ? ' bp-is-active' : ''
                                        }`}
                                        onBlur={(): void => onLayerHover(null)}
                                        onClick={(): void => onLayerFocus(activeIndex === index ? null : index)}
                                        onFocus={(): void => onLayerHover(index)}
                                        onMouseEnter={(): void => onLayerHover(index)}
                                        type="button"
                                    >
                                        <span
                                            className="bp-AutoCADExplode-swatch"
                                            style={{
                                                backgroundColor: layer.color,
                                                boxShadow: `0 0 8px ${layer.color}`,
                                            }}
                                        />
                                        <span className="bp-AutoCADExplode-legendName">{layer.name}</span>
                                    </button>
                                </li>
                            ))}
                    </ul>

                    <div className="bp-AutoCADExplode-controls">
                        <label className="bp-AutoCADExplode-slider" htmlFor="bp-AutoCADExplode-spread">
                            <span>Spread</span>
                            <input
                                id="bp-AutoCADExplode-spread"
                                max="100"
                                min="0"
                                onChange={(event): void => onSpreadChange(Number(event.target.value) / 100)}
                                type="range"
                                value={Math.round(spread * 100)}
                            />
                        </label>
                        <button
                            aria-pressed={autoRotate}
                            className={`bp-AutoCADExplode-btn${autoRotate ? ' bp-is-active' : ''}`}
                            onClick={onAutoRotateToggle}
                            type="button"
                        >
                            Auto-rotate
                        </button>
                        <button className="bp-AutoCADExplode-btn" onClick={onResetCamera} type="button">
                            Reset view
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
