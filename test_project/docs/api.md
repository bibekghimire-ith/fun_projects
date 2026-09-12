# API Contract

Base:
`/api/v1`

## Auth

POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me

## Relationships

GET  /relationships
POST /relationships
GET  /relationships/{id}
PATCH /relationships/{id}
DELETE /relationships/{id}

## Experiences

GET /experiences
POST /experiences
GET /experiences/{id}
PATCH /experiences/{id}
DELETE /experiences/{id}
POST /experiences/{id}/publish
POST /experiences/{id}/unpublish
POST /experiences/{id}/revoke

## Public

GET /public/experiences/{token}
POST /public/experiences/{token}/verify-pin
POST /public/experiences/{token}/responses

## Media

POST /media/presign
POST /media/complete
GET /media/{id}
DELETE /media/{id}

## Feature flags

GET /admin/features
PATCH /admin/features/{key}

## Pickup lines

GET /pickup-lines
POST /pickup-lines
PATCH /pickup-lines/{id}
DELETE /pickup-lines/{id}

GET /pickup-lines/random
GET /pickup-lines/daily
GET /pickup-lines/collections
POST /pickup-lines/collections

## Response format

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Errors:

```json
{
  "success": false,
  "error": {
    "code": "FEATURE_DISABLED",
    "message": "This module is currently unavailable."
  }
}
```
