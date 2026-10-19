// Builds a 3D character from a start.ng style object. Pure three.js (no DOM).
const HEX = /^#[0-9a-f]{6}$/i;
const pick = (v, list, fb) => (list.includes(v) ? v : fb);
const col = (v, fb) => (typeof v === 'string' && HEX.test(v) ? v : fb);

export const DEFAULT_STYLE = {
  body: 'male', primaryColor: '#3b82f6', secondaryColor: '#1e293b',
  skinColor: '#c68642', hairColor: '#1a1a1a', hair: 'short', hat: 'none', accessory: 'none',
};

export function cleanStyle(s) {
  s = s && typeof s === 'object' ? s : {};
  const d = DEFAULT_STYLE;
  return {
    body: pick(s.body, ['female', 'male'], d.body),
    primaryColor: col(s.primaryColor, d.primaryColor),
    secondaryColor: col(s.secondaryColor, d.secondaryColor),
    skinColor: col(s.skinColor, d.skinColor),
    hairColor: col(s.hairColor, d.hairColor),
    hair: pick(s.hair, ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'], d.hair),
    hat: pick(s.hat, ['none', 'cap', 'beanie', 'tophat', 'crown'], d.hat),
    accessory: pick(s.accessory, ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'], d.accessory),
  };
}

export function buildCharacter(THREE, rawStyle) {
  const st = cleanStyle(rawStyle);
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const skin = mat(st.skinColor), hairM = mat(st.hairColor);
  const top = mat(st.primaryColor), bottom = mat(st.secondaryColor);
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Torso
  add(body, new THREE.BoxGeometry(0.7, 0.8, 0.4), top, 0, 1.3, 0);
  // Lower half
  if (st.body === 'female') {
    add(body, new THREE.CylinderGeometry(0.3, 0.55, 0.5, 14), bottom, 0, 0.78, 0);
  }
  // Legs (pivot at hip)
  const mkLeg = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 0.9, 0);
    add(g, new THREE.BoxGeometry(0.25, 0.8, 0.28), st.body === 'female' ? skin : bottom, 0, -0.4, 0);
    add(g, new THREE.BoxGeometry(0.27, 0.12, 0.38), bottom, 0, -0.84, 0.05);
    body.add(g);
    return g;
  };
  const legL = mkLeg(-0.18), legR = mkLeg(0.18);
  // Arms (pivot at shoulder)
  const mkArm = (x) => {
    const g = new THREE.Group();
    g.position.set(x, 1.65, 0);
    add(g, new THREE.BoxGeometry(0.2, 0.55, 0.22), top, 0, -0.27, 0);
    add(g, new THREE.BoxGeometry(0.2, 0.25, 0.22), skin, 0, -0.62, 0);
    body.add(g);
    return g;
  };
  const armL = mkArm(-0.46), armR = mkArm(0.46);

  // Head
  const head = new THREE.Group();
  head.position.set(0, 2.0, 0);
  body.add(head);
  add(head, new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  const eyeM = mat('#111111');
  add(head, new THREE.BoxGeometry(0.07, 0.07, 0.03), eyeM, -0.12, 0.04, 0.26);
  add(head, new THREE.BoxGeometry(0.07, 0.07, 0.03), eyeM, 0.12, 0.04, 0.26);

  // Hair
  switch (st.hair) {
    case 'short':
      add(head, new THREE.BoxGeometry(0.54, 0.16, 0.54), hairM, 0, 0.3, 0);
      add(head, new THREE.BoxGeometry(0.54, 0.4, 0.14), hairM, 0, 0.1, -0.22);
      break;
    case 'afro': {
      const m = add(head, new THREE.SphereGeometry(0.4, 16, 12), hairM, 0, 0.2, -0.04);
      m.scale.set(1.05, 0.95, 1);
      break;
    }
    case 'braids':
      add(head, new THREE.BoxGeometry(0.54, 0.16, 0.54), hairM, 0, 0.3, 0);
      for (const x of [-0.22, -0.08, 0.08, 0.22]) {
        add(head, new THREE.BoxGeometry(0.07, 0.7, 0.07), hairM, x, -0.1, -0.28);
      }
      break;
    case 'bun':
      add(head, new THREE.BoxGeometry(0.54, 0.16, 0.54), hairM, 0, 0.3, 0);
      add(head, new THREE.SphereGeometry(0.16, 12, 10), hairM, 0, 0.5, -0.05);
      break;
    case 'ponytail':
      add(head, new THREE.BoxGeometry(0.54, 0.16, 0.54), hairM, 0, 0.3, 0);
      add(head, new THREE.BoxGeometry(0.12, 0.5, 0.12), hairM, 0, -0.1, -0.34);
      break;
    case 'dreads':
      add(head, new THREE.BoxGeometry(0.54, 0.16, 0.54), hairM, 0, 0.3, 0);
      for (const x of [-0.24, -0.12, 0, 0.12, 0.24]) {
        add(head, new THREE.BoxGeometry(0.07, 0.6, 0.07), hairM, x, -0.05, -0.28);
      }
      add(head, new THREE.BoxGeometry(0.07, 0.5, 0.07), hairM, -0.28, -0.05, 0);
      add(head, new THREE.BoxGeometry(0.07, 0.5, 0.07), hairM, 0.28, -0.05, 0);
      break;
    default: // bald
      break;
  }

  // Hat
  const hatM = mat(st.secondaryColor);
  switch (st.hat) {
    case 'cap':
      add(head, new THREE.BoxGeometry(0.56, 0.16, 0.56), hatM, 0, 0.33, 0);
      add(head, new THREE.BoxGeometry(0.5, 0.04, 0.3), hatM, 0, 0.27, 0.4);
      break;
    case 'beanie': {
      const m = add(head, new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), hatM, 0, 0.22, 0);
      m.scale.set(1, 1.1, 1);
      add(head, new THREE.SphereGeometry(0.07, 8, 8), hatM, 0, 0.6, 0);
      break;
    }
    case 'tophat':
      add(head, new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), mat('#111111'), 0, 0.3, 0);
      add(head, new THREE.CylinderGeometry(0.25, 0.25, 0.4, 16), mat('#111111'), 0, 0.52, 0);
      add(head, new THREE.CylinderGeometry(0.255, 0.255, 0.08, 16), mat(st.primaryColor), 0, 0.4, 0);
      break;
    case 'crown': {
      const gold = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.6, roughness: 0.3 });
      add(head, new THREE.CylinderGeometry(0.27, 0.27, 0.14, 16), gold, 0, 0.32, 0);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(head, new THREE.ConeGeometry(0.06, 0.16, 6), gold, Math.cos(a) * 0.24, 0.47, Math.sin(a) * 0.24);
      }
      break;
    }
    default:
      break;
  }

  // Accessory
  switch (st.accessory) {
    case 'glasses': {
      const gm = mat('#111111');
      add(head, new THREE.BoxGeometry(0.18, 0.13, 0.03), gm, -0.12, 0.04, 0.27).material.wireframe = true;
      add(head, new THREE.BoxGeometry(0.18, 0.13, 0.03), gm, 0.12, 0.04, 0.27).material.wireframe = true;
      add(head, new THREE.BoxGeometry(0.06, 0.02, 0.03), gm, 0, 0.05, 0.27);
      break;
    }
    case 'earrings': {
      const g = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.6, roughness: 0.3 });
      add(head, new THREE.SphereGeometry(0.05, 8, 8), g, -0.27, -0.12, 0);
      add(head, new THREE.SphereGeometry(0.05, 8, 8), g, 0.27, -0.12, 0);
      break;
    }
    case 'beard':
      add(head, new THREE.BoxGeometry(0.46, 0.2, 0.12), hairM, 0, -0.2, 0.22);
      break;
    case 'scarf':
      add(body, new THREE.BoxGeometry(0.6, 0.14, 0.5), mat(st.secondaryColor), 0, 1.74, 0);
      add(body, new THREE.BoxGeometry(0.14, 0.4, 0.06), mat(st.secondaryColor), 0.18, 1.5, 0.26);
      break;
    case 'backpack':
      add(body, new THREE.BoxGeometry(0.5, 0.6, 0.22), mat(st.secondaryColor), 0, 1.32, -0.3);
      break;
    default:
      break;
  }

  root.userData.limbs = { legL, legR, armL, armR, body };
  root.userData.style = st;
  return root;
}

// t = time in seconds, moving = 0..1 amount of running
export function animateCharacter(root, t, moving) {
  const { legL, legR, armL, armR, body } = root.userData.limbs;
  const s = Math.sin(t * 12) * 0.9 * moving;
  legL.rotation.x = s; legR.rotation.x = -s;
  armL.rotation.x = -s; armR.rotation.x = s;
  body.position.y = Math.abs(Math.sin(t * 12)) * 0.06 * moving + Math.sin(t * 2) * 0.01 * (1 - moving);
}
