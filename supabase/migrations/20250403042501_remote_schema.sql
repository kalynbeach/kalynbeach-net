create type "auth"."aal_level" as enum ('aal1', 'aal2', 'aal3');

create type "auth"."code_challenge_method" as enum ('s256', 'plain');

create type "auth"."factor_status" as enum ('unverified', 'verified');

create type "auth"."factor_type" as enum ('totp', 'webauthn', 'phone');

create type "auth"."one_time_token_type" as enum ('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');

alter table "auth"."users" drop constraint "users_email_key";

drop index if exists "auth"."refresh_tokens_token_idx";

drop index if exists "auth"."users_email_key";

drop index if exists "auth"."users_instance_id_email_idx";

create table "auth"."flow_state" (
    "id" uuid not null,
    "user_id" uuid,
    "auth_code" text not null,
    "code_challenge_method" auth.code_challenge_method not null,
    "code_challenge" text not null,
    "provider_type" text not null,
    "provider_access_token" text,
    "provider_refresh_token" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" text not null,
    "auth_code_issued_at" timestamp with time zone
);


alter table "auth"."flow_state" enable row level security;

create table "auth"."identities" (
    "provider_id" text not null,
    "user_id" uuid not null,
    "identity_data" jsonb not null,
    "provider" text not null,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" text generated always as (lower((identity_data ->> 'email'::text))) stored,
    "id" uuid not null default gen_random_uuid()
);


alter table "auth"."identities" enable row level security;

create table "auth"."mfa_amr_claims" (
    "session_id" uuid not null,
    "created_at" timestamp with time zone not null,
    "updated_at" timestamp with time zone not null,
    "authentication_method" text not null,
    "id" uuid not null
);


alter table "auth"."mfa_amr_claims" enable row level security;

create table "auth"."mfa_challenges" (
    "id" uuid not null,
    "factor_id" uuid not null,
    "created_at" timestamp with time zone not null,
    "verified_at" timestamp with time zone,
    "ip_address" inet not null,
    "otp_code" text,
    "web_authn_session_data" jsonb
);


alter table "auth"."mfa_challenges" enable row level security;

create table "auth"."mfa_factors" (
    "id" uuid not null,
    "user_id" uuid not null,
    "friendly_name" text,
    "factor_type" auth.factor_type not null,
    "status" auth.factor_status not null,
    "created_at" timestamp with time zone not null,
    "updated_at" timestamp with time zone not null,
    "secret" text,
    "phone" text,
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" jsonb,
    "web_authn_aaguid" uuid
);


alter table "auth"."mfa_factors" enable row level security;

create table "auth"."one_time_tokens" (
    "id" uuid not null,
    "user_id" uuid not null,
    "token_type" auth.one_time_token_type not null,
    "token_hash" text not null,
    "relates_to" text not null,
    "created_at" timestamp without time zone not null default now(),
    "updated_at" timestamp without time zone not null default now()
);


alter table "auth"."one_time_tokens" enable row level security;

create table "auth"."saml_providers" (
    "id" uuid not null,
    "sso_provider_id" uuid not null,
    "entity_id" text not null,
    "metadata_xml" text not null,
    "metadata_url" text,
    "attribute_mapping" jsonb,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" text
);


alter table "auth"."saml_providers" enable row level security;

create table "auth"."saml_relay_states" (
    "id" uuid not null,
    "sso_provider_id" uuid not null,
    "request_id" text not null,
    "for_email" text,
    "redirect_to" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" uuid
);


alter table "auth"."saml_relay_states" enable row level security;

create table "auth"."sessions" (
    "id" uuid not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" uuid,
    "aal" auth.aal_level,
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" text,
    "ip" inet,
    "tag" text
);


alter table "auth"."sessions" enable row level security;

