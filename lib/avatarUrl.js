const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

export function getAvatarUrl(blobId) {
  if (!blobId) return null;
  if (blobId.startsWith('mock-blob-')) {
    return `/api/essence/blob/${blobId}`;
  }
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}
