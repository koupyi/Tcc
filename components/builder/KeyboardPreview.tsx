import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import type { BuilderProduct, LayoutSize } from "@/data/builderProducts";

interface KeyboardPreviewProps {
  selectedLayout: LayoutSize;
  selectedCase: BuilderProduct | null;
  selectedKeycap: BuilderProduct | null;
  selectedSwitch: BuilderProduct | null;
  selectedPcb: BuilderProduct | null;
  caseColor: string;
}

const layoutKeyCount: Record<LayoutSize, number> = {
  "60%": 61,
  "65%": 68,
  "75%": 84,
  TKL: 87,
  Full: 104,
};

const modelUrls: Record<LayoutSize, string> = {
  "60%": "/teclado-60.glb",
  "65%": "/teclado-65-base.glb",
  "75%": "/teclado-75-base.glb",
  TKL: "/teclado-75-base.glb",
  Full: "/teclado-100.glb",
};

const getModelUrl = (layout: LayoutSize, keycap: BuilderProduct | null): string => {
  const keycapName = keycap?.name.toLowerCase() ?? "";

  if (layout === "65%" && keycapName.includes("gmk")) return "/teclado-65-gmk.glb";
  if (layout === "75%" && keycapName.includes("gmk")) return "/teclado-75-gmk.glb";

  return modelUrls[layout] ?? modelUrls["65%"];
};

const KeyboardPreview = ({ selectedLayout, selectedCase, selectedKeycap, selectedSwitch, selectedPcb, caseColor }: KeyboardPreviewProps) => {
  const keyCount = layoutKeyCount[selectedLayout] ?? 68;
  const caseColorHex = caseColor || "#2a2a2e";
  const selectedModelUrl = getModelUrl(selectedLayout, selectedKeycap);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  const normalizeColor = (value: string) => (value.startsWith("#") ? value : `#${value}`);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(6, 10, 7);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(-6, 6, -5);
    scene.add(rimLight);

    const loader = new GLTFLoader();

    const fitCameraToModel = (model: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, 1);
      const distance = maxDimension / (8 * Math.tan((camera.fov * Math.PI) / 360)) * 1.8;

      model.position.sub(center);
      camera.position.set(0, Math.max(size.y * 0.2, 0.5), distance);
      camera.lookAt(0, 0, 0);
      controlsRef.current?.target.set(0, 0, 0);
      controlsRef.current?.update();
    };

    const loadModel = async () => {
      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current = null;
      }

      try {
        const gltf = await loader.loadAsync(selectedModelUrl);
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((material) => {
                if (material instanceof THREE.Material) {
                  material.roughness = 0.45;
                }
              });
            } else if (mesh.material instanceof THREE.Material) {
              mesh.material.roughness = 0.45;
            }
          }
        });

        scene.add(model);
        modelRef.current = model;
        fitCameraToModel(model);
      } catch (error) {
        console.error("Falha ao carregar modelo GLB:", error);
      }
    };

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 4;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    loadModel();

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
    };

    animate();
    sceneRef.current = scene;
    cameraRef.current = camera;

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      controls.dispose();
      renderer.dispose();
      window.removeEventListener("resize", resize);
    };
  }, [selectedModelUrl]);

  useEffect(() => {
    if (!modelRef.current) return;

    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.color.set(normalizeColor(caseColorHex));
            }
          });
        } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.color.set(normalizeColor(caseColorHex));
        }
      }
    });
  }, [caseColorHex]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Layout</span>
        <span className="text-sm font-bold" style={{ color: "hsl(var(--foreground-strong))" }}>{selectedLayout}</span>
        <span className="text-xs text-muted-foreground">({keyCount} teclas)</span>
      </div>

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative rounded-3xl overflow-hidden border border-white/10 bg-slate-950/80 shadow-2xl"
      >
        <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/70">
          Visualização 3D
        </div>
        <div className="h-[320px] w-full">
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>
      </motion.div>

      <div className="flex flex-wrap justify-center gap-2 text-[10px]">
        {selectedSwitch && (
          <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/20">
            {selectedSwitch.name}
          </span>
        )}
        {selectedKeycap && (
          <span className="px-2.5 py-1 rounded-full bg-secondary/15 text-secondary border border-secondary/20">
            {selectedKeycap.name}
          </span>
        )}
        {selectedPcb && (
          <span className="px-2.5 py-1 rounded-full bg-accent text-accent-foreground border border-border">
            {selectedPcb.name}
          </span>
        )}
        {selectedCase && (
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
            {selectedCase.name}
          </span>
        )}
      </div>
    </div>
  );
};

export default KeyboardPreview;
