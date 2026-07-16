import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function getClient(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // Required for MinIO / R2
  });
}

function bucket(): string {
  return process.env.S3_BUCKET_NAME ?? "fgt-users";
}

function key(userId: string): string {
  return `users/${userId}`;
}

const MAX_CAS_RETRIES = 5;

export const s3Store = {
  async get(userId: string): Promise<Uint8Array | null> {
    try {
      const res = await getClient().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key(userId) }),
      );
      if (!res.Body) return null;
      return new Uint8Array(await res.Body.transformToByteArray());
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  },

  async put(userId: string, data: Uint8Array): Promise<void> {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key(userId),
        Body: data,
        ContentType: "application/octet-stream",
      }),
    );
  },

  async delete(userId: string): Promise<void> {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: key(userId) }),
    );
  },

  async modify(
    userId: string,
    fn: (current: Uint8Array | null) => Promise<Uint8Array>,
  ): Promise<Uint8Array> {
    // R2 and S3 both support conditional writes via If-Match/If-None-Match
    // on PutObject (confirmed: R2 docs show ✅ for all conditional headers).
    // ETag from GET guarantees no concurrent modification slipped in.
    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      // Read current state + ETag for optimistic locking
      let etag: string | undefined;
      let current: Uint8Array | null = null;

      try {
        const res = await getClient().send(
          new GetObjectCommand({ Bucket: bucket(), Key: key(userId) }),
        );
        etag = res.ETag;
        if (res.Body) {
          current = new Uint8Array(await res.Body.transformToByteArray());
        }
      } catch (err: unknown) {
        if ((err as { name?: string }).name !== "NoSuchKey") throw err;
        // Object doesn't exist yet — current stays null
      }

      const newData = await fn(current);

      try {
        await getClient().send(
          new PutObjectCommand({
            Bucket: bucket(),
            Key: key(userId),
            Body: newData,
            ContentType: "application/octet-stream",
            ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
          }),
        );
        return newData;
      } catch (err: unknown) {
        const name = (err as { name?: string }).name;
        if (name === "PreconditionFailed" || name === "ConditionalRequestConflict") {
          continue; // ETag mismatch — retry
        }
        throw err;
      }
    }

    throw new Error(`CAS retry limit (${MAX_CAS_RETRIES}) exceeded for user ${userId}`);
  },
};
