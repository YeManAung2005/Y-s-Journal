# Backup and Recovery

> **Status: designed; implementation begins in Phase 10.** Google Drive is for encrypted backups only, never primary synchronization.

## Goals

- Daily automatic backup at 02:00 laptop-local time.
- Retain the latest 30 versions.
- Include Trading, Learning, Personal Journal, and settings.
- Include screenshots and attachments only with explicit opt-in.
- Encrypt before upload.
- Verify integrity and restorability after every backup.
- Recover safely without silently overwriting data.
- Record missed backups and retry.

## Key hierarchy

A random 256-bit **Backup Data Key (BDK)** encrypts backup payloads.

The BDK is wrapped by:

1. An Argon2id-derived key from the user passphrase.
2. An optional recovery key.
3. An optional Windows DPAPI auto-unlock wrapper for unattended backups.

The user passphrase is never stored. The recovery key is displayed once and never stored by the application.

The passphrase-wrapped BDK is embedded in each encrypted backup header, so a backup can be restored on a new installation with the passphrase or recovery key. Automatic backups can use the in-memory/DPAPI-unwrapped BDK and still include the passphrase wrapper.

## Encryption

- KDF: Argon2id with stored parameters and salt.
- Encryption: AES-256-GCM.
- Large archives: chunked authenticated encryption with unique nonces and authenticated chunk metadata.
- Header includes version, backup ID, schema version, timestamp, KDF parameters, wrapped keys, module manifest, attachment flag, and payload checksums.
- No plaintext records or attachments are uploaded.

## Schedule

- Daily at 02:00 in the laptop’s local time zone.
- If the laptop is off or Drive is unavailable, record a missed run.
- Retry when the service and connection return.
- Retain 30 successful backup versions.
- Do not delete an older backup until the new one is verified.

## Verification

After each upload:

1. Confirm upload completion.
2. Verify remote size and checksum where available.
3. Decrypt locally.
4. Validate authentication tags.
5. Validate manifest and schema.
6. Verify record counts and attachment checksums.
7. Perform a dry-run restore validation.
8. Report success or failure.

A failed verification must never be reported as a successful backup.

## Restore

1. Create a safety backup of current data.
2. Verify the safety backup.
3. Require explicit confirmation.
4. Fully validate the selected backup.
5. Restore either a full replacement or selected modules.
6. Verify restored records and attachments.
7. Report results.
8. Keep the safety backup available.

Restore never silently merges records. Authentication credentials and active sessions are excluded from restore payloads and remain controlled by the current installation.

## Recovery key

- Optional generation.
- Displayed once.
- Must be stored separately by the user.
- Wraps the same Backup Data Key.
- Clear warning that backups cannot be recovered without valid recovery credentials.

## Google Drive

- OAuth connection initiated from the host laptop.
- Minimum necessary Drive scope.
- Encrypted refresh token stored in local encrypted metadata, never in served app assets.
- App-created backup folder only.
- Disconnect revokes the token and stops scheduled backups.
- Drive is not used for live synchronization.

## User controls

- Backup status and last success.
- Failure notifications.
- Back Up Now.
- Connect/disconnect Google account.
- Restore selected backup.
- Retention information.
- Recovery-key generation and instructions.
