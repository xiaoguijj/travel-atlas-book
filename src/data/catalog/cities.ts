/**
 * 城市静态目录的统一出口。城市数据仍然维护在 `src/data/cities.ts`，
 * 用户手账、照片和愿望只保存稳定的 cityId。
 */
export { cities, cityIds, getCityById } from '../cities';