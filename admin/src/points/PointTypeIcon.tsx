import {
  BookOpen,
  Coffee,
  Headphones,
  Info,
  Landmark,
  Library,
  MapPin,
  Trees,
  type LucideIcon
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  library: Library,
  landmark: Landmark,
  headphones: Headphones,
  'map-pin': MapPin,
  trees: Trees,
  coffee: Coffee,
  info: Info
};

export function PointTypeIcon({ iconKey, size = 18 }: { iconKey: string; size?: number }) {
  const Icon = icons[iconKey] ?? MapPin;
  return <Icon aria-hidden="true" size={size} />;
}