create table "auth"."sso_domains" (
    "id" uuid not null,
    "sso_provider_id" uuid not null,
    "domain" text not null,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


alter table "auth"."sso_domains" enable row level security;

create table "auth"."sso_providers" (
    "id" uuid not null,
    "resource_id" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


alter table "auth"."sso_providers" enable row level security;

alter table "auth"."audit_log_entries" add column "ip_address" character varying(64) not null default ''::character varying;

alter table "auth"."audit_log_entries" enable row level security;

alter table "auth"."instances" enable row level security;

alter table "auth"."refresh_tokens" add column "parent" character varying(255);

alter table "auth"."refresh_tokens" add column "session_id" uuid;

alter table "auth"."refresh_tokens" enable row level security;

alter table "auth"."schema_migrations" enable row level security;

alter table "auth"."users" drop column "email_change_token";

alter table "auth"."users" drop column "confirmed_at";

alter table "auth"."users" add column "banned_until" timestamp with time zone;

alter table "auth"."users" add column "deleted_at" timestamp with time zone;

alter table "auth"."users" add column "email_change_confirm_status" smallint default 0;

alter table "auth"."users" add column "email_change_token_current" character varying(255) default ''::character varying;

alter table "auth"."users" add column "email_change_token_new" character varying(255);

alter table "auth"."users" add column "email_confirmed_at" timestamp with time zone;

alter table "auth"."users" add column "is_anonymous" boolean not null default false;

alter table "auth"."users" add column "is_sso_user" boolean not null default false;

alter table "auth"."users" add column "phone" text default NULL::character varying;

alter table "auth"."users" add column "phone_change" text default ''::character varying;

alter table "auth"."users" add column "phone_change_sent_at" timestamp with time zone;

alter table "auth"."users" add column "phone_change_token" character varying(255) default ''::character varying;

alter table "auth"."users" add column "phone_confirmed_at" timestamp with time zone;

alter table "auth"."users" add column "reauthentication_sent_at" timestamp with time zone;

alter table "auth"."users" add column "reauthentication_token" character varying(255) default ''::character varying;

alter table "auth"."users" add column "confirmed_at" timestamp with time zone generated always as (LEAST(email_confirmed_at, phone_confirmed_at)) stored;

alter table "auth"."users" enable row level security;

CREATE UNIQUE INDEX amr_id_pk ON auth.mfa_amr_claims USING btree (id);

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);

CREATE UNIQUE INDEX flow_state_pkey ON auth.flow_state USING btree (id);

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);

CREATE UNIQUE INDEX identities_pkey ON auth.identities USING btree (id);

CREATE UNIQUE INDEX identities_provider_id_provider_unique ON auth.identities USING btree (provider_id, provider);

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);

CREATE UNIQUE INDEX mfa_amr_claims_session_id_authentication_method_pkey ON auth.mfa_amr_claims USING btree (session_id, authentication_method);

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);

CREATE UNIQUE INDEX mfa_challenges_pkey ON auth.mfa_challenges USING btree (id);

CREATE UNIQUE INDEX mfa_factors_last_challenged_at_key ON auth.mfa_factors USING btree (last_challenged_at);

CREATE UNIQUE INDEX mfa_factors_pkey ON auth.mfa_factors USING btree (id);

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);

CREATE UNIQUE INDEX one_time_tokens_pkey ON auth.one_time_tokens USING btree (id);

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);

CREATE UNIQUE INDEX refresh_tokens_token_unique ON auth.refresh_tokens USING btree (token);

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);

CREATE UNIQUE INDEX saml_providers_entity_id_key ON auth.saml_providers USING btree (entity_id);

CREATE UNIQUE INDEX saml_providers_pkey ON auth.saml_providers USING btree (id);

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);

CREATE UNIQUE INDEX saml_relay_states_pkey ON auth.saml_relay_states USING btree (id);

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);

CREATE UNIQUE INDEX sessions_pkey ON auth.sessions USING btree (id);

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));

CREATE UNIQUE INDEX sso_domains_pkey ON auth.sso_domains USING btree (id);

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);

CREATE UNIQUE INDEX sso_providers_pkey ON auth.sso_providers USING btree (id);

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);

CREATE UNIQUE INDEX users_phone_key ON auth.users USING btree (phone);

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));

