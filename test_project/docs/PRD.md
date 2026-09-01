# Product Requirements Document — Our World

## Vision

A private digital relationship space that turns photos, memories, music, places, stories, games, and playful messages into experiences designed for two people.

## Product pillars

1. Personal
2. Private
3. Emotional
4. Playful
5. Modular
6. Extensible

## Modules

### 1. Private Photos + Playlist

Goal: transform a private gallery into a memory experience.

P0:
- albums
- timeline ordering
- captions
- full-screen viewer
- favorites
- playlists
- uploaded audio
- photo-to-song association
- private media
- mobile gallery
- lazy loading

P1:
- mood-based memory discovery
- memory reveal cards
- "photos we haven't taken yet"
- shared favorites
- voice notes

Templates:
- Editorial
- Film Strip
- Polaroid
- Midnight Gallery
- Cinematic Scroll

### 2. Countdown / Ask

Goal: create anticipation around a date/trip.

P0:
- countdown
- event title/date/time/timezone
- destination
- custom question
- yes/no or custom response
- private link
- optional PIN
- post-event transformation into memory

P1:
- daily memory unlocks
- "sleeps until I see you"
- distance shrinking
- itinerary
- packing list
- surprise clues
- timezone-aware display

Templates:
- Minimal Countdown
- Passport
- Midnight Timer
- Postcard
- Cinematic Reveal

### 3. Tiny Dating / Proposal Game

Goal: a 3–10 minute personalized game ending in a meaningful question.

P0:
- game template selection
- configurable scenes
- character/avatar placeholders
- choices
- collectibles
- memory unlocks
- final question
- response capture

Templates:
- Pixel Adventure
- Interactive Story
- Mini Puzzle
- Visual Novel
- Arcade Choice

### 4. Relationship Map

Goal: connect real places to memories.

P0:
- MapLibre map
- locations
- title/date/story/photo
- privacy controls
- route/timeline mode
- future destination

P1:
- animated journey
- clustered memories
- map themes
- "firsts" layer
- distance stats
- travel chapters

Templates:
- Clean Atlas
- Night Map
- Postcard Map
- Journey Timeline
- Scrapbook Map

Do not expose exact locations publicly unless creator explicitly chooses to.

### 5. Two Perspectives

Goal: preserve the same memory from two people's points of view.

P0:
- memory
- person A perspective
- person B perspective
- photos/media
- date/location
- reactions
- permissions

P1:
- collaborative contribution
- compare mode
- synchronized audio
- "what I remember differently"
- private draft until both approve

Templates:
- Split Screen
- Mirror
- Conversation
- Polaroid Pair
- Timeline Duel

### 6. Pickup Lines

Goal: a searchable, fun bilingual pickup-line library.

Languages:
- English
- Nepali
- Nepali-English Mix

Categories:
- Romantic
- Funny
- Cute
- Flirty
- Cheesy
- Nerdy/Tech
- Clever
- Bold
- Conversation Starter
- Gen-Z

P0:
- search
- category
- tags
- random
- copy
- favorites
- collections
- daily line
- admin content management

P1:
- bilingual pairs
- intensity filter
- situation filter
- custom collections
- sharing cards
- line generator from user-provided topic
- "rate this line"

## Admin

Admin can:
- enable/disable modules
- configure module defaults
- manage templates
- manage users/relationships
- manage pickup lines
- manage global settings
- inspect audit events
- revoke public experiences
- configure upload limits

Disabling a module never deletes data.

## Recipient experience

Recipient must never need a creator account.

Private experience:
- token URL
- optional PIN
- no indexing
- no public discovery

## Non-goals

- social network
- public profiles
- advertising
- invasive analytics
- dating marketplace
- payment system in MVP
- microservices
