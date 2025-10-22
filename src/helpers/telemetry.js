export const meter = {
  totals: {}, // { screen: { reads:0, writes:0 } }
  add(type, screen, n = 1) {
    if (!screen || typeof screen !== 'string') {
      console.warn(`[Telemetry] No screen name provided for ${type} log — pass a string`);
      screen = 'unspecified';
    }
    this.totals[screen] ||= { reads: 0, writes: 0 };
    this.totals[screen][type] += n;
  },
  dump(label = 'Firestore usage') {
    console.log(`\n=== ${label} ===`);
    console.table(Object.entries(this.totals).map(([screen, v]) => ({ screen, ...v })));
  },
  reset() {
    this.totals = {};
  }
};

// Lifecycle logging for effects
export function logEffectLifecycle(screen, label, extra = {}) {
  if (!screen || typeof screen !== 'string') {
    console.warn(`[Telemetry] No screen name provided for effect lifecycle — pass a string`);
    screen = 'unspecified';
  }
  console.log(`[EFFECT MOUNT] ${screen} → ${label}`, extra);
  return () => console.log(`[EFFECT UNMOUNT] ${screen} → ${label}`);
}

// ---- Instrumented wrappers for firebasehelpers ----
export async function iGetDoc(getDoc, ref, screen) {
  const snap = await getDoc(ref);
  if (snap.exists()) meter.add('reads', screen, 1);
  return snap;
}

export async function iGetDocs(getDocs, q, screen) {
  const snap = await getDocs(q);
  meter.add('reads', screen, snap.size);
  return snap;
}

export function iOnSnapshot(onSnapshot, refOrQuery, cb, screen, options) {
  return onSnapshot(refOrQuery, options || {}, (snap) => {
    if (typeof snap.docChanges === 'function') {
      // QuerySnapshot
      const delta = snap.docChanges().reduce(
        (n, c) => n + (c.type === 'removed' ? 0 : 1),
        0
      );
      meter.add('reads', screen, delta);
    } else {
      // DocumentSnapshot
      meter.add('reads', screen, snap.exists() ? 1 : 0);
    }
    cb(snap);
  });
}

export async function iAddDoc(addDoc, collRef, data, screen) {
  const res = await addDoc(collRef, data);
  meter.add('writes', screen, 1);
  return res;
}

export async function iSetDoc(setDoc, ref, data, opts, screen) {
  const res = await setDoc(ref, data, opts);
  meter.add('writes', screen, 1);
  return res;
}

export async function iUpdateDoc(updateDoc, ref, data, screen) {
  const res = await updateDoc(ref, data);
  meter.add('writes', screen, 1);
  return res;
}
