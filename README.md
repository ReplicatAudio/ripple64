# ripple64

Small-web style audio sample storage. Multiple users, plain files, no database.

## Layout

```
server/        express API (TypeScript)
  users.json   { "<username>": "<key>" } — edit by hand to add users
  register.json { "key": "<key>" } — key that grants access to registration
  storage/     <username>/<id> sample files (created on demand)
web/           svelte frontend (TypeScript, vite)
```

## Run

```
npm install
npm run dev:server     # http://localhost:3000, override with PORT=...
npm run dev:web        # http://localhost:5173, proxies /api -> server
```

Server data is read relative to the server working directory (`server/users.json`,
`server/storage/`).

## API

All requests require the `x-key` header. Without a valid key: `401`.

Write requests (upload/delete) require a key belonging to the username in the
path, otherwise `403`. Reads (download/list/users) accept any valid key.

| Method | Path                | Body                     | Response                          |
| ------ | ------------------- | ------------------------ | --------------------------------- |
| GET    | `/`                 | —                        | `[{ username, msg }]`              |
| GET    | `/me`               | —                        | `{ username }` for the key        |
| POST   | `/register`         | `{ "username" }`          | `{ username, key }` (register key)|
| GET    | `/:username`        | —                        | `{ total, files: [{ id, size }] }`|
| GET    | `/:username/:id`    | —                        | raw file, `Content-Type` sniffed  |
| POST   | `/:username/:id`    | raw binary               | `{ id, size }`                    |
| DELETE | `/:username/:id`    | —                        | `204`                             |

`total` and `size` are in kilobytes (rounded).

### curl

Examples below assume the server at `ripple.n0fa.de`, a user key of
`alicekey`, and the register key from `register.json` as `regkey`.

List users and their messages:

```sh
curl -H 'x-key: alicekey' https://ripple.n0fa.de/
```

Who a key belongs to:

```sh
curl -H 'x-key: alicekey' https://ripple.n0fa.de/me
```

Register a new user (register key):

```sh
curl -X POST -H 'x-key: regkey' -H 'content-type: application/json' \
  -d '{"username":"carol"}' https://ripple.n0fa.de/register
```

List a user's files:

```sh
curl -H 'x-key: alicekey' https://ripple.n0fa.de/alice
```

Download a file:

```sh
curl -H 'x-key: alicekey' -o kick.wav https://ripple.n0fa.de/alice/kick
```

Upload a file (raw body; only your own user):

```sh
curl -X POST -H 'x-key: alicekey' -H 'content-type: application/octet-stream' \
  --data-binary @kick.wav https://ripple.n0fa.de/alice/kick
```

Delete a file (only your own user):

```sh
curl -X DELETE -H 'x-key: alicekey' https://ripple.n0fa.de/alice/kick
```

Set your message (upload to `msg.md`; max 128 chars):

```sh
curl -X POST -H 'x-key: alicekey' -H 'content-type: text/plain' \
  --data 'hello *world*' https://ripple.n0fa.de/alice/msg.md
```

Limits per user: 64 MB total, 999 samples.

## Registration

The key in `register.json` is not a user key. `GET /me` with it returns
`{ "username": "register" }`. `POST /register` with that key and a JSON body
`{ "username" }` generates an 8-byte hex key, adds the user to `users.json`,
and returns `{ username, key }`. Usernames must match `[A-Za-z0-9][A-Za-z0-9_-]{0,31}`,
must not be `register`, and must not already exist.

## Message

Each user may set a short message (max 128 chars) stored at
`storage/<username>/msg.md` and returned as `msg` in the user list. It is set
by uploading to `/:username/msg.md` (only the owner; server rejects >128
chars). `msg.md` is excluded from the file list and stats.

## Frontend

Enter a key (stored in `localStorage`), browse users (each shows their message
un-rendered), open a user, stream or download samples. On your own user page
you can also edit your message, and upload (pick a file, the id auto-fills from
its name and is editable) and delete owned samples. Entering the register key
shows a username field instead; submitting it displays the generated key. The
key is sent as `x-key`; files are fetched into blob URLs so playback and
download work despite the custom header.
