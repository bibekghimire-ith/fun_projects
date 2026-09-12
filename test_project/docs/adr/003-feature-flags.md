# ADR-003: Runtime Feature Flags

## Status
Accepted

Each module is controlled by persisted feature flags.

Disabling a module hides its UI and blocks its API, but never deletes its data.

This permits:
- personal configuration
- staged rollout
- future SaaS plans
- safe experimentation