alter table "auth"."flow_state" add constraint "flow_state_pkey" PRIMARY KEY using index "flow_state_pkey";

alter table "auth"."identities" add constraint "identities_pkey" PRIMARY KEY using index "identities_pkey";

alter table "auth"."mfa_amr_claims" add constraint "amr_id_pk" PRIMARY KEY using index "amr_id_pk";

alter table "auth"."mfa_challenges" add constraint "mfa_challenges_pkey" PRIMARY KEY using index "mfa_challenges_pkey";

alter table "auth"."mfa_factors" add constraint "mfa_factors_pkey" PRIMARY KEY using index "mfa_factors_pkey";

alter table "auth"."one_time_tokens" add constraint "one_time_tokens_pkey" PRIMARY KEY using index "one_time_tokens_pkey";

alter table "auth"."saml_providers" add constraint "saml_providers_pkey" PRIMARY KEY using index "saml_providers_pkey";

alter table "auth"."saml_relay_states" add constraint "saml_relay_states_pkey" PRIMARY KEY using index "saml_relay_states_pkey";

alter table "auth"."sessions" add constraint "sessions_pkey" PRIMARY KEY using index "sessions_pkey";

alter table "auth"."sso_domains" add constraint "sso_domains_pkey" PRIMARY KEY using index "sso_domains_pkey";

alter table "auth"."sso_providers" add constraint "sso_providers_pkey" PRIMARY KEY using index "sso_providers_pkey";

alter table "auth"."identities" add constraint "identities_provider_id_provider_unique" UNIQUE using index "identities_provider_id_provider_unique";

alter table "auth"."identities" add constraint "identities_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "auth"."identities" validate constraint "identities_user_id_fkey";

alter table "auth"."mfa_amr_claims" add constraint "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE using index "mfa_amr_claims_session_id_authentication_method_pkey";

alter table "auth"."mfa_amr_claims" add constraint "mfa_amr_claims_session_id_fkey" FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE not valid;

alter table "auth"."mfa_amr_claims" validate constraint "mfa_amr_claims_session_id_fkey";

alter table "auth"."mfa_challenges" add constraint "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE not valid;

alter table "auth"."mfa_challenges" validate constraint "mfa_challenges_auth_factor_id_fkey";

alter table "auth"."mfa_factors" add constraint "mfa_factors_last_challenged_at_key" UNIQUE using index "mfa_factors_last_challenged_at_key";

alter table "auth"."mfa_factors" add constraint "mfa_factors_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "auth"."mfa_factors" validate constraint "mfa_factors_user_id_fkey";

alter table "auth"."one_time_tokens" add constraint "one_time_tokens_token_hash_check" CHECK ((char_length(token_hash) > 0)) not valid;

alter table "auth"."one_time_tokens" validate constraint "one_time_tokens_token_hash_check";

alter table "auth"."one_time_tokens" add constraint "one_time_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "auth"."one_time_tokens" validate constraint "one_time_tokens_user_id_fkey";

alter table "auth"."refresh_tokens" add constraint "refresh_tokens_session_id_fkey" FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE not valid;

alter table "auth"."refresh_tokens" validate constraint "refresh_tokens_session_id_fkey";

alter table "auth"."refresh_tokens" add constraint "refresh_tokens_token_unique" UNIQUE using index "refresh_tokens_token_unique";

alter table "auth"."saml_providers" add constraint "entity_id not empty" CHECK ((char_length(entity_id) > 0)) not valid;

alter table "auth"."saml_providers" validate constraint "entity_id not empty";

alter table "auth"."saml_providers" add constraint "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))) not valid;

alter table "auth"."saml_providers" validate constraint "metadata_url not empty";

alter table "auth"."saml_providers" add constraint "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0)) not valid;

alter table "auth"."saml_providers" validate constraint "metadata_xml not empty";

alter table "auth"."saml_providers" add constraint "saml_providers_entity_id_key" UNIQUE using index "saml_providers_entity_id_key";

