import { EditEditor } from "./EditEditor";

type EditPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditPage({ params }: EditPageProps) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const { slug } = await params;

  return <EditEditor slug={slug} />;
}
