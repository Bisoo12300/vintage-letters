import { BookLoader } from '@/components/BookLoader';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-mora-cream py-16">
      <BookLoader />
    </div>
  );
}
