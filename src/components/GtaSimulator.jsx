import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Monitor, AlertTriangle, RotateCw } from 'lucide-react';



/* ─── Generic Bone Connections (Works with both standard Humanoid and Mixamo rigs) ─── */
const BONE_PAIRS = [
  // Head & Spine
  ['Head', 'Neck'],
  ['Neck', 'Spine2'],
  ['Spine2', 'Spine1'],
  ['Spine1', 'Spine'],
  ['Spine', 'Hips'],

  // Left Arm
  ['Neck', 'LeftShoulder'],
  ['LeftShoulder', 'LeftArm'],
  ['LeftArm', 'LeftForeArm'],
  ['LeftForeArm', 'LeftHand'],

  // Right Arm
  ['Neck', 'RightShoulder'],
  ['RightShoulder', 'RightArm'],
  ['RightArm', 'RightForeArm'],
  ['RightForeArm', 'RightHand'],

  // Left Leg
  ['Hips', 'LeftUpLeg'],
  ['LeftUpLeg', 'LeftLeg'],
  ['LeftLeg', 'LeftFoot'],

  // Right Leg
  ['Hips', 'RightUpLeg'],
  ['RightUpLeg', 'RightLeg'],
  ['RightLeg', 'RightFoot'],
];

const KEY_JOINT_NAMES = [
  'Head',
  'Neck',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'Hips',
  'LeftLeg',
  'LeftFoot',
  'RightLeg',
  'RightFoot',
];

// Helper to look up bones under various naming schemes
function getBone(bonesMap, name) {
  if (!bonesMap) return null;
  return (
    bonesMap.get(name) ||
    bonesMap.get(`mixamorig:${name}`) ||
    bonesMap.get(`mixamorig_${name}`) ||
    bonesMap.get(name.toLowerCase()) ||
    null
  );
}

