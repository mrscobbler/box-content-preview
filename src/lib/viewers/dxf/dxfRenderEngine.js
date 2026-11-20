import * as THREE from 'three';
import {
    createThreeObjectsFromDXF,
    loadFont,
    parseDxf,
    useCamera as createCameraHelpers,
    useControls as createControlHelpers,
} from 'dxf-render';
import { needsWideFont } from './dxfEncoding';

const FRUSTUM_HEIGHT = 100; // dxf-render's fitCameraToBox assumes a 100-unit tall frustum

/**
 * Parse DXF text with dxf-render and draw it in an orthographic three.js scene.
 * Lazy-loaded by DxfRenderViewer so the library stays out of the main bundle.
 *
 * @param {Object} params
 * @param {HTMLElement} params.container - Element the canvas is appended to
 * @param {string} params.text - Decoded DXF text
 * @param {string} params.fontUrl - Japanese-capable font, loaded only when the text needs it
 * @param {number} params.width
 * @param {number} params.height
 * @return {Promise<{resize: function(number, number): void, destroy: function(): void, summary: Object}>}
 */
export default async function createDxfRenderScene({ container, text, fontUrl, width, height }) {
    const dxf = parseDxf(text);
    const wideFont = needsWideFont(text);
    // Without a custom font dxf-render uses its built-in Liberation Sans (no CJK glyphs).
    const font = wideFont ? await loadFont(fontUrl) : undefined;
    const { group, unsupportedEntities, warnings } = await createThreeObjectsFromDXF(dxf, { font });

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 1);
    renderer.setSize(width, height, false);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(group);

    const camera = new THREE.OrthographicCamera(0, 0, FRUSTUM_HEIGHT / 2, FRUSTUM_HEIGHT / -2, 0.1, 1000);
    const setFrustum = (w, h) => {
        const aspect = w / h;
        camera.left = (FRUSTUM_HEIGHT * aspect) / -2;
        camera.right = (FRUSTUM_HEIGHT * aspect) / 2;
        camera.updateProjectionMatrix();
    };
    setFrustum(width, height);

    const render = () => renderer.render(scene, camera);

    const box = new THREE.Box3().setFromObject(group);
    createCameraHelpers().fitCameraToBox(box, camera);

    const controls = createControlHelpers();
    const mapControls = controls.initControls(camera, renderer.domElement);
    if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        controls.setTarget(center.x, center.y, 0);
    }
    controls.saveState();
    mapControls.addEventListener('change', render);
    render();

    return {
        resize(w, h) {
            renderer.setSize(w, h, false);
            setFrustum(w, h);
            render();
        },
        destroy() {
            controls.cleanup();
            group.traverse(object => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => material && material.dispose());
            });
            renderer.dispose();
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
        },
        summary: { unsupportedEntities, warnings, wideFont },
    };
}
