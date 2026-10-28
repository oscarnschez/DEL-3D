import * as THREE from 'three';
import { Part } from '@/interaction/Part';
import { cloneMaterial, getMaterials } from '../materials';
import { useDisposable } from '../resources';
import { extrudeX, lathe, polyShape, roundedRectShape } from '../geometry/builders';
import { useEngine } from './useEngine';
import { Bolts } from './Bolts';
import type { EngineLayout } from '@/engines/derive';

/** Cotas transversales comunes de las carcasas. */
export function shellDims(L: EngineLayout) {
  const headHalf = L.kind === 'ohv' ? L.camZ + 0.045 : Math.max(L.camZ + L.camBaseRadius + 0.02, L.rockerPivotZ + L.lobeOffset + 0.045, L.bore * 0.95);
  const deckHalf = headHalf - 0.01;
  const rodSweep = L.r + L.pinRadius + 0.012 + 0.025;
  const crankHalf = Math.max(deckHalf + 0.012, rodSweep);
  const linerBottom = L.l - L.r - L.def.geometry.compressionHeight * 0.62 + 0.01;
  return { headHalf, deckHalf, crankHalf, linerBottom, coverTop: Math.max(L.rockerPivotY + 0.055, L.camY + L.camBaseRadius + 0.045) };
}

function useTinted(base: THREE.MeshStandardMaterial, color: string) {
  return useDisposable(() => {
    const m = cloneMaterial(base);
    m.color.set(color);
    return m;
  }, [base, color]);
}

export function Block() {
  const { L } = useEngine();
  const M = getMaterials();
  const paint = useTinted(M.paintedIron, L.def.style.block);
  const d = shellDims(L);
  const geo = useDisposable(() => {
    const top = L.deckY;
    const bot = L.crankcaseBottomY;
    const flare = d.linerBottom - 0.03;
    const half = (s: number): [number, number][] => [
      [s * d.deckHalf, top],
      [s * d.deckHalf, top - 0.03],
      [s * (d.deckHalf + 0.006), top - 0.045],
      [s * (d.deckHalf + 0.006), flare + 0.06],
      [s * d.deckHalf, flare + 0.03],
      [s * d.crankHalf, flare - 0.04],
      [s * d.crankHalf, bot + 0.022],
      [s * (d.crankHalf + 0.014), bot + 0.014],
      [s * (d.crankHalf + 0.014), bot],
    ];
    const right = half(1);
    const left = half(-1).reverse();
    const pts = [...right, ...left];
    const body = extrudeX(polyShape(pts), L.blockLength, 0.004, 4);
    // bosses de cilindro (camisas de agua) en el lado de admisión y escape
    const boss = extrudeX(roundedRectShape(0.016, top - 0.05 - (flare + 0.07), 0.006), L.bore * 0.9, 0.004, 4);
    // nervaduras del cárter
    const rib = extrudeX(polyShape([[0, 0], [0.012, 0], [0.004, 0.09], [0, 0.09]]), 0.012, 0.001, 2);
    // tapones de expansión
    const plug = lathe([[0, 0], [0.018, 0], [0.018, 0.004], [0.012, 0.006], [0, 0.006]], 28);
    plug.rotateX(Math.PI / 2);
    return { body, boss, rib, plug, flare, bossY: (top - 0.05 + flare + 0.07) / 2 };
  }, [L, d.deckHalf, d.crankHalf, d.linerBottom]);

  const bolts = useDisposable(() => {
    const items: { p: [number, number, number]; dir?: [number, number, number] }[] = [];
    for (let k = 0; k <= L.n; k++) {
      const x = L.cylX[0] - L.pitch / 2 + k * L.pitch;
      for (const s of [-1, 1]) items.push({ p: [x, L.crankcaseBottomY + 0.03, s * (d.crankHalf + 0.001)], dir: [0, 0, s] });
    }
    return items;
  }, [L, d.crankHalf]);

  return (
    <Part id="block" shell>
      <mesh geometry={geo.body} material={paint} />
      {L.cylX.map((x, i) => (
        <group key={i}>
          <mesh geometry={geo.boss} material={paint} position={[x, geo.bossY, -d.deckHalf - 0.006]} />
          <mesh geometry={geo.boss} material={paint} position={[x, geo.bossY, d.deckHalf + 0.006]} />
          {[-1, 1].map((s) => (
            <mesh
              key={s}
              geometry={geo.rib}
              material={paint}
              position={[x + L.pitch / 2, geo.flare - 0.14, s * d.crankHalf]}
              rotation={[0, s > 0 ? 0 : Math.PI, 0]}
            />
          ))}
          <mesh geometry={geo.plug} material={M.zinc} position={[x, geo.flare + 0.03, -d.deckHalf - 0.013]} rotation={[Math.PI, 0, 0]} />
        </group>
      ))}
      <Bolts items={bolts} d={0.009} />
    </Part>
  );
}

