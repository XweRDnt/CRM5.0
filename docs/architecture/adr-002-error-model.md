# ADR-002 Error Model

Date: 2026-02-13

## Decision
Use a single API error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": {}
  }
}
```

## Consequences
- Stable frontend error parsing.
- Lower integration complexity.
- Compatible with service-layer `AppError`.
