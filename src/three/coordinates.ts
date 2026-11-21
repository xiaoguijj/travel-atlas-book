import { Vector3 } from 'three';

const DEG_TO_RAD = Math.PI / 180;

// 复用的临时向量，避免每帧新建对象
const normalScratch = new Vector3();
const toCameraScratch = new Vector3();

/**
 * 经纬度 → 球面坐标。
 *
 * 约定要和贴图保持一致：贴图是等距圆柱投影（经度映射到 x，纬度映射到 y），
 * Three.js 球体的 UV 从 u=0 开始，因此这里 phi 取 (lon + 180)，
 * 这样经纬度相同的点和贴图上的位置会严格重合。
 */
export function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number,
  target = new Vector3(),
): Vector3 {
  const polar = (90 - latitude) * DEG_TO_RAD; // 与北极轴的夹角
  const azimuth = (longitude + 180) * DEG_TO_RAD;
  return target.set(
    -radius * Math.cos(azimuth) * Math.sin(polar),
    radius * Math.cos(polar),
    radius * Math.sin(azimuth) * Math.sin(polar),
  );
}

/**
 * 想让球体的直径占容器短边的 fill 比例，相机该退到多远。
 *
 * 球体轮廓对相机的张角 α 满足 sin α = R / d，而屏幕上的高度是按 tan 度量的，
 * 于是 fill = tan α / tan(fov / 2)，反解就是这里的 d。
 * 用"占画面比例"而不是"固定距离"描述机位，同一份场景既能铺满竖版布局，
 * 也能正好嵌进参考图上那个圆孔。
 */
export function cameraDistanceForFill(fill: number, fovDeg: number, radius: number): number {
  const silhouette = Math.atan(fill * Math.tan((fovDeg * DEG_TO_RAD) / 2));
  return radius / Math.sin(silhouette);
}

/**
 * 球面上某点面向相机的程度。
 * 返回值接近 1 表示正对镜头，接近 0 表示转到侧后方，小于 0 表示已被球体挡住。
 */
export function facingTowardCamera(surfacePoint: Vector3, cameraPosition: Vector3): number {
  const normal = normalScratch.copy(surfacePoint).normalize();
  const toCamera = toCameraScratch.copy(cameraPosition).sub(surfacePoint).normalize();
  return normal.dot(toCamera);
}

export { DEG_TO_RAD };