alter table "auth"."saml_providers" add constraint "saml_providers_sso_provider_id_fkey" FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE not valid;

alter table "auth"."saml_providers" validate constraint "saml_providers_sso_provider_id_fkey";

alter table "auth"."saml_relay_states" add constraint "request_id not empty" CHECK ((char_length(request_id) > 0)) not valid;

alter table "auth"."saml_relay_states" validate constraint "request_id not empty";

alter table "auth"."saml_relay_states" add constraint "saml_relay_states_flow_state_id_fkey" FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE not valid;

alter table "auth"."saml_relay_states" validate constraint "saml_relay_states_flow_state_id_fkey";

alter table "auth"."saml_relay_states" add constraint "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE not valid;

alter table "auth"."saml_relay_states" validate constraint "saml_relay_states_sso_provider_id_fkey";

alter table "auth"."sessions" add constraint "sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "auth"."sessions" validate constraint "sessions_user_id_fkey";

alter table "auth"."sso_domains" add constraint "domain not empty" CHECK ((char_length(domain) > 0)) not valid;

alter table "auth"."sso_domains" validate constraint "domain not empty";

alter table "auth"."sso_domains" add constraint "sso_domains_sso_provider_id_fkey" FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE not valid;

alter table "auth"."sso_domains" validate constraint "sso_domains_sso_provider_id_fkey";

alter table "auth"."sso_providers" add constraint "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0))) not valid;

alter table "auth"."sso_providers" validate constraint "resource_id not empty";

alter table "auth"."users" add constraint "users_email_change_confirm_status_check" CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2))) not valid;

alter table "auth"."users" validate constraint "users_email_change_confirm_status_check";

alter table "auth"."users" add constraint "users_phone_key" UNIQUE using index "users_phone_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION auth.jwt()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$function$
;

CREATE OR REPLACE FUNCTION auth.email()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$function$
;

CREATE OR REPLACE FUNCTION auth.role()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$function$
;

CREATE OR REPLACE FUNCTION auth.uid()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$
;

grant delete on table "auth"."flow_state" to "dashboard_user";

grant insert on table "auth"."flow_state" to "dashboard_user";

grant references on table "auth"."flow_state" to "dashboard_user";

grant select on table "auth"."flow_state" to "dashboard_user";

grant trigger on table "auth"."flow_state" to "dashboard_user";

grant truncate on table "auth"."flow_state" to "dashboard_user";

grant update on table "auth"."flow_state" to "dashboard_user";

grant delete on table "auth"."flow_state" to "postgres";

grant insert on table "auth"."flow_state" to "postgres";

grant references on table "auth"."flow_state" to "postgres";

grant select on table "auth"."flow_state" to "postgres";

grant trigger on table "auth"."flow_state" to "postgres";

grant truncate on table "auth"."flow_state" to "postgres";

grant update on table "auth"."flow_state" to "postgres";

grant delete on table "auth"."identities" to "dashboard_user";

grant insert on table "auth"."identities" to "dashboard_user";

grant references on table "auth"."identities" to "dashboard_user";

grant select on table "auth"."identities" to "dashboard_user";

grant trigger on table "auth"."identities" to "dashboard_user";

grant truncate on table "auth"."identities" to "dashboard_user";

grant update on table "auth"."identities" to "dashboard_user";

grant delete on table "auth"."identities" to "postgres";

grant insert on table "auth"."identities" to "postgres";

grant references on table "auth"."identities" to "postgres";

grant select on table "auth"."identities" to "postgres";

grant trigger on table "auth"."identities" to "postgres";

grant truncate on table "auth"."identities" to "postgres";

grant update on table "auth"."identities" to "postgres";

grant delete on table "auth"."mfa_amr_claims" to "dashboard_user";

grant insert on table "auth"."mfa_amr_claims" to "dashboard_user";

grant references on table "auth"."mfa_amr_claims" to "dashboard_user";

grant select on table "auth"."mfa_amr_claims" to "dashboard_user";

grant trigger on table "auth"."mfa_amr_claims" to "dashboard_user";