/** Camisas húmedas de cilindro con collarín superior. */
export function Liners() {
  const { L } = useEngine();
  const M = getMaterials();
  const d = shellDims(L);
  const geo = useDisposable(() => {
    const ri = L.bore / 2 + 0.0002;
    const ro = ri + 0.0075;
    const top = L.deckY - 0.0005;
    const bot = d.linerBottom - 0.03;
    return lathe(
      [
        [ri, top],
        [ri, bot],
        [ro - 0.002, bot],
        [ro, bot + 0.004],
        [ro, top - 0.022],
        [ro + 0.007, top - 0.018],
        [ro + 0.007, top],
      ],
      64,
    );
  }, [L, d.linerBottom]);
  return (
    <>
      {L.cylX.map((x, i) => (
        <Part key={i} id="liner" index={i + 1} shell>
          <mesh geometry={geo} material={M.rawIron} position={[x, 0, 0]} />
        </Part>
      ))}
    </>
  );
}

export function MainBearingCaps() {
  const { L } = useEngine();
  const M = getMaterials();
  const geo = useDisposable(() => {
    const R = L.mainJournalRadius;
    const w = R * 2.6;
    const h = R * 1.6;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2, -h * 0.55);
    s.quadraticCurveTo(-w / 2, -h, 0, -h);
    s.quadraticCurveTo(w / 2, -h, w / 2, -h * 0.55);
    s.lineTo(w / 2, 0);
    s.lineTo(R + 0.002, 0);
    s.absarc(0, 0, R + 0.002, 0, Math.PI, true);
    s.lineTo(-w / 2, 0);
    return extrudeX(s, L.bore * 0.28, 0.002, 24);
  }, [L]);
  const bolts = useDisposable(
    () =>
      Array.from({ length: L.n + 1 }, (_, k) => {
        const x = L.cylX[0] - L.pitch / 2 + k * L.pitch;
        return [-1, 1].map((s) => ({ p: [x, -L.mainJournalRadius * 1.6, s * L.mainJournalRadius * 1.05] as [number, number, number], dir: [0, -1, 0] as [number, number, number] }));
      }).flat(),
    [L],
  );
  return (
    <Part id="mainBearings">
      {Array.from({ length: L.n + 1 }, (_, k) => (
        <mesh key={k} geometry={geo} material={M.rawIron} position={[L.cylX[0] - L.pitch / 2 + k * L.pitch, 0, 0]} />
      ))}
      <Bolts items={bolts} d={0.01} />
    </Part>
  );
}

