// Apply the CORS rules the browser needs on the R2 bucket:
//   - PUT from the frontend origin(s) (presigned uploads, Content-Type header)
//   - GET/HEAD from anywhere (video/audio/captions; <track crossorigin> needs CORS)
// Usage (from backend/, with R2_* and CORS_ORIGIN in .env or the environment):
//   npm run r2:cors
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const env = (k: string) => process.env[k]?.trim() || "";
const [accountId, accessKeyId, secretAccessKey, bucket] = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"].map(env);
const origins = env("CORS_ORIGIN").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !origins.length) {
  console.error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and CORS_ORIGIN first.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});
await s3.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        { AllowedOrigins: origins, AllowedMethods: ["PUT"], AllowedHeaders: ["Content-Type"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 },
        { AllowedOrigins: ["*"], AllowedMethods: ["GET", "HEAD"], AllowedHeaders: ["Range"], MaxAgeSeconds: 86400 },
      ],
    },
  }),
);
const { CORSRules } = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
console.log(`CORS applied to "${bucket}":`, JSON.stringify(CORSRules, null, 2));
