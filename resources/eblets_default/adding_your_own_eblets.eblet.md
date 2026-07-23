# Adding Your Own Eblets

An "eblet" is just a small `.eblet.md` text file: a title (from the filename)
and a body of plain-language knowledge. The app scores and recalls these with a
simple keyword/BM25 search when you ask a question, so context from your own
files can flow into answers.

## How to add your own

- Point the app at a folder of your own notes (Settings / Helm — folder picker),
  or
- Drop `.eblet.md` files directly into your per-user eblets folder, or
- Set the `MNEM_EBLET_STORE_ROOTS` environment variable to one or more folder
  paths (separated by your OS path separator) if you want to point at an
  existing notes vault without copying files.

## What NOT to put here

Do not put API keys, passwords, tokens, or other credentials in an eblet file.
Eblets are meant for recallable knowledge, not secrets — and nothing in this
folder is encrypted at rest.