grant truncate on table "auth"."mfa_amr_claims" to "dashboard_user";

grant update on table "auth"."mfa_amr_claims" to "dashboard_user";

grant delete on table "auth"."mfa_amr_claims" to "postgres";

grant insert on table "auth"."mfa_amr_claims" to "postgres";

grant references on table "auth"."mfa_amr_claims" to "postgres";

grant select on table "auth"."mfa_amr_claims" to "postgres";

grant trigger on table "auth"."mfa_amr_claims" to "postgres";

grant truncate on table "auth"."mfa_amr_claims" to "postgres";

grant update on table "auth"."mfa_amr_claims" to "postgres";

grant delete on table "auth"."mfa_challenges" to "dashboard_user";

grant insert on table "auth"."mfa_challenges" to "dashboard_user";

grant references on table "auth"."mfa_challenges" to "dashboard_user";

grant select on table "auth"."mfa_challenges" to "dashboard_user";

grant trigger on table "auth"."mfa_challenges" to "dashboard_user";

grant truncate on table "auth"."mfa_challenges" to "dashboard_user";

grant update on table "auth"."mfa_challenges" to "dashboard_user";

grant delete on table "auth"."mfa_challenges" to "postgres";

grant insert on table "auth"."mfa_challenges" to "postgres";

grant references on table "auth"."mfa_challenges" to "postgres";

grant select on table "auth"."mfa_challenges" to "postgres";

grant trigger on table "auth"."mfa_challenges" to "postgres";

grant truncate on table "auth"."mfa_challenges" to "postgres";

grant update on table "auth"."mfa_challenges" to "postgres";

grant delete on table "auth"."mfa_factors" to "dashboard_user";

grant insert on table "auth"."mfa_factors" to "dashboard_user";

grant references on table "auth"."mfa_factors" to "dashboard_user";

grant select on table "auth"."mfa_factors" to "dashboard_user";

grant trigger on table "auth"."mfa_factors" to "dashboard_user";

grant truncate on table "auth"."mfa_factors" to "dashboard_user";

grant update on table "auth"."mfa_factors" to "dashboard_user";

grant delete on table "auth"."mfa_factors" to "postgres";

grant insert on table "auth"."mfa_factors" to "postgres";

grant references on table "auth"."mfa_factors" to "postgres";

grant select on table "auth"."mfa_factors" to "postgres";

grant trigger on table "auth"."mfa_factors" to "postgres";

grant truncate on table "auth"."mfa_factors" to "postgres";

grant update on table "auth"."mfa_factors" to "postgres";

grant delete on table "auth"."one_time_tokens" to "dashboard_user";

grant insert on table "auth"."one_time_tokens" to "dashboard_user";

grant references on table "auth"."one_time_tokens" to "dashboard_user";

grant select on table "auth"."one_time_tokens" to "dashboard_user";

grant trigger on table "auth"."one_time_tokens" to "dashboard_user";

grant truncate on table "auth"."one_time_tokens" to "dashboard_user";

grant update on table "auth"."one_time_tokens" to "dashboard_user";

grant delete on table "auth"."one_time_tokens" to "postgres";

grant insert on table "auth"."one_time_tokens" to "postgres";

grant references on table "auth"."one_time_tokens" to "postgres";

grant select on table "auth"."one_time_tokens" to "postgres";

grant trigger on table "auth"."one_time_tokens" to "postgres";

grant truncate on table "auth"."one_time_tokens" to "postgres";

grant update on table "auth"."one_time_tokens" to "postgres";

grant delete on table "auth"."saml_providers" to "dashboard_user";

grant insert on table "auth"."saml_providers" to "dashboard_user";

grant references on table "auth"."saml_providers" to "dashboard_user";

grant select on table "auth"."saml_providers" to "dashboard_user";

grant trigger on table "auth"."saml_providers" to "dashboard_user";

grant truncate on table "auth"."saml_providers" to "dashboard_user";

grant update on table "auth"."saml_providers" to "dashboard_user";

