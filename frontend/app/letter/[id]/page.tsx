import { LetterView } from '@/components/LetterView';

export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LetterView id={id} />;
}
