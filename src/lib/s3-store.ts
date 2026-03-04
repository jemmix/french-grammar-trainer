import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function getClient(): S3Client {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT!,
    region: "auto",
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
};
