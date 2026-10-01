import type { Point } from '../types';

export const OVERVIEW_MAX_ZOOM = 13.5;
// 34px markers: require substantial overlap, not merely nearby street locations.
export const OVERLAP_RADIUS_PX = 18;

export interface ProjectedPoint { point: Point; x: number; y: number }
export interface PointGroup { points: Point[]; lng: number; lat: number; overview: boolean }

export function groupMapPoints(projected: ProjectedPoint[], zoom: number): PointGroup[] {
  const overview = zoom < OVERVIEW_MAX_ZOOM;
  const groups: ProjectedPoint[][] = [];
  for (const candidate of projected) {
    const near = (item: ProjectedPoint) => Math.hypot(candidate.x - item.x, candidate.y - item.y) < (overview ? 42 : OVERLAP_RADIUS_PX);
    // At street zoom, never grow a chain of nearby (but separable) locations.
    const group = groups.find(items => overview ? items.some(near) : items.every(near));
    if (group) group.push(candidate);
    else groups.push([candidate]);
  }
  return groups.map(items => ({
    points: items.map(item => item.point), overview,
    lng: items.reduce((sum, item) => sum + item.point.lng / items.length, 0),
    lat: items.reduce((sum, item) => sum + item.point.lat / items.length, 0)
  }));
}
