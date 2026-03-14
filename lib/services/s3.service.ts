import { PutObjectCommand, type PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";

type S3LikeClient = {
  send: (command: PutObjectCommand) => Promise<unknown>;
};

type PutPublicObjectInput = {
  client?: S3LikeClient;
  bucket: string;
  key: string;
  body: PutObjectCommandInput["Body"];
  contentType: string;
  region: string;
};

type PutPublicObjectResult = {
  url: string;
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for S3 uploads`);
  }
  return value;
};

export const buildPublicS3Url = (bucket: string, region: string, key: string): string => {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};

export const putPublicObject = async (input: PutPublicObjectInput): Promise<PutPublicObjectResult> => {
  const client =
    input.client ??
    new S3Client({
      region: input.region,
      credentials: {
        accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });

  await client.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ACL: "public-read",
    }),
  );

  return { url: buildPublicS3Url(input.bucket, input.region, input.key) };
};
