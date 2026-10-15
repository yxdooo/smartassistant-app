import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows, Sparkles, Html } from '@react-three/drei';
import * as THREE from 'three';
import { soundFX } from '../utils/soundFX';
import { RotateCw, Pause, Play, Eye, Sparkles as SparklesIcon, Maximize2 } from 'lucide-react';

/**
 * 3D Annular (Donut) Slice with smooth extrusion, radial hover expansion,
 * and specular materials.
 */
const DonutSlice = ({ 
  startAngle, 
  endAngle, 
  color, 
  name, 
  value, 
  percentage, 
  isExploded, 
  isHovered, 
  onHover, 
  onLeave 
}) => {
  const meshRef = useRef();
  const innerRadius = 1.3;
  const outerRadius = 2.4;
  const midAngle = startAngle + (endAngle - startAngle) / 2;

  // Build the 2D annular sector path
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const xInnerStart = Math.cos(startAngle) * innerRadius;
    const yInnerStart = Math.sin(startAngle) * innerRadius;
    const xOuterStart = Math.cos(startAngle) * outerRadius;
    const yOuterStart = Math.sin(startAngle) * outerRadius;
    const xInnerEnd = Math.cos(endAngle) * innerRadius;
    const yInnerEnd = Math.sin(endAngle) * innerRadius;

    s.moveTo(xInnerStart, yInnerStart);
    s.lineTo(xOuterStart, yOuterStart);
    s.absarc(0, 0, outerRadius, startAngle, endAngle, false);
    s.lineTo(xInnerEnd, yInnerEnd);
    s.absarc(0, 0, innerRadius, endAngle, startAngle, true);
    s.closePath();
    return s;
  }, [startAngle, endAngle]);

  const extrudeSettings = useMemo(() => ({
    steps: 1,
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 4,
    curveSegments: 36
  }), []);

  // Frame animation for smooth lerping (position and scale)
  useFrame(() => {
    if (meshRef.current) {
      const explodeOffset = isExploded ? 0.35 : 0;
      const hoverOffset = isHovered ? 0.25 : 0;
      const totalOffset = explodeOffset + hoverOffset;

      const targetX = Math.cos(midAngle) * totalOffset;
      const targetY = Math.sin(midAngle) * totalOffset;
      const targetZ = isHovered ? 0.25 : 0;

      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.15);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.15);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.15);

      const targetScale = isHovered ? 1.04 : 1;
      meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.15));
    }
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover({ name, value, percentage, color });
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onLeave();
      }}
      castShadow
      receiveShadow
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={color}
        roughness={0.2}
        metalness={0.45}
        emissive={color}
        emissiveIntensity={isHovered ? 0.45 : 0.05}
      />
    </mesh>
  );
};

/**
 * Central spinning Holographic Core displaying summary or active hovered category
 */
const CenterCore = ({ activeSlice, totalSpent }) => {
  const coreRef = useRef();

  useFrame((_, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.5;
      coreRef.current.rotation.x += delta * 0.2;
    }
  });

  return (
    <group position={[0, 0, 0.3]}>
      {/* Wireframe Hologram Ring */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.75, 1]} />
        <meshStandardMaterial 
          wireframe 
          color={activeSlice?.color || '#818cf8'} 
          emissive={activeSlice?.color || '#6366f1'} 
          emissiveIntensity={0.6}
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Central HTML HUD */}
      <Html center position={[0, 0, 0]} className="pointer-events-none select-none">
        <div className="flex flex-col items-center justify-center text-center p-2 rounded-2xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border border-white/40 dark:border-gray-700/40 shadow-xl min-w-[120px] transition-all duration-300">
          {activeSlice ? (
            <>
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                {activeSlice.name}
              </span>
              <span className="text-base font-black text-gray-900 dark:text-white leading-tight">
                ${activeSlice.value.toFixed(0)}
              </span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {activeSlice.percentage}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Total
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white">
                ${totalSpent.toFixed(0)}
              </span>
              <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400">
                All Categories
              </span>
            </>
          )}
        </div>
      </Html>
    </group>
  );
};

