import { notFound } from 'next/navigation';
import { publicRecaps } from '../../../lib/public-data';
import RecapDetail from './RecapDetail';

export async function generateStaticParams() {
  return publicRecaps.map((recap) => ({ id: recap.slug }));
}

export default async function UserRecapDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recap = publicRecaps.find((item) => item.slug === id);
  if (!recap) notFound();

  return <RecapDetail recap={recap} />;
}