export function CylinderHead() {
  const { L } = useEngine();
  const M = getMaterials();
  const paint = useTinted(M.paintedIron, L.def.style.head);
  const d = shellDims(L);
  const geo = useDisposable(() => {
    const y0 = L.deckY + 0.0015;
    const y1 = L.headTopY;
    const w = d.headHalf;
    const pts: [number, number][] = [
      [w, y0],
      [w, y1 - 0.012],
      [w - 0.012, y1],
      [-w + 0.012, y1],
      [-w, y1 - 0.012],
      [-w, y0],
    ];
    const body = extrudeX(polyShape(pts), L.blockLength - 0.01, 0.004, 4);
    const gasket = extrudeX(roundedRectShape(d.deckHalf * 2, 0.0015, 0.0005), L.blockLength - 0.004, 0, 2);
    const port = extrudeX(roundedRectShape(0.018, (y1 - y0) * 0.55, 0.008), L.bore * 0.62, 0.003, 6);
    // tapas de cojinete del árbol de levas
    const capShape = new THREE.Shape();
    const cr = L.camBaseRadius * 0.62;
    capShape.moveTo(-cr - 0.012, 0);
    capShape.lineTo(-cr, 0);
    capShape.absarc(0, 0, cr, Math.PI, 0, true);
    capShape.lineTo(cr + 0.012, 0);
    capShape.lineTo(cr + 0.012, 0.01);
    capShape.quadraticCurveTo(cr + 0.012, cr + 0.012, 0, cr + 0.012);
    capShape.quadraticCurveTo(-cr - 0.012, cr + 0.012, -cr - 0.012, 0.01);
    capShape.closePath();
    const cap = extrudeX(capShape, 0.022, 0.0015, 16);
    const towerH = Math.max(0.001, L.camY - L.headTopY);
    const tower = extrudeX(roundedRectShape((cr + 0.012) * 2, towerH, 0.004, 0, towerH / 2), 0.022, 0.0015, 4);
    return { body, gasket, port, cap, tower, portY: y0 + (L.headTopY - y0) * 0.45 };
  }, [L, d.headHalf, d.deckHalf]);
  const bolts = useDisposable(() => {
    const items: { p: [number, number, number] }[] = [];
    for (let k = 0; k <= L.n; k++) {
      const x = L.cylX[0] - L.pitch / 2 + k * L.pitch;
      const zs = L.kind === 'dohc' ? [-L.camZ, L.camZ] : L.kind === 'sohc' ? [0] : [];
      for (const z of zs) {
        items.push({ p: [x, L.camY, z + L.camBaseRadius * 0.62 + 0.006] });
        items.push({ p: [x, L.camY, z - L.camBaseRadius * 0.62 - 0.006] });
      }
    }
    return items;
  }, [L]);
  return (
    <Part id="head" shell>
      <mesh geometry={geo.gasket} material={M.gasket} position={[0, L.deckY + 0.00075, 0]} />
      <mesh geometry={geo.body} material={paint} />
      {L.cylX.map((x, i) => (
        <group key={i}>
          <mesh geometry={geo.port} material={paint} position={[x, geo.portY, -d.headHalf - 0.008]} />
          <mesh geometry={geo.port} material={paint} position={[x, geo.portY, d.headHalf + 0.008]} />
        </group>
      ))}
      {Array.from({ length: L.n + 1 }, (_, k) => {
        const x = L.cylX[0] - L.pitch / 2 + k * L.pitch;
        const zs = L.kind === 'dohc' ? [-L.camZ, L.camZ] : L.kind === 'sohc' ? [0] : [];
        return zs.map((z) => (
          <group key={`${k}${z}`}>
            <mesh geometry={geo.cap} material={M.aluminumCast} position={[x, L.camY, z]} />
            {L.kind === 'sohc' && <mesh geometry={geo.tower} material={paint} position={[x, L.headTopY, z]} />}
          </group>
        ));
      })}
      <Bolts items={bolts} d={0.006} />
    </Part>
  );
}