export default function GtaSimulator({
  aimbotActive = true,
  espActive = true,
  streamproofActive = true,
  fov = 110,
}) {
  const containerRef = useRef(null);
  const canvas3dRef = useRef(null);
  const canvasOverlayRef = useRef(null);
  const pipCanvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [viewMode, setViewMode] = useState('player'); // 'player' | 'obs' | 'pip'
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // References for Three.js state
  const stateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    mixer: null,
    clock: new THREE.Clock(),
    bonesMap: new Map(),
    characterRoot: null,
    rotationY: 0,
    targetRotationY: 0,
    lastMouseX: 0,
    animFrameId: null,
  });

  /* ─── Initialize Three.js Scene ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 460;
    const height = container.clientHeight || 430;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x030816, 0.035);

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.25, 3.4);
    camera.lookAt(0, 0.95, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas3dRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // Lighting (Tactical Studio / Los Santos Night)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.4);
    keyLight.position.set(2.5, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 3.2);
    rimLight.position.set(-2.5, 2.5, -2);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x0ea5e9, 1.2, 8);
    fillLight.position.set(0, 0.6, 2.2);
    scene.add(fillLight);

    // Ground Radar Grid
    const gridGroup = new THREE.Group();
    const gridHelper = new THREE.GridHelper(6, 16, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.22;
    gridHelper.material.transparent = true;
    gridGroup.add(gridHelper);

    // Ground Radar Concentric Rings
    for (const radius of [0.8, 1.6, 2.4]) {
      const ringGeo = new THREE.RingGeometry(radius - 0.012, radius, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.005;
      gridGroup.add(ringMesh);
    }
    scene.add(gridGroup);

    stateRef.current.scene = scene;
    stateRef.current.camera = camera;
    stateRef.current.renderer = renderer;

    const handleResize = () => {
      if (!containerRef.current || !stateRef.current.renderer) return;
      const w = containerRef.current.clientWidth || 460;
      const h = containerRef.current.clientHeight || 430;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);

      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.width = w;
        canvasOverlayRef.current.height = h;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (stateRef.current.animFrameId) {
        cancelAnimationFrame(stateRef.current.animFrameId);
      }
      renderer.dispose();
    };
  }, []);

  /* ─── Load Normal Player Character Model ─── */
  useEffect(() => {
    const { scene } = stateRef.current;
    if (!scene) return;

    setLoading(true);
    setLoadError(null);

    // Clean up previous character
    if (stateRef.current.characterRoot) {
      scene.remove(stateRef.current.characterRoot);
      stateRef.current.characterRoot = null;
    }
    if (stateRef.current.mixer) {
      stateRef.current.mixer.stopAllAction();
      stateRef.current.mixer = null;
    }
    stateRef.current.bonesMap.clear();

    const modelPath = '/player.glb';
    const loader = new GLTFLoader();
    if (typeof MeshoptDecoder !== 'undefined') {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const setupModel = (gltf) => {
      const model = gltf.scene;

      // Auto-compute bounding box to normalize scale & floor position
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const targetHeight = 1.95;
      const scaleFactor = targetHeight / (size.y || 1);
      model.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // Center on X/Z and align feet to floor (Y = 0)
      model.position.x = -center.x * scaleFactor;
      model.position.y = -box.min.y * scaleFactor;
      model.position.z = -center.z * scaleFactor;

      // Map bones and configure materials
      const bonesMap = new Map();
      model.traverse((child) => {
        if (child.isBone || child.type === 'Bone') {
          bonesMap.set(child.name, child);
        }
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = 0.7;
            child.material.metalness = 0.15;
          }
        }
      });

      scene.add(model);
      stateRef.current.characterRoot = model;
      stateRef.current.bonesMap = bonesMap;

      // Play animations if model has them
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const idleClip = gltf.animations.find((c) => c.name.toLowerCase().includes('idle')) || gltf.animations[0];
        if (idleClip) {
          mixer.clipAction(idleClip).play();
        }
        stateRef.current.mixer = mixer;
      }

      setLoading(false);
    };

    loader.load(
      modelPath,
      (gltf) => {
        setupModel(gltf);
      },
      undefined,
      (err) => {
        console.error(`Failed to load ${modelPath}:`, err);
        // Fallback to soldier if player fails
        if (modelPath !== '/soldier.glb') {
          console.warn('Attempting fallback to /soldier.glb...');
          loader.load(
            '/soldier.glb',
            (fallbackGltf) => {
              setupModel(fallbackGltf);
            },
            undefined,
            (fallbackErr) => {
              console.error('Fallback model also failed:', fallbackErr);
              setLoadError('Failed to load 3D character model');
              setLoading(false);
            }
          );
        } else {
          setLoadError('Failed to load 3D character model');
          setLoading(false);
        }
      }
    );
  }, []);

  /* ─── Drag to Rotate Handling ─── */
  const handleMouseDown = (e) => {
    setIsDragging(true);
    stateRef.current.lastMouseX = e.clientX;
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - stateRef.current.lastMouseX;
    stateRef.current.lastMouseX = e.clientX;
    stateRef.current.targetRotationY += deltaX * 0.012;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      stateRef.current.lastMouseX = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - stateRef.current.lastMouseX;
    stateRef.current.lastMouseX = e.touches[0].clientX;
    stateRef.current.targetRotationY += deltaX * 0.012;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  /* ─── Main Render Loop (60/144 FPS) ─── */
  const renderFrame = useCallback(() => {
    const { scene, camera, renderer, mixer, clock, characterRoot, bonesMap } = stateRef.current;
    if (!scene || !camera || !renderer) return;

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    if (mixer) {
      mixer.update(delta);
    } else if (bonesMap.size > 0) {
      // Natural procedural breathing & idle sway for models without skeletal animation
      const spineBone = getBone(bonesMap, 'Spine1') || getBone(bonesMap, 'Spine');
      const headBone = getBone(bonesMap, 'Head');
      const hipsBone = getBone(bonesMap, 'Hips');

      if (spineBone) {
        spineBone.rotation.x = Math.sin(elapsedTime * 1.8) * 0.025;
      }
      if (headBone) {
        headBone.rotation.y = Math.sin(elapsedTime * 0.9) * 0.035;
      }
      if (hipsBone) {
        hipsBone.position.y = (hipsBone.userData.originalY || hipsBone.position.y) + Math.sin(elapsedTime * 1.8) * 0.003;
      }
    }

    // Auto-rotation & smooth damping
    if (autoRotate && !isDragging) {
      stateRef.current.targetRotationY += delta * 0.45;
    }
    stateRef.current.rotationY += (stateRef.current.targetRotationY - stateRef.current.rotationY) * 0.12;

    if (characterRoot) {
      characterRoot.rotation.y = stateRef.current.rotationY;
    }

    // Render WebGL
    renderer.render(scene, camera);

    // Render 2D DirectX Cheat Overlay
    const overlay = canvasOverlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      const w = overlay.width;
      const h = overlay.height;

      ctx.clearRect(0, 0, w, h);

      // Determine cheat rendering by viewMode & streamproof state
      const shouldDrawCheat = viewMode === 'player' || (viewMode === 'obs' && !streamproofActive) || viewMode === 'pip';

      if (shouldDrawCheat && bonesMap.size > 0) {
        drawCheatOverlay(ctx, w, h, bonesMap, camera);
      }
    }

    // Render PIP mini OBS monitor if active
    if (viewMode === 'pip' && pipCanvasRef.current && canvas3dRef.current) {
      const pip = pipCanvasRef.current;
      const pipCtx = pip.getContext('2d');
      pipCtx.clearRect(0, 0, pip.width, pip.height);

      // Clean 3D game capture
      pipCtx.drawImage(canvas3dRef.current, 0, 0, pip.width, pip.height);

      // If streamproof is OFF, OBS leaks the cheat overlay
      if (!streamproofActive && canvasOverlayRef.current) {
        pipCtx.drawImage(canvasOverlayRef.current, 0, 0, pip.width, pip.height);
      }
    }

    stateRef.current.animFrameId = requestAnimationFrame(renderFrame);
  }, [aimbotActive, espActive, streamproofActive, fov, viewMode, autoRotate, isDragging]);

  useEffect(() => {
    stateRef.current.animFrameId = requestAnimationFrame(renderFrame);
    return () => {
      if (stateRef.current.animFrameId) {
        cancelAnimationFrame(stateRef.current.animFrameId);
      }
    };
  }, [renderFrame]);

  /* ─── 3D to 2D Screen Space Projection ─── */
  const projectBone = (boneObj, camera, width, height) => {
    if (!boneObj) return null;
    const v = new THREE.Vector3();
    boneObj.getWorldPosition(v);
    const proj = v.project(camera);
    return {
      x: (proj.x * 0.5 + 0.5) * width,
      y: (-(proj.y * 0.5) + 0.5) * height,
      z: proj.z,
      visible: proj.z < 1,
    };
  };

  /* ─── Draw GTA V ESP Skeleton, Box & Aimbot ─── */
  const drawCheatOverlay = (ctx, w, h, bonesMap, camera) => {
    const center = { x: w / 2, y: h / 2 };

    // 1. Draw FOV Ring
    if (aimbotActive) {
      const radius = (fov / 150) * (Math.min(w, h) * 0.42);
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 0.98, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Project Bone Coordinates
    const boneScreenCoords = new Map();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const [boneName] of KEY_JOINT_NAMES.map((name) => [name])) {
      const boneObj = getBone(bonesMap, boneName);
      if (boneObj) {
        const pos = projectBone(boneObj, camera, w, h);
        if (pos && pos.visible) {
          boneScreenCoords.set(boneName, pos);
          minX = Math.min(minX, pos.x);
          maxX = Math.max(maxX, pos.x);
          minY = Math.min(minY, pos.y);
          maxY = Math.max(maxY, pos.y);
        }
      }
    }

    // Also project any additional bones for complete skeleton
    for (const [nameA, nameB] of BONE_PAIRS) {
      for (const name of [nameA, nameB]) {
        if (!boneScreenCoords.has(name)) {
          const boneObj = getBone(bonesMap, name);
          if (boneObj) {
            const pos = projectBone(boneObj, camera, w, h);
            if (pos && pos.visible) {
              boneScreenCoords.set(name, pos);
              minX = Math.min(minX, pos.x);
              maxX = Math.max(maxX, pos.x);
              minY = Math.min(minY, pos.y);
              maxY = Math.max(maxY, pos.y);
            }
          }
        }
      }
    }

    const headPos = boneScreenCoords.get('Head');

    // 3. Draw 3D Bone Connections (DirectX Bone Rigging)
    if (espActive) {
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 9;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [boneA, boneB] of BONE_PAIRS) {
        const pA = boneScreenCoords.get(boneA);
        const pB = boneScreenCoords.get(boneB);
        if (pA && pB && pA.visible && pB.visible) {
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }
      }

      // Draw Key Joint Nodes
      for (const joint of KEY_JOINT_NAMES) {
        const p = boneScreenCoords.get(joint);
        if (p && p.visible) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, joint === 'Head' ? 6 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = joint === 'Head' ? '#38bdf8' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 4. Tactical Corner-Bracket Bounding Box
      if (minX !== Infinity && maxX !== -Infinity) {
        const padX = 20;
        const padY = 24;
        const boxX = minX - padX;
        const boxY = minY - padY;
        const boxW = Math.max(75, maxX - minX + padX * 2);
        const boxH = Math.max(130, maxY - minY + padY * 2);

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;

        const cornerLen = Math.min(22, boxW * 0.25);

        // Corner Brackets
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(boxX, boxY + cornerLen);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + cornerLen, boxY);
        // Top-Right
        ctx.moveTo(boxX + boxW - cornerLen, boxY);
        ctx.lineTo(boxX + boxW, boxY);
        ctx.lineTo(boxX + boxW, boxY + cornerLen);
        // Bottom-Left
        ctx.moveTo(boxX, boxY + boxH - cornerLen);
        ctx.lineTo(boxX, boxY + boxH);
        ctx.lineTo(boxX + cornerLen, boxY + boxH);
        // Bottom-Right
        ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
        ctx.lineTo(boxX + boxW, boxY + boxH);
        ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
        ctx.stroke();

        // GTA V Player Info Tag
        ctx.font = '700 11px monospace';
        const tagText = 'PLAYER: MP_M_FREEMODE_01 [24m]';
        const textWidth = ctx.measureText(tagText).width;
        const tagCenterX = boxX + boxW / 2;
        const tagTopY = boxY - 32;

        // Tag Background
        ctx.fillStyle = 'rgba(3, 8, 22, 0.88)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.fillRect(tagCenterX - textWidth / 2 - 8, tagTopY, textWidth + 16, 26);
        ctx.strokeRect(tagCenterX - textWidth / 2 - 8, tagTopY, textWidth + 16, 26);

        // Tag Label
        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.fillText(tagText, tagCenterX, tagTopY + 12);

        // Health Bar (Emerald)
        const barWidth = textWidth + 8;
        ctx.fillStyle = '#065f46';
        ctx.fillRect(tagCenterX - barWidth / 2, tagTopY + 17, barWidth, 3);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(tagCenterX - barWidth / 2, tagTopY + 17, barWidth * 0.95, 3);

        // Armor Bar (Tactical Blue)
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(tagCenterX - barWidth / 2, tagTopY + 21, barWidth, 3);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(tagCenterX - barWidth / 2, tagTopY + 21, barWidth * 0.85, 3);

        ctx.restore();
      }
    }

    // 5. Silent Vector Aimbot Lock
    if (aimbotActive && headPos && headPos.visible) {
      ctx.save();
      // Tracer vector from crosshair to head
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(headPos.x, headPos.y);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // Lock Diamond on Head Bone
      const dSize = 12;
      ctx.beginPath();
      ctx.moveTo(headPos.x, headPos.y - dSize);
      ctx.lineTo(headPos.x + dSize, headPos.y);
      ctx.lineTo(headPos.x, headPos.y + dSize);
      ctx.lineTo(headPos.x - dSize, headPos.y);
      ctx.closePath();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 8;
      ctx.stroke();

      ctx.font = '700 9px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED [HEAD]', headPos.x, headPos.y - dSize - 4);
      ctx.restore();
    }

    // 6. Crosshair Reticle
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = aimbotActive ? '#00f0ff' : '#ffffff';
    ctx.shadowColor = aimbotActive ? '#00f0ff' : 'transparent';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '430px',
        height: '100%',
        borderRadius: '14px',
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, rgba(14, 30, 56, 0.88) 0%, #03050a 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8)',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvas3dRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      />

      {/* 2D DirectX Cheat Overlay Canvas */}
      <canvas
        ref={canvasOverlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Crosshair Static Grid Guides */}
      <div style={{ position: 'absolute', width: '100%', height: '1px', top: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', height: '100%', width: '1px', left: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

      {/* Top Header Bar: Perspective Switcher & Model Selector */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '6px',
          zIndex: 10,
        }}
      >
        {/* Perspective: Player Screen */}
        <button
          type="button"
          onClick={() => setViewMode('player')}
          style={{
            padding: '5px 9px',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            fontWeight: 600,
            borderRadius: '6px',
            border: viewMode === 'player' ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.12)',
            background: viewMode === 'player' ? 'rgba(0, 240, 255, 0.18)' : 'rgba(0, 0, 0, 0.55)',
            color: viewMode === 'player' ? '#00f0ff' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'all 0.2s',
          }}
          title="What the player sees on their monitor"
        >
          <Monitor size={12} />
          Player Screen
        </button>

        {/* Perspective: OBS Feed */}
        <button
          type="button"
          onClick={() => setViewMode('obs')}
          style={{
            padding: '5px 9px',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            fontWeight: 600,
            borderRadius: '6px',
            border: viewMode === 'obs' ? (streamproofActive ? '1px solid #10b981' : '1px solid #ef4444') : '1px solid rgba(255,255,255,0.12)',
            background: viewMode === 'obs' ? (streamproofActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)') : 'rgba(0, 0, 0, 0.55)',
            color: viewMode === 'obs' ? (streamproofActive ? '#10b981' : '#f87171') : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'all 0.2s',
          }}
          title="What OBS Studio / Twitch / Discord stream captures"
        >
          <Video size={12} />
          OBS Feed
        </button>

        {/* Perspective: PIP Compare */}
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'pip' ? 'player' : 'pip')}
          style={{
            padding: '5px 8px',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            fontWeight: 600,
            borderRadius: '6px',
            border: viewMode === 'pip' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.12)',
            background: viewMode === 'pip' ? 'rgba(168, 85, 247, 0.22)' : 'rgba(0, 0, 0, 0.55)',
            color: viewMode === 'pip' ? '#c084fc' : '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          }}
          title="Picture-in-picture side-by-side comparison"
        >
          PIP
        </button>

        {/* Auto Rotate Button */}
        <button
          type="button"
          onClick={() => setAutoRotate(!autoRotate)}
          style={{
            padding: '5px 8px',
            fontSize: '0.72rem',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: autoRotate ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0, 0, 0, 0.55)',
            color: autoRotate ? '#00f0ff' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Toggle 360 Auto-Rotation"
        >
          <RotateCw size={12} />
        </button>
      </div>

      {/* Picture-In-Picture (PIP) OBS Stream Monitor Window */}
      <AnimatePresence>
        {viewMode === 'pip' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{
              position: 'absolute',
              bottom: '36px',
              right: '12px',
              width: '160px',
              height: '110px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#040711',
              border: streamproofActive ? '1.5px solid #10b981' : '1.5px solid #ef4444',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
              zIndex: 15,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '3px 6px',
                background: 'rgba(0,0,0,0.85)',
                fontSize: '0.62rem',
                fontFamily: 'monospace',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 2,
              }}
            >
              <span style={{ color: streamproofActive ? '#10b981' : '#f87171', fontWeight: 700 }}>
                {streamproofActive ? 'OBS: CLEAN' : 'OBS: LEAK!'}
              </span>
              <span style={{ color: '#71717a' }}>1080p60</span>
            </div>
            <canvas ref={pipCanvasRef} width={160} height={110} style={{ width: '100%', height: '100%', display: 'block' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(3, 5, 10, 0.92)',
            zIndex: 20,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '36px',
              height: '36px',
              border: '2px solid rgba(0, 240, 255, 0.2)',
              borderTopColor: '#00f0ff',
              borderRadius: '50%',
              marginBottom: '1rem',
            }}
          />
          <div style={{ color: '#00f0ff', fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '1px' }}>
            SYNCHRONIZING GTA V PLAYER SKELETON...
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {loadError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(3, 5, 10, 0.9)',
            color: '#f87171',
            padding: '1.5rem',
            textAlign: 'center',
            zIndex: 20,
          }}
        >
          <AlertTriangle size={32} style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{loadError}</div>
        </div>
      )}

    </div>
  );
}
