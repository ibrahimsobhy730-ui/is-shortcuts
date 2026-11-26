/* Vercel Blob store credentials — SERVER SIDE ONLY. Never import
   this module from client code: the token value must never leave
   the server (the browser gets a short-lived client token minted
   by /api/media/upload instead).
   The Public store created 2026-11-26 (is-shortcuts-blob-public)
   got its variables under a PUBLIC_ prefix because the plain
   names were already taken by the old Private store
   (is-shortcuts-blob): PUBLIC_BLOB_READ_WRITE_TOKEN is the
   Public store's token, while BLOB_READ_WRITE_TOKEN still points
   at the old Private store. Prefer the Public one; fall back to
   the legacy name when it is absent (e.g. local dev).
   The token itself identifies the store, so no store id is read
   anywhere: BLOB_STORE_ID / PUBLIC_BLOB_STORE_ID only matter
   for OIDC auth, which this app does not use. The client parses
   the store id out of the minted client token instead (see
   parseStoreIdFromClientToken in components/media-upload.ts). */
export function blobReadWriteToken(): string | undefined {
  return (
    process.env.PUBLIC_BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    undefined
  );
}
