import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Float, 
  Image,
  Environment,
  ContactShadows,
} from '@react-three/drei';
import * as THREE from 'three';

// 3D Image component leveraging drei's Image for perfect rendering
function FloatingDreiImage({ position, rotation, scale, imagePath, speed = 1, transparent = false }) {
  const group = useRef();
  
  return (
    <Float speed={speed} rotationIntensity={0.6} floatIntensity={2}>
      <group ref={group} position={position} rotation={rotation}>
         {/* The Image component acts like object-fit: cover on a 3D plane */}
         <Image url={imagePath} transparent={transparent} scale={scale} />
      </group>
    </Float>
  );
}

// 3D Abstract Shapes to add more depth to the scene
function FloatingShape({ color, position, scale, speed, shape = "sphere" }) {
  return (
    <Float speed={speed * 1.5} rotationIntensity={2} floatIntensity={3}>
      <mesh position={position} scale={scale} castShadow>
        {shape === "sphere" ? (
          <sphereGeometry args={[1, 32, 32]} />
        ) : (
          <torusGeometry args={[1, 0.4, 16, 32]} />
        )}
        <meshPhysicalMaterial 
          color={color} 
          transmission={0.4}
          opacity={1}
          metalness={0.7}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>
    </Float>
  );
}

// Mouse tracking Rig for that "smooth gliding" 3D parallax experience
function Rig() {
  const { camera } = useThree();
  const target = new THREE.Vector3();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize mouse coordinates to -1 to +1
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    // Smoothly interpolate the camera position based on mouse movement
    target.set(mouse.current.x * 2.5, mouse.current.y * 2.5, camera.position.z);
    camera.position.lerp(target, 0.05);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

const AeroDrop3DHero = () => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0, 11], fov: 50 }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 20, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0f9fe8" />
        <directionalLight position={[0, 10, 5]} intensity={1.5} color="#ff5b14" />
        
        {/* Left Edge: Vegetables (Transparent PNG) */}
        <FloatingDreiImage 
          imagePath="/imagesd/Vegetables.png" 
          position={[-6.5, 0.5, -2]} 
          rotation={[0, Math.PI / 8, 0]} 
          scale={[4.5, 4.5]} 
          transparent={true}
          speed={1.2} 
        />
        
        {/* Right Edge: Biryani (JPG) */}
        <FloatingDreiImage 
          imagePath="/imagesd/Biryani.jpg" 
          position={[6.5, -0.5, -1]} 
          rotation={[0, -Math.PI / 10, 0]} 
          scale={[5.5, 3.5]} 
          transparent={false}
          speed={0.9} 
        />

        {/* Abstract 3D Brand Elements scattered near the edges */}
        <FloatingShape color="#ff5b14" position={[-5, -4, -3]} scale={0.7} speed={1.5} shape="sphere" />
        <FloatingShape color="#0f9fe8" position={[5, 4, -4]} scale={0.9} speed={1} shape="torus" />
        <FloatingShape color="#ff5b14" position={[8, -4, -2]} scale={0.5} speed={2} shape="sphere" />
        <FloatingShape color="#0f9fe8" position={[-7, 4.5, -5]} scale={0.8} speed={0.8} shape="sphere" />
        <FloatingShape color="#ffffff" position={[-1, 5, -6]} scale={0.5} speed={1.2} shape="sphere" />
        <FloatingShape color="#ff5b14" position={[2, -5, -4]} scale={0.6} speed={1.8} shape="torus" />

        {/* Global Shadow Plane to ground the scene */}
        <ContactShadows position={[0, -5.5, 0]} opacity={0.6} scale={40} blur={2.5} far={10} />
        
        <Environment preset="city" />
        
        {/* Camera control based on global mouse events */}
        <Rig />
      </Canvas>
    </div>
  );
};

export default AeroDrop3DHero;
