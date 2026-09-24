import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutoCADReviewPanel from '../AutoCADReviewPanel';

describe('AutoCADReviewPanel', () => {
    const getWrapper = (props = {}) =>
        render(
            <AutoCADReviewPanel
                currentPage={1}
                hasScale={false}
                isMeasureActive={false}
                layers={[]}
                onCalibrate={jest.fn()}
                onClose={jest.fn()}
                onLayerToggle={jest.fn()}
                onMeasureToggle={jest.fn()}
                onSheetSelect={jest.fn()}
                sheets={[]}
                {...props}
            />,
        );

    test('should show an honest empty state when the PDF has no OCGs', () => {
        getWrapper();
        expect(screen.getByTestId('bp-AutoCADReviewPanel-layersEmpty')).toHaveTextContent(
            'This PDF has no optional content groups',
        );
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    test('should jump to a sheet via setPage when a label is clicked', async () => {
        const onSheetSelect = jest.fn();
        getWrapper({
            onSheetSelect,
            sheets: [
                { pageNumber: 1, label: 'Layout1' },
                { pageNumber: 2, label: 'C-101' },
            ],
        });

        await userEvent.click(screen.getByRole('button', { name: /c-101/i }));
        expect(onSheetSelect).toHaveBeenCalledWith(2);
    });
});
