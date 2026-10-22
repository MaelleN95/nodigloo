import * as THREE from 'three';

// Chaque bloc suit la courbure du dôme, avec une épaisseur et six faces fermées.
function createIceBlock(thetaStart: number, thetaEnd: number, phiStart: number, phiEnd: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const point = (radius: number, theta: number, phi: number) => [
    radius * Math.sin(theta) * Math.sin(phi),
    radius * Math.cos(theta),
    radius * Math.sin(theta) * Math.cos(phi),
  ];
  const face = (sample: (u: number, v: number) => number[], reverse = false) => {
    const offset = positions.length / 3;
    const steps = 4;
    for (let v = 0; v <= steps; v += 1) {
      for (let u = 0; u <= steps; u += 1) {
        positions.push(...sample(u / steps, v / steps));
      }
    }
    for (let v = 0; v < steps; v += 1) {
      for (let u = 0; u < steps; u += 1) {
        const a = offset + v * (steps + 1) + u;
        const b = a + 1;
        const c = a + steps + 1;
        const triangles = [a, c, b, b, c, c + 1];
        indices.push(...(reverse ? triangles.reverse() : triangles));
      }
    }
  };
  const theta = (v: number) => THREE.MathUtils.lerp(thetaStart, thetaEnd, v);
  const phi = (u: number) => THREE.MathUtils.lerp(phiStart, phiEnd, u);
  const radius = (v: number) => THREE.MathUtils.lerp(1.27, 1.45, v);
  face((u, v) => point(1.45, theta(v), phi(u)));
  face((u, v) => point(1.27, theta(v), phi(u)), true);
  face((u, v) => point(radius(v), thetaStart, phi(u)));
  face((u, v) => point(radius(v), thetaEnd, phi(u)), true);
  face((u, v) => point(radius(u), theta(v), phiStart));
  face((u, v) => point(radius(u), theta(v), phiEnd), true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createIglooScene(
  container: HTMLDivElement,
  onContextLost: () => void,
  onAnimationChange: (enabled: boolean) => void,
) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const scene = new THREE.Scene();
  let frame = 0;
  let resizeObserver: ResizeObserver | undefined;
  let visibilityObserver: IntersectionObserver | undefined;
  let animationEnabled = true;
  let angle = 0.43;
  let height = 2.7;
  let targetAngle = angle;
  let targetHeight = height;
  let previousTime: number | undefined;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
  let visible = true;
  let disposed = false;

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    window.cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    window.removeEventListener('pointermove', pointerMoved);
    document.removeEventListener('pointerleave', resetPointer);
    window.removeEventListener('blur', resetPointer);
    document.removeEventListener('visibilitychange', update);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) {
        object.shadow.dispose();
      }
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };

  function draw(time: number) {
    if (animationEnabled) {
      const delta = previousTime === undefined ? 1 / 60 : Math.min((time - previousTime) / 1000, 0.05);
      angle = THREE.MathUtils.damp(angle, targetAngle, 5, delta);
      height = THREE.MathUtils.damp(height, targetHeight, 5, delta);
    }
    previousTime = animationEnabled ? time : undefined;
    camera.position.set(Math.sin(angle) * 6.6, height, Math.cos(angle) * 6.6);
    camera.lookAt(0, 0.6, 0.2);
    renderer.render(scene, camera);
  }

  function update() {
    window.cancelAnimationFrame(frame);
    if (disposed || !visible || document.hidden) {
      previousTime = undefined;
      return;
    }
    draw(performance.now());
    if (animationEnabled && (Math.abs(angle - targetAngle) > 0.0001 || Math.abs(height - targetHeight) > 0.0001)) {
      frame = window.requestAnimationFrame(update);
    } else {
      previousTime = undefined;
    }
  }

  function pointerMoved(event: PointerEvent) {
    if (!animationEnabled || event.pointerType !== 'mouse') {
      return;
    }
    const x = THREE.MathUtils.clamp(event.clientX / window.innerWidth * 2 - 1, -1, 1);
    const y = THREE.MathUtils.clamp(event.clientY / window.innerHeight * 2 - 1, -1, 1);
    targetAngle = 0.43 + x * 0.16;
    targetHeight = 2.7 - y * 0.25;
    update();
  }

  function resetPointer() {
    targetAngle = 0.43;
    targetHeight = 2.7;
    update();
  }

  function setAnimationEnabled(enabled: boolean) {
    if (disposed) {
      return;
    }
    animationEnabled = enabled;
    onAnimationChange(enabled);
    targetAngle = angle;
    targetHeight = height;
    update();
  }

  function contextLost(event: Event) {
    event.preventDefault();
    console.error('Le contexte WebGL de l’illustration a été perdu');
    dispose();
    onContextLost();
  }

  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.append(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x334957, 1.6));
    const moonlight = new THREE.DirectionalLight(0xe5f5ff, 2.6);
    moonlight.position.set(-3, 5, 4);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(1024, 1024);
    moonlight.shadow.camera.left = -3;
    moonlight.shadow.camera.right = 3;
    moonlight.shadow.camera.top = 3;
    moonlight.shadow.camera.bottom = -3;
    moonlight.shadow.normalBias = 0.025;
    scene.add(moonlight);
    const rimLight = new THREE.DirectionalLight(0x8ac8ec, 2);
    rimLight.position.set(3, 2, -3);
    scene.add(rimLight);

    const ice = [0xb8dfed, 0xc9e8f1, 0xa3cfdf, 0xd9edf4].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05 }),
    );
    for (let row = 0; row < 5; row += 1) {
      const thetaStart = row * Math.PI / 10 + 0.012;
      const thetaEnd = (row + 1) * Math.PI / 10 - 0.012;
      const count = [5, 9, 13, 16, 18][row];
      const step = Math.PI * 2 / count;
      for (let block = 0; block < count; block += 1) {
        const center = block * step + (row % 2 === 0 ? 0 : step / 2);
        const frontAngle = Math.atan2(Math.sin(center), Math.cos(center));
        if (row >= 3 && Math.abs(frontAngle) < 0.46) {
          continue;
        }
        const mesh = new THREE.Mesh(
          createIceBlock(thetaStart, thetaEnd, center - step / 2 + 0.012, center + step / 2 - 0.012),
          ice[(row + block) % ice.length],
        );
        scene.add(mesh);
      }
    }

    const tunnelDepth = 0.72;
    for (let index = 0; index < 7; index += 1) {
      const start = index * Math.PI / 7 + 0.025;
      const end = (index + 1) * Math.PI / 7 - 0.025;
      const shape = new THREE.Shape();
      shape.absarc(0, 0.49, 0.59, start, end, false);
      shape.lineTo(Math.cos(end) * 0.39, 0.49 + Math.sin(end) * 0.39);
      shape.absarc(0, 0.49, 0.39, end, start, true);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: tunnelDepth, bevelEnabled: true, bevelSize: 0.012,
        bevelThickness: 0.012, bevelSegments: 2, steps: 1, curveSegments: 6,
      });
      const block = new THREE.Mesh(geometry, ice[index % ice.length]);
      block.position.z = 1.06;
      scene.add(block);
    }
    for (const side of [-1, 1]) {
      for (let row = 0; row < 2; row += 1) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.23, tunnelDepth), ice[row]);
        pillar.position.set(side * 0.49, 0.12 + row * 0.25, 1.42);
        scene.add(pillar);
      }
    }

    const doorway = new THREE.Shape();
    doorway.moveTo(-0.39, 0);
    doorway.lineTo(-0.39, 0.49);
    doorway.absarc(0, 0.49, 0.39, Math.PI, 0, true);
    doorway.lineTo(0.39, 0);
    doorway.closePath();
    const door = new THREE.Mesh(
      new THREE.ShapeGeometry(doorway),
      new THREE.MeshBasicMaterial({ color: 0xffbd50 }),
    );
    door.position.z = 1.075;
    scene.add(door);
    const warmth = new THREE.PointLight(0xffb33d, 1.5, 3, 2);
    warmth.position.set(0, 0.4, 1.95);
    scene.add(warmth);

    const snow = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 2.02, 0.1, 64),
      new THREE.MeshStandardMaterial({ color: 0xb5d3df, roughness: 0.9 }),
    );
    snow.position.set(0, -0.08, 0.15);
    scene.add(snow);
    const path = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xffcc70, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    path.rotation.x = -Math.PI / 2;
    path.scale.set(0.8, 1.5, 1);
    path.position.set(0, -0.023, 1.2);
    scene.add(path);

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
        object.castShadow = object !== snow;
        object.receiveShadow = true;
      }
    });

    resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        update();
      }
    });
    resizeObserver.observe(container);
    visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    visibilityObserver.observe(container);
    window.addEventListener('pointermove', pointerMoved);
    document.addEventListener('pointerleave', resetPointer);
    window.addEventListener('blur', resetPointer);
    document.addEventListener('visibilitychange', update);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    onAnimationChange(animationEnabled);
    update();
    return { dispose, setAnimationEnabled };
  } catch (error) {
    dispose();
    throw error;
  }
}
