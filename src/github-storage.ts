import { Octokit } from '@octokit/rest';

/**
 * GitStorage provides methods to interact with a GitHub repository
 * as a simple database for storing and retrieving files.
 *
 * ⚠️ Note on caching:
 * GitHub may return cached responses for repository content.
 * This means that after uploading or updating a file, immediate reloads
 * may not always show the latest file version due to caching.
 * You can inspect the HTTP headers (like `etag` and `cache-control`) 
 * from `getRepoInfo()` to check for caching and freshness.
 *
 * ⚠️ Note on rate limits:
 * GitHub enforces API rate limits, which are included in the response headers:
 * - `x-ratelimit-limit`: Maximum requests per hour
 * - `x-ratelimit-remaining`: Requests left in the current window
 * - `x-ratelimit-reset`: UNIX timestamp when the limit resets
 * You can use these headers to avoid hitting the API limit in heavy usage scenarios.
 *
 * Example:
 * ```ts
 * const db = new GitStorage('owner', 'repo', { token: 'ghp_...' });
 * const info = await db.getRepoInfo();
 * console.log(info.headers['x-ratelimit-remaining']); // see remaining requests
 * ```
 */
export class GitStorage {

  /** Octokit instance for GitHub API interactions */
  private octokit: Octokit;

  /** GitHub repository owner */
  private owner: string;

  /** GitHub repository name */
  private repo: string;

  /** Optional GitHub authentication token for write access */
  private token?: string;

  /** Default branch to use if not specified in method calls */
  private defaultBranch: string;

  /** Set a new default branch */
  setDefaultBranch(branch: string) {
    if (!branch) throw new Error('Branch name cannot be empty');
    this.defaultBranch = branch;
  }



  /**
   * Creates a GitStorage instance for interacting with a GitHub repository.
   * 
   * @param owner GitHub user or organization name
   * @param repo Repository name
   * @param options Optional authentication token for write access
   * 
   * @example
   * const db = new GitStorage('56duong', 'github-storage', { token: '...' });
   */
  constructor(owner: string, repo: string, options?: { token?: string, defaultBranch?: string }) {
    this.owner = owner;
    this.repo = repo;
    this.token = options?.token;
    this.defaultBranch = options?.defaultBranch || 'main';

    if (this.token) {
      this.octokit = new Octokit({ auth: this.token });
    } else {
      this.octokit = new Octokit(); // Read-only mode still allowed
    }
  }



