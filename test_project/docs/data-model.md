# Data Model

Core entities:

```text
User
Relationship
RelationshipMember
Experience
ExperienceSection
ContentBlock
Media
Album
Photo
Playlist
PlaylistItem
CountdownEvent
CountdownClue
Game
GameScene
GameChoice
GameEnding
MapLocation
PerspectiveMemory
PerspectiveEntry
PickupLine
PickupLineCollection
PickupLineCollectionItem
Template
FeatureFlag
ExperienceAccess
Response
AuditLog
```

Important rules:
- UUID primary keys.
- UTC timestamps.
- event timezone stored separately.
- all relationship-owned resources have relationship_id.
- soft deletion only where recovery matters.
- public access uses random token, never database ID.

## FeatureFlag

```text
key
enabled
config_json
version
updated_by
created_at
updated_at
```

Known keys:
- photos_playlist
- countdown
- dating_game
- relationship_map
- perspectives
- pickup_lines

## Experience

```text
id
relationship_id
title
event_type
event_date
timezone
public_token_hash
pin_hash
pin_enabled
status
theme_id
created_at
updated_at
published_at
revoked_at
```

## Media

```text
id
relationship_id
storage_key
mime_type
size_bytes
width
height
duration_seconds
checksum
processing_status
created_at
```

Never store binary media in this table.

## PerspectiveMemory

```text
id
relationship_id
title
event_date
location_id nullable
shared_description
person_a_user_id
person_b_user_id nullable
status
created_at
updated_at
```

## PerspectiveEntry

```text
id
memory_id
author_user_id
body
media_id nullable
visibility
created_at
updated_at
```

## PickupLine

```text
id
language
text
category
tags
intensity
context
is_original
paired_line_id nullable
status
created_at
updated_at
```

Seed content must be original/licensed.
