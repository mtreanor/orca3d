export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scaleVec3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export const VEC3_RIGHT: Vec3 = { x: 1, y: 0, z: 0 };
export const VEC3_ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export type RotateDir = "Z_POS" | "Z_NEG" | "Y_POS" | "Y_NEG";

export function rotateVector90(v: Vec3, dir: RotateDir): Vec3 {
  switch (dir) {
    // 90 CW about y: (x,y,z) -> (-z,y,x)
    case "Y_NEG": return { x: -v.z, y: v.y, z: v.x };
    // 90 CCW about y: (x,y,z) -> (z,y,-x)
    case "Y_POS": return { x: v.z, y: v.y, z: -v.x };
    // 90 CW about z: (x,y,z) -> (y,-x,z)
    case "Z_NEG": return { x: v.y, y: -v.x, z: v.z };
    // 90 CCW about z: (x,y,z) -> (-y,x,z)
    case "Z_POS": return { x: -v.y, y: v.x, z: v.z };
  }
}
