/**
 * S3 Upload Service - Direct upload from frontend
 * Connects directly to S3 using Cognito Identity Pool credentials.
 * Target: cassa-documentos-ingesta/contratos/
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3"
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let s3Client: S3Client | null = null
let config: { awsRegion: string; identityPoolId: string; authority: string } | null = null

const BUCKET_NAME = "cassa-documentos-ingesta"
const UPLOAD_PREFIX = "contratos/"

/**
 * Load config and create S3 client with Cognito credentials
 */
async function getS3Client(idToken: string): Promise<S3Client> {
  if (!config) {
    const response = await fetch("/aws-exports.json")
    config = await response.json()
  }

  const region = config!.awsRegion || "us-east-1"
  const identityPoolId = config!.identityPoolId

  if (!identityPoolId) {
    throw new Error(
      "identityPoolId not found in aws-exports.json. " +
      "Create a Cognito Identity Pool and add its ID to the config."
    )
  }

  // Extract the User Pool ID from the authority URL
  // authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_t03ZO3ERX"
  const userPoolId = config!.authority.split("/").pop() || ""
  const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`

  // Create S3 client with Cognito Identity Pool credentials
  s3Client = new S3Client({
    region,
    credentials: fromCognitoIdentityPool({
      identityPoolId,
      clientConfig: { region },
      logins: {
        [providerName]: idToken,
      },
    }),
  })

  return s3Client
}

export interface UploadResult {
  success: boolean
  fileKey: string
  fileName: string
  bucket: string
}

export interface DocumentItem {
  key: string
  fileName: string
  size: number
  lastModified: string
}

/**
 * Upload a file directly to S3 from the browser
 */
export async function uploadDocument(
  file: File,
  idToken: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const client = await getS3Client(idToken)

  // Generate unique key
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const uniqueId = crypto.randomUUID().slice(0, 8)
  const safeFilename = file.name.replace(/\s+/g, "_")
  const fileKey = `${UPLOAD_PREFIX}${timestamp}_${uniqueId}_${safeFilename}`

  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer()

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: new Uint8Array(fileBuffer),
    ContentType: file.type,
  })

  // Simulate progress (SDK v3 doesn't have native upload progress for small files)
  onProgress?.(10)

  await client.send(command)

  onProgress?.(100)

  return {
    success: true,
    fileKey,
    fileName: file.name,
    bucket: BUCKET_NAME,
  }
}

/**
 * List documents in the contratos/ prefix
 */
export async function listDocuments(idToken: string): Promise<DocumentItem[]> {
  const client = await getS3Client(idToken)

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: UPLOAD_PREFIX,
  })

  const response = await client.send(command)

  const documents: DocumentItem[] = []
  for (const obj of response.Contents || []) {
    if (!obj.Key || obj.Key === UPLOAD_PREFIX) continue

    const fileName = obj.Key.replace(UPLOAD_PREFIX, "")
    documents.push({
      key: obj.Key,
      fileName,
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || "",
    })
  }

  return documents
}

/**
 * Get a presigned URL to download/preview a document
 */
export async function getDocumentPreviewUrl(
  key: string,
  idToken: string
): Promise<string> {
  const client = await getS3Client(idToken)

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  const url = await getSignedUrl(client, command, { expiresIn: 3600 })
  return url
}
