import React from 'react';
import AnnotationsControls, { Props as AnnotationsControlsProps } from '../controls/annotations';
import ControlsBar, { ControlsBarGroup } from '../controls/controls-bar';
import DrawingControls, { Props as DrawingControlsProps } from '../controls/annotations/DrawingControls';
import ExperiencesProvider, { Props as ExperiencesProviderProps } from '../controls/experiences';
import FindBarToggle, { Props as FindBarToggleProps } from '../controls/findbar';
import FullscreenToggle, { Props as FullscreenToggleProps } from '../controls/fullscreen';
import GalleryToggle, { Props as GalleryToggleProps } from '../controls/gallery';
import PageControls, { Props as PageControlsProps } from '../controls/page';
import RotateControl, { Props as RotateControlProps } from '../controls/rotate/RotateControl';
import ThumbnailsToggle, { Props as ThumbnailsToggleProps } from '../controls/sidebar';
import ZoomControls, { Props as ZoomControlsProps } from '../controls/zoom';
import AutoCADReviewToggle, { Props as AutoCADReviewToggleProps } from './AutoCADReviewToggle';

export type Props = AnnotationsControlsProps &
    DrawingControlsProps &
    ExperiencesProviderProps &
    FindBarToggleProps &
    FullscreenToggleProps &
    GalleryToggleProps &
    PageControlsProps &
    Partial<RotateControlProps> &
    ThumbnailsToggleProps &
    ZoomControlsProps &
    AutoCADReviewToggleProps & {
        hasGalleryZoom?: boolean;
    };

export default function DocControls({
    annotationColor,
    annotationMode,
    experiences,
    hasDrawing,
    hasGalleryZoom = false,
    hasHighlight,
    hasRegion,
    isDwgReviewOpen,
    isGalleryOpen,
    isThumbnailsOpen,
    maxScale,
    minScale,
    onAnnotationColorChange,
    onAnnotationModeClick,
    onAnnotationModeEscape,
    onDwgReviewToggle,
    onFindBarToggle,
    onFullscreenToggle,
    onGalleryToggle,
    onPageChange,
    onPageSubmit,
    onRotateLeft,
    onThumbnailsToggle,
    onZoomIn,
    onZoomOut,
    pageCount,
    pageNumber,
    scale,
}: Props): JSX.Element {
    return (
        <ExperiencesProvider experiences={experiences}>
            <ControlsBar>
                {!isGalleryOpen && (
                    <>
                        <ControlsBarGroup>
                            <ThumbnailsToggle
                                isThumbnailsOpen={isThumbnailsOpen}
                                onThumbnailsToggle={onThumbnailsToggle}
                            />
                            <FindBarToggle onFindBarToggle={onFindBarToggle} />
                            <AutoCADReviewToggle
                                isDwgReviewOpen={isDwgReviewOpen}
                                onDwgReviewToggle={onDwgReviewToggle}
                            />
                        </ControlsBarGroup>
                        <ControlsBarGroup isDistinct>
                            <PageControls
                                onPageChange={onPageChange}
                                onPageSubmit={onPageSubmit}
                                pageCount={pageCount}
                                pageNumber={pageNumber}
                            />
                        </ControlsBarGroup>
                    </>
                )}
                {(!isGalleryOpen || hasGalleryZoom) && (
                    <ControlsBarGroup isDistinct>
                        <ZoomControls
                            maxScale={maxScale}
                            minScale={minScale}
                            onZoomIn={onZoomIn}
                            onZoomOut={onZoomOut}
                            resinTargetZoomIn={isGalleryOpen ? 'galleryZoomIn' : undefined}
                            resinTargetZoomOut={isGalleryOpen ? 'galleryZoomOut' : undefined}
                            scale={scale}
                        />
                    </ControlsBarGroup>
                )}
                {!isGalleryOpen && onRotateLeft && (
                    <ControlsBarGroup>
                        <RotateControl onRotateLeft={onRotateLeft} />
                    </ControlsBarGroup>
                )}
                <ControlsBarGroup>
                    <GalleryToggle isGalleryOpen={isGalleryOpen} onGalleryToggle={onGalleryToggle} />
                    <FullscreenToggle onFullscreenToggle={onFullscreenToggle} />
                    {!isGalleryOpen && (
                        <AnnotationsControls
                            annotationColor={annotationColor}
                            annotationMode={annotationMode}
                            hasDrawing={hasDrawing}
                            hasHighlight={hasHighlight}
                            hasRegion={hasRegion}
                            onAnnotationModeClick={onAnnotationModeClick}
                            onAnnotationModeEscape={onAnnotationModeEscape}
                        />
                    )}
                </ControlsBarGroup>
            </ControlsBar>
            {!isGalleryOpen && (
                <ControlsBar>
                    <DrawingControls
                        annotationColor={annotationColor}
                        annotationMode={annotationMode}
                        onAnnotationColorChange={onAnnotationColorChange}
                    />
                </ControlsBar>
            )}
        </ExperiencesProvider>
    );
}
