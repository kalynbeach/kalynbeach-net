# Users Capability

User management and synchronization between Clerk and Convex.

## ADDED Requirements

### Requirement: Webhook-Based User Sync

The system SHALL sync users from Clerk to Convex via webhooks, not client-side mutations.

#### Scenario: New user created
- **WHEN** Clerk sends `user.created` webhook event
- **THEN** Convex `upsertFromClerk` mutation creates user record
- **AND** user has `externalId` matching Clerk user ID
- **AND** user has default role of `guest`

#### Scenario: User updated
- **WHEN** Clerk sends `user.updated` webhook event
- **THEN** Convex `upsertFromClerk` mutation updates user record
- **AND** preserves existing `role` value
- **AND** updates `name`, `email`, `imageUrl` from Clerk data

#### Scenario: User deleted
- **WHEN** Clerk sends `user.deleted` webhook event
- **THEN** Convex `deleteFromClerk` mutation removes user record

### Requirement: Webhook Verification

The system SHALL verify Clerk webhook signatures using Svix.

#### Scenario: Valid webhook accepted
- **WHEN** webhook request has valid `svix-id`, `svix-timestamp`, `svix-signature` headers
- **THEN** request is processed

#### Scenario: Invalid webhook rejected
- **WHEN** webhook request has invalid or missing signature headers
- **THEN** return 400 error
- **AND** do not modify database

### Requirement: Current User Query

The system SHALL provide query to get current authenticated user.

#### Scenario: Authenticated user queries current
- **WHEN** authenticated user calls `api.users.current` query
- **THEN** returns user document matching JWT subject
- **AND** includes `_id`, `name`, `email`, `imageUrl`, `externalId`, `role`

#### Scenario: Unauthenticated user queries current
- **WHEN** unauthenticated user calls `api.users.current` query
- **THEN** returns null

### Requirement: User Roles

The system SHALL support role-based access with admin, vip, and guest roles.

#### Scenario: Admin role check
- **WHEN** user has `role: "admin"`
- **THEN** user can access admin-only features

#### Scenario: VIP role check
- **WHEN** user has `role: "vip"`
- **THEN** user can access VIP features

#### Scenario: Guest role default
- **WHEN** new user is created via webhook
- **THEN** user is assigned `role: "guest"`

### Requirement: User Table Schema

The system SHALL store users in Convex `users` table with indexed external ID.

#### Scenario: Query user by external ID
- **WHEN** system looks up user by Clerk ID
- **THEN** uses `byExternalId` index for efficient lookup
- **AND** returns single user or null

## REMOVED Requirements

### Requirement: Supabase Profiles Table

**Reason**: Replaced by Convex `users` table with webhook sync
**Migration**: Users will re-register via Clerk; no data migration needed

### Requirement: Client-Side User Creation

**Reason**: Users now created via webhook, not client mutations
**Migration**: Remove any client-side user creation code
