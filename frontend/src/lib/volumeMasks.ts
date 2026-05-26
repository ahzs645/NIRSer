import { volumeIndex } from "./nifti";

export function thresholdMask(values: number[], threshold: number) {
  return values.map((value) => Number.isFinite(value) && value > threshold);
}

export function andMask(left: boolean[], right: boolean[]) {
  return left.map((value, index) => value && Boolean(right[index]));
}

export function orMask(left: boolean[], right: boolean[]) {
  return left.map((value, index) => value || Boolean(right[index]));
}

export function addMasks(left: boolean[], right: boolean[]) {
  return left.map((value, index) => (value ? 1 : 0) + (right[index] ? 1 : 0));
}

export function fillHoles3d(mask: boolean[], dims: [number, number, number]) {
  const visited = Array(mask.length).fill(false);
  const outside = Array(mask.length).fill(false);
  const queue: number[] = [];
  const enqueue = (x: number, y: number, z: number) => {
    const index = volumeIndex(x, y, z, dims);
    if (mask[index] || visited[index]) return;
    visited[index] = true;
    outside[index] = true;
    queue.push(index);
  };

  for (let x = 0; x < dims[0]; x += 1) {
    for (let y = 0; y < dims[1]; y += 1) {
      enqueue(x, y, 0);
      enqueue(x, y, dims[2] - 1);
    }
  }
  for (let x = 0; x < dims[0]; x += 1) {
    for (let z = 0; z < dims[2]; z += 1) {
      enqueue(x, 0, z);
      enqueue(x, dims[1] - 1, z);
    }
  }
  for (let y = 0; y < dims[1]; y += 1) {
    for (let z = 0; z < dims[2]; z += 1) {
      enqueue(0, y, z);
      enqueue(dims[0] - 1, y, z);
    }
  }

  const neighbors = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % dims[0];
    const y = Math.floor(index / dims[0]) % dims[1];
    const z = Math.floor(index / (dims[0] * dims[1]));
    for (const [dx, dy, dz] of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (nx >= 0 && nx < dims[0] && ny >= 0 && ny < dims[1] && nz >= 0 && nz < dims[2]) enqueue(nx, ny, nz);
    }
  }

  return mask.map((value, index) => value || !outside[index]);
}

export function buildHeadMask(brainMask: boolean[], sensitivityMask: boolean[]) {
  return addMasks(andMask(brainMask, sensitivityMask), sensitivityMask);
}
