import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export type KeyboardCaseFinish = "solid" | "wood";

export interface PreviewItem {
  productId: string;
  name: string;
}

interface KeyboardPreviewProps {
  selectedLayout: string;
  selectedCase: PreviewItem | null;
  selectedKeycap: PreviewItem | null;
  selectedSwitch: PreviewItem | null;
  selectedPcb: PreviewItem | null;
  caseColor: string;
  finish?: KeyboardCaseFinish;
}

const layoutKeyCount: Record<string, number> = {
  "60": 61,
  "65": 68,
  "75": 84,
  tkl: 87,
  full: 104,
};

const modelUrls: Record<string, string> = {
  "60": "/teclado-60.glb",
  "65": "/teclado-65-base.glb",
  "75": "/teclado-75-base.glb",
  tkl: "/teclado-75-base.glb",
  full: "/teclado-100.glb",
};

const normalizeLayoutValue = (layout: string | null | undefined): string => {
  const normalized = (layout ?? "65").trim().toLowerCase().replace(/%/g, "").replace(/\s+/g, "");

  if (normalized === "60" || normalized === "65" || normalized === "75") return normalized;
  if (normalized === "tkl" || normalized === "full") return normalized;
  return "65";
};

const isBotanicalTheme = (item: PreviewItem | null): boolean => {
  const itemName = item?.name?.toLowerCase() ?? "";
  return itemName.includes("botanical") || itemName.includes("garden");
};

const isGmkKeycap = (keycap: PreviewItem | null): boolean => {
  const keycapName = keycap?.name?.toLowerCase() ?? "";
  return keycapName.includes("gmk");
};

export const getModelUrl = (layout: string | null | undefined, keycap: PreviewItem | null, caseItem: PreviewItem | null = null): string => {
  const normalizedLayout = normalizeLayoutValue(layout);

  if (normalizedLayout === "75" && (isBotanicalTheme(keycap) || isBotanicalTheme(caseItem))) {
    return "/Teclado%2075%25%20botanical.glb";
  }

  if (normalizedLayout === "65" && isGmkKeycap(keycap)) return "/teclado-65-gmk.glb";
  if (normalizedLayout === "75" && isGmkKeycap(keycap)) return "/teclado-75-gmk.glb";

  return modelUrls[normalizedLayout] ?? modelUrls["65"];
};

export const resolveCaseFinish = (
  finish: KeyboardCaseFinish | undefined,
  selectedCase: PreviewItem | null,
  selectedKeycap: PreviewItem | null,
): KeyboardCaseFinish => {
  if (finish === "wood") return "wood";
  if (finish === "solid") return "solid";
  if (isBotanicalTheme(selectedCase) || isBotanicalTheme(selectedKeycap)) return "wood";
  return "solid";
};

const buildWoodTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, "#7a4d2e");
  gradient.addColorStop(0.3, "#c38d54");
  gradient.addColorStop(0.6, "#9d6840");
  gradient.addColorStop(1, "#53341d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 150; i++) {
    const y = Math.random() * 256;
    const x = Math.random() * 256;
    const width = 18 + Math.random() * 60;
    ctx.strokeStyle = `rgba(80, 50, 24, ${0.12 + Math.random() * 0.22})`;
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + width * 0.5, y - 10, x + width * 0.8, y + 8, x + width, y + 2);
    ctx.stroke();
  }

  const woodTexture = new THREE.CanvasTexture(canvas);
  woodTexture.wrapS = THREE.RepeatWrapping;
  woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(1.8, 1.8);
  return woodTexture;
};

const KeyboardPreview = ({ selectedLayout, selectedCase, selectedKeycap, selectedSwitch, selectedPcb, caseColor, finish }: KeyboardPreviewProps) => {
  const normalizedLayout = normalizeLayoutValue(selectedLayout);
  const keyCount = layoutKeyCount[normalizedLayout] ?? 68;
  const caseColorHex = caseColor || "#2a2a2e";
  const effectiveFinish = resolveCaseFinish(finish, selectedCase, selectedKeycap);
  const selectedModelUrl = getModelUrl(normalizedLayout, selectedKeycap, selectedCase);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number | null>(null);

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

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      controls.dispose();
      renderer.dispose();
      window.removeEventListener("resize", resize);
    };
  }, [selectedModelUrl]);

  useEffect(() => {
    if (!modelRef.current) return;

    const woodTexture = effectiveFinish === "wood" ? buildWoodTexture() : null;

    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const applyMaterial = (material: THREE.Material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          material.color.set(normalizeColor(caseColorHex));
          material.roughness = effectiveFinish === "wood" ? 0.9 : 0.45;
          material.metalness = effectiveFinish === "wood" ? 0.1 : 0.2;

          if (effectiveFinish === "wood") {
            material.map = woodTexture ?? material.map;
            material.bumpMap = woodTexture ?? material.bumpMap;
            material.bumpScale = 0.18;
          } else {
            material.map = null;
            material.bumpMap = null;
          }
          material.needsUpdate = true;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(applyMaterial);
        } else if (mesh.material) {
          applyMaterial(mesh.material);
        }
      }
    });

    return () => {
      if (woodTexture) woodTexture.dispose();
    };
  }, [caseColorHex, effectiveFinish]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Layout</span>
        <span className="text-sm font-bold" style={{ color: "hsl(var(--foreground-strong))" }}>{selectedLayout || "65"}</span>
        <span className="text-xs text-muted-foreground">({keyCount} teclas)</span>
      </div>

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl"
      >
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          3D
        </div>
        <div className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-white/60">
          drag to orbit
        </div>
        <div className="h-[360px] w-full">
          <canvas ref={canvasRef} aria-label="Preview 3D do teclado" className="h-full w-full cursor-grab active:cursor-grabbing" />
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
