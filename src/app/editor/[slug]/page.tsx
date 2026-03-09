import { Editor } from "@/features/editor/EditorPage";

type EditorPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditorPage({ params }: EditorPageProps) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const { slug } = await params;

  return <Editor slug={slug} />;
}
