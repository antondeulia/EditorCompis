import { Editor } from "@/features/editor/EditorPage";

type EditorPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditorPage({ params }: EditorPageProps) {
  const { slug } = await params;

  return <Editor slug={slug} />;
}
