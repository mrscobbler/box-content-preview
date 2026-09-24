import React from 'react';
import './AutoCADReviewToggle.scss';

export type Props = {
    isDwgReviewOpen?: boolean;
    onDwgReviewToggle?: () => void;
};

function IconDwgReview24(): JSX.Element {
    return (
        <svg data-testid="IconDwgReview24" focusable="false" height="1em" role="img" viewBox="0 0 24 24" width="1em">
            <path
                d="M5 4h9a1 1 0 0 1 1 1v6h-2V6H6v12h7v2H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm11.5 8.5 4 4-1.4 1.4-1.1-1.1-3.2 3.2-1.4-1.4 3.2-3.2-1.1-1.1 1-1.8ZM7 8h5v2H7V8Zm0 4h4v2H7v-2Z"
                fill="#fff"
            />
        </svg>
    );
}

export default function AutoCADReviewToggle({ isDwgReviewOpen, onDwgReviewToggle }: Props): JSX.Element | null {
    if (!onDwgReviewToggle) {
        return null;
    }

    return (
        <button
            aria-pressed={isDwgReviewOpen}
            className={`bp-AutoCADReviewToggle${isDwgReviewOpen ? ' bp-is-active' : ''}`}
            data-resin-target="dwgReviewPoc"
            data-testid="bp-AutoCADReviewToggle"
            onClick={onDwgReviewToggle}
            title="Drawing review (experimental)"
            type="button"
        >
            <IconDwgReview24 />
        </button>
    );
}