const Budget3DChart = ({ data }) => {
  const [activeSlice, setActiveSlice] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isExploded, setIsExploded] = useState(false);

  // Fallback data if empty
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    return [
      { name: 'Housing', value: 850, color: '#4F46E5' },
      { name: 'Groceries', value: 420, color: '#10B981' },
      { name: 'Utilities', value: 180, color: '#F59E0B' },
      { name: 'Transport', value: 120, color: '#EF4444' },
      { name: 'Health', value: 90, color: '#8B5CF6' }
    ];
  }, [data]);

  const defaultPalette = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const total = useMemo(() => chartData.reduce((acc, curr) => acc + curr.value, 0), [chartData]);

  // Compute angles for each segment
  const slices = useMemo(() => {
    let runningAngle = 0;
    return chartData.map((item, index) => {
      const angleSize = (item.value / (total || 1)) * Math.PI * 2;
      const startAngle = runningAngle;
      const endAngle = startAngle + angleSize;
      runningAngle = endAngle;

      return {
        ...item,
        startAngle,
        endAngle,
        percentage: Math.round((item.value / (total || 1)) * 100),
        color: item.color || defaultPalette[index % defaultPalette.length]
      };
    });
  }, [chartData, total]);

  const handleSliceHover = (sliceInfo) => {
    soundFX.playPop();
    setActiveSlice(sliceInfo);
  };

  const handleSliceLeave = () => {
    setActiveSlice(null);
  };

  return (
    <div className="w-full h-96 relative rounded-3xl overflow-hidden bg-gradient-to-br from-gray-50/50 via-white/20 to-indigo-50/20 dark:from-gray-900/60 dark:via-gray-800/40 dark:to-indigo-950/20 border border-white/60 dark:border-gray-800/50 shadow-inner group">
      
      {/* 3D WebGL Canvas */}
      <Canvas 
        shadows 
        camera={{ position: [0, -4.5, 5], fov: 42 }}
        className="cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[8, 12, 8]} intensity={1.2} castShadow shadow-mapSize={1024} />
        <pointLight position={[-8, -8, -4]} intensity={0.6} color="#818cf8" />
        <pointLight position={[0, 5, 2]} intensity={0.4} color="#34d399" />

        {/* Ambient floating dust particles */}
        <Sparkles 
          count={25} 
          scale={7} 
          size={2.5} 
          speed={0.35} 
          color="#818cf8" 
          opacity={0.4} 
        />

        <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.35}>
          <group rotation={[-Math.PI / 3.8, 0, 0]}>
            {slices.map((slice, idx) => (
              <DonutSlice
                key={idx}
                {...slice}
                isExploded={isExploded}
                isHovered={activeSlice?.name === slice.name}
                onHover={handleSliceHover}
                onLeave={handleSliceLeave}
              />
            ))}
            <CenterCore activeSlice={activeSlice} totalSpent={total} />
          </group>
        </Float>

        <ContactShadows 
          position={[0, -2.4, 0]} 
          opacity={0.45} 
          scale={9} 
          blur={2.4} 
          far={5} 
          color="#1e1b4b" 
        />
        
        <OrbitControls 
          enableZoom={false} 
          autoRotate={autoRotate} 
          autoRotateSpeed={0.8} 
          maxPolarAngle={Math.PI / 2.1} 
          minPolarAngle={Math.PI / 6} 
        />
      </Canvas>

      {/* Top Left Badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
          <SparklesIcon size={12} className="text-indigo-500 animate-pulse" />
          Interactive 3D Engine
        </span>
      </div>

      {/* Top Right Controls Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <button
          type="button"
          onClick={() => { soundFX.playPop(); setIsExploded(!isExploded); }}
          title={isExploded ? "Contract View" : "Explode Segments"}
          className={`p-2 rounded-xl text-xs font-bold transition-all shadow-sm backdrop-blur-md border ${
            isExploded 
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20' 
              : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700'
          }`}
        >
          <Maximize2 size={14} />
        </button>

        <button
          type="button"
          onClick={() => { soundFX.playPop(); setAutoRotate(!autoRotate); }}
          title={autoRotate ? "Pause Auto-Rotate" : "Start Auto-Rotate"}
          className={`p-2 rounded-xl text-xs font-bold transition-all shadow-sm backdrop-blur-md border ${
            autoRotate 
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20' 
              : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700'
          }`}
        >
          {autoRotate ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>

      {/* Bottom Hint / Info Bar */}
      <div className="absolute bottom-3 inset-x-3 flex justify-between items-center pointer-events-none">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold bg-white/60 dark:bg-gray-900/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 dark:border-gray-800/40">
          Rotate: Drag • Tilt: Drag Vertically
        </span>

        {activeSlice && (
          <span className="text-xs font-bold text-gray-800 dark:text-white bg-white/90 dark:bg-gray-800/90 backdrop-blur-md px-3 py-1 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeSlice.color }} />
            <span>{activeSlice.name}:</span>
            <span className="font-black">${activeSlice.value.toFixed(2)}</span>
            <span className="text-indigo-500">({activeSlice.percentage}%)</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default Budget3DChart;
