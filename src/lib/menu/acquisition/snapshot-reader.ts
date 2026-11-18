import { constants } from "node:fs";
import { lstat, realpath, open } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  menuAcquisitionManifestSchema, menuObservationSnapshotSchema,
  type AcquisitionManifest, type ObservationSnapshot, type AcquisitionFailure,
} from "@/lib/validation/menu-acquisition";

export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
export type SnapshotReadResult = AcquisitionFailure | {
  status:"accepted"; manifest:AcquisitionManifest; snapshot:ObservationSnapshot;
};
const acceptedResults=new WeakSet<object>();
export function isAcceptedSnapshot(result:SnapshotReadResult):boolean { return acceptedResults.has(result); }
function freeze(value:unknown) {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const entry of Object.values(value)) freeze(entry);
  }
}
class ReadFailure extends Error {
  constructor(readonly code:string, message:string) { super(message); }
}
export function acquisitionFailure(code:string, message:string, status:"rejected"|"quarantined"="rejected", issuePath=""):AcquisitionFailure {
  return {status,issues:[{code,path:issuePath,message}]};
}
function safeRelative(name:string) {
  // Portable, deliberately narrow filenames; reject Windows ADS/UNC/device paths too.
  if (typeof name !== "string" || name.length > 500 || !name.split("/").every((s) => /^[a-zA-Z0-9_.-]+$/.test(s) && s !== "." && s !== ".." && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))
    throw new ReadFailure("UNSAFE_PATH", "Use a relative local filename without traversal or device syntax");
}
function inside(root:string, target:string) {
  const relative=path.relative(root,target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function localBytes(root:string, relative:string, limit:number) {
  safeRelative(relative);
  const target=path.resolve(root,relative);
  if (!inside(root,target)) throw new ReadFailure("UNSAFE_PATH","File outside allowed root");
  let current=root;
  for (const part of relative.split("/")) {
    current=path.join(current,part);
    if ((await lstat(current)).isSymbolicLink()) throw new ReadFailure("UNSAFE_PATH","Symlink/junction not allowed");
  }
  if (!inside(root,await realpath(target))) throw new ReadFailure("UNSAFE_PATH","Resolved file outside allowed root");
  const file=await open(target,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before=await file.stat();
    if (!before.isFile() || before.nlink !== 1) throw new ReadFailure("UNSAFE_PATH","Expected regular local file without hard-link aliases");
    if (before.size > limit) throw new ReadFailure("SIZE_LIMIT","File exceeds byte limit");
    const bytes=Buffer.alloc(limit+1);
    let total=0;
    while (total < bytes.length) {
      const read=await file.read(bytes,total,bytes.length-total,null);
      if (!read.bytesRead) break;
      total+=read.bytesRead;
    }
    if (total > limit) throw new ReadFailure("SIZE_LIMIT","File grew beyond byte limit");
    const after=await file.stat(), named=await lstat(target);
    if (named.isSymbolicLink() || !inside(root,await realpath(target)) || before.ino !== named.ino || before.dev !== named.dev || before.size !== total || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
      throw new ReadFailure("FILE_CHANGED","File changed during intake");
    return bytes.subarray(0,total);
  } finally { await file.close(); }
}
function decode(bytes:Buffer) {
  try { return new TextDecoder("utf-8",{fatal:true}).decode(bytes); }
  catch { throw new ReadFailure("INVALID_ENCODING","Expected UTF-8"); }
}
function json(text:string) {
  try { return JSON.parse(text) as unknown; }
  catch { throw new ReadFailure("INVALID_JSON","Invalid JSON snapshot or manifest"); }
}

/** Reads exactly the manifest and its named payload. Never follows evidence URLs. */
export async function readSnapshot(request:{allowedRoot:string;manifestPath:string}):Promise<SnapshotReadResult> {
  try {
    if ((await lstat(request.allowedRoot)).isSymbolicLink()) throw new ReadFailure("UNSAFE_PATH","Allowed root cannot be a link");
    const root=await realpath(request.allowedRoot);
    safeRelative(request.manifestPath);
    if (path.extname(request.manifestPath) !== ".json") throw new ReadFailure("UNSUPPORTED_FORMAT","Manifest must be JSON");
    const manifestResult=menuAcquisitionManifestSchema.safeParse(json(decode(await localBytes(root,request.manifestPath,MAX_MANIFEST_BYTES))));
    if (!manifestResult.success) return {status:"rejected",issues:manifestResult.error.issues.map((i)=>({code:"MANIFEST_SCHEMA",path:i.path.join("."),message:i.message}))};
    const manifest=manifestResult.data;
    safeRelative(manifest.payloadPath);
    if (manifest.rights.status === "denied") return acquisitionFailure("RIGHTS_DENIED","Source reuse denied");
    if (manifest.rights.status !== "verified") return acquisitionFailure("RIGHTS_UNRESOLVED","Reuse evidence must be reviewed", "quarantined");
    if (manifest.source.evidence.status === "unknown" || (manifest.source.evidence.status === "unverified" && manifest.source.evidence.reference === null)) return acquisitionFailure("SOURCE_UNRESOLVED","Source origin requires evidence","quarantined");
    if (manifest.review.status === "rejected") return acquisitionFailure("REVIEW_REJECTED","Snapshot review rejected");
    if (manifest.httpStatus !== null && manifest.httpStatus !== 200) return acquisitionFailure("CAPTURE_STATUS","Unsuccessful HTTP capture");
    const extension=manifest.contentType === "application/json" ? ".json" : ".html";
    if (path.extname(manifest.payloadPath) !== extension) return acquisitionFailure("UNSUPPORTED_FORMAT","Extension and declared type disagree");
    const bytes=await localBytes(root,manifest.payloadPath,MAX_SNAPSHOT_BYTES);
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.contentHash) return acquisitionFailure("HASH_MISMATCH","Payload hash mismatch");
    const text=decode(bytes);
    if (/<(?:app-root|div[^>]+id\s*=\s*["'](?:root|__next)["'])\b|<app-root\b/i.test(text) && !text.trimStart().startsWith("{"))
      return acquisitionFailure("HTML_SHELL","HTML application shell is not menu data");
    if (manifest.contentType !== "application/json") return acquisitionFailure("UNSUPPORTED_FORMAT","No general HTML parser; provide a curated observation JSON export");
    const parsed=menuObservationSnapshotSchema.safeParse(json(text));
    if (!parsed.success) return {status:"quarantined",issues:parsed.error.issues.map((i)=>({code:"SNAPSHOT_SCHEMA",path:i.path.join("."),message:i.message}))};
    if (parsed.data.products.length === 0) return acquisitionFailure("NO_MENU_DATA","No standalone products; not a usable S1.2 menu snapshot");
    const result:SnapshotReadResult={status:"accepted",manifest,snapshot:parsed.data};
    freeze(result);
    acceptedResults.add(result);
    return result;
  } catch(error) {
    return error instanceof ReadFailure ? acquisitionFailure(error.code,error.message) : acquisitionFailure("FILE_READ","Cannot safely read the specified local file");
  }
}
