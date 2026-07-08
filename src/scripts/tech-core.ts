import * as THREE from "three";

const canvas = document.querySelector<HTMLCanvasElement>("[data-tech-core]");
const panel = canvas?.closest<HTMLElement>(".tech-core-panel");

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const smallViewport = window.matchMedia("(max-width: 760px)").matches;

if (canvas && panel && !prefersReducedMotion && !smallViewport) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  const group = new THREE.Group();
  scene.add(group);

  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0c2a4d,
    emissive: 0x0063d8,
    emissiveIntensity: 0.45,
    roughness: 0.32,
    metalness: 0.72,
    transmission: 0.12,
    transparent: true,
    opacity: 0.92,
  });

  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x62dcff,
    wireframe: true,
    transparent: true,
    opacity: 0.34,
  });

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.42, 4), coreMaterial);
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.72, 2), wireMaterial);
  group.add(core, wire);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x007aff,
    transparent: true,
    opacity: 0.34,
  });

  const rings = [0, 1, 2].map((index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.28 + index * 0.18, 0.012, 12, 160), ringMaterial);
    ring.rotation.x = Math.PI / 2.4 + index * 0.36;
    ring.rotation.y = index * 0.64;
    group.add(ring);
    return ring;
  });

  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 180;
  const positions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    const radius = 2.8 + Math.random() * 1.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[index * 3 + 2] = radius * Math.cos(phi);
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0x9be8ff,
      size: 0.028,
      transparent: true,
      opacity: 0.72,
    }),
  );
  group.add(particles);

  scene.add(new THREE.AmbientLight(0x4f8cff, 1.2));
  const key = new THREE.PointLight(0x62dcff, 26, 18);
  key.position.set(3.5, 3.2, 5.2);
  scene.add(key);
  const violet = new THREE.PointLight(0x7f73ff, 16, 16);
  violet.position.set(-4.8, -2.4, 3.6);
  scene.add(violet);

  const pointer = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);

  panel.addEventListener("pointermove", (event) => {
    const rect = panel.getBoundingClientRect();
    target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    target.y = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });

  const resize = () => {
    const rect = panel.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };

  const startedAt = performance.now();
  let frame = 0;

  const animate = () => {
    frame = window.requestAnimationFrame(animate);
    const elapsed = (performance.now() - startedAt) / 1000;

    pointer.lerp(target, 0.045);
    group.rotation.y = elapsed * 0.16 + pointer.x * 0.18;
    group.rotation.x = Math.sin(elapsed * 0.22) * 0.14 + pointer.y * 0.14;
    core.rotation.y = elapsed * 0.28;
    wire.rotation.x = elapsed * 0.18;
    particles.rotation.y = -elapsed * 0.035;
    rings.forEach((ring, index) => {
      ring.rotation.z = elapsed * (0.09 + index * 0.025);
    });

    renderer.render(scene, camera);
  };

  resize();
  animate();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else if (!document.hidden && !frame) {
      animate();
    }
  });
} else if (panel) {
  panel.dataset.techCoreStatic = "true";
}
