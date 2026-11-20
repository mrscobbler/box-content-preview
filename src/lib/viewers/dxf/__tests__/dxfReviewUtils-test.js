import { getDxfEngine, isDxfReviewPocEnabled } from '../dxfReviewUtils';

describe('lib/viewers/dxf/dxfReviewUtils', () => {
    test('should follow the dxfReview query string', () => {
        expect(isDxfReviewPocEnabled(undefined, '', 'production')).toBe(false);
        expect(isDxfReviewPocEnabled(undefined, '?dxfReview=0', 'development')).toBe(false);
        expect(isDxfReviewPocEnabled(undefined, '?dxfReview=1', 'production')).toBe(true);
        expect(isDxfReviewPocEnabled(undefined, '?token=abc&dxfReview=true', 'production')).toBe(true);
    });

    test('should default on outside production and test', () => {
        expect(isDxfReviewPocEnabled(undefined, '', 'development')).toBe(true);
        expect(isDxfReviewPocEnabled(undefined, '', 'dev')).toBe(true);
        expect(isDxfReviewPocEnabled(undefined, '', 'test')).toBe(false);
        expect(isDxfReviewPocEnabled(undefined, '', 'production')).toBe(false);
    });

    test('should honor the DXF viewer option', () => {
        expect(isDxfReviewPocEnabled({ DXF: { enableDxfReviewPoc: true } }, '', 'production')).toBe(true);
        expect(isDxfReviewPocEnabled({ DXF: { enableDxfReviewPoc: false } }, '', 'development')).toBe(false);
    });

    test('should default to dxf-viewer and switch with ?dxfRenderer', () => {
        expect(getDxfEngine(undefined, '')).toBe('dxf-viewer');
        expect(getDxfEngine(undefined, '?dxfRenderer=dxf-render')).toBe('dxf-render');
        expect(getDxfEngine({ DXF: { renderer: 'dxf-render' } }, '')).toBe('dxf-render');
        expect(getDxfEngine(undefined, '?dxfRenderer=other')).toBe('dxf-viewer');
    });
});
