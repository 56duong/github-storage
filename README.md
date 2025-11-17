# GitStorage

A lightweight TypeScript library that lets you use a **GitHub repository as a simple file database** — upload, update, delete, and fetch files through the GitHub REST API.



---



## Table of Contents

1. [GitStorage](#️gitstorage)  
2. [Why GitStorage exists](#why-gitstorage-exists)  
3. [Installation](#installation)  
4. [Quick token setup](#quick-token-setup)  
5. [Limitations](#️limitations)  
6. [Class: GitStorage](#️class-gitstorage)  
7. [Example: Angular File Manager with GitStorage](#example-angular-file-manager-with-gitstorage)  
8. [Contributing](#contributing)



---



## Why GitStorage exists

Sometimes you just need something *online* fast — for a quick test, school project, or small idea.  
But most services now ask for payment methods, have limits, or need too much setup.

**GitStorage** is a simple trick: it uses your existing GitHub repo to store small files and data — totally free, no setup headaches.

It’s not built for production, but perfect for:
  - Quick tests and prototypes  
  - Classroom or demo projects  
  - Small tools or automations  

Use it when you want something simple, free, and instant — just don’t expect real-time magic; GitHub might take a nap ☕.



---



## Installation

```bash
npm i github-storage
```


---



## Quick token setup

Go to https://github.com/settings/personal-access-tokens to create a new token.  
When creating the token, select only the repository you need and set these permissions:

- User permissions  
  - This token does not have any user permissions.
- Repository permissions  
  - Read access to metadata  
  - Read & Write access to code and issues

<img src="https://github.com/56duong/github-storage/raw/main/images/generate-token.png" alt="Generate token" style="width: 768px; border: 1px solid lightgray;" />


---



## Limitations

- **Caching**: GitHub may return cached responses for repository content. This means that after uploading or updating a file, immediate reloads may not always show the latest file version due to caching. You can inspect the HTTP headers (like `etag` and `cache-control`) from `getRepoInfo()` to check for caching and freshness.
 
- **Rate limits**:
GitHub enforces API rate limits, which are included in the response headers:
  - `x-ratelimit-limit`: Maximum requests per hour
  - `x-ratelimit-remaining`: Requests left in the current window
  - `x-ratelimit-reset`: UNIX timestamp when the limit resets
You can use these headers to avoid hitting the API limit in heavy usage scenarios.



---



## Class: GitStorage

The GitStorage class allows developers to use a GitHub repository (public or private) as a free lightweight database or file storage system.
It provides methods to upload, update, delete, and list files in any GitHub repository using GitHub’s REST API.

### Constructor

```ts
new GitStorage(username: string, repository: string, options?: { token?: string });
```

Parameter	Type	Description
username	string	GitHub username or organization name
repository	string	The name of the GitHub repository
options.token	string (optional)	GitHub Personal Access Token (required for private repos)
Example

```ts
const db = new GitStorage('56duong', 'my-storage-repo', {
  token: 'your_token_here',
});
```

### listFiles(path: string): Promise<any[]>

Returns all files in the given folder path.

```ts
const files = await db.listFiles('files');
console.log(files);
```

### downloadFile(path: string): Promise<{ content: string }>

Downloads a file from the repository and returns its Base64-encoded content.

```ts
const file = await db.downloadFile('files/example.png');
console.log(file.content);
```

### saveFile(base64: string, path: string, message?: string): Promise<any>

Uploads or updates a file in the repository.
If the file exists, it will be replaced.

```ts
const uploaded = await db.saveFile(base64, 'files/photo.png', 'Upload photo');
```

### deleteFile(path: string): Promise<{ deleted: boolean }>

Deletes a file from the repository.

```ts
const deleted = await db.deleteFile('files/photo.png');
if (deleted.deleted) console.log('File removed!');
```

### getRepoInfo(): Promise<any>

Fetches basic repository information such as visibility and size.

```ts
const info = await db.getRepoInfo();
console.log(info.data.private ? 'Private repo' : 'Public repo');
```

### fileToBase64(file: File): Promise<string>

Converts a File object into a Base64 string.

```ts
const base64 = await db.fileToBase64(selectedFile);
```

### base64ToBlob(base64: string): Blob

Converts a Base64 string into a downloadable Blob.

```ts
const blob = db.base64ToBlob(base64Data);
```



---



## Example: Angular File Manager with GitStorage

Below is a complete example showing how to use **GitStorage** inside an Angular component  
to **upload**, **update**, **download**, and **delete** files in a GitHub repository.

<img src="https://github.com/56duong/github-storage/raw/main/images/example.png" alt="Example" style="width: 768px; border: 1px solid lightgray;" />

### `file-manager.component.html`

```ts
<div class="file-manager-toolbar">
  <label>
    <input type="checkbox" [(ngModel)]="isPublic" (ngModelChange)="refreshFiles()" />
    Public Repository
  </label>

  <br><br>

  Folder: <input type="text" [(ngModel)]="folder" placeholder="Folder Name" />

  <br><br>

  <button type="button" (click)="refreshFiles()">Reload All Files</button>
  <input id="uploadInput" type="file" (change)="upload($event)" hidden #uploadInput />
  <button type="button" (click)="uploadInput?.click()">Upload New File</button>
</div>

<table class="file-manager-table">
  <thead>
    <tr>
      <th>Image</th>
      <th>File Name</th>
      <th style="width: 220px">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr *ngFor="let file of files; let i = index">
      <td class="file-name">
        <img *ngIf="isPublic" [src]="file?.download_url" alt="file" style="max-width:48px;max-height:48px;"/>
        <img *ngIf="!isPublic" [src]="file?.private_download_url" alt="file" style="max-width:48px;max-height:48px;"/>
      </td>
      <td class="file-name">{{ file?.path }}</td>
      <td class="actions">
        <input type="file" id="update-{{i}}" (change)="update(file.path, $event)" hidden #updateInput />
        <button type="button" (click)="updateInput.click()">Update</button>
        <button type="button" (click)="delete(file.path)">Delete</button>
        <button type="button" (click)="download(file)">Download</button>
      </td>
    </tr>
    <tr *ngIf="files?.length === 0">
      <td colspan="2" class="empty">No files found</td>
    </tr>
  </tbody>
</table>

```

### `file-manager.component.scss`

```ts
* {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.file-manager-toolbar {
  margin-bottom: 12px;
  button { margin-right: 8px; }
}

.file-manager-table {
  width: 100%;
  border-collapse: collapse;

  th, td {
    border: 1px solid #ddd;
    padding: 8px;
  }

  th {
    text-align: left;
    background: #f5f5f5;
  }

  .file-name {
    max-width: 480px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    button { margin-right: 8px; }
  }

  .empty {
    text-align: center;
    color: #666;
  }
}

```

### `file-manager.component.ts`

```ts
import { Component } from '@angular/core';
import { GitStorage } from 'github-storage';

@Component({
  selector: 'app-file-manager',
  templateUrl: './file-manager.component.html',
  styleUrls: ['./file-manager.component.scss']
})
export class FileManagerComponent {
  
  // Initialize the GitHub database connection
  private db = new GitStorage(
    '56duong',
    'my-storage-repo',
    {
      token: 'YOUR_GITHUB_TOKEN_HERE',
    }
  );

  /** Folder in the repository to manage files */
  folder = 'files';
  /** List of files fetched from GitHub */
  files: any[] = [];
  /** Whether the repository is public or private */
  isPublic = true;

  ngOnInit() {
    // Retrieve repository info (and check if it's private)
    this.db.getRepoInfo().then(info => {
      console.log('Repo info:', info);
      this.isPublic = !info.data.private;
      this.refreshFiles();
    });
  }

  /** Refresh the list of files from the repository */
  async refreshFiles() {
    try {
      this.files = await this.db.listFiles(this.folder);
      console.log('files', this.files);
      // For private repos, convert files to base64 data URLs
      if (!this.isPublic) {
        this.files.map(async file => {
          const base64 = await this.db.downloadFile(file.path);
          file.private_download_url = `data:application/octet-stream;base64,${base64.content}`;
          return file;
        });
      }
    } catch (err) {
      console.error('Failed to list files', err);
      this.files = [];
    }
  }

  /** Helper: Convert a filename or path into a full folder path */
  private toPath(nameOrPath: string) {
    return nameOrPath.includes('/') ? nameOrPath : `${this.folder}/${nameOrPath}`;
  }

  /** Upload a new file to the repository */
  async upload(event: any) {
    const file: File = event?.target?.files?.[0];
    if (!file) return;
    try {
      const base64 = await this.db.fileToBase64(file);
      const path = `${this.folder}/${file.name}`;
      const uploaded = await this.db.saveFile(base64, path, `Upload ${file.name}`);
      console.log('Uploaded', uploaded);
      this.files.push(uploaded.content);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      if (event?.target) event.target.value = '';
    }
  }

  /** Update an existing file */
  async update(pathOrName: string, event: any) {
    const file: File = event?.target?.files?.[0];
    if (!file) return;
    try {
      const base64 = await this.db.fileToBase64(file);
      const path = this.toPath(pathOrName);
      await this.db.saveFile(base64, path, `Update ${file.name}`);
    } catch (err) {
      console.error('Update failed', err);
    } finally {
      if (event?.target) event.target.value = '';
    }
  }

  /** Delete a file from the repository */
  async delete(filenameOrPath: string) {
    const path = this.toPath(filenameOrPath);
    if (!confirm(`Delete ${path}?`)) return;
    try {
      const deleted = await this.db.deleteFile(path);
      if (deleted.deleted) {
        this.files = this.files.filter(f => f.path !== path);
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  }

  /** Download and preview a file */
  async download(file: any) {
    if (!file?.path) return;
    try {
      const data = await this.db.downloadFile(file.path);
      if (!data?.content) return;

      const blob = this.db.base64ToBlob(data.content);
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  }
}
```


---


## Contributing

Pull requests are welcome!  
If you find a bug or want to add new features, feel free to:
1. Fork the repo
2. Create a new branch (`feature/my-update`)
3. Submit a pull request 🚀