  /**
   * Get full information about the repository.
   * 
   * @returns Promise containing GitHub repository response object
   * 
   * @example
   * const info = await db.getRepoInfo();
   * console.log(info); 
   */
  async getRepoInfo() {
    return this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo
    }).then(response => response);
  }



  /**
   * Lists files within a folder of the repository.
   *
   * ⚠️ Note: GitHub may cache folder listings. After uploading/updating a file,
   * it may take a few seconds for the latest file to appear here.
   * 
   * @param folder Folder path (ex: 'images/')
   * @param branch Branch name
   * @returns Array of file metadata objects
   * 
   * @example
   * const files = await db.listFiles('assets');
   */
  async listFiles(folder: string, branch = 'main') {
    const res = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path: folder,
      ref: branch
    });
    return Array.isArray(res.data) ? res.data : [];
  }



  /**
   * Retrieve the SHA of a file, used for updating or deleting.
   * If file does not exist, returns undefined.
   * 
   * @param path File path inside repository (ex: 'folder/file.txt')
   * @param branch Branch to commit on
   * @returns Promise resolving to the file SHA or undefined if not found
   * 
   * @example
   * const sha = await db.getFileSha('images/photo.png');
   * console.log(sha);
   */
  async getFileSha(path: string, branch?: string): Promise<string | undefined> {
    try {
      const useBranch = branch || this.defaultBranch;
      const res = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: useBranch
      });
      const data = res.data as any;
      return data?.sha;
    } catch {
      return undefined;
    }
  }



  /**
   * Creates or updates a file using Base64-encoded content.
   *
   * 📌 Note:
   * Internally this method checks if the file already exists.
   * That check may cause a 404 in console logs — this is normal and not an error.
   * 
   * @param base64 Base64 string (no data URI prefix)
   * @param path File path inside repository (ex: 'folder/file.txt')
   * @param message Optional commit message
   * @param branch Branch to commit on
   * @param skipCheck If true, skip existence check (faster, no 404 log)
   * @returns GitHub API response data
   *
   * @example
   * // Normal usage (check if update or create)
   * await db.saveFile(base64, 'data/info.json');
   *
   * @example
   * // Create only — faster, no console 404 from SHA check
   * await db.saveFile(base64, 'data/new.json', undefined, 'main', true);
   */
  async saveFile(
    base64: string,
    path: string,
    message?: string,
    branch?: string,
    skipCheck = false
  ) {
    const useBranch = branch || this.defaultBranch;
    let sha: string | undefined;
    if (!skipCheck) {
      sha = await this.getFileSha(path, branch);
    }
    const commitMsg = message ?? `${sha ? 'Update' : 'Create'} ${path}`;
    const res = await this.octokit.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message: commitMsg,
      content: base64,
      ...(sha ? { sha } : {}),
      useBranch
    });
    return res.data;
  }



  /**
   * Downloads a file and returns its base64 data.
   * 
   * @param path File path inside repo
   * @param branch Branch to fetch from
   * @returns Base64 content + metadata or null if not base64 encoded
   * 
   * @example
   * const data = await this.db.downloadFile('files/photo.jpg');
   * if (!data?.content) return;
   * const blob = this.db.base64ToBlob(data.content);
   * const url = URL.createObjectURL(blob);
   * const a = document.createElement('a');
   * a.href = url;
   * a.download = file.name;
   * a.click();
   * URL.revokeObjectURL(url);
   */
  async downloadFile(path: string, branch = 'main'): Promise<any> {
    const res = await this.octokit.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: branch
    });
    const data = res.data as any;
    return data.encoding === 'base64' ? data : null;
  }


  
  /**
   * Converts a browser `File` into a Base64 string.
   * Used before uploading to GitHub through the API.
   * ⚠ Only works in browser environments.
   *
   * @param file The File object to convert (selected via file input)
   * @returns Promise resolving to Base64 string (no data URI prefix)
   *
   * @example
   * const base64 = await this.db.fileToBase64(selectedFile);
   * const uploaded = await this.db.saveFile(base64, 'files/photo.jpg');
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File read error'));
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.readAsDataURL(file);
    });
  }



  /**
   * Converts a Base64 string back into a Blob object.
   * Useful for downloading or previewing files inside the browser.
   * ⚠ Only works in browser environments.
   *
   * @param base64 A Base64-encoded string (without data URL prefix)
   * @returns Blob file object
   *
   * @example
   * const fileData = await this.db.downloadFile('files/photo.jpg');
   * const blob = this.db.base64ToBlob(fileData.content);
   * const url = URL.createObjectURL(blob);
   * window.open(url); // Preview or force download
   */
  base64ToBlob(base64: string): Blob {
    const binary = atob(base64.replace(/\r?\n/g, ''));
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes]);
  }



  /**
   * Deletes a file from the repository.
   * 
   * @param path Full file path to delete
   * @param branch Branch name
   * @returns Deletion confirmation object
   * @throws If file does not exist
   * 
   * @example
   * await db.deleteFile('old/file.txt');
   */
  async deleteFile(path: string, branch?: string) {
    const useBranch = branch || this.defaultBranch;
    const sha = await this.getFileSha(path, branch);
    if (!sha) throw new Error('File not found');

    await this.octokit.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path,
      message: `Delete ${path}`,
      sha,
      useBranch
    });

    return { path, deleted: true };
  }

}