import styles from "./page.module.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProjectsWorkspace } from "@/components/workspace/ProjectsWorkspace";

type HomeProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <ProjectsWorkspace selectedProjectId={params.project} />
      </main>
    </div>
  );
}
