export type ProjectVideo = {
  id: string;
  title: string;
  description: string;
  uploadedAt: string;
  status: "Draft" | "Published";
};

export type Project = {
  id: string;
  name: string;
  workspace: string;
  description: string;
  createdAt: string;
  lastPublishedAt: string;
  progress: number;
  daysLeft: number;
  team: string[];
  videos: ProjectVideo[];
};

export type CreateProjectInput = {
  name: string;
  description: string;
  lastPublishedAt: string;
};

export type CreateVideoInput = {
  type: "blank-template" | "upload-video";
  title: string;
  description: string;
};

export const projectsSeed: Project[] = [
  {
    id: "brand-campaign",
    name: "Brand Campaign",
    workspace: "sportsinteractive.com",
    description: "Launch assets for Q2 campaign.",
    createdAt: "2026-02-18",
    lastPublishedAt: "2026-03-05",
    progress: 94,
    daysLeft: 2,
    team: ["AR", "KM", "TD"],
    videos: [
      {
        id: "hero-cut",
        title: "Hero Cut 30s",
        description: "Main promo cut for social.",
        uploadedAt: "2026-03-02",
        status: "Published",
      },
      {
        id: "teaser-15",
        title: "Teaser 15s",
        description: "Short teaser in vertical format.",
        uploadedAt: "2026-02-28",
        status: "Draft",
      },
      {
        id: "behind-scenes",
        title: "Behind the Scenes",
        description: "Behind the scenes montage.",
        uploadedAt: "2026-02-24",
        status: "Draft",
      },
    ],
  },
  {
    id: "course-edits",
    name: "Course Edits",
    workspace: "homechoice.co",
    description: "Editing online course lecture videos.",
    createdAt: "2026-01-27",
    lastPublishedAt: "2026-03-01",
    progress: 68,
    daysLeft: 4,
    team: ["MB", "NA", "JT"],
    videos: [
      {
        id: "lesson-01",
        title: "Lesson 01",
        description: "Introduction and setup.",
        uploadedAt: "2026-02-20",
        status: "Published",
      },
      {
        id: "lesson-02",
        title: "Lesson 02",
        description: "Project structure walkthrough.",
        uploadedAt: "2026-02-26",
        status: "Draft",
      },
      {
        id: "lesson-03",
        title: "Lesson 03",
        description: "Practical editing workflow.",
        uploadedAt: "2026-02-21",
        status: "Draft",
      },
    ],
  },
  {
    id: "podcast-highlights",
    name: "Podcast Highlights",
    workspace: "springfieldmedia.com",
    description: "Weekly highlights and reels.",
    createdAt: "2026-02-06",
    lastPublishedAt: "2026-03-06",
    progress: 48,
    daysLeft: 7,
    team: ["RR", "AD"],
    videos: [
      {
        id: "week-09-recap",
        title: "Week 09 Recap",
        description: "Best moments of the week.",
        uploadedAt: "2026-03-06",
        status: "Published",
      },
      {
        id: "week-10-teaser",
        title: "Week 10 Teaser",
        description: "Upcoming episode teaser.",
        uploadedAt: "2026-03-07",
        status: "Draft",
      },
      {
        id: "guest-snippet",
        title: "Guest Snippet",
        description: "Highlights from guest segment.",
        uploadedAt: "2026-03-01",
        status: "Published",
      },
    ],
  },
];
