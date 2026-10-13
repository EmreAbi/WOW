import { useEffect, useRef } from "react";
import * as THREE from "three";

// A seeded field keeps the composition stable across visits and React remounts.
function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function circleGeometry(radius, start = 0, length = Math.PI * 2) {
  const points = [];
  const segments = Math.ceil((100 * length) / (Math.PI * 2));
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + (i / segments) * length;
    points.push(
      new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

/** Decorative only; the atlas remains fully usable without WebGL. */
export default function ArcaneScene({ reducedMotion = false, className = "" }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        failIfMajorPerformanceCaveat: true,
      });
    } catch {
      // Fantasy artwork underneath remains the complete, deliberate fallback.
      return undefined;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 4.75, -4.75, 0.1, 50);
    camera.position.z = 15;
    const orbit = new THREE.Group();
    const armillary = new THREE.Group();
    orbit.add(armillary);
    scene.add(orbit);

    const gold = new THREE.Color("#c9a46a");
    const ice = new THREE.Color("#8eb8cb");
    const ringMaterial = new THREE.LineBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const iceMaterial = new THREE.LineBasicMaterial({
      color: ice,
      transparent: true,
      opacity: 0.115,
      depthWrite: false,
    });
    const accentMaterial = new THREE.LineBasicMaterial({
      color: gold,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    const equator = new THREE.Line(circleGeometry(2.65), ringMaterial);
    equator.rotation.x = 0.73;
    equator.rotation.y = -0.24;
    armillary.add(equator);

    const meridian = new THREE.Line(circleGeometry(2.65), iceMaterial);
    meridian.rotation.y = 1.05;
    meridian.rotation.z = -0.3;
    armillary.add(meridian);

    const outerOrbit = new THREE.Line(circleGeometry(3.0), ringMaterial);
    outerOrbit.rotation.x = 1.18;
    outerOrbit.rotation.z = -0.52;
    armillary.add(outerOrbit);

    const arc = new THREE.Line(
      circleGeometry(2.79, 0.15, 1.15),
      accentMaterial,
    );
    arc.rotation.copy(equator.rotation);
    armillary.add(arc);

    const smallArc = new THREE.Line(
      circleGeometry(2.8, 3.65, 0.5),
      iceMaterial,
    );
    smallArc.rotation.copy(meridian.rotation);
    armillary.add(smallArc);

    // Small radial inscriptions suggest an astronomical instrument, without a grid.
    const tickPositions = [];
    for (let i = 0; i < 36; i += 1) {
      if (i % 5 === 0) continue;
      const angle = (i / 36) * Math.PI * 2;
      const inner = i % 3 === 0 ? 2.87 : 2.91;
      tickPositions.push(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        0,
        Math.cos(angle) * 2.96,
        Math.sin(angle) * 2.96,
        0,
      );
    }
    const tickGeometry = new THREE.BufferGeometry();
    tickGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(tickPositions, 3),
    );
    const ticks = new THREE.LineSegments(tickGeometry, ringMaterial);
    ticks.rotation.copy(equator.rotation);
    armillary.add(ticks);

    const random = seededRandom(19941123);
    const particleCount = window.innerWidth < 700 ? 75 : 150;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3] = (random() - 0.5) * 24;
      positions[i * 3 + 1] = (random() - 0.5) * 12;
      positions[i * 3 + 2] = random() * 4 - 2;
      const color = random() > 0.7 ? ice : gold;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      sizes[i] = 1.5 + random() * 2.1;
      phases[i] = random() * Math.PI * 2;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    dustGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    dustGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    dustGeometry.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    const dustMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        attribute float phase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.16 + phase) * 0.13;
          p.x += cos(uTime * 0.1 + phase) * 0.08;
          vColor = color;
          vOpacity = 0.28 + 0.18 * sin(uTime * 0.4 + phase);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * uPixelRatio;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.05, 0.5, distanceFromCenter)) * vOpacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    scene.add(dust);

    let frame = 0;
    let previousTime = 0;
    let elapsed = 0;
    let inView = true;
    let disposed = false;
    let contextLost = false;
    let aspect = 1;
    let scrollTarget = 0;
    let scrollPosition = 0;
    const pointerTarget = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };

    const render = () => {
      if (!disposed && !contextLost) renderer.render(scene, camera);
    };

    const animate = (time) => {
      frame = 0;
      if (disposed || contextLost || !inView || document.hidden) return;
      const delta = previousTime
        ? Math.min((time - previousTime) / 1000, 0.05)
        : 0;
      previousTime = time;
      elapsed += delta;
      const easing = 1 - Math.exp(-delta * 3);
      pointer.x += (pointerTarget.x - pointer.x) * easing;
      pointer.y += (pointerTarget.y - pointer.y) * easing;
      scrollPosition += (scrollTarget - scrollPosition) * easing;
      armillary.rotation.set(
        0.13 + Math.sin(elapsed * 0.07) * 0.05 + pointer.y * 0.06,
        elapsed * 0.022 + pointer.x * 0.08,
        -0.2 + scrollPosition * 0.07,
      );
      orbit.position.y = 0.12 + pointer.y * 0.06 + scrollPosition * 0.24;
      dust.position.x = pointer.x * 0.045;
      dust.position.y = pointer.y * 0.035;
      dustMaterial.uniforms.uTime.value = elapsed;
      render();
      frame = window.requestAnimationFrame(animate);
    };

    const syncAnimation = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      if (!inView || document.hidden || contextLost || disposed) return;
      if (reducedMotion) render();
      else frame = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      if (disposed || contextLost) return;
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      aspect = width / height;
      camera.left = -4.75 * aspect;
      camera.right = 4.75 * aspect;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      dustMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      orbit.position.x = 9.5 * aspect * (width < 700 ? 0.25 : 0.275);
      orbit.position.y = 0.12;
      orbit.scale.setScalar(width < 700 ? 0.65 : 1);
      dust.scale.x = Math.max(1, aspect / 2.4);
      render();
    };

    const onPointerMove = (event) => {
      if (!inView) return;
      const rect = host.getBoundingClientRect();
      pointerTarget.x = THREE.MathUtils.clamp(
        (event.clientX - rect.left) / rect.width - 0.5,
        -0.5,
        0.5,
      );
      pointerTarget.y = THREE.MathUtils.clamp(
        0.5 - (event.clientY - rect.top) / rect.height,
        -0.5,
        0.5,
      );
    };
    const onScroll = () => {
      if (!inView) return;
      const rect = host.getBoundingClientRect();
      scrollTarget = THREE.MathUtils.clamp(
        -rect.top / Math.max(rect.height, 1),
        -1,
        1,
      );
    };
    const onContextLost = (event) => {
      event.preventDefault();
      contextLost = true;
      canvas.style.opacity = "0";
      syncAnimation();
    };
    const onContextRestored = () => {
      contextLost = false;
      canvas.style.opacity = "1";
      resize();
      syncAnimation();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(host);
    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              inView = entry.isIntersecting;
              syncAnimation();
            },
            { rootMargin: "50px" },
          )
        : null;
    intersectionObserver?.observe(host);

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", syncAnimation);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    armillary.rotation.set(0.13, 0, -0.2);
    resize();
    syncAnimation();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", syncAnimation);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [reducedMotion]);

  return (
    <div
      ref={hostRef}
      className={`arcane-scene ${className}`.trim()}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    />
  );
}
