import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

type Vec2 = [number, number];

type Mode = 'move' | 'rotate';

interface Rectangle {
  id: number;
  points: Vec2[]; // 4 corner points
  offset: Vec2;
  anchor: Vec2;
  color: string;
}

interface DragState {
  shape: Rectangle;
  target: 'shape' | 'anchor' | 'corner' | 'edge';
  pointIndex?: number;
  startPos: Vec2;
  startOffset: Vec2;
  startAnchor: Vec2;
  startPoints: Vec2[];
}

interface RectangleProps {
  shape: Rectangle;
  mode: Mode;
  onDragStart: (shape: Rectangle, target: 'shape' | 'anchor' | 'corner' | 'edge', e: ThreeEvent<PointerEvent>, pointIndex?: number) => void;
  isSelected: boolean;
}

const RectangleShape: React.FC<RectangleProps> = ({ shape, mode, onDragStart, isSelected }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const anchorRef = useRef<THREE.Mesh>(null);

  const transformedPoints = shape.points.map(p => [
    p[0] + shape.offset[0],
    p[1] + shape.offset[1]
  ] as Vec2);

  // Calculate edge midpoints
  const edgePoints: Vec2[] = [
    [(transformedPoints[0][0] + transformedPoints[1][0]) / 2, (transformedPoints[0][1] + transformedPoints[1][1]) / 2],
    [(transformedPoints[1][0] + transformedPoints[2][0]) / 2, (transformedPoints[1][1] + transformedPoints[2][1]) / 2],
    [(transformedPoints[2][0] + transformedPoints[3][0]) / 2, (transformedPoints[2][1] + transformedPoints[3][1]) / 2],
    [(transformedPoints[3][0] + transformedPoints[0][0]) / 2, (transformedPoints[3][1] + transformedPoints[0][1]) / 2],
  ];

  const shapeGeometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(transformedPoints.flatMap(p => [p[0], p[1], 0]));
  shapeGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  shapeGeometry.setIndex([0, 1, 2, 0, 2, 3]);

  const anchorPos: [number, number, number] = [
    shape.anchor[0] + shape.offset[0],
    shape.anchor[1] + shape.offset[1],
    1
  ];

  return (
    <group>
      {/* Anchor point */}
      <mesh
        ref={anchorRef}
        position={anchorPos}
        onPointerDown={(e) => {
          e.stopPropagation();
          onDragStart(shape, 'anchor', e);
        }}
      >
        <circleGeometry args={[0.15, 16]} />
        <meshBasicMaterial color="#888888" />
      </mesh>

      {/* Main shape */}
      <mesh
        ref={meshRef}
        geometry={shapeGeometry}
        onPointerDown={(e) => {
          e.stopPropagation();
          onDragStart(shape, 'shape', e);
        }}
      >
        <meshBasicMaterial
          color={shape.color}
          side={THREE.DoubleSide}
          opacity={isSelected ? 0.7 : 1}
          transparent
        />
      </mesh>

      {/* Corner handles */}
      {transformedPoints.map((point, i) => (
        <mesh
          key={`corner-${i}`}
          position={[point[0], point[1], 2]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragStart(shape, 'corner', e, i);
          }}
        >
          <circleGeometry args={[0.12, 16]} />
          <meshBasicMaterial color="#ff00ff" />
        </mesh>
      ))}

      {/* Edge handles */}
      {edgePoints.map((point, i) => (
        <mesh
          key={`edge-${i}`}
          position={[point[0], point[1], 2]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragStart(shape, 'edge', e, i);
          }}
        >
          <circleGeometry args={[0.1, 16]} />
          <meshBasicMaterial color="#ff00ff" />
        </mesh>
      ))}
    </group>
  );
};

