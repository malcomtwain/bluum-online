// Stub S3 implementation for build to succeed
// This is a placeholder that should be replaced with actual S3 implementation

export const uploadToS3 = async (file: File | Blob, key: string): Promise<string> => {
  console.log("Upload to S3 called with", { file, key });
  return `https://example.com/${key}`;
};

export const getS3Url = (key: string): string => {
  return `https://example.com/${key}`;
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  console.log("Delete from S3 called with", { key });
  return;
};

// Alias for compatibility
export const getFileUrl = getS3Url;
export const uploadFile = uploadToS3; 