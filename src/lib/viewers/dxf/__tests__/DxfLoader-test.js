import DxfLoader from '../DxfLoader';
import DxfRenderViewer from '../DxfRenderViewer';
import DxfViewer from '../DxfViewer';

const file = {
    extension: 'dxf',
    representations: {
        entries: [{ representation: 'ORIGINAL' }],
    },
};

describe('lib/viewers/dxf/DxfLoader', () => {
    const originalSearch = window.location.search;

    afterEach(() => {
        window.history.replaceState({}, '', `${window.location.pathname}${originalSearch}`);
    });

    test('should ignore dxf unless dxfReview=1', () => {
        window.history.replaceState({}, '', `${window.location.pathname}?dxfReview=0`);
        expect(DxfLoader.determineViewer(file)).toBeUndefined();
    });

    test('should claim the original representation when dxfReview=1', () => {
        window.history.replaceState({}, '', `${window.location.pathname}?dxfReview=1`);
        const viewer = DxfLoader.determineViewer(file);
        expect(viewer.NAME).toBe('DXF');
        expect(viewer.REP).toBe('ORIGINAL');
    });

    test('should pick the viewer library from ?dxfRenderer', () => {
        window.history.replaceState({}, '', `${window.location.pathname}?dxfReview=1&dxfRenderer=dxf-render`);
        expect(DxfLoader.determineViewer(file).CONSTRUCTOR).toBe(DxfRenderViewer);

        window.history.replaceState({}, '', `${window.location.pathname}?dxfReview=1`);
        expect(DxfLoader.determineViewer(file).CONSTRUCTOR).toBe(DxfViewer);
    });

    test('should add an original representation from the download url', () => {
        window.history.replaceState({}, '', `${window.location.pathname}?dxfReview=1`);
        const bare = {
            extension: 'DXF',
            authenticated_download_url: 'https://dl.boxcloud.com/file',
            representations: { entries: [] },
        };
        const viewer = DxfLoader.determineViewer(bare);
        expect(viewer.NAME).toBe('DXF');
        expect(bare.representations.entries[0].representation).toBe('ORIGINAL');
    });
});