grant delete on table "auth"."saml_providers" to "postgres";

grant insert on table "auth"."saml_providers" to "postgres";

grant references on table "auth"."saml_providers" to "postgres";

grant select on table "auth"."saml_providers" to "postgres";

grant trigger on table "auth"."saml_providers" to "postgres";

grant truncate on table "auth"."saml_providers" to "postgres";

grant update on table "auth"."saml_providers" to "postgres";

grant delete on table "auth"."saml_relay_states" to "dashboard_user";

grant insert on table "auth"."saml_relay_states" to "dashboard_user";

grant references on table "auth"."saml_relay_states" to "dashboard_user";

grant select on table "auth"."saml_relay_states" to "dashboard_user";

grant trigger on table "auth"."saml_relay_states" to "dashboard_user";

grant truncate on table "auth"."saml_relay_states" to "dashboard_user";

grant update on table "auth"."saml_relay_states" to "dashboard_user";

grant delete on table "auth"."saml_relay_states" to "postgres";

grant insert on table "auth"."saml_relay_states" to "postgres";

grant references on table "auth"."saml_relay_states" to "postgres";

grant select on table "auth"."saml_relay_states" to "postgres";

grant trigger on table "auth"."saml_relay_states" to "postgres";

grant truncate on table "auth"."saml_relay_states" to "postgres";

grant update on table "auth"."saml_relay_states" to "postgres";

grant delete on table "auth"."sessions" to "dashboard_user";

grant insert on table "auth"."sessions" to "dashboard_user";

grant references on table "auth"."sessions" to "dashboard_user";

grant select on table "auth"."sessions" to "dashboard_user";

grant trigger on table "auth"."sessions" to "dashboard_user";

grant truncate on table "auth"."sessions" to "dashboard_user";

grant update on table "auth"."sessions" to "dashboard_user";

grant delete on table "auth"."sessions" to "postgres";

grant insert on table "auth"."sessions" to "postgres";

grant references on table "auth"."sessions" to "postgres";

grant select on table "auth"."sessions" to "postgres";

grant trigger on table "auth"."sessions" to "postgres";

grant truncate on table "auth"."sessions" to "postgres";

grant update on table "auth"."sessions" to "postgres";

grant delete on table "auth"."sso_domains" to "dashboard_user";

grant insert on table "auth"."sso_domains" to "dashboard_user";

grant references on table "auth"."sso_domains" to "dashboard_user";

grant select on table "auth"."sso_domains" to "dashboard_user";

grant trigger on table "auth"."sso_domains" to "dashboard_user";

grant truncate on table "auth"."sso_domains" to "dashboard_user";

grant update on table "auth"."sso_domains" to "dashboard_user";

grant delete on table "auth"."sso_domains" to "postgres";

grant insert on table "auth"."sso_domains" to "postgres";

grant references on table "auth"."sso_domains" to "postgres";

grant select on table "auth"."sso_domains" to "postgres";

grant trigger on table "auth"."sso_domains" to "postgres";

grant truncate on table "auth"."sso_domains" to "postgres";

grant update on table "auth"."sso_domains" to "postgres";

grant delete on table "auth"."sso_providers" to "dashboard_user";

grant insert on table "auth"."sso_providers" to "dashboard_user";

grant references on table "auth"."sso_providers" to "dashboard_user";

grant select on table "auth"."sso_providers" to "dashboard_user";

grant trigger on table "auth"."sso_providers" to "dashboard_user";

grant truncate on table "auth"."sso_providers" to "dashboard_user";

grant update on table "auth"."sso_providers" to "dashboard_user";

grant delete on table "auth"."sso_providers" to "postgres";

grant insert on table "auth"."sso_providers" to "postgres";

grant references on table "auth"."sso_providers" to "postgres";

grant select on table "auth"."sso_providers" to "postgres";

grant trigger on table "auth"."sso_providers" to "postgres";

grant truncate on table "auth"."sso_providers" to "postgres";

grant update on table "auth"."sso_providers" to "postgres";


