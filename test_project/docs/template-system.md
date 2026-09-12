# Template System

## Design principle

Templates change presentation, not domain data.

Each template has:
- stable ID
- version
- module
- personality
- configurable options
- content schema
- preview
- accessibility rules

## Global personalities

1. Minimal
2. Romantic
3. Cinematic
4. Playful
5. Nostalgic
6. Modern Gen-Z
7. Scrapbook
8. Elegant Dark

## Required template matrix

### Photos
1. Editorial
2. Film Strip
3. Polaroid
4. Midnight Gallery
5. Cinematic Scroll

### Countdown
1. Minimal Timer
2. Passport
3. Midnight Timer
4. Postcard
5. Cinematic Reveal

### Game
1. Pixel Adventure
2. Interactive Story
3. Mini Puzzle
4. Visual Novel
5. Arcade Choice

### Relationship Map
1. Clean Atlas
2. Night Map
3. Postcard Map
4. Journey Timeline
5. Scrapbook Map

### Two Perspectives
1. Split Screen
2. Mirror
3. Conversation
4. Polaroid Pair
5. Timeline Duel

### Pickup Lines
1. Clean Cards
2. Swipe Deck
3. Notebook
4. Neon Chat
5. Romantic Letter
6. Minimal Search
7. Daily Fortune
8. Collection Wall

## Implementation rule

Use a registry:

```ts
templateRegistry[module][templateId] = TemplateDefinition
```

A template must not directly fetch API data. It receives a typed view model.

## Template quality

Every template must:
- work at 320px width
- support keyboard
- support reduced motion
- handle empty media
- handle long text
- handle failed media
- avoid layout shift
- have loading state
- have error state