export function ValveCover() {
  const { L } = useEngine();
  const M = getMaterials();
  const mat = useDisposable(() => {
    const m = cloneMaterial(M.coverPaint);
    m.color.set(L.def.style.cover);
    return m;
  }, [M.coverPaint, L.def.style.cover]);
  const d = shellDims(L);
  const style = L.def.style.coverStyle;
  const geo = useDisposable(() => {
    const y0 = L.headTopY;
    const y1 = d.coverTop;
    const w = d.headHalf - 0.004;
    const s = new THREE.Shape();
    s.moveTo(w, y0);
    s.lineTo(w, y1 - 0.04);
    s.quadraticCurveTo(w, y1, w - 0.05, y1);
    s.lineTo(-w + 0.05, y1);
    s.quadraticCurveTo(-w, y1, -w, y1 - 0.04);
    s.lineTo(-w, y0);
    s.closePath();
    const len = L.blockLength - 0.03;
    const segs = style === 'split' ? 2 : 1;
    const body = extrudeX(s, len / segs - (segs > 1 ? 0.01 : 0), 0.008, 16);
    const rib = extrudeX(roundedRectShape(w * 1.5, 0.008, 0.003), 0.012, 0.002, 4);
    const flange = extrudeX(roundedRectShape(w * 2 + 0.012, 0.01, 0.003), len + 0.006, 0.002, 4);
    const lip = extrudeX(roundedRectShape(w * 0.9, 0.012, 0.005), len * 0.8, 0.003, 6);
    // junta de caucho entre tapa y culata (asoma bajo la pestaña)
    const seal = extrudeX(roundedRectShape(w * 2 + 0.008, 0.003, 0.001), len + 0.002, 0.0005, 2);
    return { body, rib, flange, lip, seal, len, segs, y1 };
  }, [L, d.headHalf, d.coverTop, style]);
  const bolts = useDisposable(() => {
    const items: { p: [number, number, number] }[] = [];
    const w = d.headHalf + 0.0;
    for (let k = 0; k < 10; k++) {
      const x = -geo.len / 2 + 0.03 + (k * (geo.len - 0.06)) / 9;
      items.push({ p: [x, L.headTopY + 0.01, w] }, { p: [x, L.headTopY + 0.01, -w] });
    }
    return items;
  }, [L, geo.len, d.headHalf]);
  return (
    <Part id="valveCover" shell>
      <mesh geometry={geo.flange} material={mat} position={[0, L.headTopY + 0.005, 0]} />
      <mesh geometry={geo.seal} material={M.rubber} position={[0, L.headTopY + 0.0015, 0]} />
      {Array.from({ length: geo.segs }, (_, k) => (
        <mesh key={k} geometry={geo.body} material={mat} position={[geo.segs > 1 ? (k - 0.5) * (geo.len / 2) : 0, 0, 0]} />
      ))}
      {style === 'ribbed' &&
        L.cylX.map((x, i) => <mesh key={i} geometry={geo.rib} material={mat} position={[x, geo.y1 + 0.003, 0]} />)}
      {style === 'stepped' && <mesh geometry={geo.lip} material={mat} position={[0, geo.y1 + 0.006, 0]} />}
      <Bolts items={bolts} d={0.006} />
    </Part>
  );
}

export function OilPan() {
  const { L } = useEngine();
  const M = getMaterials();
  const d = shellDims(L);
  const geo = useDisposable(() => {
    const y0 = L.crankcaseBottomY;
    const y1 = L.sumpBottomY;
    const w = d.crankHalf + 0.014;
    const shallow: [number, number][] = [
      [w, y0],
      [w, y0 - 0.012],
      [w - 0.01, y0 - 0.012],
      [w * 0.86, y0 - (y0 - y1) * 0.45],
      [-w * 0.86, y0 - (y0 - y1) * 0.45],
      [-w + 0.01, y0 - 0.012],
      [-w, y0 - 0.012],
      [-w, y0],
    ];
    const pan = extrudeX(polyShape(shallow), L.blockLength, 0.004, 4);
    const deep: [number, number][] = [
      [w * 0.86, y0 - 0.012],
      [w * 0.8, y1 + 0.01],
      [w * 0.75, y1],
      [-w * 0.75, y1],
      [-w * 0.8, y1 + 0.01],
      [-w * 0.86, y0 - 0.012],
    ];
    const sump = extrudeX(polyShape(deep), L.blockLength * 0.42, 0.01, 4);
    const plug = new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6);
    return { pan, sump, plug, w };
  }, [L, d.crankHalf]);
  const bolts = useDisposable(() => {
    const items: { p: [number, number, number]; dir?: [number, number, number] }[] = [];
    for (let k = 0; k < 12; k++) {
      const x = -L.blockLength / 2 + 0.03 + (k * (L.blockLength - 0.06)) / 11;
      items.push({ p: [x, L.crankcaseBottomY - 0.012, geo.w - 0.007], dir: [0, -1, 0] }, { p: [x, L.crankcaseBottomY - 0.012, -geo.w + 0.007], dir: [0, -1, 0] });
    }
    return items;
  }, [L, geo.w]);
  return (
    <Part id="oilPan" shell>
      <mesh geometry={geo.pan} material={M.blackPaint} />
      <mesh geometry={geo.sump} material={M.blackPaint} position={[L.blockLength * 0.25, 0, 0]} />
      <mesh geometry={geo.plug} material={M.bolt} position={[L.blockLength * 0.3, L.sumpBottomY - 0.006, 0]} />
      <Bolts items={bolts} d={0.006} />
    </Part>
  );
}
