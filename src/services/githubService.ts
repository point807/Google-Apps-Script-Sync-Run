import { ScriptFile } from '../types';

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
  description: string | null;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url?: string;
  };
  protected?: boolean;
}

export const listBranches = async (
  token: string,
  owner: string,
  repo: string
): Promise<GitHubBranch[]> => {
  const headers = getHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches?per_page=100`, {
    headers
  });

  if (!res.ok) {
    throw new Error(`Failed to list branches: ${res.statusText}`);
  }

  return await res.json();
};

export const createBranch = async (
  token: string,
  owner: string,
  repo: string,
  newBranchName: string,
  fromBranch: string = 'main'
): Promise<void> => {
  const headers = getHeaders(token);
  const cleanName = newBranchName.trim().replace(/^refs\/heads\//, '');

  // 1. Get base branch commit SHA
  const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, {
    headers
  });

  if (!refRes.ok) {
    throw new Error(`Base branch '${fromBranch}' not found`);
  }

  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Create new branch ref
  const createRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${cleanName}`,
      sha: baseSha
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({ message: createRes.statusText }));
    throw new Error(`Failed to create branch: ${err.message || createRes.statusText}`);
  }
};

export const deleteBranch = async (
  token: string,
  owner: string,
  repo: string,
  branchName: string
): Promise<void> => {
  const headers = getHeaders(token);
  const cleanName = branchName.trim().replace(/^refs\/heads\//, '');
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${cleanName}`, {
    method: 'DELETE',
    headers
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Failed to delete branch: ${err.message || res.statusText}`);
  }
};

export interface BranchComparison {
  status: 'ahead' | 'behind' | 'diverged' | 'identical';
  aheadBy: number;
  behindBy: number;
}

export const compareBranches = async (
  token: string,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<BranchComparison | null> => {
  try {
    const headers = getHeaders(token);
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/compare/${base}...${head}`, {
      headers
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      status: data.status || 'identical',
      aheadBy: data.ahead_by || 0,
      behindBy: data.behind_by || 0
    };
  } catch {
    return null;
  }
};

export interface RemoteCommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  html_url: string;
}

const GITHUB_API = 'https://api.github.com';

const getHeaders = (token: string) => ({
  Accept: 'application/vnd.github.v3+json',
  Authorization: `Bearer ${token.trim()}`,
  'Content-Type': 'application/json'
});

export const validateGitHubToken = async (token: string): Promise<GitHubUser> => {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: getHeaders(token)
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        'Invalid GitHub token. Please verify your Personal Access Token permissions.'
      );
    }
    throw new Error(`GitHub verification failed: ${res.statusText}`);
  }

  return await res.json();
};

export const listRepositories = async (token: string): Promise<GitHubRepo[]> => {
  const res = await fetch(
    `${GITHUB_API}/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator`,
    {
      headers: getHeaders(token)
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to list repositories: ${res.statusText}`);
  }

  return await res.json();
};

export const createRepository = async (
  token: string,
  name: string,
  isPrivate: boolean = true,
  description: string = 'Apps Script repository backed up with ScriptVault'
): Promise<GitHubRepo> => {
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({
      name,
      private: isPrivate,
      description,
      auto_init: true // creates README so default branch exists
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Failed to create repository: ${err.message || res.statusText}`);
  }

  return await res.json();
};

export const pushFilesToGitHub = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: ScriptFile[],
  commitMessage: string,
  basePath: string = ''
): Promise<{ commitSha: string; commitUrl: string }> => {
  const headers = getHeaders(token);
  const cleanPath = basePath.replace(/^\/+|\/+$/g, '');

  // 1. Get latest commit SHA on the branch
  let refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers
  });

  // If branch doesn't exist, try getting default branch first to branch off
  if (!refRes.ok) {
    const repoInfoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
    if (!repoInfoRes.ok) throw new Error('Repository not found or no access.');
    const repoInfo = await repoInfoRes.json();
    const defaultBranch = repoInfo.default_branch || 'main';

    const defaultRefRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
      {
        headers
      }
    );

    if (defaultRefRes.ok) {
      const defData = await defaultRefRes.json();
      const parentSha = defData.object.sha;
      // Create new branch
      const createBranchRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: parentSha
        })
      });
      if (!createBranchRes.ok) {
        throw new Error(`Failed to create branch ${branch}`);
      }
      refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
        headers
      });
    } else {
      throw new Error(
        `Branch ${branch} does not exist and repository has no initial commits. Please initialize the repository with a README.`
      );
    }
  }

  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  // 2. Get tree of the latest commit
  const commitRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
    {
      headers
    }
  );
  if (!commitRes.ok) throw new Error('Failed to fetch commit object');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Build tree payload
  const treeNodes = files.map((file) => {
    let ext = '.gs';
    if (file.type === 'HTML') ext = '.html';
    else if (file.type === 'JSON' || file.name === 'appsscript') ext = '.json';

    const fileName = file.name.endsWith(ext) ? file.name : `${file.name}${ext}`;
    const filePath = cleanPath ? `${cleanPath}/${fileName}` : fileName;

    return {
      path: filePath,
      mode: '100644',
      type: 'blob',
      content: file.source
    };
  });

  const createTreeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeNodes
    })
  });

  if (!createTreeRes.ok) {
    const err = await createTreeRes.text();
    throw new Error(`Failed to create Git tree: ${err}`);
  }

  const newTreeData = await createTreeRes.json();

  // 4. Create new commit
  const newCommitRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      tree: newTreeData.sha,
      parents: [latestCommitSha]
    })
  });

  if (!newCommitRes.ok) {
    const err = await newCommitRes.text();
    throw new Error(`Failed to create commit: ${err}`);
  }

  const newCommit = await newCommitRes.json();

  // 5. Update branch reference
  const updateRefRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommit.sha,
        force: false
      })
    }
  );

  if (!updateRefRes.ok) {
    const err = await updateRefRes.text();
    throw new Error(`Failed to update branch reference: ${err}`);
  }

  return {
    commitSha: newCommit.sha,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`
  };
};

export const fetchRemoteCommits = async (
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<RemoteCommitInfo[]> => {
  const headers = getHeaders(token);
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=10`,
    { headers }
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data || []).map((c: any) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message,
    author: c.commit.author?.name || c.author?.login || 'Unknown',
    date: c.commit.author?.date || '',
    html_url: c.html_url
  }));
};
