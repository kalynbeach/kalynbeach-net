# Auth Capability

Authentication and authorization for the application.

## ADDED Requirements

### Requirement: Clerk Authentication Provider

The system SHALL use Clerk as the authentication provider for user identity management.

#### Scenario: User signs in via GitHub OAuth
- **WHEN** unauthenticated user clicks sign-in
- **THEN** Clerk modal opens with GitHub OAuth option
- **AND** successful authentication returns JWT with Clerk user ID

#### Scenario: User signs out
- **WHEN** authenticated user clicks sign-out
- **THEN** session is cleared
- **AND** user is redirected to home page

### Requirement: JWT Verification

The system SHALL verify Clerk JWTs for authenticated Convex requests using `auth.config.ts`.

#### Scenario: Valid JWT accepted
- **WHEN** request includes valid Clerk JWT with `convex` template
- **THEN** Convex functions can access `ctx.auth.getUserIdentity()`
- **AND** `identity.subject` contains Clerk user ID

#### Scenario: Invalid JWT rejected
- **WHEN** request includes invalid or expired JWT
- **THEN** `ctx.auth.getUserIdentity()` returns null
- **AND** protected operations fail with authentication error

### Requirement: Route Protection

The system SHALL protect admin routes using Clerk middleware.

#### Scenario: Unauthenticated user accesses protected route
- **WHEN** unauthenticated user navigates to `/dashboard`
- **THEN** user is redirected to Clerk sign-in

#### Scenario: Authenticated user accesses protected route
- **WHEN** authenticated user navigates to `/dashboard`
- **THEN** user can access the page

### Requirement: Clerk UI Components

The system SHALL use Clerk pre-built components for auth UI.

#### Scenario: Sign-in button renders
- **WHEN** unauthenticated user views header
- **THEN** `SignInButton` component displays "Sign In"

#### Scenario: User button renders
- **WHEN** authenticated user views header
- **THEN** `UserButton` component displays user avatar with dropdown menu

## REMOVED Requirements

### Requirement: Supabase Authentication

**Reason**: Replaced by Clerk authentication
**Migration**: Remove `db/supabase/` clients, `app/login/`, `app/auth/` routes, and Supabase middleware
