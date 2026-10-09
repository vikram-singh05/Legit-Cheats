import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Eye, Video, Monitor, AlertTriangle, CheckCircle, RotateCw } from 'lucide-react';

/* ─── Bone Connection Pairs for Humanoid Skeleton ─── */
const BONE_CONNECTIONS = [
  // Head & Spine
  ['mixamorig:Head', 'mixamorig:Neck'],
  ['mixamorig:Neck', 'mixamorig:Spine2'],
  ['mixamorig:Spine2', 'mixamorig:Spine1'],
  ['mixamorig:Spine1', 'mixamorig:Spine'],
  ['mixamorig:Spine', 'mixamorig:Hips'],

  // Left Arm
  ['mixamorig:Neck', 'mixamorig:LeftShoulder'],
  ['mixamorig:LeftShoulder', 'mixamorig:LeftArm'],
  ['mixamorig:LeftArm', 'mixamorig:LeftForeArm'],
  ['mixamorig:LeftForeArm', 'mixamorig:LeftHand'],

  // Right Arm
  ['mixamorig:Neck', 'mixamorig:RightShoulder'],
  ['mixamorig:RightShoulder', 'mixamorig:RightArm'],
  ['mixamorig:RightArm', 'mixamorig:RightForeArm'],
  ['mixamorig:RightForeArm', 'mixamorig:RightHand'],

  // Left Leg
  ['mixamorig:Hips', 'mixamorig:LeftUpLeg'],
  ['mixamorig:LeftUpLeg', 'mixamorig:LeftLeg'],
  ['mixamorig:LeftLeg', 'mixamorig:LeftFoot'],

  // Right Leg
  ['mixamorig:Hips', 'mixamorig:RightUpLeg'],
  ['mixamorig:RightUpLeg', 'mixamorig:RightLeg'],
  ['mixamorig:RightLeg', 'mixamorig:RightFoot'],
];

