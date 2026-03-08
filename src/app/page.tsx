import styles from "./page.module.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProjectsWorkspace } from "@/components/workspace/ProjectsWorkspace";
import { getProjectsMock } from "@/data/mocks/projects.mock-api";

type HomeProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const projects = await getProjectsMock();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>
        <ProjectsWorkspace
          initialProjects={projects}
          selectedProjectId={params.project}
        />
      </main>
    </div>
  );
}
