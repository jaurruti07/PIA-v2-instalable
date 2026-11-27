# Security Specification — PIA Firestore Rules

## 1. Data Invariants
1. **Default Deny**: Any unmatched path inside `/databases/{database}/documents` is rejected for both read and write.
2. **PII Isolation**: Publicly readable `/published_texts/{docId}`, `/published_multilingual/{docId}`, and `/published_data/{docId}` documents strictly forbid `email`, `uid`, `updatedBy`, or user identifiers.
   - `/published_texts/{docId}` permits only the 5 whitelisted text module IDs (`portal`, `directorio`, `tableros`, `canales`, `riesgo`).
   - `/published_multilingual/{docId}` permits only the 3 whitelisted multilingual catalog IDs (`portal`, `canales`, `i18n`).
   - `/published_data/{docId}` permits only the 8 whitelisted dataset IDs (`canales`, `directorio`, `tableros`, `riesgo`, `portal`, `ui_config`, `canales_settings`, `chatbot_knowledge`).
   - Collection `list` queries are forbidden (`get`-only) on all public collections.
3. **Verified Operator Allowlist**: Administrative writes and access to `/admin_text_snapshots/{snapshotId}` and `/admin_audit_logs/{logId}` require `request.auth != null`, `request.auth.token.email_verified == true`, and exact membership in the institutional allowlist (`deteccionydenuncia@cnc.gob.gt`, `apoyogi@cnc.gob.gt`).
4. **Temporal & Identity Integrity**: All server timestamps (`updatedAt`, `timestamp`) must equal `request.time`. All attribution fields (`updatedBy`, `updatedByUid`, `user`, `uid`) must match `request.auth.token.email` and `request.auth.uid`.
5. **Anti-Update-Gap & Strict Keys**: Both `create` and `update` execute `isValid[Entity](incoming())`, `affectedKeys().hasOnly(...)` on update, and immutable `docId`/`snapshotId`.

## 2. Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated write** to `/published_texts/portal`, `/published_multilingual/portal`, or `/published_data/directorio`: blocked by `isAuthorizedOperator()`.
2. **Collection listing scrape** (`list` on `/published_texts`, `/published_multilingual`, or `/published_data`): blocked (`allow list: if false;`).
3. **Email spoofing** (`request.auth.token.email == 'deteccionydenuncia@cnc.gob.gt'`, `email_verified: false`): blocked by `email_verified == true`.
4. **Non-whitelisted domain user** (`attacker@gmail.com`, `email_verified: true`): blocked by allowlist.
5. **Invalid document ID poisoning** (`/published_texts/arbitrary_id_123`, `/published_multilingual/secret`, or `/published_data/users_roles`): blocked by `isValidTextDocId(docId)`, `isValidMultilingualDocId(docId)`, and `isValidDataDocId(docId)`.
6. **Shadow field injection** on create/update (adding `{ isAdmin: true }` or `{ updatedBy: 'fake@cnc.gob.gt' }`): blocked by `hasOnly(...)`.
7. **Schema/type poisoning** (`overrides: "not-a-map"`, `data: "string"`, `itemCount: -1`, or `schemaVersion: 99`): blocked by entity validators.
8. **Client-forged timestamp** (`updatedAt: Timestamp.fromMillis(0)` instead of `serverTimestamp()`): blocked by `incoming().updatedAt == request.time`.
9. **Immutability bypass** on update changing `docId` from `'portal'` to `'directorio'`: blocked by `incoming().docId == docId && incoming().docId == existing().docId`.
10. **PII read leak** — non-operator signed-in user reading `/admin_text_snapshots/latest_bundle` or `/admin_audit_logs/1`: blocked by `isAuthorizedOperator()`.
11. **Identity spoofing** in `/admin_text_snapshots/latest_bundle` (`updatedByUid: 'other_uid'` or `updatedBy: 'apoyogi@cnc.gob.gt'` while signed in as `deteccionydenuncia@cnc.gob.gt`): blocked by `updatedByUid == request.auth.uid && updatedBy == request.auth.token.email`.
12. **Audit log tampering** (`update` or `delete` on `/admin_audit_logs/{logId}`): blocked (`allow update, delete: if false;`).
