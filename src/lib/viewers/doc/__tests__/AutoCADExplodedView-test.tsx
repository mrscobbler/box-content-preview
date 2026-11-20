import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutoCADExplodedView, { Props } from '../AutoCADExplodedView';

describe('AutoCADExplodedView', () => {
    const layers = [
        { color: '#6f8ba8', key: '__base__', name: 'Sheet (no layer)' },
        { color: '#3ee0ff', key: 'A', name: 'A-WALL' },
    ];

    const getWrapper = (props: Partial<Props> = {}) =>
        render(
            <AutoCADExplodedView
                activeIndex={null}
                autoRotate
                layers={layers}
                onAutoRotateToggle={jest.fn()}
                onClose={jest.fn()}
                onLayerFocus={jest.fn()}
                onLayerHover={jest.fn()}
                onResetCamera={jest.fn()}
                onSpreadChange={jest.fn()}
                onStageRef={jest.fn()}
                sheetLabel="A-101"
                spread={0.65}
                status="ready"
                {...props}
            />,
        );

    test('should show progress while layers render', () => {
        getWrapper({ progressLabel: 'Rendering layer 2 of 5…', status: 'loading' });
        expect(screen.getByRole('status')).toHaveTextContent('Rendering layer 2 of 5…');
        expect(screen.queryByRole('slider')).toBeNull();
    });

    test('should explain when the sheet has no layer content', () => {
        getWrapper({ status: 'empty' });
        expect(screen.getByRole('status')).toHaveTextContent('No layer content on this sheet');
    });

    test('should list layers top of stack first and focus on click', async () => {
        const onLayerFocus = jest.fn();
        getWrapper({ onLayerFocus });

        const names = screen.getAllByRole('button', { pressed: false }).map(button => button.textContent);
        expect(names.indexOf('A-WALL')).toBeLessThan(names.indexOf('Sheet (no layer)'));

        await userEvent.click(screen.getByRole('button', { name: 'A-WALL' }));
        expect(onLayerFocus).toHaveBeenCalledWith(1);
    });

    test('should report spread changes as 0–1', () => {
        const onSpreadChange = jest.fn();
        getWrapper({ onSpreadChange });
        fireEvent.change(screen.getByRole('slider'), { target: { value: '30' } });
        expect(onSpreadChange).toHaveBeenCalledWith(0.3);
    });

    test('should close on Escape', () => {
        const onClose = jest.fn();
        getWrapper({ onClose });
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