const KEY_JOINTS = [
  'mixamorig:Head',
  'mixamorig:Neck',
  'mixamorig:LeftArm',
  'mixamorig:LeftForeArm',
  'mixamorig:LeftHand',
  'mixamorig:RightArm',
  'mixamorig:RightForeArm',
  'mixamorig:RightHand',
  'mixamorig:Hips',
  'mixamorig:LeftLeg',
  'mixamorig:LeftFoot',
  'mixamorig:RightLeg',
  'mixamorig:RightFoot',
];

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
    const height = container.clientHeight || 420;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // transparent to show tactical gradient
    scene.fog = new THREE.FogExp2(0x030816, 0.04);

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

    // Lights
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.5);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 3.0);
    rimLight.position.set(-2.5, 2.5, -2);
    scene.add(rimLight);

    const softFill = new THREE.PointLight(0x0ea5e9, 1.2, 8);
    softFill.position.set(0, 0.5, 2);
    scene.add(softFill);

    // Tactical Ground Radar Grid
    const gridGroup = new THREE.Group();
    const gridHelper = new THREE.GridHelper(6, 16, 0x00f0ff, 0x1e293b);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.25;
    gridHelper.material.transparent = true;
    gridGroup.add(gridHelper);

    // Concentric Radar Rings on Ground
    for (const radius of [0.8, 1.6, 2.4]) {
      const ringGeo = new THREE.RingGeometry(radius - 0.01, radius, 48);
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

    // Load Soldier GLB
    const loader = new GLTFLoader();
    loader.load(
      '/soldier.glb',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1.05, 1.05, 1.05);
        model.position.set(0, 0, 0);

        // Map bones by name
        const bonesMap = new Map();
        model.traverse((child) => {
          if (child.isBone || child.type === 'Bone') {
            bonesMap.set(child.name, child);
          }
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Enhance materials for tactical stealth look
            if (child.material) {
              child.material.roughness = 0.65;
              child.material.metalness = 0.3;
            }
          }
        });

        scene.add(model);
        stateRef.current.characterRoot = model;
        stateRef.current.bonesMap = bonesMap;

        // Animations: play 'Idle'
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          const idleClip = gltf.animations.find((clip) => clip.name === 'Idle') || gltf.animations[0];
          if (idleClip) {
            const action = mixer.clipAction(idleClip);
            action.play();
          }
          stateRef.current.mixer = mixer;
        }

        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load soldier model:', err);
        setLoadError('Failed to load 3D operative model');
        setLoading(false);
      }
    );

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !stateRef.current.renderer) return;
      const w = containerRef.current.clientWidth || 460;
      const h = containerRef.current.clientHeight || 420;

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

  /* ─── Mouse Drag Rotation Handling ─── */
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

  /* ─── 3D & 2D Render Loop ─── */
  const renderFrame = useCallback(() => {
    const { scene, camera, renderer, mixer, clock, characterRoot, bonesMap } = stateRef.current;
    if (!scene || !camera || !renderer) return;

    const delta = clock.getDelta();
    if (mixer) {
      mixer.update(delta);
    }

    // Auto rotate or smooth damping towards targetRotationY
    if (autoRotate && !isDragging) {
      stateRef.current.targetRotationY += delta * 0.45;
    }
    stateRef.current.rotationY += (stateRef.current.targetRotationY - stateRef.current.rotationY) * 0.12;

    if (characterRoot) {
      characterRoot.rotation.y = stateRef.current.rotationY;
    }

    // Render 3D Scene
    renderer.render(scene, camera);

    // Update 2D Canvas Overlay
    const overlay = canvasOverlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      const w = overlay.width;
      const h = overlay.height;

      ctx.clearRect(0, 0, w, h);

      // Determine if cheat overlay should be drawn based on View Mode & Streamproof State
      // 1. In 'player' view: player always sees the cheat overlay.
      // 2. In 'obs' view:
      //    - If streamproofActive is TRUE: OBS captures 0% cheat overlay (100% CLEAN).
      //    - If streamproofActive is FALSE: OBS leaks the cheat overlay (UNSAFE).
      const shouldDrawCheat = viewMode === 'player' || (viewMode === 'obs' && !streamproofActive) || viewMode === 'pip';

      if (shouldDrawCheat && bonesMap.size > 0) {
        drawCheatOverlay(ctx, w, h, bonesMap, camera);
      }

      // Draw View Mode Watermarks
      drawViewStatusWatermark(ctx, w, h);
    }

    // Update PIP Mini Canvas if PIP mode is active
    if (viewMode === 'pip' && pipCanvasRef.current && canvas3dRef.current) {
      const pip = pipCanvasRef.current;
      const pipCtx = pip.getContext('2d');
      pipCtx.clearRect(0, 0, pip.width, pip.height);

      // Draw the clean 3D scene snapshot from the WebGL canvas
      pipCtx.drawImage(canvas3dRef.current, 0, 0, pip.width, pip.height);

      // If streamproof is OFF, OBS leaks the cheat overlay into the PIP preview too
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

  /* ─── Helper: Project 3D vector to 2D screen coordinate ─── */
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

  /* ─── Draw Authentic GTA V ESP Skeleton, Box & Aimbot ─── */
  const drawCheatOverlay = (ctx, w, h, bonesMap, camera) => {
    const center = { x: w / 2, y: h / 2 };

    // 1. Draw FOV Ring (if aimbot is active)
    if (aimbotActive) {
      const radius = (fov / 150) * (Math.min(w, h) * 0.42);
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();

      // Subtle FOV inner pulse
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 0.98, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Compute screen coordinates of all skeleton bones
    const boneScreenCoords = new Map();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (const [name, boneObj] of bonesMap.entries()) {
      const pos = projectBone(boneObj, camera, w, h);
      if (pos && pos.visible) {
        boneScreenCoords.set(name, pos);
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      }
    }

    const headPos = boneScreenCoords.get('mixamorig:Head');

    // 3. Draw 3D Bone Connections (DirectX Bone Rigging)
    if (espActive) {
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 9;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [boneA, boneB] of BONE_CONNECTIONS) {
        const pA = boneScreenCoords.get(boneA);
        const pB = boneScreenCoords.get(boneB);
        if (pA && pB && pA.visible && pB.visible) {
          ctx.beginPath();
          ctx.moveTo(pA.x, pA.y);
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }
      }

      // Draw Key Joint Circles
      for (const joint of KEY_JOINTS) {
        const p = boneScreenCoords.get(joint);
        if (p && p.visible) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, joint === 'mixamorig:Head' ? 6 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = joint === 'mixamorig:Head' ? '#38bdf8' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 4. Draw 3D Bounding Box (Tactical Corner Brackets)
      if (minX !== Infinity && maxX !== -Infinity) {
        const padX = 18;
        const padY = 22;
        const boxX = minX - padX;
        const boxY = minY - padY;
        const boxW = Math.max(70, maxX - minX + padX * 2);
        const boxH = Math.max(120, maxY - minY + padY * 2);

        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;

        const cornerLen = Math.min(22, boxW * 0.25);

        // Top-Left corner
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + cornerLen);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + cornerLen, boxY);
        ctx.stroke();

        // Top-Right corner
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - cornerLen, boxY);
        ctx.lineTo(boxX + boxW, boxY);
        ctx.lineTo(boxX + boxW, boxY + cornerLen);
        ctx.stroke();

        // Bottom-Left corner
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + boxH - cornerLen);
        ctx.lineTo(boxX, boxY + boxH);
        ctx.lineTo(boxX + cornerLen, boxY + boxH);
        ctx.stroke();

        // Bottom-Right corner
        ctx.beginPath();
        ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
        ctx.lineTo(boxX + boxW, boxY + boxH);
        ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
        ctx.stroke();

        // Target Info Header above Box
        ctx.font = '700 11px monospace';
        const tagText = 'TARGET: MP_M_FREEMODE_01 [28m]';
        const textWidth = ctx.measureText(tagText).width;
        const tagCenterX = boxX + boxW / 2;
        const tagTopY = boxY - 32;

        // Header Background Tag
        ctx.fillStyle = 'rgba(3, 8, 22, 0.85)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.fillRect(tagCenterX - textWidth / 2 - 8, tagTopY, textWidth + 16, 26);
        ctx.strokeRect(tagCenterX - textWidth / 2 - 8, tagTopY, textWidth + 16, 26);

        // Tag Text
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
        ctx.fillRect(tagCenterX - barWidth / 2, tagTopY + 21, barWidth * 0.8, 3);

        ctx.restore();
      }
    }

    // 5. Draw Silent Vector Aimbot Lock & Tracer Line
    if (aimbotActive && headPos && headPos.visible) {
      ctx.save();
      // Tracer line from crosshair to head bone
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(headPos.x, headPos.y);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // Lock-On Target Diamond on Head
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

      // Lock status badge
      ctx.font = '700 9px monospace';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED [HEAD]', headPos.x, headPos.y - dSize - 4);

      ctx.restore();
    }

    // 6. Crosshair Center Point
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = aimbotActive ? '#00f0ff' : '#ffffff';
    ctx.shadowColor = aimbotActive ? '#00f0ff' : 'transparent';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  };

  /* ─── Draw Viewport Badges & Streamproof Telemetry ─── */
  const drawViewStatusWatermark = (ctx, w, h) => {
    ctx.save();
    ctx.font = '600 11px monospace';

    // Top-Left: Game / Swapchain Status
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'left';
    ctx.fillText('GTA V [BUILD 3095] • DX11 SWAPCHAIN: 144 FPS', 14, 24);

    // Bottom Status Bar
    if (viewMode === 'obs') {
      if (streamproofActive) {
        // Streamproof Active: OBS is receiving clean feed
        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
        ctx.fillText('🛡️ OBS STREAM CAPTURE: CLEAN FEED (BYPASS 100% ACTIVE • 0 OVERLAY ARTIFACTS)', 14, h - 14);
      } else {
        // Streamproof OFF: OBS is leaking cheats
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.fillText('⚠️ OBS CAPTURE: STREAM LEAK (CHEATS VISIBLE ON STREAM • TOGGLE STREAMPROOF GUARD)', 14, h - 14);
      }
    } else {
      // Player Screen view
      if (streamproofActive) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
        ctx.fillText('● DIRECTX OVERLAY: VISIBLE • OBS HOOK: BYPASSED (WDA_EXCLUDEFROMCAPTURE)', 14, h - 14);
      } else {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.fillText('● DIRECTX OVERLAY: VISIBLE • OBS HOOK: EXPOSED (RECORDING WOULD CAPTURE CHEAT)', 14, h - 14);
      }
    }

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
        background: 'radial-gradient(circle at center, rgba(12, 28, 54, 0.85) 0%, #03050a 100%)',
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

      {/* Top Header Bar: Perspective Switcher (Player Display vs OBS Feed vs Dual PIP) */}
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
        <button
          type="button"
          onClick={() => setViewMode('player')}
          style={{
            padding: '5px 10px',
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

        <button
          type="button"
          onClick={() => setViewMode('obs')}
          style={{
            padding: '5px 10px',
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
          PIP Compare
        </button>

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
            SYNCHRONIZING GTA V PED SKELETON...
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

      {/* Drag instruction tooltip */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '12px',
          fontSize: '0.66rem',
          fontFamily: 'monospace',
          color: 'rgba(255, 255, 255, 0.35)',
          pointerEvents: 'none',
        }}
      >
        DRAG TO ROTATE 360°
      </div>
    </div>
  );
}
