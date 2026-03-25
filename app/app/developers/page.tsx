import type { Metadata } from "next";
import {
  getAllRepos,
  getContributorStats,
  getAllCommitActivity,
  getGoodFirstIssues,
  getAllCIStatuses,
  type CommitActivityMap,
} from "@/lib/github";
import { DevelopersClient } from "./DevelopersClient";

export const metadata: Metadata = {
  title: "Developers — Percolator",
  description:
    "Open-source repos powering Percolator permissionless perpetuals on Solana. Browse, fork, and contribute.",
  openGraph: {
    title: "Developers — Percolator",
    description:
      "Open-source repos powering Percolator permissionless perpetuals on Solana.",
    type: "website",
  },
};

export default async function DevelopersPage() {
  // Fetch all data in parallel — allSettled ensures one failure never breaks the page
  const [repos, contributorStats, commitActivity, goodFirstIssues, ciStatuses] =
    await Promise.allSettled([
      getAllRepos(),
      getContributorStats(),
      getAllCommitActivity(),
      getGoodFirstIssues(),
      getAllCIStatuses(),
    ]);

  const repoData = repos.status === "fulfilled" ? repos.value : [];
  const isLive = repoData.some(
    (r) => r.stargazers_count > 0 || r.forks_count > 0
  );

  // Compute totalCommits from commitActivity so both stats are derived from
  // the same API response — avoids the 202-cache-race that caused mismatch.
  const commitActivityData: CommitActivityMap =
    commitActivity.status === "fulfilled" ? commitActivity.value : {};
  const totalCommitsFromActivity = Object.values(commitActivityData)
    .flat()
    .reduce((sum, w) => sum + (w.total || 0), 0);

  const rawContributorStats =
    contributorStats.status === "fulfilled" ? contributorStats.value : null;
  const resolvedContributorStats =
    rawContributorStats && totalCommitsFromActivity > 0
      ? { ...rawContributorStats, totalCommits: totalCommitsFromActivity }
      : rawContributorStats;

  return (
    <DevelopersClient
      repos={repoData}
      isLive={isLive}
      contributorStats={resolvedContributorStats}
      commitActivity={
        commitActivity.status === "fulfilled" ? commitActivity.value : null
      }
      goodFirstIssues={
        goodFirstIssues.status === "fulfilled" ? goodFirstIssues.value : []
      }
      ciStatuses={
        ciStatuses.status === "fulfilled" ? ciStatuses.value : {}
      }
    />
  );
}
