import {
    createScaleFromCalibration,
    formatMeasureDistance,
    getLayerItems,
    getPdfDistance,
    getSheetLabels,
    isDwgReviewPocEnabled,
} from '../autocadReviewUtils';

describe('lib/viewers/doc/autocadReviewUtils', () => {
    describe('getSheetLabels()', () => {
        test('should fall back to Page N when labels are missing', () => {
            expect(getSheetLabels(null, 3)).toEqual([
                { pageNumber: 1, label: 'Page 1' },
                { pageNumber: 2, label: 'Page 2' },
                { pageNumber: 3, label: 'Page 3' },
            ]);
        });

        test('should use pdf.js page labels when present', () => {
            expect(getSheetLabels(['Layout1', 'C-101'], 2)).toEqual([
                { pageNumber: 1, label: 'Layout1' },
                { pageNumber: 2, label: 'C-101' },
            ]);
        });

        test('should fall back per page when a label is blank', () => {
            expect(getSheetLabels(['A-101', '  ', null], 3)).toEqual([
                { pageNumber: 1, label: 'A-101' },
                { pageNumber: 2, label: 'Page 2' },
                { pageNumber: 3, label: 'Page 3' },
            ]);
        });
    });

    describe('getLayerItems()', () => {
        test('should return an empty list when the PDF has no OCGs', () => {
            expect(getLayerItems(null)).toEqual([]);
            expect(
                getLayerItems({
                    getGroups: () => null,
                    getOrder: () => null,
                }),
            ).toEqual([]);
            expect(
                getLayerItems({
                    getGroups: () => ({}),
                    getOrder: () => [],
                }),
            ).toEqual([]);
        });

        test('should read names and visibility from the PDF config', () => {
            expect(
                getLayerItems({
                    getGroups: () => ({
                        '2': { name: 'Defpoints', visible: false },
                        '1': { name: 'C-ROAD', visible: true },
                    }),
                    getOrder: () => ['1', '2'],
                }),
            ).toEqual([
                { id: '1', name: 'C-ROAD', visible: true },
                { id: '2', name: 'Defpoints', visible: false },
            ]);
        });
    });

    describe('measure helpers', () => {
        test('should compute pdf-space distance and format with or without scale', () => {
            expect(getPdfDistance({ pdfX: 0, pdfY: 0 }, { pdfX: 3, pdfY: 4 })).toBe(5);
            expect(formatMeasureDistance(5)).toBe('5.00 PDF units');
            expect(formatMeasureDistance(5, { unitsPerPdfUnit: 2, unit: 'ft' })).toBe('10.00 ft');
        });

        test('should create a scale from a known length', () => {
            expect(createScaleFromCalibration(10, 40, 'ft')).toEqual({ unitsPerPdfUnit: 4, unit: 'ft' });
            expect(createScaleFromCalibration(0, 40, 'ft')).toBeNull();
        });
    });

    describe('isDwgReviewPocEnabled()', () => {
        test('should honor the dwgReview query param over defaults', () => {
            expect(isDwgReviewPocEnabled({}, () => undefined, 'production', '?dwgReview=1')).toBe(true);
            expect(isDwgReviewPocEnabled({}, () => undefined, 'development', '?dwgReview=0')).toBe(false);
        });

        test('should default on in local/dev and off in production and tests', () => {
            expect(isDwgReviewPocEnabled({}, () => undefined, 'development', '')).toBe(true);
            expect(isDwgReviewPocEnabled({}, () => undefined, 'production', '')).toBe(false);
            expect(isDwgReviewPocEnabled({}, () => undefined, 'test', '')).toBe(false);
        });
    });
});
