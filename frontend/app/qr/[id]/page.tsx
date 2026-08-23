import { QRView } from '@/components/QRView';

export default async function QRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QRView id={id} />;
}
