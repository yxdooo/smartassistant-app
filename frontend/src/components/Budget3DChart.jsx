import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const PieSlice3D = ({ startAngle, endAngle, color, label, value, index, totalSlices }) => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);
  
  // Calculate the mid angle for positioning
  const midAngle = startAngle + (endAngle - startAngle) / 2;
  const radius = 2;
  const depth = hovered ? 1 : 0.5;

  // Create a custom geometry for the slice
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.arc(0, 0, radius, startAngle, endAngle, false);
  shape.lineTo(0, 0);

  const extrudeSettings = {
    steps: 1,
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 32
  };

  // Animate hover effect
  useFrame((state) => {
    if (meshRef.current) {
      const targetZ = hovered ? 0.5 : 0;
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1);
      
      const targetScale = hovered ? 1.05 : 1;
      meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.1));
    }
  });

  // Calculate text position
  const textRadius = radius * 1.5;
  const textX = Math.cos(midAngle) * textRadius;
  const textY = Math.sin(midAngle) * textRadius;

  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial color={color} roughness={0.1} metalness={0.4} envMapIntensity={1} />
      </mesh>
      
      {/* Label Text */}
      <Text
        position={[textX, textY, depth + 0.1]}
        fontSize={0.25}
        color={hovered ? color : '#888'}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
      >
        {label}
      </Text>
      <Text
        position={[textX, textY - 0.3, depth + 0.1]}
        fontSize={0.2}
        color={hovered ? '#ffffff' : '#666'}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
      >
        ${value.toFixed(0)}
      </Text>
    </group>
  );
};

const Budget3DChart = ({ data }) => {
  // If no data, render a placeholder 3D ring
  const chartData = data && data.length > 0 ? data : [{ name: 'Empty', value: 1, color: '#4F46E5' }];
  
  // Calculate total for angles
  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);
  let currentAngle = 0;

  // Add colors if not provided
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="w-full h-80 relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing bg-transparent">
      <Canvas camera={{ position: [0, -5, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4F46E5" />
        
        <Environment preset="city" />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <group rotation={[-Math.PI / 4, 0, 0]}>
            {chartData.map((item, index) => {
              const startAngle = currentAngle;
              const angleSize = (item.value / total) * Math.PI * 2;
              const endAngle = startAngle + angleSize;
              currentAngle = endAngle;

              return (
                <PieSlice3D
                  key={index}
                  index={index}
                  totalSlices={chartData.length}
                  startAngle={startAngle}
                  endAngle={endAngle}
                  color={item.color || colors[index % colors.length]}
                  label={item.name}
                  value={item.value}
                />
              );
            })}
          </group>
        </Float>

        <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={10} blur={2} far={4} />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} maxPolarAngle={Math.PI / 2} minPolarAngle={0} />
      </Canvas>
      <div className="absolute top-2 left-2 pointer-events-none">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white/50 dark:bg-gray-800/50 backdrop-blur-md px-2 py-1 rounded-md">
           3D Interactive
        </span>
      </div>
    </div>
  );
};

export default Budget3DChart;
