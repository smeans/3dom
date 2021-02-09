import { OrbitControls } from './OrbitControls.js';

document.addEventListener('DOMContentLoaded', async (e) => {
    const iframe = document.querySelector('iframe');
    const source = document.querySelector('textarea');

    source.addEventListener('input', async (e) => {
        iframe.srcdoc = source.value;

        return false;
    });

    iframe.addEventListener('load', (e) => {
        refreshScene(e.target.contentDocument.body);
    });

    initThree();
});

let canvas;
let renderer;

function initThree() {
    canvas = document.querySelector('canvas');
    renderer = new THREE.WebGLRenderer({canvas});
}

function refreshScene(el) {
    startRender(el);
}

function getUniqueColor(n) {
    const rgb = [0, 0, 0];

    for (let i = 0; i < 24; i++) {
        rgb[i%3] <<= 1;
        rgb[i%3] |= n & 0x01;
        n >>= 1;
    }

    return rgb.reduce((a, c) => (a << 8) | c, 0);
}

const ELEMENT_DEPTH_PX = 10;

function shapeForElement(el, color) {
    const rect = el.getBoundingClientRect();

    const geometry = new THREE.BoxGeometry(pixelToScene(rect.width), pixelToScene(rect.height), pixelToScene(ELEMENT_DEPTH_PX));
    const material = new THREE.MeshStandardMaterial({color: color});
    const mesh = new THREE.Mesh(geometry, material);

    mesh.geometry.computeBoundingBox();

    return mesh;
}

const FOV_DEGREES = 75;
const FOV_FACTOR = 1.1;
const PX_SCALE_FACTOR = 1000.0;

function pixelToScene(px) {
    return px/PX_SCALE_FACTOR;
}

function cameraOnMesh(mesh) {
    const boundingBox = mesh.geometry.boundingBox;
    const maxDimension = Math.max(boundingBox.max.x - boundingBox.min.x,
            boundingBox.max.y - boundingBox.min.y);

    const zOffset = ((maxDimension/2)*FOV_FACTOR)
            /Math.sin((FOV_DEGREES/2)*(Math.PI/180));

    const aspect = canvas.offsetWidth/canvas.offsetHeight;

    const camera = new THREE.PerspectiveCamera(FOV_DEGREES, aspect, 0.1, zOffset*10);
    camera.position.z = zOffset;

    return camera;
}

function lightForCamera(camera) {
    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    const zOffset = camera.position.z;

    light.position.set(-zOffset*.1, zOffset*.2, zOffset);

    return light;
}

let currentScene;
let currentPage;
let currentCamera;

let renderStack;

function addElementToScene(el, level) {
    const shape = shapeForElement(el, getUniqueColor(level+111));
    const bbox = currentPage.geometry.boundingBox;

    let rect = el.getBoundingClientRect();
    shape.position.x = bbox.min.x + pixelToScene(rect.x + rect.width/2);
    shape.position.y = bbox.max.y - pixelToScene(rect.y + rect.height/2);
    shape.position.z = pixelToScene(level * ELEMENT_DEPTH_PX * 2.5);

    currentScene.add(shape);
}

function countParents(el) {
    let c = 0;

    while (el.parentElement) {
        el = el.parentElement;
        c++;
    }

    return c;
}

function renderNextElement() {
    if (!renderStack.length) {
        return;
    }

    const nextElement = renderStack.pop();
    const level = countParents(nextElement);
    console.log(level, nextElement);

    addElementToScene(nextElement, level);

    if (nextElement.nextElementSibling) {
        renderStack.push(nextElement.nextElementSibling);
    }

    if (nextElement.firstElementChild) {
        renderStack.push(nextElement.firstElementChild);
    }
}

let lastElementRenderTime;
let renderDelayMs = 200.0;

function resizeRendererToDisplaySize() {
  const pixelRatio = window.devicePixelRatio;
  const width  = canvas.clientWidth  * pixelRatio | 0;
  const height = canvas.clientHeight * pixelRatio | 0;
  const needResize = canvas.width !== width || canvas.height !== height;

  if (needResize) {
    renderer.setSize(width, height, false);
  }

  return needResize;
}

function renderStep(time) {
    if (resizeRendererToDisplaySize()) {
        canvas = renderer.domElement;
        currentCamera.aspect = canvas.clientWidth / canvas.clientHeight;
        currentCamera.updateProjectionMatrix();
    }

    if (!lastElementRenderTime || (time - lastElementRenderTime) > renderDelayMs) {
        renderNextElement();

        lastElementRenderTime = time;
    }

    renderer.render(currentScene, currentCamera);

    requestAnimationFrame(renderStep);
}

function startRender(body) {
    renderStack = [];

    currentPage = shapeForElement(body, 0xffffff);

    currentScene = new THREE.Scene();
    currentScene.add(currentPage);

    currentCamera = cameraOnMesh(currentPage);

    currentScene.add(lightForCamera(currentCamera));
    currentScene.add(new THREE.AmbientLight(0x808080));

    const controls = new OrbitControls(currentCamera, canvas);
    controls.minAzimuthAngle = -Math.PI/2;
    controls.maxAzimuthAngle = Math.PI/2;
    controls.minPolarAngle = Math.PI/2-Math.PI/16;
    controls.maxPolarAngle = Math.PI/2+Math.PI/16;

    if (body.firstElementChild) {
        renderStack.push(body.firstElementChild);
    }

    requestAnimationFrame(renderStep);
}
