# Implementation Prompt — Relationship Map

Build a privacy-first relationship map using MapLibre.

## Core

Locations:
- title
- coordinates
- date
- description
- photos
- memory reference
- location privacy precision
- future/past flag

## Privacy

Allow:
- exact
- approximate
- hidden

Public projection must respect this.

## Modes

- map
- chronological journey
- firsts
- future destinations

## Templates

1. Clean Atlas
2. Night Map
3. Postcard Map
4. Journey Timeline
5. Scrapbook Map

Avoid leaking exact coordinates through HTML, API payloads, analytics or metadata when privacy is approximate/hidden.
