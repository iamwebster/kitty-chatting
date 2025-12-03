// 3D Planet Animation using Three.js
let scene, camera, renderer, planet, stars;
let isAnimating = true;

function initPlanet() {
  const canvas = document.getElementById('planet-canvas');
  if (!canvas) return;

  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 3;

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Planet removed - space theme with stars only

  // Create stars background with more stars for better space effect
  const starsGeometry = new THREE.BufferGeometry();
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.015,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });

  const starsVertices = [];
  const starsSizes = [];

  // Create more stars with varying sizes
  for (let i = 0; i < 6000; i++) {
    const x = (Math.random() - 0.5) * 30;
    const y = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 30;
    starsVertices.push(x, y, z);

    // Vary star sizes for more depth
    starsSizes.push(Math.random() * 2 + 0.5);
  }

  starsGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(starsVertices, 3)
  );

  stars = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(stars);

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);

  // Start animation
  animate();
}

function animate() {
  if (!isAnimating) return;

  requestAnimationFrame(animate);

  // Rotate stars slowly for subtle movement
  if (stars) {
    stars.rotation.x += 0.0001;
    stars.rotation.y += 0.0002;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function stopPlanetAnimation() {
  isAnimating = false;
}

function startPlanetAnimation() {
  isAnimating = true;
  animate();
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlanet);
} else {
  initPlanet();
}
