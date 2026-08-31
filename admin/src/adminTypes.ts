import type {
  AdminAuthor,
  AdminPoint,
  AdminPointType,
  AdminRoute,
  AdminRouteItem,
  AdminText
} from '@ecosdelisboa/shared';

export type Resource = 'authors' | 'point-types' | 'points' | 'texts' | 'routes';
export type Section = Resource | 'csv' | 'pronunciation' | 'review-map' | 'users';
export type ResourceItem = AdminAuthor | AdminPointType | AdminPoint | AdminText | AdminRoute;
export type DraftValue = string | number | boolean | null | AdminRouteItem[];
export type Draft = Record<string, DraftValue>;
export type FieldOption = { value: string; label: string };
export type ImportPreviewRow = {
  row_number: number;
  author_name: string;
  title: string;
  action: 'create' | 'update' | 'error';
  errors: string[];
};
export type ImportResult = {
  created: number;
  updated: number;
  errors: ImportPreviewRow[];
  imported_text_ids: string[];
};
export type PointCatalogPreviewRow = {
  row_number: number;
  point_id?: string | null;
  point_name: string;
  point_type: string;
  action: 'create' | 'update' | 'error';
  geocoded: boolean;
  lat?: number | null;
  lng?: number | null;
  errors: string[];
};
export type PointCatalogImportResult = {
  created: number;
  updated: number;
  errors: PointCatalogPreviewRow[];
  imported_point_ids: string[];
};
export type FieldConfig = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox' | 'number' | 'url' | 'select' | 'route-items';
  options?: FieldOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
};
export type FieldContext = {
  authors: AdminAuthor[];
  authorsReady: boolean;
  points: AdminPoint[];
  pointsReady: boolean;
  pointTypes: AdminPointType[];
  pointTypesReady: boolean;
};
export type GeocodingFeature = {
  id: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  context?: Array<{ id?: string; text?: string }>;
  place_type?: string[];
};
