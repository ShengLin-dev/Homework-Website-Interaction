/**
 * Robot3DViewer - Modular Three.js 3D Engine for Interactive Cyber Robot
 * Handles Scene, Camera, Lighting, PBR Materials, Procedural Animations & GSAP Transitions
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

export class Robot3DViewer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) {
      throw new Error(`[Robot3D] Container element not found`);
    }

    this.options = {
      modelUrl: '/models/robot.glb',
      fallbackUrl: './public/models/robot.glb',
      accentColor: options.accentColor || 0x00f0ff,
      secondaryColor: options.secondaryColor || 0xff007f,
      ...options
    };

    // Core 3D objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    // Model & Meshes
    this.modelRoot = null;
    this.robotGroup = null;
    this.meshes = [];
    this.emissiveMaterials = [];
    this.reactorMeshes = [];

    // Animation & State flags
    this.isLoaded = false;
    this.isAnimating = true;
    this.isRotating = false;
    this.rotationSpeed = 0.8;
    this.initialCameraPos = new THREE.Vector3(0, 0.2, 2.6);
    this.initialTarget = new THREE.Vector3(0, 0.05, 0);

    // Mouse tracking
    this.mouse = new THREE.Vector2(0, 0);
    this.targetMouse = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.hoveredMesh = null;

    // Callbacks
    this.listeners = {};

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 400;
    const height = this.container.clientHeight || 460;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.copy(this.initialCameraPos);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.outline = 'none';
    this.renderer.domElement.style.touchAction = 'none';

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.copy(this.initialTarget);
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 5.2;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.15; // Don't flip under the floor
    this.controls.enablePan = false;

    // 5. Lighting System
    this.setupLighting();

    // 6. Ground Anti-Gravity Halo Disc
    this.setupGroundFX();

    // 7. Event Listeners
    this.setupEvents();

    // 8. Load 3D Model
    this.loadModel();

    // 9. Start Render Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // 1. Hemisphere Light (Soft sky and ground ambient fill)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.8);
    this.scene.add(hemiLight);

    // 2. Ambient light with subtle deep cyber tone
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.6);
    this.scene.add(ambientLight);

    // 3. Main Key Light (Directional, casts soft shadows)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    this.keyLight.position.set(4, 5, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.bias = -0.001;
    this.scene.add(this.keyLight);

    // 4. Fill Light (Cool cyan from left)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    fillLight.position.set(-4, 3, 2);
    this.scene.add(fillLight);

    // 5. Front Face/Chest Fill Light
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.4);
    frontLight.position.set(0, 1.5, 3.5);
    this.scene.add(frontLight);

    // 6. Cyber Rim Light (Behind, creates glowing contour edge)
    this.rimLight = new THREE.DirectionalLight(this.options.accentColor, 4.2);
    this.rimLight.position.set(0, 3, -4);
    this.scene.add(this.rimLight);

    // 7. Chest Core Reactor Glow Light
    this.coreSpotLight = new THREE.PointLight(this.options.accentColor, 2.2, 3.5);
    this.coreSpotLight.position.set(0, 0.1, 0.8);
    this.scene.add(this.coreSpotLight);
  }

  setupGroundFX() {
    // 1. Inner holographic cyber projection ring under robot
    const ringGeo = new THREE.RingGeometry(0.55, 0.85, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.options.accentColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    this.groundRing = new THREE.Mesh(ringGeo, ringMat);
    this.groundRing.rotation.x = -Math.PI / 2;
    this.groundRing.position.y = -0.72;
    this.scene.add(this.groundRing);

    // 2. Outer holographic orbit ring with sci-fi look
    const ringOuterGeo = new THREE.RingGeometry(0.92, 1.04, 64);
    const ringOuterMat = new THREE.MeshBasicMaterial({
      color: this.options.accentColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending
    });
    this.groundRingOuter = new THREE.Mesh(ringOuterGeo, ringOuterMat);
    this.groundRingOuter.rotation.x = -Math.PI / 2;
    this.groundRingOuter.position.y = -0.72;
    this.scene.add(this.groundRingOuter);

    // 3. Ground Anti-Gravity upward glow light
    this.antiGravLight = new THREE.PointLight(this.options.accentColor, 2.2, 2.8);
    this.antiGravLight.position.set(0, -0.65, 0);
    this.scene.add(this.antiGravLight);

    // 4. Soft Shadow Contact Plane
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = -0.73;
    this.scene.add(this.contactShadow);
  }

  loadModel() {
    const loader = new GLTFLoader();
    this.emit('loadStart');

    let fakePercent = 15;
    const progressTimer = setInterval(() => {
      if (!this.isLoaded && fakePercent < 88) {
        fakePercent += Math.floor(Math.random() * 8) + 4;
        this.emit('loadProgress', Math.min(fakePercent, 88));
      }
    }, 140);

    const tryLoad = (url, isFallback = false) => {
      loader.load(
        url,
        (gltf) => {
          clearInterval(progressTimer);
          this.emit('loadProgress', 100);
          this.onModelLoaded(gltf);
        },
        (xhr) => {
          if (xhr.lengthComputable && xhr.total > 0) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            this.emit('loadProgress', percent);
          } else if (xhr.loaded) {
            const estimatedPercent = Math.min(Math.round((xhr.loaded / 1521772) * 100), 95);
            this.emit('loadProgress', Math.max(estimatedPercent, fakePercent));
          }
        },
        (error) => {
          console.warn(`[Robot3D] Failed loading from ${url}:`, error);
          if (!isFallback && this.options.fallbackUrl) {
            console.log(`[Robot3D] Trying fallback URL: ${this.options.fallbackUrl}`);
            tryLoad(this.options.fallbackUrl, true);
          } else {
            clearInterval(progressTimer);
            this.emit('loadError', error);
          }
        }
      );
    };

    tryLoad(this.options.modelUrl);
  }

  onModelLoaded(gltf) {
    this.modelRoot = gltf.scene;
    this.robotGroup = new THREE.Group();
    this.robotGroup.name = 'robotInteractiveGroup';
    this.robotGroup.add(this.modelRoot);
    this.scene.add(this.robotGroup);

    // Compute bounding box to ensure perfect centering & scaling
    const bbox = new THREE.Box3().setFromObject(this.modelRoot);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());

    // Re-center model at (0, 0, 0)
    this.modelRoot.position.x = -center.x;
    this.modelRoot.position.y = -center.y + 0.05;
    this.modelRoot.position.z = -center.z;

    this.modelStats = {
      meshCount: 0,
      vertexCount: 0,
      triangleCount: 0,
      materialCount: 0,
      dimensions: {
        width: size.x.toFixed(2),
        height: size.y.toFixed(2),
        depth: size.z.toFixed(2)
      },
      animationsCount: (gltf.animations || []).length
    };

    const uniqueMats = new Set();

    // Traverse and enhance PBR materials
    this.modelRoot.traverse((child) => {
      if (child.isMesh) {
        this.modelStats.meshCount++;
        if (child.geometry && child.geometry.attributes.position) {
          this.modelStats.vertexCount += child.geometry.attributes.position.count;
          if (child.geometry.index) {
            this.modelStats.triangleCount += child.geometry.index.count / 3;
          } else {
            this.modelStats.triangleCount += child.geometry.attributes.position.count / 3;
          }
        }

        child.castShadow = true;
        child.receiveShadow = true;
        this.meshes.push(child);

        // Material upgrade
        if (child.material) {
          const originalMat = child.material;
          uniqueMats.add(originalMat.name || originalMat.uuid);

          // Clone material so we can adjust properties dynamically
          const pbrMat = new THREE.MeshStandardMaterial({
            color: originalMat.color ? originalMat.color.clone() : new THREE.Color(0x334155),
            metalness: 0.65,
            roughness: 0.38,
            envMapIntensity: 1.2
          });

          // Check if color is bright accent (e.g. orange, cyan, red, electric blue)
          const hsl = { h: 0, s: 0, l: 0 };
          pbrMat.color.getHSL(hsl);

          // Enhance core reactor / eye visor meshes
          const childCenterY = (child.geometry.boundingBox ? 
            (child.geometry.boundingBox.min.y + child.geometry.boundingBox.max.y) / 2 : 0);

          // Orange or bright warm accent (reactor / power nodes)
          if ((hsl.h >= 0.04 && hsl.h <= 0.12 && hsl.s > 0.5) || 
              (hsl.h >= 0.95 && hsl.s > 0.5) ||
              (hsl.h >= 0.45 && hsl.h <= 0.6 && hsl.s > 0.4)) {
            pbrMat.emissive = pbrMat.color.clone();
            pbrMat.emissiveIntensity = 0.9;
            this.emissiveMaterials.push(pbrMat);

            if (Math.abs(childCenterY - 0.05) < 0.25) {
              this.reactorMeshes.push(child);
            }
          }

          child.material = pbrMat;
          child.userData.originalColor = pbrMat.color.clone();
          child.userData.originalEmissive = pbrMat.emissive.clone();
          child.userData.originalEmissiveIntensity = pbrMat.emissiveIntensity;
        }
      }
    });

    this.modelStats.materialCount = uniqueMats.size;
    this.isLoaded = true;

    // Intro spawn animation with GSAP
    this.robotGroup.position.y = -1.2;
    this.robotGroup.scale.set(0.01, 0.01, 0.01);
    this.robotGroup.rotation.y = Math.PI * 1.5;

    gsap.to(this.robotGroup.position, {
      y: 0,
      duration: 1.2,
      ease: 'back.out(1.2)'
    });
    gsap.to(this.robotGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.2,
      ease: 'back.out(1.2)'
    });
    gsap.to(this.robotGroup.rotation, {
      y: 0,
      duration: 1.4,
      ease: 'power2.out'
    });

    this.emit('loaded', this.modelStats);
  }

  setupEvents() {
    // Window Resize & Container Observer
    this.handleResize = () => {
      if (!this.container || !this.renderer || !this.camera) return;
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (width === 0 || height === 0) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', this.handleResize);

    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    }

    // Mouse Tracking for subtle gaze
    this.handleMouseMove = (e) => {
      const rect = this.container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      this.targetMouse.x = THREE.MathUtils.clamp(x, -1, 1);
      this.targetMouse.y = THREE.MathUtils.clamp(y, -1, 1);

      // Raycast for hover feedback
      if (this.isLoaded && this.camera) {
        this.raycaster.setFromCamera(this.targetMouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.meshes, false);

        if (intersects.length > 0) {
          const hit = intersects[0].object;
          if (this.hoveredMesh !== hit) {
            this.clearHover();
            this.hoveredMesh = hit;
            if (hit.material && hit.material.emissive) {
              hit.material.emissive.set(this.options.accentColor);
              hit.material.emissiveIntensity = 1.4;
            }
            this.container.style.cursor = 'pointer';
          }
        } else {
          this.clearHover();
          this.container.style.cursor = 'grab';
        }
      }
    };
    this.container.addEventListener('mousemove', this.handleMouseMove);

    // Click on 3D Robot to trigger poke / celebration
    this.handleClick = (e) => {
      if (!this.isLoaded || !this.camera) return;
      this.raycaster.setFromCamera(this.targetMouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.meshes, false);
      if (intersects.length > 0) {
        this.triggerReaction('poke');
        this.emit('robotClicked');
      }
    };
    this.container.addEventListener('click', this.handleClick);
  }

  clearHover() {
    if (this.hoveredMesh && this.hoveredMesh.userData) {
      if (this.hoveredMesh.material && this.hoveredMesh.userData.originalEmissive) {
        this.hoveredMesh.material.emissive.copy(this.hoveredMesh.userData.originalEmissive);
        this.hoveredMesh.material.emissiveIntensity = this.hoveredMesh.userData.originalEmissiveIntensity;
      }
      this.hoveredMesh = null;
    }
  }

  // =========================================================================
  // Control Panel Action Methods (All 7 Buttons)
  // =========================================================================

  /**
   * 1. Reset View: Smoothly animates camera, target, and robot rotation back to default
   */
  resetView() {
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.controls.target);
    if (this.robotGroup) gsap.killTweensOf(this.robotGroup.rotation);

    gsap.to(this.camera.position, {
      x: this.initialCameraPos.x,
      y: this.initialCameraPos.y,
      z: this.initialCameraPos.z,
      duration: 1.0,
      ease: 'power3.out'
    });

    gsap.to(this.controls.target, {
      x: this.initialTarget.x,
      y: this.initialTarget.y,
      z: this.initialTarget.z,
      duration: 1.0,
      ease: 'power3.out',
      onUpdate: () => this.controls.update()
    });

    if (this.robotGroup) {
      gsap.to(this.robotGroup.rotation, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.8,
        ease: 'power2.out'
      });
    }

    this.emit('actionTriggered', 'resetView');
  }

  /**
   * 2. Rotate Robot: Toggles continuous 360-degree turntable rotation
   */
  toggleRotate() {
    this.isRotating = !this.isRotating;
    this.emit('rotateStateChange', this.isRotating);
    return this.isRotating;
  }

  setRotate(state) {
    this.isRotating = Boolean(state);
    this.emit('rotateStateChange', this.isRotating);
  }

  /**
   * 3. Zoom In: Smoothly moves camera closer to model with distance clamp
   */
  zoomIn() {
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).normalize();
    const currentDist = this.camera.position.distanceTo(this.controls.target);
    const targetDist = Math.max(currentDist - 0.5, this.controls.minDistance);
    const newPos = this.controls.target.clone().sub(dir.multiplyScalar(targetDist));

    gsap.to(this.camera.position, {
      x: newPos.x,
      y: newPos.y,
      z: newPos.z,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => this.controls.update()
    });

    this.emit('actionTriggered', 'zoomIn');
  }

  /**
   * 4. Zoom Out: Smoothly moves camera further with distance clamp
   */
  zoomOut() {
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    const currentDist = this.camera.position.distanceTo(this.controls.target);
    const targetDist = Math.min(currentDist + 0.6, this.controls.maxDistance);
    const newPos = this.controls.target.clone().add(dir.multiplyScalar(targetDist));

    gsap.to(this.camera.position, {
      x: newPos.x,
      y: newPos.y,
      z: newPos.z,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => this.controls.update()
    });

    this.emit('actionTriggered', 'zoomOut');
  }

  /**
   * 5. Robot Animation: Starts the procedural animation suite (hover, pulse, breathing)
   */
  startAnimation() {
    this.isAnimating = true;
    this.emit('animationStateChange', true);
  }

  /**
   * 6. Stop Animation: Halts all motion and smoothly lerps robot back to rest pose
   */
  stopAnimation() {
    this.isAnimating = false;
    this.isRotating = false;

    if (this.robotGroup) {
      gsap.to(this.robotGroup.position, {
        y: 0,
        duration: 0.6,
        ease: 'power2.out'
      });
      gsap.to(this.robotGroup.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.6,
        ease: 'power2.out'
      });
      gsap.to(this.robotGroup.rotation, {
        x: 0,
        z: 0,
        duration: 0.6,
        ease: 'power2.out'
      });
    }

    this.emit('animationStateChange', false);
    this.emit('rotateStateChange', false);
  }

  /**
   * 7. Robot Information: Returns comprehensive 3D specs
   */
  getInfo() {
    return {
      modelName: 'A.X.E.L. Tactical Cyber Unit',
      sourceUrl: this.options.modelUrl,
      meshCount: this.modelStats ? this.modelStats.meshCount : 100,
      vertexCount: this.modelStats ? this.modelStats.vertexCount : 40056,
      triangleCount: this.modelStats ? this.modelStats.triangleCount : 20419,
      materialCount: this.modelStats ? this.modelStats.materialCount : 11,
      dimensions: this.modelStats ? this.modelStats.dimensions : { width: '0.91', height: '1.38', depth: '0.80' },
      animations: 'Procedural Kinematics (Zero glTF clips, driven by Three.js/GSAP)',
      isAnimating: this.isAnimating,
      isRotating: this.isRotating
    };
  }

  /**
   * Interactive Reaction Animations (Celebrations, Moods, Pokes)
   */
  triggerReaction(type = 'bounce') {
    if (!this.robotGroup || !this.isLoaded) return;

    if (type === 'poke' || type === 'bounce') {
      gsap.timeline()
        .to(this.robotGroup.position, { y: 0.14, duration: 0.18, ease: 'power2.out' })
        .to(this.robotGroup.position, { y: 0, duration: 0.45, ease: 'bounce.out' });
      gsap.timeline()
        .to(this.robotGroup.scale, { x: 1.08, y: 0.94, z: 1.08, duration: 0.15 })
        .to(this.robotGroup.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
    } else if (type === 'dance') {
      const tl = gsap.timeline({ repeat: 2, yoyo: true });
      tl.to(this.robotGroup.rotation, { z: 0.08, y: 0.15, duration: 0.25, ease: 'power1.inOut' })
        .to(this.robotGroup.rotation, { z: -0.08, y: -0.15, duration: 0.25, ease: 'power1.inOut' });
    } else if (type === 'recharge') {
      // Glow surge
      this.emissiveMaterials.forEach((mat) => {
        gsap.to(mat, {
          emissiveIntensity: 3.5,
          duration: 0.3,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            mat.emissiveIntensity = 0.9;
          }
        });
      });
      gsap.timeline()
        .to(this.robotGroup.position, { y: 0.2, duration: 0.4, ease: 'power2.out' })
        .to(this.robotGroup.position, { y: 0, duration: 0.6, ease: 'bounce.out' });
    }
  }

  /**
   * Dynamic Theme Color Update (Cyan, Magenta, Emerald, Amber, Violet)
   */
  setThemeColor(colorHex) {
    const col = new THREE.Color(colorHex);
    this.options.accentColor = colorHex;

    if (this.rimLight) this.rimLight.color.copy(col);
    if (this.coreSpotLight) this.coreSpotLight.color.copy(col);
    if (this.antiGravLight) this.antiGravLight.color.copy(col);
    if (this.groundRing && this.groundRing.material) this.groundRing.material.color.copy(col);
    if (this.groundRingOuter && this.groundRingOuter.material) this.groundRingOuter.material.color.copy(col);

    // Smoothly transition all emissive parts on the robot to match the selected theme
    if (this.emissiveMaterials && this.emissiveMaterials.length > 0) {
      this.emissiveMaterials.forEach((mat) => {
        gsap.to(mat.emissive, {
          r: col.r,
          g: col.g,
          b: col.b,
          duration: 0.6,
          ease: 'power2.out'
        });
      });
    }
  }

  // =========================================================================
  // Render & Animation Loop
  // =========================================================================
  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Controls damping update
    if (this.controls) {
      this.controls.update();
    }

    // 2. Mouse gaze lerp
    this.mouse.lerp(this.targetMouse, 0.06);

    // 3. Ground holographic rings subtle spin & pulse
    if (this.groundRing) {
      this.groundRing.rotation.z += delta * 0.22;
      this.groundRing.material.opacity = 0.42 + Math.sin(elapsedTime * 2.5) * 0.12;
    }
    if (this.groundRingOuter) {
      this.groundRingOuter.rotation.z -= delta * 0.14;
      this.groundRingOuter.material.opacity = 0.22 + Math.cos(elapsedTime * 1.8) * 0.08;
    }
    if (this.antiGravLight) {
      this.antiGravLight.intensity = 2.0 + Math.sin(elapsedTime * 3.0) * 0.5;
    }

    // 4. Procedural Robot Animation
    if (this.robotGroup && this.isLoaded) {
      // Auto-rotation
      if (this.isRotating) {
        this.robotGroup.rotation.y += this.rotationSpeed * delta;
      }

      // Procedural floating & breathing
      if (this.isAnimating) {
        // Vertical hover oscillation
        const hoverY = Math.sin(elapsedTime * 2.2) * 0.045;
        this.robotGroup.position.y = hoverY;

        // Subtle banking tilt
        const tiltZ = Math.sin(elapsedTime * 1.6) * 0.02;
        this.robotGroup.rotation.z = tiltZ + this.mouse.x * 0.04;

        // Subtle breathing scale
        const breath = 1.0 + Math.sin(elapsedTime * 2.8) * 0.012;
        this.robotGroup.scale.set(breath, breath, breath);

        // Interactive mouse look-at tilt (subtle tracking)
        if (!this.isRotating) {
          this.robotGroup.rotation.y = THREE.MathUtils.lerp(this.robotGroup.rotation.y, this.mouse.x * 0.25, 0.05);
        }
        this.robotGroup.rotation.x = THREE.MathUtils.lerp(this.robotGroup.rotation.x, -this.mouse.y * 0.15, 0.05);

        // Core reactor pulse
        const pulse = 1.0 + Math.sin(elapsedTime * 4.5) * 0.45;
        if (this.coreSpotLight) {
          this.coreSpotLight.intensity = 1.4 * pulse;
        }
      }
    }

    // 5. Render Scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // =========================================================================
  // Event Emitter
  // =========================================================================
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return this;
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try { cb(data); } catch (err) { console.error(`[Robot3D] Error in listener for ${event}:`, err); }
      });
    }
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.container) {
      this.container.removeEventListener('mousemove', this.handleMouseMove);
      this.container.removeEventListener('click', this.handleClick);
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
