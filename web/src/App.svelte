<script lang="ts">
  import { onMount } from 'svelte';

  const API = '/api';
  const STORAGE_KEY = 'ripple64.key';
  const MAX_FILES = 999;
  const MAX_KB = 64 * 1024;

  interface FileEntry {
    id: string;
    size: number;
  }

  interface User {
    username: string;
    msg: string;
  }

  let keyInput = $state('');
  let key = $state('');
  let me = $state<string | null>(null);
  let users = $state<User[]>([]);
  let selected = $state<string | null>(null);
  let files = $state<FileEntry[]>([]);
  let total = $state(0);
  let error = $state('');
  let playing = $state<string | null>(null);
  let audio = $state<HTMLAudioElement | undefined>();
  let fileInput = $state<HTMLInputElement | undefined>();
  let uploadFile = $state<File | null>(null);
  let uploadId = $state('');
  let msgInput = $state('');
  let registerName = $state('');
  let newUserKey = $state('');
  let objectUrl: string | null = null;

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? '';
    keyInput = stored;
    key = stored;
    if (stored) void loadUsers();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });

  async function api(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(API + path, {
      ...init,
      headers: { ...(init.headers ?? {}), 'x-key': key },
    });
  }

  async function errorFrom(res: Response): Promise<string> {
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) return data.error;
    } catch {
      // ignore
    }
    return `error ${res.status}`;
  }

  async function loadUsers(): Promise<void> {
    error = '';
    try {
      const meRes = await api('/me');
      if (meRes.ok) {
        const data = (await meRes.json()) as { username: string };
        me = data.username;
      } else {
        me = null;
      }
    } catch {
      me = null;
    }

    if (me === 'register') {
      users = [];
      return;
    }

    try {
      const res = await api('/');
      if (res.status === 401) {
        error = 'invalid key';
        users = [];
        return;
      }
      if (!res.ok) {
        error = await errorFrom(res);
        users = [];
        return;
      }
      users = await res.json();
    } catch {
      error = 'could not reach server';
      users = [];
    }
  }

  async function register(): Promise<void> {
    const username = registerName.trim();
    if (!username) return;
    error = '';
    try {
      const res = await api('/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        error = await errorFrom(res);
        return;
      }
      const data = (await res.json()) as { username: string; key: string };
      newUserKey = data.key;
      registerName = '';
    } catch {
      error = 'could not reach server';
    }
  }

  function acceptKey(): void {
    if (!newUserKey) return;
    key = newUserKey;
    localStorage.setItem(STORAGE_KEY, newUserKey);
    newUserKey = '';
    registerName = '';
    selected = null;
    files = [];
    error = '';
    void loadUsers();
  }

  async function submitKey(): Promise<void> {
    const next = keyInput.trim();
    if (!next) return;
    key = next;
    localStorage.setItem(STORAGE_KEY, next);
    selected = null;
    files = [];
    await loadUsers();
  }

  async function openUser(username: string): Promise<void> {
    selected = username;
    files = [];
    total = 0;
    error = '';
    uploadFile = null;
    uploadId = '';
    msgInput = users.find((user) => user.username === username)?.msg ?? '';
    if (fileInput) fileInput.value = '';
    try {
      const res = await api('/' + encodeURIComponent(username));
      if (!res.ok) {
        error = await errorFrom(res);
        return;
      }
      const data = (await res.json()) as { total: number; files: FileEntry[] };
      files = data.files;
      total = data.total;
    } catch {
      error = 'could not reach server';
    }
  }

  function back(): void {
    selected = null;
    files = [];
    total = 0;
    error = '';
    uploadFile = null;
    uploadId = '';
  }

  async function fetchBlob(username: string, id: string): Promise<Blob | null> {
    try {
      const res = await api('/' + encodeURIComponent(username) + '/' + encodeURIComponent(id));
      if (!res.ok) {
        error = await errorFrom(res);
        return null;
      }
      return await res.blob();
    } catch {
      error = 'could not reach server';
      return null;
    }
  }

  async function play(username: string, id: string): Promise<void> {
    error = '';
    const blob = await fetchBlob(username, id);
    if (!blob) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    playing = id;
    if (audio) {
      audio.src = objectUrl;
      audio.play().catch(() => {
        playing = null;
      });
    }
  }

  async function download(username: string, id: string): Promise<void> {
    error = '';
    const blob = await fetchBlob(username, id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = id;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function onFileChange(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    uploadFile = file;
    if (file) uploadId = file.name.replace(/\.[^.]+$/, '');
  }

  async function upload(): Promise<void> {
    if (!selected || selected !== me || !uploadFile || !uploadId.trim()) return;
    error = '';
    try {
      const res = await api(
        '/' + encodeURIComponent(selected) + '/' + encodeURIComponent(uploadId.trim()),
        {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: uploadFile,
        },
      );
      if (!res.ok) {
        error = await errorFrom(res);
        return;
      }
      await openUser(selected);
    } catch {
      error = 'could not reach server';
    }
  }

  async function saveMessage(): Promise<void> {
    if (!me || selected !== me) return;
    error = '';
    try {
      const res = await api('/' + encodeURIComponent(me) + '/msg.md', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: msgInput,
      });
      if (!res.ok) {
        error = await errorFrom(res);
        return;
      }
      await loadUsers();
    } catch {
      error = 'could not reach server';
    }
  }

  async function removeFile(id: string): Promise<void> {
    if (!selected || selected !== me) return;
    error = '';
    try {
      const res = await api('/' + encodeURIComponent(selected) + '/' + encodeURIComponent(id), {
        method: 'DELETE',
      });
      if (!res.ok) {
        error = await errorFrom(res);
        return;
      }
      await openUser(selected);
    } catch {
      error = 'could not reach server';
    }
  }

  function playSelected(id: string): void {
    if (selected) void play(selected, id);
  }

  function downloadSelected(id: string): void {
    if (selected) void download(selected, id);
  }

  function logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    key = '';
    keyInput = '';
    me = null;
    users = [];
    selected = null;
    files = [];
    total = 0;
    error = '';
    playing = null;
    uploadFile = null;
    uploadId = '';
    msgInput = '';
    registerName = '';
    newUserKey = '';
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function formatKb(size: number): string {
    if (size >= 1024) return (size / 1024).toFixed(2) + ' mb';
    return size + ' kb';
  }
</script>

<h1>ripple64</h1>

{#if !key}
  <form
    class="row"
    onsubmit={(event) => {
      event.preventDefault();
      void submitKey();
    }}
  >
    <input bind:value={keyInput} type="password" placeholder="key" autocomplete="off" />
    <button type="submit">enter</button>
  </form>
{:else}
  <div class="row">
    {#if me !== 'register'}
      <span class="muted">{me ? `signed in as ${me}` : 'key accepted'}</span>
    {/if}
    <span class="spacer"></span>
    <button class="back" onclick={logout}>forget key</button>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if me === 'register'}
    <div class="head">
      <span>register</span>
    </div>
    {#if newUserKey}
      <div class="message">
        <span class="muted">key for the new user (shown once)</span>
        <code class="key">{newUserKey}</code>
        <button onclick={acceptKey}>i got it</button>
      </div>
    {:else}
      <form
        class="row"
        onsubmit={(event) => {
          event.preventDefault();
          void register();
        }}
      >
        <input bind:value={registerName} placeholder="username" autocomplete="off" />
        <button type="submit">create</button>
      </form>
    {/if}
  {:else if selected === null}
    <div class="head">
      <span>users</span>
      <span class="muted">{users.length}</span>
    </div>
    <ul>
      {#each users as user (user.username)}
        <li class="action">
          <button class="user" onclick={() => void openUser(user.username)}>
            <span class="who">
              <span>{user.username}</span>
              {#if user.msg}
                <span class="msg">{user.msg}</span>
              {/if}
            </span>
            <span class="muted">open</span>
          </button>
        </li>
      {/each}
      {#if users.length === 0}
        <li><span class="muted">no users</span></li>
      {/if}
    </ul>
  {:else}
    <div class="head">
      <span>{selected}</span>
      <span class="muted">{files.length}/{MAX_FILES} files {total}kb/{MAX_KB}kb</span>
    </div>
    <button class="back" onclick={back}>&larr; users</button>

    {#if selected === me}
      <div class="message">
        <textarea bind:value={msgInput} maxlength={128} rows="2" placeholder="message"></textarea>
        <div class="row">
          <span class="muted">{msgInput.length}/128</span>
          <span class="spacer"></span>
          <button onclick={() => void saveMessage()} disabled={msgInput.length > 128}>save</button>
        </div>
      </div>

      <div class="upload">
        <input class="file" type="file" bind:this={fileInput} onchange={onFileChange} />
        <div class="row">
          <input bind:value={uploadId} placeholder="id" />
          <button onclick={() => void upload()} disabled={!uploadFile || !uploadId.trim()}>
            upload
          </button>
        </div>
      </div>
    {/if}

    <ul>
      {#each files as file (file.id)}
        <li>
          <span>{file.id}</span>
          <span class="muted">{formatKb(file.size)}</span>
          <span class="row">
            <button onclick={() => playSelected(file.id)}>
              {playing === file.id ? 'playing' : 'play'}
            </button>
            <button onclick={() => downloadSelected(file.id)}>download</button>
            {#if selected === me}
              <button onclick={() => void removeFile(file.id)}>delete</button>
            {/if}
          </span>
        </li>
      {/each}
      {#if files.length === 0}
        <li><span class="muted">no files</span></li>
      {/if}
    </ul>
  {/if}
{/if}

<audio bind:this={audio} onended={() => (playing = null)}></audio>
