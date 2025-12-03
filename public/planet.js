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

  // Create Earth-like planet
  const geometry = new THREE.SphereGeometry(1.5, 64, 64);

  // Create custom shader material for realistic Earth
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;

      // Simple noise function
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        // Ocean color (blue)
        vec3 oceanColor = vec3(0.1, 0.3, 0.8);
        // Land color (green)
        vec3 landColor = vec3(0.2, 0.6, 0.3);
        // Ice caps (white)
        vec3 iceColor = vec3(0.9, 0.95, 1.0);

        // Create land masses using noise
        float n = noise(vUv * 8.0 + time * 0.1);
        float landMask = step(0.45, n);

        // Mix ocean and land
        vec3 baseColor = mix(oceanColor, landColor, landMask);

        // Add ice caps at poles
        float iceMask = smoothstep(0.8, 1.0, abs(vUv.y - 0.5) * 2.0);
        baseColor = mix(baseColor, iceColor, iceMask * 0.7);

        // Calculate lighting (simple directional light)
        vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
        float diff = max(dot(vNormal, lightDir), 0.0);

        // Add ambient light
        float ambient = 0.4;
        float lighting = ambient + diff * 0.6;

        // Add atmospheric glow on edges
        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
        vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);

        vec3 finalColor = baseColor * lighting;
        finalColor += atmosphereColor * fresnel * 0.3;

        // Add slight cloud effect
        float clouds = noise(vUv * 12.0 - time * 0.05) * 0.3;
        clouds = smoothstep(0.4, 0.6, clouds);
        finalColor = mix(finalColor, vec3(1.0), clouds * 0.4);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  });

  planet = new THREE.Mesh(geometry, material);
  planet.position.set(2, 0, 0); // Position planet to the right
  scene.add(planet);

  // Create stars background
  const starsGeometry = new THREE.BufferGeometry();
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.02,
    transparent: true,
    opacity: 0.8
  });

  const starsVertices = [];
  for (let i = 0; i < 3000; i++) {
    const x = (Math.random() - 0.5) * 20;
    const y = (Math.random() - 0.5) * 20;
    const z = (Math.random() - 0.5) * 20;
    starsVertices.push(x, y, z);
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

  // Rotate planet slowly
  if (planet) {
    planet.rotation.y += 0.002;
    planet.material.uniforms.time.value += 0.01;
  }

  // Rotate stars very slowly
  if (stars) {
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
