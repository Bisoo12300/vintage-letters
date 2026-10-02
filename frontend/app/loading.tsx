import { OrbitLoader } from '@/components/brand';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-16">
      <OrbitLoader />
    </div>
  );
}
