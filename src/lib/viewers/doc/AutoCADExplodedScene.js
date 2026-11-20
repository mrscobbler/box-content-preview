import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getExplodeOffsets } from './autocadReviewUtils';

const PLANE_WIDTH = 10;
const MAX_STACK_HEIGHT = 9;
const MAX_GAP = 2.4;
const IDLE_OPACITY = 0.9;
const DIM_OPACITY = 0.12;

/**
 * @param {string} text
 * @param {string} color
 * @return {THREE.Sprite}
 */
function createLabel(text, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 44;
    const font = `600 ${fontSize}px "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.font = font;
    const label = text.length > 28 ? `${text.slice(0, 27)}…` : text;
    canvas.width = Math.ceil(ctx.measureText(label).width) + 48;
    canvas.height = fontSize + 28;

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillRect(0, canvas.height / 2 - 2, 16, 4);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillText(label, 28, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ depthWrite: false, map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    const height = 0.42;
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
    sprite.center.set(0, 0.5);
    return sprite;
}

export default class AutoCADExplodedScene {
    /**
     * @param {HTMLElement} hostEl
     * @param {Object} [callbacks]
     * @param {function(number|null): void} [callbacks.onHover]
     * @param {function(number|null): void} [callbacks.onSelect]
     */
    constructor(hostEl, { onHover = () => {}, onSelect = () => {} } = {}) {
        this.hostEl = hostEl;
        this.onHover = onHover;
        this.onSelect = onSelect;
        this.layers = [];
        this.spread = 0;
        this.targetSpread = 0;
        this.hoverIndex = null;
        this.focusIndex = null;
        this.pointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.pointerDown = null;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.domElement.className = 'bp-AutoCADExplode-canvas';
        hostEl.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x02070d, 24, 48);
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
        this.camera.position.set(11, 9.5, 13);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.autoRotateSpeed = 0.55;
        this.controls.minDistance = 4;
        this.controls.maxDistance = 45;

        this.stack = new THREE.Group();
        this.scene.add(this.stack);

        this.grid = new THREE.GridHelper(40, 40, 0x1b6f8f, 0x0d3347);
        this.grid.material.transparent = true;
        this.grid.material.opacity = 0.35;
        this.grid.material.depthWrite = false;
        this.scene.add(this.grid);

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerLeave = this.handlePointerLeave.bind(this);
        this.tick = this.tick.bind(this);

        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        canvas.addEventListener('pointerup', this.handlePointerUp);
        canvas.addEventListener('pointerleave', this.handlePointerLeave);

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(hostEl);
        this.resize();
        this.frameId = requestAnimationFrame(this.tick);
    }

    /**
     * @param {Array<{name: string, color: string, canvas: HTMLCanvasElement}>} layers - bottom to top
     * @param {number} aspect - page width / height
     * @return {void}
     */
    setLayers(layers, aspect) {
        this.clearLayers();
        const width = PLANE_WIDTH;
        const height = PLANE_WIDTH / (aspect || 1);
        const geometry = new THREE.PlaneGeometry(width, height);
        geometry.rotateX(-Math.PI / 2);
        const edges = new THREE.EdgesGeometry(geometry);
        const anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        this.planeGeometry = geometry;
        this.edgeGeometry = edges;
        this.planeHeight = height;

        this.layers = layers.map((layer, index) => {
            const color = new THREE.Color(layer.color);
            const group = new THREE.Group();

            const texture = new THREE.CanvasTexture(layer.canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = anisotropy;

            const ink = new THREE.Mesh(
                geometry,
                new THREE.MeshBasicMaterial({
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    map: texture,
                    opacity: IDLE_OPACITY,
                    side: THREE.DoubleSide,
                    transparent: true,
                }),
            );
            ink.userData.layerIndex = index;

            const glass = new THREE.Mesh(
                geometry,
                new THREE.MeshBasicMaterial({
                    blending: THREE.AdditiveBlending,
                    color,
                    depthWrite: false,
                    opacity: 0.035,
                    side: THREE.DoubleSide,
                    transparent: true,
                }),
            );
            glass.position.y = -0.002;

            const frame = new THREE.LineSegments(
                edges,
                new THREE.LineBasicMaterial({ color, opacity: 0.45, transparent: true }),
            );

            const label = createLabel(layer.name, layer.color);
            label.position.set(width / 2 + 0.35, 0, -height / 2 + 0.25);

            group.add(glass, ink, frame, label);
            this.stack.add(group);

            return { frame, glass, group, ink, label, texture };
        });

        this.struts = new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(
                [
                    [-width / 2, -height / 2],
                    [width / 2, -height / 2],
                    [width / 2, height / 2],
                    [-width / 2, height / 2],
                ].flatMap(([x, z]) => [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 1, z)]),
            ),
            new THREE.LineBasicMaterial({ color: 0x3ee0ff, opacity: 0.25, transparent: true }),
        );
        this.scene.add(this.struts);

        this.spread = 0;
        this.applySpread();
        this.applyHighlight();
    }

    /**
     * @param {number} value - 0 (flat) to 1 (fully exploded)
     * @return {void}
     */
    setSpread(value) {
        this.targetSpread = Math.min(1, Math.max(0, Number(value) || 0));
    }

    /**
     * @param {boolean} enabled
     * @return {void}
     */
    setAutoRotate(enabled) {
        this.controls.autoRotate = Boolean(enabled);
    }

    /**
     * Sticky highlight from the legend or a click; null clears it.
     *
     * @param {number|null} index
     * @return {void}
     */
    setFocus(index) {
        this.focusIndex = index;
        this.applyHighlight();
    }

    /**
     * Transient highlight from hovering the legend.
     *
     * @param {number|null} index
     * @return {void}
     */
    setHover(index) {
        this.hoverIndex = index;
        this.applyHighlight();
    }

    resetCamera() {
        this.camera.position.set(11, 9.5, 13);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    applySpread() {
        const count = this.layers.length;
        const gap = count > 1 ? Math.min(MAX_GAP, MAX_STACK_HEIGHT / (count - 1)) * this.spread : 0;
        const offsets = getExplodeOffsets(count, gap);
        const lift = (count > 1 ? ((count - 1) * gap) / 2 : 0) + 0.02;

        this.layers.forEach((layer, index) => {
            layer.group.position.y = offsets[index] + lift;
        });
        this.grid.position.y = 0;

        if (this.struts) {
            const top = count ? offsets[count - 1] + lift : 0;
            const bottom = count ? offsets[0] + lift : 0;
            this.struts.visible = top - bottom > 0.01;
            this.struts.position.y = bottom;
            this.struts.scale.y = Math.max(0.0001, top - bottom);
        }
        this.controls.target.y = lift * 0.6;
    }

    applyHighlight() {
        const active = this.hoverIndex != null ? this.hoverIndex : this.focusIndex;
        this.layers.forEach((layer, index) => {
            const isActive = active === index;
            const isDimmed = active != null && !isActive;
            layer.ink.material.opacity = isDimmed ? DIM_OPACITY : IDLE_OPACITY;
            layer.glass.material.opacity = isActive ? 0.09 : 0.035;
            let frameOpacity = 0.45;
            if (isActive) {
                frameOpacity = 1;
            } else if (isDimmed) {
                frameOpacity = 0.12;
            }
            layer.frame.material.opacity = frameOpacity;
            layer.label.material.opacity = isDimmed ? 0.3 : 1;
        });
    }

    pick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObjects(
            this.layers.map(layer => layer.ink),
            false,
        );
        return hits.length ? hits[0].object.userData.layerIndex : null;
    }

    handlePointerDown(event) {
        this.pointerDown = { x: event.clientX, y: event.clientY };
    }

    handlePointerMove(event) {
        if (event.buttons) {
            return;
        }
        const index = this.pick(event);
        if (index !== this.hoverIndex) {
            this.hoverIndex = index;
            this.renderer.domElement.style.cursor = index == null ? 'grab' : 'pointer';
            this.applyHighlight();
            this.onHover(index);
        }
    }

    handlePointerUp(event) {
        const start = this.pointerDown;
        this.pointerDown = null;
        if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
            return;
        }
        const index = this.pick(event);
        this.focusIndex = index === this.focusIndex ? null : index;
        this.applyHighlight();
        this.onSelect(this.focusIndex);
    }

    handlePointerLeave() {
        if (this.hoverIndex != null) {
            this.hoverIndex = null;
            this.applyHighlight();
            this.onHover(null);
        }
    }

    resize() {
        const width = this.hostEl.clientWidth || 1;
        const height = this.hostEl.clientHeight || 1;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    tick() {
        this.frameId = requestAnimationFrame(this.tick);
        if (Math.abs(this.targetSpread - this.spread) > 0.0005) {
            this.spread += (this.targetSpread - this.spread) * 0.09;
            this.applySpread();
        }
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    clearLayers() {
        this.layers.forEach(layer => {
            layer.texture.dispose();
            layer.ink.material.dispose();
            layer.glass.material.dispose();
            layer.frame.material.dispose();
            layer.label.material.map.dispose();
            layer.label.material.dispose();
            this.stack.remove(layer.group);
        });
        this.layers = [];
        if (this.struts) {
            this.struts.geometry.dispose();
            this.struts.material.dispose();
            this.scene.remove(this.struts);
            this.struts = null;
        }
        if (this.planeGeometry) {
            this.planeGeometry.dispose();
            this.edgeGeometry.dispose();
            this.planeGeometry = null;
            this.edgeGeometry = null;
        }
    }

    destroy() {
        cancelAnimationFrame(this.frameId);
        this.resizeObserver.disconnect();
        const canvas = this.renderer.domElement;
        canvas.removeEventListener('pointerdown', this.handlePointerDown);
        canvas.removeEventListener('pointermove', this.handlePointerMove);
        canvas.removeEventListener('pointerup', this.handlePointerUp);
        canvas.removeEventListener('pointerleave', this.handlePointerLeave);
        this.clearLayers();
        this.grid.geometry.dispose();
        this.grid.material.dispose();
        this.controls.dispose();
        this.renderer.dispose();
        if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
    }
}