const Scene: React.FC = () => {
  const [shapes, setShapes] = useState<Rectangle[]>([
    {
      id: 1,
      points: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
      offset: [-3, 0],
      anchor: [0, 0],
      color: '#0000ff'
    },
    {
      id: 2,
      points: [[-1.5, -1], [1.5, -1], [1.5, 1], [-1.5, 1]],
      offset: [3, 0],
      anchor: [0, 0],
      color: '#00ff00'
    }
  ]);

  const [mode, setMode] = useState<Mode>('move');
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [selectedShape, setSelectedShape] = useState<number | null>(null);
  const { camera, gl } = useThree();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setMode(prev => {
          if (prev === 'move') return 'rotate';
          return 'move';
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getMousePos = (e: PointerEvent): Vec2 => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const vec = new THREE.Vector3(x, y, 0);
    vec.unproject(camera);
    return [vec.x, vec.y];
  };

  const handleDragStart = (
    shape: Rectangle,
    target: 'shape' | 'anchor' | 'corner' | 'edge',
    e: ThreeEvent<PointerEvent>,
    pointIndex?: number
  ) => {
    const pos = getMousePos(e.nativeEvent);
    setDragging({
      shape,
      target,
      pointIndex,
      startPos: pos,
      startOffset: [...shape.offset] as Vec2,
      startAnchor: [...shape.anchor] as Vec2,
      startPoints: shape.points.map(p => [...p] as Vec2)
    });
    setSelectedShape(shape.id);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragging) return;

    const pos = getMousePos(e);
    const dx = pos[0] - dragging.startPos[0];
    const dy = pos[1] - dragging.startPos[1];

    setShapes(prev => prev.map(s => {
      if (s.id !== dragging.shape.id) return s;

      if (mode === 'move') {
        if (dragging.target === 'shape') {
          return {
            ...s,
            offset: [
              dragging.startOffset[0] + dx,
              dragging.startOffset[1] + dy
            ] as Vec2
          };
        } else if (dragging.target === 'anchor') {
          return {
            ...s,
            anchor: [
              dragging.startAnchor[0] + dx,
              dragging.startAnchor[1] + dy
            ] as Vec2
          };
        } else {

          const anchorWorld: Vec2 = [
            dragging.startAnchor[0] + dragging.startOffset[0],
            dragging.startAnchor[1] + dragging.startOffset[1]
          ];

          // Calculate the local coordinate system (u, v axes)
          // Use the first edge as the u-axis and perpendicular as v-axis
          const edge1: Vec2 = [
            dragging.startPoints[1][0] - dragging.startPoints[0][0],
            dragging.startPoints[1][1] - dragging.startPoints[0][1]
          ];
          const edge2: Vec2 = [
            dragging.startPoints[3][0] - dragging.startPoints[0][0],
            dragging.startPoints[3][1] - dragging.startPoints[0][1]
          ];

          // Normalize the axes
          const uLen = Math.hypot(edge1[0], edge1[1]);
          const vLen = Math.hypot(edge2[0], edge2[1]);
          const uAxis: Vec2 = [edge1[0] / uLen, edge1[1] / uLen];
          const vAxis: Vec2 = [edge2[0] / vLen, edge2[1] / vLen];

          let scaleU = 1;
          let scaleV = 1;

          if (dragging.target === 'corner' && dragging.pointIndex !== undefined) {
            // Scale based on corner movement
            const cornerLocal = [
              dragging.startPoints[dragging.pointIndex][0] - dragging.startAnchor[0],
              dragging.startPoints[dragging.pointIndex][1] - dragging.startAnchor[1]
            ];
            const cornerU = cornerLocal[0] * uAxis[0] + cornerLocal[1] * uAxis[1];
            const cornerV = cornerLocal[0] * vAxis[0] + cornerLocal[1] * vAxis[1];

            const newCorner: Vec2 = [pos[0] - anchorWorld[0], pos[1] - anchorWorld[1]];
            const newU = newCorner[0] * uAxis[0] + newCorner[1] * uAxis[1];
            const newV = newCorner[0] * vAxis[0] + newCorner[1] * vAxis[1];

            scaleU = Math.abs(cornerU) > 0.01 ? newU / cornerU : 1;
            scaleV = Math.abs(cornerV) > 0.01 ? newV / cornerV : 1;
          } else if (dragging.target === 'edge' && dragging.pointIndex !== undefined) {
            // Scale only along one axis for edge handles
            const i = dragging.pointIndex;
            const nextI = (i + 1) % 4;
            const edgeMid = [
              (dragging.startPoints[i][0] + dragging.startPoints[nextI][0]) / 2 - dragging.startAnchor[0],
              (dragging.startPoints[i][1] + dragging.startPoints[nextI][1]) / 2 - dragging.startAnchor[1]
            ];

            const edgeMidU = edgeMid[0] * uAxis[0] + edgeMid[1] * uAxis[1];
            const edgeMidV = edgeMid[0] * vAxis[0] + edgeMid[1] * vAxis[1];

            const newEdge: Vec2 = [pos[0] - anchorWorld[0], pos[1] - anchorWorld[1]];
            const newU = newEdge[0] * uAxis[0] + newEdge[1] * uAxis[1];
            const newV = newEdge[0] * vAxis[0] + newEdge[1] * vAxis[1];

            // Determine which axis to scale based on which component is larger
            if (i % 2 === 1) {
              scaleU = Math.abs(edgeMidU) > 0.01 ? newU / edgeMidU : 1;
            } else {
              scaleV = Math.abs(edgeMidV) > 0.01 ? newV / edgeMidV : 1;
            }
          }

          const newPoints: Vec2[] = dragging.startPoints.map(p => {
            const localX = p[0] - dragging.startAnchor[0];
            const localY = p[1] - dragging.startAnchor[1];

            // Project onto local axes
            const u = localX * uAxis[0] + localY * uAxis[1];
            const v = localX * vAxis[0] + localY * vAxis[1];

            // Scale in local space
            const scaledU = u * scaleU;
            const scaledV = v * scaleV;

            // Convert back to world space
            const worldX = scaledU * uAxis[0] + scaledV * vAxis[0];
            const worldY = scaledU * uAxis[1] + scaledV * vAxis[1];

            return [
              dragging.startAnchor[0] + worldX,
              dragging.startAnchor[1] + worldY
            ];
          });

          return { ...s, points: newPoints };
        }
      } else if (mode === 'rotate') {
        if (dragging.target === 'anchor') return s;

        const anchorWorld: Vec2 = [
          dragging.startAnchor[0] + dragging.startOffset[0],
          dragging.startAnchor[1] + dragging.startOffset[1]
        ];

        let targetPoint: Vec2;

        if (dragging.target === 'corner' && dragging.pointIndex !== undefined) {
          targetPoint = [
            dragging.startPoints[dragging.pointIndex][0] + dragging.startOffset[0],
            dragging.startPoints[dragging.pointIndex][1] + dragging.startOffset[1]
          ];
        } else if (dragging.target === 'edge' && dragging.pointIndex !== undefined) {
          // Calculate edge midpoint from start points
          const i = dragging.pointIndex;
          const nextI = (i + 1) % 4;
          targetPoint = [
            (dragging.startPoints[i][0] + dragging.startPoints[nextI][0]) / 2 + dragging.startOffset[0],
            (dragging.startPoints[i][1] + dragging.startPoints[nextI][1]) / 2 + dragging.startOffset[1]
          ];
        } else {
          // Whole shape rotation
          targetPoint = dragging.startPos;
        }

        const startAngle = Math.atan2(
          targetPoint[1] - anchorWorld[1],
          targetPoint[0] - anchorWorld[0]
        );
        const currentAngle = Math.atan2(
          pos[1] - anchorWorld[1],
          pos[0] - anchorWorld[0]
        );
        const rotation = currentAngle - startAngle;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const newPoints: Vec2[] = dragging.startPoints.map(p => {
          const dx = p[0] - dragging.startAnchor[0];
          const dy = p[1] - dragging.startAnchor[1];
          return [
            dragging.startAnchor[0] + dx * cos - dy * sin,
            dragging.startAnchor[1] + dx * sin + dy * cos
          ];
        });

        return { ...s, points: newPoints };
      }

      return s;
    }));
  };

  const handlePointerUp = () => {
    setDragging(null);
  };

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, mode]);

  return (
    <>
      {shapes.map(shape => (
        <RectangleShape
          key={shape.id}
          shape={shape}
          mode={mode}
          onDragStart={handleDragStart}
          isSelected={selectedShape === shape.id}
        />
      ))}
    </>
  );
};

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('move');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setMode(prev => {
          if (prev === 'move') return 'rotate';
          return 'move';
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#ffffff' }}>
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: 'black',
        fontSize: '18px',
        fontFamily: 'monospace',
        zIndex: 1,
        background: 'rgba(0,0,0,0.1)',
        padding: '10px 20px',
        borderRadius: '8px'
      }}>
        Mode: <strong>{mode.toUpperCase()}</strong>
        <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.8 }}>
          Press SPACE to toggle modes
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 0, 10], zoom: 50 }}
        orthographic
      >
        <Scene />
      </Canvas>
    </div>
  );
};

export default App;